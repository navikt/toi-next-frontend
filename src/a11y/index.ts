import AxeBuilder from '@axe-core/playwright';
import {
  expect,
  type Page,
  type PlaywrightTestArgs,
  type PlaywrightWorkerArgs,
  type PlaywrightWorkerOptions,
  type TestInfo,
  type TestType,
} from '@playwright/test';
import { ventTilStabilLayout } from './felles.js';
import { sjekkTastatur, type Tastaturvalg } from './tastatur.js';
import { sjekkTekstavstand, sjekkTekstforstørrelse } from './tekst.js';
import { sjekkVisningsretning } from './visningsretning.js';

export {
  analyserTastatur,
  formaterTastaturfunn,
  sjekkTastatur,
  type Tastaturfunn,
  type Tastaturresultat,
  type Tastaturvalg,
} from './tastatur.js';
export {
  analyserTekstavstand,
  analyserTekstforstørrelse,
  sjekkTekstavstand,
  sjekkTekstforstørrelse,
  TEKSTAVSTAND_CSS,
} from './tekst.js';
export {
  analyserVisningsretning,
  sjekkVisningsretning,
  VISNINGSRETNINGER,
} from './visningsretning.js';

export type Axeresultat = Awaited<ReturnType<AxeBuilder['analyze']>>;
export type Axebrudd = Axeresultat['violations'][number];

export const WCAG21_AA_TAGGER = [
  'wcag2a',
  'wcag2aa',
  'wcag21a',
  'wcag21aa',
] as const;

/**
 * Innhold andre team eier, som dekoratøren, merkes med `data-axe-ignore`.
 * Samme konvensjon som Aksel bruker i sine egne axe-tester.
 */
export const STANDARD_EKSKLUDERINGER = ['[data-axe-ignore]'] as const;

/** Tag som lar CI kjøre tilgjengelighetstestene separat: `--grep @a11y`. */
export const TILGJENGELIGHETSTAG = '@a11y';

/** 320 CSS-piksler tilsvarer 1280 px bredde ved 400 % zoom (WCAG 1.4.10). */
export const REFLOW_VIEWPORT = { width: 320, height: 256 } as const;

export type Tilgjengelighetsvalg = {
  /** Selektorer som ikke analyseres, i tillegg til STANDARD_EKSKLUDERINGER. */
  ekskluder?: string[];
  /** Begrens analysen til disse selektorene. */
  inkluder?: string[];
  /** Axe-regler som slås av, med begrunnelse. Bør peke til en sak. */
  unntak?: Record<string, string>;
};

/** Kontrast måles feil midt i CSS-overganger, så endelige animasjoner spoles til slutt. */
async function fullførAnimasjoner(page: Page) {
  await page.evaluate(() => {
    for (const animasjon of document.getAnimations()) {
      if (animasjon.effect?.getComputedTiming().endTime !== Infinity) {
        animasjon.finish();
      }
    }
  });
}

export async function analyserTilgjengelighet(
  page: Page,
  valg: Tilgjengelighetsvalg = {},
): Promise<Axeresultat> {
  await fullførAnimasjoner(page);

  let builder = new AxeBuilder({ page }).withTags([...WCAG21_AA_TAGGER]);

  for (const selektor of valg.inkluder ?? []) {
    builder = builder.include(selektor);
  }
  for (const selektor of [
    ...STANDARD_EKSKLUDERINGER,
    ...(valg.ekskluder ?? []),
  ]) {
    builder = builder.exclude(selektor);
  }

  const unntak = Object.keys(valg.unntak ?? {});
  if (unntak.length > 0) {
    builder = builder.disableRules(unntak);
  }

  return builder.analyze();
}

const wcagKriterier = (tags: string[]) =>
  tags
    .filter((tag) => /^wcag\d{3,}$/.test(tag))
    .map((tag) => tag.replace(/^wcag(\d)(\d)(\d+)$/, '$1.$2.$3'));

