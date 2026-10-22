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

| Import                              | Innhold                                                                                                                                                      |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@navikt/toi-next-frontend/api`     | `createFetcher` (retry, timeout, feil-/valideringsfabrikker), `ApiError`, `hentEsKilder`, `hentEsFørsteKilde`                                                |
| `@navikt/toi-next-frontend/next`    | `opprettOboProxy`, `startMswInstrumentering`                                                                                                                 |
| `@navikt/toi-next-frontend/swr`     | `SWRLaster`, `useSWRGet`, `useSWRPost`, `useSWRPut`                                                                                                          |
| `@navikt/toi-next-frontend/miljo`   | `erLokalt`, `erTestmodus`, `skalMocke`                                                                                                                       |
| `@navikt/toi-next-frontend/analyse` | `lagUmami`, `byggSporingsdata`                                                                                                                               |
| `@navikt/toi-next-frontend/apm`     | `lagApmFeilrapportering`, `filtrerApmHendelse`, `DEKORATØR_URLER` (Nais APM uten avhengighet til `@nais/apm`)                                                |
| `@navikt/toi-next-frontend/a11y`    | `tilgjengelighetstest`, `sjekkTilgjengelighet`, `sjekkDialog`, `sjekkPekerfølsomtInnhold`, `sjekkSkjemafeil`, `sjekkPekepinner` (WCAG 2.1 A/AA i Playwright) |
| `@navikt/toi-next-frontend/eslint`  | `anbefalt` (flat config) med regelen `toi-a11y/ingen-handling-ved-pekerned` (WCAG 2.5.2)                                                                     |

`react`, `swr` og `zod` er peer dependencies. `@playwright/test` og `@axe-core/playwright` er valgfrie peer dependencies og trengs bare for `/a11y`. `eslint` (9 eller nyere) er valgfri og trengs bare for `/eslint`.

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

| Valg                  | WCAG                       | Hva sjekkes                                                                                                              |
| --------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `reflow`              | 1.4.10                     | Ingen horisontal rulling ved 320 px bredde                                                                               |
| `tekstforstørrelse`   | 1.4.4                      | Rot-skriftstørrelsen dobles (som når brukeren øker skriftstørrelsen i nettleseren). Tekst som blir avkuttet, rapporteres |
| `tekstavstand`        | 1.4.12                     | Linje-, avsnitts-, bokstav- og ordavstand økes etter WCAG. Tekst som blir avkuttet, rapporteres                          |
| `visningsretning`     | 1.3.4                      | Hovedinnholdet er synlig og ikke rotert i stående og liggende visning                                                    |
| `tastatur`            | 2.1.1, 2.1.2, 2.4.7, 3.2.1 | Klikkbare elementer som ikke kan nås med Tab, tastaturfeller, manglende synlig fokus og kontekstendring ved fokus        |
| `hoppTilHovedinnhold` | 2.4.1                      | Første Tab går til «Hopp til hovedinnhold», målet finnes, og neste Tab etter Enter går til hovedinnholdet eller videre   |
| `mørkModus`           | 1.4.3                      | Funksjon som slår på mørk modus. axe kjøres da på nytt                                                                   |
| `pekepinner`          | 1.4.11, 2.2.2, 3.1.2       | Gir pekepinner uten å feile testen. Se [Pekepinner](#pekepinner)                                                         |

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

### Pekepinner

Noen kriterier kan ikke måles sikkert nok til å stoppe deploy før vi har sett hvor mye støy de gir i appene våre. Disse sjekkene gir pekepinner: funnene vises i Playwright-rapporten, men testen feiler aldri.

```ts
tilgjengelighetstest(test, { utvidet: true }); // pekepinner er på når utvidet er på
tilgjengelighetstest(test, { pekepinner: true }); // eller slå dem på for seg
tilgjengelighetstest(test, { utvidet: true, pekepinner: { språk: false } });
```

De kjøres i en egen test, «Tilgjengelighet – pekepinner», tagget `@a11y`, `@a11y-utvidet` og `@a11y-pekepinn`. Den blir dermed med i `test:a11y`, men ikke i jobben som stopper deploy (`--grep-invert @a11y-utvidet`). Hvert funn legges til som annotation av typen `a11y-pekepinn` (maks 30 per test), og alle funn legges ved som `a11y-pekepinner.json`. En sjekk som krasjer, gir en annotation av typen `a11y-pekepinn-feil` i stedet for å stoppe de andre.

| Valg                | WCAG   | Hva sjekkes                                                                                                                                                           |
| ------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kontrastIkkeTekst` | 1.4.11 | Kanten på skjemafelt, ikoner i knapper og lenker uten tekst (og svg med navn) og fokusringen (outline eller ring med `box-shadow`) har minst 3:1 mot bakgrunnen rundt |
| `bevegelse`         | 2.2.2  | Animasjoner fra `document.getAnimations()` som går i det uendelige eller varer lenger enn 5 sekunder. Sier også om de stopper med `prefers-reduced-motion: reduce`    |
| `språk`             | 3.1.2  | Tekstblokker som ser ut til å være på et annet språk enn `lang` sier, for eksempel engelsk tekst i en stillingsannonse uten `lang="en"`                               |
| `landemerker`       | 1.3.1  | Axe-reglene `landmark-no-duplicate-main` og `landmark-main-is-top-level`. De er `best-practice` i axe og ikke med i WCAG-kjøringen                                    |

