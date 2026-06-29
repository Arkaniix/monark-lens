import { beforeEach, describe, expect, it } from "vitest";

import { matchAllComponents, matchComponent, setComponentDb } from "./detect";
import type { ComponentDbEntry } from "../lib/api-types";

// Repli description (LBC), durci : couvrir les annonces dont le modèle n'existe QUE dans la
// description, SANS jamais produire de faux match. Fixtures à la FORME DU CATALOGUE RÉEL :
//   - 498/536 N'ONT PAS d'alias nus (le vrai catalogue n'en a pas) → ils ne matchent que par
//     nom complet / alias qualifiés. La cible 2700X passe donc par son nom complet.
//   - Ryzen 5 5600 / Ryzen 5 7600 / RX 7600 PORTENT un alias nu ('5600'/'7600') comme en prod —
//     c'est précisément ce que matchAllComponents doit IGNORER (drop /^\d+$/).
const DB: ComponentDbEntry[] = [
  { id: 498, name: "AMD Ryzen 7 2700X", category: "cpu", aliases: ["Ryzen 7 2700X", "7 2700X"] },
  { id: 536, name: "AMD Ryzen 7 2700", category: "cpu", aliases: ["Ryzen 7 2700", "7 2700"] },
  { id: 600, name: "Ryzen 5 5600", category: "cpu", aliases: ["Ryzen 5 5600", "5600"] },
  { id: 700, name: "Ryzen 5 7600", category: "cpu", aliases: ["Ryzen 5 7600", "7600"] },
  { id: 100, name: "GeForce RTX 4070", category: "gpu", aliases: ["RTX 4070", "4070"] },
  { id: 701, name: "Radeon RX 7600", category: "gpu", aliases: ["RX 7600", "7600"] },
];

describe("matchAllComponents — repli description durci (borné-mot + drop alias nus)", () => {
  beforeEach(() => setComponentDb(DB));

  it("HAPPY (cible) : desc « …Ryzen 7 2700x / 8 core… » → 1 famille = 498 (via nom complet)", () => {
    // titre réel « Processeur AMD » (générique) → matchComponent(titre) null → repli armé (collect.ts).
    // normalize transforme « / » en frontière : « 2700x / 8 core » → « 2700x 8 core ».
    const distinct = matchAllComponents("Processeur AMD Ryzen 7 2700x / 8 core / Neuf dans la boîte");
    expect(distinct).toHaveLength(1);
    expect(distinct[0].componentId).toBe(498);
  });

  it("#2 LOT (décisif) : desc « Ryzen 7 2700 et Ryzen 7 2700X » → 2 familles → SILENCE, aucune adoption", () => {
    // Avec les vrais alias (pas de « 2700X » nu), un lot réel nomme les DEUX en entier. Borné-mot :
    // « ryzen 7 2700 » (suivi de « et ») et « ryzen 7 2700x » matchent comme tokens distincts ; le
    // collapse NE fusionne PAS (« ryzen 7 2700 » ⊄ borné « ryzen 7 2700x », suffixe collé) → length 2.
    const distinct = matchAllComponents("Lot CPU : Ryzen 7 2700 et Ryzen 7 2700X, les deux fonctionnent");
    expect(distinct.length).toBeGreaterThanOrEqual(2);
    expect(distinct.map((m) => m.componentId).sort((a, b) => a - b)).toEqual([498, 536]);
  });

  it("#1 RAM (décisif) : desc « DDR5 5600 MHz » → SILENCE, AUCUN match CPU Ryzen 5 5600", () => {
    // titre « Kit RAM Corsair » → matchComponent null → repli armé. L'alias nu « 5600 » est DROPPÉ ;
    // le nom « ryzen 5 5600 » n'apparaît pas → aucun hit → length 0.
    const distinct = matchAllComponents("Mémoire DDR5 5600 MHz CL36, 32 Go (2x16), parfait état");
    expect(distinct).toHaveLength(0);
  });

  it("CROSS-CAT : desc « RX 7600 » → aucun faux match CPU (adoption GPU OK, jamais le CPU 7600)", () => {
    // « 7600 » nu droppé pour le CPU Ryzen 5 7600 ET le GPU RX 7600 ; le GPU matche via son alias
    // qualifié « rx7600 ». Assertion DURE : aucune catégorie cpu dans le résultat.
    const distinct = matchAllComponents("Carte graphique Radeon RX 7600 8 Go, comme neuve");
    expect(distinct.some((m) => m.category === "cpu")).toBe(false);
    expect(distinct.map((m) => m.componentId)).toContain(701);
  });

  it("CONTAINMENT propre : desc « …2700x… » hors contexte lot → 1 famille (498), jamais 2", () => {
    // Borné-mot : « ryzen 7 2700 » (536) est suivi de « x » → ne matche PAS ; seul le 2700X matche.
    const distinct = matchAllComponents("Vends processeur Ryzen 7 2700X, très bon état, testé");
    expect(distinct).toHaveLength(1);
    expect(distinct[0].componentId).toBe(498);
  });

  it("NON-RÉGRESSION TITRE : matchComponent(« RTX 4070 ») ≠ null → repli JAMAIS armé (garde !match)", () => {
    // collect.ts n'appelle matchAllComponents que si matchComponent(title) est null. On prouve que le
    // titre matche (#100), donc la branche de repli est structurellement inatteignable.
    expect(matchComponent("RTX 4070")?.componentId).toBe(100);
  });

  it("DB VIDE (cold-start) → [] partout (finding secondaire « DB vide » NON traité par ce repli)", () => {
    setComponentDb([]);
    expect(matchAllComponents("AMD Ryzen 7 2700X / 8 core / neuf dans la boîte")).toEqual([]);
  });
});
