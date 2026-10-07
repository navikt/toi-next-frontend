---
'@navikt/toi-next-frontend': minor
---

Legg til `/apm` med `lagApmFeilrapportering` (`rapporterFeil`, `rapporterApiFeil`) og `filtrerApmHendelse` for Nais APM. Pakken avhenger ikke av `@nais/apm`; appen sender inn `captureException`.
