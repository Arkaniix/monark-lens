import { describe, expect, it } from "vitest";

import { canonicalAdHash, canonicalUrl } from "./adhash";

// Vecteurs GRAVÉS — identiques à tests/test_canonical_ad_hash.py (monark_api).
const VECTORS: ReadonlyArray<readonly [string, string, string]> = [
  [
    "https://www.leboncoin.fr/ad/consoles_jeux_video/2812345678.htm?utm_source=newsletter&utm_medium=email",
    "www.leboncoin.fr/ad/consoles_jeux_video/2812345678.htm",
    "95a87e48746c014f8a4295c8b932b192cbeea87b51325d82445aa51fdfa7e6de",
  ],
  [
    "https://www.ebay.fr/itm/123456789012?hash=item1a2b3c%3Ag&var=0#desc",
    "www.ebay.fr/itm/123456789012",
    "08528ff6e6211123707d5ad74b772ac1cb0ec8beb56f3668acebd1bb4a6c6567",
  ],
  [
    "https://www.vinted.fr/items/4567890123-rtx-3060-12gb/?referrer=catalog",
    "www.vinted.fr/items/4567890123-rtx-3060-12gb",
    "1bd5fc239f58154f9b226a1b19bf5dd98bd968b9e4453b7b731d20cfc0b0a78c",
  ],
];

describe("canonicalAdHash — vecteurs de référence", () => {
  for (const [url, canon, hash] of VECTORS) {
    it(`canonicalise + hashe ${url}`, async () => {
      expect(canonicalUrl(url)).toBe(canon);
      const h = await canonicalAdHash(url);
      expect(h).toBe(hash);
      expect(h).toHaveLength(64);
    });
  }
});

describe("canonicalAdHash — cas limites", () => {
  it("strippe query + utm", async () => {
    expect(await canonicalAdHash("https://www.ebay.fr/itm/9?a=1&utm_source=x")).toBe(
      await canonicalAdHash("https://www.ebay.fr/itm/9"),
    );
  });

  it("strippe le fragment", async () => {
    expect(await canonicalAdHash("https://www.ebay.fr/itm/9#desc")).toBe(
      await canonicalAdHash("https://www.ebay.fr/itm/9"),
    );
  });

  it("host insensible à la casse", async () => {
    expect(await canonicalAdHash("https://WWW.EBAY.FR/itm/9")).toBe(
      await canonicalAdHash("https://www.ebay.fr/itm/9"),
    );
  });

  it("trailing slash normalisé", async () => {
    expect(await canonicalAdHash("https://www.vinted.fr/items/1-x/")).toBe(
      await canonicalAdHash("https://www.vinted.fr/items/1-x"),
    );
  });

  it("scheme ignoré (http == https)", async () => {
    expect(await canonicalAdHash("http://www.ebay.fr/itm/9")).toBe(
      await canonicalAdHash("https://www.ebay.fr/itm/9"),
    );
  });

  it("chemins distincts -> hashes distincts", async () => {
    expect(await canonicalAdHash("https://www.vinted.fr/items/1")).not.toBe(
      await canonicalAdHash("https://www.vinted.fr/items/2"),
    );
  });
});
