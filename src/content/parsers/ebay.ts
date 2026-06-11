// src/content/parsers/ebay.ts — eBay = DOM-only (cible n°1 du hot-patch sélecteurs).
// title/price/condition passent par la couche (resolveField). location/description = stratégies
// code (regex innerHTML / iframe) car non exprimables en simple sélecteur CSS.
import { normalizeRegion, normalizeRegionFromCountryCity } from "../regions";

/** Stratégie code : "Lieu où se trouve l'objet" / "Item location" (regex innerHTML/body). */
export function extractEbayLocation(): string | null {
  const html = document.documentElement?.innerHTML || "";
  const jsonMatch = html.match(/"text":"(?:Lieu où se trouve l'objet|Item location)\s*:\s*([^"]+)"/i);
  if (jsonMatch) {
    const loc = jsonMatch[1].trim();
    return normalizeRegion(loc) || normalizeRegionFromCountryCity(loc);
  }
  const body = document.body?.textContent || "";
  const frMatch = body.match(/Lieu où se trouve l'objet\s*:\s*(.+?)(?:\s{2,}|Délai|Retour|Livraison|$)/);
  if (frMatch) {
    const loc = frMatch[1].trim();
    return normalizeRegion(loc) || normalizeRegionFromCountryCity(loc);
  }
  const enMatch = body.match(/Item location\s*:\s*(.+?)(?:\s{2,}|Delivery|Return|Shipping|$)/i);
  if (enMatch) {
    return normalizeRegion(enMatch[1].trim()) || normalizeRegionFromCountryCity(enMatch[1].trim());
  }
  return null;
}

/** Stratégie code : description eBay — fallback iframe #desc_ifr (que le CSS ne peut pas faire). */
export function extractEbayDescription(): string | null {
  const iframe = document.querySelector("#desc_ifr") as HTMLIFrameElement | null;
  if (iframe?.contentDocument) {
    return iframe.contentDocument.body?.textContent?.trim() || null;
  }
  return null;
}
