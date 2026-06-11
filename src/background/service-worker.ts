// src/background/service-worker.ts — service-worker Monark Lens v2 (port TS strict du v1).
//
// Garanties structurelles :
//  - PROXY STRICT : content/popup ne font jamais de fetch ; tout passe par le SW.
//  - AUCUNE URL brute sur le réseau : les URLs arrivent en messaging interne, le SW les
//    hashe (adhash.ts) et n'envoie que l'ad_hash au backend (snapshot/flag/consensus/signal).
//  - Endpoints v2 UNIQUEMENT : auth/login, auth/refresh, lens/snapshot, signals/ingest,
//    community/flag, community/consensus, config/selectors, config/component-db, users/me,
//    credits/balance, alerts, watchlist. (score/quick/analyze*/missions = NON portés.)

import { API_BASE, BACKOFF_BASE_MS, BACKOFF_MAX_MS, COMPONENT_DB_TTL, EXTENSION_VERSION } from "../lib/constants";
import { canonicalAdHash } from "../lib/adhash";
import { decodeJwtExp, nextBackoff, shouldRefresh } from "../lib/auth-logic";
import { ensureDefaults, getState, setState } from "../lib/storage";
import type {
  AuthTokens,
  CommunityFlagRequest,
  CommunityFlagResponse,
  ComponentDbResponse,
  ConsensusResponse,
  CreditsBalance,
  SelectorsConfigResponse,
  SignalIngestRequest,
  SignalIngestResponse,
  SnapshotResponse,
  TargetRequest,
  UserProfile,
} from "../lib/api-types";
import type {
  AuthState,
  SendSignalMsg,
  SubmitFlagMsg,
  SyncTokensToSiteMsg,
  WorkerMessage,
} from "../lib/messages";

console.log(`[Monark SW] v${EXTENSION_VERSION} started`);

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Machine à tokens (access 15min / refresh 30j ; proactif −60s ; réactif 1× sur 401) ──

async function getStoredTokens(): Promise<{
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: number | null;
}> {
  const d = await getState(["access_token", "refresh_token", "token_expires_at"]);
  return {
    access_token: d.access_token ?? null,
    refresh_token: d.refresh_token ?? null,
    token_expires_at: d.token_expires_at ?? null,
  };
}

async function storeTokens(t: AuthTokens): Promise<void> {
  await setState({
    access_token: t.access_token,
    refresh_token: t.refresh_token,
    token_expires_at: Date.now() + t.expires_in * 1000,
  });
}

// Bridge site→ext : écart v1 ASSUMÉ. v1 posait expires_in:3600 en dur (token cru valide 1h
// alors que l'access vit 15 min -> 401 prématuré). v2 lit le vrai `exp` du JWT, fallback 900s.
async function storeTokensFromSite(access: string, refresh: string | null): Promise<void> {
  const expiresAt = decodeJwtExp(access) ?? Date.now() + 900_000;
  await setState({ access_token: access, refresh_token: refresh ?? "", token_expires_at: expiresAt });
}

async function clearTokens(): Promise<void> {
  await setState({
    access_token: null,
    refresh_token: null,
    token_expires_at: null,
    user_email: null,
    user_plan: "free",
    credits_remaining: 0,
  });
}

async function refreshAccessToken(): Promise<string | null> {
  const { refresh_token } = await getStoredTokens();
  if (!refresh_token) return null;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token }),
    });
    if (!res.ok) {
      if (res.status === 401) await clearTokens();
      return null;
    }
    const tokens = (await res.json()) as AuthTokens;
    await storeTokens(tokens);
    return tokens.access_token;
  } catch {
    return null;
  }
}

async function getValidToken(): Promise<string | null> {
  const { access_token, token_expires_at } = await getStoredTokens();
  if (!access_token) return null;
  if (shouldRefresh(token_expires_at, Date.now())) return refreshAccessToken();
  return access_token;
}

// ── Client HTTP (backoff 429 + refresh réactif 401) ──

async function apiCall(endpoint: string, options: RequestInit = {}, requireAuth = false): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (requireAuth) {
    const token = await getValidToken();
    if (!token) throw new Error("Not authenticated");
    headers["Authorization"] = `Bearer ${token}`;
  }
  let retries = 0;
  while (true) {
    const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
    if (res.status === 429 && retries < 5) {
      await sleep(nextBackoff(retries, BACKOFF_BASE_MS, BACKOFF_MAX_MS));
      retries++;
      continue;
    }
    if (res.status === 401 && requireAuth && retries === 0) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        headers["Authorization"] = `Bearer ${newToken}`;
        retries++;
        continue;
      }
    }
    return res;
  }
}

