// src/popup/popup.ts — harnais de dev TEMPORAIRE [DEV] (sera remplacé en V2-03).
// Le popup ne fait JAMAIS de fetch : tout passe par le service-worker (proxy strict).

import { EXTENSION_VERSION } from "../lib/constants";
import type { SnapshotResponse } from "../lib/api-types";
import type { AuthState } from "../lib/messages";

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`#${id} introuvable`);
  return node as T;
}

function send<T>(message: unknown): Promise<T> {
  return chrome.runtime.sendMessage(message) as Promise<T>;
}

function platformFromUrl(url: string): string {
  try {
    const h = new URL(url).hostname;
    if (h.includes("leboncoin")) return "leboncoin";
    if (h.includes("ebay")) return "ebay";
    if (h.includes("vinted")) return "vinted";
  } catch {
    /* url invalide -> other */
  }
  return "other";
}

async function refreshAuth(): Promise<void> {
  const s = await send<AuthState>({ type: "GET_AUTH_STATE" });
  el("auth-status").textContent = s.isLoggedIn
    ? `Connecté : ${s.email ?? "?"} (${s.plan}) — crédits ${s.unlimited ? "∞" : String(s.credits)}`
    : "Non connecté";
}

async function onLogin(ev: Event): Promise<void> {
  ev.preventDefault();
  el("auth-error").textContent = "";
  const email = el<HTMLInputElement>("email").value.trim();
  const password = el<HTMLInputElement>("password").value;
  const res = await send<AuthState & { error?: string }>({ type: "LOGIN", email, password });
  if (res.error) el("auth-error").textContent = res.error;
  await refreshAuth();
}

async function onLogout(): Promise<void> {
  await send({ type: "LOGOUT" });
  await refreshAuth();
}

async function prefillFromDetection(): Promise<void> {
  // Lit le dernier DETECTION_STATUS (current_*) écrit par le content script.
  const s = (await chrome.storage.local.get([
    "current_component_id",
    "current_component_name",
    "current_price",
    "current_platform",
  ])) as {
    current_component_id?: number | null;
    current_component_name?: string | null;
    current_price?: number | null;
    current_platform?: string | null;
  };
  const detected = el("detected");
  if (s.current_component_id) {
    el<HTMLInputElement>("component-id").value = String(s.current_component_id);
    if (s.current_price != null) el<HTMLInputElement>("asking-price").value = String(s.current_price);
    detected.textContent = `Détecté : ${s.current_component_name ?? "?"} (#${s.current_component_id}) — ${
      s.current_price ?? "?"
    }€ · ${s.current_platform ?? "?"}`;
  } else {
    detected.textContent = "Aucun composant détecté sur l'onglet courant (saisie manuelle).";
  }
}

async function onRunSnapshot(): Promise<void> {
  const out = el<HTMLPreElement>("snapshot-output");
  const meta = el("snapshot-meta");
  out.textContent = "…";
  meta.textContent = "";

  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tabs[0]?.url;
  if (!url) {
    out.textContent = "Pas d'URL exploitable sur l'onglet courant.";
    return;
  }

  const component_id = Number(el<HTMLInputElement>("component-id").value);
  const asking_price = Number(el<HTMLInputElement>("asking-price").value);
  const platform = platformFromUrl(url);

  const res = await send<SnapshotResponse & { error?: string }>({
    type: "GET_SNAPSHOT",
    url,
    component_id,
    asking_price,
    platform,
  });

  if (res.error) {
    out.textContent = `Erreur : ${res.error}`;
    return;
  }

  meta.textContent =
    `cached=${String(res.cached)} · credits_charged=${String(res.credits_charged)} · ` +
    `credits_remaining=${String(res.credits_remaining)} · state=${res.state} · platform=${platform}`;
  out.textContent = JSON.stringify(res, null, 2);
}

function init(): void {
  el("version").textContent = `v${EXTENSION_VERSION} [harness]`;
  el<HTMLFormElement>("login-form").addEventListener("submit", (e) => void onLogin(e));
  el("logout").addEventListener("click", () => void onLogout());
  el("run-snapshot").addEventListener("click", () => void onRunSnapshot());
  void refreshAuth();
  void prefillFromDetection();
}

init();
