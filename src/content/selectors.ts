// src/content/selectors.ts — couche sélecteurs (fusion serveur-sur-bundle) + helpers DOM.
//
// ── DOCTRINE DE RÉSOLUTION PAR CHAMP (LENS-V2-02, gravée) ───────────────────
//   1. JSON-first      — chemins JSON dans les parsers (LBC __NEXT_DATA__, Vinted JSON-LD).
//                        Code, NON patchable, structures assumées stables.
//   2. Couche sélecteurs — getSelectors() fusionne le seed serveur /config/selectors
//                        PAR-DESSUS le bundle, PAR CHAMP, sur N'IMPORTE QUELLE clé (liste
//                        OUVERTE). Si le serveur seed un jour "location"/"category", le client
//                        les consomme SANS rebuild, et AVANT la stratégie code.
//   3. Stratégie code  — fallback non-CSS (breadcrumb LBC, regex innerHTML eBay, URL catégorie).
//   resolveField() applique (2) puis (3) ; les parsers appliquent (1) en amont.
// ───────────────────────────────────────────────────────────────────────────

import type { Platform } from "./types";

export const FALLBACK_SELECTORS: Record<Platform, Record<string, string>> = {
  leboncoin: {
    // __NEXT_DATA__ préféré (parsers/lbc) ; fallbacks DOM en dernier recours.
    title: 'h1[data-qa-id="adview_title"], h1',
    price: '[data-qa-id="adview_price"] span, [data-qa-id="adview_price"]',
    condition:
      '[data-qa-id="criteria_item_condition"] .details-list__item-value:last-child span, [data-qa-id="criteria_item_condition"]',
    // Pas de sélecteur CSS bundle pour la RÉGION LBC (le delivery_container v1 = texte livraison,
    // pas une région) → stratégie code = breadcrumb (parsers/lbc). Le serveur peut seed une vraie clé.
    location: "",
    description: '[data-qa-id="adview_description_container"]',
  },
  ebay: {
    title: "h1.x-item-title__mainTitle span, h1 span.ux-textspans--BOLD, #itemTitle",
    price: ".x-price-primary span, .x-bin-price span.ux-textspans, #prcIsum",
    condition: ".x-item-condition-text span, .ux-labels-values--condition .ux-textspans--BOLD, #vi-itm-cond",
    location: "",
    description: "#desc_div, #viTabs_0_is",
  },
  vinted: {
    title: 'h1, [data-testid="item-page-summary-plugin"] h1',
    price: '[data-testid="item-price"], [data-testid="item-sidebar-price-container"] [class*="Text__subtitle"]',
    condition: '[data-testid="item-attributes-status"] [itemprop="status"] span, [data-testid="item-attributes-status"] .web_ui__Text__bold',
    location: "",
    description: '[itemprop="description"]',
  },
};

// LBC : lookup EXACT sur le slug d'attribut condition (≠ normalizeCondition free-text).
export const LBC_CONDITION_MAP: Record<string, string> = {
  neuf: "new",
  etatneuf: "like_new",
  tresbonetat: "like_new",
  bonetat: "good",
  etatcorrect: "fair",
  pourpieces: "poor",
};

const cachedSelectors: Partial<Record<Platform, Record<string, string>>> = {};

/** Fusion serveur-sur-bundle PAR CHAMP, clés ouvertes ; vide/null serveur ne clobbe pas. */
export async function getSelectors(platform: Platform): Promise<Record<string, string>> {
  const cached = cachedSelectors[platform];
  if (cached) return cached;
  const fallback = FALLBACK_SELECTORS[platform] || {};
  let merged: Record<string, string> = { ...fallback };
  try {
    const stored = await chrome.storage.local.get(["platform_selectors"]);
    const entry = (stored as { platform_selectors?: Record<string, { selectors?: Record<string, string> }> })
      .platform_selectors?.[platform]?.selectors;
    if (entry) {
      const filtered = Object.fromEntries(
        Object.entries(entry).filter(([, v]) => v !== "" && v != null),
      );
      merged = { ...fallback, ...filtered };
    }
  } catch {
    /* storage indispo -> fallback pur */
  }
  cachedSelectors[platform] = merged;
  return merged;
}

/** Vide le cache (tests / refresh sélecteurs). */
export function resetSelectorCache(): void {
  for (const k of Object.keys(cachedSelectors)) delete cachedSelectors[k as Platform];
}

export function extractText(selectors: string): string | null {
  const list = selectors.split(",").map((s) => s.trim());
  for (const selector of list) {
    if (!selector) continue;
    try {
      const el = document.querySelector(selector);
      if (el) {
        const text = el.textContent?.trim();
        if (text) return text;
      }
    } catch {
      /* sélecteur invalide -> suivant */
    }
  }
  return null;
}

/** Étape (2) puis (3) de la doctrine : sélecteur (serveur-sur-bundle) puis stratégie code. */
export function resolveField(
  merged: Record<string, string>,
  field: string,
  strategy?: () => string | null,
): string | null {
  const sel = merged[field];
  if (sel) {
    const txt = extractText(sel);
    if (txt) return txt;
  }
  return strategy ? strategy() : null;
}

export function parsePrice(text: string | null): number | null {
  if (!text) return null;
  const cleaned = text.replace(/[^\d,.]/g, "").replace(/\s/g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

const CONDITION_MAP: ReadonlyArray<readonly [string, string]> = [
  // Long keys first
  ["neuf avec étiquette", "new"],
  ["neuf sans étiquette", "new"],
  ["très bon état", "like_new"],
  ["très bon", "like_new"],
  ["état correct", "fair"],
  ["bon état", "good"],
  ["pour pièces", "poor"],
  ["état neuf", "like_new"],
  ["comme neuf", "like_new"],
  ["brand new", "new"],
  ["like new", "like_new"],
  ["open box", "like_new"],
  ["very good", "like_new"],
  ["excellent", "like_new"],
  ["not working", "poor"],
  ["for parts", "poor"],
  ["pour pièces détachées", "poor"],
  ["reconditionné", "like_new"],
  ["refurbished", "like_new"],
  ["satisfaisant", "fair"],
  ["acceptable", "fair"],
  // Short keys last
  ["occasion", "good"],
  ["neuf", "new"],
  ["good", "good"],
  ["new", "new"],
  ["bon", "good"],
];

export function normalizeCondition(raw: string | null): string | null {
  if (!raw) return null;
  const lower = raw.toLowerCase().trim();
  for (const [key, value] of CONDITION_MAP) {
    if (lower.includes(key)) return value;
  }
  return null;
}
