import { test, type Page, type TestInfo } from '@playwright/test';
import { analyserBevegelse } from './bevegelse.js';
import { formaterFunn, type Pekepinn } from './felles.js';
import { analyserKontrastIkkeTekst } from './kontrast.js';
import { analyserLandemerker } from './landemerker.js';
import { analyserSpråk } from './sprak.js';

/** Typen på annotations med pekepinner i Playwright-rapporten. */
export const PEKEPINN_ANNOTASJON = 'a11y-pekepinn';
/** Maks antall annotations per test. Alle funn ligger i vedlegget. */
const MAKS_ANNOTASJONER = 30;

export type Pekepinnvalg = {
  /** Selektorer som ikke analyseres, i tillegg til `data-axe-ignore`. */
  ekskluder?: string[];
  /** WCAG 1.4.11 Kontrast for ikke-tekst. Standard: true. */
  kontrastIkkeTekst?: boolean;
  /** WCAG 2.2.2 Pause, stopp, skjul. Standard: true. */
  bevegelse?: boolean;
  /** WCAG 3.1.2 Språk i deler av innholdet. Standard: true. */
  språk?: boolean;
  /** Axe-reglene `landmark-no-duplicate-main` og `landmark-main-is-top-level`. Standard: true. */
  landemerker?: boolean;
};

export type Pekepinnresultat = {
  pekepinner: Pekepinn[];
  /** Sjekker som ikke kunne kjøres, med feilmelding. */
  feil: string[];
};

export const formaterPekepinn = (p: Pekepinn) =>
  `WCAG ${p.kriterium} ${p.element}: ${p.melding}`;

export function formaterPekepinner(pekepinner: Pekepinn[]): string {
  return formaterFunn(
    'Pekepinner om tilgjengelighet',
    pekepinner.map(formaterPekepinn),
    MAKS_ANNOTASJONER,
  );
}

/**
 * Kjører sjekkene som gir pekepinner. Kaster aldri: en sjekk som feiler,
 * rapporteres i `feil`. Bevegelse kjøres først, før noe annet spoler animasjoner.
 */
export async function analyserPekepinner(
  page: Page,
  valg: Pekepinnvalg = {},
): Promise<Pekepinnresultat> {
  const ekskluder = valg.ekskluder;
  const sjekker: [
    navn: string,
    på: boolean | undefined,
    kjør: () => Promise<Pekepinn[]>,
  ][] = [
    ['bevegelse', valg.bevegelse, () => analyserBevegelse(page, { ekskluder })],
    ['språk', valg.språk, () => analyserSpråk(page, { ekskluder })],
    [
      'landemerker',
      valg.landemerker,
      () => analyserLandemerker(page, { ekskluder }),
    ],
    [
      'kontrast-ikke-tekst',
      valg.kontrastIkkeTekst,
      () => analyserKontrastIkkeTekst(page, { ekskluder }),
    ],
  ];
  const resultat: Pekepinnresultat = { pekepinner: [], feil: [] };
  for (const [navn, på, kjør] of sjekker) {
    if (på === false) continue;
    try {
      resultat.pekepinner.push(...(await kjør()));
    } catch (e) {
      resultat.feil.push(
        `${navn}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
  return resultat;
}

/** Legger pekepinnene til som annotations og som `a11y-pekepinner.json` i rapporten. */
export async function rapporterPekepinner(
  testInfo: TestInfo,
  { pekepinner, feil }: Pekepinnresultat,
): Promise<void> {
  for (const pekepinn of pekepinner.slice(0, MAKS_ANNOTASJONER)) {
    testInfo.annotations.push({
      type: PEKEPINN_ANNOTASJON,
      description: formaterPekepinn(pekepinn),
    });
  }
  if (pekepinner.length > MAKS_ANNOTASJONER) {
    testInfo.annotations.push({
      type: PEKEPINN_ANNOTASJON,
      description: `… og ${pekepinner.length - MAKS_ANNOTASJONER} til. Se a11y-pekepinner.json`,
    });
  }
  for (const melding of feil) {
    testInfo.annotations.push({
      type: `${PEKEPINN_ANNOTASJON}-feil`,
      description: melding,
    });
  }
  if (pekepinner.length > 0 || feil.length > 0) {
    await testInfo.attach('a11y-pekepinner.json', {
      body: JSON.stringify({ pekepinner, feil }, null, 2),
      contentType: 'application/json',
    });
  }
}

const gjeldendeTestInfo = () => {
  try {
    return test.info();
  } catch {
    return undefined;
  }
};

/**
 * Kjører sjekkene som gir pekepinner og rapporterer funnene i Playwright-rapporten.
 * Feiler aldri testen, siden sjekkene ikke er kalibrert ennå.
 */
export async function sjekkPekepinner(
  page: Page,
  valg: Pekepinnvalg = {},
  testInfo: TestInfo | undefined = gjeldendeTestInfo(),
): Promise<Pekepinnresultat> {
  const resultat = await analyserPekepinner(page, valg);
  if (testInfo) await rapporterPekepinner(testInfo, resultat);
  return resultat;
}
