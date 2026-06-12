import { describe, expect, it } from "vitest";

import type { IntentRuleSet } from "./api-types";
import { nextRulesPatch } from "./intent-rules-logic";

const RS = { version: 2, families: [], desc_char_limit: 2000 } as unknown as IntentRuleSet;

describe("nextRulesPatch — GET conditionnel /config/intent-rules", () => {
  it("304 -> ne touche que fetched_at (garde règles + etag existants)", () => {
    expect(nextRulesPatch(304, 'W/"x"', null, 123)).toEqual({ intent_rules_fetched_at: 123 });
  });
  it("200 + corps valide -> remplace règles + etag + version", () => {
    expect(nextRulesPatch(200, 'W/"v2"', RS, 999)).toEqual({
      intent_rules: RS,
      intent_rules_etag: 'W/"v2"',
      intent_rules_version: 2,
      intent_rules_fetched_at: 999,
    });
  });
  it("200 sans corps -> null (ne rien écraser)", () => {
    expect(nextRulesPatch(200, "e", null, 1)).toBeNull();
  });
  it("500 / erreur réseau -> null", () => {
    expect(nextRulesPatch(500, null, null, 1)).toBeNull();
  });
  it("200 corps sans families[] -> null (corps invalide)", () => {
    expect(nextRulesPatch(200, "e", { version: 3 } as unknown as IntentRuleSet, 1)).toBeNull();
  });
});
