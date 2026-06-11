// src/content/ui/overlay.ts — overlay RÉSULTAT (~360px, shadow closed) — ÉTAPE 3.
// Rend honnêtement les 6 états du contrat snapshot + actions Estimer/Signaler/Alerte/
// Watchlist. AUCUN overlay spontané : ouvert uniquement sur clic du bouton passif.
// Le header rappelle TOUJOURS component_name + prix demandé (garde-fou faux-match).

import { injectStyles } from "./styles";
import { verdictMeta } from "../../ui/verdict";
import { buildEstimateUrl } from "../../ui/deeplink";
import { requestSnapshot } from "./snapshot-client";
import type { ListingContext, SnapshotOutcome } from "./snapshot-client";
import type { ConsensusResponse, SnapshotResponse } from "../../lib/api-types";
import type {
  AddWatchlistMsg,
  CreateAlertMsg,
  GetConsensusMsg,
  SubmitFlagMsg,
} from "../../lib/messages";

const HOST_ID = "monark-lens-overlay";
const MONARK_WEB_URL = "https://monark-market.fr"; // SYNC: src/lib/constants.ts

/** 14 anomalies « Signaler » — codes + libellés VERBATIM dist v1 (showFlagSelector). */
export const FLAG_OPTIONS: ReadonlyArray<{ type: string; icon: string; label: string }> = [
  { type: "broken", icon: "⚠️", label: "Composant HS / pour pièces" },
  { type: "bundle", icon: "🖥️", label: "PC complet / bundle" },
  { type: "box_only", icon: "📦", label: "Boîte / emballage seul" },
  { type: "trade", icon: "🔄", label: "Échange / troc" },
  { type: "wanted", icon: "🔎", label: "Demande d'achat" },
  { type: "mining", icon: "⛏️", label: "Ex-minage" },
  { type: "accessory", icon: "🔧", label: "Accessoire uniquement" },
  { type: "symbolic_price", icon: "💬", label: "Prix symbolique / à négocier" },
  { type: "reserved", icon: "🔒", label: "Réservé / vendu" },
  { type: "multiple", icon: "📦", label: "Lot / quantité multiple" },
  { type: "rental", icon: "🏠", label: "Location" },
  { type: "rma_refurb", icon: "🔄", label: "Reconditionné / RMA" },
  { type: "professional", icon: "🏪", label: "Vendeur professionnel" },
  { type: "other", icon: "❓", label: "Autre anomalie" },
];

/** type → libellé (réutilise les 14 anomalies pour le bandeau consensus). */
const FLAG_LABELS: Record<string, string> = Object.fromEntries(FLAG_OPTIONS.map((o) => [o.type, o.label]));

export interface ConsensusBadge {
  n: number;
  labels: string;
  tone: "amber" | "zinc";
}

/**
 * Bandeau consensus à partir de /community/consensus. **SALE EXCLU** (vente normale ≠
 * signalement) : N = somme des votes d'anomalie ; libellés dominants (1–2) hors sale.
 * Les 6 anomalies sans colonne dédiée sont fondues backend dans `other` → « Autre anomalie ».
 * Renvoie null si 0 signalement d'anomalie → AUCUN bandeau (aucun bruit, aucun état vide).
 */
export function consensusBadge(c: Pick<ConsensusResponse, "votes"> | null | undefined): ConsensusBadge | null {
  const votes = c?.votes;
  if (!votes) return null;
  const entries = Object.entries(votes).filter(([k, v]) => k !== "sale" && v > 0);
  const n = entries.reduce((sum, [, v]) => sum + v, 0);
  if (n < 1) return null;
  entries.sort((a, b) => b[1] - a[1]);
  const labels = entries
    .slice(0, 2)
    .map(([k]) => FLAG_LABELS[k] ?? "Autre anomalie")
    .join(", ");
  return { n, labels, tone: n >= 2 ? "amber" : "zinc" };
}

export function consensusLineHtml(b: ConsensusBadge): string {
  const color = b.tone === "amber" ? "var(--amber)" : "var(--zinc-400)";
  return `<div class="ml-consensus" style="color:${color}">⚠ ${b.n} signalement${b.n > 1 ? "s" : ""} : ${esc(b.labels)}</div>`;
}

// ── état module (un seul overlay à la fois) ────────────────────────────────
let hostEl: HTMLElement | null = null;
let shadow: ShadowRoot | null = null;
let root: HTMLElement | null = null;
let onCloseCb: (() => void) | null = null;
let ctxRef: ListingContext | null = null;
let snapRef: SnapshotResponse | null = null;
let consensusRef: ConsensusBadge | null = null;
let docKeyHandler: ((e: KeyboardEvent) => void) | null = null;
let docClickHandler: ((e: MouseEvent) => void) | null = null;

