import {
  formaterFunn,
  installerSidehjelpere,
  type SideVindu,
  ventTilStabilLayout,
} from './felles.js';
import { expect, type Locator, type Page } from '@playwright/test';

export type Skjemafeilvalg = {
  /**
   * Krev at fokus flyttes til feiloppsummeringen eller første felt med feil.
   * WCAG krever det ikke, men Aksel anbefaler det. Standard: false.
   */
  forventFokus?: boolean;
};

/**
 * WCAG 3.3.1 Identifikasjon av feil: sender inn skjemaet og sjekker at felt med
 * feil er markert med aria-invalid, at feilmeldingen er koblet til feltet med
 * aria-describedby, og at lenkene i en feiloppsummering peker på felt som finnes.
 */
export async function analyserSkjemafeil(
  page: Page,
  send: Locator,
  valg: Skjemafeilvalg = {},
): Promise<string[]> {
  await installerSidehjelpere(page);
  await send.click();
  await ventTilStabilLayout(page);

  return page.evaluate((forventFokus) => {
    const hjelp = (window as SideVindu).__toiA11y!;
    const synlig = (e: Element) => {
      const boks = e.getBoundingClientRect();
      return (
        boks.width > 0 &&
        boks.height > 0 &&
        getComputedStyle(e).visibility !== 'hidden'
      );
    };
    const tekst = (e: Element) =>
      ((e as HTMLElement).innerText ?? e.textContent ?? '')
        .replace(/\s+/g, ' ')
        .trim();
    const funn: string[] = [];

    const ugyldige = [
      ...document.querySelectorAll('[aria-invalid="true"]'),
    ].filter((e) => !hjelp.erIgnorert(e));
    const oppsummering = [
      ...document.querySelectorAll(
        '.aksel-error-summary, .navds-error-summary, [data-feiloppsummering]',
      ),
    ].find(synlig);

    if (ugyldige.length === 0 && !oppsummering) {
      funn.push(
        'WCAG 3.3.1: ingen felt er markert med aria-invalid og ingen feiloppsummering vises etter innsending med feil',
      );
    }

    for (const felt of ugyldige) {
      const meldinger = (felt.getAttribute('aria-describedby') ?? '')
        .split(/\s+/)
        .map((id) => (id ? document.getElementById(id) : null))
        .filter((e): e is HTMLElement => !!e && synlig(e) && !!tekst(e));
      if (meldinger.length === 0) {
        funn.push(
          `WCAG 3.3.1: ${hjelp.beskriv(felt)} er markert med feil, men ingen synlig feilmelding er koblet til med aria-describedby`,
        );
      }
    }

    if (oppsummering) {
      for (const lenke of oppsummering.querySelectorAll('a[href^="#"]')) {
        const id = decodeURIComponent(
          (lenke.getAttribute('href') ?? '').slice(1),
        );
        if (!id || !document.getElementById(id)) {
          funn.push(
            `WCAG 3.3.1: lenken «${tekst(lenke)}» i feiloppsummeringen peker på et element som ikke finnes (#${id})`,
          );
        }
      }
    }

    if (forventFokus) {
      const aktiv = document.activeElement;
      const iOppsummering = !!oppsummering && oppsummering.contains(aktiv);
      const påUgyldig = ugyldige.some((e) => e === aktiv || e.contains(aktiv));
      if (!iOppsummering && !påUgyldig) {
        funn.push(
          `Fokus flyttes ikke til feiloppsummeringen eller første felt med feil (fokus er på ${aktiv && aktiv !== document.body ? hjelp.beskriv(aktiv) : 'body'})`,
        );
      }
    }

    return funn;
  }, valg.forventFokus ?? false);
}

export async function sjekkSkjemafeil(
  page: Page,
  send: Locator,
  valg: Skjemafeilvalg = {},
): Promise<void> {
  const funn = await analyserSkjemafeil(page, send, valg);
  expect(funn, formaterFunn('Skjemafeil', funn)).toEqual([]);
}
