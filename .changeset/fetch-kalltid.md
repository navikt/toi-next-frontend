---
'@navikt/toi-next-frontend': patch
---

Rett `createFetcher` så global `fetch` slås opp ved kalltid i stedet for ved opprettelse. Da respekteres utbytting av global fetch (testmocks og MSW) selv når fetcheren opprettes på modulnivå.
