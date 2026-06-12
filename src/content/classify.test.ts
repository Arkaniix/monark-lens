// Tests du classifieur drivé par règles, exécutés sur le RULE SET RÉEL
// (intent-rules.fallback.json = snapshot du payload servi en 0.0).
import { describe, expect, it } from "vitest";

import type { IntentRuleSet } from "../lib/api-types";
import { classifyWithRules } from "./classify";
import fallback from "./intent-rules.fallback.json";
import { compileRuleSet } from "./intent-rules-client";

const RULES = compileRuleSet(fallback as unknown as IntentRuleSet);

function c(title: string, price: number | null = 200, desc: string | null = null, cat: string | null = "gpu") {
  return classifyWithRules(RULES, title, price, desc, cat);
}

describe("classifyWithRules — sur le rule set réel (fallback embarqué)", () => {
  it("vente standard -> sale, should_signal=true, gate info, 0 flag", () => {
    const r = c("RTX 3060 Ti 8GB OC");
    expect(r.intent).toBe("sale");
    expect(r.should_signal).toBe(true);
    expect(r.gate).toBe("info");
    expect(r.matched_flags).toEqual([]);
  });

  it("wanted (titre) -> gate confirm, signal false, flag title:wanted:*", () => {
    const r = c("Cherche RTX 3060");
    expect(r.intent).toBe("wanted");
    expect(r.gate).toBe("confirm");
    expect(r.should_signal).toBe(false);
    expect(r.matched_flags[0]).toMatch(/^title:wanted:/);
  });

  it("broken -> confirm + should_signal true", () => {
    const r = c("RTX 3070 HS pour pièces");
    expect(r.intent).toBe("broken");
    expect(r.gate).toBe("confirm");
    expect(r.should_signal).toBe(true);
  });

  it("broken — fenêtre de négation annule le match (sans artefact)", () => {
    const r = c("RTX 3060 sans artefact");
    expect(r.intent).toBe("sale");
  });

  it("broken — veto absolu (dead = titre de jeu)", () => {
    expect(c("Dead Space edition collector", 30).intent).not.toBe("broken");
  });

  it("wanted — veto contexte de vente (facture d'achat, desc-side)", () => {
    const r = c("RTX 3060", 200, "je recherche la facture d'achat fournie");
    expect(r.intent).toBe("sale");
  });

  it("priorité : bundle (titre) gagne", () => {
    const r = c("PC Gamer RTX 3060 complet");
    expect(r.intent).toBe("bundle");
    expect(r.gate).toBe("confirm");
  });

  it("laptop fusionné dans bundle (arbitrage A)", () => {
    expect(c("PC portable Legion RTX 3060").intent).toBe("bundle");
  });

  it("photo_scam (net-new) -> confirm + signal", () => {
    const r = c("RTX 3060 photo imprimée", 100);
    expect(r.intent).toBe("photo_scam");
    expect(r.gate).toBe("confirm");
    expect(r.should_signal).toBe(true);
  });

  it("placeholder prix (1€) -> symbolic_price, flag price:placeholder", () => {
    const r = c("RTX 3060", 1);
    expect(r.intent).toBe("symbolic_price");
    expect(r.matched_flags).toEqual(["price:placeholder:1€"]);
  });

  it("seuil symbolique (gpu ≤15€) -> symbolic_price, flag price:symbolic", () => {
    const r = c("RTX 3060", 10);
    expect(r.intent).toBe("symbolic_price");
    expect(r.matched_flags).toEqual(["price:symbolic:10€"]);
  });

  it("aberration (≥20000, P1) -> sale + gate info + flag price:aberration, sans signal", () => {
    const r = c("RTX 3060", 25000);
    expect(r.intent).toBe("sale");
    expect(r.gate).toBe("info");
    expect(r.should_signal).toBe(false);
    expect(r.overlay_message).toMatch(/suspect/i);
    expect(r.matched_flags).toEqual(["price:aberration:25000€"]);
  });

  it("aberration exemptée (serveur) -> pas d'override aberration", () => {
    expect(c("Serveur RTX 3060", 25000).matched_flags).not.toContain("price:aberration:25000€");
  });

  it("multiple -> quantité extraite du capture group", () => {
    const r = c("Lot de 3 RTX 3060");
    expect(r.intent).toBe("multiple");
    expect(r.quantity).toBe(3);
  });

  it("test_spam -> gate silent (pas de bouton)", () => {
    expect(c("aaaa", 200).gate).toBe("silent");
  });

  it("format flag + extrait tronqué ≤80", () => {
    const flag = c("RTX 3060 HS").matched_flags[0];
    const parts = flag.split(":");
    expect(["title", "desc", "price"]).toContain(parts[0]);
    expect(parts.slice(2).join(":").length).toBeLessThanOrEqual(80);
  });

  it("rules_version = version servie", () => {
    expect(c("RTX 3060").rules_version).toBe(RULES.version);
  });
});