export function formaterBrudd(brudd: Axebrudd[]): string {
  if (brudd.length === 0) return 'Ingen WCAG 2.1 A/AA-brudd funnet';

  const linjer = brudd.map((b) => {
    const kriterier = wcagKriterier(b.tags).join(', ') || 'ukjent kriterium';
    const elementer = b.nodes
      .slice(0, 5)
      .map((node) => `      - ${node.target.join(' ')}`)
      .join('\n');
    const flere =
      b.nodes.length > 5 ? `\n      … og ${b.nodes.length - 5} til` : '';

    return [
      `  ✗ [${b.impact ?? 'ukjent'}] ${b.id} (WCAG ${kriterier}): ${b.help}`,
      `    ${b.helpUrl}`,
      `    Elementer (${b.nodes.length}):`,
      `${elementer}${flere}`,
    ].join('\n');
  });

  return `${brudd.length} WCAG 2.1 A/AA-brudd funnet:\n${linjer.join('\n')}`;
}

export async function sjekkTilgjengelighet(
  page: Page,
  valg: Tilgjengelighetsvalg = {},
  testInfo?: TestInfo,
): Promise<Axeresultat> {
  const resultat = await analyserTilgjengelighet(page, valg);

  if (
    testInfo &&
    (resultat.violations.length > 0 || resultat.incomplete.length > 0)
  ) {
    await testInfo.attach('axe-resultat.json', {
      body: JSON.stringify(
        { violations: resultat.violations, incomplete: resultat.incomplete },
        null,
        2,
      ),
      contentType: 'application/json',
    });
  }

  expect(
    resultat.violations.map((b) => b.id),
    formaterBrudd(resultat.violations),
  ).toEqual([]);

  return resultat;
}

/** WCAG 1.4.10: innholdet skal ikke kreve horisontal rulling ved 320 px bredde. */
export async function sjekkReflow(page: Page): Promise<void> {
  const opprinnelig = page.viewportSize();
  await page.setViewportSize(REFLOW_VIEWPORT);
  try {
    // Måles først når siden har tilpasset seg. Rett etter resize kan siden se
    // riktig ut før React har rendret på nytt.
    await ventTilStabilLayout(page);
    const overflyt = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(
      overflyt,
      `Siden krever horisontal rulling ved 320 px bredde (WCAG 1.4.10 Reflow): innholdet er ${overflyt} px for bredt`,
    ).toBeLessThanOrEqual(1);
  } finally {
    if (opprinnelig) {
      await page.setViewportSize(opprinnelig);
      await ventTilStabilLayout(page);
    }
  }
}

export type Tilgjengelighetstestvalg = Tilgjengelighetsvalg & {
  /**
   * Slår på sjekkene under som ikke er satt: reflow, tekstforstørrelse,
   * tekstavstand, visningsretning og tastatur. De kjøres i en egen test tagget
   * `@a11y-utvidet`. Sjekker som settes eksplisitt til true, kjøres i hovedtesten
   * sammen med axe, og false slår dem av.
   */
  utvidet?: boolean;
  /** WCAG 1.4.10 Reflow. */
  reflow?: boolean;
  /** WCAG 1.4.4 Endring av tekststørrelse. */
  tekstforstørrelse?: boolean;
  /** WCAG 1.4.12 Tekstavstand. */
  tekstavstand?: boolean;
  /** WCAG 1.3.4 Visningsretning. */
  visningsretning?: boolean;
  /** WCAG 2.1.1, 2.1.2, 2.4.7 og 3.2.1. */
  tastatur?: boolean | Tastaturvalg;
  /** Slår på mørk modus og kjører axe på nytt (WCAG 1.4.3 i mørk modus). */
  mørkModus?: (page: Page) => Promise<void>;
};

