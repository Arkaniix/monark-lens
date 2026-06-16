import { describe, expect, it } from "vitest";

import type { IntentDecision } from "../classify";
import type { ListingContext } from "./snapshot-client";
import { ageFromPublishedAt, buildVerdictMsg, mapCondition, mapPlatform } from "./verdict-client";

const DEC: IntentDecision = {
  intent: "sale", gate: "info", should_signal: true, label: "",
  overlay_message: "", matched_flags: [], rules_version: 1, quantity: 1,
};
function ctx(over: Partial<ListingContext> = {}): ListingContext {
  return {
    platform: "leboncoin", url: "https://www.leboncoin.fr/ad/x/1", componentId: 3,
    componentName: "RTX 3060", askingPrice: 265, condition: "good", intent: DEC,
    publishedAt: null, title: "MSI RTX 3060 12GB", ...over,
  };
}

describe("verdict-client — mapping condition (fair→occasion, poor→for_parts, absent→omis)", () => {
  it("mappe les 5 états", () => {
    expect(mapCondition("new")).toBe("new");
    expect(mapCondition("like_new")).toBe("like_new");
    expect(mapCondition("good")).toBe("good");
    expect(mapCondition("fair")).toBe("occasion");
    expect(mapCondition("poor")).toBe("for_parts");
  });
  it("null / inconnu -> undefined (omis)", () => {
    expect(mapCondition(null)).toBeUndefined();
    expect(mapCondition(undefined)).toBeUndefined();
    expect(mapCondition("garbage")).toBeUndefined();
  });
});

describe("verdict-client — mapping platform (défaut other)", () => {
  it("plateformes connues 1:1", () => {
    for (const p of ["ebay", "leboncoin", "vinted", "other"]) expect(mapPlatform(p)).toBe(p);
  });
  it("inconnue -> other", () => {
    expect(mapPlatform("backmarket")).toBe("other");
  });
});

describe("verdict-client — ageFromPublishedAt (bornes + omission)", () => {
  const NOW = Date.parse("2026-06-12T00:00:00Z");
  it("null -> undefined (eBay/Vinted)", () => {
    expect(ageFromPublishedAt(null, NOW)).toBeUndefined();
    expect(ageFromPublishedAt(undefined, NOW)).toBeUndefined();
  });
  it("date invalide -> undefined", () => {
    expect(ageFromPublishedAt("pas-une-date", NOW)).toBeUndefined();
  });
  it("12 jours -> 12", () => {
    expect(ageFromPublishedAt("2026-05-31", NOW)).toBe(12);
  });
  it("clamp bas 0 (date future)", () => {
    expect(ageFromPublishedAt("2027-01-01", NOW)).toBe(0);
  });
  it("clamp haut 3650 (très vieille annonce)", () => {
    expect(ageFromPublishedAt("2000-01-01", NOW)).toBe(3650);
  });
});

describe("verdict-client — buildVerdictMsg", () => {
  it("LBC good + publishedAt -> condition + listing_age_days", () => {
    const m = buildVerdictMsg(ctx({ condition: "good", publishedAt: "2026-06-01", askingPrice: 265 }));
    expect(m.type).toBe("GET_VERDICT");
    expect(m.platform).toBe("leboncoin");
    expect(m.condition).toBe("good");
    expect(typeof m.listing_age_days).toBe("number");
    expect(m.component_id).toBe(3);
    expect(m.asking_price).toBe(265);
    expect(m.url).toContain("leboncoin");
  });
  it("eBay poor sans date -> for_parts, PAS de listing_age_days", () => {
    const m = buildVerdictMsg(ctx({ platform: "ebay", condition: "poor", publishedAt: null }));
    expect(m.platform).toBe("ebay");
    expect(m.condition).toBe("for_parts");
    expect("listing_age_days" in m).toBe(false);
  });
  it("condition null -> champ condition absent", () => {
    const m = buildVerdictMsg(ctx({ condition: null }));
    expect("condition" in m).toBe(false);
  });
  it("forwarde le titre live (override VRAM serveur 2C) — aucune résolution VRAM client", () => {
    const m = buildVerdictMsg(ctx({ title: "MSI RTX 3080 10 Go Gaming" }));
    expect(m.title).toBe("MSI RTX 3080 10 Go Gaming");
    // le component_id reste celui résolu côté extension : c'est le serveur qui override
    expect(m.component_id).toBe(3);
  });
});
