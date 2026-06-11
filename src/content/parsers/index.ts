// src/content/parsers/index.ts — orchestrateur d'extraction (doctrine par champ) + garde catégorie.
import { getSelectors, normalizeCondition, parsePrice, resolveField } from "../selectors";
import { normalizeRegion } from "../regions";
import type { ParsedListing, Platform } from "../types";
import {
  detectLbcPourPieces,
  extractFromNextData,
  extractLbcCategoryFromUrl,
  extractLeboncoinLocation,
} from "./lbc";
import { extractFromVintedJsonLd, extractVintedDescription } from "./vinted";
import { extractEbayDescription, extractEbayLocation } from "./ebay";

export async function extractListingData(platform: Platform): Promise<ParsedListing | null> {
  const merged = await getSelectors(platform);

  // (1) JSON-first
  if (platform === "leboncoin") {
    const j = extractFromNextData();
    if (j) return j;
  }
  if (platform === "vinted") {
    const j = extractFromVintedJsonLd(merged);
    if (j) return j;
  }

  // (2) couche sélecteurs → (3) stratégie code
  const title = resolveField(merged, "title");
  if (!title) return null;
  const price = parsePrice(resolveField(merged, "price"));
  const condition = normalizeCondition(resolveField(merged, "condition"));

  let location: string | null;
  if (platform === "leboncoin") location = resolveField(merged, "location", extractLeboncoinLocation);
  else if (platform === "ebay") location = resolveField(merged, "location", extractEbayLocation);
  else location = normalizeRegion(resolveField(merged, "location"));

  let description: string | null;
  if (platform === "ebay") description = resolveField(merged, "description", extractEbayDescription);
  else if (platform === "vinted") description = resolveField(merged, "description", extractVintedDescription);
  else description = resolveField(merged, "description");

  let categoryId: number | null = null;
  let categoryName: string | null = null;
  let isPourPieces = false;
  if (platform === "leboncoin") {
    const cat = extractLbcCategoryFromUrl();
    categoryId = cat.id;
    categoryName = resolveField(merged, "category", () => cat.name); // clé ouverte : seed serveur prioritaire
    isPourPieces = detectLbcPourPieces();
  }

  return {
    title,
    price,
    condition,
    location,
    url: window.location.href,
    description,
    categoryId,
    categoryName,
    isPourPieces,
    publishedAt: null, // eBay / fallback DOM : date de publication non extraite (cf. Lot B)
  };
}

const LBC_HARDWARE_CATEGORY_IDS = new Set([15, 16, 17, 44, 2, 3, 4, 5]);
const LBC_HARDWARE_CATEGORY_KEYWORDS = [
  "informatique", "ordinateur", "image", "son", "consoles", "jeux vid", "telephon",
  "téléphon", "multim", "accessoire", "composant", "peripherique", "périphérique",
  "photo", "video", "vidéo",
];

/** Garde LBC : rejette les annonces hors catégorie matériel (porté verbatim). */
export function isHardwareCategory(listing: ParsedListing): boolean {
  if (listing.categoryId == null && listing.categoryName == null) return true;
  if (listing.categoryId != null && LBC_HARDWARE_CATEGORY_IDS.has(listing.categoryId)) return true;
  if (listing.categoryName) {
    const normalized = listing.categoryName.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    return LBC_HARDWARE_CATEGORY_KEYWORDS.some((kw) => normalized.includes(kw));
  }
  if (listing.categoryId != null) return false;
  return true;
}
