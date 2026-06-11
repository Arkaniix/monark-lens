// src/content/ui/button.ts — BOUTON PASSIF (ÉTAPE 2). Shadow closed, top-right.
// PRINCIPE PRODUIT GRAVÉ : à l'état passif, l'extension n'injecte RIEN d'autre qu'un
// bouton — aucun badge, aucun overlay spontané. Le bouton est le SEUL ajout à la page.

import { injectStyles } from "./styles";
import { openOverlay } from "./overlay";
import { requestSnapshot } from "./snapshot-client";
import type { ListingContext } from "./snapshot-client";

const HOST_ID = "monark-lens-button";

/**
 * Gate d'apparition (partie intent) : montre le bouton SAUF bundle / wanted / test_spam.
 *
 * NOUVELLE RÈGLE PRODUIT V2-03, divergence v1 ASSUMÉE : en v1 l'overlay s'affichait AUSSI
 * sur bundle (score complet) et wanted (overlay filtré) — seul test_spam avait
 * shouldOverlay:false. v2 s'en écarte volontairement : un verdict honnête est impossible
 * sur un LOT (prix non représentatif du composant seul) et l'analyse est SANS OBJET sur
 * une DEMANDE d'achat (rien à acheter). On exclut donc explicitement bundle + wanted, et
 * test_spam reste exclu via shouldOverlay===false.
 */
export function shouldShowAnalyzeButton(intentType: string, shouldOverlay: boolean): boolean {
  if (!shouldOverlay) return false; // test_spam
  if (intentType === "bundle" || intentType === "wanted") return false;
  return true;
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
    `<span class="ml-btn-logo">◎</span><span class="ml-btn-label">Analyser</span>` +
    `<span class="ml-btn-cost">· 1 cr</span></div>`;
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

  const outcome = await requestSnapshot(ctx);
  // Si l'utilisateur a navigué (SPA) pendant l'appel, on ABANDONNE : pas d'overlay spontané
  // pour l'annonce précédente, pas de re-montage d'un bouton hors contexte (garde-fou faux-match).
  if (location.href !== navUrl) {
    loading = false;
    return;
  }
  // Le bouton s'efface au profit de l'overlay ; il sera re-monté à la fermeture.
  removeAnalyzeButton();
  openOverlay(ctx, outcome, { onClose: () => mountAnalyzeButton(ctx) });
}
