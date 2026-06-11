// src/lib/adhash.ts — recette de hash canonique PARTAGÉE avec le backend.
// DOIT rester byte-identique à app/utils/url_hash.py (monark_api) et aux vecteurs
// de tests/test_canonical_ad_hash.py. Toute divergence casse l'interopérabilité
// snapshot / community (flag, consensus).
//
//   canonical(url) = lowercase(host) + pathname
//                    (sans scheme, sans query, sans fragment, sans trailing slash)
//   ad_hash        = sha256(utf8(canonical(url)))  -> 64 hex minuscules (WebCrypto)
//
// Équivalence avec urllib.parse.urlsplit côté Python : `new URL().hostname` et
// `urlsplit().hostname` excluent tous deux le port et renvoient l'hôte en minuscules ;
// `pathname.replace(/\/+$/,"")` == `path.rstrip("/")` (un pathname réduit à "/" -> "").

export function canonicalUrl(url: string): string {
  const u = new URL(url);
  const path = u.pathname.replace(/\/+$/, "");
  return u.hostname.toLowerCase() + path;
}

export async function canonicalAdHash(url: string): Promise<string> {
  const data = new TextEncoder().encode(canonicalUrl(url));
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
