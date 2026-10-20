import { formaterFunn, ventTilStabilLayout } from './felles.js';
import { expect, type Page } from '@playwright/test';

export const VISNINGSRETNINGER = {
  stående: { width: 390, height: 844 },
  liggende: { width: 844, height: 390 },
} as const;

/** WCAG 1.3.4: hovedinnholdet skal være synlig og ikke rotert i begge visningsretninger. */
export async function analyserVisningsretning(page: Page): Promise<string[]> {
  const opprinnelig = page.viewportSize();
  const funn: string[] = [];
  try {
    for (const [navn, størrelse] of Object.entries(VISNINGSRETNINGER)) {
      await page.setViewportSize(størrelse);
      await ventTilStabilLayout(page);
      const status = await page.evaluate(() => {
        const innhold = document.querySelector('main') ?? document.body;
        const boks = innhold.getBoundingClientRect();
        const stil = getComputedStyle(innhold);
        const rotert = [document.documentElement, document.body, innhold].some(
          (e) => {
            const transform = getComputedStyle(e).transform;
            if (!transform || transform === 'none') return false;
            const matrise = new DOMMatrix(transform);
            return Math.abs(matrise.b) > 0.01 || Math.abs(matrise.c) > 0.01;
          },
        );
        return {
          synlig:
            boks.width > 0 &&
            boks.height > 0 &&
            stil.visibility !== 'hidden' &&
            parseFloat(stil.opacity) > 0,
          rotert,
        };
      });
      if (!status.synlig)
        funn.push(`Hovedinnholdet er skjult i ${navn} visning`);
      if (status.rotert) funn.push(`Innholdet er rotert i ${navn} visning`);
    }
  } finally {
    if (opprinnelig) {
      await page.setViewportSize(opprinnelig);
      await ventTilStabilLayout(page);
    }
  }
  return funn;
}

export async function sjekkVisningsretning(page: Page): Promise<void> {
  const funn = await analyserVisningsretning(page);
  expect(funn, formaterFunn('WCAG 1.3.4 Visningsretning', funn)).toEqual([]);
}