function send<T = unknown>(msg: unknown): Promise<T> {
  return chrome.runtime.sendMessage(msg) as Promise<T>;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}

function eur(n: number): string {
  return `${Math.round(n).toLocaleString("fr-FR")} €`;
}

// ── markup ─────────────────────────────────────────────────────────────────

function headerHtml(): string {
  return (
    `<div class="ml-head">` +
    `<span class="ml-brand"><span class="ml-brand-logo">◎</span> Monark Lens</span>` +
    `<button class="ml-close" data-act="close" aria-label="Fermer">✕</button>` +
    `</div>`
  );
}

function contextHtml(ctx: ListingContext, snap: SnapshotResponse | null): string {
  const name = (snap?.component_name ?? ctx.componentName) || "Composant détecté";
  return (
    `<div class="ml-context">` +
    `<div class="ml-context-name">${esc(name)}</div>` +
    `<div class="ml-context-price">Prix affiché : <b class="ml-num">${eur(ctx.askingPrice)}</b></div>` +
    `</div>`
  );
}

function footerHtml(creditsRemaining: number | null): string {
  const credits = creditsRemaining == null ? "" : `<span class="ml-footer-credits">${creditsRemaining} cr</span>`;
  return `<div class="ml-footer">${credits}<span class="ml-footer-ver">Monark Lens v2.0.0</span></div>`;
}

function actionsHtml(): string {
  return (
    `<div class="ml-actions">` +
    `<button class="ml-act ml-act-primary" data-act="estimate">📊 Estimation complète →</button>` +
    `<div class="ml-act-row">` +
    `<button class="ml-act" data-act="flag">🚩 Signaler</button>` +
    `<button class="ml-act" data-act="alert">🔔 Alerte</button>` +
    `<button class="ml-act" data-act="watch">☆ Watchlist</button>` +
    `</div></div>`
  );
}

