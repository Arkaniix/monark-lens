#!/usr/bin/env node
// scripts/check-version-sync.mjs — GARDE-FOU de build (anti-récidive des bumps ratés).
//
// La version vit en 4 endroits qui DOIVENT rester identiques :
//   - package.json            "version"
//   - src/manifest.json       "version"          (chargé par Chrome)
//   - src/lib/constants.ts    EXTENSION_VERSION  (SW + popup, modules)
//   - src/content/version.ts  CONTENT_VERSION    (content : footer overlay + ping install)
// Toute divergence -> exit(1). Branché en préfixe de `build` (après check-token-sync).

import { readFileSync } from "node:fs";

const read = (p) => readFileSync(p, "utf8");

function jsonVersion(path) {
  const v = JSON.parse(read(path)).version;
  if (!v) throw new Error(`version absente de ${path}`);
  return v;
}

function constVersion(path, name) {
  const m = read(path).match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`));
  if (!m) throw new Error(`${name} introuvable dans ${path}`);
  return m[1];
}

const sources = {
  "package.json": jsonVersion("package.json"),
  "src/manifest.json": jsonVersion("src/manifest.json"),
  "src/lib/constants.ts (EXTENSION_VERSION)": constVersion("src/lib/constants.ts", "EXTENSION_VERSION"),
  "src/content/version.ts (CONTENT_VERSION)": constVersion("src/content/version.ts", "CONTENT_VERSION"),
};

const values = [...new Set(Object.values(sources))];
if (values.length !== 1) {
  console.error("❌ check-version-sync : versions DÉSYNCHRONISÉES");
  for (const [k, v] of Object.entries(sources)) console.error(`   ${v}\t${k}`);
  process.exit(1);
}
console.log(`✓ check-version-sync : version ${values[0]} cohérente (4 sources)`);
