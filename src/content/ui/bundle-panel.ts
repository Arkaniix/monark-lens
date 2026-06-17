// src/content/ui/bundle-panel.ts — rendu du panel BUNDLE (lot/PC décomposé, Phase B). PUR
// (corps HTML, sans header/context/footer fournis par l'overlay) → testable sans DOM.
// AUCUN texte disclaimer hardcodé : les warnings[] backend (incl. l'avertissement « plancher »)
// sont affichées telles quelles. ⚠️ Ne logge rien (title/description ne transitent pas ici).

import { icon } from "../../ui/icons";
import { VERDICT_COLOR } from "./verdict-panel";
import type { BundleResponse, BundleComponentLine } from "../../lib/api-types";

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}
function eur(n: number): string {
  return `${Math.round(n).toLocaleString("fr-FR")} €`;
}

// Libellés FR des catégories non valorisées (labels backend ⊂ ce set ; fallback = brut).
const CAT_LABEL: Record<string, string> = {
  gpu: "carte graphique",
  cpu: "processeur",
  ram: "RAM",
  ssd: "SSD",
  disque_dur: "disque dur",
  carte_mere: "carte mère",
  alimentation: "alimentation",
  ecran: "écran",
};
function catLabel(c: string): string {
  return CAT_LABEL[c] ?? c;
}

// Pastille de fiabilité par composant (confidence ∈ [0,1] côté moteur) — honnête, jamais chiffrée.
function confDot(conf: number | null): string {
  if (conf == null) return "";
  const color = conf >= 0.66 ? "var(--green)" : conf >= 0.33 ? "var(--amber)" : "var(--zinc-500)";
  const tier = conf >= 0.66 ? "fiabilité élevée" : conf >= 0.33 ? "fiabilité moyenne" : "fiabilité faible";
  return `<span class="ml-bd-conf" style="background:${color}" title="${tier}"></span>`;
}

function componentRow(c: BundleComponentLine): string {
  const name = esc(c.component_name || `Composant #${c.component_id}`);
  const cat = c.category ? `<span class="ml-bd-cat">${esc(c.category)}</span>` : "";
  if (c.status !== "ok" || c.fair_value == null) {
    return (
      `<div class="ml-line ml-bd-comp"><span class="ml-line-k">${name}${cat}</span>` +
      `<span class="ml-line-v ml-bd-nodata">données insuffisantes</span></div>`
    );
  }
  // Valeur retenue = fair_value (contribution au lot) ; médiane vendue en repère muet secondaire.
  const med = c.median != null ? `<span class="ml-bd-med ml-num">méd. ${esc(eur(c.median))}</span>` : "";
  return (
    `<div class="ml-line ml-bd-comp"><span class="ml-line-k">${name}${cat}${confDot(c.confidence)}</span>` +
    `<span class="ml-line-v ml-bd-val">${med}<span class="ml-num">${esc(eur(c.fair_value))}</span></span></div>`
  );
}

/** Pill verdict avec FRAMING PLANCHER ASYMÉTRIQUE (couverture partielle). */
function pillHtml(b: BundleResponse): string {
  const partial = b.unrecognized_categories.length > 0;
  const slug = b.verdict || "";
  let label: string;
  let color: string;
  if (partial && (slug === "LOWBALL" || slug === "AVOID")) {
    // Couverture partielle + verdict négatif : NE PAS afficher de rouge tranchant (le « cher »
    // peut venir des composants manquants) → cadrage plancher honnête, ton ambre.
    label = "Valorisation partielle · plancher";
    color = "var(--amber)";
  } else {
    label = b.verdict_label || slug || "—";
    color = VERDICT_COLOR[slug] ?? "var(--zinc-400)";
    if (partial && (slug === "BUY" || slug === "NEGOTIATE")) label += " · + composants non valorisés";
  }
  return (
    `<div class="ml-vd-head"><span class="ml-verdict" style="color:${color};` +
    `border:1px solid color-mix(in srgb, ${color} 33%, transparent);` +
    `background:color-mix(in srgb, ${color} 8%, transparent)">${esc(label)}</span></div>`
  );
}

