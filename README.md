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

| Import                              | Innhold                                                                                                                                   |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `@navikt/toi-next-frontend/api`     | `createFetcher` (retry, timeout, feil-/valideringsfabrikker), `ApiError`, `hentEsKilder`, `hentEsFørsteKilde`                             |
| `@navikt/toi-next-frontend/next`    | `opprettOboProxy`, `startMswInstrumentering`                                                                                              |
| `@navikt/toi-next-frontend/swr`     | `SWRLaster`, `useSWRGet`, `useSWRPost`, `useSWRPut`                                                                                       |
| `@navikt/toi-next-frontend/miljo`   | `erLokalt`, `erTestmodus`, `skalMocke`                                                                                                    |
| `@navikt/toi-next-frontend/analyse` | `lagUmami`, `byggSporingsdata`                                                                                                            |
| `@navikt/toi-next-frontend/apm`     | `lagApmFeilrapportering`, `filtrerApmHendelse` (Nais APM uten avhengighet til `@nais/apm`)                                                |
| `@navikt/toi-next-frontend/a11y`    | `tilgjengelighetstest`, `sjekkTilgjengelighet`, `sjekkDialog`, `sjekkPekerfølsomtInnhold`, `sjekkSkjemafeil` (WCAG 2.1 A/AA i Playwright) |

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

### Utvidede sjekker

axe dekker bare det som kan leses ut av DOM-en. `utvidet: true` slår på sjekker som bruker nettleseren, i tillegg til axe:

```ts
tilgjengelighetstest(test, { utvidet: true });
```

| Valg                | WCAG                       | Hva sjekkes                                                                                                              |
| ------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `reflow`            | 1.4.10                     | Ingen horisontal rulling ved 320 px bredde                                                                               |
| `tekstforstørrelse` | 1.4.4                      | Rot-skriftstørrelsen dobles (som når brukeren øker skriftstørrelsen i nettleseren). Tekst som blir avkuttet, rapporteres |
| `tekstavstand`      | 1.4.12                     | Linje-, avsnitts-, bokstav- og ordavstand økes etter WCAG. Tekst som blir avkuttet, rapporteres                          |
| `visningsretning`   | 1.3.4                      | Hovedinnholdet er synlig og ikke rotert i stående og liggende visning                                                    |
| `tastatur`          | 2.1.1, 2.1.2, 2.4.7, 3.2.1 | Klikkbare elementer som ikke kan nås med Tab, tastaturfeller, manglende synlig fokus og kontekstendring ved fokus        |
| `mørkModus`         | 1.4.3                      | Funksjon som slår på mørk modus. axe kjøres da på nytt                                                                   |

Sjekkene som bare er slått på via `utvidet`, kjøres i en egen test, «Tilgjengelighet – utvidede sjekker», tagget både `@a11y` og `@a11y-utvidet`. Dermed kan axe stoppe deploy mens de utvidede funnene rettes:

```yaml
playwright-command: 'pnpm run test --grep-invert @a11y-utvidet'
a11y-command: 'pnpm run test:a11y-utvidet' # playwright test --grep @a11y-utvidet --project='chromium*'
```

Sjekker som settes eksplisitt, for eksempel `{ utvidet: true, reflow: true }`, kjøres i hovedtesten sammen med axe. `false` slår en sjekk av, for eksempel `{ utvidet: true, reflow: false }` i en app som ennå ikke tåler 320 px. Feilene fra alle sjekkene i en test samles i én melding, og hver sjekk vises som eget steg i Playwright-rapporten. Testen får tredoblet tidsgrense (`test.slow()`) når den kjører mer enn to sjekker.

- **Avkuttet tekst** betyr tekst som havner utenfor et element med `overflow: hidden/clip`. Bare tekst som blir avkuttet på grunn av endringen, rapporteres. Tekst i `px` skaleres ikke av tekstforstørrelsen.
- **Synlig fokus** sammenlignes med skjermbilder av elementet med og uten tastaturfokus. Fokusmarkering på en forelder (`:focus-within`) godtas.
- **Fokusrekkefølgen** legges ved som `fokusrekkefølge.txt`. Den er nyttig når 2.4.3 vurderes manuelt.
- Sjekkene ser bare det som er lastet. Vent på innholdet i `beforeEach` før testen kjører.
- Hver sjekk finnes også som egen funksjon, for eksempel `sjekkTastatur(page)` og `analyserTekstforstørrelse(page)`, som returnerer funn i stedet for å feile.

