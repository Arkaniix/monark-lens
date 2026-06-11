// src/content/ui/overlay.ts — overlay RÉSULTAT (~360px, shadow closed) — ÉTAPE 3.
// Rend honnêtement les 6 états du contrat snapshot + actions Estimer / Signaler / Watchlist
// (Alerte retirée en LOT A). AUCUN overlay spontané : ouvert uniquement sur clic du bouton passif.
// Le header rappelle TOUJOURS component_name + prix demandé (garde-fou faux-match).

import { injectStyles } from "./styles";
import { verdictMeta } from "../../ui/verdict";
import { icon } from "../../ui/icons";
import { buildEstimateUrl } from "../../ui/deeplink";
import { requestSnapshot } from "./snapshot-client";
import type { ListingContext, SnapshotOutcome } from "./snapshot-client";
import type { ConsensusResponse, SnapshotResponse } from "../../lib/api-types";
import type {
  AddWatchlistMsg,
  CheckWatchlistMsg,
  GetConsensusMsg,
  RefreshBalanceMsg,
  RemoveWatchlistMsg,
  SubmitFlagMsg,
} from "../../lib/messages";

const HOST_ID = "monark-lens-overlay";
const MONARK_WEB_URL = "https://monark-market.fr"; // SYNC: src/lib/constants.ts

/** 14 anomalies « Signaler » — codes + libellés VERBATIM dist v1 (showFlagSelector). */
export const FLAG_OPTIONS: ReadonlyArray<{ type: string; icon: string; label: string }> = [
  { type: "broken", icon: "alert-triangle", label: "Composant HS / pour pièces" },
  { type: "bundle", icon: "monitor", label: "PC complet / bundle" },
  { type: "box_only", icon: "package", label: "Boîte / emballage seul" },
  { type: "trade", icon: "repeat", label: "Échange / troc" },
  { type: "wanted", icon: "search", label: "Demande d'achat" },
  { type: "mining", icon: "zap", label: "Ex-minage" },
  { type: "accessory", icon: "wrench", label: "Accessoire uniquement" },
  { type: "symbolic_price", icon: "message-circle", label: "Prix symbolique / à négocier" },
  { type: "reserved", icon: "lock", label: "Réservé / vendu" },
  { type: "multiple", icon: "layers", label: "Lot / quantité multiple" },
  { type: "rental", icon: "house", label: "Location" },
  { type: "rma_refurb", icon: "rotate-ccw", label: "Reconditionné / RMA" },
  { type: "professional", icon: "store", label: "Vendeur professionnel" },
  { type: "other", icon: "circle-help", label: "Autre anomalie" },
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
  return `<div class="ml-consensus" style="color:${color}">${icon("alert-triangle")} ${b.n} signalement${b.n > 1 ? "s" : ""} : ${esc(b.labels)}</div>`;
}

// ── état module (un seul overlay à la fois) ────────────────────────────────
let hostEl: HTMLElement | null = null;
let shadow: ShadowRoot | null = null;
let root: HTMLElement | null = null;
let onCloseCb: (() => void) | null = null;
let ctxRef: ListingContext | null = null;
let snapRef: SnapshotResponse | null = null;
let consensusRef: ConsensusBadge | null = null;
let creditsRef: number | null = null; // (A4) solde affiché en header — sur TOUS les états
let creditsUnlimitedRef = false;
let watchedRef: boolean | null = null; // (A5) appartenance watchlist (null = inconnu)
let watchTouched = false; // (A5) l'utilisateur a déjà togglé cette session → hydrate ne clobbe plus
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

function creditsText(): string {
  return creditsUnlimitedRef ? "∞" : creditsRef == null ? "" : `${creditsRef} cr`;
}

