import {
  installerSidehjelpere,
  type Pekepinn,
  type SideVindu,
} from './felles.js';
import type { Page } from '@playwright/test';

/** WCAG 2.2.2: bevegelse som starter automatisk og varer mer enn 5 sekunder, må kunne stoppes. */
export const BEVEGELSE_GRENSE_MS = 5000;

export type Bevegelsesvalg = {
  /** Selektorer som ikke analyseres, i tillegg til `data-axe-ignore`. */
  ekskluder?: string[];
  /**
   * Sjekk også om animasjonene stopper når brukeren har bedt om redusert bevegelse
   * (`prefers-reduced-motion: reduce`). Standard: true.
   */
  redusertBevegelse?: boolean;
};

type Bevegelse = {
  nøkkel: string;
  element: string;
  navn: string;
  uendelig: boolean;
  varighetMs: number;
  lasteindikator: boolean;
};

type BevegelseVindu = SideVindu & {
  __toiBevegelse?: { ider: WeakMap<Element, number>; neste: number };
};

/** Kjøres i siden. Finner animasjoner som spilles nå og varer lenger enn grensen. */
function finnLangeAnimasjoner({
  grense,
  ekskluder,
}: {
  grense: number;
  ekskluder: string[];
}): Bevegelse[] {
  const vindu = window as BevegelseVindu;
  const hjelp = vindu.__toiA11y!;
  const register = (vindu.__toiBevegelse ??= {
    ider: new WeakMap(),
    neste: 0,
  });
  const id = (element: Element) => {
    if (!register.ider.has(element)) {
      register.ider.set(element, register.neste++);
    }
    return register.ider.get(element)!;
  };
  const resultat = new Map<string, Bevegelse>();

  for (const animasjon of document.getAnimations()) {
    if (animasjon.playState !== 'running') continue;
    const effekt = animasjon.effect;
    if (!(effekt instanceof KeyframeEffect) || !effekt.target) continue;
    const timing = effekt.getComputedTiming();
    const varighet = Number(timing.activeDuration);
    const uendelig = !Number.isFinite(varighet);
    if (!uendelig && varighet <= grense) continue;

    const element = effekt.target;
    if (
      hjelp.erIgnorert(element) ||
      ekskluder.some((s) => element.closest(s)) ||
      !element.checkVisibility({
        opacityProperty: true,
        visibilityProperty: true,
      })
    ) {
      continue;
    }
    const navn =
      animasjon instanceof CSSAnimation
        ? animasjon.animationName
        : animasjon instanceof CSSTransition
          ? `overgang av ${animasjon.transitionProperty}`
          : animasjon.id || 'Web Animations API';
    const nøkkel = `${id(element)}${effekt.pseudoElement ?? ''}|${navn}`;
    resultat.set(nøkkel, {
      nøkkel,
      element: `${hjelp.beskriv(element)}${effekt.pseudoElement ?? ''}`,
      navn,
      uendelig,
      varighetMs: uendelig ? Infinity : varighet,
      lasteindikator:
        element.closest(
          '[role=progressbar],[role=status],[aria-busy=true],[class*=loader i],[class*=spinner i],[class*=skeleton i],[class*=laster i]',
        ) !== null,
    });
  }
  return [...resultat.values()];
}

/**
 * WCAG 2.2.2 Pause, stopp, skjul: animasjoner som går i det uendelige eller varer
 * lenger enn 5 sekunder. Gir pekepinner: sjekken ser ikke om siden har en
 * knapp for å stoppe animasjonen. Lasteindikatorer merkes, siden de normalt
 * forsvinner når innholdet er lastet.
 */
export async function analyserBevegelse(
  page: Page,
  valg: Bevegelsesvalg = {},
): Promise<Pekepinn[]> {
  await installerSidehjelpere(page);
  const argumenter = {
    grense: BEVEGELSE_GRENSE_MS,
    ekskluder: valg.ekskluder ?? [],
  };
  const animasjoner = await page.evaluate(finnLangeAnimasjoner, argumenter);

  let fortsetter: Set<string> | undefined;
  const alleredeRedusert = await page.evaluate(
    () => matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  if (
    animasjoner.length > 0 &&
    valg.redusertBevegelse !== false &&
    !alleredeRedusert
  ) {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    try {
      await page.evaluate(
        () =>
          new Promise((r) =>
            requestAnimationFrame(() => requestAnimationFrame(r)),
          ),
      );
      fortsetter = new Set(
        (await page.evaluate(finnLangeAnimasjoner, argumenter)).map(
          (a) => a.nøkkel,
        ),
      );
    } finally {
      await page.emulateMedia({ reducedMotion: null });
    }
  }

  return animasjoner.map((a) => {
    const deler = [
      a.uendelig
        ? `animasjonen «${a.navn}» går i det uendelige`
        : `animasjonen «${a.navn}» varer ${Math.round(a.varighetMs / 100) / 10} s`,
    ];
    if (fortsetter?.has(a.nøkkel)) {
      deler.push('og stopper ikke med prefers-reduced-motion: reduce');
    } else if (fortsetter) {
      deler.push('men stopper med prefers-reduced-motion: reduce');
    }
    if (a.lasteindikator) deler.push('(trolig lasteindikator)');
    return {
      kriterium: '2.2.2',
      sjekk: 'bevegelse',
      element: a.element,
      melding: deler.join(' '),
    };
  });
}
