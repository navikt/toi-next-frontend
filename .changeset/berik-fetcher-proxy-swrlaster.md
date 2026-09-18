---
'@navikt/toi-next-frontend': minor
---

Utvid `createFetcher` med retry, timeout, injiserbare feil-/nettverksfeil-fabrikker, `skjulFeilmelding`, schema-validering med logging og Elasticsearch-hjelpere (`hentEsKilder`, `hentEsFørsteKilde`). Legg til `feilSkjulerInnhold` i `SWRLaster` og `byggMålUrl`, `overstyrtBody` og `normaliserRespons` i `opprettOboProxy`.
