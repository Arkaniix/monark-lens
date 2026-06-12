// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";

import { mountAnalyzeButton, mountAnalyzePlaceholder, removeAnalyzeButton, shouldShowAnalyzeButton } from "./button";
import type { ListingContext } from "./snapshot-client";
import type { IntentDecision } from "../classify";

describe("shouldShowAnalyzeButton — gate apparition (C2)", () => {
  it("silent (test_spam) → JAMAIS de bouton", () => {
    expect(shouldShowAnalyzeButton("silent")).toBe(false);
  });
  it("info → bouton", () => {
    expect(shouldShowAnalyzeButton("info")).toBe(true);
  });
  it("confirm → bouton (bundle/wanted affichent désormais le bouton, gate de confirmation au clic)", () => {
    expect(shouldShowAnalyzeButton("confirm")).toBe(true);
  });
});

describe("mount / remove bouton passif", () => {
  afterEach(() => removeAnalyzeButton());

  const decision: IntentDecision = {
    intent: "sale",
    gate: "info",
    should_signal: true,
    label: "",
    overlay_message: "",
    matched_flags: [],
    rules_version: 1,
    quantity: 1,
  };
  const ctx: ListingContext = {
    platform: "leboncoin",
    url: "https://www.leboncoin.fr/ad/x/1",
    componentId: 3,
    componentName: "RTX 3060",
    askingPrice: 200,
    condition: "good",
    intent: decision,
    publishedAt: null,
  };

  it("monte un host unique (idempotent) et le retire proprement", () => {
    mountAnalyzeButton(ctx);
    expect(document.getElementById("monark-lens-button")).not.toBeNull();
    mountAnalyzeButton(ctx); // remonte sans dupliquer
    expect(document.querySelectorAll("#monark-lens-button").length).toBe(1);
    removeAnalyzeButton();
    expect(document.getElementById("monark-lens-button")).toBeNull();
  });

  it("(A3) placeholder spinner monté puis swappé en bouton dans le MÊME host", () => {
    mountAnalyzePlaceholder();
    const host = document.getElementById("monark-lens-button");
    expect(host).not.toBeNull();
    mountAnalyzeButton(ctx); // swap in-place : host réutilisé, pas de doublon
    expect(document.querySelectorAll("#monark-lens-button").length).toBe(1);
    expect(document.getElementById("monark-lens-button")).toBe(host);
    removeAnalyzeButton();
    expect(document.getElementById("monark-lens-button")).toBeNull();
  });
});
