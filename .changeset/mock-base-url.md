---
'@navikt/toi-next-frontend': minor
---

Legg til `mockBaseUrl`-opsjon i `opprettOboProxy`. Når satt rutes alt til `${mockBaseUrl}${pathname}${search}` (original sti), og `apiUrl`-guarden hoppes over. Da slipper konsumenter å overstyre `byggMålUrl` kun for mock-ruting i lokal-/testmodus.
