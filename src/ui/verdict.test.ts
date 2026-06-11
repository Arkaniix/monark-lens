import { describe, expect, it } from "vitest";

import { verdictMeta } from "./verdict";

describe("verdictMeta — mapping DA verdict → couleur (ÉTAPE 1.3)", () => {
  it("excellente_affaire & bonne_affaire → vert", () => {
    expect(verdictMeta("excellente_affaire").tone).toBe("good");
    expect(verdictMeta("excellente_affaire").color).toBe("var(--green)");
    expect(verdictMeta("bonne_affaire").tone).toBe("good");
    expect(verdictMeta("bonne_affaire").color).toBe("var(--green)");
  });

  it("prix_correct → zinc neutre (ni bon ni mauvais)", () => {
    expect(verdictMeta("prix_correct").tone).toBe("neutral");
    expect(verdictMeta("prix_correct").color).toBe("var(--zinc-400)");
  });

  it("au_dessus_marche → ambre", () => {
    expect(verdictMeta("au_dessus_marche").tone).toBe("warn");
    expect(verdictMeta("au_dessus_marche").color).toBe("var(--amber)");
  });

  it("trop_cher & a_eviter → rouge", () => {
    expect(verdictMeta("trop_cher").tone).toBe("bad");
    expect(verdictMeta("trop_cher").color).toBe("var(--red)");
    expect(verdictMeta("a_eviter").tone).toBe("bad");
    expect(verdictMeta("a_eviter").color).toBe("var(--red)");
  });

  it("null / inconnu → zinc neutre (fallback honnête)", () => {
    expect(verdictMeta(null).tone).toBe("unknown");
    expect(verdictMeta(undefined).tone).toBe("unknown");
    expect(verdictMeta("nimporte_quoi").color).toBe("var(--zinc-400)");
  });
});
