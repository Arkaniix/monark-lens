// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { extractListingData } from "./index";
import { resetSelectorCache } from "../selectors";

/* eslint-disable @typescript-eslint/no-explicit-any */
beforeEach(() => {
  (globalThis as any).chrome = { storage: { local: { get: async () => ({}) } } };
  resetSelectorCache();
});
afterEach(() => {
  document.body.innerHTML = "";
});

describe("LBC — JSON-first __NEXT_DATA__", () => {
  it("title/price/condition/location/category depuis l'ad JSON", async () => {
    const ad = {
      list_id: 2812345678,
      subject: "RTX 3060 Ti",
      price: [350],
      attributes: [{ key: "condition", value: "bonetat" }],
      location: { region_name: "Bretagne" },
      body: "ma description",
      category_id: 15,
      category_name: "Ordinateurs",
    };
    const script = document.createElement("script");
    script.id = "__NEXT_DATA__";
    script.type = "application/json"; // comme Next.js : non exécuté
    script.textContent = JSON.stringify({ props: { pageProps: { ad } } });
    document.body.appendChild(script);

    const listing = await extractListingData("leboncoin");
    expect(listing?.title).toBe("RTX 3060 Ti");
    expect(listing?.price).toBe(350);
    expect(listing?.condition).toBe("good"); // LBC_CONDITION_MAP bonetat -> good
    expect(listing?.location).toBe("bretagne"); // LBC_REGION_MAP
    expect(listing?.categoryId).toBe(15);
    expect(listing?.description).toBe("ma description");
    expect(listing?.publishedAt).toBeNull(); // pas de first_publication_date dans cet ad
  });

  it("(A6) publishedAt = first_publication_date tronqué à YYYY-MM-DD", async () => {
    const ad = {
      list_id: 2812345678,
      subject: "RTX 3060",
      price: [300],
      first_publication_date: "2026-06-11 14:30:00",
    };
    const script = document.createElement("script");
    script.id = "__NEXT_DATA__";
    script.type = "application/json";
    script.textContent = JSON.stringify({ props: { pageProps: { ad } } });
    document.body.appendChild(script);

    const listing = await extractListingData("leboncoin");
    expect(listing?.publishedAt).toBe("2026-06-11");
  });
});

describe("Vinted — JSON-LD + condition via couche (SPOF patchable)", () => {
  it("title/price/description JSON-LD ; condition lue du DOM via la couche", async () => {
    const product = { "@type": "Product", name: "RX 6600", offers: { price: "180.0" }, description: "desc vinted" };
    const s = document.createElement("script");
    s.type = "application/ld+json";
    s.textContent = JSON.stringify(product);
    document.body.appendChild(s);
    document.body.insertAdjacentHTML(
      "beforeend",
      `<div data-testid="item-attributes-status"><span class="web_ui__Text__bold">Très bon état</span></div>`,
    );

    const listing = await extractListingData("vinted");
    expect(listing?.title).toBe("RX 6600");
    expect(listing?.price).toBe(180);
    expect(listing?.condition).toBe("like_new"); // condition DOM normalisée, routée par la couche
    expect(listing?.description).toBe("desc vinted");
    expect(listing?.location).toBeNull(); // non dispo Vinted
    expect(listing?.publishedAt).toBeNull(); // Vinted : date non extraite (Lot B)
  });

  it("condition absente -> null (dégradé non-fatal), title/price OK", async () => {
    const product = { "@type": "Product", name: "RX 6600", offers: { price: "150" } };
    const s = document.createElement("script");
    s.type = "application/ld+json";
    s.textContent = JSON.stringify(product);
    document.body.appendChild(s);

    const listing = await extractListingData("vinted");
    expect(listing?.title).toBe("RX 6600");
    expect(listing?.condition).toBeNull();
  });
});

describe("eBay — DOM via la couche + stratégies", () => {
  it("title/price/condition", async () => {
    document.body.innerHTML = `
      <h1 class="x-item-title__mainTitle"><span>Intel Core i5-12400F</span></h1>
      <div class="x-price-primary"><span>129,99 €</span></div>
      <div class="x-item-condition-text"><span>Occasion</span></div>`;
    const listing = await extractListingData("ebay");
    expect(listing?.title).toBe("Intel Core i5-12400F");
    expect(listing?.price).toBe(129.99);
    expect(listing?.condition).toBe("good"); // occasion -> good
    expect(listing?.publishedAt).toBeNull(); // eBay : date non extraite (Lot B)
  });
});