async function detailError(res: Response, fallback: string): Promise<string> {
  const err = (await res.json().catch(() => ({}))) as { detail?: string };
  return err.detail || fallback;
}

// ── Auth ──

async function login(email: string, password: string): Promise<AuthTokens> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(await detailError(res, `Login failed (${res.status})`));
  const tokens = (await res.json()) as AuthTokens;
  await storeTokens(tokens);
  await setState({ user_email: email });
  return tokens;
}

async function fetchUserProfile(): Promise<UserProfile> {
  const res = await apiCall("/users/me", {}, true);
  if (!res.ok) throw new Error(`User profile fetch failed (${res.status})`);
  const data = (await res.json()) as UserProfile;
  await setState({ user_email: data.email, user_plan: data.role || "free" });
  try {
    const cr = await apiCall("/credits/balance", {}, true);
    if (cr.ok) {
      const c = (await cr.json()) as CreditsBalance;
      const balance = c.balance ?? c.credits ?? 0;
      await setState({ credits_remaining: balance, credits_unlimited: c.unlimited === true });
    }
  } catch {
    /* best-effort */
  }
  return data;
}

// ── Snapshot (cœur v2) — l'URL est hashée ICI, jamais envoyée ──

async function getSnapshot(
  url: string,
  componentId: number,
  askingPrice: number,
  platform: string,
  condition: string | null,
): Promise<SnapshotResponse> {
  const ad_hash = await canonicalAdHash(url);
  const body: Record<string, unknown> = {
    ad_hash,
    component_id: componentId,
    asking_price: askingPrice,
    platform,
  };
  if (condition) body["condition"] = condition;
  const res = await apiCall("/lens/snapshot", { method: "POST", body: JSON.stringify(body) }, true);
  if (!res.ok) {
    // On PROPAGE le status HTTP (comme postTarget) : l'overlay V2-03 distingue 402
    // (crédits épuisés) / 401 (session) / réseau. Sans ça, l'état 402 serait mort.
    const err = new Error(await detailError(res, `Snapshot failed (${res.status})`)) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return (await res.json()) as SnapshotResponse;
}

async function sendSignal(msg: SendSignalMsg): Promise<SignalIngestResponse> {
  const ad_hash = await canonicalAdHash(msg.url);
  const body: SignalIngestRequest = {
    component_id: msg.component_id,
    platform: msg.platform,
    price: msg.price,
    ad_hash,
  };
  if (msg.currency) body.currency = msg.currency;
  if (msg.condition) body.condition = msg.condition;
  if (msg.region) body.region = msg.region;
  if (msg.title) body.title = msg.title;
  if (msg.listing_intent) body.listing_intent = msg.listing_intent;
  if (msg.quantity !== undefined) body.quantity = msg.quantity;
  if (msg.has_warranty !== undefined) body.has_warranty = msg.has_warranty;
  if (msg.has_invoice !== undefined) body.has_invoice = msg.has_invoice;
  if (msg.has_original_box !== undefined) body.has_original_box = msg.has_original_box;
  if (msg.defects) body.defects = msg.defects;
  if (msg.is_bundle !== undefined) body.is_bundle = msg.is_bundle;
  if (msg.bundle_component_ids) body.bundle_component_ids = msg.bundle_component_ids;
  if (msg.signal_type) body.signal_type = msg.signal_type;
  const res = await apiCall("/signals/ingest", { method: "POST", body: JSON.stringify(body) }, true);
  if (!res.ok) throw new Error(`Signal ingest failed (${res.status})`);
  return (await res.json()) as SignalIngestResponse;
}

async function submitFlag(msg: SubmitFlagMsg): Promise<CommunityFlagResponse> {
  const ad_hash = await canonicalAdHash(msg.url);
  const body: CommunityFlagRequest = {
    ad_hash,
    platform: msg.platform,
    component_id: msg.component_id,
    intent_type: msg.intent_type,
  };
  if (msg.source) body.source = msg.source;
  const res = await apiCall("/community/flag", { method: "POST", body: JSON.stringify(body) }, true);
  if (!res.ok) throw new Error(await detailError(res, "Flag submission failed"));
  return (await res.json()) as CommunityFlagResponse;
}

async function getConsensus(url: string, platform: string): Promise<ConsensusResponse> {
  const ad_hash = await canonicalAdHash(url);
  const params = new URLSearchParams({ ad_hash, platform });
  const res = await apiCall(`/community/consensus?${params.toString()}`, {}, true);
  if (!res.ok) return { consensus_intent: null, total_voters: 0, has_consensus: false };
  return (await res.json()) as ConsensusResponse;
}

async function postTarget(endpoint: string, payload: TargetRequest, failMsg: string): Promise<unknown> {
  try {
    const res = await apiCall(endpoint, { method: "POST", body: JSON.stringify(payload) }, true);
    if (!res.ok) return { error: await detailError(res, failMsg), status: res.status };
    return await res.json();
  } catch (err) {
    return { error: err instanceof Error ? err.message : failMsg };
  }
}

// ── Config refresh (selectors + component DB, TTL 24h) ──

async function getSelectors(): Promise<SelectorsConfigResponse> {
  const res = await apiCall("/config/selectors");
  if (!res.ok) throw new Error(`Selectors fetch failed (${res.status})`);
  return (await res.json()) as SelectorsConfigResponse;
}

async function getComponentDb(): Promise<ComponentDbResponse> {
  const res = await apiCall("/config/component-db");
  if (!res.ok) throw new Error(`Component DB fetch failed (${res.status})`);
  return (await res.json()) as ComponentDbResponse;
}

async function refreshComponentDb(): Promise<void> {
  try {
    const db = await getComponentDb();
    await setState({
      component_db: db.components,
      component_db_version: db.version,
      component_db_updated_at: Date.now(),
    });
    console.log(`[Monark SW] Component DB refreshed: ${db.components.length} (v${db.version})`);
  } catch (err) {
    console.error("[Monark SW] Component DB refresh failed:", err);
  }
}

async function refreshSelectors(): Promise<void> {
  try {
    const cfg = await getSelectors();
    const versions: Record<string, number> = {};
    for (const [platform, entry] of Object.entries(cfg.platforms)) versions[platform] = entry.version;
    await setState({ platform_selectors: cfg.platforms, selectors_version: versions });
    console.log("[Monark SW] Selectors refreshed");
  } catch (err) {
    console.error("[Monark SW] Selectors refresh failed:", err);
  }
}

// ── Lifecycle ──

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "update") {
    // Purge le cache d'intention (clé content hors LensState) + force un refresh DB composants.
    await chrome.storage.local.remove([
      "monark_intent_decisions",
      "component_db",
      "component_db_version",
      "component_db_updated_at",
    ]);
  }
  await ensureDefaults();
  void refreshComponentDb();
  void refreshSelectors();
});

