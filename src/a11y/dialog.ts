import {
  analyserTilgjengelighet,
  formaterBrudd,
  type Tilgjengelighetsvalg,
} from './axe.js';
import {
  formaterFunn,
  installerSidehjelpere,
  type SideVindu,
  ventTilStabilLayout,
} from './felles.js';
import { expect, type Locator, type Page } from '@playwright/test';

export type Dialogvalg = Tilgjengelighetsvalg & {
  /** Åpne dialogen med Enter på utløseren eller med klikk. Standard: tastatur. */
  åpneMed?: 'tastatur' | 'klikk';
  /** Sett til false for dialoger som med vilje ikke lukkes med Esc. Da lukker testen dialogen selv. */
  lukkMedEsc?: boolean;
  /** Elementet som skal ha fokus etter at dialogen er lukket. Standard: utløseren. */
  fokusEtterLukking?: Locator;
};

const DIALOGSELEKTOR = 'dialog[open], [role="dialog"], [role="alertdialog"]';
const FØR = 'data-toi-a11y-dialog-for';
const ÅPEN = 'data-toi-a11y-dialog';

const beskrivAktivt = (page: Page) =>
  page.evaluate(() => {
    const aktiv = document.activeElement;
    if (!aktiv || aktiv === document.body) return 'body';
    return (window as SideVindu).__toiA11y!.beskriv(aktiv);
  });

async function finnNyDialog(page: Page): Promise<boolean> {
  return page.evaluate(
    ({ selektor, før, åpen }) => {
      const synlig = (e: Element) => {
        const boks = e.getBoundingClientRect();
        return (
          boks.width > 0 &&
          boks.height > 0 &&
          getComputedStyle(e).visibility !== 'hidden'
        );
      };
      const ny = [...document.querySelectorAll(selektor)]
        .filter((e) => !e.hasAttribute(før) && synlig(e))
        .at(-1);
      if (!ny) return false;
      ny.setAttribute(åpen, '');
      return true;
    },
    { selektor: DIALOGSELEKTOR, før: FØR, åpen: ÅPEN },
  );
}

async function dialogErÅpen(page: Page): Promise<boolean> {
  return page.evaluate((åpen) => {
    const dialog = document.querySelector(`[${åpen}]`);
    if (!dialog || !dialog.isConnected) return false;
    if (dialog instanceof HTMLDialogElement && !dialog.open) return false;
    const boks = dialog.getBoundingClientRect();
    return (
      boks.width > 0 &&
      boks.height > 0 &&
      getComputedStyle(dialog).visibility !== 'hidden'
    );
  }, ÅPEN);
}