Kjører flere apper Playwright samtidig på samme maskin, må hver bruke sin egen `PLAYWRIGHT_PORT`. Ellers kan en test gjenbruke en annen apps dev-server.

Innhold som eies av andre team, som dekoratøren, merkes med `data-axe-ignore`. Ikke bruk attributtet for å skjule egne brudd.

Axe kjøres bare i Chromium. Ved funn legges `axe-resultat.json` ved i Playwright-rapporten, også med `incomplete`-funn som må vurderes manuelt.

### Sjekker for interaksjoner

Disse sjekkene utfører en handling på siden og tester resultatet. Kall dem i en vanlig test, gjerne tagget `@a11y`:

```ts
import {
  sjekkDialog,
  sjekkPekerfølsomtInnhold,
  sjekkSkjemafeil,
} from '@navikt/toi-next-frontend/a11y';

test('slettemodalen', { tag: '@a11y' }, async ({ page }) => {
  await sjekkDialog(page, page.getByRole('button', { name: 'Slett' }));
});
```

| Funksjon                                         | WCAG                       | Hva sjekkes                                                                                                                                                                             |
| ------------------------------------------------ | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sjekkDialog(page, utløser, valg?)`              | 2.1.1, 2.1.2, 2.4.3, 4.1.2 | Åpner dialogen med Enter, sjekker at den har navn, at fokus flyttes inn og blir i modale dialoger, kjører axe på dialogen, lukker med Esc og sjekker at fokus går tilbake til utløseren |
| `sjekkPekerfølsomtInnhold(page, utløser, valg?)` | 1.4.13                     | Viser innholdet med hover og fokus. Sjekker at pekeren kan flyttes over innholdet uten at det forsvinner, at det blir værende, og at Esc lukker det uten å flytte fokus                 |
| `sjekkSkjemafeil(page, sendKnapp, valg?)`        | 3.3.1                      | Sender inn skjemaet og sjekker at felt med feil har `aria-invalid`, at feilmeldingen er koblet til med `aria-describedby`, og at lenkene i feiloppsummeringen peker på felt som finnes  |

- `sjekkDialog` tar valget `åpneMed: 'klikk'` for utløsere som ikke åpnes med Enter, `lukkMedEsc: false` for dialoger som med vilje ikke lukkes med Esc, og `fokusEtterLukking` når fokus skal et annet sted enn til utløseren. Den tar også de samme axe-valgene som `sjekkTilgjengelighet`.
- `sjekkPekerfølsomtInnhold` finner innholdet via `aria-describedby` på utløseren eller som siste synlige `role="tooltip"`. Angi `innhold` ellers.
- `sjekkSkjemafeil` tar valget `forventFokus: true` for å kreve at fokus flyttes til feiloppsummeringen eller første felt med feil, slik Aksel anbefaler.
- Alle tre finnes også som `analyser…`-funksjoner som returnerer funn i stedet for å feile.

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

Automatiske verktøy dekker bare en del av WCAG 2.1. Kriterier som logisk fokusrekkefølge, meningsfulle tekstalternativer og forståelige feilmeldinger må også testes med egne Playwright-tester og manuelt.

## Publisering

Legg til en changeset i hver PR som skal gi en ny pakkeversjon:

```bash
pnpm changeset
```

Velg `patch`, `minor` eller `major` og beskriv endringen. Når PR-en merges til `main`, oppretter eller oppdaterer workflowen `Versjoner og publiser npm-pakke` en versjons-PR. Når versjons-PR-en merges, kjører workflowen typecheck og tester før den publiserer til GitHub Packages.

Repository settings må tillate at GitHub Actions oppretter pull requests.

## 🤖 KI-assistanse

Dette repoet bruker GitHub Copilot for kodegenerering og forslag.
