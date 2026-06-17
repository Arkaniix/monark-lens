// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";

import type { BundleResponse, BundleComponentLine } from "../../lib/api-types";
import { bundleBodyHtml } from "./bundle-panel";

function comp(over: Partial<BundleComponentLine> = {}): BundleComponentLine {
  return {
    component_id: 1216, component_name: "RTX 3080 10 Go", category: "GPU",
    status: "ok", median: 360, fair_value: 345, confidence: 0.72, ...over,
  };
}
function b(over: Partial<BundleResponse> = {}): BundleResponse {
  return {
    ad_hash: "a".repeat(64), state: "ok", cached: false,
    components: [comp(), comp({ component_id: 49, component_name: "i7 12700K", category: "CPU", median: 250, fair_value: 243, confidence: 0.55 })],
    bundle_analysis: {
      sum_individual_fair_values: 588, bundle_discount_pct: 8, bundle_fair_value: 541,
      total_price: 900, price_vs_bundle_fair_pct: 66, savings_vs_individual_eur: -359, savings_vs_individual_pct: -61,
    },
    unrecognized_categories: [], verdict: "AVOID", verdict_label: "Passer",
    confidence_state: "sufficient",
    warnings: ["estimation indicative — vérifiez l'annonce et privilégiez le paiement sécurisé"],
    credits_charged: 1, credits_remaining: 40, ...over,
  };
}
function frag(html: string): HTMLElement {
  const d = document.createElement("div");
  d.innerHTML = html;
  return d;
}

describe("bundle-panel — breakdown composants (nom/cat/médiane/fair_value/statut/confiance)", () => {
  it("ligne ok : fair_value primaire + médiane muette + catégorie + pastille confiance", () => {
    const el = frag(bundleBodyHtml(b({ unrecognized_categories: [], verdict: "BUY", verdict_label: "Foncer" })));
    expect(el.textContent).toContain("RTX 3080 10 Go");
    expect(el.querySelector(".ml-bd-cat")?.textContent).toContain("GPU");
    expect(el.textContent).toContain("345"); // fair_value
    expect(el.textContent).toContain("méd. 360"); // médiane secondaire
    expect(el.querySelector(".ml-bd-conf")).not.toBeNull(); // pastille confiance
  });

  it("composant sans ancre marché -> « données insuffisantes » (pas de prix inventé)", () => {
    const el = frag(bundleBodyHtml(b({ components: [comp({ status: "no_data", median: null, fair_value: null, confidence: null })] })));
    expect(el.querySelector(".ml-bd-nodata")?.textContent).toContain("données insuffisantes");
    expect(el.querySelector(".ml-bd-conf")).toBeNull(); // pas de pastille sans confidence
  });

  it("bloc analyse : valeur lot + prix demandé + décote", () => {
    const el = frag(bundleBodyHtml(b()));
    expect(el.textContent).toContain("Valeur estimée du lot");
    expect(el.textContent).toContain("541");
    expect(el.textContent).toContain("Prix demandé");
    expect(el.textContent).toContain("900");
    expect(el.textContent).toContain("Décote lot");
  });
});

