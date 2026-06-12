// src/content/ui/styles.ts — feuille de style unique injectée dans CHAQUE shadow root
// (bouton + overlay). Compose : tokens (src/ui) + @font-face (src/ui) + classes composant.
//
// INVARIANT 0-IMPORT : importe uniquement src/ui/* (eux-mêmes content-only) → tout est
// inliné dans content/main.js. Le positionnement du host (fixed/top/right) est posé en
// INLINE par button.ts/overlay.ts (pas via :host), pour que les deux shadow roots
// partagent la même feuille tout en se plaçant différemment.

import { HOST_TOKENS_CSS } from "../../ui/tokens";
import { fontFaceCss } from "../../ui/fonts";

const COMPONENT_CSS = `
*, *::before, *::after { box-sizing: border-box; }

:host { all: initial; }
.ml-root {
  font-family: var(--font-sans);
  font-size: 13px;
  line-height: 1.45;
  color: var(--zinc-400);
  -webkit-font-smoothing: antialiased;
}
.ml-num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.ml-ico { width: 14px; height: 14px; flex: none; }

/* ── Bouton passif ───────────────────────────────────────────────────────── */
.ml-btn {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 8px 12px;
  background: var(--bg);              /* #0A0A0B plein — JAMAIS de fond clair sur page hôte claire (LBC) */
  color: #E4E4E7;                     /* zinc clair, lisible sur le fond sombre du bouton */
  border: 1px solid var(--divider);   /* définition discrète sur hôte clair comme sombre (eBay) */
  border-radius: var(--radius);
  cursor: pointer; user-select: none;
  font-size: 12.5px; font-weight: 500;
  box-shadow: 0 2px 14px rgba(0,0,0,0.35);
  transition: border-color var(--t-fast) var(--ease-expo),
              box-shadow var(--t-fast) var(--ease-expo),
              transform var(--t-fast) var(--ease-expo),
              opacity var(--t-fast) var(--ease-expo);
  opacity: 0; transform: translateY(-4px);
}
.ml-btn.ml-in { opacity: 1; transform: translateY(0); }
.ml-btn:hover { border-color: var(--blue); box-shadow: 0 2px 18px rgba(59,130,246,0.28); transform: translateY(-2px); }
.ml-btn[aria-disabled="true"] { cursor: progress; }
/* (A3) Placeholder de chargement : même pilule sombre, non interactif (pas de hover-lift). */
.ml-btn-loading { cursor: default; }
.ml-btn-loading:hover { border-color: var(--divider); box-shadow: 0 2px 14px rgba(0,0,0,0.35); transform: translateY(0); }
.ml-btn-logo { color: var(--turquoise); font-size: 14px; line-height: 1; }
.ml-btn-cost { color: var(--zinc-500); font-family: var(--font-mono); font-size: 11px; }
.ml-spinner {
  width: 12px; height: 12px; border-radius: 50%;
  border: 2px solid var(--hairline); border-top-color: var(--turquoise);
  animation: ml-spin 0.7s linear infinite;
}
@keyframes ml-spin { to { transform: rotate(360deg); } }

/* ── Overlay panneau ─────────────────────────────────────────────────────── */
/* Conteneur flottant : fond plein + halo discret pour la LISIBILITÉ sur page claire
   (LBC) comme sombre (eBay dark). Les cartes INTERNES restent sans bordure/ombre (DA). */
.ml-overlay {
  position: relative; overflow: hidden;
  width: 360px; max-width: calc(100vw - 24px);
  background: var(--bg);
  border-radius: 14px;
  padding: 14px 14px 10px;
  box-shadow: 0 10px 48px rgba(0,0,0,0.55);
  outline: 1px solid var(--divider);
  animation: ml-pop var(--t-slow) var(--ease-expo);
}
.ml-overlay::before {
  content: ""; position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(circle at top right, rgba(59,130,246,0.04), transparent 50%);
}
@keyframes ml-pop { from { opacity: 0; transform: translateY(-6px) scale(0.985); } to { opacity: 1; transform: none; } }

.ml-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.ml-brand { display: inline-flex; align-items: center; gap: 6px; font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--zinc-500); }
.ml-brand-logo { color: var(--turquoise); font-size: 13px; text-transform: none; }
.ml-close {
  display: inline-flex; align-items: center; justify-content: center;
  width: 22px; height: 22px; border-radius: 7px;
  background: transparent; color: var(--zinc-500); cursor: pointer; font-size: 13px;
  transition: background var(--t-fast) var(--ease-expo), color var(--t-fast) var(--ease-expo);
}
.ml-close:hover { background: var(--card-hover); color: var(--zinc-300); }

/* (A4) Solde crédits — toujours visible en header, sur TOUS les états (y c. erreurs). */
.ml-head-right { display: inline-flex; align-items: center; gap: 8px; }
.ml-head-credits { font-family: var(--font-mono); font-size: 11px; color: var(--zinc-400); padding: 2px 7px; border-radius: 6px; background: var(--subcard); box-shadow: inset 0 1px 0 0 var(--hairline); }
.ml-head-credits:empty { display: none; }

/* Rappel de contexte OBLIGATOIRE (garde-fou faux-match) : sur QUOI porte l'analyse. */
.ml-context { position: relative; overflow: hidden; background: var(--card); border-radius: var(--radius-card); padding: 8px 10px; margin-bottom: 10px; box-shadow: inset 0 1px 0 0 var(--hairline); }
.ml-context-name { color: var(--zinc-100); font-weight: 500; font-size: 13px; word-break: break-word; }
.ml-context-price { color: var(--zinc-400); font-size: 12px; margin-top: 2px; }
.ml-context-price b { color: var(--zinc-300); }

/* Consensus communauté — ligne discrète, injectée en async (best-effort, jamais bloquant) */
.ml-consensus-slot:empty { display: none; }
.ml-consensus { font-size: 11.5px; line-height: 1.4; margin: -4px 0 8px; }

/* Héros médiane vendue */
.ml-hero { display: flex; align-items: baseline; gap: 8px; margin: 2px 0 8px; }
.ml-hero-value { font-family: var(--font-mono); font-size: 30px; font-weight: 500; color: var(--zinc-100); letter-spacing: -0.01em; }
.ml-hero-label { color: var(--zinc-500); font-size: 11px; }

.ml-verdict { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 999px; font-family: var(--font-mono); font-weight: 500; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; animation: ml-verdict-pop 500ms var(--ease-expo) 80ms both; }
@keyframes ml-verdict-pop { from { opacity: 0; transform: scale(0.9); } }
.ml-gap { font-family: var(--font-mono); font-size: 12px; margin-left: 2px; }

/* Cartes internes (DA : opacité, pas de bordure/ombre) */
.ml-card { position: relative; overflow: hidden; background: var(--card); border-radius: var(--radius-card); padding: 8px 10px; margin-bottom: 8px; box-shadow: inset 0 1px 0 0 var(--hairline); }
.ml-card::before, .ml-context::before, .ml-note::before {
  content: ""; position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(circle at top right, rgba(59,130,246,0.04), transparent 50%);
}
.ml-line { display: flex; align-items: center; justify-content: space-between; padding: 3px 0; font-size: 12.5px; }
.ml-line + .ml-line { border-top: 1px solid var(--hairline); }
.ml-line-k { color: var(--zinc-500); }
.ml-line-v { color: var(--zinc-300); }
.ml-trend-up { color: var(--green); }
.ml-trend-down { color: var(--red); }
.ml-trend-flat { color: var(--zinc-400); }

/* Fourchette prix DEMANDÉS — visuellement DISTINCTE de la médiane vendue */
.ml-range { background: var(--subcard); border-radius: var(--radius); padding: 8px 10px; margin-bottom: 8px; box-shadow: inset 0 1px 0 0 var(--hairline); }
.ml-range-label { font-family: var(--font-mono); color: var(--zinc-500); font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.05em; }
.ml-range-val { font-family: var(--font-mono); color: var(--zinc-300); font-size: 14px; margin-top: 3px; }

/* États dégradés / messages */
.ml-note { position: relative; overflow: hidden; background: var(--card); border-radius: var(--radius-card); padding: 10px; font-size: 12.5px; color: var(--zinc-400); margin-bottom: 8px; box-shadow: inset 0 1px 0 0 var(--hairline); }
.ml-note-title { color: var(--zinc-100); font-weight: 500; display: block; margin-bottom: 3px; }
.ml-nodebit { display: inline-block; margin-top: 6px; padding: 2px 8px; border-radius: 6px; background: rgba(16,185,129,0.12); color: var(--green); font-size: 11px; font-weight: 600; }
.ml-cached { font-size: 11px; color: var(--zinc-500); margin: -2px 0 8px; }
.ml-cached b { color: var(--green); font-weight: 600; }
.ml-link { color: var(--blue); cursor: pointer; text-decoration: none; }
.ml-link:hover { text-decoration: underline; }

/* Actions */
.ml-actions { display: flex; flex-direction: column; gap: 6px; margin-top: 4px; }
.ml-act-row { display: flex; gap: 6px; }
.ml-act {
  flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  padding: 8px 10px; border-radius: var(--radius);
  background: var(--subcard); color: var(--zinc-300);
  cursor: pointer; font-size: 12.5px; font-weight: 500; font-family: var(--font-sans);
  transition: background var(--t-fast) var(--ease-expo), transform var(--t-fast) var(--ease-expo);
}
.ml-act:hover { background: var(--subcard-hover); transform: translateY(-2px); }
.ml-act-primary { background: rgba(59,130,246,0.14); color: #93c5fd; }
.ml-act-primary:hover { background: rgba(59,130,246,0.2); }
.ml-act[aria-disabled="true"] { opacity: 0.55; cursor: default; }
.ml-act-ok { color: var(--green); }

/* Panneau Signaler (14 anomalies) */
.ml-flag-prompt { color: var(--zinc-400); font-size: 12px; margin-bottom: 6px; }
.ml-flag-list { max-height: 260px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; }
.ml-flag-opt {
  display: flex; align-items: center; gap: 8px; padding: 7px 9px; border-radius: 8px;
  background: var(--subcard); color: var(--zinc-300); cursor: pointer; font-size: 12.5px;
  transition: background var(--t-fast) var(--ease-expo);
}
.ml-flag-opt:hover { background: var(--subcard-hover); }
.ml-flag-ico { width: 18px; text-align: center; }

/* Footer (A4 : crédits déplacés en header → footer = version seule) */
.ml-footer { display: flex; align-items: center; justify-content: flex-end; margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--hairline); }
.ml-footer-ver { font-size: 10px; color: var(--zinc-500); }

/* Verdict panel (B2) */
.ml-vd-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.ml-vd-desc { color: var(--zinc-400); font-size: 12px; margin-bottom: 10px; }
.ml-vd-basis { font-family: var(--font-mono); font-size: 10px; color: var(--zinc-500); padding: 1px 7px; border-radius: 6px; background: var(--subcard); }
.ml-vd-hero { font-size: 28px; font-weight: 500; line-height: 1.1; display: flex; flex-direction: column; gap: 2px; margin-bottom: 10px; }
.ml-vd-hero-sub { font-family: var(--font-sans); font-size: 11px; font-weight: 400; color: var(--zinc-500); }
.ml-vd-mod { display: flex; align-items: center; gap: 5px; color: var(--amber); font-size: 11px; margin: 4px 0 8px; }
.ml-vd-warn { display: flex; flex-direction: column; gap: 4px; color: var(--zinc-400); font-size: 11px; margin-top: 6px; }
.ml-vd-warn div { display: flex; align-items: flex-start; gap: 5px; }
.ml-vd-warn-strong { color: var(--amber); font-size: 12px; }
.ml-vd-cost { color: var(--zinc-500); font-size: 10px; text-align: right; margin-top: 8px; }
`;

/** Injecte tokens + polices + styles composant dans un shadow root. */
export function injectStyles(shadow: ShadowRoot): void {
  const style = document.createElement("style");
  style.textContent = `${HOST_TOKENS_CSS}\n${fontFaceCss()}\n${COMPONENT_CSS}`;
  shadow.appendChild(style);
}
