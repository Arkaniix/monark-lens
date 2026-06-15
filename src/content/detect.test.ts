import { beforeEach, describe, expect, it } from "vitest";

import { matchComponent, normalize, setComponentDb } from "./detect";
import type { ComponentDbEntry } from "../lib/api-types";

// Fixture : variantes proches (le risque produit n°1 = un faux match → snapshot facturé sur
// le mauvais composant). On teste les DEUX ordres de DB pour PROUVER le déterminisme.
const BASE_FIRST: ComponentDbEntry[] = [
  { id: 1, name: "RTX 3060", category: "gpu", aliases: ["3060", "rtx 3060", "geforce rtx 3060"] },
  { id: 2, name: "RTX 3060 Ti", category: "gpu", aliases: ["3060 ti", "rtx 3060 ti"] },
  { id: 3, name: "RX 6600", category: "gpu", aliases: ["6600", "rx 6600"] },
  { id: 4, name: "RX 6600 XT", category: "gpu", aliases: ["6600 xt", "rx 6600 xt"] },
  { id: 5, name: "Intel Core i5-12400", category: "cpu", aliases: ["i5-12400", "12400", "i5 12400"] },
  { id: 6, name: "Intel Core i5-12400F", category: "cpu", aliases: ["i5-12400f", "12400f", "i5 12400f"] },
  { id: 7, name: "Intel Core i5-12600K", category: "cpu", aliases: ["i5-12600k", "12600k"] },
  { id: 8, name: "Intel Core i5-12600KF", category: "cpu", aliases: ["i5-12600kf", "12600kf"] },
];
const VARIANT_FIRST: ComponentDbEntry[] = [...BASE_FIRST].reverse();

const CASES: ReadonlyArray<readonly [string, number]> = [
  ["RTX 3060 Ti 8GB OC", 2], // Ti, PAS 3060
  ["Carte graphique RTX 3060 12GB", 1], // 3060, PAS Ti
  ["3060 12GB nvidia", 1], // sans préfixe -> 3060
  ["Sapphire RX 6600 XT Nitro+", 4], // XT, PAS 6600
  ["RX 6600 8GB AMD", 3], // 6600, PAS XT
  ["Intel Core i5-12400F neuf", 6], // F, PAS 12400
  ["i5 12400 stock", 5], // 12400, PAS F
  ["CPU 12400 occasion", 5],
  ["Intel i5-12600KF", 8], // KF, PAS K
  ["i5-12600K seul", 7],
];

describe("matchComponent — pièges suffixes (le plus long/spécifique gagne, DÉTERMINISTE)", () => {
  for (const [label, db] of [["base-first", BASE_FIRST], ["variant-first", VARIANT_FIRST]] as const) {
    describe(`ordre DB: ${label}`, () => {
      beforeEach(() => setComponentDb(db));
      for (const [title, expectedId] of CASES) {
        it(`"${title}" -> #${expectedId}`, () => {
          expect(matchComponent(title)?.componentId).toBe(expectedId);
        });
      }
    });
  }
});

// D4 — fixture aux NOMS DE PROD (préfixe « GeForce » + suffixe « 12GB » sur la base) : c'est
// le SEUL cas qui reproduit le faux « Ti » (l'égalité exacte bare-name ci-dessus masque le bug).
const PROD: ComponentDbEntry[] = [
  { id: 10, name: "GeForce RTX 3060 12GB", category: "gpu", aliases: ["3060", "rtx 3060"] },
  { id: 11, name: "GeForce RTX 3060 Ti", category: "gpu", aliases: ["3060 ti", "rtx 3060 ti"] },
  { id: 12, name: "GeForce RTX 3080", category: "gpu", aliases: ["3080", "rtx 3080"] },
  { id: 13, name: "GeForce RTX 3080 Ti", category: "gpu", aliases: ["3080 ti", "rtx 3080 ti"] },
  { id: 14, name: "GeForce RTX 4070", category: "gpu", aliases: ["4070", "rtx 4070"] },
  { id: 15, name: "GeForce RTX 4070 SUPER", category: "gpu", aliases: ["4070 super"] },
  { id: 16, name: "GeForce RTX 4070 Ti", category: "gpu", aliases: ["4070 ti"] },
];
const PROD_VARIANT_FIRST: ComponentDbEntry[] = [...PROD].reverse();

const PROD_CASES: ReadonlyArray<readonly [string, number]> = [
  ["MSI RTX 3080 gaming Z trio 10Go", 12], // base, PAS Ti (le bug rapporté)
  ["RTX 3060 Ti 8GB", 11], // Ti, PAS base
  ["RTX 4070 Dual OC 12Go", 14], // base, PAS Super/Ti
  ["ASUS RTX 4070 Super 12G", 15], // Super, PAS base/Ti
];

describe("matchComponent — D4 noms de prod (plus petit sur-ensemble, pas de faux Ti/Super)", () => {
  for (const [label, db] of [["prod-base-first", PROD], ["prod-variant-first", PROD_VARIANT_FIRST]] as const) {
    describe(`ordre DB: ${label}`, () => {
      beforeEach(() => setComponentDb(db));
      for (const [title, expectedId] of PROD_CASES) {
        it(`"${title}" -> #${expectedId}`, () => {
          expect(matchComponent(title)?.componentId).toBe(expectedId);
        });
      }
    });
  }
});

describe("normalize — colle suffixes/préfixes + accents", () => {
  it("RTX 3060 Ti -> rtx3060ti", () => expect(normalize("RTX 3060 Ti")).toBe("rtx3060ti"));
  it("RX 6600 XT -> rx6600xt", () => expect(normalize("RX 6600 XT")).toBe("rx6600xt"));
  it("GTX 1080 -> gtx1080", () => expect(normalize("GTX 1080")).toBe("gtx1080"));
  it("Ryzen 7 5800 X3D -> 5800x3d", () => expect(normalize("Ryzen 7 5800 X3D")).toBe("ryzen 7 5800x3d"));
  it("accents strippés", () => expect(normalize("Carté à é")).toBe("carte a e"));
});
