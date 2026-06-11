// src/lib/api-types.ts — interfaces littérales du contrat backend monark_api (d76be8c).
// Source de vérité : schémas Pydantic monark_api + cartographie LENS-BACK-01.

// ── Auth ───────────────────────────────────────────────────────────────────
export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type?: string;
  expires_in: number; // secondes (access = 900 / 15 min côté API)
}

export interface UserProfile {
  email: string;
  role: string; // free | standard | pro | elite | admin ...
}

export interface CreditsBalance {
  balance?: number;
  credits?: number;
  unlimited?: boolean;
}

// ── Snapshot (POST /v1/lens/snapshot) — CONTRAT LITTÉRAL ─────────────────────
export type SnapshotState = "reliable" | "insufficient" | "no_data";

export interface SnapshotRange {
  p10: number | null;
  p25: number | null;
  p75: number | null; // pas de p50 (le central = market_median, médiane VENDUE)
  p90: number | null;
}

export interface SnapshotResponse {
  ad_hash: string;
  cached: boolean;
  cache_expires_at: string | null;
  component_id: number;
  component_name: string | null;
  category: string | null;
  asking_price: number;
  state: SnapshotState;
  market_median: number | null; // ancre VENDUE confirmée — jamais 0 par défaut
  volume_30d: number; // sold_count_30d
  volume_90d: number; // sold_count_90d (le gate <3)
  trend_30d_pct: number | null;
  asking_range: SnapshotRange | null; // pool ASKING (distinct du market_median)
  verdict: string | null;
  verdict_label: string | null;
  gap_percent: number | null; // ABSOLU
  gap_direction: "under" | "over" | null;
  data_quality: string | null;
  reference_source: string | null;
  last_updated: string | null;
  credits_charged: number; // 1 (miss+ancre) / 0 (hit OU insufficient/no_data)
  credits_remaining: number;
}

// ── Signals (POST /v1/signals/ingest) ────────────────────────────────────────
export interface SignalIngestRequest {
  component_id: number;
  platform: string;
  price: number;
  ad_hash: string;
  condition?: string;
  region?: string;
  listing_intent?: string;
  is_bundle?: boolean;
  bundle_component_ids?: number[];
}

export interface SignalIngestResponse {
  status: string;
  listing_intent?: string;
  is_usable?: boolean;
  credits_earned: number;
  credits_remaining: number;
}

// ── Community (flag / consensus) ─────────────────────────────────────────────
export interface CommunityFlagRequest {
  ad_hash: string; // jamais d'URL brute
  platform: string;
  component_id: number;
  intent_type: string;
  source?: string;
}

export interface CommunityFlagResponse {
  status: string;
  message?: string | null;
  consensus?: ConsensusResponse | null;
  credits_earned: number;
}

export interface ConsensusResponse {
  listing_hash?: string;
  consensus_intent: string | null;
  confidence?: number;
  total_voters: number;
  has_consensus: boolean;
  your_vote?: string | null;
  votes?: Record<string, number> | null;
}

// ── Config (selectors / component-db) ────────────────────────────────────────
export interface PlatformSelectorEntry {
  selectors: Record<string, string>;
  version: number;
}

export interface SelectorsConfigResponse {
  platforms: Record<string, PlatformSelectorEntry>;
}

export interface ComponentDbEntry {
  id: number;
  name: string;
  category?: string;
  brand?: string;
  aliases?: string[];
}

export interface ComponentDbResponse {
  components: ComponentDbEntry[];
  version: string;
}

// ── Alerts / Watchlist ───────────────────────────────────────────────────────
export interface TargetRequest {
  target_type: "model" | "ad";
  target_id: number;
  alert_type?: string;
}
