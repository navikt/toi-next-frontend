import { formaterFunn } from './felles.js';
import { expect, type Locator, type Page } from '@playwright/test';

export type Pekervalg = {
  /**
   * Innholdet som vises ved hover eller fokus. Standard: elementene utløseren
   * peker på med aria-describedby, ellers siste synlige role="tooltip".
   */
  innhold?: Locator;
  /** Hvor lenge innholdet skal bli værende mens pekeren er over det. Standard: 1000 ms. */
  varighetMs?: number;
};

const vent = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function finnInnhold(page: Page, utløser: Locator, valg: Pekervalg) {
  if (valg.innhold) return valg.innhold;
  const ider = (await utløser.getAttribute('aria-describedby'))
    ?.split(/\s+/)
    .filter(Boolean);
  if (ider?.length) {
    return page.locator(ider.map((id) => `[id="${id}"]`).join(', ')).last();
  }
  return page.getByRole('tooltip').last();
}

async function erSynlig(innhold: Locator) {
  return innhold.isVisible().catch(() => false);
}

async function ventPåSynlighet(innhold: Locator, synlig: boolean, ms = 1500) {
  const slutt = Date.now() + ms;
  while (Date.now() < slutt) {
    if ((await erSynlig(innhold)) === synlig) return true;
    await vent(50);
  }
  return (await erSynlig(innhold)) === synlig;
}

/**
 * WCAG 1.4.13 Pekerfølsomt innhold: viser innholdet med hover og fokus og
 * sjekker at det kan nås med pekeren, blir værende og kan lukkes med Esc.
 */
export async function analyserPekerfølsomtInnhold(
  page: Page,
  utløser: Locator,
  valg: Pekervalg = {},
): Promise<string[]> {
  const funn: string[] = [];
  const varighet = valg.varighetMs ?? 1000;

  await page.mouse.move(0, 0);
  await utløser.hover();
  const innhold = await finnInnhold(page, utløser, valg);
  if (!(await ventPåSynlighet(innhold, true))) {
    throw new Error(
      'Fant ikke innhold som vises når pekeren er over utløseren. Angi valg.innhold.',
    );
  }

  const fra = await utløser.boundingBox();
  const til = await innhold.boundingBox();
  if (fra && til) {
    await page.mouse.move(fra.x + fra.width / 2, fra.y + fra.height / 2);
    await page.mouse.move(til.x + til.width / 2, til.y + til.height / 2, {
      steps: 10,
    });
    await vent(300);
    if (!(await erSynlig(innhold))) {
      funn.push(
        'WCAG 1.4.13: innholdet forsvinner når pekeren flyttes fra utløseren over på innholdet',
      );
    } else {
      await vent(varighet);
      if (!(await erSynlig(innhold))) {
        funn.push(
          'WCAG 1.4.13: innholdet forsvinner av seg selv mens pekeren er over det',
        );
      }
    }
  }

  await utløser.hover();
  if (await ventPåSynlighet(innhold, true)) {
    await page.keyboard.press('Escape');
    if (!(await ventPåSynlighet(innhold, false, 500))) {
      funn.push(
        'WCAG 1.4.13: innholdet som vises ved hover, lukkes ikke med Esc',
      );
    }
  }

  await page.mouse.move(0, 0);
  await ventPåSynlighet(innhold, false);
  await utløser.focus();
  if (await ventPåSynlighet(innhold, true, 1000)) {
    await page.keyboard.press('Escape');
    if (!(await ventPåSynlighet(innhold, false, 500))) {
      funn.push(
        'WCAG 1.4.13: innholdet som vises ved fokus, lukkes ikke med Esc',
      );
    }
    const fokusBeholdt = await utløser.evaluate(
      (e) => e === document.activeElement,
    );
    if (!fokusBeholdt) {
      funn.push('WCAG 1.4.13: Esc flytter fokus bort fra utløseren');
    }
  }
  await utløser.blur().catch(() => undefined);

  return funn;
}

export async function sjekkPekerfølsomtInnhold(
  page: Page,
  utløser: Locator,
  valg: Pekervalg = {},
): Promise<void> {
  const funn = await analyserPekerfølsomtInnhold(page, utløser, valg);
  expect(funn, formaterFunn('Pekerfølsomt innhold', funn)).toEqual([]);
}
