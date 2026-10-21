import {
  formaterFunn,
  installerSidehjelpere,
  type SideVindu,
} from './felles.js';
import { expect, type Page } from '@playwright/test';

/**
 * WCAG 2.4.1 Hoppe over blokker: første Tab-stopp skal være en lenke til et
 * anker på siden, målet skal finnes og være synlig, og etter Enter skal neste
 * Tab gå til målet eller videre, ikke tilbake til starten av siden.
 */
export async function analyserHoppTilHovedinnhold(
  page: Page,
): Promise<string[]> {
  await installerSidehjelpere(page);
  const startUrl = page.url();

  // Med en modal åpen er resten av siden utilgjengelig, så lenken gjelder ikke.
  const modalÅpen = await page.evaluate(() =>
    [...document.querySelectorAll('dialog:modal, [aria-modal="true"]')].some(
      (e) => {
        const boks = e.getBoundingClientRect();
        return boks.width > 0 && boks.height > 0;
      },
    ),
  );
  if (modalÅpen) return [];

  await page.evaluate(() => {
    const start = document.createElement('div');
    start.tabIndex = -1;
    start.style.cssText =
      'position:absolute;top:0;left:0;width:0;height:0;overflow:hidden';
    document.body.prepend(start);
    start.focus({ preventScroll: true });
    start.remove();
  });
  await page.keyboard.press('Tab');

  const lenke = await page.evaluate(() => {
    const hjelp = (window as SideVindu).__toiA11y!;
    const aktiv = document.activeElement;
    if (!aktiv || aktiv === document.body) return { feil: 'ingen' } as const;
    const href = aktiv.getAttribute('href') ?? '';
    if (aktiv.tagName !== 'A' || !href.startsWith('#') || href.length < 2) {
      return { feil: 'ikke-lenke', beskrivelse: hjelp.beskriv(aktiv) } as const;
    }
    const id = decodeURIComponent(href.slice(1));
    const mål = document.getElementById(id);
    if (!mål) return { feil: 'mangler-mål', id } as const;
    const boks = mål.getBoundingClientRect();
    if (boks.width === 0 || boks.height === 0) {
      return { feil: 'skjult-mål', id } as const;
    }
    mål.setAttribute('data-toi-a11y-hoppmal', '');
    return { feil: null, id } as const;
  });

  if (lenke.feil === 'ingen') {
    return ['WCAG 2.4.1: første Tab gir ikke fokus til noe element'];
  }
  if (lenke.feil === 'ikke-lenke') {
    return [
      `WCAG 2.4.1: første Tab-stopp er ikke en lenke til hovedinnholdet (fokus er på ${lenke.beskrivelse})`,
    ];
  }
  if (lenke.feil === 'mangler-mål') {
    return [
      `WCAG 2.4.1: «Hopp til hovedinnhold» peker til #${lenke.id}, som ikke finnes på siden`,
    ];
  }
  if (lenke.feil === 'skjult-mål') {
    return [
      `WCAG 2.4.1: «Hopp til hovedinnhold» peker til #${lenke.id}, som ikke er synlig`,
    ];
  }

  try {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
    await page.keyboard.press('Tab');
    const etter = await page.evaluate(() => {
      const hjelp = (window as SideVindu).__toiA11y!;
      const mål = document.querySelector('[data-toi-a11y-hoppmal]')!;
      const aktiv = document.activeElement;
      if (!aktiv || aktiv === document.body) return null;
      const iEllerEtter =
        mål === aktiv ||
        mål.contains(aktiv) ||
        !!(
          mål.compareDocumentPosition(aktiv) & Node.DOCUMENT_POSITION_FOLLOWING
        );
      return iEllerEtter ? null : hjelp.beskriv(aktiv);
    });
    return etter
      ? [
          `WCAG 2.4.1: etter «Hopp til hovedinnhold» går Tab til ${etter}, som ligger før hovedinnholdet`,
        ]
      : [];
  } finally {
    await page.evaluate(() =>
      document
        .querySelector('[data-toi-a11y-hoppmal]')
        ?.removeAttribute('data-toi-a11y-hoppmal'),
    );
    if (page.url() !== startUrl) {
      await page.evaluate(
        (url) => history.replaceState(history.state, '', url),
        startUrl,
      );
    }
  }
}

export async function sjekkHoppTilHovedinnhold(page: Page): Promise<void> {
  const funn = await analyserHoppTilHovedinnhold(page);
  expect(funn, formaterFunn('Hopp til hovedinnhold', funn)).toEqual([]);
}
