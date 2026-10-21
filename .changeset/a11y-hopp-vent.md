---
'@navikt/toi-next-frontend': patch
---

`sjekkHoppTilHovedinnhold` venter opptil 3 sekunder når siden har en «Hopp til hovedinnhold»-lenke som ennå ikke kan nås. Dekoratøren viser lenken først når skriptet har kjørt, og sjekken ga derfor av og til falske funn.
