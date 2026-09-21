# @navikt/toi-next-frontend

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
