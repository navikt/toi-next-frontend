import type { Page } from '@playwright/test';

export type Sidehjelpere = {
  erIgnorert(element: Element | null): boolean;
  beskriv(element: Element): string;
};

export type SideVindu = Window & {
  __toiA11y?: Sidehjelpere;
  __toiAvkuttet?: WeakMap<Element, Set<string>>;
  __toiFokus?: {
    ider: WeakMap<Element, number>;
    elementer: WeakRef<Element>[];
    neste: number;
  };
};

/**
 * Installerer hjelpefunksjoner i siden. Funksjoner som sendes til
 * `page.evaluate` serialiseres og kan ikke bruke variabler fra denne modulen.
 */
export async function installerSidehjelpere(page: Page): Promise<void> {
  await page.evaluate(() => {
    const vindu = window as SideVindu;
    if (vindu.__toiA11y) return;

    const erIgnorert = (element: Element | null) => {
      let node: Node | null = element;
      while (node) {
        if (node instanceof Element && node.hasAttribute('data-axe-ignore')) {
          return true;
        }
        node =
          node.parentNode ?? (node instanceof ShadowRoot ? node.host : null);
      }
      return false;
    };

    const beskriv = (element: Element) => {
      const navn = (
        element.getAttribute('aria-label') ??
        (element instanceof HTMLElement
          ? element.innerText
          : element.textContent) ??
        element.getAttribute('title') ??
        ''
      )
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 50);
      const id = element.id ? `#${CSS.escape(element.id)}` : '';
      const klasser =
        typeof element.className === 'string'
          ? element.className
              .trim()
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((k) => `.${CSS.escape(k)}`)
              .join('')
          : '';
      return `${element.tagName.toLowerCase()}${id}${klasser}${navn ? ` «${navn}»` : ''}`;
    };

    vindu.__toiA11y = { erIgnorert, beskriv };
  });
}

/** Gir ResizeObserver, React og CSS tid til å tilpasse seg en endring. */
export async function ventPåOmlayout(page: Page, ms = 250): Promise<void> {
  await page.evaluate(
    (venteMs) =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() => setTimeout(resolve, venteMs)),
        ),
      ),
    ms,
  );
}

export function formaterFunn(
  overskrift: string,
  elementer: string[],
  maks = 10,
): string {
  if (elementer.length === 0) return `${overskrift}: ingen funn`;
  const liste = elementer
    .slice(0, maks)
    .map((e) => `  - ${e}`)
    .join('\n');
  const flere =
    elementer.length > maks ? `\n  … og ${elementer.length - maks} til` : '';
  return `${overskrift} (${elementer.length}):\n${liste}${flere}`;
}
