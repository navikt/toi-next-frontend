# @navikt/toi-next-frontend

Felles frontend-infrastruktur for Team Toi.

## Installasjon

```bash
pnpm add @navikt/toi-next-frontend
```

Prosjekter uten en eksisterende `@navikt`-registry-konfigurasjon trenger følgende i `.npmrc`:

```text
@navikt:registry=https://npm.pkg.github.com
```

## Eksporter

| Import                              | Innhold                                                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `@navikt/toi-next-frontend/api`     | `createFetcher` (retry, timeout, feil-/valideringsfabrikker), `ApiError`, `hentEsKilder`, `hentEsFørsteKilde` |
| `@navikt/toi-next-frontend/next`    | `opprettOboProxy`, `startMswInstrumentering`                                                                  |
| `@navikt/toi-next-frontend/swr`     | `SWRLaster`, `useSWRGet`, `useSWRPost`, `useSWRPut`                                                           |
| `@navikt/toi-next-frontend/miljo`   | `erLokalt`, `erTestmodus`, `skalMocke`                                                                        |
| `@navikt/toi-next-frontend/analyse` | `lagUmami`, `byggSporingsdata`                                                                                |
| `@navikt/toi-next-frontend/apm`     | `lagApmFeilrapportering`, `filtrerApmHendelse` (Nais APM uten avhengighet til `@nais/apm`)                    |
| `@navikt/toi-next-frontend/a11y`    | `tilgjengelighetstest`, `sjekkTilgjengelighet`, `sjekkReflow` (axe-oppsett for WCAG 2.1 A/AA i Playwright)    |

`react`, `swr` og `zod` er peer dependencies. `@playwright/test` og `@axe-core/playwright` er valgfrie peer dependencies og trengs bare for `/a11y`.

## Tilgjengelighetstester (`/a11y`)

Alle Toi-frontender skal oppfylle WCAG 2.1 nivå A og AA. `/a11y` gir et felles oppsett for axe-core i Playwright (samme verktøy som Aksel bruker), slik at reglene og rapporteringen er like i alle apper.

```bash
pnpm add -D @axe-core/playwright
```

Legg `tilgjengelighetstest(test)` i hver `describe` som åpner en side i `beforeEach`, på samme måte som `snapshotTest(test)`:

```ts
import { tilgjengelighetstest } from '@navikt/toi-next-frontend/a11y';

test.describe('Forside', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page, '/');
  });

  tilgjengelighetstest(test, { reflow: true });
});
```

Bruk `sjekkTilgjengelighet(page)` midt i en test for å sjekke tilstander som modaler, åpne menyer og valideringsfeil.

| Valg        | Beskrivelse                                                                              |
| ----------- | ---------------------------------------------------------------------------------------- |
| `ekskluder` | CSS-selektorer som ikke analyseres. Elementer med `data-axe-ignore` er alltid ekskludert |
| `inkluder`  | Begrens analysen til bestemte områder                                                    |
| `unntak`    | Axe-regler som slås av, med begrunnelse: `{ 'color-contrast': 'Sak TOI-123' }`           |
| `reflow`    | Sjekk også WCAG 1.4.10 (ingen horisontal rulling ved 320 px bredde)                      |

Innhold som eies av andre team, som dekoratøren, merkes med `data-axe-ignore`. Ikke bruk attributtet for å skjule egne brudd.

Axe kjøres bare i Chromium. Ved funn legges `axe-resultat.json` ved i Playwright-rapporten, også med `incomplete`-funn som må vurderes manuelt.

### Kjøring i CI

Testene tagges med `@a11y`. Med `build-and-deploy-nextjs.yaml` fra `toi-frontend-workflows` kjøres de i en egen jobb som ikke stopper deploy:

```json
"test:a11y": "playwright test --grep @a11y --project='chromium*'"
```

```yaml
playwright-command: 'pnpm run test --grep-invert @a11y'
a11y-command: 'pnpm run test:a11y'
```

Fjern `--grep-invert @a11y` når appen ikke har kjente brudd, slik at nye brudd stopper prod-deploy.

Automatiske verktøy dekker bare en del av WCAG 2.1. Kriterier som tastaturbetjening, fokusrekkefølge, meningsfulle tekstalternativer og forståelige feilmeldinger må også testes med egne Playwright-tester og manuelt.

## Publisering

Legg til en changeset i hver PR som skal gi en ny pakkeversjon:

```bash
pnpm changeset
```

Velg `patch`, `minor` eller `major` og beskriv endringen. Når PR-en merges til `main`, oppretter eller oppdaterer workflowen `Versjoner og publiser npm-pakke` en versjons-PR. Når versjons-PR-en merges, kjører workflowen typecheck og tester før den publiserer til GitHub Packages.

Repository settings må tillate at GitHub Actions oppretter pull requests.

## 🤖 KI-assistanse

Dette repoet bruker GitHub Copilot for kodegenerering og forslag.