function reliableBodyHtml(snap: SnapshotResponse): string {
  const vm = verdictMeta(snap.verdict);
  const median = snap.market_median != null ? eur(snap.market_median) : "—";

  let gap = "";
  if (snap.gap_percent != null && snap.gap_direction) {
    const sign = snap.gap_direction === "under" ? "−" : "+";
    const color = snap.gap_direction === "under" ? "var(--green)" : "var(--amber)";
    gap = `<span class="ml-gap" style="color:${color}">${sign}${Math.round(snap.gap_percent)} % vs médiane</span>`;
  }

  const verdictBadge = snap.verdict_label
    ? `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">` +
      `<span class="ml-verdict" style="color:${vm.color};background:color-mix(in srgb, ${vm.color} 14%, transparent)">` +
      `${vm.icon ? vm.icon + " " : ""}${esc(snap.verdict_label)}</span>${gap}</div>`
    : "";

  const cached = snap.cached
    ? `<div class="ml-cached">Analyse du ${esc(fmtDate(snap.last_updated))} · <b>gratuite</b></div>`
    : "";

  // Volumes + tendance
  let trendLine = "";
  if (snap.trend_30d_pct != null) {
    const t = snap.trend_30d_pct;
    const cls = t > 1 ? "ml-trend-up" : t < -1 ? "ml-trend-down" : "ml-trend-flat";
    const arrow = t > 1 ? "↗" : t < -1 ? "↘" : "→";
    const sign = t > 0 ? "+" : "";
    trendLine =
      `<div class="ml-line"><span class="ml-line-k">Tendance 30j</span>` +
      `<span class="ml-line-v ml-num ${cls}">${arrow} ${sign}${t.toFixed(1)} %</span></div>`;
  }
  const volumes =
    `<div class="ml-card">` +
    `<div class="ml-line"><span class="ml-line-k">Ventes confirmées 30j / 90j</span>` +
    `<span class="ml-line-v ml-num">${snap.volume_30d} / ${snap.volume_90d}</span></div>` +
    trendLine +
    `</div>`;

  // Fourchette prix DEMANDÉS — distincte de la médiane vendue
  let range = "";
  const r = snap.asking_range;
  if (r && (r.p25 != null || r.p75 != null)) {
    const lo = r.p25 != null ? eur(r.p25) : "?";
    const hi = r.p75 != null ? eur(r.p75) : "?";
    range =
      `<div class="ml-range"><div class="ml-range-label">Prix demandés actuellement</div>` +
      `<div class="ml-range-val">${lo} – ${hi}</div></div>`;
  }

  return (
    cached +
    `<div class="ml-hero"><span class="ml-hero-value ml-num">${median}</span>` +
    `<span class="ml-hero-label">Médiane vendue</span></div>` +
    verdictBadge +
    volumes +
    range
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  // On ne fabrique pas de Date « now » ; on formate seulement la chaîne fournie.
  return iso.slice(0, 10);
}

function insufficientBodyHtml(snap: SnapshotResponse): string {
  return (
    `<div class="ml-note"><span class="ml-note-title">Données insuffisantes</span>` +
    `Moins de 3 ventes confirmées sur 90 jours — pas de médiane fiable.` +
    `<span class="ml-nodebit">Non débité</span></div>` +
    `<div class="ml-card"><div class="ml-line"><span class="ml-line-k">Ventes confirmées 30j / 90j</span>` +
    `<span class="ml-line-v ml-num">${snap.volume_30d} / ${snap.volume_90d}</span></div></div>`
  );
}

function noDataBodyHtml(): string {
  return (
    `<div class="ml-note"><span class="ml-note-title">Composant non couvert</span>` +
    `Aucune donnée marché pour ce composant pour l'instant.` +
    `<span class="ml-nodebit">Non débité</span></div>`
  );
}

function errorBodyHtml(outcome: { error: string; status?: number }): string {
  if (outcome.status === 402) {
    return (
      `<div class="ml-note"><span class="ml-note-title">Crédits épuisés</span>` +
      `Recharge tes crédits pour lancer l'analyse.<br>` +
      `<a class="ml-link" data-act="topup">Ouvrir monark-market.fr →</a></div>`
    );
  }
  // Session expirée / non connecté : un retry re-échouerait à l'identique → on oriente vers
  // la reconnexion (pas de bouton Réessayer). ("Not authenticated" = jeté sans status par le SW.)
  if (outcome.status === 401 || /authenticat/i.test(outcome.error)) {
    return (
      `<div class="ml-note"><span class="ml-note-title">Session expirée</span>` +
      `Reconnecte-toi dans l'extension (icône Monark) pour analyser.<br>` +
      `<a class="ml-link" data-act="login">Ouvrir Monark →</a></div>`
    );
  }
  return (
    `<div class="ml-note"><span class="ml-note-title">Analyse indisponible</span>` +
    `${esc(outcome.error || "Erreur réseau.")}` +
    `<div style="margin-top:8px"><button class="ml-act" data-act="retry">Réessayer</button></div></div>`
  );
}

export function renderMain(ctx: ListingContext, outcome: SnapshotOutcome): string {
  let body: string;
  let credits: number | null = null;
  let actions = "";

  if (outcome.ok) {
    const snap = outcome.data;
    credits = snap.credits_remaining;
    if (snap.state === "reliable") body = reliableBodyHtml(snap);
    else if (snap.state === "insufficient") body = insufficientBodyHtml(snap);
    else body = noDataBodyHtml();
    actions = actionsHtml(); // Estimer/Signaler/Alerte/Watchlist disponibles sur toute réponse OK
  } else {
    body = errorBodyHtml(outcome);
  }

  return (
    `<div class="ml-overlay">` +
    headerHtml() +
    contextHtml(ctx, outcome.ok ? outcome.data : null) +
    `<div class="ml-consensus-slot">${consensusRef ? consensusLineHtml(consensusRef) : ""}</div>` +
    body +
    actions +
    footerHtml(credits) +
    `</div>`
  );
}

function renderFlagPanel(): string {
  const opts = FLAG_OPTIONS.map(
    (o) =>
      `<div class="ml-flag-opt" data-flag="${o.type}" data-label="${esc(o.label)}">` +
      `<span class="ml-flag-ico">${o.icon}</span> ${esc(o.label)}</div>`,
  ).join("");
  return (
    `<div class="ml-overlay">` +
    headerHtml() +
    `<div class="ml-flag-prompt">Quel est le problème avec cette annonce ?</div>` +
    `<div class="ml-flag-list">${opts}</div>` +
    `<div class="ml-actions"><button class="ml-act" data-act="back">← Retour au résultat</button></div>` +
    `</div>`
  );
}

function renderAlertPanel(hasMedian: boolean): string {
  const threshold = hasMedian && snapRef?.market_median != null ? Math.round(snapRef.market_median * 0.85) : null;
  const below =
    `<button class="ml-act" data-alert="price_below">📉 Prix sous seuil` +
    (threshold != null ? ` <span class="ml-num">(${threshold} €)</span>` : "") +
    `</button>`;
  return (
    `<div class="ml-overlay">` +
    headerHtml() +
    `<div class="ml-flag-prompt">Quand veux-tu être alerté sur ce modèle ?</div>` +
    `<div class="ml-actions">` +
    `<button class="ml-act" data-alert="deal_detected">🔥 Bonne affaire détectée</button>` +
    below +
    `<button class="ml-act" data-alert="new_listing">🆕 Nouveau signal</button>` +
    `<button class="ml-act" data-act="back">← Retour au résultat</button>` +
    `</div></div>`
  );
}

// ── interactions ─────────────────────────────────────────────────────────────

function $(sel: string): HTMLElement | null {
  return root ? root.querySelector(sel) : null;
}
function $all(sel: string): HTMLElement[] {
  return root ? Array.from(root.querySelectorAll(sel)) : [];
}

function setView(html: string): void {
  if (!root) return;
  root.innerHTML = html;
  bindCommon();
}

function bindCommon(): void {
  $all('[data-act="close"]').forEach((b) => b.addEventListener("click", () => closeOverlay()));
}

function showMainView(outcome: SnapshotOutcome): void {
  if (!ctxRef) return;
  setView(renderMain(ctxRef, outcome));

  $('[data-act="estimate"]')?.addEventListener("click", onEstimate);
  $('[data-act="flag"]')?.addEventListener("click", showFlagView);
  $('[data-act="alert"]')?.addEventListener("click", showAlertView);
  $('[data-act="watch"]')?.addEventListener("click", onWatchlist);
  $('[data-act="retry"]')?.addEventListener("click", onRetry);
  $('[data-act="topup"]')?.addEventListener("click", () => openWeb("/pricing"));
  $('[data-act="login"]')?.addEventListener("click", () => openWeb(""));
}

function showFlagView(): void {
  setView(renderFlagPanel());
  $('[data-act="back"]')?.addEventListener("click", () => showMainView({ ok: true, data: snapRef as SnapshotResponse }));
  $all(".ml-flag-opt").forEach((opt) =>
    opt.addEventListener("click", () => onFlagSelected(opt.dataset.flag || "", opt.dataset.label || "")),
  );
}

function showAlertView(): void {
  setView(renderAlertPanel(snapRef?.market_median != null));
  $('[data-act="back"]')?.addEventListener("click", () => showMainView({ ok: true, data: snapRef as SnapshotResponse }));
  $all("[data-alert]").forEach((b) => b.addEventListener("click", () => onAlert(b.dataset.alert || "")));
}

function onEstimate(): void {
  if (!ctxRef) return;
  const url = buildEstimateUrl({
    componentName: ctxRef.componentName,
    askingPrice: ctxRef.askingPrice,
    condition: ctxRef.condition,
    platform: ctxRef.platform,
  });
  window.open(url, "_blank", "noopener");
}

function openWeb(path: string): void {
  window.open(`${MONARK_WEB_URL}${path}`, "_blank", "noopener");
}

async function onFlagSelected(type: string, label: string): Promise<void> {
  if (!ctxRef || !type) return;
  const list = $(".ml-flag-list");
  if (list) list.innerHTML = `<div class="ml-note"><span class="ml-note-title">✓ Signalé</span>${esc(label)} — merci.</div>`;
  const msg: SubmitFlagMsg = {
    type: "SUBMIT_FLAG",
    url: ctxRef.url,
    platform: ctxRef.platform,
    component_id: ctxRef.componentId,
    intent_type: type,
    source: "manual_flag",
  };
  try {
    await send(msg);
  } catch {
    /* best-effort : la confirmation inline reste affichée */
  }
}

async function onAlert(alertType: string): Promise<void> {
  if (!ctxRef || !alertType) return;
  const payload: CreateAlertMsg["payload"] = {
    target_type: "model",
    target_id: ctxRef.componentId,
    alert_type: alertType,
  };
  if (alertType === "price_below" && snapRef?.market_median != null) {
    payload.price_threshold = Math.round(snapRef.market_median * 0.85);
  }
  await sendTargetAction({ type: "CREATE_ALERT", payload }, "🔔 Alerte créée ✓");
}

async function onWatchlist(): Promise<void> {
  if (!ctxRef) return;
  const msg: AddWatchlistMsg = {
    type: "ADD_WATCHLIST",
    payload: { target_type: "model", target_id: ctxRef.componentId },
  };
  await sendTargetAction(msg, "★ Ajouté ✓");
}

/** Envoie une action alerte/watchlist et affiche un feedback inline sur le bouton. */
async function sendTargetAction(msg: CreateAlertMsg | AddWatchlistMsg, okLabel: string): Promise<void> {
  const sel = msg.type === "CREATE_ALERT" ? '[data-act="alert"]' : '[data-act="watch"]';
  // En vue alerte, le bouton d'origine n'est pas présent → on revient au résultat d'abord.
  if (msg.type === "CREATE_ALERT") showMainView({ ok: true, data: snapRef as SnapshotResponse });
  const btn = $(sel);
  try {
    const res = (await send<{ error?: string; status?: number }>(msg)) || {};
    if (btn) {
      const dup = res.status === 409;
      btn.textContent = res.error && !dup ? "✕ Échec" : dup ? "★ Déjà suivi" : okLabel;
      if (!res.error || dup) btn.classList.add("ml-act-ok");
      btn.setAttribute("aria-disabled", "true");
    }
  } catch {
    if (btn) btn.textContent = "✕ Échec";
  }
}

async function onRetry(): Promise<void> {
  if (!ctxRef) return;
  setView(
    `<div class="ml-overlay">${headerHtml()}${contextHtml(ctxRef, null)}` +
      `<div class="ml-note"><span class="ml-note-title">Analyse…</span><div class="ml-spinner"></div></div></div>`,
  );
  const outcome = await requestSnapshot(ctxRef);
  showMainView(outcome);
  if (outcome.ok) void fetchConsensus(ctxRef);
}

/** Consensus communauté (best-effort). Injecte le bandeau dans le slot si ≥1 signalement. */
async function fetchConsensus(ctx: ListingContext): Promise<void> {
  const myCtx = ctxRef; // identité de CETTE session d'overlay (objet ctx frais à chaque open)
  try {
    const msg: GetConsensusMsg = { type: "GET_CONSENSUS", url: ctx.url, platform: ctx.platform };
    const c = await send<ConsensusResponse>(msg);
    // Garde par IDENTITÉ (pas par URL) : rejette overlay fermé (ctxRef=null) ET ré-ouvert,
    // y compris ré-ouverture sur la MÊME URL (nouvel objet ctx) → pas d'injection croisée.
    if (ctxRef !== myCtx) return;
    const badge = consensusBadge(c);
    if (!badge) return;
    consensusRef = badge;
    const slot = $(".ml-consensus-slot");
    if (slot) slot.innerHTML = consensusLineHtml(badge);
  } catch {
    /* best-effort : pas de bandeau, aucun bruit */
  }
}

// ── cycle de vie ───────────────────────────────────────────────────────────

/** Ouvre l'overlay résultat. Remplace tout overlay existant. */
export function openOverlay(ctx: ListingContext, outcome: SnapshotOutcome, opts: { onClose: () => void }): void {
  closeOverlay({ silent: true });
  ctxRef = ctx;
  snapRef = outcome.ok ? outcome.data : null;
  consensusRef = null;
  onCloseCb = opts.onClose;

  hostEl = document.createElement("div");
  hostEl.id = HOST_ID;
  hostEl.style.cssText = "position:fixed;top:80px;right:16px;z-index:2147483600;";
  shadow = hostEl.attachShadow({ mode: "closed" });
  injectStyles(shadow);
  root = document.createElement("div");
  root.className = "ml-root";
  shadow.appendChild(root);
  document.body.appendChild(hostEl);

  showMainView(outcome);
  // Consensus communauté : best-effort, EN PARALLÈLE, non bloquant. Le snapshot est déjà
  // affiché ; le bandeau s'injecte si/quand il arrive (seulement sur snapshot OK).
  if (outcome.ok) void fetchConsensus(ctx);

  docKeyHandler = (e: KeyboardEvent) => {
    if (e.key === "Escape") closeOverlay();
  };
  docClickHandler = (e: MouseEvent) => {
    // shadow closed → un clic interne a pour target le host ; un clic externe ferme.
    if (hostEl && e.target !== hostEl && !hostEl.contains(e.target as Node)) closeOverlay();
  };
  document.addEventListener("keydown", docKeyHandler);
  setTimeout(() => {
    if (docClickHandler) document.addEventListener("click", docClickHandler);
  }, 0);
}

/** Ferme l'overlay et (sauf silent) re-déclenche le bouton via onClose. */
export function closeOverlay(opts?: { silent?: boolean }): void {
  if (docKeyHandler) document.removeEventListener("keydown", docKeyHandler);
  if (docClickHandler) document.removeEventListener("click", docClickHandler);
  docKeyHandler = null;
  docClickHandler = null;
  hostEl?.remove();
  const cb = onCloseCb;
  hostEl = null;
  shadow = null;
  root = null;
  ctxRef = null;
  snapRef = null;
  consensusRef = null;
  onCloseCb = null;
  if (!opts?.silent && cb) cb();
}
