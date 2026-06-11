// src/content/parsers/lbc.ts — Leboncoin. JSON-first (__NEXT_DATA__) + stratégies code DOM.
import { LBC_CONDITION_MAP, normalizeCondition } from "../selectors";
import { DEPARTMENT_TO_REGION, LBC_REGION_MAP, normalizeRegion } from "../regions";
import type { ParsedListing } from "../types";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** LBC publie `first_publication_date` (« 2024-06-11 14:30:00 ») → tronque à YYYY-MM-DD. */
function ymdFromLbc(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

/** JSON-first : window.__NEXT_DATA__.props.pageProps.ad (garde staleness). Null = fallback DOM. */
export function extractFromNextData(): ParsedListing | null {
  try {
    const scriptEl = document.getElementById("__NEXT_DATA__");
    if (!scriptEl?.textContent) return null;
    const data: any = JSON.parse(scriptEl.textContent);
    const ad = data?.props?.pageProps?.ad;
    if (!ad) {
      console.log("[Monark] __NEXT_DATA__ has no ad field, falling back to DOM");
      return null;
    }
    // Staleness : l'ID de l'annonce dans l'URL doit correspondre à celui des données.
    const currentUrl = window.location.href;
    const urlIdMatch = currentUrl.match(/\/(\d{8,})(?:\?|$|#)/);
    const adId = ad.list_id || ad.ad_id || ad.id;
    if (urlIdMatch && adId && String(adId) !== urlIdMatch[1]) {
      console.log(`[Monark] __NEXT_DATA__ stale: ad ID ${adId} != URL ID ${urlIdMatch[1]}`);
      return null; // périmé → le retry dans analyze() réessaiera
    }
    const title = ad.subject || null;
    if (!title) return null;
    const rawPrice = ad.price;
    const price = Array.isArray(rawPrice) ? rawPrice[0] : typeof rawPrice === "number" ? rawPrice : null;
    const attrs = ad.attributes || [];
    const conditionAttr = attrs.find((a: any) => a.key === "condition");
    const conditionSlug = conditionAttr?.value || null;
    const condition = conditionSlug
      ? LBC_CONDITION_MAP[conditionSlug] || normalizeCondition(conditionAttr?.value_label || null)
      : null;
    const isPourPieces = conditionSlug === "pourpieces" || conditionSlug === "pour_pieces";
    const loc = ad.location || {};
    const regionName = (loc.region_name || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const deptName = (loc.department_name || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const location =
      LBC_REGION_MAP[regionName] ||
      (deptName && DEPARTMENT_TO_REGION[deptName]) ||
      normalizeRegion(loc.city_label || loc.city || loc.zipcode || null);
    const description = ad.body || null;
    const categoryId = ad.category_id ?? null;
    const categoryName = ad.category_name ?? null;
    // first_publication_date = vraie date de publication (≠ index_date = ré-indexation/refresh).
    const publishedAt = ymdFromLbc(ad.first_publication_date);
    return {
      title,
      price,
      condition,
      location: location || null,
      url: window.location.href,
      description,
      categoryId,
      categoryName,
      isPourPieces,
      publishedAt,
    };
  } catch (err) {
    console.warn("[Monark] __NEXT_DATA__ extraction failed:", err);
    return null;
  }
}

/** Stratégie code : région depuis le breadcrumb `nav a` (fallback DOM). */
export function extractLeboncoinLocation(): string | null {
  try {
    const navLinks = document.querySelectorAll("nav a");
    if (navLinks && navLinks.length >= 6) {
      const crumbs = [...navLinks].map((a) => a.textContent?.trim() ?? "");
      const accueilIndex = crumbs.indexOf("Accueil");
      if (accueilIndex !== -1 && accueilIndex + 3 < crumbs.length) {
        const regionText = crumbs[accueilIndex + 2];
        const cityText = crumbs.length > accueilIndex + 4 ? crumbs[accueilIndex + 4] : null;
        if (regionText) {
          const regionKey = regionText.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
          const mapped = LBC_REGION_MAP[regionKey];
          if (mapped) return mapped;
          const mappedDash = LBC_REGION_MAP[regionKey.replace(/\s+/g, "-")];
          if (mappedDash) return mappedDash;
        }
        if (cityText) {
          const cpMatch = cityText.match(/\b(\d{5})\b/);
          if (cpMatch) {
            const regionFromCp = normalizeRegion(cpMatch[1]);
            if (regionFromCp) return regionFromCp;
          }
        }
      }
    }
    return null;
  } catch (err) {
    console.warn("[Monark] Leboncoin location extraction failed:", err);
    return null;
  }
}

/** Stratégie code : catégorie LBC depuis le pathname (id + nom). */
export function extractLbcCategoryFromUrl(): { id: number | null; name: string | null } {
  const urlPath = window.location.pathname;
  if (urlPath.includes("/ordinateurs/")) return { id: 15, name: "Ordinateurs" };
  if (urlPath.includes("/accessoires_informatique/")) return { id: 17, name: "Accessoires informatique" };
  if (urlPath.includes("/informatique/")) return { id: 16, name: "Informatique" };
  return { id: null, name: null };
}

export function detectLbcPourPieces(): boolean {
  const el = document.querySelector('[data-qa-id="criteria_item_condition"]');
  if (!el) return false;
  const t = el.textContent?.toLowerCase() || "";
  return t.includes("pour pièces") || t.includes("pour pieces");
}
