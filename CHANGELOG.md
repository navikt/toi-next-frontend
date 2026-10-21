# @navikt/toi-next-frontend

## 0.10.0

### Minor Changes

- b3e0761: Nye tilgjengelighetssjekker for interaksjoner i `/a11y`: `sjekkDialog` (WCAG 2.1.1, 2.1.2, 2.4.3, 4.1.2), `sjekkPekerfølsomtInnhold` (1.4.13) og `sjekkSkjemafeil` (3.3.1), med tilhørende `analyser…`-funksjoner. axe-oppsettet er flyttet til egen modul uten endringer i API-et.

## 0.9.0

### Minor Changes

- c84704c: Utvidede tilgjengelighetssjekker i `/a11y`: `tilgjengelighetstest(test, { utvidet: true })` kjører i tillegg til axe sjekker for tekstforstørrelse (1.4.4), tekstavstand (1.4.12), visningsretning (1.3.4) og tastatur (2.1.1, 2.1.2, 2.4.7, 3.2.1). Nytt valg `mørkModus` kjører axe på nytt i mørk modus. Sjekkene finnes også som egne funksjoner (`sjekkTastatur`, `sjekkTekstforstørrelse`, `sjekkTekstavstand`, `sjekkVisningsretning` og tilsvarende `analyser*`).
  
  Sjekkene som bare er slått på via `utvidet`, kjøres i en egen test tagget `@a11y-utvidet`, slik at axe kan stoppe deploy mens de utvidede funnene rettes.
  
  Rettet: `sjekkReflow` kunne godkjenne siden før den hadde tilpasset seg 320 px, fordi den godtok den første målingen som besto. Nå venter den til DOM og størrelser er stabile før den måler. Apper med `reflow: true` kan derfor få reflow-funn som tidligere slapp gjennom.

## 0.8.0

### Minor Changes

- 66ede46: Legg til `/a11y` med felles axe-oppsett for WCAG 2.1 A/AA i Playwright: `tilgjengelighetstest` (tagget `@a11y`), `sjekkTilgjengelighet`, `analyserTilgjengelighet`, `sjekkReflow` og `formaterBrudd`. Elementer med `data-axe-ignore` ekskluderes. `@axe-core/playwright` og `@playwright/test` er valgfrie peer dependencies.

## 0.7.0

### Minor Changes

- c8f286f: Legg til `/apm` med `lagApmFeilrapportering` (`rapporterFeil`, `rapporterApiFeil`) og `filtrerApmHendelse` for Nais APM. Pakken avhenger ikke av `@nais/apm`; appen sender inn `captureException`.

## 0.6.0

### Minor Changes

- 486424d: delete() på Fetcher støtter nå en valgfri JSON-body

## 0.5.0

### Minor Changes

- c7b172c: Legg til `mockBaseUrl`-opsjon i `opprettOboProxy`. Når satt rutes alt til `${mockBaseUrl}${pathname}${search}` (original sti), og `apiUrl`-guarden hoppes over. Da slipper konsumenter å overstyre `byggMålUrl` kun for mock-ruting i lokal-/testmodus.

## 0.4.1

### Patch Changes

- 7e71236: Rett `createFetcher` så global `fetch` slås opp ved kalltid i stedet for ved opprettelse. Da respekteres utbytting av global fetch (testmocks og MSW) selv når fetcheren opprettes på modulnivå.

## 0.4.0

### Minor Changes

- fac3205: Legg til `transformerHeaders`-hook i `opprettOboProxy` så konsumenter kan justere videresendte headere (f.eks. filtrere cookies) uten å rekonstruere forespørselen. Dette lar Next.js-apper sende `NextRequest` direkte inn i proxyen.

## 0.3.2

### Patch Changes

- daa820a: Legg til `default`-betingelse i alle export-stiene så pakken også kan brukes fra CommonJS-kontekst (f.eks. Playwright-tester som kompilerer til CJS).

## 0.3.1

### Patch Changes

- b7f3855: Bytt eksport-sti `/miljø` til ASCII `/miljo` for å unngå Unicode-normaliseringsproblemer i editorer og på tvers av operativsystemer.

## 0.3.0

### Minor Changes

- 7877980: Utvid `createFetcher` med retry, timeout, injiserbare feil-/nettverksfeil-fabrikker, `skjulFeilmelding`, schema-validering med logging og Elasticsearch-hjelpere (`hentEsKilder`, `hentEsFørsteKilde`). Legg til `feilSkjulerInnhold` i `SWRLaster` og `byggMålUrl`, `overstyrtBody` og `normaliserRespons` i `opprettOboProxy`.

## 0.2.0

### Minor Changes

- Legg til nye moduler for miljø-helpere (`/miljø`) og Umami-analyse (`/analyse`), samt utvid `Oborute` med scope, audience og internUrlWithoutBaseUrl.

## 0.1.2

### Patch Changes

- cd97d8a: Legg til gjenbrukbar MSW-instrumentering, SWR-hooks og query-parametere i fetcher for Next.js.

## 0.1.1

### Patch Changes

- 402bbb4: Klargjør første publisering av delt frontend-infrastruktur.
