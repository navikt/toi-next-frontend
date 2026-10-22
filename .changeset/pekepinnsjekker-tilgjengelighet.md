---
'@navikt/toi-next-frontend': minor
---

Pekepinner om tilgjengelighet som ikke feiler testene: kontrast for ikke-tekst (1.4.11), bevegelse (2.2.2), språk i deler av innholdet (3.1.2) og axe-reglene for landemerker. Funnene rapporteres som annotations og vedlegget `a11y-pekepinner.json` i en egen test, «Tilgjengelighet – pekepinner», som er på når `utvidet` er på. Ny eksport `@navikt/toi-next-frontend/eslint` med regelen `toi-a11y/ingen-handling-ved-pekerned` (2.5.2 Pekeravbrytelse). `ventTilStabilLayout` tåler nå at siden navigerer mens den venter.
