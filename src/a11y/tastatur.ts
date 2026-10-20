import {
  formaterFunn,
  installerSidehjelpere,
  type SideVindu,
} from './felles.js';
import { expect, type Page, type TestInfo } from '@playwright/test';

export type Tastaturvalg = {
  /** Maks antall Tab-trykk. Standard er 200. */
  maksAntall?: number;
  /** Sjekk synlig fokus (WCAG 2.4.7) med skjermbilder. Standard er true. */
  synligFokus?: boolean;
};

export type Tastaturfunn = {
  kriterium: '2.1.1' | '2.1.2' | '2.4.7' | '3.2.1';
  element: string;
};

export type Tastaturresultat = {
  funn: Tastaturfunn[];
  fokusrekkefølge: string[];
  /** true hvis Tab-runden kom tilbake til starten før maksAntall. */
  fullført: boolean;
};

const KRITERIER: Record<Tastaturfunn['kriterium'], string> = {
  '2.1.1':
    'WCAG 2.1.1 Tastatur: klikkbare elementer som ikke kan nås med tastatur',
  '2.1.2': 'WCAG 2.1.2 Ingen tastaturfelle: fokus kommer ikke videre',
  '2.4.7':
    'WCAG 2.4.7 Synlig fokus: ingen synlig endring når elementet får tastaturfokus',
  '3.2.1': 'WCAG 3.2.1 Fokus: kontekstendring når elementet får fokus',
};

function finnKlikkbareUtenTastatur(): string[] {
  const hjelp = (window as SideVindu).__toiA11y!;
  const fokuserbar =
    'a[href],area[href],button,input,select,textarea,summary,iframe,label,[tabindex],[contenteditable=""],[contenteditable="true"]';
  const roller = new Set(['button', 'link', 'checkbox', 'switch']);
  const funn: string[] = [];
  for (const element of document.querySelectorAll('body *')) {
    if (
      element.closest(fokuserbar) ||
      element.closest('[inert],[disabled],[aria-disabled="true"]')
    ) {
      continue;
    }
    // Klikkbare kort som videresender klikk til en lenke eller knapp inni seg (f.eks. Aksel LinkCard).
    if (element.querySelector(fokuserbar)) continue;
    const stil = getComputedStyle(element);
    const boks = element.getBoundingClientRect();
    if (boks.width === 0 || boks.height === 0 || stil.visibility === 'hidden')
      continue;
    const rolle = element.getAttribute('role');
    const forelder = element.parentElement;
    // Bare elementet der cursor:pointer settes, ikke barna som arver den.
    const pekerOpphav =
      stil.cursor === 'pointer' &&
      (!forelder || getComputedStyle(forelder).cursor !== 'pointer');
    if ((rolle && roller.has(rolle)) || pekerOpphav) {
      if (!hjelp.erIgnorert(element)) funn.push(hjelp.beskriv(element));
    }
  }
  return funn;
}

type Fokusinfo = {
  id: number;
  beskrivelse: string;
  ignorert: boolean;
  iframe: boolean;
  dialoger: number;
};

function lesFokus(): Fokusinfo {
  const vindu = window as SideVindu;
  const hjelp = vindu.__toiA11y!;
  const register = (vindu.__toiFokus ??= {
    ider: new WeakMap(),
    elementer: [],
    neste: 1,
  });
  let element = document.activeElement;
  while (element?.shadowRoot?.activeElement)
    element = element.shadowRoot.activeElement;
  const dialoger = [
    ...document.querySelectorAll(
      'dialog[open],[role="dialog"],[role="alertdialog"],[aria-modal="true"]',
    ),
  ].filter((d) => {
    const b = d.getBoundingClientRect();
    return (
      b.width > 0 && b.height > 0 && getComputedStyle(d).visibility !== 'hidden'
    );
  }).length;
  if (
    !element ||
    element === document.body ||
    element === document.documentElement
  ) {
    return { id: 0, beskrivelse: '', ignorert: false, iframe: false, dialoger };
  }
  let id = register.ider.get(element);
  if (!id) {
    id = register.neste++;
    register.ider.set(element, id);
    register.elementer[id] = new WeakRef(element);
  }
  return {
    id,
    beskrivelse: hjelp.beskriv(element),
    ignorert: hjelp.erIgnorert(element),
    iframe: element.tagName === 'IFRAME',
    dialoger,
  };
}

