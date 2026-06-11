const API_BASE = "https://api.monark-market.fr/v1";
const MONARK_WEB_URL = "https://monark-market.fr";
const EXTENSION_VERSION = "1.7.39";
const COMPONENT_DB_TTL = 24 * 60 * 60 * 1e3;
const BACKOFF_BASE_MS = 1e3;
const BACKOFF_MAX_MS = 3e4;
const DEFAULT_STATE = {
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
  overlay_position: "top-right"
};

export { API_BASE as A, BACKOFF_BASE_MS as B, COMPONENT_DB_TTL as C, DEFAULT_STATE as D, EXTENSION_VERSION as E, MONARK_WEB_URL as M, BACKOFF_MAX_MS as a };
