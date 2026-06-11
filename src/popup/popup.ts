// src/popup/popup.ts — popup RÉEL (V2-03, remplace le harnais [DEV]).
// Le popup ne fait JAMAIS de fetch : tout passe par le service-worker (proxy strict).
// Contenu : état connexion (email · plan · crédits) | login | détection onglet courant |
// toggle collecte passive (auto_signal) | compteurs session | lien Ouvrir Monark.

import { EXTENSION_VERSION, MONARK_WEB_URL } from "../lib/constants";
import type { AuthState } from "../lib/messages";

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`#${id} introuvable`);
  return node as T;
}

function send<T>(message: unknown): Promise<T> {
  return chrome.runtime.sendMessage(message) as Promise<T>;
}

function show(id: string, on: boolean): void {
  el(id).hidden = !on;
}

async function refreshAuth(): Promise<void> {
  const s = await send<AuthState>({ type: "GET_AUTH_STATE" });
  show("account", s.isLoggedIn);
  show("login", !s.isLoggedIn);
  if (s.isLoggedIn) {
    el("acct-email").textContent = s.email ?? "—";
    el("acct-plan").textContent = s.plan;
    el("acct-credits").textContent = s.unlimited ? "∞" : String(s.credits);
    el("sess-signals").textContent = String(s.sessionSignals);
    el("sess-credits").textContent = `+${s.sessionCredits}`;
  } else {
    el("sess-signals").textContent = "0";
    el("sess-credits").textContent = "+0";
  }
}

async function onLogin(ev: Event): Promise<void> {
  ev.preventDefault();
  el("login-error").textContent = "";
  const email = el<HTMLInputElement>("email").value.trim();
  const password = el<HTMLInputElement>("password").value;
  const res = await send<AuthState & { error?: string }>({ type: "LOGIN", email, password });
  if (res.error) el("login-error").textContent = res.error;
  await refreshAuth();
}

async function onLogout(): Promise<void> {
  await send({ type: "LOGOUT" });
  await refreshAuth();
}

async function loadDetection(): Promise<void> {
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
  const d = el("detected");
  d.replaceChildren();
  if (s.current_component_id) {
    const name = document.createElement("div");
    name.className = "det-name";
    name.textContent = s.current_component_name ?? "Composant détecté";
    const meta = document.createElement("div");
    meta.className = "det-meta num";
    const price = s.current_price != null ? `${s.current_price} €` : "prix ?";
    meta.textContent = `${price} · ${s.current_platform ?? "?"}`;
    d.append(name, meta);
  } else {
    d.textContent = "Aucune annonce détectée sur l'onglet courant.";
    d.classList.add("muted");
  }
}

async function loadAutoSignal(): Promise<void> {
  const { auto_signal } = (await chrome.storage.local.get(["auto_signal"])) as { auto_signal?: boolean };
  el<HTMLInputElement>("auto-signal").checked = auto_signal !== false; // défaut = activé
}

async function onToggleAutoSignal(): Promise<void> {
  await chrome.storage.local.set({ auto_signal: el<HTMLInputElement>("auto-signal").checked });
}

function init(): void {
  el("version").textContent = `v${EXTENSION_VERSION}`;
  el<HTMLAnchorElement>("open-web").href = MONARK_WEB_URL;
  el<HTMLFormElement>("login-form").addEventListener("submit", (e) => void onLogin(e));
  el("logout").addEventListener("click", () => void onLogout());
  el("auto-signal").addEventListener("change", () => void onToggleAutoSignal());
  void refreshAuth();
  void loadDetection();
  void loadAutoSignal();
}

init();