function headerHtml(): string {
  return (
    `<div class="ml-head">` +
    `<span class="ml-brand"><span class="ml-brand-logo">◎</span> Monark Lens</span>` +
    `<div class="ml-head-right">` +
    `<span class="ml-head-credits ml-num" title="Crédits restants">${creditsText()}</span>` +
    `<button class="ml-close" data-act="close" aria-label="Fermer">${icon("x")}</button>` +
    `</div></div>`
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

function footerHtml(): string {
  // (A4) Solde déplacé en header (visible tous états) → footer = version seule, pas de doublon.
  return `<div class="ml-footer"><span class="ml-footer-ver">Monark Lens v2.1.0</span></div>`;
}

/** (A5) Bouton Watchlist selon l'appartenance pré-validée (✓ = suivi, clic = toggle). */
function watchBtnHtml(): string {
  const watched = watchedRef === true;
  return (
    `<button class="ml-act${watched ? " ml-act-ok" : ""}" data-act="watch">` +
    `${icon("star")} ${watched ? "Suivi ✓" : "Watchlist"}</button>`
  );
}

function actionsHtml(): string {
  // (A1) Bouton « Alerte » retiré. Restent : Estimation complète / Signaler / Watchlist.
  return (
    `<div class="ml-actions">` +
    `<button class="ml-act ml-act-primary" data-act="estimate">${icon("bar-chart")} Estimation complète →</button>` +
    `<div class="ml-act-row">` +
    `<button class="ml-act" data-act="flag">${icon("flag")} Signaler</button>` +
    watchBtnHtml() +
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
      `<span class="ml-verdict" style="color:${vm.color};border:1px solid color-mix(in srgb, ${vm.color} 33%, transparent);background:color-mix(in srgb, ${vm.color} 8%, transparent)">` +
      `${esc(snap.verdict_label)}</span>${gap}</div>`
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
  let actions = "";

  if (outcome.ok) {
    const snap = outcome.data;
    if (snap.state === "reliable") body = reliableBodyHtml(snap);
    else if (snap.state === "insufficient") body = insufficientBodyHtml(snap);
    else body = noDataBodyHtml();
    actions = actionsHtml(); // Estimer / Signaler / Watchlist disponibles sur toute réponse OK
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
    footerHtml() +
    `</div>`
  );
}

function renderFlagPanel(): string {
  const opts = FLAG_OPTIONS.map(
    (o) =>
      `<div class="ml-flag-opt" data-flag="${o.type}" data-label="${esc(o.label)}">` +
      `<span class="ml-flag-ico">${icon(o.icon)}</span> ${esc(o.label)}</div>`,
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

function onEstimate(): void {
  if (!ctxRef) return;
  const url = buildEstimateUrl({
    componentName: ctxRef.componentName,
    askingPrice: ctxRef.askingPrice,
    condition: ctxRef.condition,
    platform: ctxRef.platform,
    componentId: ctxRef.componentId, // (A6) id catalogue
    publishedAt: ctxRef.publishedAt, // (A6) date YYYY-MM-DD (LBC uniquement ; null ailleurs)
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

/** Repeint le bouton Watchlist selon l'appartenance courante (watchedRef). */
function paintWatch(): void {
  const btn = $('[data-act="watch"]');
  if (!btn) return;
  const watched = watchedRef === true;
  btn.innerHTML = `${icon("star")} ${watched ? "Suivi ✓" : "Watchlist"}`;
  btn.classList.toggle("ml-act-ok", watched);
  btn.removeAttribute("aria-disabled");
}

/**
 * (A5) Toggle Watchlist. L'appartenance est pré-validée à l'ouverture (CHECK_WATCHLIST, cache
 * SW 5 min). Clic → ADD (non suivi) ou REMOVE (suivi). Le fallback 409 « Déjà suivi » reste un
 * filet de sécurité si le pré-check a manqué (cache froid / course).
 */
async function onWatchlist(): Promise<void> {
  if (!ctxRef) return;
  watchTouched = true; // intention utilisateur prioritaire sur un CHECK_WATCHLIST encore en vol
  const targetId = ctxRef.componentId;
  const wasWatched = watchedRef === true;
  const btn = $('[data-act="watch"]');
  if (btn) {
    btn.setAttribute("aria-disabled", "true");
    btn.textContent = wasWatched ? "Retrait…" : "Ajout…";
  }
  try {
    if (wasWatched) {
      const msg: RemoveWatchlistMsg = { type: "REMOVE_WATCHLIST", target_id: targetId };
      const res = (await send<{ error?: string; success?: boolean }>(msg)) || {};
      if (res.error) throw new Error(res.error);
      watchedRef = false;
    } else {
      const msg: AddWatchlistMsg = { type: "ADD_WATCHLIST", payload: { target_type: "model", target_id: targetId } };
      const res = (await send<{ error?: string; status?: number }>(msg)) || {};
      const dup = res.status === 409; // déjà présent malgré le pré-check → on l'accepte
      if (res.error && !dup) throw new Error(res.error);
      watchedRef = true;
    }
    paintWatch();
  } catch {
    watchedRef = wasWatched; // restaure l'état affiché
    if (btn) {
      btn.textContent = "Échec";
      btn.removeAttribute("aria-disabled");
    }
  }
}

/** (A4) Repeint le chip solde du header. */
function paintCredits(): void {
  const el = $(".ml-head-credits");
  if (el) el.textContent = creditsText();
}

/** (A4) Solde header : lecture instantanée du cache storage, puis refresh arrière-plan si >10 min. */
async function hydrateCredits(outcome: SnapshotOutcome): Promise<void> {
  const sessionRoot = root;
  // Valeur immédiate : snapshot OK (post-action) sinon cache storage local.
  let credits: number | null = outcome.ok ? outcome.data.credits_remaining : null;
  let unlimited = false;
  let updatedAt = 0;
  try {
    const c = (await chrome.storage.local.get([
      "credits_remaining",
      "credits_unlimited",
      "credits_updated_at",
    ])) as { credits_remaining?: number; credits_unlimited?: boolean; credits_updated_at?: number };
    if (credits == null && typeof c.credits_remaining === "number") credits = c.credits_remaining;
    unlimited = c.credits_unlimited === true;
    updatedAt = typeof c.credits_updated_at === "number" ? c.credits_updated_at : 0;
  } catch {
    /* storage indisponible : on garde la valeur du snapshot si présente */
  }
  if (root !== sessionRoot) return; // overlay fermé/réouvert entre-temps
  creditsRef = credits;
  creditsUnlimitedRef = unlimited;
  paintCredits();

  // Refresh arrière-plan si le cache a > 10 min, OU sur 402 (crédits épuisés → le chip doit être
  // honnête : sur 402 le SW n'a pas réécrit le solde, le cache peut afficher un stale non nul).
  const exhausted = !outcome.ok && outcome.status === 402;
  if (exhausted || Date.now() - updatedAt > 10 * 60 * 1000) {
    try {
      const msg: RefreshBalanceMsg = { type: "REFRESH_BALANCE" };
      const r = await send<{ balance?: number; unlimited?: boolean; error?: string }>(msg);
      if (root === sessionRoot && r && !r.error && typeof r.balance === "number") {
        creditsRef = r.balance;
        creditsUnlimitedRef = r.unlimited === true;
        paintCredits();
      }
    } catch {
      /* best-effort : on garde la valeur du cache */
    }
  }
}

/** (A5) Pré-validation de l'appartenance watchlist du composant courant (best-effort). */
async function hydrateWatchlist(ctx: ListingContext): Promise<void> {
  const sessionRoot = root;
  try {
    const msg: CheckWatchlistMsg = { type: "CHECK_WATCHLIST", target_id: ctx.componentId };
    const r = await send<{ watched?: boolean }>(msg);
    // overlay fermé / autre annonce / l'utilisateur a déjà togglé → ne PAS écraser son intention.
    if (root !== sessionRoot || ctxRef !== ctx || watchTouched) return;
    watchedRef = r?.watched === true;
    paintWatch();
  } catch {
    /* best-effort : appartenance inconnue → bouton « Watchlist » par défaut */
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
  void hydrateCredits(outcome); // (A4) solde rafraîchi après un nouveau snapshot
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
  creditsRef = outcome.ok ? outcome.data.credits_remaining : null;
  creditsUnlimitedRef = false;
  watchedRef = null;
  watchTouched = false;
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
  void hydrateCredits(outcome); // (A4) solde header sur TOUS les états (cache + refresh si vieux)
  // Consensus communauté : best-effort, EN PARALLÈLE, non bloquant. Le snapshot est déjà
  // affiché ; le bandeau s'injecte si/quand il arrive (seulement sur snapshot OK).
  if (outcome.ok) {
    void fetchConsensus(ctx);
    void hydrateWatchlist(ctx); // (A5) pré-validation de l'appartenance watchlist
  }

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
  creditsRef = null;
  creditsUnlimitedRef = false;
  watchedRef = null;
  watchTouched = false;
  onCloseCb = null;
  if (!opts?.silent && cb) cb();
}
