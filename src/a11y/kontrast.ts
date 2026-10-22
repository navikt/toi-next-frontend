import {
  installerSidehjelpere,
  type Pekepinn,
  type SideVindu,
} from './felles.js';
import type { Page } from '@playwright/test';

/** WCAG 1.4.11: grensesnittkomponenter og grafikk skal ha minst 3:1 mot omgivelsene. */
export const KONTRAST_IKKE_TEKST_KRAV = 3;

export type Kontrastvalg = {
  /** Selektorer som ikke analyseres, i tillegg til `data-axe-ignore`. */
  ekskluder?: string[];
  /** Maks antall elementer som fokuseres for å måle fokusringen. Standard: 100. */
  maksFokus?: number;
};

type Kontrastfunn = { element: string; melding: string };

/**
 * Kjøres i siden. Måler kanter på skjemafelt, ikoner som bærer mening og
 * fokusringen til elementer som kan få fokus, mot bakgrunnen rundt dem.
 * Bakgrunnen regnes ut ved å legge sammen bakgrunnsfargene oppover i treet.
 * Elementer med bakgrunnsbilde eller gradient bak seg hoppes over.
 */
function målKontrastIkkeTekst({
  krav,
  ekskluder,
  maksFokus,
}: {
  krav: number;
  ekskluder: string[];
  maksFokus: number;
}): Kontrastfunn[] {
  const hjelp = (window as SideVindu).__toiA11y!;
  type Rgba = [number, number, number, number];

  const lerret = document.createElement('canvas');
  lerret.width = lerret.height = 1;
  const tegning = lerret.getContext('2d', { willReadFrequently: true })!;
  // Nettleseren gjør om alle fargeformater (oklch, color-mix, var()) til sRGB for oss.
  const tilRgba = (farge: string): Rgba | null => {
    if (!farge || farge === 'none' || farge.startsWith('url(')) return null;
    tegning.clearRect(0, 0, 1, 1);
    tegning.fillStyle = '#000';
    tegning.fillStyle = farge;
    tegning.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = tegning.getImageData(0, 0, 1, 1).data;
    return [r, g, b, a / 255];
  };
  const leggOver = (topp: Rgba, bunn: Rgba): Rgba => {
    const a = topp[3] + bunn[3] * (1 - topp[3]);
    if (a === 0) return [0, 0, 0, 0];
    const kanal = (i: number) =>
      (topp[i] * topp[3] + bunn[i] * bunn[3] * (1 - topp[3])) / a;
    return [kanal(0), kanal(1), kanal(2), a];
  };
  const luminans = ([r, g, b]: Rgba) => {
    const lin = (c: number) => {
      const s = c / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  };
  const kontrast = (forgrunn: Rgba, bakgrunn: Rgba) => {
    const f = luminans(leggOver(forgrunn, bakgrunn));
    const b = luminans(bakgrunn);
    return (Math.max(f, b) + 0.05) / (Math.min(f, b) + 0.05);
  };

  /** Bakgrunnen bak `element`, eller null hvis den ikke kan regnes ut. */
  const bakgrunnBak = (element: Element | null): Rgba | null => {
    const lag: Rgba[] = [];
    for (let e = element; e; e = e.parentElement) {
      const stil = getComputedStyle(e);
      if (stil.backgroundImage !== 'none') return null;
      const farge = tilRgba(stil.backgroundColor);
      if (farge && farge[3] > 0) {
        lag.push(farge);
        if (farge[3] >= 1) break;
      }
    }
    return lag.reduceRight<Rgba>(
      (bunn, topp) => leggOver(topp, bunn),
      [255, 255, 255, 1],
    );
  };

  /** Farger på skygger som tegner en heltrukken ring (spredning, ingen uskarphet). */
  const skyggeringer = (boxShadow: string) => {
    if (!boxShadow || boxShadow === 'none') return [];
    return boxShadow
      .split(/,(?![^(]*\))/)
      .map((skygge) => {
        const farge = skygge.match(
          /(?:rgba?|color|oklch|oklab|lab|lch|hsla?)\([^)]*\)|#[0-9a-f]{3,8}\b/i,
        )?.[0];
        const lengder = (
          skygge.replace(farge ?? '', '').match(/-?[\d.]+px/g) ?? []
        ).map(parseFloat);
        const [, , uskarphet = 0, spredning = 0] = lengder;
        return {
          farge: farge ? tilRgba(farge) : null,
          innfelt: /\binset\b/.test(skygge),
          ring: spredning >= 1 && uskarphet <= spredning,
        };
      })
      .filter((s) => s.ring && s.farge && s.farge[3] > 0);
  };

  const erSynlig = (element: Element) => {
    const boks = element.getBoundingClientRect();
    if (boks.width < 4 || boks.height < 4) return false;
    return element.checkVisibility({
      opacityProperty: true,
      visibilityProperty: true,
    });
  };
  const hoppOver = (element: Element) =>
    hjelp.erIgnorert(element) ||
    ekskluder.some((s) => element.closest(s)) ||
    element.closest('[inert],[disabled],[aria-disabled="true"]') !== null ||
    !erSynlig(element);
  const avrund = (tall: number) => tall.toFixed(2).replace(/\.?0+$/, '');
  const funn: Kontrastfunn[] = [];

  // Kanten på skjemafelt: kant, egen bakgrunn eller ring skal skille feltet fra omgivelsene.
  const felt = document.querySelectorAll(
    'input:not([type=hidden],[type=submit],[type=button],[type=reset],[type=image],[type=range],[type=color],[type=file]),select,textarea,[role=textbox],[role=combobox],[role=checkbox],[role=radio],[role=switch]',
  );
  const avgrensning = (element: Element) => {
    const stil = getComputedStyle(element);
    const utenfor = bakgrunnBak(element.parentElement);
    if (!utenfor) return null;
    let best = 1;
    for (const side of ['top', 'right', 'bottom', 'left']) {
      const bredde = parseFloat(stil.getPropertyValue(`border-${side}-width`));
      const strek = stil.getPropertyValue(`border-${side}-style`);
      const farge = tilRgba(stil.getPropertyValue(`border-${side}-color`));
      if (bredde >= 1 && strek !== 'none' && strek !== 'hidden' && farge) {
        best = Math.max(best, kontrast(farge, utenfor));
      }
    }
    const egen = tilRgba(stil.backgroundColor);
    if (egen && egen[3] > 0) best = Math.max(best, kontrast(egen, utenfor));
    for (const ring of skyggeringer(stil.boxShadow)) {
      best = Math.max(best, kontrast(ring.farge!, utenfor));
    }
    return best;
  };
  for (const element of felt) {
    if (hoppOver(element)) continue;
    // Komponentbiblioteker (f.eks. Aksel Combobox) tegner ofte kanten på en
    // omslutter rundt feltet. Omslutteren regnes med når den er omtrent like høy.
    const høyde = element.getBoundingClientRect().height;
    const kandidater: Element[] = [element];
    for (
      let e = element.parentElement;
      e && e !== document.body && kandidater.length < 4;
      e = e.parentElement
    ) {
      if (e.getBoundingClientRect().height > høyde * 1.5 + 16) break;
      kandidater.push(e);
    }
    const målinger = kandidater
      .map(avgrensning)
      .filter((m): m is number => m !== null);
    if (målinger.length === 0) continue;
    const best = Math.max(...målinger);
    if (best < krav) {
      funn.push({
        element: hjelp.beskriv(element),
        melding: `kanten skiller feltet fra bakgrunnen med bare ${avrund(best)}:1`,
      });
    }
  }

  // Ikoner som bærer mening: ikoner i knapper og lenker uten tekst, og svg med role="img" eller navn.
  for (const svg of document.querySelectorAll('svg')) {
    if (svg.parentElement?.closest('svg') || hoppOver(svg)) continue;
    const kontroll = svg.closest('button,a[href],[role=button],[role=link]');
    const ikonknapp =
      kontroll &&
      !(
        kontroll instanceof HTMLElement
          ? kontroll.innerText
          : kontroll.textContent
      )?.trim();
    const harNavn =
      svg.getAttribute('role') === 'img' ||
      svg.hasAttribute('aria-label') ||
      svg.hasAttribute('aria-labelledby') ||
      svg.querySelector(':scope > title') !== null;
    if (
      !ikonknapp &&
      (!harNavn || svg.getAttribute('aria-hidden') === 'true')
    ) {
      continue;
    }
    const bak = bakgrunnBak(svg.parentElement);
    if (!bak) continue;
    let best = 0;
    for (const form of [
      svg,
      ...svg.querySelectorAll(
        'path,circle,rect,ellipse,polygon,polyline,line,text,use',
      ),
    ]) {
      const s = getComputedStyle(form);
      if (
        form !== svg &&
        (s.display === 'none' ||
          form.closest('defs,clipPath,mask,symbol,pattern,marker'))
      ) {
        continue;
      }
      const fyll = tilRgba(s.fill);
      if (fyll && fyll[3] > 0 && form !== svg)
        best = Math.max(best, kontrast(fyll, bak));
      const strek = tilRgba(s.stroke);
      if (strek && strek[3] > 0 && parseFloat(s.strokeWidth) > 0) {
        best = Math.max(best, kontrast(strek, bak));
      }
    }
    if (best > 0 && best < krav) {
      funn.push({
        element: hjelp.beskriv(kontroll && ikonknapp ? kontroll : svg),
        melding: `ikonet har bare ${avrund(best)}:1 mot bakgrunnen`,
      });
    }
  }

  // Fokusringen: kontrast mellom outline eller ring-skygge og bakgrunnen den tegnes mot.
  const forrigeFokus = document.activeElement;
  const rulling = [window.scrollX, window.scrollY];
  const fokuserbare = [
    ...document.querySelectorAll<HTMLElement>(
      'a[href],button,input:not([type=hidden]),select,textarea,summary,[tabindex]:not([tabindex="-1"]),[contenteditable=""],[contenteditable="true"]',
    ),
  ]
    .filter((e) => !hoppOver(e))
    .slice(0, maksFokus);
  for (const element of fokuserbare) {
    element.focus({ preventScroll: true, focusVisible: true } as FocusOptions);
    if (document.activeElement !== element) continue;
    let stil = getComputedStyle(element);
    // Fokusringer har ofte en overgang. Spol den til slutt før fargen leses.
    stil.outlineColor;
    for (const animasjon of element.getAnimations()) {
      if (animasjon.effect?.getComputedTiming().endTime !== Infinity)
        animasjon.finish();
    }
    stil = getComputedStyle(element);
    const utenfor = bakgrunnBak(element.parentElement);
    const innenfor = bakgrunnBak(element);
    const målinger: number[] = [];
    // `outline: auto` er nettleserens standard fokusring. Chromium tegner den i to
    // farger (mørk ytterkant og lys innerkant), så den synes på alle bakgrunner.
    // Fargen i outlineColor varierer med plattform og sier ikke noe om kontrasten.
    if (stil.outlineStyle === 'auto') continue;
    if (stil.outlineStyle !== 'none' && parseFloat(stil.outlineWidth) > 0) {
      const farge = tilRgba(stil.outlineColor);
      const bak = parseFloat(stil.outlineOffset) < 0 ? innenfor : utenfor;
      if (farge && farge[3] > 0 && bak) målinger.push(kontrast(farge, bak));
    }
    for (const ring of skyggeringer(stil.boxShadow)) {
      const bak = ring.innfelt ? innenfor : utenfor;
      if (bak) målinger.push(kontrast(ring.farge!, bak));
    }
    if (målinger.length === 0) continue;
    const best = Math.max(...målinger);
    if (best < krav) {
      funn.push({
        element: hjelp.beskriv(element),
        melding: `fokusringen har bare ${avrund(best)}:1 mot bakgrunnen`,
      });
    }
  }
  if (forrigeFokus instanceof HTMLElement && forrigeFokus !== document.body) {
    forrigeFokus.focus({ preventScroll: true });
  } else if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
  window.scrollTo(rulling[0], rulling[1]);

  return funn;
}

/**
 * WCAG 1.4.11 Kontrast for ikke-tekst: kanter på skjemafelt, ikoner og fokusringer
 * med mindre enn 3:1 mot bakgrunnen. Gir pekepinner: fargen måles mot bakgrunnen
 * rundt elementet og ikke mot hver piksel ved siden av.
 */
export async function analyserKontrastIkkeTekst(
  page: Page,
  valg: Kontrastvalg = {},
): Promise<Pekepinn[]> {
  await installerSidehjelpere(page);
  const funn = await page.evaluate(målKontrastIkkeTekst, {
    krav: KONTRAST_IKKE_TEKST_KRAV,
    ekskluder: valg.ekskluder ?? [],
    maksFokus: valg.maksFokus ?? 100,
  });
  return funn.map((f) => ({
    kriterium: '1.4.11',
    sjekk: 'kontrast-ikke-tekst',
    element: f.element,
    melding: `${f.melding} (krav ${KONTRAST_IKKE_TEKST_KRAV}:1)`,
  }));
}
