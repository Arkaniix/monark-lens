// src/content/decision-cache.ts — cache de décision de gate, par annonce (C2.d).
// Keyé par canonicalUrl INLINÉ (P2) : préimage byte-identique à lib/adhash.ts::canonicalUrl
// (parité testée), donc 1:1 avec l'ad_hash — mais SANS crypto ni import adhash, pour préserver
// l'invariant MV3 0-import du bundle content. chrome.storage.local, LRU 500, TTL 7 j.
// Consulté AVANT le gate ; UN seul rapport par décision (pas de re-POST sur cache-hit).

const KEY = "monark_intent_decisions";
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 j (mécanique v1)
const MAX = 500;
const KEEP = 400; // au-delà de MAX, on conserve les KEEP plus récents

export type Decision = "confirmed" | "overridden";

interface Entry {
  decision: Decision;
  ts: number;
}
type CacheMap = Record<string, Entry>;

/**
 * Préimage canonique = byte-identique à lib/adhash.ts::canonicalUrl (parité vérifiée en test).
 * Inlinée volontairement (pas d'import adhash/crypto) pour garder content/main.js 0-import.
 */
export function canonicalKey(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.toLowerCase() + u.pathname.replace(/\/+$/, "");
  } catch {
    return url; // URL invalide : fallback brut, pas de throw
  }
}

/** Purge TTL + LRU (PURE, testable). Mute `cache` en place et le renvoie. */
export function pruneCache(cache: CacheMap, now: number): CacheMap {
  for (const k of Object.keys(cache)) {
    if (now - (cache[k]?.ts ?? 0) > TTL_MS) delete cache[k];
  }
  const keys = Object.keys(cache);
  if (keys.length > MAX) {
    keys.sort((a, b) => (cache[a].ts || 0) - (cache[b].ts || 0)); // plus vieux d'abord
    for (let i = 0; i < keys.length - KEEP; i++) delete cache[keys[i]];
  }
  return cache;
}

async function readCache(): Promise<CacheMap> {
  try {
    const data = await chrome.storage.local.get([KEY]);
    return (data[KEY] || {}) as CacheMap;
  } catch {
    return {};
  }
}

export async function getCachedDecision(url: string): Promise<Decision | null> {
  const cache = await readCache();
  const key = canonicalKey(url);
  const entry = cache[key];
  if (!entry) return null;
  if (Date.now() - entry.ts > TTL_MS) {
    delete cache[key];
    try {
      await chrome.storage.local.set({ [KEY]: cache });
    } catch {
      /* best-effort */
    }
    return null;
  }
  return entry.decision;
}

export async function cacheDecision(url: string, decision: Decision): Promise<void> {
  try {
    const cache = await readCache();
    pruneCache(cache, Date.now());
    cache[canonicalKey(url)] = { decision, ts: Date.now() };
    await chrome.storage.local.set({ [KEY]: cache });
  } catch (err) {
    console.warn("[Monark] cacheDecision failed:", err);
  }
}
