// src/content/main.ts — content script v2 (V2-01 : bridge auth UNIQUEMENT).
//
// Invariant MV3 : script CLASSIQUE auto-suffisant -> AUCUN import de VALEUR (chunk partagé).
// Seul `import type` est autorisé (élidé au build, 0 import émis). Le parsing d'annonces et
// l'overlay sont reportés à V2-02 (non portés ici).
//
// Bridge auth site monark-market.fr ↔ extension. Clés site CONFIRMÉES (front
// monark-foundations, src/lib/api/client.ts) : localStorage monark_access_token /
// monark_refresh_token. Écarts v1 ASSUMÉS (voir commentaires E1/E3).

import type { SyncTokensToSiteMsg } from "../lib/messages";

const EXTENSION_VERSION = "2.0.0"; // inliné : pas d'import de constants -> reste auto-suffisant
const SITE_ACCESS_KEY = "monark_access_token";
const SITE_REFRESH_KEY = "monark_refresh_token";

let lastKnownSiteToken: string | null = null;
let syncInProgress = false;

function isSiteHost(): boolean {
  const h = window.location.hostname;
  return h === "monark-market.fr" || h === "www.monark-market.fr";
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
    const extHasToken = !!ext?.access_token;
    const siteHasToken = !!siteToken;
    if (siteHasToken && !extHasToken) {
      await chrome.runtime.sendMessage({
        type: "SYNC_TOKENS_FROM_SITE",
        access_token: siteToken,
        refresh_token: localStorage.getItem(SITE_REFRESH_KEY),
      });
    } else if (extHasToken && !siteHasToken && ext.access_token) {
      localStorage.setItem(SITE_ACCESS_KEY, ext.access_token);
      if (ext.refresh_token) localStorage.setItem(SITE_REFRESH_KEY, ext.refresh_token);
      window.location.reload();
    }
  } catch (err) {
    console.warn("[Monark] Initial auth sync failed:", err);
  } finally {
    syncInProgress = false;
  }
}

function handleExtensionToSite(message: SyncTokensToSiteMsg): void {
  if (message.access_token) {
    localStorage.setItem(SITE_ACCESS_KEY, message.access_token);
    if (message.refresh_token) localStorage.setItem(SITE_REFRESH_KEY, message.refresh_token);
    lastKnownSiteToken = message.access_token;
  } else {
    localStorage.removeItem(SITE_ACCESS_KEY);
    localStorage.removeItem(SITE_REFRESH_KEY);
    // Écart v1 (E1) : on NE purge PAS `mock_current_user` — clé morte côté front actuel.
    lastKnownSiteToken = null;
  }
  // Écart v1 (E3) : on garde UNIQUEMENT le reload (seul mécanisme réellement consommé par
  // le site). DROP du CustomEvent "monark-auth-sync" et du StorageEvent synthétique : aucun
  // listener côté site (vérifié sur le repo monark-foundations).
  window.location.reload();
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

  // Ping de présence (E5). Non consommé par le site à ce jour ; le site l'écoutera plus
  // tard pour détecter l'extension (CTA install). Conservé volontairement (1 ligne).
  window.postMessage({ type: "MONARK_LENS_INSTALLED", version: EXTENSION_VERSION }, "*");

  void initialSync();
  chrome.runtime.onMessage.addListener((message: SyncTokensToSiteMsg, _sender, sendResponse) => {
    if (message.action === "SYNC_TOKENS_TO_SITE") {
      handleExtensionToSite(message);
      sendResponse({ success: true });
    }
    return false;
  });
  lastKnownSiteToken = localStorage.getItem(SITE_ACCESS_KEY);
  setInterval(() => void checkSiteAuthChanged(), 2000);
}

initAuthSync();
