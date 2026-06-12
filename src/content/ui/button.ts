// src/content/ui/button.ts — BOUTON PASSIF (ÉTAPE 2). Shadow closed, top-right.
// PRINCIPE PRODUIT GRAVÉ : à l'état passif, l'extension n'injecte RIEN d'autre qu'un
// bouton — aucun badge, aucun overlay spontané. Le bouton est le SEUL ajout à la page.

import { injectStyles } from "./styles";
import { openConfirmOverlay, openFilteredOverlay, openOverlay } from "./overlay";
import { requestSnapshot } from "./snapshot-client";
import { getCachedDecision } from "../decision-cache";
import type { ListingContext } from "./snapshot-client";
import type { IntentGate } from "../../lib/api-types";

const HOST_ID = "monark-lens-button";

/**
 * Gate d'apparition (C2) : piloté par le `gate` servi.
 *  - `silent`  (test_spam) -> AUCUN bouton.
 *  - `info`    (sale, mining, rma_refurb, professional, reserved, aberration) -> bouton + snapshot.
 *  - `confirm` (wanted, trade, box_only, broken, bundle, multiple, accessory, rental,
 *               symbolic_price, parts_from_device, photo_scam) -> bouton + gate de confirmation
 *               (C2.c) AVANT tout snapshot. Divergence v1 ASSUMÉE : bundle/wanted affichent
 *               désormais le bouton (comportement voulu : confirmer plutôt que masquer).
 */
export function shouldShowAnalyzeButton(gate: IntentGate): boolean {
  return gate !== "silent";
}

let hostEl: HTMLElement | null = null;
let shadow: ShadowRoot | null = null;
let root: HTMLElement | null = null;
let loading = false;

/** Retire le bouton/placeholder (navigation, ouverture overlay, page non éligible). */
export function removeAnalyzeButton(): void {
  hostEl?.remove();
  hostEl = null;
  shadow = null;
  root = null;
  loading = false;
}

/** Crée le host (shadow closed, top-right) + styles si absent. `isNew` = host fraîchement créé. */
function ensureHost(): { root: HTMLElement; isNew: boolean } {
  if (root) return { root, isNew: false };
  hostEl = document.createElement("div");
  hostEl.id = HOST_ID;
  hostEl.style.cssText = "position:fixed;top:80px;right:16px;z-index:2147483600;";
  shadow = hostEl.attachShadow({ mode: "closed" });
  injectStyles(shadow);
  root = document.createElement("div");
  root.className = "ml-root";
  shadow.appendChild(root);
  document.body.appendChild(hostEl);
  return { root, isNew: true };
}

/**
 * (A3) Placeholder spinner — injecté dès qu'une annonce avec prix est parsée, AVANT que
 * match/intent ne soient résolus (couvre le cold-fetch du component-DB). Non interactif.
 * Remplacé in-place par le bouton réel (mountAnalyzeButton) ou retiré (removeAnalyzeButton).
 */
export function mountAnalyzePlaceholder(): void {
  const { root: r, isNew } = ensureHost();
  // Swap depuis un host déjà visible → naître avec `ml-in` (pas de re-fade ; transition douce).
  r.innerHTML =
    `<div class="ml-btn ml-btn-loading${isNew ? "" : " ml-in"}" aria-busy="true">` +
    `<span class="ml-btn-logo">◎</span><span class="ml-spinner"></span></div>`;
  if (isNew) requestAnimationFrame(() => r.firstElementChild?.classList.add("ml-in"));
}

/** Monte le bouton passif pour une annonce éligible. Réutilise le host (swap depuis placeholder). */
export function mountAnalyzeButton(ctx: ListingContext): void {
  loading = false;
  const { root: r, isNew } = ensureHost();
  r.innerHTML =
    `<div class="ml-btn${isNew ? "" : " ml-in"}" role="button" tabindex="0">` +
    `<span class="ml-btn-logo">◎</span><span class="ml-btn-label">Analyser</span></div>`;
  const btn = r.firstElementChild as HTMLElement;
  if (isNew) requestAnimationFrame(() => btn.classList.add("ml-in"));

  const trigger = (): void => void onClick(ctx, btn);
  btn.addEventListener("click", trigger);
  btn.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      trigger();
    }
  });
}

async function onClick(ctx: ListingContext, btn: HTMLElement): Promise<void> {
  if (loading) return;
  loading = true;
  const navUrl = location.href; // garde anti-contexte-périmé
  btn.setAttribute("aria-disabled", "true");
  btn.innerHTML = `<span class="ml-spinner"></span><span class="ml-btn-label">Analyse…</span>`;

  const onClose = (): void => mountAnalyzeButton(ctx);

  // (C2.c) gate `confirm` : AUCUN snapshot avant résolution. (C2.d) cache consulté AVANT le gate.
  if (ctx.intent.gate === "confirm") {
    const cached = await getCachedDecision(ctx.url);
    if (location.href !== navUrl) {
      loading = false;
      return;
    }
    if (cached === "confirmed") {
      removeAnalyzeButton();
      openFilteredOverlay(ctx, { onClose }); // overlay filtré direct, AUCUN snapshot ni re-POST
      return;
    }
    if (cached !== "overridden") {
      removeAnalyzeButton();
      openConfirmOverlay(ctx, { onClose }); // gate de confirmation (aucun snapshot)
      return;
    }
    // cached === "overridden" -> snapshot direct (bloc commun ci-dessous, pas de re-POST)
  }

  // gate `info` (sale/mining/rma_refurb/professional/reserved/aberration) OU confirm+overridden :
  // snapshot normal. Le bouton garde le spinner pendant l'appel.
  const outcome = await requestSnapshot(ctx);
  // Nav SPA pendant l'appel -> ABANDON (pas d'overlay hors contexte, garde-fou faux-match).
  if (location.href !== navUrl) {
    loading = false;
    return;
  }
  removeAnalyzeButton(); // le bouton s'efface au profit de l'overlay ; re-monté à la fermeture
  openOverlay(ctx, outcome, { onClose });
}
