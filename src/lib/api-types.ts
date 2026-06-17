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
  currency?: string;
  condition?: string;
  region?: string;
  title?: string;
  listing_intent?: string;
  quantity?: number;
  has_warranty?: boolean;
  has_invoice?: boolean;
  has_original_box?: boolean;
  defects?: string[];
  is_bundle?: boolean;
  bundle_component_ids?: number[];
  signal_type?: string;
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

// ── Watchlist ─────────────────────────────────────────────────────────────────
// (Alertes retirées en LOT A : alert_type / price_threshold supprimés — plus de consommateur.)
export interface TargetRequest {
  target_type: "model" | "ad";
  target_id: number;
}

// GET /v1/watchlist : pas de filtre par cible côté serveur → pagination + cache SW.
export interface WatchItem {
  id: number; // item_id = clé du DELETE /v1/watchlist/{item_id}
  target_type: "model" | "ad";
  target_id: number;
  snapshot_eur?: number | null;
}

export interface WatchlistPage {
  items: WatchItem[];
  total: number;
  limit: number;
  offset: number;
}

// ── Intent rules (GET /v1/config/intent-rules) — filtrage pré-analyse LOT C1 ──
export type IntentGate = "confirm" | "info" | "silent";

export interface IntentRuleFamily {
  slug: string;
  label: string;
  overlay_message: string;
  gate: IntentGate;
  should_signal: boolean;
  source: string;
  priority: number;
  title_patterns: string[];
  desc_patterns: string[];
  negation_patterns: string[];
  negation_window_chars: number;
  veto_patterns: string[];
}

export interface IntentRuleSet {
  version: number;
  updated_at: string;
  normalization: string;
  regex_dialect?: string;
  desc_char_limit: number;
  default_intent: string;
  catch_all_intent: string;
  symbolic_price_thresholds: Record<string, number>;
  symbolic_placeholder_max: number;
  price_aberration_min: number;
  aberration_exempt_keywords: string[];
  vocab: string[];
  families: IntentRuleFamily[];
}

// ── Intent report (POST /v1/lens/intent-report) ──
export type UserAction = "auto_confirmed" | "auto_overridden" | "manual_flag";

export interface IntentReportRequest {
  ad_hash: string; // jamais d'URL brute (hashée SW-side)
  platform: string;
  component_id?: number;
  detected_intent?: string;
  final_intent: string;
  user_action: UserAction;
  matched_flags: string[]; // "<title|desc|price>:<slug>:<extrait≤80>", ≤10
  asking_price?: number;
  rules_version: number;
}

export interface IntentReportResponse {
  status: string;
  id: number;
}

// ── Verdict (POST /v1/lens/verdict) — LOT B1, consommé en B2 ──
export interface VerdictModulation {
  applied: boolean;
  reason: string | null;
  notches_down: number; // crans abaissés par l'endpoint (condition) ; cran confiance = moteur
}

export interface VerdictResponse {
  component_id: number;
  component_name: string | null;
  asking_price: number;
  state: string; // ok | no_data
  verdict: string | null; // BUY | NEGOTIATE | LOWBALL | AVOID (slug canonique)
  verdict_label: string | null; // Foncer | Négocier | Tenter au culot | Passer
  verdict_description: string | null;
  prix_conseille: number | null; // déjà clampé <= asking_price côté backend
  buy_ceiling: number | null;
  optimal_buy: number | null;
  basis: string | null; // margin | percentile
  confidence_state: string; // sufficient | insufficient
  confidence_level: string | null; // high | medium | low
  warnings: string[]; // disclaimer inclus — JAMAIS hardcodé côté extension
  modulation_applied: VerdictModulation;
  credits_charged: number;
  credits_remaining: number;
  cached: boolean;
}

// ── Bundle verdict (POST /v1/lens/bundle) — Phase A backend, consommé en Phase B ──
export interface BundleComponentLine {
  component_id: number;
  component_name: string | null;
  category: string | null;
  status: string; // ok | no_data (reconnu mais sans ancre marché)
  median: number | null;
  fair_value: number | null;
  confidence: number | null;
}

export interface BundleAnalysisBlock {
  sum_individual_fair_values: number | null;
  bundle_discount_pct: number | null;
  bundle_fair_value: number | null;
  total_price: number;
  price_vs_bundle_fair_pct: number | null;
  savings_vs_individual_eur: number | null;
  savings_vs_individual_pct: number | null;
}

export interface BundleResponse {
  ad_hash: string;
  state: string; // ok | insufficient | no_data
  cached: boolean;
  components: BundleComponentLine[];
  bundle_analysis: BundleAnalysisBlock | null;
  unrecognized_categories: string[]; // catégories détectées non valorisées → total = plancher
  verdict: string | null; // BUY | NEGOTIATE | LOWBALL | AVOID (global, sur le total)
  verdict_label: string | null;
  confidence_state: string; // sufficient | insufficient
  warnings: string[]; // disclaimer + plancher inclus — JAMAIS hardcodé côté extension
  credits_charged: number;
  credits_remaining: number;
}
