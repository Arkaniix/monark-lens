// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";

import { mountAnalyzeButton, removeAnalyzeButton, shouldShowAnalyzeButton } from "./button";
import type { ListingContext } from "./snapshot-client";

describe("shouldShowAnalyzeButton — gate apparition V2-03", () => {
  it("test_spam (shouldOverlay=false) → JAMAIS", () => {
    expect(shouldShowAnalyzeButton("test_spam", false)).toBe(false);
  });

  it("bundle → JAMAIS (lot : verdict honnête impossible sur le composant seul)", () => {
    expect(shouldShowAnalyzeButton("bundle", true)).toBe(false);
  });

  it("wanted → JAMAIS (demande d'achat : analyse sans objet)", () => {
    expect(shouldShowAnalyzeButton("wanted", true)).toBe(false);
  });

  it("sale → oui", () => {
    expect(shouldShowAnalyzeButton("sale", true)).toBe(true);
  });

  it("autres intents (broken/mining/reserved/… ) → oui (médiane marché utile)", () => {
    for (const t of [
      "broken",
      "mining",
      "rma_refurb",
      "professional",
      "reserved",
      "trade",
      "box_only",
      "multiple",
      "accessory",
      "symbolic_price",
      "rental",
      "parts_from_device",
    ]) {
      expect(shouldShowAnalyzeButton(t, true)).toBe(true);
    }
  });
});

describe("mount / remove bouton passif", () => {
  afterEach(() => removeAnalyzeButton());

  const ctx: ListingContext = {
    platform: "leboncoin",
    url: "https://www.leboncoin.fr/ad/x/1",
    componentId: 3,
    componentName: "RTX 3060",
    askingPrice: 200,
    condition: "good",
    intentType: "sale",
  };

  it("monte un host unique (idempotent) et le retire proprement", () => {
    mountAnalyzeButton(ctx);
    expect(document.getElementById("monark-lens-button")).not.toBeNull();
    mountAnalyzeButton(ctx); // remonte sans dupliquer
    expect(document.querySelectorAll("#monark-lens-button").length).toBe(1);
    removeAnalyzeButton();
    expect(document.getElementById("monark-lens-button")).toBeNull();
  });
});
