// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";

import { flagOptionsFromRules, renderMain } from "./overlay";
import type { ListingContext, SnapshotOutcome } from "./snapshot-client";
import type { IntentDecision } from "../classify";
import type { SnapshotResponse } from "../../lib/api-types";

function decision(over: Partial<IntentDecision> = {}): IntentDecision {
  return {
    intent: "sale",
    gate: "info",
    should_signal: true,
    label: "",
    overlay_message: "",
    matched_flags: [],
    rules_version: 1,
    quantity: 1,
    ...over,
  };
}

const ctx: ListingContext = {
  platform: "leboncoin",
  url: "https://www.leboncoin.fr/ad/x/1",
  componentId: 3,
  componentName: "RTX 3060",
  askingPrice: 265,
  condition: "good",
  intent: decision(),
  publishedAt: null,
  title: "RTX 3060",
};

function frag(html: string): HTMLElement {
  const d = document.createElement("div");
  d.innerHTML = html;
  return d;
}

function snap(over: Partial<SnapshotResponse>): SnapshotResponse {
  return {
    ad_hash: "h",
    cached: false,
    cache_expires_at: null,
    component_id: 3,
    component_name: "RTX 3060",
    category: "gpu",
    asking_price: 265,
    state: "reliable",
    market_median: 300,
    volume_30d: 12,
    volume_90d: 40,
    trend_30d_pct: null,
    asking_range: { p10: 250, p25: 280, p75: 330, p90: 360 },
    verdict: "bonne_affaire",
    verdict_label: "Bonne affaire",
    gap_percent: 12,
    gap_direction: "under",
    data_quality: "high",
    reference_source: "sold",
    last_updated: "2026-06-11T09:00:00Z",
    credits_charged: 1,
    credits_remaining: 42,
    ...over,
  };
}

const ok = (data: SnapshotResponse): SnapshotOutcome => ({ ok: true, data });

describe("overlay — rendu honnête des états snapshot", () => {
  it("reliable : héros « Médiane vendue » + fourchette « Prix demandés actuellement » DISTINCTE", () => {
    const el = frag(renderMain(ctx, ok(snap({}))));
    expect(el.querySelector(".ml-hero-value")?.textContent).toContain("300");
    expect(el.querySelector(".ml-hero-label")?.textContent).toContain("Médiane vendue");
    expect(el.querySelector(".ml-range-label")?.textContent ?? "").toContain("Prix demandés actuellement");
    expect(el.textContent).not.toContain("Non débité");
  });

  it("garde-fou faux-match : header rappelle TOUJOURS component_name + prix demandé", () => {
    const el = frag(renderMain(ctx, ok(snap({}))));
    expect(el.querySelector(".ml-context-name")?.textContent).toContain("RTX 3060");
    expect(el.querySelector(".ml-context-price")?.textContent).toContain("265");
  });

  it("insufficient : pas de héros, mention « Non débité », volumes réels", () => {
    const el = frag(renderMain(ctx, ok(snap({ state: "insufficient", market_median: null, volume_30d: 1, volume_90d: 2 }))));
    expect(el.querySelector(".ml-hero-value")).toBeNull();
    expect(el.textContent).toContain("Non débité");
    expect(el.textContent).toContain("1 / 2");
  });

  it("no_data : « non couvert » + « Non débité »", () => {
    const el = frag(renderMain(ctx, ok(snap({ state: "no_data", market_median: null }))));
    expect(el.querySelector(".ml-hero-value")).toBeNull();
    expect(el.textContent).toContain("non couvert");
  });

  it("402 : « Crédits épuisés » + topup ; réseau : retry ; 401 : reconnexion sans retry", () => {
    const e402 = frag(renderMain(ctx, { ok: false, error: "no credits", status: 402 }));
    expect(e402.textContent).toContain("Crédits épuisés");
    expect(e402.querySelector('[data-act="topup"]')).not.toBeNull();
    const eNet = frag(renderMain(ctx, { ok: false, error: "Network down" }));
    expect(eNet.querySelector('[data-act="retry"]')).not.toBeNull();
    const e401 = frag(renderMain(ctx, { ok: false, error: "Not authenticated" }));
    expect(e401.textContent).toContain("Session expirée");
    expect(e401.querySelector('[data-act="retry"]')).toBeNull();
  });
});

describe("overlay — badge info (gate info, C2.c)", () => {
  it("gate info + overlay_message -> badge affiché avec le message", () => {
    const c2: ListingContext = { ...ctx, intent: decision({ intent: "mining", gate: "info", overlay_message: "Composant ex-minage détecté" }) };
    expect(frag(renderMain(c2, ok(snap({}))))?.textContent).toContain("Composant ex-minage détecté");
  });
  it("gate info SANS message (vente normale) -> aucun badge", () => {
    expect(frag(renderMain(ctx, ok(snap({}))))?.textContent).not.toContain("ex-minage");
  });
});

describe("overlay — flagOptionsFromRules (C2.e, remplace les 14 anomalies hardcodées)", () => {
  const fams = [
    { slug: "broken", label: "Composant HS / pour pièces" },
    { slug: "photo_scam", label: "Annonce suspecte (photo seule)" },
    { slug: "sale", label: "Vente" }, // doit être exclu
  ];
  it("mappe les familles (slug ≠ sale) + ajoute le catch-all `other`", () => {
    const opts = flagOptionsFromRules(fams);
    const types = opts.map((o) => o.type);
    expect(types).toContain("broken");
    expect(types).toContain("photo_scam");
    expect(types).not.toContain("sale");
    expect(types[types.length - 1]).toBe("other"); // catch-all en dernier
  });
  it("conserve les libellés FR servis + a une icône par option", () => {
    const opts = flagOptionsFromRules(fams);
    expect(opts.find((o) => o.type === "broken")?.label).toBe("Composant HS / pour pièces");
    expect(opts.every((o) => o.icon.length > 0)).toBe(true);
  });
});
