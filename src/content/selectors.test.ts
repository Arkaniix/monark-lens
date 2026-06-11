// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";

import {
  extractText,
  getSelectors,
  normalizeCondition,
  parsePrice,
  resetSelectorCache,
  resolveField,
} from "./selectors";

/* eslint-disable @typescript-eslint/no-explicit-any */
function mockStorage(platform_selectors: unknown): void {
  (globalThis as any).chrome = {
    storage: { local: { get: async () => ({ platform_selectors }) } },
  };
}

afterEach(() => {
  resetSelectorCache();
  document.body.innerHTML = "";
});

describe("getSelectors — fusion serveur-sur-bundle, clés OUVERTES", () => {
  it("override serveur par champ, bundle conservé ailleurs", async () => {
    mockStorage({ vinted: { selectors: { price: "[data-x='p']" }, version: 3 } });
    const s = await getSelectors("vinted");
    expect(s.price).toBe("[data-x='p']");
    expect(s.title).toContain("h1");
  });
  it("valeur vide serveur ne clobbe pas le bundle", async () => {
    mockStorage({ ebay: { selectors: { price: "" }, version: 2 } });
    const s = await getSelectors("ebay");
    expect(s.price).toContain("x-price-primary");
  });
  it("clé OUVERTE: 'location' seedée serveur est consommée (sans rebuild)", async () => {
    mockStorage({ leboncoin: { selectors: { location: ".region" }, version: 2 } });
    const s = await getSelectors("leboncoin");
    expect(s.location).toBe(".region");
  });
});

describe("extractText / resolveField (couche puis stratégie)", () => {
  it("extractText: passe le sélecteur vide, prend le suivant non-vide", () => {
    document.body.innerHTML = `<div class="a"></div><div class="b">  Titre  </div>`;
    expect(extractText(".a, .b")).toBe("Titre");
  });
  it("resolveField: sélecteur vide -> stratégie code", () => {
    expect(resolveField({ location: "" }, "location", () => "STRAT")).toBe("STRAT");
  });
  it("resolveField: sélecteur trouvé -> AVANT la stratégie", () => {
    document.body.innerHTML = `<span class="r">PACA</span>`;
    expect(resolveField({ location: ".r" }, "location", () => "STRAT")).toBe("PACA");
  });
});

describe("parsePrice / normalizeCondition", () => {
  it("parsePrice FR", () => {
    expect(parsePrice("1 299,90 €")).toBe(1299.9);
    expect(parsePrice("Gratuit")).toBeNull();
  });
  it("normalizeCondition long-keys-first", () => {
    expect(normalizeCondition("Très bon état")).toBe("like_new");
    expect(normalizeCondition("Bon état")).toBe("good");
    expect(normalizeCondition("Pour pièces")).toBe("poor");
    expect(normalizeCondition("Occasion")).toBe("good");
    expect(normalizeCondition("inconnu")).toBeNull();
  });
});
