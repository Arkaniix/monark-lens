// src/lib/constants.ts — constantes partagées (source canonique v2).
// Valeurs reprises du dist v1, EXTENSION_VERSION aligné sur le manifest v2.
// L'état persisté (forme + defaults) vit dans src/lib/storage.ts (typé).

export const API_BASE = "https://api.monark-market.fr/v1";
export const MONARK_WEB_URL = "https://monark-market.fr";
// SW + popup (modules). DOIT rester égal à content/version.ts CONTENT_VERSION + package/manifest
// → vérifié par scripts/check-version-sync.mjs (anti-récidive des bumps ratés).
export const EXTENSION_VERSION = "2.5.0";

export const COMPONENT_DB_TTL = 24 * 60 * 60 * 1000; // 24 h
export const INTENT_RULES_TTL = 24 * 60 * 60 * 1000; // 24 h (l'alarme 60 min rafraîchit via ETag)
export const BACKOFF_BASE_MS = 1000;
export const BACKOFF_MAX_MS = 30000;
