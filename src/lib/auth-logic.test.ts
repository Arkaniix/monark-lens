import { describe, expect, it } from "vitest";

import { decodeJwtExp, nextBackoff, shouldRefresh } from "./auth-logic";

describe("shouldRefresh — refresh proactif à expiry−60s", () => {
  it("faux si expiry null", () => {
    expect(shouldRefresh(null, 1000)).toBe(false);
  });
  it("faux si plus de 60s avant expiry", () => {
    expect(shouldRefresh(200_000, 100_000)).toBe(false); // 100s de marge
  });
  it("vrai dans la fenêtre des 60s", () => {
    expect(shouldRefresh(200_000, 150_000)).toBe(true); // 50s de marge
  });
  it("vrai si déjà expiré", () => {
    expect(shouldRefresh(100_000, 200_000)).toBe(true);
  });
});

describe("nextBackoff — exponentiel borné (base 1s / max 30s)", () => {
  it("progression 1/2/4/8/16s", () => {
    expect(nextBackoff(0)).toBe(1000);
    expect(nextBackoff(1)).toBe(2000);
    expect(nextBackoff(2)).toBe(4000);
    expect(nextBackoff(3)).toBe(8000);
    expect(nextBackoff(4)).toBe(16000);
  });
  it("plafonné à 30s", () => {
    expect(nextBackoff(5)).toBe(30000); // 32000 -> clamp 30000
    expect(nextBackoff(10)).toBe(30000);
  });
});

function b64url(obj: object): string {
  // payloads ASCII -> btoa direct suffit (dispo en lib DOM + Node 20)
  return btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function makeJwt(payload: object): string {
  return `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url(payload)}.signature`;
}

describe("decodeJwtExp — exp réel du JWT (écart v1: plus de 3600 en dur)", () => {
  it("renvoie exp*1000 (ms epoch)", () => {
    expect(decodeJwtExp(makeJwt({ sub: "1", exp: 1_893_456_000 }))).toBe(1_893_456_000_000);
  });
  it("null si pas de champ exp", () => {
    expect(decodeJwtExp(makeJwt({ sub: "1" }))).toBeNull();
  });
  it("null si token malformé", () => {
    expect(decodeJwtExp("not-a-jwt")).toBeNull();
    expect(decodeJwtExp("a.b.c")).toBeNull(); // payload non-base64-json
  });
});