async function ventPå(sjekk: () => Promise<boolean>, maksMs: number) {
  const slutt = Date.now() + maksMs;
  while (Date.now() < slutt) {
    if (await sjekk()) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return sjekk();
}

/**
 * WCAG 2.1.1, 2.1.2, 2.4.3 og 4.1.2 for en dialog: åpner dialogen fra
 * utløseren, sjekker at fokus flyttes inn og blir i modale dialoger, at
 * dialogen har navn, kjører axe på den, lukker med Esc og sjekker at fokus
 * går tilbake.
 */
export async function analyserDialog(
  page: Page,
  utløser: Locator,
  valg: Dialogvalg = {},
): Promise<string[]> {
  const {
    åpneMed = 'tastatur',
    lukkMedEsc = true,
    fokusEtterLukking,
    ...axevalg
  } = valg;
  const funn: string[] = [];
  await installerSidehjelpere(page);

  await page.evaluate(
    ({ selektor, før }) => {
      for (const e of document.querySelectorAll(selektor)) {
        const boks = e.getBoundingClientRect();
        if (boks.width > 0 && boks.height > 0) e.setAttribute(før, '');
      }
    },
    { selektor: DIALOGSELEKTOR, før: FØR },
  );

  try {
    if (åpneMed === 'tastatur') {
      await utløser.focus();
      const harFokus = await utløser.evaluate(
        (e) => e === document.activeElement,
      );
      if (harFokus) {
        await page.keyboard.press('Enter');
      } else {
        funn.push('WCAG 2.1.1: utløseren kan ikke få tastaturfokus');
        await utløser.click();
      }
    } else {
      await utløser.click();
    }

    if (!(await ventPå(() => finnNyDialog(page), 3000))) {
      throw new Error(
        'Fant ingen dialog etter at utløseren ble aktivert. Sjekk at utløseren åpner en dialog med role="dialog" eller <dialog>.',
      );
    }
    await ventTilStabilLayout(page);

    const status = await page.evaluate((åpen) => {
      const dialog = document.querySelector(`[${åpen}]`)!;
      const navnFraId = (dialog.getAttribute('aria-labelledby') ?? '')
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
        .join(' ')
        .trim();
      const navn = dialog.getAttribute('aria-label')?.trim() || navnFraId;
      return {
        harNavn: navn.length > 0,
        modal:
          dialog.matches('dialog:modal') ||
          dialog.getAttribute('aria-modal') === 'true',
        fokusInne: dialog.contains(document.activeElement),
        fokuserbare: dialog.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ).length,
      };
    }, ÅPEN);

    if (!status.harNavn) {
      funn.push(
        'WCAG 4.1.2: dialogen har ikke navn (aria-labelledby eller aria-label)',
      );
    }
    if (!status.fokusInne) {
      funn.push(
        `WCAG 2.4.3: fokus flyttes ikke inn i dialogen når den åpnes (fokus er på ${await beskrivAktivt(page)})`,
      );
    }

    if (status.modal) {
      for (let i = 0; i < Math.min(status.fokuserbare, 30) + 2; i++) {
        await page.keyboard.press('Tab');
        const utenfor = await page.evaluate((åpen) => {
          const dialog = document.querySelector(`[${åpen}]`)!;
          const aktiv = document.activeElement;
          if (!aktiv || aktiv === document.body) return null;
          if (aktiv === document.documentElement) return null;
          return dialog.contains(aktiv)
            ? null
            : (window as SideVindu).__toiA11y!.beskriv(aktiv);
        }, ÅPEN);
        if (utenfor) {
          funn.push(
            `WCAG 2.4.3: Tab flytter fokus ut av den modale dialogen til ${utenfor}`,
          );
          break;
        }
      }
    }

    const axe = await analyserTilgjengelighet(page, {
      ...axevalg,
      inkluder: [`[${ÅPEN}]`],
    });
    if (axe.violations.length > 0) {
      funn.push(`axe i dialogen: ${formaterBrudd(axe.violations)}`);
    }

    if (!lukkMedEsc) return funn;

    // Esc fanges ofte av dialogen selv, så fokus må være inne når den trykkes.
    await page.evaluate((åpen) => {
      const dialog = document.querySelector(`[${åpen}]`)!;
      if (!dialog.contains(document.activeElement)) {
        (
          dialog.querySelector<HTMLElement>(
            'button, a[href], input, select, textarea, [tabindex]',
          ) ?? (dialog as HTMLElement)
        ).focus();
      }
    }, ÅPEN);

    await page.keyboard.press('Escape');
    const lukket = await ventPå(async () => !(await dialogErÅpen(page)), 2000);
    if (!lukket) {
      funn.push('WCAG 2.1.2: dialogen lukkes ikke med Esc');
      return funn;
    }

    const mål = fokusEtterLukking ?? utløser;
    const fokusTilbake = await ventPå(
      () =>
        mål
          .evaluate(
            (e) =>
              e === document.activeElement ||
              e.contains(document.activeElement),
          )
          .catch(() => false),
      1000,
    );
    if (!fokusTilbake) {
      funn.push(
        `WCAG 2.4.3: fokus går ikke tilbake til ${fokusEtterLukking ? 'det forventede elementet' : 'utløseren'} når dialogen lukkes (fokus er på ${await beskrivAktivt(page)})`,
      );
    }
    return funn;
  } finally {
    await page.evaluate(
      ({ før, åpen }) => {
        for (const e of document.querySelectorAll(`[${før}], [${åpen}]`)) {
          e.removeAttribute(før);
          e.removeAttribute(åpen);
        }
      },
      { før: FØR, åpen: ÅPEN },
    );
  }
}

export async function sjekkDialog(
  page: Page,
  utløser: Locator,
  valg: Dialogvalg = {},
): Promise<void> {
  const funn = await analyserDialog(page, utløser, valg);
  expect(funn, formaterFunn('Dialog', funn)).toEqual([]);
}
