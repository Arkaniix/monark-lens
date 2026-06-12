import { describe, expect, it } from "vitest";

import { decideSiteWrite, fresher, jwtClaims } from "./auth-bridge";

// Fabrique un JWT (header.payload.sig) à payload base64url — atob/btoa dispo (node ≥16).
function jwt(payload: Record<string, unknown>): string {
  const b64 = btoa(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `h.${b64}.s`;
}

describe("auth-bridge — jwtClaims", () => {
  it("décode exp + sub", () => {
    const c = jwtClaims(jwt({ exp: 1750000000, sub: "user-42" }));
    expect(c.exp).toBe(1750000000);
    expect(c.sub).toBe("user-42");
  });
  it("null / malformé -> {null,null}", () => {
    expect(jwtClaims(null)).toEqual({ exp: null, sub: null });
    expect(jwtClaims("garbage")).toEqual({ exp: null, sub: null });
    expect(jwtClaims("a.b")).toEqual({ exp: null, sub: null });
  });
});

describe("auth-bridge — decideSiteWrite (reason explicite + garde-fou sub)", () => {
  const A = jwt({ exp: 1000, sub: "u1" });
  const A2 = jwt({ exp: 2000, sub: "u1" }); // même session, rotaté
  const B = jwt({ exp: 2000, sub: "u2" }); // autre utilisateur

  it("logout / pas de nouvel access -> clear", () => {
    expect(decideSiteWrite("logout", A, null)).toBe("clear");
    expect(decideSiteWrite("rotate", A, null)).toBe("clear");
  });
  it("rotate + même sub -> silent (pas de reload)", () => {
    expect(decideSiteWrite("rotate", A, A2)).toBe("silent");
  });
  it("rotate + sub différent -> reload (garde-fou bascule d'état)", () => {
    expect(decideSiteWrite("rotate", A, B)).toBe("reload");
  });
  it("rotate sans ancien access -> reload", () => {
    expect(decideSiteWrite("rotate", null, A2)).toBe("reload");
  });
  it("login -> reload ; reason absente -> reload (sécurité)", () => {
    expect(decideSiteWrite("login", null, A)).toBe("reload");
    expect(decideSiteWrite(undefined, A, A2)).toBe("reload");
  });
});

describe("auth-bridge — fresher (réconciliation par exp)", () => {
  it("site plus récent", () => {
    expect(fresher(jwt({ exp: 2000, sub: "u" }), jwt({ exp: 1000, sub: "u" }))).toBe("site");
  });
  it("ext plus récent", () => {
    expect(fresher(jwt({ exp: 1000, sub: "u" }), jwt({ exp: 2000, sub: "u" }))).toBe("ext");
  });
  it("égalité -> site (>=)", () => {
    expect(fresher(jwt({ exp: 1000, sub: "u" }), jwt({ exp: 1000, sub: "u" }))).toBe("site");
  });
});
