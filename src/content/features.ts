// src/content/features.ts — FEATURE FLAGS côté CONTENT (source unique, inlinée dans content/main.js).
//
// Pourquoi ICI et pas dans src/lib/constants.ts : overlay.ts (et tout src/content/*) est soumis à
// l'INVARIANT 0-IMPORT MV3 — un module content ne doit JAMAIS importer un chunk lib/* à l'exécution,
// sinon Rollup émet un `import "../chunks/…"` invalide dans content/main.js (aucun garde-fou de build
// ne l'attrape → casse silencieuse au runtime). Même raison que la duplication de MONARK_WEB_URL
// (overlay.ts, deeplink.ts). Ce module content-only est inliné par Rollup, comme src/content/version.ts.
//
// Rallumer l'estimation de lot = passer `bundleEstimation` à `true` (UNE seule ligne).
export const FEATURES = {
  /** Analyse de LOT/PC décomposée par composant (POST /lens/bundle, bundle-panel.ts).
   *  OFF : le flow d'analyse est court-circuité par un message de dégradation → estimateur. */
  bundleEstimation: false,
} as const;
