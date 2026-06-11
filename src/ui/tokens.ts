// src/ui/tokens.ts — DESIGN SYSTEM (DA Monark, transposée du site). SOURCE DE VÉRITÉ.
//
// ⚠️ INVARIANT 0-IMPORT (MV3) : ce module n'est importé QUE par le content-script
// (src/content/ui/*) → Rollup l'INLINE dans content/main.js (aucun chunk partagé).
// Le popup ne l'importe PAS : popup.css est un fichier STATIQUE (copié verbatim).
//   ⇒ SYNC OBLIGATOIRE : toute modif des tokens ci-dessous doit être répliquée
//      dans le bloc `:root` en tête de src/popup/popup.css (commentaire croisé là-bas).
//
// Surfaces SANS bordure ni ombre : différenciation par opacité (cartes ~rgba blanc).
// Chiffres/prix/pourcentages → JetBrains Mono ; texte → Inter (cf. src/ui/fonts.ts).

/** Déclarations des variables de design, sans sélecteur (réutilisable :host / :root). */
export const TOKEN_VARS = `
  --bg: #0A0A0B;

  /* Texte — palette zinc */
  --zinc-100: #f4f4f5;  /* titres / héros */
  --zinc-300: #d4d4d8;  /* texte fort */
  --zinc-400: #a1a1aa;  /* courant */
  --zinc-500: #71717a;  /* légendes */

  /* Surfaces — différenciation par OPACITÉ (pas de bordure, pas d'ombre) */
  --card: rgba(255, 255, 255, 0.012);
  --subcard: rgba(255, 255, 255, 0.015);
  --card-hover: rgba(255, 255, 255, 0.022);   /* +0.01 */
  --subcard-hover: rgba(255, 255, 255, 0.025); /* +0.01 */
  --hairline: rgba(255, 255, 255, 0.04);       /* séparateur ultra-discret */
  --radius: 10px;

  /* Sémantiques (verdicts + accents) */
  --blue: #3B82F6;
  --green: #10B981;
  --amber: #F59E0B;
  --red: #EF4444;
  --turquoise: #09B1BA;
  --violet: #A855F7;

  /* Mouvement — ease-expo */
  --ease-expo: cubic-bezier(0.16, 1, 0.3, 1);
  --t-fast: 240ms;
  --t-slow: 400ms;

  /* Typo — JetBrains Mono est la variante NL (sans ligatures, choix délibéré) */
  --font-mono: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  --font-sans: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
`;

/** Bloc `:host { … }` injectable dans chaque shadow root (overlay + bouton). */
export const HOST_TOKENS_CSS = `:host {${TOKEN_VARS}}`;
