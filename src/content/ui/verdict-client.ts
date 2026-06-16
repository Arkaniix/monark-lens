// src/content/ui/verdict-client.ts — appel GET_VERDICT via le SW (proxy strict, B2).
// Le content ne fetch jamais : il envoie l'URL BRUTE en interne (hashée -> ad_hash SW-side)
// + les inputs mappés vers l'enum endpoint. Mappings PURS et testables.

import type { VerdictResponse } from "../../lib/api-types";
import type { GetVerdictMsg } from "../../lib/messages";
import type { ListingContext } from "./snapshot-client";

export type VerdictOutcome =
  | { ok: true; data: VerdictResponse }
  | { ok: false; error: string; status?: number };

// condition interne (= deeplink.CONDITION_TO_SLUG) -> enum endpoint estimateur.
const _CONDITION_MAP: Record<string, string> = {
  new: "new",
  like_new: "like_new",
  good: "good",
  fair: "occasion", // LBC « correct »
  poor: "for_parts", // « à réparer »
};
const _PLATFORMS = new Set(["ebay", "leboncoin", "vinted", "other"]);
const MAX_AGE_DAYS = 3650;
const MS_PER_DAY = 86_400_000;

/** condition interne (new|like_new|good|fair|poor|null) -> enum endpoint, undefined si omise. */
export function mapCondition(c: string | null | undefined): string | undefined {
  return c ? _CONDITION_MAP[c] : undefined;
}

/** plateforme détectée -> enum endpoint (ebay|leboncoin|vinted|other ; défaut other). */
export function mapPlatform(p: string): string {
  return _PLATFORMS.has(p) ? p : "other";
}

/** publishedAt (YYYY-MM-DD, LBC) -> jours écoulés clampés [0,3650] ; undefined si null/NaN. */
export function ageFromPublishedAt(
  publishedAt: string | null | undefined,
  now: number = Date.now(),
): number | undefined {
  if (!publishedAt) return undefined;
  const t = Date.parse(publishedAt);
  if (Number.isNaN(t)) return undefined;
  const days = Math.floor((now - t) / MS_PER_DAY);
  return Math.max(0, Math.min(MAX_AGE_DAYS, days));
}

/** Construit le message GET_VERDICT depuis le contexte (mappings appliqués). */
export function buildVerdictMsg(ctx: ListingContext): GetVerdictMsg {
  const msg: GetVerdictMsg = {
    type: "GET_VERDICT",
    url: ctx.url,
    component_id: ctx.componentId,
    asking_price: ctx.askingPrice,
    platform: mapPlatform(ctx.platform),
    title: ctx.title, // override VRAM serveur (2C) — pas de résolution VRAM client
  };
  const cond = mapCondition(ctx.condition);
  if (cond) msg.condition = cond;
  const age = ageFromPublishedAt(ctx.publishedAt);
  if (age !== undefined) msg.listing_age_days = age;
  return msg;
}

/** Demande un verdict au SW. Ne jette pas : renvoie un résultat discriminé. */
export async function requestVerdict(ctx: ListingContext): Promise<VerdictOutcome> {
  const msg = buildVerdictMsg(ctx);
  try {
    const res = (await chrome.runtime.sendMessage(msg)) as
      | (VerdictResponse & { error?: undefined })
      | { error: string; status?: number };
    if (res && "error" in res && res.error) {
      const status = (res as { status?: number }).status;
      return status === undefined ? { ok: false, error: res.error } : { ok: false, error: res.error, status };
    }
    return { ok: true, data: res as VerdictResponse };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erreur réseau" };
  }
}
