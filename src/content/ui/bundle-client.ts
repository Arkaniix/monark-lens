// src/content/ui/bundle-client.ts — appel GET_BUNDLE via le SW (proxy strict, Phase B).
// Lot/PC : le serveur RÉSOUT les composants depuis title+description (pas de component_id ici).
// Le content ne fetch jamais : URL brute en interne (hashée -> ad_hash SW-side). Mappings PURS.
// ⚠️ title/description sont in-request only : JAMAIS loggés ici (aucun console.log dans ce fichier).

import type { BundleResponse } from "../../lib/api-types";
import type { GetBundleMsg } from "../../lib/messages";
import type { ListingContext } from "./snapshot-client";
import { ageFromPublishedAt, mapCondition, mapPlatform } from "./verdict-client";

export type BundleOutcome =
  | { ok: true; data: BundleResponse }
  | { ok: false; error: string; status?: number };

/** Construit le message GET_BUNDLE depuis le contexte (mappings réutilisés du verdict). */
export function buildBundleMsg(ctx: ListingContext): GetBundleMsg {
  const msg: GetBundleMsg = {
    type: "GET_BUNDLE",
    url: ctx.url,
    total_price: ctx.askingPrice, // prix du LOT entier (≠ asking_price mono)
    platform: mapPlatform(ctx.platform),
  };
  const cond = mapCondition(ctx.condition);
  if (cond) msg.condition = cond;
  const age = ageFromPublishedAt(ctx.publishedAt);
  if (age !== undefined) msg.listing_age_days = age;
  if (ctx.title) msg.title = ctx.title;
  if (ctx.description) msg.description = ctx.description; // troncature 4000 = serveur-side
  return msg;
}

/** Demande un verdict de lot au SW. Ne jette pas : renvoie un résultat discriminé. */
export async function requestBundle(ctx: ListingContext): Promise<BundleOutcome> {
  const msg = buildBundleMsg(ctx);
  try {
    const res = (await chrome.runtime.sendMessage(msg)) as
      | (BundleResponse & { error?: undefined })
      | { error: string; status?: number };
    if (res && "error" in res && res.error) {
      const status = (res as { status?: number }).status;
      return status === undefined ? { ok: false, error: res.error } : { ok: false, error: res.error, status };
    }
    return { ok: true, data: res as BundleResponse };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erreur réseau" };
  }
}
