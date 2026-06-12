// src/content/ui/verdict-panel.ts — rendu du panel verdict (B2.c). PUR (corps HTML, sans
// header/context/footer fournis par l'overlay) → testable sans DOM. AUCUN texte disclaimer
// hardcodé : toutes les warnings[] servies par le backend sont affichées telles quelles.

import { icon } from "../../ui/icons";
import type { VerdictResponse } from "../../lib/api-types";

// Couleurs par slug = tokens DA (identiques aux hex du brief : #10B981/#F59E0B/#8B5CF6/#EF4444).
export const VERDICT_COLOR: Record<string, string> = {
  BUY: "var(--green)",
  NEGOTIATE: "var(--amber)",
  LOWBALL: "var(--violet)",
  AVOID: "var(--red)",
};

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}
function eur(n: number): string {
  return `${Math.round(n).toLocaleString("fr-FR")} €`;
}
function row(k: string, val: string): string {
  return `<div class="ml-line"><span class="ml-line-k">${esc(k)}</span><span class="ml-line-v ml-num">${esc(val)}</span></div>`;
}
function hero(color: string, value: string, sub: string): string {
  return `<div class="ml-vd-hero ml-num" style="color:${color}">${esc(value)}<span class="ml-vd-hero-sub">${esc(sub)}</span></div>`;
}

/** Chiffres monospace mis en avant SELON le verdict (B2.c). */
function numbersHtml(v: VerdictResponse): string {
  const slug = v.verdict || "";
  const color = VERDICT_COLOR[slug] ?? "var(--zinc-300)";
  if (slug === "BUY") {
    // BUY : pas de prix à négocier — message d'action ; les warnings (disclaimer) sont centrales.
    return `<div class="ml-vd-hero" style="color:${color}">À ce prix, foncez.</div>`;
  }
  if (slug === "NEGOTIATE") {
    let h = v.prix_conseille != null ? hero(color, eur(v.prix_conseille), "prix conseillé") : "";
    const rows =
      (v.buy_ceiling != null ? row("Plafond marge 20 %", eur(v.buy_ceiling)) : "") +
      (v.optimal_buy != null ? row("Achat cible", eur(v.optimal_buy)) : "");
    if (rows) h += `<div class="ml-card">${rows}</div>`;
    return h;
  }
  if (slug === "LOWBALL") {
    let h = v.prix_conseille != null ? hero(color, eur(v.prix_conseille), "offre à tenter") : "";
    if (v.optimal_buy != null) h += `<div class="ml-card">${row("Achat cible", eur(v.optimal_buy))}</div>`;
    return h;
  }
  // AVOID — buy_ceiling / optimal_buy en référence « ce qu'il faudrait ».
  const rows =
    (v.buy_ceiling != null ? row("Plafond (ce qu'il faudrait)", eur(v.buy_ceiling)) : "") +
    (v.optimal_buy != null ? row("Achat cible (réf.)", eur(v.optimal_buy)) : "");
  return rows ? `<div class="ml-card">${rows}</div>` : "";
}

function basisTag(v: VerdictResponse): string {
  if (!v.basis) return "";
  return `<span class="ml-vd-basis">${esc(v.basis === "margin" ? "base marge" : "base marché")}</span>`;
}

function modulationHtml(v: VerdictResponse): string {
  const m = v.modulation_applied;
  if (!m || !m.applied || !m.reason) return "";
  return `<div class="ml-vd-mod">${icon("alert-triangle")} ${esc(m.reason)}</div>`;
}

function warningsHtml(v: VerdictResponse, emphatic: boolean): string {
  if (!v.warnings || v.warnings.length === 0) return "";
  const cls = emphatic ? "ml-vd-warn ml-vd-warn-strong" : "ml-vd-warn";
  return `<div class="${cls}">` + v.warnings.map((w) => `<div>${icon("alert-triangle")} ${esc(w)}</div>`).join("") + `</div>`;
}

function costHtml(v: VerdictResponse): string {
  let txt: string;
  if (v.cached) txt = "résultat récent (cache, 0 cr)";
  else if (v.credits_charged === 0 && v.confidence_state === "insufficient") txt = "offert — données limitées";
  else if (v.credits_charged > 0) txt = `${v.credits_charged} cr débité${v.credits_charged > 1 ? "s" : ""}`;
  else txt = "0 cr";
  return `<div class="ml-vd-cost">${esc(txt)}</div>`;
}

/** Corps du panel verdict. L'overlay l'enveloppe (header + context + footer + bouton retour). */
export function verdictBodyHtml(v: VerdictResponse): string {
  if (v.state === "no_data") {
    return (
      `<div class="ml-note"><span class="ml-note-title">Verdict indisponible</span>` +
      `Aucune donnée de marché pour ce composant.` +
      `<span class="ml-nodebit">Non débité</span></div>` +
      warningsHtml(v, false) +
      costHtml(v)
    );
  }
  const slug = v.verdict || "";
  const color = VERDICT_COLOR[slug] ?? "var(--zinc-400)";
  const pill = v.verdict_label
    ? `<div class="ml-vd-head">` +
      `<span class="ml-verdict" style="color:${color};border:1px solid color-mix(in srgb, ${color} 33%, transparent);` +
      `background:color-mix(in srgb, ${color} 8%, transparent)">${esc(v.verdict_label)}</span>` +
      basisTag(v) +
      `</div>`
    : "";
  const desc = v.verdict_description ? `<div class="ml-vd-desc">${esc(v.verdict_description)}</div>` : "";
  const emphatic = slug === "BUY"; // disclaimer = message central du verdict BUY
  return pill + desc + numbersHtml(v) + modulationHtml(v) + warningsHtml(v, emphatic) + costHtml(v);
}
