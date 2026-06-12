// src/content/classify.ts — classifieur d'intention DRIVÉ PAR RÈGLES (C2.b).
// Algorithme = contrat C1 à l'identique : normalisation serveur (lowercase + NFD + strip
// U+0300-036F), desc tronquée à desc_char_limit, familles par priority DESC, title_patterns
// puis (si aucun title-match global) desc_patterns, 1er match gagne ; veto_patterns (titre+desc)
// rejette la famille ; negation_patterns dans la fenêtre AVANT l'extrait annulent le match ;
// sinon règles numériques (placeholder / seuil symbolique / aberration) ; sinon "sale".
// Remplace l'ancien classifieur hardcodé (filters.ts).

import type { IntentGate } from "../lib/api-types";
import type { CompiledFamily, CompiledRuleSet } from "./intent-rules-client";

export interface IntentDecision {
  intent: string; // slug famille | "sale" | "symbolic_price"
  gate: IntentGate; // confirm | info | silent (silent => pas de bouton)
  should_signal: boolean;
  label: string; // libellé famille FR (vide pour sale / aberration)
  overlay_message: string;
  matched_flags: string[]; // "<title|desc|price>:<slug>:<extrait≤80>", ≤10
  rules_version: number;
  quantity: number;
}

const EXTRACT_MAX = 80;

function normalize(s: string): string {
  return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function trunc(s: string): string {
  const t = s.trim();
  return t.length > EXTRACT_MAX ? t.slice(0, EXTRACT_MAX) : t;
}

function vetoed(fam: CompiledFamily, titleN: string, descN: string): boolean {
  return fam.veto.some((r) => r.test(titleN) || r.test(descN));
}

function negatedBefore(text: string, idx: number, fam: CompiledFamily): boolean {
  if (fam.negation.length === 0) return false;
  const before = text.slice(Math.max(0, idx - fam.negation_window), idx);
  return fam.negation.some((r) => r.test(before));
}

/** 1er match non-veto + non-nié dans `patterns` sur `text`. Renvoie l'extrait brut ou null. */
function firstMatch(
  patterns: RegExp[],
  text: string,
  fam: CompiledFamily,
  titleN: string,
  descN: string,
): string | null {
  if (vetoed(fam, titleN, descN)) return null;
  for (const r of patterns) {
    const m = r.exec(text);
    if (m && m[0]) {
      if (negatedBefore(text, m.index, fam)) continue;
      return m[0];
    }
  }
  return null;
}

function familyBySlug(rules: CompiledRuleSet, slug: string): CompiledFamily | null {
  return rules.families.find((f) => f.slug === slug) ?? null;
}

function isSymbolic(price: number, cat: string | null, rules: CompiledRuleSet): boolean {
  if (price <= rules.symbolic_placeholder_max) return true;
  const t = cat
    ? (rules.symbolic_price_thresholds[cat] ?? rules.symbolic_price_thresholds.default)
    : rules.symbolic_price_thresholds.default;
  return price <= t;
}

function familyDecision(fam: CompiledFamily, flag: string, version: number, quantity: number): IntentDecision {
  return {
    intent: fam.slug,
    gate: fam.gate,
    should_signal: fam.should_signal,
    label: fam.label,
    overlay_message: fam.overlay_message,
    matched_flags: [flag],
    rules_version: version,
    quantity,
  };
}

function symbolicDecision(flag: string, rules: CompiledRuleSet): IntentDecision {
  const fam = familyBySlug(rules, "symbolic_price");
  return {
    intent: "symbolic_price",
    gate: fam?.gate ?? "confirm",
    should_signal: fam?.should_signal ?? false,
    label: fam?.label ?? "Prix symbolique",
    overlay_message: fam?.overlay_message ?? "Prix symbolique — prix non fiable",
    matched_flags: [flag],
    rules_version: rules.version,
    quantity: 1,
  };
}

// P1 : aberration prix (≥ seuil, hors mots-clés exemptés) -> "sale" + badge info d'avertissement
// (wording v1 verbatim repris de filters.ts), SANS gate confirm ni rapport.
function aberrationDecision(price: number, version: number): IntentDecision {
  return {
    intent: "sale",
    gate: "info",
    should_signal: false,
    label: "",
    overlay_message: "Prix suspect — erreur de saisie probable",
    matched_flags: [`price:aberration:${price}€`],
    rules_version: version,
    quantity: 1,
  };
}

// Vente normale : bouton affiché (gate info, badge vide), snapshot complet, signal passif.
function saleDecision(version: number): IntentDecision {
  return {
    intent: "sale",
    gate: "info",
    should_signal: true,
    label: "",
    overlay_message: "",
    matched_flags: [],
    rules_version: version,
    quantity: 1,
  };
}

export function classifyWithRules(
  rules: CompiledRuleSet,
  title: string,
  price: number | null,
  description: string | null,
  componentCategory: string | null,
): IntentDecision {
  const nt = normalize(title);
  const nd = normalize(description || "").slice(0, rules.desc_char_limit);

  // 1. Familles par priorité : tous les title_patterns d'abord, puis (si aucun) les desc_patterns.
  let famHit: { fam: CompiledFamily; flag: string } | null = null;
  for (const fam of rules.families) {
    const hit = firstMatch(fam.title, nt, fam, nt, nd);
    if (hit) {
      famHit = { fam, flag: `title:${fam.slug}:${trunc(hit)}` };
      break;
    }
  }
  if (!famHit) {
    for (const fam of rules.families) {
      const hit = firstMatch(fam.desc, nd, fam, nt, nd);
      if (hit) {
        famHit = { fam, flag: `desc:${fam.slug}:${trunc(hit)}` };
        break;
      }
    }
  }

  // Quantité (famille "multiple") : 1er capture group numérique du pattern matché.
  let quantity = 1;
  if (famHit && famHit.fam.slug === "multiple") {
    for (const r of famHit.fam.title) {
      const m = r.exec(nt);
      if (m && m[1]) {
        const q = parseInt(m[1], 10);
        if (q > 1 && q <= 10) {
          quantity = q;
          break;
        }
      }
    }
  }

  // 2. Aberration prix (override, fidèle v1) -> sale + avertissement.
  const exempt = rules.aberration_exempt_keywords.some((k) => nt.includes(k) || nd.includes(k));
  if (price !== null && price >= rules.price_aberration_min && !exempt) {
    return aberrationDecision(price, rules.version);
  }

  // 3. Placeholder / seuil symbolique : seulement si AUCUNE famille (ou vente).
  if (!famHit && price !== null) {
    if (price <= rules.symbolic_placeholder_max) return symbolicDecision(`price:placeholder:${price}€`, rules);
    if (isSymbolic(price, componentCategory, rules)) return symbolicDecision(`price:symbolic:${price}€`, rules);
  }

  // 4. Famille non-sale matchée -> elle ; sinon vente normale.
  if (famHit) return familyDecision(famHit.fam, famHit.flag, rules.version, quantity);
  return saleDecision(rules.version);
}
