// src/lib/intent-rules-logic.ts — logique PURE du cache de règles (testable sans I/O).
// Le SW fait le GET conditionnel (If-None-Match) ; cette fonction décide la MAJ du state.

import type { IntentRuleSet } from "./api-types";

export interface RulesCachePatch {
  intent_rules?: IntentRuleSet | null;
  intent_rules_etag?: string | null;
  intent_rules_version?: number | null;
  intent_rules_fetched_at?: number;
}

/**
 * Décide la mise à jour du cache à partir de l'issue d'un GET /config/intent-rules conditionnel :
 * - 304 (Not Modified) → on garde les règles existantes, on ne touche que `fetched_at`.
 * - 200 + corps valide  → on remplace règles + etag + version.
 * - autre / corps absent → `null` (ne RIEN écraser ; le content garde son fallback embarqué).
 */
export function nextRulesPatch(
  status: number,
  etag: string | null,
  body: IntentRuleSet | null,
  now: number,
): RulesCachePatch | null {
  if (status === 304) {
    return { intent_rules_fetched_at: now };
  }
  if (status === 200 && body && Array.isArray(body.families)) {
    return {
      intent_rules: body,
      intent_rules_etag: etag,
      intent_rules_version: typeof body.version === "number" ? body.version : null,
      intent_rules_fetched_at: now,
    };
  }
  return null;
}
