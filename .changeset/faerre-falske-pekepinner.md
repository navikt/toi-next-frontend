---
'@navikt/toi-next-frontend': patch
---

Færre falske pekepinner: 2.2.2 rapporterer ikke lenger lasteindikatorer som stopper med `prefers-reduced-motion`, og ESLint-regelen `toi-a11y/ingen-handling-ved-pekerned` godtar navngitte handlere som bare stopper hendelsen (f.eks. `stopAllPropagation`).
