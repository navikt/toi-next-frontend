import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { STANDARD_EKSKLUDERINGER } from './axe.js';
import type { Pekepinn } from './felles.js';

/**
 * Axe-regler for landemerker som ikke er WCAG-krav (taggen `best-practice`),
 * men som gir pekepinner om 1.3.1 og 2.4.1: én `main`, og ikke inni et annet landemerke.
 */
export const LANDEMERKEREGLER = [
  'landmark-no-duplicate-main',
  'landmark-main-is-top-level',
] as const;

export type Landemerkevalg = {
  /** Selektorer som ikke analyseres, i tillegg til STANDARD_EKSKLUDERINGER. */
  ekskluder?: string[];
};

/** Kjører landemerkereglene i axe og gjør bruddene om til pekepinner. */
export async function analyserLandemerker(
  page: Page,
  valg: Landemerkevalg = {},
): Promise<Pekepinn[]> {
  let builder = new AxeBuilder({ page }).withRules([...LANDEMERKEREGLER]);
  for (const selektor of [
    ...STANDARD_EKSKLUDERINGER,
    ...(valg.ekskluder ?? []),
  ]) {
    builder = builder.exclude(selektor);
  }
  const resultat = await builder.analyze();
  return resultat.violations.flatMap((brudd) =>
    brudd.nodes.map((node) => ({
      kriterium: '1.3.1',
      sjekk: 'landemerker' as const,
      element: node.target.join(' '),
      melding: `${brudd.id}: ${brudd.help}`,
    })),
  );
}
