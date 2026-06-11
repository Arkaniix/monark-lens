// src/ui/tokens.ts — DESIGN SYSTEM (DA Monark, transposée du site). SOURCE DE VÉRITÉ.
//
// /!\ INVARIANT 0-IMPORT (MV3) : ce module n'est importé QUE par le content-script
// (src/content/ui/*) → Rollup l'INLINE dans content/main.js (aucun chunk partagé).
// Le popup ne l'importe PAS : popup.css est un fichier STATIQUE (copié verbatim).
//   ⇒ SYNC OBLIGATOIRE : toute modif des tokens ci-dessous doit être répliquée
//      dans le bloc `:root` en tête de src/popup/popup.css (commentaire croisé là-bas).
//
// Surfaces SANS bordure ni ombre : différenciation par opacité (cartes ~rgba blanc).
// Chiffres/prix/pourcentages → JetBrains Mono ; texte → Inter (cf. src/ui/fonts.ts).
//
// MAPPING vers les tokens du site (monark-foundations/src/styles.css) :
//   --bg = --mk-bg/--color-bg-base · --zinc-100 = --mk-fg · --zinc-400 = --mk-fg-muted
//   --zinc-500 = --mk-fg-dim · --card = --mk-surface-1 · --subcard = --mk-surface-2
//   --card-hover/--subcard-hover = --mk-surface-3 · --hairline = --mk-divider-soft
//   --divider = --mk-divider · --radius-card = .mk-card · --blue = --color-accent-primary
//   --green/--amber/--violet/--red = trading-foncer/negocier/tenter/passer
//   --input-* = --mk-input-* · ease-expo + familles de polices identiques au site.
//   SYNC du bloc :root de popup.css vérifiée par scripts/check-token-sync.mjs (gate de build).

/** Déclarations des variables de design, sans sélecteur (réutilisable :host / :root). */
export const TOKEN_VARS = `
  --bg: #0A0A0B;

  /* Texte — palette zinc */
  --zinc-100: #fafafa;  /* titres / héros (= --mk-fg du site) */
  --zinc-300: #d4d4d8;  /* texte fort */
  --zinc-400: #a1a1aa;  /* courant */
  --zinc-500: #71717a;  /* légendes */

  /* Surfaces — différenciation par OPACITÉ (pas de bordure, pas d'ombre) */
  --card: rgba(255, 255, 255, 0.012);          /* = --mk-surface-1 */
  --subcard: rgba(255, 255, 255, 0.02);        /* = --mk-surface-2 */
  --card-hover: rgba(255, 255, 255, 0.025);    /* = --mk-surface-3 */
  --subcard-hover: rgba(255, 255, 255, 0.025); /* = --mk-surface-3 */
  --hairline: rgba(255, 255, 255, 0.04);       /* = --mk-divider-soft */
  --divider: rgba(255, 255, 255, 0.06);        /* = --mk-divider (séparateur fort) */
  --radius: 10px;
  --radius-card: 12px;                         /* = .mk-card du site */

  /* Sémantiques (verdicts + accents) */
  --blue: #3B82F6;                             /* = --color-accent-primary */
  --blue-soft: #93C5FD;                        /* texte sur fond bleu (action primaire) */
  --green: #10B981;                            /* = trading-foncer */
  --amber: #F59E0B;                            /* = trading-negocier */
  --red: #EF4444;                              /* = trading-passer */
  --turquoise: #09B1BA;                        /* marque Lens */
  --violet: #8B5CF6;                           /* = trading-tenter */

  /* Mouvement — ease-expo */
  --ease-expo: cubic-bezier(0.16, 1, 0.3, 1);
  --t-fast: 220ms;
  --t-slow: 400ms;

  /* Typo — JetBrains Mono est la variante NL (sans ligatures, choix délibéré) */
  --font-mono: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  --font-sans: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;

  /* Champs de saisie (popup) — = --mk-input-* du site */
  --input-bg: #09090b;
  --input-border: rgba(255, 255, 255, 0.08);
  --input-border-active: rgba(255, 255, 255, 0.30);
`;

/** Bloc `:host { … }` injectable dans chaque shadow root (overlay + bouton). */
export const HOST_TOKENS_CSS = `:host {${TOKEN_VARS}}`;
