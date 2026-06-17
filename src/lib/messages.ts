// src/lib/messages.ts — protocole de messages typé content/popup ↔ service-worker.
// Union discriminée sur `type` ; l'exhaustivité du handler SW est vérifiée par le
// compilateur (assertNever). PROXY STRICT : content/popup ne font jamais de fetch ;
// toute la logique réseau (et le hash d'URL) vit dans le SW.
//
// Convention hash : les messages qui ciblent un endpoint adressé par ad_hash
// (snapshot / flag / consensus / signal) transportent l'URL BRUTE en interne ;
// le SW la hashe via adhash.ts et ne laisse JAMAIS l'URL partir sur le réseau.

import type { TargetRequest } from "./api-types";

export interface GetAuthStateMsg {
  type: "GET_AUTH_STATE";
}
export interface LoginMsg {
  type: "LOGIN";
  email: string;
  password: string;
}
export interface LogoutMsg {
  type: "LOGOUT";
}
export interface SyncTokensFromSiteMsg {
  type: "SYNC_TOKENS_FROM_SITE";
  access_token: string; // "" => logout
  refresh_token: string | null;
  email?: string;
}
export interface FetchUserProfileMsg {
  type: "FETCH_USER_PROFILE";
}
export interface GetStoredTokensMsg {
  type: "GET_STORED_TOKENS";
}
export interface GetSnapshotMsg {
  type: "GET_SNAPSHOT";
  url: string; // hashée dans le SW
  component_id: number;
  asking_price: number;
  platform: string;
  condition?: string | null;
  title?: string; // titre live → override VRAM serveur (2C) ; backend in-request only, jamais persisté
}
export interface SendSignalMsg {
  type: "SEND_SIGNAL";
  url: string; // hashée dans le SW -> ad_hash ; aucune URL sur le réseau
  component_id: number;
  platform: string;
  price: number;
  currency?: string;
  condition?: string | null;
  region?: string | null;
  title?: string;
  listing_intent?: string;
  quantity?: number;
  has_warranty?: boolean;
  has_invoice?: boolean;
  has_original_box?: boolean;
  defects?: string[] | null;
  is_bundle?: boolean;
  bundle_component_ids?: number[] | null;
  signal_type?: string;
}
export interface GetComponentDbMsg {
  type: "GET_COMPONENT_DB";
}
export interface UpdateCreditsMsg {
  type: "UPDATE_CREDITS";
  credits: number;
}
export interface DetectionStatusMsg {
  type: "DETECTION_STATUS";
  platform: string | null;
  componentId: number | null;
  componentName: string | null;
  price: number | null;
}
export interface AddWatchlistMsg {
  type: "ADD_WATCHLIST";
  payload: TargetRequest;
}
export interface RemoveWatchlistMsg {
  type: "REMOVE_WATCHLIST";
  target_id: number; // composant (target_type=model) ; le SW résout l'item_id via son cache
}
export interface CheckWatchlistMsg {
  type: "CHECK_WATCHLIST";
  target_id: number; // appartenance d'UN composant (pas de filtre serveur → cache SW paginé)
}
export interface ListWatchlistMsg {
  type: "LIST_WATCHLIST";
}
export interface RefreshBalanceMsg {
  type: "REFRESH_BALANCE"; // GET /credits/balance via le SW (proxy strict) → met à jour le cache
}
// ── Filtrage pré-analyse (C2) ──
export interface GetIntentRulesMsg {
  type: "GET_INTENT_RULES"; // renvoie le rule set caché (SW), refresh si absent/périmé
}
export interface GetVerdictMsg {
  type: "GET_VERDICT"; // -> POST /v1/lens/verdict (l'URL est hashée -> ad_hash SW-side)
  url: string;
  component_id: number;
  asking_price: number;
  platform: string;
  condition?: string;
  listing_age_days?: number;
  title?: string; // titre live → override VRAM serveur (2C) ; backend in-request only, jamais persisté
}
export interface GetBundleMsg {
  type: "GET_BUNDLE"; // -> POST /v1/lens/bundle (l'URL est hashée -> ad_hash SW-side). Le serveur
  // RÉSOUT les composants depuis title+description → PAS de component_id ici. total_price = prix du LOT.
  url: string;
  total_price: number;
  platform: string;
  condition?: string;
  listing_age_days?: number;
  title?: string; // titre live ; in-request only, jamais persisté ni loggé (L.341-1)
  description?: string; // description live (compo du lot) ; in-request only, jamais persistée ni loggée (L.341-1)
}
export interface ReportIntentMsg {
  type: "REPORT_INTENT"; // -> POST /v1/lens/intent-report (l'URL est hashée -> ad_hash SW-side)
  url: string;
  platform: string;
  component_id: number | null;
  detected_intent: string | null;
  final_intent: string;
  user_action: "auto_confirmed" | "auto_overridden" | "manual_flag";
  matched_flags: string[];
  asking_price: number | null;
  rules_version: number;
}

export type WorkerMessage =
  | GetAuthStateMsg
  | LoginMsg
  | LogoutMsg
  | SyncTokensFromSiteMsg
  | FetchUserProfileMsg
  | GetStoredTokensMsg
  | GetSnapshotMsg
  | SendSignalMsg
  | GetComponentDbMsg
  | UpdateCreditsMsg
  | DetectionStatusMsg
  | AddWatchlistMsg
  | RemoveWatchlistMsg
  | CheckWatchlistMsg
  | ListWatchlistMsg
  | RefreshBalanceMsg
  | GetIntentRulesMsg
  | ReportIntentMsg
  | GetVerdictMsg
  | GetBundleMsg;

// SW -> content (sur les onglets monark-market.fr) : note `action`, pas `type`.
export interface SyncTokensToSiteMsg {
  action: "SYNC_TOKENS_TO_SITE";
  // (LOT D) raison EXPLICITE de l'émission : le SW sait pourquoi (rotate=rotation silencieuse,
  // login/logout=bascule d'état). Le content discrimine via reason, jamais par inférence.
  reason: "rotate" | "login" | "logout";
  access_token: string | null;
  refresh_token: string | null;
  email: string | null;
}

// SW -> content : demande de lecture du localStorage du site (guérison 401, LOT D §5).
// Le content répond { access_token, refresh_token }.
export interface GetSiteTokensMsg {
  action: "GET_SITE_TOKENS";
}

export interface SiteTokens {
  access_token: string | null;
  refresh_token: string | null;
}

export interface AuthState {
  isLoggedIn: boolean;
  email: string | null;
  plan: string;
  credits: number;
  unlimited: boolean;
  sessionSignals: number;
  sessionCredits: number;
}
