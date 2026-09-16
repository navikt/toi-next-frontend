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

| Import | Innhold |
| --- | --- |
| `@navikt/toi-next-frontend/api` | `createFetcher`, `ApiError` og Zod-validering |
| `@navikt/toi-next-frontend/next` | `opprettOboProxy` |
| `@navikt/toi-next-frontend/swr` | `SWRLaster` |

`react`, `swr` og `zod` er peer dependencies.

## Publisering

Legg til en changeset i hver PR som skal gi en ny pakkeversjon:

```bash
pnpm changeset
```

Velg `patch`, `minor` eller `major` og beskriv endringen. Når PR-en merges til `main`, oppretter eller oppdaterer workflowen `Versjoner og publiser npm-pakke` en versjons-PR. Når versjons-PR-en merges, kjører workflowen typecheck og tester før den publiserer til GitHub Packages.

Repository settings må tillate at GitHub Actions oppretter pull requests.

## 🤖 KI-assistanse

Dette repoet bruker GitHub Copilot for kodegenerering og forslag.
