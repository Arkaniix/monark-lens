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
  // DÉVIATION v1 ASSUMÉE (LENS-V2-02) : v1 prenait le PREMIER match bidirectionnel `includes`,
  // ce qui est DÉPENDANT DE L'ORDRE de la component_db — « RTX 3060 Ti » pouvait être écrasé en
  // « RTX 3060 » si la base était listée avant (= faux match facturé). Pour garantir « le plus
  // long/spécifique gagne » de façon DÉTERMINISTE, on choisit d'abord l'égalité EXACTE du nom
  // normalisé avec le modèle extrait, sinon la plus LONGUE correspondance bidirectionnelle.
  // Le scoring/override v1 (gpuScore = len×3) est conservé.
  const gpuModel = extractGpuModel(title);
  if (gpuModel) {
    const normalizedGpu = normalize(gpuModel);
    let gpuComponent: ComponentDbEntry | null =
      componentDb.find((c) => normalize(c.name) === normalizedGpu) ?? null;
    if (!gpuComponent) {
      let bestLen = -1;
      for (const c of componentDb) {
        const nn = normalize(c.name);
        if (nn.includes(normalizedGpu) || normalizedGpu.includes(nn)) {
          if (nn.length > bestLen) {
            gpuComponent = c;
            bestLen = nn.length;
          }
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
