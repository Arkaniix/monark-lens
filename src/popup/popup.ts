// src/popup/popup.ts — entrée popup (stub scaffold v2).
// Chargé via popup.html en <script type="module"> → module, peut importer les
// constantes partagées. Aucune logique métier pour l'instant.

import { EXTENSION_VERSION } from "../lib/constants";

console.info(`[Monark Lens] popup started — v${EXTENSION_VERSION}`);

const el = document.getElementById("app");
if (el) {
  el.textContent = `Monark Lens — v${EXTENSION_VERSION} (scaffold)`;
}
