---
'@navikt/toi-next-frontend': patch
---

Legg til `default`-betingelse i alle export-stiene så pakken også kan brukes fra CommonJS-kontekst (f.eks. Playwright-tester som kompilerer til CJS).
