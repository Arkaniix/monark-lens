import { A as API_BASE, B as BACKOFF_BASE_MS, a as BACKOFF_MAX_MS, D as DEFAULT_STATE, C as COMPONENT_DB_TTL } from '../chunks/constants-DrhZHtLE.js';

async function getStoredTokens() {
  const data = await chrome.storage.local.get([
    "access_token",
    "refresh_token",
    "token_expires_at"
  ]);
  return {
    access_token: data.access_token ?? null,
    refresh_token: data.refresh_token ?? null,
    token_expires_at: data.token_expires_at ?? null
  };
}
async function storeTokens(tokens) {
  await chrome.storage.local.set({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    token_expires_at: Date.now() + tokens.expires_in * 1e3
  });
}
async function clearTokens() {
  await chrome.storage.local.set({
    access_token: null,
    refresh_token: null,
    token_expires_at: null,
    user_email: null,
    user_plan: "free",
    credits_remaining: 0
  });
}
async function refreshAccessToken() {
  const { refresh_token } = await getStoredTokens();
  if (!refresh_token) return null;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token })
    });
    if (!res.ok) {
      if (res.status === 401) {
        await clearTokens();
      }
      return null;
    }
    const tokens = await res.json();
    await storeTokens(tokens);
    return tokens.access_token;
  } catch {
    return null;
  }
}
async function getValidToken() {
  const { access_token, token_expires_at } = await getStoredTokens();
  if (!access_token) return null;
  if (token_expires_at && Date.now() > token_expires_at - 6e4) {
    return refreshAccessToken();
  }
  return access_token;
}
// ── Hash SHA-256 pour anonymiser les URLs ──
async function sha256(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function apiCall(endpoint, options = {}, requireAuth = false) {
  const headers = {
    "Content-Type": "application/json",
    ...options.headers
  };
  if (requireAuth) {
    const token = await getValidToken();
    if (!token) throw new Error("Not authenticated");
    headers["Authorization"] = `Bearer ${token}`;
  }
  let retries = 0;
  while (true) {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    });
    if (res.status === 429 && retries < 5) {
      const backoff = Math.min(
        BACKOFF_BASE_MS * Math.pow(2, retries),
        BACKOFF_MAX_MS
      );
      await new Promise((r) => setTimeout(r, backoff));
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
async function login(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.detail || `Login failed (${res.status})`);
  }
  const tokens = await res.json();
  await storeTokens(tokens);
  await chrome.storage.local.set({ user_email: email });
  return tokens;
}
async function logout() {
  await clearTokens();
}
async function getScore(componentId, price) {
  const res = await apiCall(
    `/lens/score?component_id=${componentId}&price=${price}`
  );
  if (!res.ok) throw new Error(`Score request failed (${res.status})`);
  return res.json();
}
async function getQuickAnalysis(params) {
  const searchParams = new URLSearchParams({
    component_id: String(params.componentId),
    price: String(params.price)
  });
  if (params.condition) searchParams.set("condition", params.condition);
  if (params.has_warranty !== void 0)
    searchParams.set("has_warranty", String(params.has_warranty));
  if (params.has_invoice !== void 0)
    searchParams.set("has_invoice", String(params.has_invoice));
  if (params.defects) searchParams.set("defects", params.defects);
  const res = await apiCall(
    `/lens/quick?${searchParams.toString()}`,
    {},
    true
  );
  if (!res.ok) throw new Error(`Quick analysis failed (${res.status})`);
  return res.json();
}
async function sendSignal(payload) {
  const res = await apiCall(
    "/signals/ingest",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    true
  );
  if (!res.ok) throw new Error(`Signal ingest failed (${res.status})`);
  return res.json();
}
async function getSelectors() {
  const res = await apiCall("/config/selectors");
  if (!res.ok) throw new Error(`Selectors fetch failed (${res.status})`);
  return res.json();
}
async function getComponentDb() {
  const res = await apiCall("/config/component-db");
  if (!res.ok) throw new Error(`Component DB fetch failed (${res.status})`);
  return res.json();
}
async function getMissions() {
  const res = await apiCall("/missions/active", {}, true);
  if (!res.ok) throw new Error(`Missions fetch failed (${res.status})`);
  return res.json();
}
async function submitFlag(payload) {
  const res = await apiCall("/community/flag", {
    method: "POST",
    body: JSON.stringify(payload)
  }, true);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Flag submission failed");
  }
  return res.json();
}
async function getConsensus(listingUrl, platform) {
  const params = new URLSearchParams({ listing_url: listingUrl, platform });
  const res = await apiCall(`/community/consensus?${params}`, {}, true);
  if (!res.ok) {
    return { consensus_intent: null, total_voters: 0, has_consensus: false };
  }
  return res.json();
}
async function fetchUserProfile() {
  const res = await apiCall("/users/me", {}, true);
  if (!res.ok) throw new Error(`User profile fetch failed (${res.status})`);
  const data = await res.json();
  await chrome.storage.local.set({
    user_email: data.email,
    user_plan: data.role || "free"
  });
  try {
    const creditsRes = await apiCall("/credits/balance", {}, true);
    if (creditsRes.ok) {
      const creditsData = await creditsRes.json();
      const balance = creditsData.balance ?? creditsData.credits ?? 0;
      const unlimited = creditsData.unlimited === true;
      await chrome.storage.local.set({
        credits_remaining: balance,
        credits_unlimited: unlimited
      });
    }
  } catch {
  }
  return data;
}
async function getStoredTokensExport() {
  return getStoredTokens();
}

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "update") {
    console.log("[Monark SW] Extension updated, clearing decision cache");
    await chrome.storage.local.remove(["monark_intent_decisions"]);
    // Purger aussi le component DB pour forcer un refresh
    await chrome.storage.local.remove(["component_db", "component_db_version", "component_db_updated_at"]);
  }
  if (details.reason === "install") {
    console.log("[Monark SW] Extension installed");
  }
  const existing = await chrome.storage.local.get(null);
  const defaults = {};
  for (const [key, value] of Object.entries(DEFAULT_STATE)) {
    if (!(key in existing)) {
      defaults[key] = value;
    }
  }
  if (Object.keys(defaults).length > 0) {
    await chrome.storage.local.set(defaults);
  }
  refreshComponentDb();
  refreshSelectors();
});
chrome.alarms.create("refresh-data", { periodInMinutes: 60 });
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "refresh-data") {
    const { component_db_updated_at } = await chrome.storage.local.get(
      "component_db_updated_at"
    );
    if (!component_db_updated_at || Date.now() - component_db_updated_at > COMPONENT_DB_TTL) {
      refreshComponentDb();
    }
    refreshSelectors();
  }
});
async function refreshComponentDb() {
  try {
    const db = await getComponentDb();
    await chrome.storage.local.set({
      component_db: db.components,
      component_db_version: db.version,
      component_db_updated_at: Date.now()
    });
    console.log(
      `[Monark] Component DB refreshed: ${db.components.length} components (v${db.version})`
    );
  } catch (err) {
    console.error("[Monark] Failed to refresh component DB:", err);
  }
}
async function refreshSelectors() {
  try {
    const config = await getSelectors();
    const versions = {};
    for (const [platform, data] of Object.entries(config.platforms)) {
      versions[platform] = data.version;
    }
    await chrome.storage.local.set({
      platform_selectors: config.platforms,
      selectors_version: versions
    });
    console.log("[Monark] Selectors refreshed");
  } catch (err) {
    console.error("[Monark] Failed to refresh selectors:", err);
  }
}
const scoreCache = /* @__PURE__ */ new Map();
const SCORE_CACHE_TTL = 15 * 60 * 1e3;
function getCachedScore(componentId, price) {
  const key = `${componentId}:${price}`;
  const cached = scoreCache.get(key);
  if (cached && Date.now() - cached.ts < SCORE_CACHE_TTL) {
    return cached.data;
  }
  scoreCache.delete(key);
  return null;
}
function setCachedScore(componentId, price, data) {
  scoreCache.set(`${componentId}:${price}`, { data, ts: Date.now() });
}
chrome.runtime.onMessage.addListener(
  (message, _sender, sendResponse) => {
    handleMessage(message).then(sendResponse).catch((err) => sendResponse({ error: err.message }));
    return true;
  }
);
async function handleMessage(message) {
  switch (message.type) {
    case "GET_AUTH_STATE":
      return getAuthState();
    case "LOGIN":
      try {
        await login(message.email, message.password);
        try {
          await fetchUserProfile();
        } catch {
        }
        await broadcastAuthToSiteTabs();
        return getAuthState();
      } catch (err) {
        return { error: err.message };
      }
    case "LOGOUT":
      await logout();
      await chrome.storage.local.set({
        session_signals_count: 0,
        session_credits_earned: 0
      });
      await broadcastAuthToSiteTabs();
      return { success: true };
    case "SYNC_TOKENS_FROM_SITE": {
      if (message.access_token) {
        await storeTokens({
          access_token: message.access_token,
          refresh_token: message.refresh_token || "",
          expires_in: 3600
        });
        if (message.email) {
          await chrome.storage.local.set({ user_email: message.email });
        }
        try {
          await fetchUserProfile();
        } catch {
        }
      } else {
        await clearTokens();
        await chrome.storage.local.set({
          session_signals_count: 0,
          session_credits_earned: 0
        });
      }
      return { success: true };
    }
    case "FETCH_USER_PROFILE": {
      try {
        const profile = await fetchUserProfile();
        return profile;
      } catch (err) {
        return { error: err.message };
      }
    }
    case "GET_STORED_TOKENS": {
      const tokens = await getStoredTokensExport();
      return tokens;
    }
    case "GET_SCORE": {
      const cached = getCachedScore(message.componentId, message.price);
      if (cached) return cached;
      const score = await getScore(message.componentId, message.price);
      setCachedScore(message.componentId, message.price, score);
      return score;
    }
    case "GET_QUICK": {
      const result = await getQuickAnalysis({
        componentId: message.componentId,
        price: message.price,
        condition: message.condition,
        has_warranty: message.has_warranty,
        has_invoice: message.has_invoice,
        defects: message.defects
      });
      await chrome.storage.local.set({
        credits_remaining: result.credits_remaining
      });
      return result;
    }
    case "SEND_SIGNAL": {
      const result = await sendSignal(message.payload);
      const state = await chrome.storage.local.get([
        "session_signals_count",
        "session_credits_earned"
      ]);
      await chrome.storage.local.set({
        session_signals_count: (state.session_signals_count || 0) + 1,
        session_credits_earned: (state.session_credits_earned || 0) + result.credits_earned,
        credits_remaining: result.credits_remaining
      });
      if (result.credits_earned > 0) {
        updateBadge(result.credits_earned);
      }
      return result;
    }
    case "GET_COMPONENT_DB": {
      const { component_db, component_db_version, component_db_updated_at } = await chrome.storage.local.get([
        "component_db",
        "component_db_version",
        "component_db_updated_at"
      ]);
      if (!component_db?.length || Date.now() - (component_db_updated_at || 0) > COMPONENT_DB_TTL) {
        await refreshComponentDb();
        const fresh = await chrome.storage.local.get(["component_db"]);
        return fresh.component_db || [];
      }
      return component_db;
    }
    case "GET_MISSIONS":
      return getMissions();
    case "UPDATE_CREDITS":
      await chrome.storage.local.set({
        credits_remaining: message.credits
      });
      return { success: true };
    case "DETECTION_STATUS":
      await chrome.storage.local.set({
        current_platform: message.platform,
        current_component_id: message.componentId,
        current_component_name: message.componentName,
        current_price: message.price
      });
      return { success: true };
    case "SUBMIT_FLAG": {
      try {
        const result = await submitFlag(message.payload);
        return result;
      } catch (err) {
        return { error: err.message };
      }
    }
    case "CREATE_ALERT": {
      try {
        const res = await apiCall("/alerts", {
          method: "POST",
          body: JSON.stringify(message.payload),
        }, true);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          return { error: err.detail || "Alert creation failed", status: res.status };
        }
        return await res.json();
      } catch (err) {
        return { error: err.message || "Alert creation failed" };
      }
    }
    case "ADD_WATCHLIST": {
      try {
        const res = await apiCall("/watchlist", {
          method: "POST",
          body: JSON.stringify(message.payload),
        }, true);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          return { error: err.detail || "Watchlist add failed", status: res.status };
        }
        return await res.json();
      } catch (err) {
        return { error: err.message || "Watchlist add failed" };
      }
    }
    case "GET_CONSENSUS": {
      try {
        const result = await getConsensus(message.listingUrl, message.platform);
        return result;
      } catch {
        return { consensus_intent: null, total_voters: 0, has_consensus: false };
      }
    }
    case "ANALYZE_BUNDLE": {
      try {
        const res = await apiCall("/lens/analyze-bundle", {
          method: "POST",
          body: JSON.stringify(message.payload),
        }, true);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          return { error: err.detail || "Bundle analysis failed" };
        }
        return res.json();
      } catch (err) {
        return { error: err.message || "Bundle analysis failed" };
      }
    }
    case "ANALYZE_LISTING": {
      try {
        // Hash l'URL côté client — le backend ne voit jamais l'URL
        const adHash = await sha256(message.payload.url);

        // Construire le body sans l'URL
        const body = { ...message.payload, ad_hash: adHash };
        delete body.url; // Sécurité : ne JAMAIS envoyer l'URL

        const res = await apiCall("/lens/analyze", {
          method: "POST",
          body: JSON.stringify(body),
        }, true);

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          return { error: err.detail || `Analysis failed (${res.status})`, status: res.status };
        }

        const result = await res.json();

        // Mettre à jour les crédits locaux
        if (result.credits_remaining !== undefined && result.credits_remaining !== null) {
          await chrome.storage.local.set({ credits_remaining: result.credits_remaining });
        }

        // Mettre à jour le compteur de session
        const sessionData = await chrome.storage.local.get(["session_signals_count"]);
        await chrome.storage.local.set({
          session_signals_count: (sessionData.session_signals_count || 0) + 1
        });

        return result;
      } catch (err) {
        console.error("[Monark SW] ANALYZE_LISTING error:", err);
        return { error: err.message || "Analysis failed" };
      }
    }
    case "DEEP_ANALYZE": {
      try {
        // message.payload = { ad_hash, analysis_level }
        const res = await apiCall("/lens/analyze/deep", {
          method: "POST",
          body: JSON.stringify(message.payload),
        }, true);

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          return { error: err.detail || `Deep analysis failed (${res.status})`, status: res.status };
        }

        const result = await res.json();

        // Mettre à jour les crédits locaux
        if (result.credits_remaining !== undefined && result.credits_remaining !== null) {
          await chrome.storage.local.set({ credits_remaining: result.credits_remaining });
        }

        return result;
      } catch (err) {
        console.error("[Monark SW] DEEP_ANALYZE error:", err);
        return { error: err.message || "Deep analysis failed" };
      }
    }
    default:
      return { error: "Unknown message type" };
  }
}
async function getAuthState() {
  const token = await getValidToken();
  const data = await chrome.storage.local.get([
    "user_email",
    "user_plan",
    "credits_remaining",
    "credits_unlimited",
    "session_signals_count",
    "session_credits_earned"
  ]);
  return {
    isLoggedIn: !!token,
    email: data.user_email || null,
    plan: data.user_plan || "free",
    credits: data.credits_remaining || 0,
    unlimited: data.credits_unlimited === true,
    sessionSignals: data.session_signals_count || 0,
    sessionCredits: data.session_credits_earned || 0
  };
}
function updateBadge(credits) {
  chrome.action.setBadgeText({ text: `+${credits}` });
  chrome.action.setBadgeBackgroundColor({ color: "#10b981" });
  setTimeout(() => {
    chrome.action.setBadgeText({ text: "" });
  }, 3e3);
}
async function broadcastAuthToSiteTabs() {
  try {
    const tokens = await getStoredTokensExport();
    const { user_email } = await chrome.storage.local.get(["user_email"]);
    const tabs = await chrome.tabs.query({});
    const siteTabs = tabs.filter(
      (t) => t.url?.includes("monark-market.fr")
    );
    for (const tab of siteTabs) {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, {
          action: "SYNC_TOKENS_TO_SITE",
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          email: user_email || null
        }).catch(() => {
        });
      }
    }
  } catch {
  }
}
