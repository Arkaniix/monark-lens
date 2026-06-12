// src/content/intent-rules-client.ts — accès aux règles de filtrage côté content.
// PROXY STRICT : le content ne fetch jamais ; il demande le rule set au SW (GET_INTENT_RULES,
// servi + caché ETag). Tant qu'aucun fetch n'a réussi, on retombe sur la COPIE EMBARQUÉE
// (intent-rules.fallback.json, snapshot du rule set v1) → `rules_version` honnête dans les rapports.
// Compilation DÉFENSIVE : chaque pattern dans try/catch new RegExp(p,"i") (pattern invalide =
// ignoré + warn, jamais de crash). Compilation MÉMOÏSÉE par version (compile 1×, réutilisée).
// Invariant MV3 : ce module est inliné dans content/main.js (l'import JSON est inliné par Vite,
// 0 import runtime conservé).

import type { IntentRuleFamily, IntentRuleSet } from "../lib/api-types";
import fallbackRules from "./intent-rules.fallback.json";

export interface CompiledFamily {
  slug: string;
  label: string;
  overlay_message: string;
  gate: "confirm" | "info" | "silent";
  should_signal: boolean;
  priority: number;
  title: RegExp[];
  desc: RegExp[];
  negation: RegExp[];
  negation_window: number;
  veto: RegExp[];
}

export interface CompiledRuleSet {
  version: number;
  desc_char_limit: number;
  default_intent: string;
  catch_all_intent: string;
  symbolic_price_thresholds: Record<string, number>;
  symbolic_placeholder_max: number;
  price_aberration_min: number;
  aberration_exempt_keywords: string[];
  families: CompiledFamily[]; // triées par priority DESC
}

const FALLBACK = fallbackRules as unknown as IntentRuleSet;

function compilePatterns(patterns: string[]): RegExp[] {
  const out: RegExp[] = [];
  for (const p of patterns) {
    try {
      out.push(new RegExp(p, "i"));
    } catch (e) {
      console.warn(`[Monark] intent-rules: pattern invalide ignoré: ${p}`, e);
    }
  }
  return out;
}

export function compileRuleSet(rs: IntentRuleSet): CompiledRuleSet {
  const families: CompiledFamily[] = [...rs.families]
    .sort((a, b) => b.priority - a.priority)
    .map((f: IntentRuleFamily) => ({
      slug: f.slug,
      label: f.label,
      overlay_message: f.overlay_message,
      gate: f.gate,
      should_signal: f.should_signal,
      priority: f.priority,
      title: compilePatterns(f.title_patterns),
      desc: compilePatterns(f.desc_patterns),
      negation: compilePatterns(f.negation_patterns),
      negation_window: f.negation_window_chars,
      veto: compilePatterns(f.veto_patterns),
    }));
  return {
    version: rs.version,
    desc_char_limit: rs.desc_char_limit,
    default_intent: rs.default_intent,
    catch_all_intent: rs.catch_all_intent,
    symbolic_price_thresholds: rs.symbolic_price_thresholds,
    symbolic_placeholder_max: rs.symbolic_placeholder_max,
    price_aberration_min: rs.price_aberration_min,
    aberration_exempt_keywords: rs.aberration_exempt_keywords,
    families,
  };
}

let memo: CompiledRuleSet | null = null;
let memoVersion = -1;

/** Récupère le rule set (SW caché → fallback embarqué), compile + mémoïse par version. */
export async function getCompiledRules(): Promise<CompiledRuleSet> {
  let rs: IntentRuleSet | null = null;
  try {
    rs = (await chrome.runtime.sendMessage({ type: "GET_INTENT_RULES" })) as IntentRuleSet | null;
  } catch {
    rs = null;
  }
  if (!rs || !Array.isArray(rs.families) || rs.families.length === 0) rs = FALLBACK;
  if (memo && memoVersion === rs.version) return memo;
  memo = compileRuleSet(rs);
  memoVersion = rs.version;
  return memo;
}

/** Réinitialise le mémo (utilisé par les tests). */
export function _resetRulesMemo(): void {
  memo = null;
  memoVersion = -1;
}
