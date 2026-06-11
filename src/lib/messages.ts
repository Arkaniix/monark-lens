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
}
export interface SendSignalMsg {
  type: "SEND_SIGNAL";
  url: string; // hashée dans le SW -> ad_hash
  component_id: number;
  platform: string;
  price: number;
  condition?: string;
  region?: string;
  listing_intent?: string;
  is_bundle?: boolean;
  bundle_component_ids?: number[];
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
  platform: string;
  componentId: number;
  componentName: string;
  price: number;
}
export interface SubmitFlagMsg {
  type: "SUBMIT_FLAG";
  url: string; // hashée dans le SW -> ad_hash
  platform: string;
  component_id: number;
  intent_type: string;
  source?: string;
}
export interface CreateAlertMsg {
  type: "CREATE_ALERT";
  payload: TargetRequest;
}
export interface AddWatchlistMsg {
  type: "ADD_WATCHLIST";
  payload: TargetRequest;
}
export interface GetConsensusMsg {
  type: "GET_CONSENSUS";
  url: string; // hashée dans le SW -> ad_hash
  platform: string;
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
  | SubmitFlagMsg
  | CreateAlertMsg
  | AddWatchlistMsg
  | GetConsensusMsg;

// SW -> content (sur les onglets monark-market.fr) : note `action`, pas `type`.
export interface SyncTokensToSiteMsg {
  action: "SYNC_TOKENS_TO_SITE";
  access_token: string | null;
  refresh_token: string | null;
  email: string | null;
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
