import {
  formaterFunn,
  installerSidehjelpere,
  type SideVindu,
  ventTilStabilLayout,
} from './felles.js';
import { expect, type Page } from '@playwright/test';

type Måling = 'før' | 'etter';

/**
 * Finner tekst som havner utenfor elementer med overflow hidden/clip.
 * «før» lagrer hvilken tekst som allerede er avkuttet per element, og
 * «etter» rapporterer bare tekst som er ny. Da rapporteres bare tekst
 * som blir avkuttet på grunn av endringen, selv i containere som allerede
 * kutter annet innhold.
 */
function målAvkuttetTekst(måling: Måling): string[] {
  const vindu = window as SideVindu;
  const hjelp = vindu.__toiA11y!;
  const klipper = (v: string) => v === 'hidden' || v === 'clip';
  const ruller = (v: string) => v === 'auto' || v === 'scroll';
  const kjente = (vindu.__toiAvkuttet ??= new WeakMap());
  const funn: string[] = [];

  for (const element of document.querySelectorAll('body *')) {
    const stil = getComputedStyle(element);
    const klipperX = klipper(stil.overflowX);
    const klipperY = klipper(stil.overflowY);
    if (!klipperX && !klipperY) continue;
    // Visuelt skjult innhold (sr-only) er bevisst avkuttet.
    if (element.clientWidth <= 2 || element.clientHeight <= 2) continue;
    if (stil.visibility === 'hidden' || hjelp.erIgnorert(element)) continue;

    const boks = element.getBoundingClientRect();
    const venstre = boks.left + (parseFloat(stil.borderLeftWidth) || 0);
    const topp = boks.top + (parseFloat(stil.borderTopWidth) || 0);
    const høyre = venstre + element.clientWidth;
    const bunn = topp + element.clientHeight;

    const avkuttet = new Set<string>();
    const vandrer = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    for (let node = vandrer.nextNode(); node; node = vandrer.nextNode()) {
      const tekst = node.textContent?.replace(/\s+/g, ' ').trim();
      if (!tekst) continue;

      let hoppOver = false;
      for (
        let f = node.parentElement;
        f && f !== element;
        f = f.parentElement
      ) {
        const s = getComputedStyle(f);
        // Tekst bak egen rulling, egen klipping eller fast posisjon vurderes for seg.
        if (
          ruller(s.overflowX) ||
          ruller(s.overflowY) ||
          klipper(s.overflowX) ||
          klipper(s.overflowY) ||
          s.position === 'fixed' ||
          s.visibility === 'hidden'
        ) {
          hoppOver = true;
          break;
        }
        if (s.position === 'absolute' && f instanceof HTMLElement) {
          const forelder = f.offsetParent;
          if (
            !forelder ||
            (forelder !== element && !element.contains(forelder))
          ) {
            hoppOver = true;
            break;
          }
        }
      }
      if (hoppOver) continue;

      const område = document.createRange();
      område.selectNodeContents(node);
      for (const r of område.getClientRects()) {
        if (r.width === 0 || r.height === 0) continue;
        const utenforX =
          klipperX && (r.left < venstre - 2 || r.right > høyre + 2);
        const utenforY = klipperY && (r.top < topp - 2 || r.bottom > bunn + 2);
        if (utenforX || utenforY) {
          avkuttet.add(tekst);
          break;
        }
      }
    }

    if (avkuttet.size === 0) continue;
    if (måling === 'før') {
      kjente.set(element, avkuttet);
      continue;
    }
    const fraFør = kjente.get(element);
    const ny = [...avkuttet].find((t) => !fraFør?.has(t));
    if (ny)
      funn.push(
        `${hjelp.beskriv(element).split(' «')[0]} «${ny.slice(0, 60)}»`,
      );
  }

  if (måling === 'etter') delete vindu.__toiAvkuttet;
  return funn;
}

async function finnNyAvkuttetTekst(
  page: Page,
  endre: () => Promise<void>,
  tilbakestill: () => Promise<void>,
): Promise<string[]> {
  await installerSidehjelpere(page);
  await ventTilStabilLayout(page);
  await page.evaluate(målAvkuttetTekst, 'før' as Måling);
  await endre();
  try {
    await ventTilStabilLayout(page);
    return await page.evaluate(målAvkuttetTekst, 'etter' as Måling);
  } finally {
    await tilbakestill();
    await ventTilStabilLayout(page);
  }
}

/**
 * WCAG 1.4.4: dobler rot-skriftstørrelsen (tilsvarer at brukeren øker
 * skriftstørrelsen i nettleseren) og rapporterer tekst som blir avkuttet.
 * Tekst i px skaleres ikke, og blir derfor ikke testet.
 */
export async function analyserTekstforstørrelse(page: Page): Promise<string[]> {
  return finnNyAvkuttetTekst(
    page,
    () =>
      page.evaluate(() => {
        const html = document.documentElement;
        const vindu = window as Window & { __toiFontSize?: [string, string] };
        vindu.__toiFontSize = [
          html.style.getPropertyValue('font-size'),
          html.style.getPropertyPriority('font-size'),
        ];
        const nå = parseFloat(getComputedStyle(html).fontSize);
        html.style.setProperty('font-size', `${nå * 2}px`, 'important');
      }),
    () =>
      page.evaluate(() => {
        const html = document.documentElement;
        const vindu = window as Window & { __toiFontSize?: [string, string] };
        const [verdi, prioritet] = vindu.__toiFontSize ?? ['', ''];
        if (verdi) html.style.setProperty('font-size', verdi, prioritet);
        else html.style.removeProperty('font-size');
        delete vindu.__toiFontSize;
      }),
  );
}

/** Tekstavstand som WCAG 1.4.12 krever at innholdet tåler. */
export const TEKSTAVSTAND_CSS = `* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }
p { margin-bottom: 2em !important; }`;

/** WCAG 1.4.12: legger på økt tekstavstand og rapporterer tekst som blir avkuttet. */
export async function analyserTekstavstand(page: Page): Promise<string[]> {
  return finnNyAvkuttetTekst(
    page,
    () =>
      page.evaluate((css) => {
        const stil = document.createElement('style');
        stil.id = 'toi-a11y-tekstavstand';
        stil.textContent = css;
        document.head.append(stil);
      }, TEKSTAVSTAND_CSS),
    () =>
      page.evaluate(() =>
        document.getElementById('toi-a11y-tekstavstand')?.remove(),
      ),
  );
}

export async function sjekkTekstforstørrelse(page: Page): Promise<void> {
  const funn = await analyserTekstforstørrelse(page);
  expect(
    funn,
    formaterFunn(
      'WCAG 1.4.4 Endring av tekststørrelse: tekst blir avkuttet ved 200 % tekststørrelse',
      funn,
    ),
  ).toEqual([]);
}

export async function sjekkTekstavstand(page: Page): Promise<void> {
  const funn = await analyserTekstavstand(page);
  expect(
    funn,
    formaterFunn(
      'WCAG 1.4.12 Tekstavstand: tekst blir avkuttet med økt linje-, bokstav- og ordavstand',
      funn,
    ),
  ).toEqual([]);
}
