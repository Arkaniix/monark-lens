// src/lib/constants.ts — constantes partagées (source canonique v2).
// Valeurs reprises du dist v1, EXTENSION_VERSION aligné sur le manifest v2.
// L'état persisté (forme + defaults) vit dans src/lib/storage.ts (typé).

export const API_BASE = "https://api.monark-market.fr/v1";
export const MONARK_WEB_URL = "https://monark-market.fr";
export const EXTENSION_VERSION = "2.1.0";

export const COMPONENT_DB_TTL = 24 * 60 * 60 * 1000; // 24 h
export const BACKOFF_BASE_MS = 1000;
export const BACKOFF_MAX_MS = 30000;
