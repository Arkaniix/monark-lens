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
import { cacheDecision } from "../decision-cache";
import { getCompiledRules } from "../intent-rules-client";
import type { SnapshotResponse } from "../../lib/api-types";
import type {
  AddWatchlistMsg,
  CheckWatchlistMsg,
  RefreshBalanceMsg,
  RemoveWatchlistMsg,
  ReportIntentMsg,
} from "../../lib/messages";

const HOST_ID = "monark-lens-overlay";
const MONARK_WEB_URL = "https://monark-market.fr"; // SYNC: src/lib/constants.ts

/** slug → icône pour le panneau « Signaler » (les libellés FR viennent du rule set servi). */
const FLAG_ICON: Record<string, string> = {
  broken: "alert-triangle",
  bundle: "monitor",
  box_only: "package",
  trade: "repeat",
  wanted: "search",
  mining: "zap",
  accessory: "wrench",
  symbolic_price: "message-circle",
  reserved: "lock",
  multiple: "layers",
  rental: "house",
  rma_refurb: "rotate-ccw",
  professional: "store",
  parts_from_device: "wrench",
  photo_scam: "alert-triangle",
  test_spam: "circle-help",
  other: "circle-help",
};

export interface FlagOption {
  type: string;
  icon: string;
  label: string;
}

/**
 * Options « Signaler » générées DYNAMIQUEMENT depuis le rule set (familles slug ≠ sale,
 * libellés FR servis) + catch-all `other`. Remplace la liste hardcodée v1. L'envoi passe
 * par REPORT_INTENT (user_action=manual_flag) — `/community/flag` et le consensus Waze sont
 * retirés CÔTÉ EXTENSION (backend laissé dormant, intact).
 */
export function flagOptionsFromRules(families: ReadonlyArray<{ slug: string; label: string }>): FlagOption[] {
  const opts = families
    .filter((f) => f.slug !== "sale")
    .map((f) => ({ type: f.slug, icon: FLAG_ICON[f.slug] ?? "circle-help", label: f.label }));
  opts.push({ type: "other", icon: "circle-help", label: "Autre anomalie" });
  return opts;
}

// ── état module (un seul overlay à la fois) ────────────────────────────────
let hostEl: HTMLElement | null = null;
let shadow: ShadowRoot | null = null;
let root: HTMLElement | null = null;
let onCloseCb: (() => void) | null = null;
let ctxRef: ListingContext | null = null;
let snapRef: SnapshotResponse | null = null;
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

/** (C2.c) Badge discret pour le gate `info` : contexte non bloquant + chiffres affichés. */
function infoBadgeHtml(ctx: ListingContext): string {
  if (ctx.intent.gate !== "info" || !ctx.intent.overlay_message) return "";
  return (
    `<div class="ml-note" style="color:var(--amber)">` +
    `${icon("alert-triangle")} ${esc(ctx.intent.overlay_message)}</div>`
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
    infoBadgeHtml(ctx) +
    body +
    actions +
    footerHtml() +
    `</div>`
  );
}

