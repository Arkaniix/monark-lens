// src/content/auth-bridge.ts — logique PURE du bridge auth site↔extension (LOT D), testable.
// Module CONTENT (inliné dans main.js par Vite → 0-import préservé). Décode le JWT localement
// (b64url inline ; pas d'import lib pour respecter l'invariant MV3). Signature NON vérifiée :
// on ne lit exp/sub que pour cadencer et discriminer, le serveur reste l'autorité.

export interface JwtClaims {
  exp: number | null; // epoch secondes
  sub: string | null;
}

export function jwtClaims(token: string | null | undefined): JwtClaims {
  if (!token) return { exp: null, sub: null };
  const part = token.split(".")[1];
  if (!part) return { exp: null, sub: null };
  try {
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
    const json = JSON.parse(atob(b64 + pad)) as { exp?: unknown; sub?: unknown };
    return {
      exp: typeof json.exp === "number" ? json.exp : null,
      sub: json.sub != null ? String(json.sub) : null,
    };
  } catch {
    return { exp: null, sub: null };
  }
}

export type SiteWriteAction = "reload" | "silent" | "clear";

/**
 * Décision d'écriture côté site quand le SW pousse une paire (SYNC_TOKENS_TO_SITE).
 * `reason` est EXPLICITE (le SW sait pourquoi il émet — pas d'inférence par présence).
 *  - logout / pas de nouvel access -> "clear" (purge + reload).
 *  - rotate + MÊME sub (même session) -> "silent" : écrire localStorage SANS reload
 *    (le site lit le token live → l'adopte seul). Garde-fou : sub différent → "reload".
 *  - login (ou reason absente, par sécurité) -> "reload".
 */
export function decideSiteWrite(
  reason: "rotate" | "login" | "logout" | undefined,
  oldAccess: string | null,
  newAccess: string | null,
): SiteWriteAction {
  if (!newAccess) return "clear";
  if (reason === "rotate") {
    const oldSub = jwtClaims(oldAccess).sub;
    const newSub = jwtClaims(newAccess).sub;
    if (oldAccess && oldSub && newSub && oldSub === newSub) return "silent";
    return "reload"; // sub différent ou ancien absent → bascule d'état
  }
  return "reload";
}

/** Réconciliation « deux access présents mais différents » : lequel est le plus récent (exp). */
export function fresher(siteAccess: string, extAccess: string): "site" | "ext" {
  return (jwtClaims(siteAccess).exp ?? 0) >= (jwtClaims(extAccess).exp ?? 0) ? "site" : "ext";
}
