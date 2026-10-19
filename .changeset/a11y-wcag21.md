---
'@navikt/toi-next-frontend': minor
---

Legg til `/a11y` med felles axe-oppsett for WCAG 2.1 A/AA i Playwright: `tilgjengelighetstest` (tagget `@a11y`), `sjekkTilgjengelighet`, `analyserTilgjengelighet`, `sjekkReflow` og `formaterBrudd`. Elementer med `data-axe-ignore` ekskluderes. `@axe-core/playwright` og `@playwright/test` er valgfrie peer dependencies.
