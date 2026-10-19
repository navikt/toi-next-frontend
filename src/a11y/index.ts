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
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              document.documentElement.scrollWidth -
              document.documentElement.clientWidth,
          ),
        {
          message:
            'Siden krever horisontal rulling ved 320 px bredde (WCAG 1.4.10 Reflow)',
        },
      )
      .toBeLessThanOrEqual(1);
  } finally {
    if (opprinnelig) await page.setViewportSize(opprinnelig);
  }
}

export type Tilgjengelighetstestvalg = Tilgjengelighetsvalg & {
  /** Sjekk også WCAG 1.4.10 Reflow. */
  reflow?: boolean;
};

/**
 * Registrerer en test som kjører axe mot siden `beforeEach` har åpnet.
 * Kjøres kun i Chromium, siden axe-resultatene er DOM-baserte.
 */
export const tilgjengelighetstest = <
  T extends PlaywrightTestArgs,
  W extends PlaywrightWorkerArgs & PlaywrightWorkerOptions,
>(
  test: TestType<T, W>,
  valg: Tilgjengelighetstestvalg = {},
) =>
  test(
    'Tilgjengelighet (WCAG 2.1 A/AA)',
    { tag: TILGJENGELIGHETSTAG },
    async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'Axe kjøres kun i Chromium');
      await sjekkTilgjengelighet(page, valg, test.info());
      if (valg.reflow) await sjekkReflow(page);
    },
  );
