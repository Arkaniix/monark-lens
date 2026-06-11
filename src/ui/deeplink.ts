// src/ui/deeplink.ts — deep-link sortant « Estimation complète → » (ÉTAPE 3 action).
//
// DIVERGENCE v1 DOCUMENTÉE (arbitrage Étienne) : v1 (buildEstimateUrl) émettait
//   component=<id> + model_name=<nom> + category=<…>.
// Le site monark-foundations ne lit QUE `model` aujourd'hui (vérifié) → v2 émet
//   model=<component_name CMS> + price + condition(slug v1) + platform + source=lens.
// id & category DROPPÉS ; les autres params seront consommés après le brief Lovable.
//
// GARDE-FOU PRIVACY/PRODUIT : on n'inclut JAMAIS le titre de l'annonce ni son URL —
// `model` = nom générique CMS uniquement. (Cf. SnapshotResponse.component_name.)
//
// /!\ INVARIANT 0-IMPORT : module importé uniquement par le content (overlay) → inliné.
// Ne PAS importer MONARK_WEB_URL depuis src/lib/constants.ts (chunk partagé interdit côté
// content) ; on duplique la constante. SYNC: src/lib/constants.ts:MONARK_WEB_URL.
const MONARK_WEB_URL = "https://monark-market.fr";

/** Map condition API → slug estimateur v1 (verbatim dist v1). */
export const CONDITION_TO_SLUG: Record<string, string> = {
  new: "neuf",
  like_new: "comme-neuf",
  good: "bon",
  fair: "correct",
  poor: "a-reparer",
};

export interface EstimateLinkArgs {
  componentName: string | null;
  askingPrice: number;
  condition?: string | null;
  platform?: string | null;
}

export function buildEstimateUrl(args: EstimateLinkArgs): string {
  const params = new URLSearchParams();
  params.set("model", args.componentName ?? "");
  params.set("price", String(Math.round(args.askingPrice)));
  if (args.condition) params.set("condition", CONDITION_TO_SLUG[args.condition] ?? args.condition);
  if (args.platform) params.set("platform", args.platform);
  params.set("source", "lens");
  return `${MONARK_WEB_URL}/estimator?${params.toString()}`;
}
