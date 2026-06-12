// src/lib/storage.ts — wrapper typé sur chrome.storage.local (état v2).
// Écarts v1 : SUPPRIMÉS overlay_enabled / overlay_position (plus d'overlay passif en v2).
// CONSERVÉS session_signals_count / session_credits_earned (UX collecte) + current_*
// (affichage popup détection) + auto_signal.

import type { ComponentDbEntry, IntentRuleSet, PlatformSelectorEntry } from "./api-types";

export interface LensState {
  // tokens
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: number | null;
  // user
  user_email: string | null;
  user_plan: string;
  // credits
  credits_remaining: number;
  credits_unlimited: boolean;
  credits_updated_at: number; // ms epoch du dernier rafraîchissement du solde (cache age, A4)
  // component DB (cache local pour détection)
  component_db: ComponentDbEntry[];
  component_db_version: string;
  component_db_updated_at: number;
  // selectors (config serveur)
  platform_selectors: Record<string, PlatformSelectorEntry>;
  selectors_version: Record<string, number>;
  // intent rules (filtrage pré-analyse — C2 ; servies + ETag, fallback embarqué côté content)
  intent_rules: IntentRuleSet | null;
  intent_rules_etag: string | null;
  intent_rules_version: number | null;
  intent_rules_fetched_at: number;
  // collecte passive
  auto_signal: boolean;
  session_signals_count: number;
  session_credits_earned: number;
  // détection courante (affichage popup)
  current_platform: string | null;
  current_component_id: number | null;
  current_component_name: string | null;
  current_price: number | null;
}

export const DEFAULT_STATE: LensState = {
  access_token: null,
  refresh_token: null,
  token_expires_at: null,
  user_email: null,
  user_plan: "free",
  credits_remaining: 0,
  credits_unlimited: false,
  credits_updated_at: 0,
  component_db: [],
  component_db_version: "",
  component_db_updated_at: 0,
  platform_selectors: {},
  selectors_version: {},
  intent_rules: null,
  intent_rules_etag: null,
  intent_rules_version: null,
  intent_rules_fetched_at: 0,
  auto_signal: true,
  session_signals_count: 0,
  session_credits_earned: 0,
  current_platform: null,
  current_component_id: null,
  current_component_name: null,
  current_price: null,
};

export async function getState<K extends keyof LensState>(
  keys: K[],
): Promise<Pick<LensState, K>> {
  const raw = await chrome.storage.local.get(keys as string[]);
  return raw as Pick<LensState, K>;
}

export async function setState(patch: Partial<LensState>): Promise<void> {
  await chrome.storage.local.set(patch);
}

export async function removeKeys(keys: (keyof LensState)[]): Promise<void> {
  await chrome.storage.local.remove(keys as string[]);
}

/** Applique les defaults v2 manquants sans écraser l'existant (onInstalled). */
export async function ensureDefaults(): Promise<void> {
  const existing = await chrome.storage.local.get(null);
  const missing: Partial<LensState> = {};
  for (const key of Object.keys(DEFAULT_STATE) as (keyof LensState)[]) {
    if (!(key in existing)) {
      // assignation sûre : on copie la valeur par défaut typée
      (missing as Record<string, unknown>)[key] = DEFAULT_STATE[key];
    }
  }
  if (Object.keys(missing).length > 0) {
    await chrome.storage.local.set(missing);
  }
}
