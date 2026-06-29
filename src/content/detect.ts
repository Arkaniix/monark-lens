// src/content/detect.ts — détection plateforme/page + matching titre→composant.
// PORTÉ VERBATIM du v1 (le matching est LE risque produit : un faux match = un snapshot
// facturé sur le mauvais composant). « Le candidat le plus long qui matche gagne » (score
// ∝ longueur, strict-greater). Filet de sécurité GPU regex (extractGpuModel) conservé tel quel.

import type { ComponentDbEntry } from "../lib/api-types";
import type { Detection, MatchResult, Platform } from "./types";

export const PLATFORM_PATTERNS: Record<Platform, RegExp> = {
  leboncoin: /leboncoin\.fr/,
  ebay: /ebay\.(fr|com)/,
  vinted: /vinted\.fr/,
};

export const DETAIL_PATTERNS: Record<Platform, RegExp> = {
  leboncoin: /leboncoin\.fr\/ad\/|leboncoin\.fr\/[a-z_]+\/\d+/,
  ebay: /ebay\.(fr|com)\/itm\//,
  vinted: /vinted\.fr\/items\//,
};

export function detectPlatform(url: string = window.location.href): Detection | null {
  for (const [platform, pattern] of Object.entries(PLATFORM_PATTERNS) as [Platform, RegExp][]) {
    if (pattern.test(url)) {
      return { platform, pageType: detectPageType(platform, url) };
    }
  }
  return null;
}

export function detectPageType(platform: Platform, url: string): Detection["pageType"] {
  const detailPattern = DETAIL_PATTERNS[platform];
  if (detailPattern && detailPattern.test(url)) return "detail";
  const urlObj = new URL(url);
  if (
    urlObj.searchParams.has("text") ||
    urlObj.searchParams.has("q") ||
    urlObj.searchParams.has("_kw") ||
    urlObj.pathname.includes("/recherche") ||
    urlObj.pathname.includes("/sch/")
  ) {
    return "listing";
  }
  return "unknown";
}

// ── component DB (cache local de détection, alimenté par GET_COMPONENT_DB) ──

let componentDb: ComponentDbEntry[] = [];
let dbLoaded = false;

export function setComponentDb(db: ComponentDbEntry[]): void {
  componentDb = db;
  dbLoaded = db.length > 0;
}

export function getComponentDb(): ComponentDbEntry[] {
  return componentDb;
}

export function isComponentDbLoaded(): boolean {
  return dbLoaded && componentDb.length > 0;
}

export async function loadComponentDb(): Promise<void> {
  if (dbLoaded && componentDb.length > 0) return;
  try {
    const response = (await chrome.runtime.sendMessage({ type: "GET_COMPONENT_DB" })) as ComponentDbEntry[];
    if (Array.isArray(response) && response.length > 0) {
      setComponentDb(response);
      console.log(`[Monark] Component DB loaded: ${componentDb.length} components`);
    }
  } catch (err) {
    console.error("[Monark] Failed to load component DB:", err);
  }
}

// ── normalisation + matching (verbatim v1) ──

export function normalize(text: string): string {
  let t = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Coller les suffixes CPU/GPU : "5800 x" → "5800x", "13900 k" → "13900k", "7800 x3d" → "7800x3d"
  t = t.replace(/(\d)\s+(x3d|x3|xt|xtx|xs|kf|ks|kx|hx|hs|x|k|g|f|e|s|u|h|p|ti|super)\b/g, "$1$2");
  // Coller préfixes GPU au numéro : "gtx 1080" → "gtx1080", "rx 7600" → "rx7600"
  t = t.replace(/\b(gtx|rtx|rx)\s+(\d)/g, "$1$2");
  return t;
}

export function extractGpuModel(title: string): string | null {
  const nvidiaStd = /\b(?:geforce\s*)?(?:rtx|gtx)\s*(\d{3,4})\s*(ti\s*super|super|ti)?\b/i;
  let m = nvidiaStd.exec(title);
  if (m) return m[0].trim();

  const nvidiaSuffix = /\b(?:nvidia\s*)?(?:geforce\s*)?(\d{4})\s*(ti\s*super|super|ti)\b/i;
  m = nvidiaSuffix.exec(title);
  if (m) {
    const num = parseInt(m[1]);
    const suffix = m[2] || "";
    const prefix = num >= 2000 ? "RTX" : "GTX";
    return `${prefix} ${m[1]} ${suffix}`.trim();
  }

  const amdStd = /\b(?:radeon\s*)?rx\s*(\d{3,4})\s*(xt|xtx)?\b/i;
  m = amdStd.exec(title);
  if (m) return m[0].trim();

  const amdConcat = /\brx(\d{4})\s*(xt|xtx)?\b/i;
  m = amdConcat.exec(title);
  if (m) return `RX ${m[1]}${m[2] ? " " + m[2] : ""}`.trim();

  const arcPattern = /\barc\s*(a\d{3,4})\b/i;
  m = arcPattern.exec(title);
  if (m) return m[0].trim();

  return null;
}

