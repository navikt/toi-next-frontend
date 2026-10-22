import {
  installerSidehjelpere,
  type Pekepinn,
  type SideVindu,
} from './felles.js';
import type { Page } from '@playwright/test';

export type Språkvalg = {
  /** Selektorer som ikke analyseres, i tillegg til `data-axe-ignore`. */
  ekskluder?: string[];
  /** Minste antall ord i en tekstblokk før språket vurderes. Standard: 8. */
  minsteAntallOrd?: number;
};

type Språkfunn = {
  element: string;
  oppdaget: string;
  lang: string;
  arvetFraHtml: boolean;
};

/**
 * Småord som skiller språkene vi møter i Toi-appene. Ord som finnes i flere av
 * språkene (som «som», «med», «på» og norsk «to» og «by»), er utelatt.
 * Bokmål og nynorsk regnes som samme språk.
 */
const SMÅORD: Record<'no' | 'sv' | 'en', string[]> = {
  no: [
    'og',
    'er',
    'ikke',
    'ikkje',
    'å',
    'fra',
    'frå',
    'også',
    'jeg',
    'eg',
    'hva',
    'kva',
    'når',
    'skal',
    'ble',
    'vart',
    'være',
    'vere',
    'vært',
    'seg',
    'deg',
    'dere',
    'hvis',
    'dersom',
    'mer',
    'meir',
    'etter',
    'noe',
    'noko',
    'noen',
    'nokon',
    'hvordan',
    'korleis',
    'bare',
    'berre',
    'ved',
    'vår',
    'våre',
    'vårt',
    'dette',
    'disse',
    'desse',
    'enn',
    'gjennom',
    'mellom',
    'uten',
    'alle',
    'til',
    'ein',
    'eit',
    'ei',
  ],
  sv: [
    'och',
    'är',
    'inte',
    'att',
    'från',
    'också',
    'jag',
    'vad',
    'när',
    'vara',
    'varit',
    'mycket',
    'något',
    'någon',
    'några',
    'hur',
    'dig',
    'mig',
    'sig',
    'ska',
    'detta',
    'dessa',
    'efter',
    'mellan',
    'än',
    'bara',
    'vilket',
    'vilken',
    'alla',
    'samt',
    'ett',
    'till',
    'deras',
  ],
  en: [
    'the',
    'and',
    'of',
    'is',
    'in',
    'that',
    'with',
    'you',
    'are',
    'this',
    'be',
    'will',
    'we',
    'our',
    'your',
    'it',
    'have',
    'has',
    'an',
    'or',
    'on',
    'from',
    'not',
    'can',
    'which',
    'would',
    'should',
    'their',
    'they',
    'was',
    'were',
    'been',
    'what',
    'when',
    'who',
    'how',
    'also',
    'about',
    'if',
    'into',
    'than',
  ],
};