type Område = { x: number; y: number; width: number; height: number };

function områdeFor([id, rull]: [number, boolean]): Område | null {
  let element =
    (window as SideVindu).__toiFokus?.elementer[id]?.deref() ?? null;
  if (!element?.isConnected) return null;
  if (rull) element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  let boks = element.getBoundingClientRect();
  // Små eller skjulte kontroller (f.eks. Aksel-avkrysningsbokser) viser fokus på forelderen.
  for (
    let nivå = 0;
    (boks.width < 8 || boks.height < 8) && element.parentElement && nivå < 3;
    nivå++
  ) {
    element = element.parentElement;
    boks = element.getBoundingClientRect();
  }
  const luft = 4;
  const x = Math.max(0, boks.left - luft);
  const y = Math.max(0, boks.top - luft);
  const width = Math.min(window.innerWidth, boks.right + luft) - x;
  const height = Math.min(window.innerHeight, boks.bottom + luft) - y;
  return width >= 1 && height >= 1 ? { x, y, width, height } : null;
}

async function skjermbilde(page: Page, clip?: Område): Promise<Buffer> {
  return page.screenshot({
    clip,
    animations: 'disabled',
    caret: 'hide',
    scale: 'css',
  });
}

/**
 * Sjekker på nytt med hele viewporten, slik at fokusmarkering på en forelder
 * (f.eks. :focus-within eller ::after på et kort) også telles.
 */
async function harSynligFokusIViewport(
  page: Page,
  id: number,
): Promise<boolean> {
  const finnes = await page.evaluate((elementId) => {
    const element = (window as SideVindu).__toiFokus?.elementer[
      elementId
    ]?.deref();
    if (!(element instanceof HTMLElement) || !element.isConnected) return false;
    element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    element.blur();
    return true;
  }, id);
  if (!finnes) return true;
  const uten = await skjermbilde(page);
  await page.evaluate((elementId) => {
    const element = (window as SideVindu).__toiFokus?.elementer[
      elementId
    ]?.deref();
    // Chromium gir :focus-visible ved programmatisk fokus når forrige interaksjon var tastatur.
    if (element instanceof HTMLElement) element.focus({ preventScroll: true });
  }, id);
  const med = await skjermbilde(page);
  return !uten.equals(med);
}

