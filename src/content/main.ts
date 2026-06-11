// src/content/main.ts — entrée content-script (stub scaffold v2).
//
// IMPORTANT : les content scripts déclarés dans manifest.content_scripts sont des
// scripts CLASSIQUES (pas type="module"). Cette entrée doit donc rester
// AUTO-SUFFISANTE — aucun `import` d'un chunk partagé, sinon le bundle émettrait un
// `import "../chunks/..."` invalide au chargement dans la page. Les constantes
// partagées (src/lib/constants.ts) sont réservées au service-worker et au popup,
// qui sont des modules. La v2 inlinera côté content ce dont il a besoin (Vite
// `define` ou copie locale). Aucune logique métier pour l'instant.

const CONTENT_BOOT_VERSION = "2.0.0";

console.info(`[Monark Lens] content script started — v${CONTENT_BOOT_VERSION}`);
