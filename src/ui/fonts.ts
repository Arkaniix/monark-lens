// src/ui/fonts.ts — @font-face embarqués (ÉTAPE 1.2).
//
// 4 woff2 subset latin-FR (€, flèches, accents) fournis par Étienne, sous OFL
// (assets/fonts/OFL-*.txt committés). JetBrains Mono = variante NL (no ligatures).
// On NE télécharge RIEN : les @font-face pointent ces fichiers exacts.
//
// Content-script : les fichiers vivent en chrome-extension://… → URL résolue via
// chrome.runtime.getURL + exposition `web_accessible_resources` (manifest).
// Popup : page d'extension same-origin → popup.css référence les mêmes woff2 en
// chemin RELATIF (../assets/fonts/…), pas besoin de getURL. (SYNC popup.css.)
//
// font-display:swap → si le woff2 échoue, le fallback système (--font-mono/--font-sans)
// prend le relais immédiatement : aucune dégradation bloquante.

const FONT_FILES = [
  { family: "JetBrains Mono", weight: 400, file: "jetbrains-mono-regular.woff2" },
  { family: "JetBrains Mono", weight: 500, file: "jetbrains-mono-medium.woff2" },
  { family: "Inter", weight: 400, file: "inter-regular.woff2" },
  { family: "Inter", weight: 500, file: "inter-medium.woff2" },
  { family: "Inter", weight: 600, file: "inter-semibold.woff2" },
] as const;

/** Résout une URL d'asset de police, tolérant à l'absence de `chrome` (tests). */
function resolveFontUrl(file: string): string {
  const path = `assets/fonts/${file}`;
  const runtime = (globalThis as { chrome?: { runtime?: { getURL?: (p: string) => string } } }).chrome;
  if (runtime?.runtime?.getURL) return runtime.runtime.getURL(path);
  return path; // fallback (vitest / contexte sans chrome) — non bloquant
}

/** Bloc @font-face injectable dans un shadow root (Chromium honore @font-face en shadow DOM). */
export function fontFaceCss(): string {
  return FONT_FILES.map(
    (f) =>
      `@font-face{font-family:"${f.family}";font-style:normal;font-weight:${f.weight};` +
      `font-display:swap;src:url("${resolveFontUrl(f.file)}") format("woff2");}`,
  ).join("\n");
}