chrome.alarms.create("refresh-data", { periodInMinutes: 60 });
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "refresh-data") return;
  const { component_db_updated_at } = await getState(["component_db_updated_at"]);
  if (!component_db_updated_at || Date.now() - component_db_updated_at > COMPONENT_DB_TTL) {
    void refreshComponentDb();
  }
  void refreshSelectors();
});

// ── Bridge auth SW -> onglets monark-market.fr ──

async function broadcastAuthToSiteTabs(): Promise<void> {
  try {
    const t = await getStoredTokens();
    const { user_email } = await getState(["user_email"]);
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id && tab.url?.includes("monark-market.fr")) {
        const msg: SyncTokensToSiteMsg = {
          action: "SYNC_TOKENS_TO_SITE",
          access_token: t.access_token,
          refresh_token: t.refresh_token,
          email: user_email ?? null,
        };
        chrome.tabs.sendMessage(tab.id, msg).catch(() => {});
      }
    }
  } catch {
    /* aucun onglet site ouvert */
  }
}

// ── Badge + état auth ──

function updateBadge(credits: number): void {
  chrome.action.setBadgeText({ text: `+${credits}` });
  chrome.action.setBadgeBackgroundColor({ color: "#10b981" });
  setTimeout(() => {
    chrome.action.setBadgeText({ text: "" });
  }, 3000);
}