export function matchComponent(title: string): MatchResult | null {
  if (!componentDb.length) return null;
  const normalizedTitle = normalize(title);
  let bestMatch: MatchResult | null = null;
  for (const component of componentDb) {
    const normalizedName = normalize(component.name);
    if (normalizedTitle.includes(normalizedName)) {
      const score = normalizedName.length * 2;
      if (!bestMatch || score > bestMatch.matchScore) {
        bestMatch = {
          componentId: component.id,
          componentName: component.name,
          category: component.category ?? "",
          matchScore: score,
          matchType: "exact_name",
        };
      }
      continue;
    }
    if (component.aliases) {
      for (const alias of component.aliases) {
        const normalizedAlias = normalize(alias);
        if (normalizedAlias.length >= 3 && normalizedTitle.includes(normalizedAlias)) {
          const score = normalizedAlias.length;
          if (!bestMatch || score > bestMatch.matchScore) {
            bestMatch = {
              componentId: component.id,
              componentName: component.name,
              category: component.category ?? "",
              matchScore: score,
              matchType: "alias",
            };
          }
        }
      }
    }
  }
  // GPU regex — filet de sécurité (toujours évalué).
  // CORRECTIF D4 (faux « Ti ») : la règle v1 « le nom catalogue le plus LONG gagne » est À
  // L'ENVERS quand le token extrait est la BASE — « rtx3080 » matche bidirectionnellement
  // « geforcertx3080 » ET « geforcertx3080ti », et « le plus long » choisit le Ti (sur-spéc.).
  // Désormais, de façon DÉTERMINISTE : (1) égalité EXACTE du token GPU (nom complet OU « cœur »
  // débarrassé du préfixe de marque) ; sinon (2) le PLUS PETIT sur-ensemble (longueur la plus
  // proche du token) en REJETANT tout nom portant un suffixe (ti/super/xt/xtx) ABSENT du token.
  // extractGpuModel capture déjà le suffixe modèle-signifiant. Scoring/override v1 conservé.
  const gpuModel = extractGpuModel(title);
  if (gpuModel) {
    const normalizedGpu = normalize(gpuModel);
    const SUFFIX_RE = /(tisuper|super|ti|xtx|xt)$/;
    const tokenSuffix = (normalizedGpu.match(SUFFIX_RE) ?? [""])[0];
    const coreOf = (nn: string): string =>
      nn.replace(/^(?:nvidia|geforce|amd|radeon|intel|arc)+/, "");

    let gpuComponent: ComponentDbEntry | null = null;
    // (1) égalité EXACTE du token (nom complet OU cœur sans marque).
    for (const c of componentDb) {
      const nn = normalize(c.name);
      if (nn === normalizedGpu || coreOf(nn) === normalizedGpu) {
        gpuComponent = c;
        break;
      }
    }
    // (2) à défaut : plus petit sur-ensemble (longueur la plus proche), suffixe étranger rejeté.
    if (!gpuComponent) {
      let bestDelta = Infinity;
      for (const c of componentDb) {
        const core = coreOf(normalize(c.name));
        if (!(core.includes(normalizedGpu) || normalizedGpu.includes(core))) continue;
        const coreSuffix = (core.match(SUFFIX_RE) ?? [""])[0];
        if (coreSuffix && coreSuffix !== tokenSuffix) continue; // rejette rtx3080 -> rtx3080ti
        const delta = Math.abs(core.length - normalizedGpu.length);
        if (delta < bestDelta) {
          gpuComponent = c;
          bestDelta = delta;
        }
      }
    }
    if (gpuComponent) {
      const gpuScore = normalizedGpu.length * 3;
      if (
        !bestMatch ||
        gpuScore > bestMatch.matchScore ||
        bestMatch.matchType === "alias" ||
        bestMatch.category !== "gpu"
      ) {
        bestMatch = {
          componentId: gpuComponent.id,
          componentName: gpuComponent.name,
          category: gpuComponent.category ?? "",
          matchScore: gpuScore,
          matchType: "gpu_regex",
        };
      }
    }
  }
  return bestMatch;
}

function isAlnum(ch: string): boolean {
  return (ch >= "a" && ch <= "z") || (ch >= "0" && ch <= "9");
}

// Inclusion BORNÉE-MOT : `needle` (déjà normalisé) ne matche que si la sous-chaîne est flanquée d'un
// non-alphanumérique (espace) ou d'un bord de chaîne des DEUX côtés. Empêche un token catalogue de
// matcher À L'INTÉRIEUR d'un run plus long : « 2700 » dans « 2700x »/« 12700kf », « rtx4070 » dans
// « rtx4070super ». Le texte normalisé n'ayant que [a-z0-9 ], « frontière » = espace ou bord.
function includesAsToken(haystack: string, needle: string): boolean {
  if (!needle) return false;
  let from = 0;
  while (from <= haystack.length) {
    const i = haystack.indexOf(needle, from);
    if (i === -1) return false;
    const end = i + needle.length;
    if ((i === 0 || !isAlnum(haystack[i - 1])) && (end >= haystack.length || !isAlnum(haystack[end]))) {
      return true;
    }
    from = i + 1;
  }
  return false;
}

