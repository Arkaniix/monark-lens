// src/content/defects.ts — extraction de défauts (texte pur), déplacée de filters.ts (C2.b).
// Indépendante de l'intention : alimente le payload du signal passif (collect.ts).

const DEFECT_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [/rayur|scratch|éraflu/i, "cosmetic_scratch"],
  [/jauni|yellowing/i, "yellowing"],
  [/pixel mort|dead pixel/i, "dead_pixel"],
  [/bruit|coil whine|ventilateur bruyant/i, "noise"],
  [/chauffe|surchauffe|overheat/i, "overheating"],
  [/crash|instable|instabilité|freeze/i, "instability"],
  [/répar[ée]|à réparer|hs|hors service|panne|défectueux/i, "needs_repair"],
  [/manqu|missing|absent/i, "missing_parts"],
  [/poussièr|dust/i, "dusty"],
  [/oxyd|corros/i, "corrosion"],
];

export function extractDefects(text: string): string[] | null {
  const defects: string[] = [];
  for (const [pattern, label] of DEFECT_PATTERNS) {
    if (pattern.test(text)) defects.push(label);
  }
  return defects.length > 0 ? defects : null;
}