function analysisHtml(b: BundleResponse): string {
  const ba = b.bundle_analysis;
  if (!ba) return "";
  const rows =
    (ba.bundle_fair_value != null
      ? `<div class="ml-line"><span class="ml-line-k">Valeur estimée du lot</span><span class="ml-line-v ml-num">${esc(eur(ba.bundle_fair_value))}</span></div>`
      : "") +
    `<div class="ml-line"><span class="ml-line-k">Prix demandé</span><span class="ml-line-v ml-num">${esc(eur(ba.total_price))}</span></div>` +
    (ba.bundle_discount_pct != null
      ? `<div class="ml-line"><span class="ml-line-k">Décote lot</span><span class="ml-line-v ml-num">−${esc(String(ba.bundle_discount_pct))} %</span></div>`
      : "");
  return `<div class="ml-card">${rows}</div>`;
}

function unrecognizedHtml(b: BundleResponse): string {
  if (b.unrecognized_categories.length === 0) return "";
  const chips = b.unrecognized_categories
    .map((c) => `<span class="ml-bd-unrec">${esc(catLabel(c))}</span>`)
    .join("");
  return (
    `<div class="ml-note ml-bd-unrec-box"><span class="ml-note-title">Détecté mais non valorisé</span>` +
    `${chips}<div class="ml-bd-floor">La valeur du lot est un PLANCHER — ces composants ajoutent de la valeur non comptée.</div></div>`
  );
}

function warningsHtml(b: BundleResponse): string {
  if (!b.warnings || b.warnings.length === 0) return "";
  return `<div class="ml-vd-warn">` + b.warnings.map((w) => `<div>${icon("alert-triangle")} ${esc(w)}</div>`).join("") + `</div>`;
}

function costHtml(b: BundleResponse): string {
  let txt: string;
  if (b.cached) txt = "résultat récent (cache, 0 cr)";
  else if (b.credits_charged === 0) txt = "offert — couverture limitée";
  else txt = `${b.credits_charged} cr débité${b.credits_charged > 1 ? "s" : ""}`;
  return `<div class="ml-vd-cost">${esc(txt)}</div>`;
}

/** Corps du panel bundle. L'overlay l'enveloppe (header + context + footer + bouton retour). */
export function bundleBodyHtml(b: BundleResponse): string {
  if (b.state === "no_data") {
    return (
      `<div class="ml-note"><span class="ml-note-title">Lot non évaluable</span>` +
      `Aucun composant du lot n'a de données de marché.` +
      `<span class="ml-nodebit">Non débité</span></div>` +
      unrecognizedHtml(b) +
      warningsHtml(b) +
      costHtml(b)
    );
  }
  const comps = b.components.length
    ? `<div class="ml-card ml-bd-list">${b.components.map(componentRow).join("")}</div>`
    : "";
  if (b.state === "insufficient") {
    // Données/confiance insuffisantes pour un verdict FERME sur le lot : on supprime la pill colorée
    // (anti-survente — le backend renvoie 0 cr ici) ET l'agrégat « valeur du lot », mais on garde le
    // détail PAR composant (chiffres réels) + le non-débit honnête. Calque des « états honnêtes » snapshot.
    return (
      `<div class="ml-note"><span class="ml-note-title">Analyse limitée</span>` +
      `Données insuffisantes pour un verdict ferme sur ce lot.` +
      `<span class="ml-nodebit">Non débité</span></div>` +
      comps +
      unrecognizedHtml(b) +
      warningsHtml(b) +
      costHtml(b)
    );
  }
  return pillHtml(b) + analysisHtml(b) + comps + unrecognizedHtml(b) + warningsHtml(b) + costHtml(b);
}
