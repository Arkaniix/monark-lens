// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";

import { consensusBadge, consensusLineHtml, FLAG_OPTIONS, renderMain } from "./overlay";
import type { ListingContext, SnapshotOutcome } from "./snapshot-client";
import type { SnapshotResponse } from "../../lib/api-types";

const ctx: ListingContext = {
  platform: "leboncoin",
  url: "https://www.leboncoin.fr/ad/x/1",
  componentId: 3,
  componentName: "RTX 3060",
  askingPrice: 265,
  condition: "good",
  intentType: "sale",
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

describe("overlay — rendu honnête des 6 états", () => {
  it("reliable : héros « Médiane vendue » + fourchette « Prix demandés actuellement » DISTINCTE", () => {
    const el = frag(renderMain(ctx, ok(snap({}))));
    expect(el.querySelector(".ml-hero-value")?.textContent).toContain("300");
    expect(el.querySelector(".ml-hero-label")?.textContent).toContain("Médiane vendue");
    const range = el.querySelector(".ml-range-label")?.textContent ?? "";
    expect(range).toContain("Prix demandés actuellement");
    expect(el.textContent).not.toContain("Non débité");
  });

  it("garde-fou faux-match : header rappelle TOUJOURS component_name + prix demandé", () => {
    const el = frag(renderMain(ctx, ok(snap({}))));
    expect(el.querySelector(".ml-context-name")?.textContent).toContain("RTX 3060");
    expect(el.querySelector(".ml-context-price")?.textContent).toContain("265");
  });

  it("insufficient : pas de héros, mention « Non débité », volumes réels affichés", () => {
    const el = frag(renderMain(ctx, ok(snap({ state: "insufficient", market_median: null, volume_30d: 1, volume_90d: 2 }))));
    expect(el.querySelector(".ml-hero-value")).toBeNull();
    expect(el.textContent).toContain("Non débité");
    expect(el.textContent).toContain("1 / 2");
  });

  it("no_data : « non couvert » + « Non débité », pas de héros", () => {
    const el = frag(renderMain(ctx, ok(snap({ state: "no_data", market_median: null }))));
    expect(el.querySelector(".ml-hero-value")).toBeNull();
    expect(el.textContent).toContain("non couvert");
    expect(el.textContent).toContain("Non débité");
  });

  it("cached : mention discrète « gratuite »", () => {
    const el = frag(renderMain(ctx, ok(snap({ cached: true }))));
    expect(el.querySelector(".ml-cached")?.textContent).toContain("gratuite");
  });

  it("402 : « Crédits épuisés » + lien topup, pas de héros", () => {
    const el = frag(renderMain(ctx, { ok: false, error: "no credits", status: 402 }));
    expect(el.textContent).toContain("Crédits épuisés");
    expect(el.querySelector('[data-act="topup"]')).not.toBeNull();
    expect(el.querySelector(".ml-hero-value")).toBeNull();
  });

  it("erreur réseau : état dédié + bouton réessayer", () => {
    const el = frag(renderMain(ctx, { ok: false, error: "Network down" }));
    expect(el.textContent).toContain("indisponible");
    expect(el.querySelector('[data-act="retry"]')).not.toBeNull();
  });

  it("session expirée (401 / Not authenticated) : reconnexion, PAS de retry", () => {
    for (const out of [
      { ok: false as const, error: "Snapshot failed (401)", status: 401 },
      { ok: false as const, error: "Not authenticated" },
    ]) {
      const el = frag(renderMain(ctx, out));
      expect(el.textContent).toContain("Session expirée");
      expect(el.querySelector('[data-act="login"]')).not.toBeNull();
      expect(el.querySelector('[data-act="retry"]')).toBeNull();
    }
  });

  it("consensus présent ≥2 (hors sale) → ambre + N + libellés dominants", () => {
    const b = consensusBadge({ votes: { broken: 3, mining: 2, sale: 5 } });
    expect(b).not.toBeNull();
    expect(b?.n).toBe(5); // 3+2 ; sale EXCLU
    expect(b?.tone).toBe("amber");
    const html = consensusLineHtml(b!);
    expect(html).toContain("⚠ 5 signalements");
    expect(html).toContain("Composant HS / pour pièces"); // broken = dominant
    expect(html).toContain("var(--amber)");
  });

  it("consensus =1 → zinc, singulier", () => {
    const b = consensusBadge({ votes: { wanted: 1 } });
    expect(b?.n).toBe(1);
    expect(b?.tone).toBe("zinc");
    const html = consensusLineHtml(b!);
    expect(html).toContain("1 signalement :");
    expect(html).not.toContain("signalements");
    expect(html).toContain("var(--zinc-400)");
  });

  it("anomalies fondues → « Autre anomalie » (bucket other)", () => {
    expect(consensusLineHtml(consensusBadge({ votes: { other: 2 } })!)).toContain("Autre anomalie");
  });

  it("seuls des votes sale → AUCUN bandeau ; votes null/absent/erreur → AUCUN bandeau", () => {
    expect(consensusBadge({ votes: { sale: 9 } })).toBeNull();
    expect(consensusBadge({ votes: null })).toBeNull();
    expect(consensusBadge(null)).toBeNull();
    expect(consensusBadge(undefined)).toBeNull();
  });

  it("snapshot INDÉPENDANT du consensus : slot vide par défaut, snapshot rendu quand même", () => {
    const el = frag(renderMain(ctx, ok(snap({}))));
    const slot = el.querySelector(".ml-consensus-slot");
    expect(slot).not.toBeNull();
    expect(slot?.textContent).toBe(""); // vide tant que le consensus n'a pas répondu
    expect(el.querySelector(".ml-hero-value")).not.toBeNull();
  });

  it("expose les 14 anomalies exactes (verbatim v1)", () => {
    expect(FLAG_OPTIONS).toHaveLength(14);
    expect(FLAG_OPTIONS.map((o) => o.type)).toEqual([
      "broken",
      "bundle",
      "box_only",
      "trade",
      "wanted",
      "mining",
      "accessory",
      "symbolic_price",
      "reserved",
      "multiple",
      "rental",
      "rma_refurb",
      "professional",
      "other",
    ]);
  });
});
