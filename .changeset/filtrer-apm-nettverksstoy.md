---
"@navikt/toi-next-frontend": minor
---

Utvid `filtrerApmHendelse` med filtre for sesjons-fetch med status 0 eller 401, «Load failed» og «Failed to fetch» uten app-stacktrace og 401-feil fra arbeidsgiver-notifikasjon-widget. Nettverksfeil med rammer fra appen eller ukjent kode, andre sesjonsstatuser og andre widget-feil sendes fortsatt.

OpenTelemetry- og widget-filtrene krever at klientens stacktrace identifiserer pakkene. Feil med bare hash-navngitte produksjonsbundler sendes fortsatt, selv om Loki senere viser sourcemappede pakkenavn.