export async function analyserTastatur(
  page: Page,
  valg: Tastaturvalg = {},
): Promise<Tastaturresultat> {
  const maksAntall = valg.maksAntall ?? 200;
  const synligFokus = valg.synligFokus ?? true;
  await installerSidehjelpere(page);

  const funn: Tastaturfunn[] = (
    await page.evaluate(finnKlikkbareUtenTastatur)
  ).map((element) => ({
    kriterium: '2.1.1',
    element,
  }));

  await page.evaluate(() => {
    delete (window as SideVindu).__toiFokus;
    const start = document.createElement('div');
    start.tabIndex = -1;
    start.dataset.toiA11yStart = '';
    start.style.cssText =
      'position:absolute;top:0;left:0;width:0;height:0;overflow:hidden';
    document.body.prepend(start);
    start.focus({ preventScroll: true });
  });

  const startUrl = page.url();
  const dialogerVedStart = (await page.evaluate(lesFokus)).dialoger;
  const besøkt = new Map<number, number>();
  const fokusrekkefølge: string[] = [];
  const mistenkte: { id: number; beskrivelse: string }[] = [];
  let forrige: (Fokusinfo & { bilde: Buffer | null }) | null = null;
  let fullført = false;

  for (let i = 0; i < maksAntall; i++) {
    await page.keyboard.press('Tab');
    if (i === 0)
      await page.evaluate(() =>
        document.querySelector('[data-toi-a11y-start]')?.remove(),
      );

    if (page.url() !== startUrl) {
      funn.push({
        kriterium: '3.2.1',
        element: `${forrige?.beskrivelse ?? 'ukjent'} (navigerte til ${page.url()})`,
      });
      break;
    }
    const nå = await page.evaluate(lesFokus);

    if (forrige?.bilde && forrige.id !== nå.id) {
      const område = await page.evaluate(områdeFor, [forrige.id, true] as [
        number,
        boolean,
      ]);
      if (område && (await skjermbilde(page, område)).equals(forrige.bilde)) {
        mistenkte.push({ id: forrige.id, beskrivelse: forrige.beskrivelse });
      }
    }

    if (nå.id === 0) {
      fullført = true;
      break;
    }
    if (besøkt.has(nå.id)) {
      if (nå.iframe && forrige?.id === nå.id) continue;
      if (besøkt.get(nå.id) === 0) fullført = true;
      else funn.push({ kriterium: '2.1.2', element: nå.beskrivelse });
      break;
    }
    besøkt.set(nå.id, fokusrekkefølge.length);
    fokusrekkefølge.push(nå.beskrivelse);

    if (nå.dialoger > dialogerVedStart && !nå.ignorert) {
      funn.push({
        kriterium: '3.2.1',
        element: `${nå.beskrivelse} (åpnet en dialog)`,
      });
      break;
    }

    let bilde: Buffer | null = null;
    if (synligFokus && !nå.ignorert && !nå.iframe) {
      const område = await page.evaluate(områdeFor, [nå.id, false] as [
        number,
        boolean,
      ]);
      if (område) bilde = await skjermbilde(page, område);
      else mistenkte.push({ id: nå.id, beskrivelse: nå.beskrivelse });
    }
    forrige = { ...nå, bilde };
  }

  for (const { id, beskrivelse } of mistenkte.slice(0, 25)) {
    if (!(await harSynligFokusIViewport(page, id))) {
      funn.push({ kriterium: '2.4.7', element: beskrivelse });
    }
  }

  return { funn, fokusrekkefølge, fullført };
}

export function formaterTastaturfunn(funn: Tastaturfunn[]): string {
  if (funn.length === 0) return 'Ingen tastaturfunn';
  return (Object.keys(KRITERIER) as Tastaturfunn['kriterium'][])
    .map(
      (k) =>
        [
          k,
          funn.filter((f) => f.kriterium === k).map((f) => f.element),
        ] as const,
    )
    .filter(([, elementer]) => elementer.length > 0)
    .map(([k, elementer]) => formaterFunn(KRITERIER[k], elementer))
    .join('\n');
}

/**
 * WCAG 2.1.1, 2.1.2, 2.4.7 og 3.2.1. Tabber gjennom siden én gang og legger
 * ved fokusrekkefølgen, som også er nyttig ved manuell vurdering av 2.4.3.
 */
export async function sjekkTastatur(
  page: Page,
  valg: Tastaturvalg = {},
  testInfo?: TestInfo,
): Promise<Tastaturresultat> {
  const resultat = await analyserTastatur(page, valg);
  if (testInfo) {
    await testInfo.attach('fokusrekkefølge.txt', {
      body: resultat.fokusrekkefølge.map((e, i) => `${i + 1}. ${e}`).join('\n'),
      contentType: 'text/plain',
    });
  }
  expect(
    resultat.funn.map((f) => `${f.kriterium} ${f.element}`),
    formaterTastaturfunn(resultat.funn),
  ).toEqual([]);
  return resultat;
}
