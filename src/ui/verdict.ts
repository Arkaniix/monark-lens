// src/ui/verdict.ts — mapping verdict → couleur DA (ÉTAPE 1.3 ; pill sans icône, cf. site).
//
// Slugs verdict du snapshot backend (vérifiés monark_api app/services/lens.py:71-75 +
// market_stats.py a_eviter) :
//   excellente_affaire / bonne_affaire / prix_correct / au_dessus_marche / trop_cher / a_eviter
//
// DA (remplace les couleurs v1) :
//   excellente_affaire & bonne_affaire → vert
//   prix_correct                       → zinc neutre (ni bon ni mauvais)
//   au_dessus_marche                   → ambre
//   trop_cher & a_eviter               → rouge
// Verdict inconnu / null               → zinc neutre (fallback honnête).

export type VerdictTone = "good" | "neutral" | "warn" | "bad" | "unknown";

export interface VerdictMeta {
  tone: VerdictTone;
  /** Variable CSS (définie dans src/ui/tokens.ts). */
  color: string;
}

const VERDICT_MAP: Record<string, VerdictMeta> = {
  excellente_affaire: { tone: "good", color: "var(--green)" },
  bonne_affaire: { tone: "good", color: "var(--green)" },
  prix_correct: { tone: "neutral", color: "var(--zinc-400)" },
  au_dessus_marche: { tone: "warn", color: "var(--amber)" },
  trop_cher: { tone: "bad", color: "var(--red)" },
  a_eviter: { tone: "bad", color: "var(--red)" },
};

const NEUTRAL: VerdictMeta = { tone: "unknown", color: "var(--zinc-400)" };

export function verdictMeta(verdict: string | null | undefined): VerdictMeta {
  if (!verdict) return NEUTRAL;
  return VERDICT_MAP[verdict] ?? NEUTRAL;
}
