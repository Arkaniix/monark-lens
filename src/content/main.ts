// src/content/main.ts — content script v2. Deux rôles, chacun gardé :
//   (A) BRIDGE AUTH sur monark-market.fr (V2-01, inchangé).
//   (B) CERVEAU MARKETPLACE (V2-02) sur LBC/eBay/Vinted : detect → parse → match → classify →
//       DETECTION_STATUS + collecte passive. AUCUNE UI marketplace (overlay/bouton = V2-03).
// Invariant MV3 : script CLASSIQUE auto-suffisant → uniquement des modules content inlinés +
// `import type` (élidés). Aucun import de valeur depuis lib/* (chunk partagé).

import { analyze, resetCollectState } from "./collect";
import { loadComponentDb } from "./detect";
import { decideSiteWrite, fresher, jwtClaims } from "./auth-bridge";
import type { GetSiteTokensMsg, SyncTokensToSiteMsg } from "../lib/messages";

const EXTENSION_VERSION = "2.2.0";

// ── (A) Bridge auth site monark-market.fr ↔ extension ──────────────────────
const SITE_ACCESS_KEY = "monark_access_token";
const SITE_REFRESH_KEY = "monark_refresh_token";
let lastKnownSiteToken: string | null = null;
let syncInProgress = false;

function isSiteHost(): boolean {
  const h = window.location.hostname;
  return h === "monark-market.fr" || h === "www.monark-market.fr";
}

async function pushSiteToExt(siteAccess: string | null): Promise<void> {
  await chrome.runtime.sendMessage({
    type: "SYNC_TOKENS_FROM_SITE",
    access_token: siteAccess ?? "",
    refresh_token: siteAccess ? localStorage.getItem(SITE_REFRESH_KEY) : null,
  });
  lastKnownSiteToken = siteAccess; // évite que le poll re-pousse la même valeur au SW
}

function adoptExtTokens(extAccess: string, extRefresh: string | null | undefined, reloadIfNeeded: boolean): void {
  localStorage.setItem(SITE_ACCESS_KEY, extAccess);
  if (extRefresh) localStorage.setItem(SITE_REFRESH_KEY, extRefresh);
  lastKnownSiteToken = extAccess;
  if (reloadIfNeeded) window.location.reload();
}

async function initialSync(): Promise<void> {
  if (syncInProgress) return;
  syncInProgress = true;
  try {
    const siteToken = localStorage.getItem(SITE_ACCESS_KEY);
    const ext = (await chrome.runtime.sendMessage({ type: "GET_STORED_TOKENS" })) as {
      access_token?: string | null;
      refresh_token?: string | null;
    };
    const extAccess = ext?.access_token ?? null;
    if (siteToken && !extAccess) {
      await pushSiteToExt(siteToken); // site connecté, ext non -> pousser au SW
    } else if (extAccess && !siteToken) {
      adoptExtTokens(extAccess, ext.refresh_token, true); // ext connecté, site non -> reload (login)
    } else if (siteToken && extAccess && siteToken !== extAccess) {
      // (§4) les deux présents mais DIFFÉRENTS -> adopter le plus récent (par exp).
      if (fresher(siteToken, extAccess) === "site") {
        await pushSiteToExt(siteToken);
      } else {
        const sameSub = jwtClaims(siteToken).sub != null && jwtClaims(siteToken).sub === jwtClaims(extAccess).sub;
        adoptExtTokens(extAccess, ext.refresh_token, !sameSub); // identité différente -> reload
      }
    }
  } catch (err) {
    console.warn("[Monark] Initial auth sync failed:", err);
  } finally {
    syncInProgress = false;
  }
}

