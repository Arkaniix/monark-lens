// src/lib/auth-logic.ts — logique de décision auth, EN FONCTIONS PURES (testables).
// Le service-worker câble ces helpers ; aucune I/O ici.

/** Refresh proactif : vrai si le token expire dans moins de 60 s. (v1-identique.) */
export function shouldRefresh(expiresAt: number | null, now: number): boolean {
  return expiresAt !== null && now > expiresAt - 60_000;
}

/** Backoff exponentiel borné pour les 429 : base·2^attempt, plafonné à max. (v1-identique.) */
export function nextBackoff(attempt: number, base = 1000, max = 30000): number {
  return Math.min(base * 2 ** attempt, max);
}

function b64urlDecode(input: string): string {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
  return atob(b64 + pad);
}

/**
 * Décode le champ `exp` (epoch secondes) du payload d'un JWT access et le renvoie
 * en millisecondes epoch. **Signature NON vérifiée** (le serveur reste l'autorité ;
 * on ne lit `exp` que pour cadencer le refresh local). Renvoie null si indécodable.
 *
 * Écart v1 ASSUMÉ : le bridge v1 posait `expires_in:3600` en dur au sync site→ext,
 * d'où un token cru valide 1 h alors que l'access JWT vit 15 min (401 prématuré).
 * En v2 on lit le vrai `exp` ; fallback 900 s géré par l'appelant.
 */
export function decodeJwtExp(token: string): number | null {
  const parts = token.split(".");
  if (parts.length < 2 || !parts[1]) return null;
  try {
    const payload = JSON.parse(b64urlDecode(parts[1])) as { exp?: unknown };
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}
