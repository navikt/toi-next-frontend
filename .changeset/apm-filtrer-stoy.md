---
'@navikt/toi-next-frontend': minor
---

`filtrerApmHendelse` forkaster nå støy som ikke kommer fra koden vår: feil med stacktrace til Dekoratøren, `window.ethereum`-feil fra krypto-lommebøker, `Script error.` og «Maximum call stack size exceeded» når hele stacken peker til sideadressen. Ny eksport `DEKORATØR_URLER` med Dekoratør-adressene, inkludert `cdn.nav.no/personbruker/nav-dekoratoren`, til bruk i `faro.ignoreUrls`.