function renderFlagPanel(options: ReadonlyArray<FlagOption>): string {
  const opts = options
    .map(
      (o) =>
        `<div class="ml-flag-opt" data-flag="${o.type}">` +
        `<span class="ml-flag-ico">${icon(o.icon)}</span> ${esc(o.label)}</div>`,
    )
    .join("");
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

async function showFlagView(): Promise<void> {
  const rules = await getCompiledRules();
  if (!ctxRef) return;
  setView(renderFlagPanel(flagOptionsFromRules(rules.families)));
  $('[data-act="back"]')?.addEventListener("click", () => showMainView({ ok: true, data: snapRef as SnapshotResponse }));
  $all(".ml-flag-opt").forEach((opt) =>
    opt.addEventListener("click", () => onFlagSelected(opt.dataset.flag || "")),
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

async function onFlagSelected(type: string): Promise<void> {
  if (!ctxRef || !type) return;
  const ctx = ctxRef;
  const list = $(".ml-flag-list");
  if (list) list.innerHTML = `<div class="ml-note"><span class="ml-note-title">✓ Signalé</span>Merci — c'est noté.</div>`;
  // Signalement manuel -> rapport (user_action=manual_flag, final_intent = anomalie choisie ;
  // detected_intent = classif locale ; matched_flags = extraits du classifieur).
  void reportDecision(ctx, "manual_flag", type);
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
}

// ── cycle de vie ───────────────────────────────────────────────────────────

/** Crée le host (shadow closed, top-right) + styles + handlers Échap / clic-hors. */
function setupHostAndHandlers(): void {
  hostEl = document.createElement("div");
  hostEl.id = HOST_ID;
  hostEl.style.cssText = "position:fixed;top:80px;right:16px;z-index:2147483600;";
  shadow = hostEl.attachShadow({ mode: "closed" });
  injectStyles(shadow);
  root = document.createElement("div");
  root.className = "ml-root";
  shadow.appendChild(root);
  document.body.appendChild(hostEl);

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

function resetRefs(ctx: ListingContext, onClose: () => void): void {
  ctxRef = ctx;
  snapRef = null;
  creditsRef = null;
  creditsUnlimitedRef = false;
  watchedRef = null;
  watchTouched = false;
  onCloseCb = onClose;
}

/** Rapport de décision (C2). Auth-gated : non connecté => POST sauté SILENCIEUSEMENT (v1). */
async function reportDecision(
  ctx: ListingContext,
  userAction: "auto_confirmed" | "auto_overridden" | "manual_flag",
  finalIntent: string,
): Promise<void> {
  try {
    const authState = await send<{ isLoggedIn?: boolean }>({ type: "GET_AUTH_STATE" });
    if (!authState?.isLoggedIn) return;
    const msg: ReportIntentMsg = {
      type: "REPORT_INTENT",
      url: ctx.url,
      platform: ctx.platform,
      component_id: ctx.componentId,
      detected_intent: ctx.intent.intent,
      final_intent: finalIntent,
      user_action: userAction,
      matched_flags: ctx.intent.matched_flags,
      asking_price: ctx.askingPrice,
      rules_version: ctx.intent.rules_version,
    };
    await send(msg);
  } catch {
    /* best-effort */
  }
}

// ── Gate de confirmation (C2.c) ─────────────────────────────────────────────

const TRIGGER_ORIGIN: Record<string, string> = { title: "titre", desc: "description", price: "prix" };

/** Déclencheurs lisibles depuis matched_flags (origine + extrait), max 4. */
function triggersHtml(flags: string[]): string {
  const items = flags
    .slice(0, 4)
    .map((f) => {
      const parts = f.split(":");
      const origin = TRIGGER_ORIGIN[parts[0]] ?? parts[0];
      const extract = parts.slice(2).join(":");
      return (
        `<div class="ml-line"><span class="ml-line-k">${esc(origin)}</span>` +
        `<span class="ml-line-v">« ${esc(extract)} »</span></div>`
      );
    })
    .join("");
  return items ? `<div class="ml-card">${items}</div>` : "";
}

function renderConfirmView(ctx: ListingContext): string {
  const label = ctx.intent.label || "annonce spéciale";
  return (
    `<div class="ml-overlay">` +
    headerHtml() +
    contextHtml(ctx, null) +
    `<div class="ml-note"><span class="ml-note-title">Vérification nécessaire</span>` +
    `${esc(ctx.intent.overlay_message || "Annonce non standard détectée")} — est-ce bien le cas ?</div>` +
    triggersHtml(ctx.intent.matched_flags) +
    `<div class="ml-actions">` +
    `<button class="ml-act ml-act-primary" data-act="confirm-yes">✓ Oui, c'est bien « ${esc(label)} »</button>` +
    `<button class="ml-act" data-act="confirm-no">${icon("bar-chart")} Non, vente normale — voir les chiffres</button>` +
    `</div>` +
    footerHtml() +
    `</div>`
  );
}

function renderFilteredView(ctx: ListingContext): string {
  const cta = ctx.componentId
    ? `<div class="ml-actions"><button class="ml-act ml-act-primary" data-act="estimate">` +
      `${icon("bar-chart")} Estimation complète →</button></div>`
    : "";
  return (
    `<div class="ml-overlay">` +
    headerHtml() +
    contextHtml(ctx, null) +
    `<div class="ml-note"><span class="ml-note-title">${esc(ctx.intent.label || "Annonce filtrée")}</span>` +
    `${esc(ctx.intent.overlay_message || "Annonce filtrée")}` +
    `<span class="ml-nodebit">Non comptabilisée dans les stats marché</span></div>` +
    cta +
    footerHtml() +
    `</div>`
  );
}

function showFilteredView(): void {
  if (!ctxRef) return;
  setView(renderFilteredView(ctxRef));
  $('[data-act="estimate"]')?.addEventListener("click", onEstimate);
}

async function onConfirmYes(): Promise<void> {
  if (!ctxRef) return;
  const ctx = ctxRef;
  await cacheDecision(ctx.url, "confirmed");
  void reportDecision(ctx, "auto_confirmed", ctx.intent.intent);
  if (ctxRef !== ctx) return;
  showFilteredView();
}

async function onConfirmNo(): Promise<void> {
  if (!ctxRef) return;
  const ctx = ctxRef;
  await cacheDecision(ctx.url, "overridden");
  void reportDecision(ctx, "auto_overridden", "sale");
  if (ctxRef !== ctx) return;
  // Override => snapshot normal (1 cr) dans le même overlay.
  setView(
    `<div class="ml-overlay">${headerHtml()}${contextHtml(ctx, null)}` +
      `<div class="ml-note"><span class="ml-note-title">Analyse…</span><div class="ml-spinner"></div></div></div>`,
  );
  const outcome = await requestSnapshot(ctx);
  if (ctxRef !== ctx) return;
  snapRef = outcome.ok ? outcome.data : null;
  creditsRef = outcome.ok ? outcome.data.credits_remaining : null;
  showMainView(outcome);
  void hydrateCredits(outcome);
  if (outcome.ok) void hydrateWatchlist(ctx);
}

function showConfirmView(): void {
  if (!ctxRef) return;
  setView(renderConfirmView(ctxRef));
  $('[data-act="confirm-yes"]')?.addEventListener("click", onConfirmYes);
  $('[data-act="confirm-no"]')?.addEventListener("click", onConfirmNo);
}

/** Ouvre directement l'overlay FILTRÉ (décision « confirmé » tranchée — aucun snapshot). */
export function openFilteredOverlay(ctx: ListingContext, opts: { onClose: () => void }): void {
  closeOverlay({ silent: true });
  resetRefs(ctx, opts.onClose);
  setupHostAndHandlers();
  showFilteredView();
}

/** Ouvre le gate de CONFIRMATION (aucun snapshot tant que l'utilisateur n'a pas tranché). */
export function openConfirmOverlay(ctx: ListingContext, opts: { onClose: () => void }): void {
  closeOverlay({ silent: true });
  resetRefs(ctx, opts.onClose);
  setupHostAndHandlers();
  showConfirmView();
}

/** Ouvre l'overlay résultat. Remplace tout overlay existant. */
export function openOverlay(ctx: ListingContext, outcome: SnapshotOutcome, opts: { onClose: () => void }): void {
  closeOverlay({ silent: true });
  resetRefs(ctx, opts.onClose);
  snapRef = outcome.ok ? outcome.data : null;
  creditsRef = outcome.ok ? outcome.data.credits_remaining : null;
  setupHostAndHandlers();

  showMainView(outcome);
  void hydrateCredits(outcome); // (A4) solde header sur TOUS les états (cache + refresh si vieux)
  if (outcome.ok) {
    void hydrateWatchlist(ctx); // (A5) pré-validation de l'appartenance watchlist
  }
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
  creditsRef = null;
  creditsUnlimitedRef = false;
  watchedRef = null;
  watchTouched = false;
  onCloseCb = null;
  if (!opts?.silent && cb) cb();
}
