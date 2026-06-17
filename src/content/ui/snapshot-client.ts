// src/content/ui/snapshot-client.ts — appel GET_SNAPSHOT via le SW (proxy strict).
// Le content ne fetch jamais : il envoie l'URL BRUTE en interne, le SW la hashe (ad_hash)
// et débite/cache. Partagé par button.ts (1er clic) et overlay.ts (retry).

import type { SnapshotResponse } from "../../lib/api-types";
import type { GetSnapshotMsg } from "../../lib/messages";
import type { IntentDecision } from "../classify";

/** Contexte d'une annonce analysable (issu de collect.ts). */
export interface ListingContext {
  platform: string;
  url: string;
  componentId: number;
  componentName: string | null;
  askingPrice: number;
  condition: string | null;
  intent: IntentDecision; // décision de filtrage (gate / label / overlay_message / flags / rules_version)
  publishedAt: string | null; // date de publication (LBC uniquement) pour le deep-link estimateur
  title: string; // titre live de l'annonce (= celui envoyé à /signals/ingest) → override VRAM serveur 2C
  // description live (déjà parsée pour la classification) — utilisée UNIQUEMENT pour le verdict de
  // lot (/lens/bundle, Phase B), in-request only, jamais loggée ni persistée (L.341-1).
  description?: string | null;
}

export type SnapshotOutcome =
  | { ok: true; data: SnapshotResponse }
  | { ok: false; error: string; status?: number };

/** Demande un snapshot au SW. Ne jette pas : renvoie un résultat discriminé. */
export async function requestSnapshot(ctx: ListingContext): Promise<SnapshotOutcome> {
  const msg: GetSnapshotMsg = {
    type: "GET_SNAPSHOT",
    url: ctx.url,
    component_id: ctx.componentId,
    asking_price: ctx.askingPrice,
    platform: ctx.platform,
    condition: ctx.condition,
    title: ctx.title, // override VRAM serveur (2C) — pas de résolution VRAM client
  };
  try {
    const res = (await chrome.runtime.sendMessage(msg)) as
      | (SnapshotResponse & { error?: undefined })
      | { error: string; status?: number };
    if (res && "error" in res && res.error) {
      const status = (res as { status?: number }).status;
      return status === undefined ? { ok: false, error: res.error } : { ok: false, error: res.error, status };
    }
    return { ok: true, data: res as SnapshotResponse };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erreur réseau" };
  }
}
