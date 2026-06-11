// src/content/collect.ts — orchestration v2 (SANS overlay) : detect → parse → match → classify
// → DETECTION_STATUS (pré-remplit le popup) → collecte passive (gate intent.shouldSignal).
// Garde stricte : ne fait RIEN hors page détail des 3 plateformes.
import { detectPlatform, findVariantName, isComponentDbLoaded, loadComponentDb, matchComponent } from "./detect";
import { classifyIntent, extractDefects } from "./filters";
import { extractListingData, isHardwareCategory } from "./parsers";
import {
  mountAnalyzeButton,
  mountAnalyzePlaceholder,
  removeAnalyzeButton,
  shouldShowAnalyzeButton,
} from "./ui/button";
import { closeOverlay } from "./ui/overlay";
import type { IntentResult, MatchResult, ParsedListing, Platform } from "./types";
import type { ListingContext } from "./ui/snapshot-client";
import type { SendSignalMsg } from "../lib/messages";

let signalSentForUrl: string | null = null;
let analyzing = false;

/** Reset dédup + état (appelé à chaque navigation). */
export function resetCollectState(): void {
  signalSentForUrl = null;
  // (V2-03) table rase de l'UI à chaque navigation : ni bouton, ni overlay résiduel d'une
  // annonce précédente (SPA). closeOverlay silencieux = pas de re-montage du bouton ici
  // (analyze() le remontera s'il y a lieu).
  removeAnalyzeButton();
  closeOverlay({ silent: true });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function notifyDetectionStatus(
  platform: Platform | null,
  componentId: number | null,
  componentName: string | null,
  price: number | null,
): void {
  chrome.runtime
    .sendMessage({ type: "DETECTION_STATUS", platform, componentId, componentName, price })
    .catch(() => {});
}

export async function analyze(): Promise<void> {
  if (analyzing) return;
  analyzing = true;
  try {
    await analyzeInner();
  } finally {
    analyzing = false;
  }
}

async function analyzeInner(): Promise<void> {
  const detection = detectPlatform();
  if (!detection) {
    notifyDetectionStatus(null, null, null, null);
    return;
  }
  // GARDE STRICTE : rien hors page détail.
  if (detection.pageType !== "detail") {
    notifyDetectionStatus(detection.platform, null, null, null);
    return;
  }
  // LBC SPA : __NEXT_DATA__ peut tarder → retry ×3 / 800ms (verbatim v1).
  let listing = await extractListingData(detection.platform);
  if (!listing) {
    for (let attempt = 0; attempt < 3 && !listing; attempt++) {
      await sleep(800);
      listing = await extractListingData(detection.platform);
    }
  }
  if (!listing || !listing.title) {
    notifyDetectionStatus(detection.platform, null, null, null);
    return;
  }
  if (detection.platform === "leboncoin" && !isHardwareCategory(listing)) {
    notifyDetectionStatus(detection.platform, null, null, null);
    return;
  }
  // (A3) Annonce avec prix → placeholder spinner immédiat, résolu en bouton réel ou retiré
  // selon match/intent. Couvre la résolution match + le cold-fetch du component-DB (1re page).
  if (listing.price !== null) mountAnalyzePlaceholder();

  let match = matchComponent(listing.title);
  if (!match && !isComponentDbLoaded()) {
    // 1re page avant le chargement du cache de détection : attendre le DB puis re-matcher.
    // Garde anti-contexte-périmé (comme button.ts onClick) : si l'utilisateur a navigué (SPA)
    // pendant le fetch, on ABANDONNE — pas de bouton monté sur la mauvaise annonce (faux-match).
    const navUrl = location.href;
    await loadComponentDb();
    if (location.href !== navUrl) {
      removeAnalyzeButton(); // retire le placeholder orphelin de l'annonce précédente
      return;
    }
    match = matchComponent(listing.title);
  }
  if (!match || listing.price === null) {
    removeAnalyzeButton(); // retire le placeholder si présent
    notifyDetectionStatus(detection.platform, null, null, listing.price);
    return;
  }
  const askingPrice = listing.price; // narrowé en number par le guard ci-dessus
  match.variantName = findVariantName(match.componentId, listing.title);
  // Pré-remplissage du popup (détection courante).
  notifyDetectionStatus(detection.platform, match.componentId, match.componentName, askingPrice);

  // Classification (porte de signal) + collecte passive — INCHANGÉ (V2-02).
  const intent = classifyIntent(listing.title, askingPrice, listing.description, match.category);
  if (intent.shouldSignal) {
    await sendPassiveSignal(detection.platform, listing, match, intent);
  }

  // (V2-03) Bouton passif. Détail + composant déjà acquis ici ; on n'ajoute le bouton
  // que si l'intent l'autorise (jamais bundle / wanted / test_spam). Seul ajout à la page.
  if (shouldShowAnalyzeButton(intent.type, intent.shouldOverlay)) {
    const ctx: ListingContext = {
      platform: detection.platform,
      url: listing.url,
      componentId: match.componentId,
      componentName: match.componentName,
      askingPrice,
      condition: listing.condition,
      intentType: intent.type,
      publishedAt: listing.publishedAt,
    };
    mountAnalyzeButton(ctx);
  } else {
    removeAnalyzeButton();
  }
}

async function sendPassiveSignal(
  platform: Platform,
  listing: ParsedListing,
  match: MatchResult,
  intent: IntentResult,
): Promise<void> {
  if (signalSentForUrl === listing.url) return;
  try {
    const authState = (await chrome.runtime.sendMessage({ type: "GET_AUTH_STATE" })) as { isLoggedIn?: boolean };
    if (!authState?.isLoggedIn) return;
    const stored = (await chrome.storage.local.get(["auto_signal"])) as { auto_signal?: boolean };
    if (stored.auto_signal === false) return;
    if (listing.price === null) return;

    const pageText = document.body.textContent || "";
    const msg: SendSignalMsg = {
      type: "SEND_SIGNAL",
      url: listing.url, // hashée dans le SW -> ad_hash ; aucune URL sur le réseau
      component_id: match.componentId,
      platform,
      price: listing.price,
      currency: "EUR",
      condition: listing.condition,
      region: listing.location,
      title: listing.title,
      listing_intent: intent.type,
      quantity: intent.quantity,
      has_warranty: /garant|warranty/i.test(pageText),
      has_invoice: /facture|invoice|ticket de caisse|preuve d'achat/i.test(pageText),
      has_original_box:
        /bo[iî]te d'origine|original box|emballage d'origine|carton d'origine|bo[iî]te compl[eè]te|avec bo[iî]te|with box/i.test(
          pageText,
        ),
      defects: extractDefects(pageText),
      is_bundle: intent.type === "bundle",
      signal_type: "passive",
    };
    const result = (await chrome.runtime.sendMessage(msg)) as { listing_intent?: string };
    signalSentForUrl = listing.url;
    if (result?.listing_intent && result.listing_intent !== intent.type) {
      console.log(`[Monark] Backend reclassified: regex=${intent.type} → llm=${result.listing_intent}`);
    }
  } catch (err) {
    console.warn("[Monark] Passive signal failed:", err);
  }
}
