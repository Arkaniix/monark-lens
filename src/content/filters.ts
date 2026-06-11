// src/content/filters.ts — classification d'intention (texte pur) + défauts.
// PORTÉ VERBATIM du v1. Couche déterministe sans I/O. shouldSignal=true UNIQUEMENT sur
// broken/mining/rma_refurb/professional (+ "sale" défaut) ; shouldOverlay partout sauf test_spam.

import type { IntentResult } from "./types";

interface IntentConfig {
  titlePatterns: RegExp[];
  descPatterns: RegExp[];
  type: string;
  shouldSignal: boolean;
  shouldOverlay: boolean;
  overlayMessage: string;
}

export const INTENT_PATTERNS: Record<string, IntentConfig> = {
  wanted: {
    titlePatterns: [
      /\b(cherche|recherche|achète|ach[eè]te)\b/i,
      /\b(je\s+veux|je\s+souhaite|je\s+cherche)\b/i,
      /\b(wanted|wtb|looking\s+for|buying|iso)\b/i,
      /\b(qui\s+vend|qui\s+a\s+un[e]?)\b/i,
      /\b(besoin\s+d[e'])\b/i,
      /\b(à\s+la\s+recherche\s+d[e'])\b/i,
    ],
    descPatterns: [
      /\b(je\s+recherche|je\s+cherche|[àa]\s+la\s+recherche)\b/i,
      /\b(j'?ach[eè]te)\b/i,
      /\b(recherche\s+uniquement)\b/i,
    ],
    type: "wanted",
    shouldSignal: false,
    shouldOverlay: true,
    overlayMessage: "Demande d'achat — pas une vente",
  },
  trade: {
    titlePatterns: [
      /\b(échange|echange|troc|swap|trade)\b/i,
      /\b(échange\s+possible|echange\s+possible)\b/i,
      /\bcontre\b.*\b(?:rtx|gtx|rx|\d{4})\b/i,
      /\b(?:rtx|gtx|rx)\s+\d{3,4}.*\bcontre\b/i,
    ],
    descPatterns: [
      /\b(échange\s+uniquement|echange\s+uniquement|troc\s+uniquement)\b/i,
      /\b(j'?[ée]change)\b/i,
      /\b(je\s+troc|je\s+swap)\b/i,
      /\b(pas\s+de\s+vente|uniquement\s+[ée]change)\b/i,
      /\b(je\s+propose\s+.*[ée]change)\b/i,
      /\b(ouvert\s+[àa]\s+l'?[ée]change)\b/i,
    ],
    type: "trade",
    shouldSignal: false,
    shouldOverlay: true,
    overlayMessage: "Échange / troc — pas de prix de vente fiable",
  },
  box_only: {
    titlePatterns: [
      /\b(bo[iî]te?|carton|emballage|packaging|box)\s+(de|du|d'|vide|seul[e]?|only|uniquement)\b/i,
      /\b(bo[iî]te?\s+(nvidia|amd|intel|geforce|radeon|msi|asus|gigabyte|evga|zotac|sapphire|corsair|crucial|samsung|kingston|wd|seagate))\b/i,
      /\b(nvidia|amd|geforce|radeon|msi|asus|gigabyte)\b.*\b(bo[iî]te?|carton|emballage)\b/i,
      /\bemballage\s+d'origine\b/i,
      /\bbo[iî]te?\s+vide\b/i,
    ],
    descPatterns: [
      /\b(vend[s]?\s+(la\s+)?bo[iî]te?|vend[s]?\s+l'emballage)\b/i,
      /\b(bo[iî]te?\s+seul[e]?|emballage\s+seul|carton\s+seul)\b/i,
      /\b(sans\s+l[ea]\s+(carte|gpu|cpu|composant|produit|matériel))\b/i,
      /\b(bo[iî]te?\s+uniquement|only\s+box|empty\s+box)\b/i,
    ],
    type: "box_only",
    shouldSignal: false,
    shouldOverlay: true,
    overlayMessage: "Boîte / emballage seul — pas le composant",
  },
  broken: {
    titlePatterns: [
      /\b(hors\s+service|hs|en\s+panne|dead|mort[e]?|brick[ée]|grill[ée]|cram[ée])\b/i,
      /\b(d[ée]fectueu[sx]|d[ée]faillant[e]?|endommag[ée]|cass[ée]|fissur[ée])\b/i,
      /\b(ne\s+fonctionne\s+(pas|plus))\b/i,
      /\b(doesn'?t?\s+work|not\s+working|broken|faulty|defective)\b/i,
      /\b(pour\s+pi[eè]ces|for\s+parts|as[\s-]is)\b/i,
      /\b(artefact[s]?|artifact[s]?)\b/i,
      /\b(hs|h\.s\.|h\s+s)\b/i,
      /\b(à\s+r[ée]parer|needs?\s+repair|reparation)\b/i,
    ],
    descPatterns: [
      /\b(ne\s+s'allume\s+(pas|plus))\b/i,
      /\b(ne\s+d[ée]marre\s+(pas|plus))\b/i,
      /\b(ne\s+fonctionne\s+(pas|plus))\b/i,
      /\b(aucun\s+affichage|no\s+display|pas\s+d'image|écran\s+noir|black\s+screen)\b/i,
      /\b(plantage|crash|freeze|bluescreen|bsod|écran\s+bleu)\b/i,
      /\b(artefact|artifact|glitch|pixel\s+mort|scintillement)\b/i,
      /\b(composant\s+(hs|grillé|mort|cassé|défectueux))\b/i,
      /\b(vendu\s+en\s+l'[ée]tat|sold\s+as[\s-]is)\b/i,
      /\b(pour\s+bricoleur|pour\s+r[ée]parateur)\b/i,
      /\b(surchauffe\s+(constante|permanente|critique))\b/i,
      /\b(odeur\s+de\s+brûl[ée]|smoke|fum[ée]e)\b/i,
      /\b(condensateur|capacitor|r[ée]sistance)\s+(gonfl|cram|brul|grill)/i,
      /\b(gpu\s+dead|carte\s+(morte|grillée|hs))\b/i,
    ],
    type: "broken",
    shouldSignal: true,
    shouldOverlay: true,
    overlayMessage: "Composant HS / pour pièces",
  },
  bundle: {
    titlePatterns: [
      /\b(ordinateur\s+\w+\s+(rtx|gtx|rx|ryzen|intel|i[3579]|r[3579]))/i,
      /\b(ordinateur|pc)\s+(rtx|gtx|rx|ryzen|intel|i[3579]|r[3579])\b/i,
      /\b(serveur|server)\b/i,
      /\b(config|configuration)\s+(compl[eè]te|gaming|bureautique|montage|stream)/i,
      /\b(pc\s+(gam(er|ing)|complet|fixe|bureau|portable|montage|stream))\b/i,
      /\b(tour\s+(gam(er|ing)|compl[eè]te|informatique))\b/i,
      /\b(setup\s+(complet|gaming))\b/i,
      /\b(station\s+de\s+travail|workstation)\b/i,
      /\b(unit[ée]\s+centrale)\b/i,
      /\b(ordinateur\s+(fixe|portable|complet|de\s+bureau))\b/i,
      /\b(laptop|notebook|portable\s+(gam(er|ing)))\b/i,
      /\b(combo|bundle|pack\s+(complet|gaming|pc))\b/i,
      /\b(pc\s+tout\s+en\s+un|all[\s-]in[\s-]one)\b/i,
      /\b(imac|mac\s+pro|mac\s+studio|mac\s+mini)\b/i,
      /\b(mini[\s-]?pc|nuc|small\s+form\s+factor|sff)\b/i,
      /\b(rig\s+complet)\b/i,
    ],
    descPatterns: [
      /\b(vend[s]?\s+(mon|ma|un|le)\s+(pc|ordi|config|tour|setup))\b/i,
      /\b(ensemble\s+complet|tout\s+le\s+(pc|setup))\b/i,
      /\b(livr[ée]\s+avec\s+(écran|clavier|souris|moniteur))\b/i,
      /\b(ne\s+vend[s]?\s+pas\s+s[ée]par[ée]ment|pas\s+de\s+vente\s+s[ée]par[ée]e)\b/i,
      /\b(tout\s+ensemble|le\s+lot\s+complet)\b/i,
    ],
    type: "bundle",
    shouldSignal: false,
    shouldOverlay: true,
    overlayMessage: "Ensemble / PC complet — prix non représentatif du composant seul",
  },
  multiple: {
    titlePatterns: [
      /\b([2-9]|\d{2,})\s*[xX×]\s*(?:rtx|gtx|rx|gpu|carte|cpu|ssd|nvme|ram|barrette|ddr)\b/i,
      /\b(?:lot|pack)\s+de\s+(\d+)\b/i,
      /\b([2-9]|\d{2,})\s+(?:rtx|gtx|rx)\s+\d{3,4}\b/i,
      /\b([2-9]|\d{2,})\s+(?:carte[s]?\s+graphique|gpu)/i,
      /\b([2-9]|\d{2,})\s+(?:barrette|stick|dimm)/i,
      /\b([2-9]|\d{2,})\s+(?:ssd|disque|nvme)/i,
      /\b(?:rtx|gtx|rx)\s+\d{3,4}(?:\s*(?:ti|super|ti\s+super))?\s*[xX×]\s*([2-9]|\d{2,})\b/i,
      /\b(?:cpu|gpu|carte[s]?\s+graphique|ssd|ram|barrette)\s*[xX×]\s*([2-9]|\d{2,})\b/i,
      /\b(?:rtx|gtx|rx)\s+\d{3,4}(?:\s*(?:ti|super))?\s+les\s+(\d+)\b/i,
    ],
    descPatterns: [
      /\b(vend[s]?\s+(\d+)\s+(carte|gpu|ssd|barrette))/i,
      /\b(les\s+\d+\s+(ensemble|pour\s+le\s+lot))\b/i,
      /\b(prix\s+(pour\s+les\s+\d+|du\s+lot|le\s+lot|l'ensemble))\b/i,
    ],
    type: "multiple",
    shouldSignal: false,
    shouldOverlay: true,
    overlayMessage: "Lot / quantité multiple — prix total, pas unitaire",
  },
  accessory: {
    titlePatterns: [
      /\b(backplate|ventilateur|fan[s]?\s+(gpu|carte|de\s+remplacement)|support\s+gpu|bracket|anti[\s-]?sag)\b/i,
      /\b(?:rtx|gtx|rx)\s*\d{3,4}.*\(ventilateur\)/i,
      /\b(waterblock|water[\s-]*block|bloc\s+(eau|water)|gpu\s+block)\b/i,
      /\b(ventirad|cooler|refroidisseur|dissipateur|heatsink|aio)\b/i,
      /\b(thermal\s+pad|pâte\s+thermique|thermal\s+paste|pad\s+thermique)\b/i,
      /\b(câble|cable|adaptateur|adapter|riser|rallonge|extension)\s.{0,15}(gpu|pci|carte|12vhpwr|8[\s-]?pin|6[\s-]?pin)/i,
      /\b(riser\s+(pci|gpu)|pci[\s-]?e?\s+riser)\b/i,
      /\b(12vhpwr|12v[\s-]?2x6|8\s*pin\s+to|6\s*pin\s+to)\b/i,
      /\b(vis|screw|mount|fixation|bracket)\s.{0,10}(gpu|carte|ssd|m\.?2)/i,
    ],
    descPatterns: [
      /\b(compatible\s+(avec\s+)?(rtx|gtx|rx|radeon|geforce))\b/i,
      /\b(pour\s+(rtx|gtx|rx|radeon|geforce))\b/i,
      /\b(s'installe\s+sur|se\s+monte\s+sur)\b/i,
    ],
    type: "accessory",
    shouldSignal: false,
    shouldOverlay: true,
    overlayMessage: "Accessoire — pas le composant lui-même",
  },
  reserved: {
    titlePatterns: [
      /\b(r[ée]serv[ée]e?)\b/i,
      /\b(vendu[e]?)\b(?!\s+(avec|en))/i,
      /\b(sold)\b/i,
      /\b(pending)\b/i,
      /\b(plus\s+disponible|indisponible)\b/i,
      /\b(not\s+available|no\s+longer\s+available)\b/i,
    ],
    descPatterns: [
      /\b(déjà\s+vendu|already\s+sold)\b/i,
      /\b(annonce\s+expir[ée]e|listing\s+expired)\b/i,
    ],
    type: "reserved",
    shouldSignal: false,
    shouldOverlay: true,
    overlayMessage: "Annonce réservée ou vendue",
  },
  rental: {
    titlePatterns: [
      /\b(location|loue|lou[ée]|à\s+louer)\b/i,
      /\b(rent|rental|for\s+rent|to\s+rent)\b/i,
      /\b(\/mois|\/semaine|\/jour|\/heure|par\s+mois|par\s+semaine|par\s+jour)\b/i,
      /\b(prêt|prête|emprunte[r]?)\b/i,
    ],
    descPatterns: [
      /\b(tarif\s+(journalier|mensuel|hebdomadaire|horaire))\b/i,
      /\b(location\s+(courte|longue)\s+dur[ée]e)\b/i,
      /\b(je\s+loue|je\s+propose\s+en\s+location)\b/i,
      /\b(\d+\s*€?\s*\/\s*(mois|semaine|jour|heure|h|j|sem))\b/i,
    ],
    type: "rental",
    shouldSignal: false,
    shouldOverlay: true,
    overlayMessage: "Location — pas une vente",
  },
  mining: {
    titlePatterns: [
      /\b(min[ée]|mining|minage|mineur|miné)\b/i,
      /\b(ex[\s-]?mining|ex[\s-]?minage)\b/i,
      /\b(rig\s+de\s+minage|mining\s+rig)\b/i,
      /\b(crypto|ethereum|bitcoin|eth)\b.*\b(carte|gpu|rtx|gtx|rx)/i,
      /\b(carte|gpu|rtx|gtx|rx)\b.*\b(crypto|ethereum|bitcoin|eth)/i,
    ],
    descPatterns: [
      /\b(utilis[ée]\s+pour\s+(le\s+)?min(age|ing))\b/i,
      /\b(a\s+servi\s+[àa]\s+min(er|age|ing))\b/i,
      /\b(mining|minage)\s+(24|7|h24|non[\s-]?stop|intensif)/i,
      /\b(farm|ferme\s+de\s+minage)\b/i,
      /\b(hashrate|hash\s+rate|mh\/s|gh\/s|th\/s)\b/i,
      /\b(undervolted?|undervolt[ée]|repasted?)\b/i,
      /\b(bios\s+modifi[ée]|modded\s+bios|mining\s+bios)\b/i,
      /\b(power\s+limit|pl\s+\d+\s*%|tdp\s+r[ée]duit)\b/i,
    ],
    type: "mining",
    shouldSignal: true,
    shouldOverlay: true,
    overlayMessage: "Composant ex-minage détecté",
  },
  rma_refurb: {
    titlePatterns: [
      /\b(reconditionn[ée]|refurbished|refurb)\b/i,
      /\b(rma|retourn?[ée]|outlet)\b/i,
      /\b(certifi[ée]\s+reconditionn[ée])\b/i,
      /\b(grade\s+[a-c])\b/i,
    ],
    descPatterns: [
      /\b(reconditionn[ée]\s+(par|chez)\s+\w+)\b/i,
      /\b(retour\s+(sav|constructeur|fabricant|amazon|ldlc))\b/i,
      /\b(remplac[ée]\s+sous\s+garantie|rma\s+(nvidia|amd|asus|msi|evga))\b/i,
      /\b(garantie\s+(constructeur|fabricant)\s+(restante|en\s+cours))\b/i,
      /\b(remis\s+[àa]\s+neuf|like\s+refurb)\b/i,
    ],
    type: "rma_refurb",
    shouldSignal: true,
    shouldOverlay: true,
    overlayMessage: "Composant reconditionné / RMA",
  },
  symbolic_price: {
    titlePatterns: [
      /\b(faire\s+offre|prix\s+[àa]\s+d[ée]battre|[àa]\s+d[ée]battre)\b/i,
      /\b(offre[sz]?\s+vo[st]re\s+prix|meilleur[e]?\s+offre)\b/i,
      /\b(prix\s+en\s+mp|prix\s+[àa]\s+voir|prix\s+symbolique)\b/i,
      /\b(contacte[rz]\s+moi\s+pour\s+(le\s+)?prix)\b/i,
      /\b(best\s+offer|make\s+offer|obo|or\s+best\s+offer)\b/i,
      /\b(prix\s+cassé|braderie|liquidation|destockage|d[ée]stockage)\b/i,
      /\b(prix\s+n[ée]gociable|négociable|negotiable)\b/i,
    ],
    descPatterns: [
      /\b(prix\s+à\s+d[ée]finir|prix\s+à\s+convenir|prix\s+sur\s+demande)\b/i,
      /\b(faites?\s+(moi\s+)?une?\s+offre)\b/i,
      /\b(prix\s+de\s+d[ée]part|starting\s+price)\b/i,
      /\b(n'h[ée]site[z]?\s+pas\s+[àa]\s+(proposer|faire\s+offre))\b/i,
      /\b(envoye[rz]?\s+(vos?\s+)?offre[s]?)\b/i,
      /\b(je\s+(ne\s+)?sais?\s+pas\s+(combien|quel\s+prix))\b/i,
    ],
    type: "symbolic_price",
    shouldSignal: false,
    shouldOverlay: true,
    overlayMessage: "Prix symbolique / à débattre — prix non fiable",
  },
  test_spam: {
    titlePatterns: [
      /\b(test\s+annonce|annonce\s+test|essai\s+annonce)\b/i,
      /\b(brouillon|draft|placeholder)\b/i,
      /^[a-z]{2,6}$/i,
      /^[\d\s.€]+$/,
      /^(.)\1{3,}$/,
    ],
    descPatterns: [],
    type: "test_spam",
    shouldSignal: false,
    shouldOverlay: false,
    overlayMessage: "",
  },
  parts_from_device: {
    titlePatterns: [
      /\b(pi[eè]ces?\s+d[ée]tach[ée]e?s?\s+(pour|de|du|d'))\b/i,
      /\b(pour\s+pi[eè]ces?\s+d[ée]tach[ée]e?s?)\b/i,
      /\b(démontage|d[ée]mant[eè]lement|d[ée]sossage)\b/i,
    ],
    descPatterns: [
      /\b(je\s+d[ée]monte|vend[s]?\s+les?\s+pi[eè]ces?\s+s[ée]par[ée]ment)\b/i,
      /\b(pi[eè]ces?\s+disponibles?\s*:\s*)/i,
    ],
    type: "parts_from_device",
    shouldSignal: false,
    shouldOverlay: true,
    overlayMessage: "Pièces détachées — prix individuel incertain",
  },
  professional: {
    titlePatterns: [],
    descPatterns: [
      /\b(professionnel|professional|entreprise|soci[ée]t[ée]|sarl|sas|eurl|auto[\s-]?entrepreneur)\b/i,
      /\b(garantie\s+(commerciale|magasin|boutique))\b/i,
      /\b(facture\s+tva|hors\s+taxe[s]?|ht\b|ttc\b)/i,
      /\b(stock\s+disponible|plusieurs?\s+disponible|quantit[ée]\s+disponible)\b/i,
      /\b(tarif\s+(pro|professionnel|entreprise|grossiste))\b/i,
      /\b(devis\s+sur\s+demande)\b/i,
    ],
    type: "professional",
    shouldSignal: true,
    shouldOverlay: true,
    overlayMessage: "Vendeur professionnel détecté — prix potentiellement différent du marché C2C",
  },
};

const SYMBOLIC_PRICE_THRESHOLDS: Record<string, number> = { gpu: 15, cpu: 10, ram: 5, ssd: 5, default: 5 };

export function isSymbolicPrice(price: number, componentCategory: string | null): boolean {
  if (price <= 1) return true;
  const threshold = componentCategory
    ? SYMBOLIC_PRICE_THRESHOLDS[componentCategory] || SYMBOLIC_PRICE_THRESHOLDS.default
    : SYMBOLIC_PRICE_THRESHOLDS.default;
  return price <= threshold;
}

export function classifyIntent(
  title: string,
  price: number | null,
  description: string | null,
  componentCategory: string | null,
): IntentResult {
  const normalizedTitle = (title || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const normalizedDesc = (description || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").slice(0, 2000);
  let bestMatch: IntentResult | null = null;
  for (const [category, config] of Object.entries(INTENT_PATTERNS)) {
    for (const pattern of config.titlePatterns) {
      const match = normalizedTitle.match(pattern);
      if (match) {
        const confidence = 0.9;
        if (!bestMatch || confidence > bestMatch.confidence) {
          let quantity = 1;
          if (category === "multiple" && match[1]) {
            const qty = parseInt(match[1], 10);
            if (qty > 1 && qty <= 10) quantity = qty;
          }
          bestMatch = {
            type: config.type,
            confidence,
            flags: [`title:${category}:${match[0].trim()}`],
            shouldSignal: config.shouldSignal,
            shouldOverlay: config.shouldOverlay,
            overlayMessage: config.overlayMessage,
            quantity,
          };
        }
        break;
      }
    }
    if (!bestMatch || bestMatch.confidence < 0.85) {
      for (const pattern of config.descPatterns) {
        const match = normalizedDesc.match(pattern);
        if (match) {
          const confidence = 0.7;
          if (!bestMatch || confidence > bestMatch.confidence) {
            bestMatch = {
              type: config.type,
              confidence,
              flags: [`desc:${category}:${match[0].trim()}`],
              shouldSignal: config.shouldSignal,
              shouldOverlay: config.shouldOverlay,
              overlayMessage: config.overlayMessage,
              quantity: 1,
            };
          }
          break;
        }
      }
    }
  }
  // Fix 1: reject "wanted" from desc if sale-context patterns are present
  if (bestMatch && bestMatch.type === "wanted" && bestMatch.confidence < 0.85) {
    const saleContextPatterns = [
      /facture\s+d'?achat/, /date\s+d'?achat/, /test\s+(?:possible\s+)?avant\s+achat/,
      /essai\s+(?:possible\s+)?avant\s+achat/, /prix\s+d'?achat/, /suite\s+a\s+(?:un\s+|l'?)achat/,
      /achat\s+(?:le\s+)?\d/, /achat\s+(?:en\s+)?\w+\s+\d{4}/, /achat\s+direct/,
      /preuve\s+d'?achat/, /ticket\s+d'?achat/,
    ];
    if (saleContextPatterns.some((p) => p.test(normalizedDesc))) {
      bestMatch = null;
    }
  }
  // Fix 2a: price aberration (> 20000€)
  if (
    price !== null && price > 20000 &&
    !normalizedTitle.includes("serveur") && !normalizedTitle.includes("lot") &&
    !normalizedDesc.includes("serveur") && !normalizedDesc.includes("lot")
  ) {
    return {
      type: "sale", confidence: 0.3, flags: ["price_error_suspected"], quantity: 1,
      shouldSignal: false, shouldOverlay: true, overlayMessage: "Prix suspect — erreur de saisie probable",
    };
  }
  // Fix 2b: price placeholder (0€ / 1€)
  if (price !== null && price <= 1 && (!bestMatch || bestMatch.type === "sale")) {
    bestMatch = {
      type: "symbolic_price", confidence: 0.85, flags: ["price_placeholder"],
      shouldSignal: false, shouldOverlay: true, overlayMessage: "Prix symbolique (1€) — prix réel non indiqué", quantity: 1,
    };
  }
  // Fix 4: exchange contra-patterns
  if (bestMatch && bestMatch.type === "trade") {
    if (/\bpas\s+d'?echange\b|\bn'?echange\s+pas\b|\baucun\s+echange\b/.test(normalizedDesc)) {
      bestMatch = null;
    }
  }
  if ((!bestMatch || bestMatch.type === "sale") && price !== null) {
    if (isSymbolicPrice(price, componentCategory)) {
      bestMatch = {
        type: "symbolic_price", confidence: 0.85, flags: [`price:symbolic:${price}€`],
        shouldSignal: false, shouldOverlay: true, overlayMessage: "Prix symbolique — négociation attendue", quantity: 1,
      };
    }
  }
  if (bestMatch && bestMatch.type !== "sale") {
    return bestMatch;
  }
  return { type: "sale", confidence: 0.5, flags: [], quantity: 1, shouldSignal: true, shouldOverlay: true };
}

const DEFECT_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [/rayur|scratch|éraflu/i, "cosmetic_scratch"],
  [/jauni|yellowing/i, "yellowing"],
  [/pixel mort|dead pixel/i, "dead_pixel"],
  [/bruit|coil whine|ventilateur bruyant/i, "noise"],
  [/chauffe|surchauffe|overheat/i, "overheating"],
  [/crash|instable|instabilité|freeze/i, "instability"],
  [/répar[ée]|à réparer|hs|hors service|panne|défectueux/i, "needs_repair"],
  [/manqu|missing|absent/i, "missing_parts"],
  [/poussièr|dust/i, "dusty"],
  [/oxyd|corros/i, "corrosion"],
];

export function extractDefects(text: string): string[] | null {
  const defects: string[] = [];
  for (const [pattern, label] of DEFECT_PATTERNS) {
    if (pattern.test(text)) defects.push(label);
  }
  return defects.length > 0 ? defects : null;
}