function handleExtensionToSite(message: SyncTokensToSiteMsg): void {
  // (LOT D §1/§2) la décision est PILOTÉE par message.reason (explicite), avec garde-fou sub.
  const action = decideSiteWrite(message.reason, localStorage.getItem(SITE_ACCESS_KEY), message.access_token);
  if (action === "clear") {
    localStorage.removeItem(SITE_ACCESS_KEY);
    localStorage.removeItem(SITE_REFRESH_KEY);
    lastKnownSiteToken = null;
    window.location.reload();
    return;
  }
  if (message.access_token) localStorage.setItem(SITE_ACCESS_KEY, message.access_token);
  if (message.refresh_token) localStorage.setItem(SITE_REFRESH_KEY, message.refresh_token);
  lastKnownSiteToken = message.access_token; // évite le ping-pong poll → SW
  // action === "silent" (rotation, même session) : AUCUN reload — le site lit le token live et
  // l'adopte seul. action === "reload" (login / bascule de sub) : recharger pour rafraîchir l'état.
  if (action === "reload") window.location.reload();
}

async function checkSiteAuthChanged(): Promise<void> {
  if (syncInProgress) return;
  const currentToken = localStorage.getItem(SITE_ACCESS_KEY);
  if (currentToken === lastKnownSiteToken) return;
  lastKnownSiteToken = currentToken;
  syncInProgress = true;
  try {
    await chrome.runtime.sendMessage({
      type: "SYNC_TOKENS_FROM_SITE",
      access_token: currentToken ?? "",
      refresh_token: currentToken ? localStorage.getItem(SITE_REFRESH_KEY) : null,
    });
  } catch (err) {
    console.warn("[Monark] Site→Extension auth sync failed:", err);
  } finally {
    syncInProgress = false;
  }
}

function initAuthSync(): void {
  if (!isSiteHost()) return;
  console.log("[Monark] Auth sync initialized on monark-market.fr");
  // Ping de présence (E5) — non consommé par le site à ce jour (futur CTA install).
  window.postMessage({ type: "MONARK_LENS_INSTALLED", version: EXTENSION_VERSION }, "*");
  void initialSync();
  chrome.runtime.onMessage.addListener(
    (message: SyncTokensToSiteMsg | GetSiteTokensMsg, _sender, sendResponse) => {
      if (message.action === "SYNC_TOKENS_TO_SITE") {
        handleExtensionToSite(message);
        sendResponse({ success: true });
      } else if (message.action === "GET_SITE_TOKENS") {
        // (§5) guérison : le SW lit notre localStorage AVANT de déconnecter.
        sendResponse({
          access_token: localStorage.getItem(SITE_ACCESS_KEY),
          refresh_token: localStorage.getItem(SITE_REFRESH_KEY),
        });
      }
      return false;
    },
  );
  lastKnownSiteToken = localStorage.getItem(SITE_ACCESS_KEY);
  // (§3) propagation site → ext immédiate : 'storage' (autres onglets) + retour au focus/visibilité.
  // Le filet poll 2 s reste car le MÊME onglet n'émet PAS 'storage' (refresh du site in-tab).
  window.addEventListener("storage", (e) => {
    if (e.key === SITE_ACCESS_KEY || e.key === SITE_REFRESH_KEY) void checkSiteAuthChanged();
  });
  window.addEventListener("focus", () => void checkSiteAuthChanged());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void checkSiteAuthChanged();
  });
  setInterval(() => void checkSiteAuthChanged(), 2000);
}

// ── (B) Observation de navigation (SPA) ────────────────────────────────────
let lastUrl = "";
function observeNavigation(callback: () => void): void {
  callback();
  lastUrl = window.location.href;
  const nav = (window as unknown as { navigation?: { addEventListener(t: string, cb: () => void): void } }).navigation;
  if (nav) {
    nav.addEventListener("navigatesuccess", () => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        callback();
      }
    });
  } else {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const observer = new MutationObserver(() => {
      if (window.location.href !== lastUrl) {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          lastUrl = window.location.href;
          callback();
        }, 300);
      }
    });
    if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  }
  window.addEventListener("popstate", () => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      callback();
    }
  });
}

// ── init ───────────────────────────────────────────────────────────────────
let scheduledForUrl: string | null = null;

function init(): void {
  initAuthSync(); // (A) no-op hors monark-market.fr
  void loadComponentDb(); // (B) cache de détection
  observeNavigation(() => {
    const currentUrl = window.location.href;
    if (currentUrl === scheduledForUrl) return;
    scheduledForUrl = currentUrl;
    resetCollectState();
    setTimeout(() => void analyze(), 800);
  });
}

init();