describe("bundle-panel — FRAMING PLANCHER ASYMÉTRIQUE", () => {
  it("unrecognized vide + BUY -> pill 4-slug colorée (vert), AUCUN « plancher »", () => {
    const el = frag(bundleBodyHtml(b({ unrecognized_categories: [], verdict: "BUY", verdict_label: "Foncer" })));
    const pill = el.querySelector(".ml-verdict");
    expect(pill?.textContent).toBe("Foncer");
    expect(pill?.getAttribute("style")).toContain("var(--green)");
    expect(el.textContent).not.toContain("plancher");
  });

  it("unrecognized non-vide + NEGOTIATE -> verdict coloré CONSERVÉ + « + composants non valorisés »", () => {
    const el = frag(bundleBodyHtml(b({ unrecognized_categories: ["ram"], verdict: "NEGOTIATE", verdict_label: "Négocier" })));
    const pill = el.querySelector(".ml-verdict");
    expect(pill?.textContent).toContain("Négocier");
    expect(pill?.textContent).toContain("+ composants non valorisés");
    expect(pill?.getAttribute("style")).toContain("var(--amber)");
  });

  it("unrecognized non-vide + AVOID -> pill « Valorisation partielle · plancher » (ambre), PAS « Passer » rouge", () => {
    const el = frag(bundleBodyHtml(b({ unrecognized_categories: ["ram", "carte_mere"], verdict: "AVOID", verdict_label: "Passer" })));
    const pill = el.querySelector(".ml-verdict");
    expect(pill?.textContent).toBe("Valorisation partielle · plancher");
    expect(pill?.getAttribute("style")).toContain("var(--amber)");
    expect(pill?.textContent).not.toContain("Passer");
  });

  it("unrecognized non-vide + LOWBALL -> aussi « Valorisation partielle · plancher »", () => {
    const el = frag(bundleBodyHtml(b({ unrecognized_categories: ["ssd"], verdict: "LOWBALL", verdict_label: "Tenter au culot" })));
    expect(el.querySelector(".ml-verdict")?.textContent).toBe("Valorisation partielle · plancher");
  });

  it("unrecognized vide + AVOID -> pill « Passer » rouge normale (pas de plancher)", () => {
    const el = frag(bundleBodyHtml(b({ unrecognized_categories: [], verdict: "AVOID", verdict_label: "Passer" })));
    const pill = el.querySelector(".ml-verdict");
    expect(pill?.textContent).toBe("Passer");
    expect(pill?.getAttribute("style")).toContain("var(--red)");
  });

  it("chips catégories non valorisées + libellés FR (carte_mere -> « carte mère ») + texte plancher", () => {
    const el = frag(bundleBodyHtml(b({ unrecognized_categories: ["carte_mere", "ram"], verdict: "AVOID", verdict_label: "Passer" })));
    expect(el.querySelector(".ml-bd-unrec-box")).not.toBeNull();
    expect(el.textContent).toContain("carte mère");
    expect(el.textContent).toContain("RAM");
    expect(el.querySelector(".ml-bd-floor")?.textContent).toContain("PLANCHER");
  });
});

describe("bundle-panel — warnings, coût honnête, no_data", () => {
  it("toutes les warnings backend affichées (aucun disclaimer hardcodé extension)", () => {
    const el = frag(bundleBodyHtml(b({ warnings: ["W1 backend", "W2 plancher backend"] })));
    expect(el.textContent).toContain("W1 backend");
    expect(el.textContent).toContain("W2 plancher backend");
  });

  it("coût honnête : 1 cr débité / offert (couverture limitée) / cache", () => {
    expect(frag(bundleBodyHtml(b({ credits_charged: 1, cached: false }))).querySelector(".ml-vd-cost")?.textContent).toContain("1 cr débité");
    expect(frag(bundleBodyHtml(b({ credits_charged: 0, cached: false }))).querySelector(".ml-vd-cost")?.textContent).toContain("offert");
    expect(frag(bundleBodyHtml(b({ cached: true, credits_charged: 0 }))).querySelector(".ml-vd-cost")?.textContent).toContain("cache");
  });

  it("state insufficient : « Analyse limitée » + « Non débité », PAS de pill ferme (anti-survente) malgré verdict backend, détail conservé", () => {
    const el = frag(bundleBodyHtml(b({ state: "insufficient", verdict: "AVOID", verdict_label: "Passer", confidence_state: "insufficient", credits_charged: 0 })));
    expect(el.textContent).toContain("Analyse limitée");
    expect(el.querySelector(".ml-nodebit")?.textContent).toContain("Non débité");
    expect(el.querySelector(".ml-verdict")).toBeNull(); // aucun verdict ferme affiché bien que le backend en envoie un
    expect(el.textContent).toContain("RTX 3080 10 Go"); // breakdown par composant préservé (chiffres réels)
  });

  it("state no_data : « Lot non évaluable » + « Non débité » + pas de pill verdict", () => {
    const el = frag(bundleBodyHtml(b({ state: "no_data", verdict: null, verdict_label: null, components: [], bundle_analysis: null })));
    expect(el.textContent).toContain("Lot non évaluable");
    expect(el.querySelector(".ml-nodebit")?.textContent).toContain("Non débité");
    expect(el.querySelector(".ml-verdict")).toBeNull();
  });
});
