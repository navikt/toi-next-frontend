---
'@navikt/toi-next-frontend': minor
---

Utvidede tilgjengelighetssjekker i `/a11y`: `tilgjengelighetstest(test, { utvidet: true })` kjører i tillegg til axe sjekker for tekstforstørrelse (1.4.4), tekstavstand (1.4.12), visningsretning (1.3.4) og tastatur (2.1.1, 2.1.2, 2.4.7, 3.2.1). Nytt valg `mørkModus` kjører axe på nytt i mørk modus. Sjekkene finnes også som egne funksjoner (`sjekkTastatur`, `sjekkTekstforstørrelse`, `sjekkTekstavstand`, `sjekkVisningsretning` og tilsvarende `analyser*`).
