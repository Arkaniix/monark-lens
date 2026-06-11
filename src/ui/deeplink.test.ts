import { describe, expect, it } from "vitest";

import { buildEstimateUrl, CONDITION_TO_SLUG } from "./deeplink";

function params(url: string): URLSearchParams {
  return new URL(url).searchParams;
}

describe("buildEstimateUrl — deep-link V2-03 (model only, jamais titre/URL)", () => {
  it("émet model + price + condition + platform + source=lens", () => {
    const url = buildEstimateUrl({
      componentName: "RTX 3060",
      askingPrice: 265.4,
      condition: "good",
      platform: "leboncoin",
    });
    const p = params(url);
    expect(url.startsWith("https://monark-market.fr/estimator?")).toBe(true);
    expect(p.get("model")).toBe("RTX 3060"); // nom CMS, PAS le titre d'annonce
    expect(p.get("price")).toBe("265"); // arrondi
    expect(p.get("condition")).toBe("bon"); // slug v1
    expect(p.get("platform")).toBe("leboncoin");
    expect(p.get("source")).toBe("lens");
  });

  it("n'inclut JAMAIS le titre, l'URL, l'id composant ni la catégorie (divergence v1 assumée)", () => {
    const p = params(
      buildEstimateUrl({ componentName: "RX 6600 XT", askingPrice: 180, condition: "good", platform: "ebay" }),
    );
    expect(p.has("title")).toBe(false);
    expect(p.has("url")).toBe(false);
    expect(p.has("component")).toBe(false); // id droppé (v1 l'émettait)
    expect(p.has("model_name")).toBe(false); // renommé en `model`
    expect(p.has("category")).toBe(false); // droppé (v1 l'émettait)
  });

  it("mappe toutes les conditions API → slug estimateur v1", () => {
    expect(CONDITION_TO_SLUG).toMatchObject({
      new: "neuf",
      like_new: "comme-neuf",
      good: "bon",
      fair: "correct",
      poor: "a-reparer",
    });
    expect(params(buildEstimateUrl({ componentName: "x", askingPrice: 1, condition: "new" })).get("condition")).toBe(
      "neuf",
    );
    expect(params(buildEstimateUrl({ componentName: "x", askingPrice: 1, condition: "like_new" })).get("condition")).toBe(
      "comme-neuf",
    );
    expect(params(buildEstimateUrl({ componentName: "x", askingPrice: 1, condition: "poor" })).get("condition")).toBe(
      "a-reparer",
    );
  });

  it("condition inconnue passe verbatim ; condition absente → pas de param", () => {
    expect(params(buildEstimateUrl({ componentName: "x", askingPrice: 1, condition: "weird" })).get("condition")).toBe(
      "weird",
    );
    expect(params(buildEstimateUrl({ componentName: "x", askingPrice: 1 })).has("condition")).toBe(false);
  });

  it("componentName null → model vide (jamais le titre d'annonce en fallback)", () => {
    expect(params(buildEstimateUrl({ componentName: null, askingPrice: 200 })).get("model")).toBe("");
  });

  it("platform absente → pas de param platform ; prix arrondi", () => {
    const p = params(buildEstimateUrl({ componentName: "x", askingPrice: 99.99 }));
    expect(p.has("platform")).toBe(false);
    expect(p.get("price")).toBe("100");
  });
});
