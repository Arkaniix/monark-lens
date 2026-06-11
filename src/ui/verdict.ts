// src/ui/verdict.ts — mapping verdict → couleur DA + icône (ÉTAPE 1.3).
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
  icon: string;
}

const VERDICT_MAP: Record<string, VerdictMeta> = {
  excellente_affaire: { tone: "good", color: "var(--green)", icon: "🔥" },
  bonne_affaire: { tone: "good", color: "var(--green)", icon: "✅" },
  prix_correct: { tone: "neutral", color: "var(--zinc-400)", icon: "➡️" },
  au_dessus_marche: { tone: "warn", color: "var(--amber)", icon: "⚠️" },
  trop_cher: { tone: "bad", color: "var(--red)", icon: "🚫" },
  a_eviter: { tone: "bad", color: "var(--red)", icon: "🚫" },
};

const NEUTRAL: VerdictMeta = { tone: "unknown", color: "var(--zinc-400)", icon: "" };

export function verdictMeta(verdict: string | null | undefined): VerdictMeta {
  if (!verdict) return NEUTRAL;
  return VERDICT_MAP[verdict] ?? NEUTRAL;
}
