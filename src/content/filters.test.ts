import { describe, expect, it } from "vitest";

import { classifyIntent, extractDefects } from "./filters";

function c(title: string, price: number | null = 200, desc: string | null = null, cat: string | null = "gpu") {
  return classifyIntent(title, price, desc, cat);
}

describe("classifyIntent — disposition + gate shouldSignal", () => {
  it("vente standard -> sale, shouldSignal=true", () => {
    const r = c("RTX 3060 Ti 8GB OC");
    expect(r.type).toBe("sale");
    expect(r.shouldSignal).toBe(true);
  });
  it("wanted (titre) -> shouldSignal=false", () => {
    const r = c("Cherche RTX 3060");
    expect(r.type).toBe("wanted");
    expect(r.shouldSignal).toBe(false);
  });
  it("trade -> false", () => expect(c("RTX 3070 échange possible").shouldSignal).toBe(false));
  it("bundle PC complet -> false", () => expect(c("PC Gamer RTX 3060 Ryzen 5").type).toBe("bundle"));
  it("mining -> shouldSignal=true", () => {
    const r = c("RTX 3080 ex-minage");
    expect(r.type).toBe("mining");
    expect(r.shouldSignal).toBe(true);
  });
  it("broken HS -> shouldSignal=true", () => {
    const r = c("RTX 2070 HS pour pièces");
    expect(r.type).toBe("broken");
    expect(r.shouldSignal).toBe(true);
  });
  it("box_only -> false", () => expect(c("Boîte vide RTX 3080").type).toBe("box_only"));
  it("prix 1€ -> symbolic_price", () => expect(c("RTX 3060", 1).type).toBe("symbolic_price"));
  it("prix symbolique sous seuil GPU -> symbolic_price", () => expect(c("RTX 3060", 10).type).toBe("symbolic_price"));
  it("prix aberrant > 20000 -> flag price_error_suspected", () => {
    expect(c("RTX 3060", 25000).flags).toContain("price_error_suspected");
  });
  it("multiple lot -> quantity capturée", () => {
    const r = c("Lot de 4 RTX 3060");
    expect(r.type).toBe("multiple");
  });
});

describe("extractDefects", () => {
  it("détecte plusieurs défauts", () => {
    expect(extractDefects("carte avec rayures et surchauffe")).toEqual(["cosmetic_scratch", "overheating"]);
  });
  it("null si aucun", () => expect(extractDefects("carte impeccable")).toBeNull());
});
