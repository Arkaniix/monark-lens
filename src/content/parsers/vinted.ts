// src/content/parsers/vinted.ts — Vinted. JSON-LD (name/price/description) ; la CONDITION
// reste DOM (le JSON-LD n'expose PAS itemCondition — SPOF v1 confirmé) MAIS est routée par la
// couche sélecteurs (resolveField) → patchable serveur, null = dégradé non-fatal (arbitrage #1).
import { normalizeCondition, resolveField } from "../selectors";
import type { ParsedListing } from "../types";

/* eslint-disable @typescript-eslint/no-explicit-any */

export function extractFromVintedJsonLd(merged: Record<string, string>): ParsedListing | null {
  try {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
      if (!script.textContent) continue;
      const data: any = JSON.parse(script.textContent);
      if (data?.["@type"] !== "Product") continue;
      const title = data.name || null;
      if (!title) continue;
      const offers = Array.isArray(data.offers) ? data.offers[0] : data.offers;
      const price = offers?.price ? parseFloat(offers.price) : null;
      // CONDITION via la couche (sélecteur seedé/bundle) puis null — plus de querySelector hardcodé.
      const condition = normalizeCondition(resolveField(merged, "condition"));
      const descriptionJsonLd = data.description || null;
      const descriptionDom = resolveField(merged, "description", extractVintedDescription);
      return {
        title,
        price,
        condition,
        location: null, // non disponible sur Vinted
        url: window.location.href,
        description: descriptionJsonLd || descriptionDom,
        categoryId: null,
        categoryName: null,
        isPourPieces: false,
      };
    }
  } catch (err) {
    console.warn("[Monark] Vinted JSON-LD extraction failed:", err);
  }
  return null;
}

/** Stratégie code description Vinted (superset du sélecteur bundle). */
export function extractVintedDescription(): string | null {
  const el = document.querySelector('[itemprop="description"], [data-testid="item-description"]');
  return el?.textContent?.trim() || null;
}
