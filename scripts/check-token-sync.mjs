#!/usr/bin/env node
// scripts/check-token-sync.mjs — GARDE-FOU de build.
//
// Le popup n'importe pas src/ui/tokens.ts (content-only, invariant 0-import MV3) : son
// bloc :root DUPLIQUE les tokens à la main. Ce script vérifie que les deux restent
// synchronisés (mêmes noms + mêmes valeurs, normalisées casse/espaces) et que fonts.ts
// et popup.css référencent le MÊME jeu de woff2. Toute désync -> exit(1) avec un diff
// lisible. Branché en préfixe du script `build` (package.json).

import { readFileSync } from "node:fs";

const read = (p) => readFileSync(p, "utf8");

/** Normalise une valeur de token (casse + espaces) pour comparaison robuste. */
const norm = (v) => v.trim().toLowerCase().replace(/\s+/g, "");

/** Parse les declarations `--nom: valeur;` d'un bloc en Map(nom -> valeur normalisee). */
function parseVars(block) {
  const map = new Map();
  const re = /--([a-z0-9-]+)\s*:\s*([^;]+);/gi;
  let m;
  while ((m = re.exec(block)) !== null) map.set(m[1].toLowerCase(), norm(m[2]));
  return map;
}

/** Contenu du template `TOKEN_VARS` de tokens.ts. */
function tokenVarsBlock(src) {
  const m = src.match(/TOKEN_VARS\s*=\s*`([\s\S]*?)`/);
  if (!m) throw new Error("TOKEN_VARS introuvable dans src/ui/tokens.ts");
  return m[1];
}

/** Premier bloc `:root { ... }` de popup.css. */
function rootBlock(src) {
  const m = src.match(/:root\s*\{([\s\S]*?)\}/);
  if (!m) throw new Error(":root introuvable dans src/popup/popup.css");
  return m[1];
}

/** Ensemble des fichiers woff2 references dans une source. */
function woff2From(src) {
  const set = new Set();
  for (const m of src.matchAll(/([a-z0-9-]+\.woff2)/gi)) set.add(m[1].toLowerCase());
  return set;
}

const tokens = parseVars(tokenVarsBlock(read("src/ui/tokens.ts")));
const popup = parseVars(rootBlock(read("src/popup/popup.css")));

const errors = [];

// 1) memes cles + memes valeurs entre tokens.ts et popup.css :root
for (const [k, v] of tokens) {
  if (!popup.has(k)) errors.push(`  --${k} : present dans tokens.ts, ABSENT de popup.css`);
  else if (popup.get(k) !== v) errors.push(`  --${k} : tokens.ts="${v}" != popup.css="${popup.get(k)}"`);
}
for (const k of popup.keys()) {
  if (!tokens.has(k)) errors.push(`  --${k} : present dans popup.css, ABSENT de tokens.ts`);
}

// 2) meme jeu de woff2 entre fonts.ts et popup.css
const fontsTs = woff2From(read("src/ui/fonts.ts"));
const fontsCss = woff2From(read("src/popup/popup.css"));
for (const f of fontsTs) if (!fontsCss.has(f)) errors.push(`  woff2 ${f} : dans fonts.ts, ABSENT de popup.css`);
for (const f of fontsCss) if (!fontsTs.has(f)) errors.push(`  woff2 ${f} : dans popup.css, ABSENT de fonts.ts`);

if (errors.length) {
  console.error("FAIL check-token-sync : desync tokens.ts <-> popup.css :");
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`OK check-token-sync : ${tokens.size} tokens + ${fontsTs.size} woff2 synchronises.`);
