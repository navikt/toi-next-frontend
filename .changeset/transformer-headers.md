---
'@navikt/toi-next-frontend': minor
---

Legg til `transformerHeaders`-hook i `opprettOboProxy` så konsumenter kan justere videresendte headere (f.eks. filtrere cookies) uten å rekonstruere forespørselen. Dette lar Next.js-apper sende `NextRequest` direkte inn i proxyen.