const feilmelding = (feil: unknown) => {
  if (!(feil instanceof Error)) return String(feil);
  // Diffen fra expect gjentar bare listen i meldingen over, så den tas ikke med.
  return feil.message
    .replace(/\u001b\[[0-9;]*m/g, '')
    .split(/\n\s*expect\(|\n\nCall log:/)[0]
    .trim();
};

type Sjekk = [navn: string, kjør: () => Promise<unknown>];

async function kjørSjekker(
  test: {
    step: TestType<PlaywrightTestArgs, PlaywrightWorkerArgs>['step'];
    slow: () => void;
  },
  sjekker: Sjekk[],
): Promise<void> {
  if (sjekker.length > 2) test.slow();
  const feil: string[] = [];
  for (const [navn, kjør] of sjekker) {
    try {
      await test.step(navn, kjør, { box: true });
    } catch (e) {
      feil.push(`▶ ${navn}\n${feilmelding(e)}`);
    }
  }
  if (feil.length > 0) throw new Error(feil.join('\n\n'));
}

/** Tag for testen med sjekkene som bare er slått på via `utvidet: true`. */
export const UTVIDET_TILGJENGELIGHETSTAG = '@a11y-utvidet';

/**
 * Registrerer tester for siden `beforeEach` har åpnet. Kjøres kun i Chromium.
 *
 * - «Tilgjengelighet (WCAG 2.1 A/AA)» (`@a11y`): axe og sjekker som er slått på eksplisitt.
 * - «Tilgjengelighet – utvidede sjekker» (`@a11y` og `@a11y-utvidet`): sjekkene som bare er
 *   slått på med `utvidet: true`. De kan dermed kjøres uten å stoppe deploy
 *   (`--grep-invert @a11y-utvidet`) mens funnene rettes.
 */
export const tilgjengelighetstest = <
  T extends PlaywrightTestArgs,
  W extends PlaywrightWorkerArgs & PlaywrightWorkerOptions,
>(
  test: TestType<T, W>,
  valg: Tilgjengelighetstestvalg = {},
) => {
  const tastaturvalg = typeof valg.tastatur === 'object' ? valg.tastatur : {};
  const tilgjengelige: [
    nøkkel:
      | 'reflow'
      | 'tekstforstørrelse'
      | 'tekstavstand'
      | 'visningsretning'
      | 'tastatur',
    lag: (page: Page, info: TestInfo) => Sjekk,
  ][] = [
    ['reflow', (page) => ['Reflow (1.4.10)', () => sjekkReflow(page)]],
    [
      'tekstforstørrelse',
      (page) => [
        'Tekstforstørrelse (1.4.4)',
        () => sjekkTekstforstørrelse(page),
      ],
    ],
    [
      'tekstavstand',
      (page) => ['Tekstavstand (1.4.12)', () => sjekkTekstavstand(page)],
    ],
    [
      'visningsretning',
      (page) => ['Visningsretning (1.3.4)', () => sjekkVisningsretning(page)],
    ],
    [
      'tastatur',
      (page, info) => [
        'Tastatur (2.1.1, 2.1.2, 2.4.7, 3.2.1)',
        () => sjekkTastatur(page, tastaturvalg, info),
      ],
    ],
  ];
  const eksplisitte = tilgjengelige.filter(
    ([nøkkel]) => valg[nøkkel] !== undefined && valg[nøkkel] !== false,
  );
  const viaUtvidet = valg.utvidet
    ? tilgjengelige.filter(([nøkkel]) => valg[nøkkel] === undefined)
    : [];

  test(
    'Tilgjengelighet (WCAG 2.1 A/AA)',
    { tag: TILGJENGELIGHETSTAG },
    async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'Axe kjøres kun i Chromium');
      const info = test.info();
      const sjekker: Sjekk[] = [
        ['axe (WCAG 2.1 A/AA)', () => sjekkTilgjengelighet(page, valg, info)],
        ...eksplisitte.map(([, lag]) => lag(page, info)),
      ];
      const mørkModus = valg.mørkModus;
      if (mørkModus) {
        sjekker.push([
          'Mørk modus: axe',
          async () => {
            await mørkModus(page);
            await sjekkTilgjengelighet(page, valg, info);
          },
        ]);
      }
      await kjørSjekker(test, sjekker);
    },
  );

  if (viaUtvidet.length > 0) {
    test(
      'Tilgjengelighet – utvidede sjekker',
      { tag: [TILGJENGELIGHETSTAG, UTVIDET_TILGJENGELIGHETSTAG] },
      async ({ page, browserName }) => {
        test.skip(browserName !== 'chromium', 'Kjøres kun i Chromium');
        const info = test.info();
        await kjørSjekker(
          test,
          viaUtvidet.map(([, lag]) => lag(page, info)),
        );
      },
    );
  }
};
