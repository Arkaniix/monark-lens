// src/background/service-worker.ts — entrée service-worker (stub scaffold v2).
// Service worker MV3 de type "module" (cf manifest background.type) → peut importer
// les constantes partagées. Aucune logique métier pour l'instant.

import { EXTENSION_VERSION } from "../lib/constants";

console.info(`[Monark Lens] service-worker started — v${EXTENSION_VERSION}`);