Alle er på som standard når pekepinnene kjøres. `false` slår av en sjekk. `ekskluder` fra hovedvalgene gjelder også her.

- **Kontrast** regnes ut mot bakgrunnsfargen bak elementet (fargene oppover i treet lagt sammen), ikke mot hver piksel ved siden av. Elementer med bakgrunnsbilde eller gradient bak seg hoppes over. Kanten kan ligge på en omslutter som er omtrent like høy som feltet, slik Aksel Combobox gjør. Fokusringen måles på opptil 100 elementer, og fokus settes tilbake etterpå. Nettleserens standard fokusring (`outline: auto`) måles ikke, siden Chromium tegner den i to farger som synes på alle bakgrunner. Mangler fokusringen helt, er det `tastatur` (2.4.7) som fanger det.
- **Bevegelse**: lasteindikatorer (Aksel `Loader`, `role="progressbar"`, `aria-busy`, klasser med `loader`, `spinner` eller `skeleton`) som stopper med `prefers-reduced-motion: reduce`, rapporteres ikke. De forsvinner når innholdet er lastet, og brukere som har bedt om redusert bevegelse, slipper dem. Lasteindikatorer som ikke stopper, eller når `redusertBevegelse: false`, rapporteres og merkes «trolig lasteindikator». Sjekken ser ikke om siden har en knapp for å stoppe animasjonen. Den kjøres før de andre sjekkene, siden axe spoler endelige animasjoner til slutt.
- **Språk** gjettes ut fra vanlige småord på norsk (bokmål og nynorsk regnes som ett språk), svensk og engelsk. Blokker med under 8 ord vurderes ikke, og et språk må ha minst 3 treff og dobbelt så mange som det nest beste. Vi valgte dette framfor et bibliotek som `franc` fordi det ikke gir nye avhengigheter, kjører i nettleseren, og fordi slike biblioteker skiller dårlig mellom norsk, dansk og svensk i korte tekster. Det vi trenger å finne, er tekst på et helt annet språk enn siden.

Hver sjekk finnes også som egen funksjon som returnerer funn: `analyserKontrastIkkeTekst`, `analyserBevegelse`, `analyserSpråk` og `analyserLandemerker`. `sjekkPekepinner(page, valg?)` kjører alle og rapporterer til testen som kjører, for eksempel etter at en modal er åpnet.

### ESLint: pekeravbrytelse (`/eslint`)

WCAG 2.5.2 handler om at handlinger skal skje når pekeren slippes, slik at brukeren kan angre ved å flytte pekeren bort først. Det ser vi best i koden. Regelen `toi-a11y/ingen-handling-ved-pekerned` varsler om `onMouseDown` og `onPointerDown` i JSX og `addEventListener('mousedown' | 'pointerdown')`:

```js
// eslint.config.mjs
import { anbefalt as toiA11y } from '@navikt/toi-next-frontend/eslint';

export default defineConfig([...nextConfig, ...nextTypescript, toiA11y]);
```

`anbefalt` slår på regelen som `warn`, så den stopper ikke bygget. Regelen godtar handlere som bare kaller `preventDefault()`, `stopPropagation()` eller `stopImmediatePropagation()` (vanlig for å hindre at fokus flyttes eller at klikket når en forelder), også når de ellers bare leser fra DOM-en og setter `ref.current`. Navngitte handlere slås opp i samme fil, for eksempel `const stopAllPropagation = (e) => e.stopPropagation()`. Importerte handlere godtas når navnet tydelig sier det samme (`stopPropagation`, `stopAllPropagation`, `preventDefault` o.l.). Regelen godtar også elementer som også lytter på opp- eller flytt-hendelser (dra og slipp). Andre unntak markeres med `// eslint-disable-next-line toi-a11y/ingen-handling-ved-pekerned -- begrunnelse`. Med valget `hendelser` kan flere hendelser tas med, for eksempel `['onMouseDown', 'onPointerDown', 'onTouchStart']`.

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