// Multi-scan : tous les composants DISTINCTS présents dans `text` (repli description LBC, cf.
// collect.ts). MÊME normalisation + MÊME scoring que matchComponent (exact_name = len×2, alias = len,
// alias ≥ 3), mais DEUX durcissements PROPRES au repli (texte libre ≠ titre court) :
//   • inclusion BORNÉE-MOT (includesAsToken) au lieu de String.includes() brut — un alias « 5600 »
//     ne matche plus dans « ddr5 5600 mhz », et « amd ryzen 7 2700 » ne matche plus dans « …2700x »
//     (suivi de 'x') → le 2700X seul reste 1 famille, mais « 2700 ET 2700x » fait 2 familles.
//   • DROP des alias purement numériques (/^\d+$/) — supprime les collisions fréquences/capacités.
// Puis COLLAPSE des familles de MÊME catégorie par containment BORNÉ-MOT du token : « samsung 970 evo »
// ⊂ « samsung 970 evo plus » → 1 famille (variante espace-séparée) ; « …2700 » ⊄ « …2700x » car non
// borné → 2 familles (lot non collé). `.length` = nb de composants distincts. PAS de filet GPU regex
// (matchComponent only) : ce repli ne sert qu'à la garde d'unicité, biais vers le SILENCE.
export function matchAllComponents(text: string): MatchResult[] {
  if (!componentDb.length) return [];
  const normalizedText = normalize(text);
  // (1) un hit par composant : meilleur token (nom prioritaire par le score×2, sinon alias),
  // inclusion bornée-mot, alias purement numériques ignorés.
  type Hit = MatchResult & { token: string };
  const hits: Hit[] = [];
  for (const component of componentDb) {
    let best: Hit | null = null;
    const normalizedName = normalize(component.name);
    if (normalizedName && includesAsToken(normalizedText, normalizedName)) {
      best = {
        componentId: component.id,
        componentName: component.name,
        category: component.category ?? "",
        matchScore: normalizedName.length * 2,
        matchType: "exact_name",
        token: normalizedName,
      };
    }
    if (component.aliases) {
      for (const alias of component.aliases) {
        const normalizedAlias = normalize(alias);
        if (/^\d+$/.test(normalizedAlias)) continue; // alias nu → matcherait dans n'importe quel nombre
        if (normalizedAlias.length >= 3 && includesAsToken(normalizedText, normalizedAlias)) {
          const score = normalizedAlias.length;
          if (!best || score > best.matchScore) {
            best = {
              componentId: component.id,
              componentName: component.name,
              category: component.category ?? "",
              matchScore: score,
              matchType: "alias",
              token: normalizedAlias,
            };
          }
        }
      }
    }
    if (best) hits.push(best);
  }
  // (2) collapse familles, SCOPÉ par catégorie + containment BORNÉ-MOT : retirer un hit seulement si
  // un autre hit de MÊME catégorie, au token strictement plus long, le contient comme token borné
  // (sur-ensemble = composant le plus spécifique → survivant/représentant).
  const survivors = hits.filter(
    (h) =>
      !hits.some(
        (o) => o.category === h.category && o.token.length > h.token.length && includesAsToken(o.token, h.token),
      ),
  );
  return survivors.map(({ token: _token, ...m }) => m);
}

export function findVariantName(componentId: number, title: string): string | null {
  const component = componentDb.find((c) => c.id === componentId);
  if (!component?.aliases?.length) return null;
  const normalizedTitle = normalize(title);
  const baseName = normalize(component.name);
  let bestVariant: string | null = null;
  let bestLength = 0;
  for (const alias of component.aliases) {
    const na = normalize(alias);
    if (na.length <= baseName.length) continue;
    if (normalizedTitle.includes(na) && na.length > bestLength) {
      bestVariant = alias;
      bestLength = na.length;
    }
  }
  if (!bestVariant) return null;
  const name = component.name;
  let variantPart = bestVariant;
  if (variantPart.toLowerCase().startsWith(name.toLowerCase())) {
    variantPart = variantPart.substring(name.length).trim();
  } else {
    for (const prefix of ["GeForce ", "AMD Radeon ", "Radeon ", "Intel Arc ", "Intel Core ", "AMD Ryzen ", "AMD ", "Intel "]) {
      if (name.startsWith(prefix)) {
        const shortName = name.substring(prefix.length);
        if (variantPart.toLowerCase().startsWith(shortName.toLowerCase())) {
          variantPart = variantPart.substring(shortName.length).trim();
          break;
        }
      }
    }
  }
  variantPart = variantPart.replace(/^[\s\-–]+/, "").trim();
  return variantPart || null;
}
