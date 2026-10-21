import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

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
