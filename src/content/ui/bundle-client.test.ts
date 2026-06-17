import { describe, expect, it } from "vitest";

import type { IntentDecision } from "../classify";
import type { ListingContext } from "./snapshot-client";
import { buildBundleMsg } from "./bundle-client";

const DEC: IntentDecision = {
  intent: "bundle", gate: "confirm", should_signal: false, label: "lot / PC complet",
  overlay_message: "", matched_flags: [], rules_version: 1, quantity: 1,
};
function ctx(over: Partial<ListingContext> = {}): ListingContext {
  return {
    platform: "leboncoin", url: "https://www.leboncoin.fr/ad/x/1", componentId: 3,
    componentName: "RTX 3060", askingPrice: 900, condition: "good", intent: DEC,
    publishedAt: null, title: "PC Gamer RTX 3080 + i7 12700K", description: "Tour complète…", ...over,
  };
}

describe("bundle-client — buildBundleMsg (lot/PC : résolution serveur, PAS de component_id)", () => {
  it("total_price = askingPrice (prix du LOT entier, ≠ asking mono)", () => {
    const m = buildBundleMsg(ctx({ askingPrice: 900 }));
    expect(m.type).toBe("GET_BUNDLE");
    expect(m.total_price).toBe(900);
  });

  it("AUCUN component_id (le serveur résout depuis title+description)", () => {
    const m = buildBundleMsg(ctx());
    expect("component_id" in m).toBe(false);
  });

  it("forwarde title ET description live (in-request only)", () => {
    const m = buildBundleMsg(ctx({ title: "Lot 3080 + 12700K", description: "carte mère B660 + 32 Go" }));
    expect(m.title).toBe("Lot 3080 + 12700K");
    expect(m.description).toBe("carte mère B660 + 32 Go");
  });

  it("description absente -> champ omis", () => {
    const m = buildBundleMsg(ctx({ description: null }));
    expect("description" in m).toBe(false);
  });

  it("LBC good + publishedAt -> condition + listing_age_days", () => {
    const m = buildBundleMsg(ctx({ condition: "good", publishedAt: "2026-06-01" }));
    expect(m.platform).toBe("leboncoin");
    expect(m.condition).toBe("good");
    expect(typeof m.listing_age_days).toBe("number");
  });

  it("eBay fair sans date -> occasion, PAS de listing_age_days, platform mappée", () => {
    const m = buildBundleMsg(ctx({ platform: "ebay", condition: "fair", publishedAt: null }));
    expect(m.platform).toBe("ebay");
    expect(m.condition).toBe("occasion");
    expect("listing_age_days" in m).toBe(false);
  });

  it("plateforme inconnue -> other ; condition null -> champ absent", () => {
    const m = buildBundleMsg(ctx({ platform: "backmarket", condition: null }));
    expect(m.platform).toBe("other");
    expect("condition" in m).toBe(false);
  });

  it("l'URL brute reste dans le message (hashée -> ad_hash SW-side, jamais fetch ici)", () => {
    const m = buildBundleMsg(ctx());
    expect(m.url).toContain("leboncoin");
  });
});