async function getAuthState(): Promise<AuthState> {
  const token = await getValidToken();
  const d = await getState([
    "user_email",
    "user_plan",
    "credits_remaining",
    "credits_unlimited",
    "session_signals_count",
    "session_credits_earned",
  ]);
  return {
    isLoggedIn: !!token,
    email: d.user_email ?? null,
    plan: d.user_plan || "free",
    credits: d.credits_remaining || 0,
    unlimited: d.credits_unlimited === true,
    sessionSignals: d.session_signals_count || 0,
    sessionCredits: d.session_credits_earned || 0,
  };
}

// ── Handler unique typé (exhaustivité vérifiée par le compilateur) ──

chrome.runtime.onMessage.addListener((message: WorkerMessage, _sender, sendResponse) => {
  handleMessage(message)
    .then(sendResponse)
    .catch((err: unknown) => sendResponse({ error: err instanceof Error ? err.message : String(err) }));
  return true; // canal asynchrone gardé ouvert
});

async function handleMessage(msg: WorkerMessage): Promise<unknown> {
  switch (msg.type) {
    case "GET_AUTH_STATE":
      return getAuthState();

    case "LOGIN":
      try {
        await login(msg.email, msg.password);
        try {
          await fetchUserProfile();
        } catch {
          /* best-effort */
        }
        await broadcastAuthToSiteTabs();
        return getAuthState();
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) };
      }

    case "LOGOUT":
      await clearTokens();
      await setState({ session_signals_count: 0, session_credits_earned: 0 });
      await broadcastAuthToSiteTabs();
      return { success: true };

    case "SYNC_TOKENS_FROM_SITE":
      if (msg.access_token) {
        await storeTokensFromSite(msg.access_token, msg.refresh_token);
        if (msg.email) await setState({ user_email: msg.email });
        try {
          await fetchUserProfile();
        } catch {
          /* best-effort */
        }
      } else {
        await clearTokens();
        await setState({ session_signals_count: 0, session_credits_earned: 0 });
      }
      return { success: true };

    case "FETCH_USER_PROFILE":
      try {
        return await fetchUserProfile();
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) };
      }

    case "GET_STORED_TOKENS":
      return getStoredTokens();

    case "GET_SNAPSHOT": {
      try {
        const result = await getSnapshot(msg.url, msg.component_id, msg.asking_price, msg.platform, msg.condition ?? null);
        await setState({ credits_remaining: result.credits_remaining });
        return result;
      } catch (err) {
        const status = (err as { status?: number }).status;
        const error = err instanceof Error ? err.message : String(err);
        return status === undefined ? { error } : { error, status };
      }
    }

    case "SEND_SIGNAL": {
      const result = await sendSignal(msg);
      const s = await getState(["session_signals_count", "session_credits_earned"]);
      await setState({
        session_signals_count: (s.session_signals_count || 0) + 1,
        session_credits_earned: (s.session_credits_earned || 0) + result.credits_earned,
        credits_remaining: result.credits_remaining,
      });
      if (result.credits_earned > 0) updateBadge(result.credits_earned);
      return result;
    }

    case "GET_COMPONENT_DB": {
      const { component_db, component_db_updated_at } = await getState(["component_db", "component_db_updated_at"]);
      if (!component_db?.length || Date.now() - (component_db_updated_at || 0) > COMPONENT_DB_TTL) {
        await refreshComponentDb();
        const fresh = await getState(["component_db"]);
        return fresh.component_db || [];
      }
      return component_db;
    }

    case "UPDATE_CREDITS":
      await setState({ credits_remaining: msg.credits });
      return { success: true };

    case "DETECTION_STATUS":
      await setState({
        current_platform: msg.platform,
        current_component_id: msg.componentId,
        current_component_name: msg.componentName,
        current_price: msg.price,
      });
      return { success: true };

    case "SUBMIT_FLAG":
      try {
        return await submitFlag(msg);
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) };
      }

    case "CREATE_ALERT":
      return postTarget("/alerts", msg.payload, "Alert creation failed");

    case "ADD_WATCHLIST":
      return postTarget("/watchlist", msg.payload, "Watchlist add failed");

    case "GET_CONSENSUS":
      try {
        return await getConsensus(msg.url, msg.platform);
      } catch {
        return { consensus_intent: null, total_voters: 0, has_consensus: false };
      }

    default: {
      const _exhaustive: never = msg; // exhaustivité vérifiée à la compilation
      void _exhaustive;
      return { error: "Unknown message type" };
    }
  }
}
