---
'@navikt/toi-next-frontend': minor
---

Utvidede tilgjengelighetssjekker i `/a11y`: `tilgjengelighetstest(test, { utvidet: true })` kjører i tillegg til axe sjekker for tekstforstørrelse (1.4.4), tekstavstand (1.4.12), visningsretning (1.3.4) og tastatur (2.1.1, 2.1.2, 2.4.7, 3.2.1). Nytt valg `mørkModus` kjører axe på nytt i mørk modus. Sjekkene finnes også som egne funksjoner (`sjekkTastatur`, `sjekkTekstforstørrelse`, `sjekkTekstavstand`, `sjekkVisningsretning` og tilsvarende `analyser*`).

Sjekkene som bare er slått på via `utvidet`, kjøres i en egen test tagget `@a11y-utvidet`, slik at axe kan stoppe deploy mens de utvidede funnene rettes.

Rettet: `sjekkReflow` kunne godkjenne siden før den hadde tilpasset seg 320 px, fordi den godtok den første målingen som besto. Nå venter den til DOM og størrelser er stabile før den måler. Apper med `reflow: true` kan derfor få reflow-funn som tidligere slapp gjennom.
