// src/content/version.ts — SOURCE DE VÉRITÉ unique de la version CÔTÉ CONTENT.
// Importée par main.ts (postMessage MONARK_LENS_INSTALLED) ET overlay.ts (footer) → un seul
// point à bumper côté content (fin du footer hardcodé qui ratait à chaque release). Module
// content/* (inliné dans content/main.js) → invariant 0-import MV3 préservé (aucun import lib/*).
// Doit rester ÉGAL à lib/constants.ts EXTENSION_VERSION (SW/popup) — vérifié par check-version-sync.mjs.
export const CONTENT_VERSION = "2.5.0";
