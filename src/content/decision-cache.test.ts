import { describe, expect, it } from "vitest";

import { canonicalUrl } from "../lib/adhash";
import { canonicalKey, pruneCache } from "./decision-cache";

// P2 (exigé) : la clé du cache de décision (helper inliné, 0-import) DOIT produire la préimage
// EXACTE que canonicalAdHash() hashe (= lib/adhash.ts::canonicalUrl). Toute divergence ferait
// diverger « 1 décision par annonce » de « 1 ad_hash par annonce ».
describe("decision-cache canonicalKey — parité avec lib/adhash.ts::canonicalUrl", () => {
  const fixtures = [
    "https://www.leboncoin.fr/ad/consoles_jeux_video/2812345678.htm?utm_source=x#desc", // query + fragment
    "https://WWW.EBAY.FR/itm/123456789012?hash=abc#desc", // casse host + query + fragment
    "https://www.vinted.fr/items/4567890123-rtx-3060-12gb/?referrer=y", // trailing slash + query
    "https://www.leboncoin.fr/ad/x/1/", // trailing slash seul
    "https://Www.LeBonCoin.FR/AD/Mixed/2", // casse mixte host + path
    "https://www.ebay.com/itm/9", // sans query ni fragment
  ];
  for (const url of fixtures) {
    it(`= préimage canonicalUrl : ${url}`, () => {
      expect(canonicalKey(url)).toBe(canonicalUrl(url));
    });
  }
  it("URL invalide -> fallback brut (pas de throw)", () => {
    expect(canonicalKey("pas-une-url")).toBe("pas-une-url");
  });
});

describe("pruneCache — TTL + LRU (pures)", () => {
  it("purge les entrées expirées (>7 j)", () => {
    const now = 10 * 24 * 3600 * 1000;
    const cache = {
      old: { decision: "confirmed" as const, ts: 0 },
      fresh: { decision: "overridden" as const, ts: now - 1000 },
    };
    pruneCache(cache, now);
    expect("old" in cache).toBe(false);
    expect("fresh" in cache).toBe(true);
  });
  it("LRU : >500 entrées -> conserve les 400 plus récentes", () => {
    const now = 1_000_000_000;
    const cache: Record<string, { decision: "confirmed"; ts: number }> = {};
    for (let i = 0; i < 600; i++) cache[`k${i}`] = { decision: "confirmed", ts: now - (600 - i) }; // k0 = plus vieux
    pruneCache(cache, now);
    expect(Object.keys(cache).length).toBe(400);
    expect("k0" in cache).toBe(false); // plus vieux supprimé
    expect("k599" in cache).toBe(true); // plus récent conservé
  });
});