/** Kjøres i siden. Gjetter språket i hver tekstblokk og sammenligner med `lang`. */
function finnFeilSpråk({
  småord,
  ekskluder,
  minsteAntallOrd,
}: {
  småord: Record<string, string[]>;
  ekskluder: string[];
  minsteAntallOrd: number;
}): Språkfunn[] {
  const hjelp = (window as SideVindu).__toiA11y!;
  const ordlister = Object.entries(småord).map(
    ([språk, ord]) => [språk, new Set(ord)] as const,
  );
  const språkfamilie = (lang: string) => {
    const primær = lang.split('-')[0].toLowerCase();
    return ['nb', 'nn', 'no'].includes(primær) ? 'no' : primær;
  };
  const blokktagger = new Set([
    'P',
    'LI',
    'H1',
    'H2',
    'H3',
    'H4',
    'H5',
    'H6',
    'TD',
    'TH',
    'DD',
    'DT',
    'BLOCKQUOTE',
    'FIGCAPTION',
    'LEGEND',
    'CAPTION',
    'SUMMARY',
  ]);
  const hoppOverTagger = new Set([
    'SCRIPT',
    'STYLE',
    'NOSCRIPT',
    'TEMPLATE',
    'CODE',
    'PRE',
    'KBD',
    'SAMP',
    'SVG',
  ]);
  const harEgenTekst = (element: Element) =>
    [...element.childNodes].some(
      (n) =>
        n.nodeType === Node.TEXT_NODE && /\p{L}{2,}/u.test(n.textContent ?? ''),
    );
  const erBlokk = (element: Element) =>
    blokktagger.has(element.tagName) ||
    (harEgenTekst(element) &&
      !getComputedStyle(element).display.startsWith('inline'));

  const blokker = new Set<Element>();
  for (const element of document.querySelectorAll('body *')) {
    if (
      element.closest('script,style,noscript,template,code,pre,kbd,samp,svg')
    ) {
      continue;
    }
    if (erBlokk(element)) blokker.add(element);
  }

  // Teksten i en blokk, uten tekst i blokker inni den og elementer med egen lang.
  const samleTekst = (element: Element): string => {
    let tekst = '';
    for (const node of element.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) tekst += ` ${node.textContent}`;
      else if (
        node instanceof Element &&
        !blokker.has(node) &&
        !node.hasAttribute('lang') &&
        !hoppOverTagger.has(node.tagName.toUpperCase()) &&
        node.checkVisibility()
      ) {
        tekst += ` ${samleTekst(node)}`;
      }
    }
    return tekst;
  };

  const funn: Språkfunn[] = [];
  for (const blokk of blokker) {
    if (
      hjelp.erIgnorert(blokk) ||
      ekskluder.some((s) => blokk.closest(s)) ||
      !blokk.checkVisibility({
        opacityProperty: true,
        visibilityProperty: true,
      })
    ) {
      continue;
    }
    const kilde = blokk.closest('[lang]');
    const lang = kilde?.getAttribute('lang')?.trim();
    if (!lang) continue;
    const forventet = språkfamilie(lang);
    if (!ordlister.some(([s]) => s === forventet)) continue;

    const ord =
      samleTekst(blokk)
        .toLowerCase()
        .match(/\p{L}+/gu) ?? [];
    if (ord.length < minsteAntallOrd) continue;
    const treff = ordlister
      .map(([språk, liste]) => ({
        språk,
        antall: ord.filter((o) => liste.has(o)).length,
      }))
      .sort((a, b) => b.antall - a.antall);
    const [best, nest] = treff;
    const sikker =
      best.antall >= 3 &&
      best.antall >= 2 * nest.antall &&
      best.antall / ord.length >= 0.1;
    if (sikker && best.språk !== forventet) {
      funn.push({
        element: hjelp.beskriv(blokk),
        oppdaget: best.språk,
        lang,
        arvetFraHtml: kilde === document.documentElement,
      });
    }
  }
  return funn;
}

const SPRÅKNAVN: Record<string, string> = {
  no: 'norsk',
  sv: 'svensk',
  en: 'engelsk',
};

/**
 * WCAG 3.1.2 Språk i deler av innholdet: tekstblokker der teksten ser ut til å
 * være på et annet språk enn `lang` sier. Språket gjettes ut fra vanlige småord
 * på norsk (bokmål og nynorsk), svensk og engelsk. Gir pekepinner: korte
 * tekster og blandet språk vurderes ikke.
 */
export async function analyserSpråk(
  page: Page,
  valg: Språkvalg = {},
): Promise<Pekepinn[]> {
  await installerSidehjelpere(page);
  const funn = await page.evaluate(finnFeilSpråk, {
    småord: SMÅORD,
    ekskluder: valg.ekskluder ?? [],
    minsteAntallOrd: valg.minsteAntallOrd ?? 8,
  });
  return funn.map((f) => ({
    kriterium: '3.1.2',
    sjekk: 'språk',
    element: f.element,
    melding: `teksten ser ut til å være ${SPRÅKNAVN[f.oppdaget]}, men lang er «${f.lang}»${
      f.arvetFraHtml ? ' (arvet fra <html>)' : ''
    }`,
  }));
}
