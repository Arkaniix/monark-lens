// src/lib/constants.ts — constantes partagées (source canonique v2).
// Valeurs reprises littéralement du dist v1 (legacy/v1-dist/chunks/constants-*.js),
// hormis EXTENSION_VERSION aligné sur la version v2 (cf src/manifest.json).
// Aucune logique métier ici — uniquement des constantes et la forme de l'état.

export const API_BASE = "https://api.monark-market.fr/v1";
export const MONARK_WEB_URL = "https://monark-market.fr";
export const EXTENSION_VERSION = "2.0.0";

export const COMPONENT_DB_TTL = 24 * 60 * 60 * 1000;
export const BACKOFF_BASE_MS = 1000;
export const BACKOFF_MAX_MS = 30000;

/** Forme de l'état persisté (chrome.storage.local) — reprise de DEFAULT_STATE v1. */
export interface LensState {
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: number | null;
  user_email: string | null;
  user_plan: string;
  credits_remaining: number;
  credits_unlimited: boolean;
  component_db: unknown[];
  component_db_version: string;
  component_db_updated_at: number;
  platform_selectors: Record<string, unknown>;
  selectors_version: Record<string, unknown>;
  session_signals_count: number;
  session_credits_earned: number;
  overlay_enabled: boolean;
  auto_signal: boolean;
  overlay_position: string;
}

export const DEFAULT_STATE: LensState = {
  access_token: null,
  refresh_token: null,
  token_expires_at: null,
  user_email: null,
  user_plan: "free",
  credits_remaining: 0,
  credits_unlimited: false,
  component_db: [],
  component_db_version: "",
  component_db_updated_at: 0,
  platform_selectors: {},
  selectors_version: {},
  session_signals_count: 0,
  session_credits_earned: 0,
  overlay_enabled: true,
  auto_signal: true,
  overlay_position: "top-right",
};
