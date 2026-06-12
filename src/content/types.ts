// src/content/types.ts — types partagés du content-script v2 (parsing/detection/intent).

export type Platform = "leboncoin" | "ebay" | "vinted";
export type PageType = "detail" | "listing" | "unknown";

export interface Detection {
  platform: Platform;
  pageType: PageType;
}

/** Résultat normalisé d'extraction d'une annonce (JSON-first ou DOM). */
export interface ParsedListing {
  title: string;
  price: number | null;
  condition: string | null; // new|like_new|good|fair|poor|null (null = dégradé non-fatal)
  location: string | null; // région FR normalisée
  url: string;
  description: string | null;
  categoryId: number | null;
  categoryName: string | null;
  isPourPieces: boolean;
  publishedAt: string | null; // date de publication YYYY-MM-DD (LBC uniquement ; null ailleurs)
}

export type MatchType = "exact_name" | "alias" | "gpu_regex";

export interface MatchResult {
  componentId: number;
  componentName: string;
  category: string;
  matchScore: number;
  matchType: MatchType;
  variantName?: string | null;
}
// IntentResult (classifieur hardcodé v2) retiré en C2.b — remplacé par IntentDecision
// (src/content/classify.ts), drivé par les règles servies.
