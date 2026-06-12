// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";

import type { VerdictResponse } from "../../lib/api-types";
import { VERDICT_COLOR, verdictBodyHtml } from "./verdict-panel";

function v(over: Partial<VerdictResponse> = {}): VerdictResponse {
  return {
    component_id: 3, component_name: "RTX 3060", asking_price: 265, state: "ok",
    verdict: "NEGOTIATE", verdict_label: "Négocier", verdict_description: "desc",
    prix_conseille: 228, buy_ceiling: 240, optimal_buy: 210, basis: "margin",
    confidence_state: "sufficient", confidence_level: "medium",
    warnings: ["estimation indicative — vérifiez l'annonce et privilégiez le paiement sécurisé"],
    modulation_applied: { applied: false, reason: null, notches_down: 0 },
    credits_charged: 1, credits_remaining: 41, cached: false, ...over,
  };
}
function frag(html: string): HTMLElement {
  const d = document.createElement("div");
  d.innerHTML = html;
  return d;
}

describe("verdict-panel — rendu par verdict (B2.c)", () => {
  it("NEGOTIATE : prix_conseille héros + plafond marge 20 % + achat cible + base marge", () => {
    const el = frag(verdictBodyHtml(v({ verdict: "NEGOTIATE", verdict_label: "Négocier" })));
    expect(el.querySelector(".ml-verdict")?.textContent).toContain("Négocier");
    expect(el.querySelector(".ml-vd-hero")?.textContent).toContain("228");
    expect(el.querySelector(".ml-vd-hero-sub")?.textContent).toContain("prix conseillé");
    expect(el.textContent).toContain("Plafond marge 20 %");
    expect(el.textContent).toContain("Achat cible");
    expect(el.textContent).toContain("base marge");
  });

  it("BUY : « foncez » + warnings TRÈS visibles (disclaimer = message central, servi backend)", () => {
    const el = frag(verdictBodyHtml(v({ verdict: "BUY", verdict_label: "Foncer", prix_conseille: null })));
    expect(el.querySelector(".ml-vd-hero")?.textContent).toContain("foncez");
    expect(el.querySelector(".ml-vd-warn-strong")).not.toBeNull();
    expect(el.textContent).toContain("paiement sécurisé");
  });

  it("LOWBALL : prix_conseille « offre à tenter » + achat cible", () => {
    const el = frag(verdictBodyHtml(v({ verdict: "LOWBALL", verdict_label: "Tenter au culot" })));
    expect(el.querySelector(".ml-vd-hero-sub")?.textContent).toContain("offre à tenter");
    expect(el.textContent).toContain("Achat cible");
  });

  it("AVOID : buy_ceiling/optimal_buy en référence, pas de héros prix", () => {
    const el = frag(verdictBodyHtml(v({ verdict: "AVOID", verdict_label: "Passer" })));
    expect(el.textContent).toContain("ce qu'il faudrait");
    expect(el.querySelector(".ml-vd-hero-sub")).toBeNull();
  });

  it("base marché quand basis=percentile", () => {
    expect(frag(verdictBodyHtml(v({ basis: "percentile" }))).textContent).toContain("base marché");
  });

  it("badge modulation si applied (reason affichée)", () => {
    const el = frag(verdictBodyHtml(v({ modulation_applied: { applied: true, reason: "état pour pièces (−1)", notches_down: 1 } })));
    expect(el.querySelector(".ml-vd-mod")?.textContent).toContain("état pour pièces (−1)");
  });

  it("coût honnête : 1 cr débité / offert insufficient / cache", () => {
    expect(frag(verdictBodyHtml(v({ credits_charged: 1 }))).querySelector(".ml-vd-cost")?.textContent).toContain("1 cr débité");
    expect(frag(verdictBodyHtml(v({ credits_charged: 0, confidence_state: "insufficient" }))).querySelector(".ml-vd-cost")?.textContent).toContain("offert");
    expect(frag(verdictBodyHtml(v({ cached: true, credits_charged: 0 }))).querySelector(".ml-vd-cost")?.textContent).toContain("cache");
  });

  it("no_data : état vide honnête + « Non débité »", () => {
    const el = frag(verdictBodyHtml(v({ state: "no_data", verdict: null, verdict_label: null })));
    expect(el.textContent).toContain("Verdict indisponible");
    expect(el.querySelector(".ml-nodebit")?.textContent).toContain("Non débité");
  });

  it("toutes les warnings servies affichées (aucun disclaimer hardcodé extension)", () => {
    const el = frag(verdictBodyHtml(v({ warnings: ["W1 backend", "W2 backend"] })));
    expect(el.textContent).toContain("W1 backend");
    expect(el.textContent).toContain("W2 backend");
  });

  it("couleurs slug = tokens DA (== hex du brief)", () => {
    expect(VERDICT_COLOR.BUY).toBe("var(--green)");
    expect(VERDICT_COLOR.NEGOTIATE).toBe("var(--amber)");
    expect(VERDICT_COLOR.LOWBALL).toBe("var(--violet)");
    expect(VERDICT_COLOR.AVOID).toBe("var(--red)");
  });
});
