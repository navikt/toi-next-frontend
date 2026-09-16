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

Oppdater `version` i `package.json` og merge endringen til `main`. Kjør deretter workflowen `Publiser npm-pakke` manuelt fra GitHub Actions. Workflowen kjører typecheck og tester før publisering til GitHub Packages, og publisering feiler dersom versjonen allerede finnes.