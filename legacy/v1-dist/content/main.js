(function () {
  'use strict';

  const MONARK_WEB_URL = "https://monark-market.fr";
  const EXTENSION_VERSION = "1.7.39";
  const VERDICT_COLORS = {
    excellente_affaire: "#10b981",
    bonne_affaire: "#10b981",
    prix_correct: "#f59e0b",
    au_dessus_marche: "#f97316",
    trop_cher: "#ef4444"
  };
  function getScoreColor(score) {
    if (score >= 7) return "#10b981";
    if (score >= 5.5) return "#f59e0b";
    if (score >= 3.5) return "#f97316";
    return "#ef4444";
  }
  const PLATFORM_PATTERNS = {
    leboncoin: /leboncoin\.fr/,
    ebay: /ebay\.(fr|com)/,
    vinted: /vinted\.fr/
  };
  const DETAIL_PATTERNS = {
    leboncoin: /leboncoin\.fr\/ad\/|leboncoin\.fr\/[a-z_]+\/\d+/,
    ebay: /ebay\.(fr|com)\/itm\//,
    vinted: /vinted\.fr\/items\//
  };
  const FALLBACK_SELECTORS = {
    leboncoin: {
      // __NEXT_DATA__ is preferred (extractFromNextData), these are last-resort DOM fallbacks
      title: 'h1[data-qa-id="adview_title"], h1',
      price: '[data-qa-id="adview_price"] span, [data-qa-id="adview_price"]',
      condition: '[data-qa-id="criteria_item_condition"] .details-list__item-value:last-child span, [data-qa-id="criteria_item_condition"]',
      location: '[data-qa-id="adview_delivery_container"]',
      description: '[data-qa-id="adview_description_container"]'
    },
    ebay: {
      title: "h1.x-item-title__mainTitle span, h1 span.ux-textspans--BOLD, #itemTitle",
      price: ".x-price-primary span, .x-bin-price span.ux-textspans, #prcIsum",
      condition: ".x-item-condition-text span, .ux-labels-values--condition .ux-textspans--BOLD, #vi-itm-cond",
      location: "",
      // Extracted via text pattern in extractEbayLocation()
      description: "#desc_div, #viTabs_0_is"
    },
    vinted: {
      title: 'h1, [data-testid="item-page-summary-plugin"] h1',
      price: '[data-testid="item-price"], [data-testid="item-sidebar-price-container"] [class*="Text__subtitle"]',
      condition: '[data-testid="item-attributes-status"] [itemprop="status"] span, [data-testid="item-attributes-status"] .web_ui__Text__bold',
      location: "",
      // Not available on Vinted item pages
      description: '[itemprop="description"]'
    }
  };

  function detectPlatform() {
    const url = window.location.href;
    for (const [platform, pattern] of Object.entries(PLATFORM_PATTERNS)) {
      if (pattern.test(url)) {
        const pageType = detectPageType(platform, url);
        return { platform, pageType };
      }
    }
    return null;
  }
  function detectPageType(platform, url) {
    const detailPattern = DETAIL_PATTERNS[platform];
    if (detailPattern && detailPattern.test(url)) return "detail";
    const urlObj = new URL(url);
    if (urlObj.searchParams.has("text") || urlObj.searchParams.has("q") || urlObj.searchParams.has("_kw") || urlObj.pathname.includes("/recherche") || urlObj.pathname.includes("/sch/")) {
      return "listing";
    }
    return "unknown";
  }
  let cachedSelectors = {};
  async function getSelectors(platform) {
    if (cachedSelectors[platform]) return cachedSelectors[platform];
    const fallback = FALLBACK_SELECTORS[platform] || {};
    let merged = { ...fallback };
    try {
      const stored = await chrome.storage.local.get(["platform_selectors"]);
      if (stored.platform_selectors?.[platform]?.selectors) {
        const apiSelectors = stored.platform_selectors[platform].selectors;
        // Filter out empty strings so they don't overwrite fallback selectors
        const filtered = Object.fromEntries(
          Object.entries(apiSelectors).filter(([, v]) => v !== "" && v != null)
        );
        merged = { ...fallback, ...filtered };
      }
    } catch {
    }
    cachedSelectors[platform] = merged;
    return merged;
  }
  function extractText(selectors) {
    const selectorList = selectors.split(",").map((s) => s.trim());
    for (const selector of selectorList) {
      try {
        const el = document.querySelector(selector);
        if (el) {
          const text = el.textContent?.trim();
          if (text) return text;
        }
      } catch {
      }
    }
    return null;
  }
  function parsePrice(text) {
    if (!text) return null;
    const cleaned = text.replace(/[^\d,.]/g, "").replace(/\s/g, "").replace(",", ".");
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }
  function normalizeCondition(raw, platform) {
    if (!raw) return null;
    const lower = raw.toLowerCase().trim();
    const conditionMap = [
      // Long keys first
      ["neuf avec étiquette", "new"],
      ["neuf sans étiquette", "new"],
      ["très bon état", "like_new"],
      ["très bon", "like_new"],
      ["état correct", "fair"],
      ["bon état", "good"],
      ["pour pièces", "poor"],
      ["état neuf", "like_new"],
      ["comme neuf", "like_new"],
      ["brand new", "new"],
      ["like new", "like_new"],
      ["open box", "like_new"],
      ["very good", "like_new"],
      ["excellent", "like_new"],
      ["not working", "poor"],
      ["for parts", "poor"],
      ["pour pièces détachées", "poor"],
      ["reconditionné", "like_new"],
      ["refurbished", "like_new"],
      ["satisfaisant", "fair"],
      ["acceptable", "fair"],
      // Short keys last
      ["occasion", "good"],
      ["neuf", "new"],
      ["good", "good"],
      ["new", "new"],
      ["bon", "good"]
    ];
    for (const [key, value] of conditionMap) {
      if (lower.includes(key)) return value;
    }
    return null;
  }
  async function extractListingData(platform) {
    if (platform === "leboncoin") {
      const jsonResult = extractFromNextData();
      if (jsonResult) return jsonResult;
    }
    if (platform === "vinted") {
      const jsonResult = extractFromVintedJsonLd();
      if (jsonResult) return jsonResult;
    }
    const selectors = await getSelectors(platform);
    const title = extractText(selectors.title || "");
    if (!title) return null;
    const priceText = extractText(selectors.price || "");
    const price = parsePrice(priceText);
    const conditionText = extractText(selectors.condition || "");
    const condition = normalizeCondition(conditionText);
    let location = null;
    if (platform === "leboncoin") {
      location = extractLeboncoinLocation();
    } else if (platform === "ebay") {
      location = extractEbayLocation();
    } else {
      const locationRaw = extractText(selectors.location || "");
      location = normalizeRegion(locationRaw);
    }
    const description = extractDescription(platform);

    let categoryId = null;
    let categoryName = null;
    let isPourPieces = false;

    if (platform === "leboncoin") {
      // Détecter "Pour pièces" depuis la condition DOM
      const conditionEl = document.querySelector('[data-qa-id="criteria_item_condition"]');
      if (conditionEl) {
        const condText = conditionEl.textContent?.toLowerCase() || '';
        isPourPieces = condText.includes('pour pièces') || condText.includes('pour pieces');
      }
      // Catégorie depuis l'URL
      const urlPath = window.location.pathname;
      if (urlPath.includes('/ordinateurs/')) {
        categoryName = 'Ordinateurs';
        categoryId = 15;
      } else if (urlPath.includes('/accessoires_informatique/')) {
        categoryName = 'Accessoires informatique';
        categoryId = 17;
      } else if (urlPath.includes('/informatique/')) {
        categoryName = 'Informatique';
        categoryId = 16;
      }
    }

    return {
      title,
      price,
      condition,
      location,
      url: window.location.href,
      description,
      categoryId,
      categoryName,
      isPourPieces
    };
  }
  function extractDescription(platform) {
    try {
      if (platform === "leboncoin") {
        const el = document.querySelector('[data-qa-id="adview_description_container"]');
        return el?.textContent?.trim() || null;
      }
      if (platform === "ebay") {
        const descDiv = document.querySelector("#desc_div, #viTabs_0_is");
        if (descDiv) return descDiv.textContent?.trim() || null;
        const iframe = document.querySelector("#desc_ifr");
        if (iframe?.contentDocument) {
          return iframe.contentDocument.body?.textContent?.trim() || null;
        }
        return null;
      }
      if (platform === "vinted") {
        const el = document.querySelector('[itemprop="description"], [data-testid="item-description"]');
        return el?.textContent?.trim() || null;
      }
      return null;
    } catch {
      return null;
    }
  }
  function extractLeboncoinLocation() {
    try {
      // Méthode 1 : Breadcrumb structuré — nav a links
      // Structure LBC : [...utilitaires, "Accueil", catégorie, RÉGION, département, ville+CP, titre]
      const navLinks = document.querySelectorAll('nav a');
      if (navLinks && navLinks.length >= 6) {
        const crumbs = [...navLinks].map(a => a.textContent.trim());
        const accueilIndex = crumbs.indexOf('Accueil');
        if (accueilIndex !== -1 && accueilIndex + 3 < crumbs.length) {
          const regionText = crumbs[accueilIndex + 2];
          const cityText = crumbs.length > accueilIndex + 4 ? crumbs[accueilIndex + 4] : null;

          // Normaliser via LBC_REGION_MAP
          if (regionText) {
            const regionKey = regionText.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const mapped = LBC_REGION_MAP[regionKey];
            if (mapped) {
              console.log("[Monark] Location from breadcrumb nav a:", regionText, "→", mapped);
              return mapped;
            }
            // Essayer aussi avec tirets au lieu d'espaces
            const regionKeyDash = regionKey.replace(/\s+/g, "-");
            const mappedDash = LBC_REGION_MAP[regionKeyDash];
            if (mappedDash) {
              console.log("[Monark] Location from breadcrumb nav a (dash):", regionText, "→", mappedDash);
              return mappedDash;
            }
            console.log("[Monark] Breadcrumb region not in LBC_REGION_MAP:", regionText);
          }

          // Fallback : code postal depuis la ville breadcrumb
          if (cityText) {
            const cpMatch = cityText.match(/\b(\d{5})\b/);
            if (cpMatch) {
              const regionFromCp = normalizeRegion(cpMatch[1]);
              if (regionFromCp) {
                console.log("[Monark] Location from breadcrumb postal code:", cpMatch[1], "→", regionFromCp);
                return regionFromCp;
              }
            }
          }
        }
      }

      return null;
    } catch (err) {
      console.warn("[Monark] Leboncoin location extraction failed:", err);
      return null;
    }
  }
  function extractFromVintedJsonLd() {
    try {
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const script of scripts) {
        if (!script.textContent) continue;
        const data = JSON.parse(script.textContent);
        if (data?.["@type"] !== "Product") continue;
        const title = data.name || null;
        if (!title) continue;
        const offers = Array.isArray(data.offers) ? data.offers[0] : data.offers;
        const price = offers?.price ? parseFloat(offers.price) : null;
        const conditionEl = document.querySelector(
          '[data-testid="item-attributes-status"] [itemprop="status"] span, [data-testid="item-attributes-status"] .web_ui__Text__bold'
        );
        const conditionText = conditionEl?.textContent?.trim() || null;
        const condition = normalizeCondition(conditionText, "vinted");
        console.log("[Monark] Extracted from Vinted JSON-LD:", { title, price, condition, conditionText });
        const descriptionJsonLd = data.description || null;
        const descriptionDom = document.querySelector('[itemprop="description"], [data-testid="item-description"]')?.textContent?.trim() || null;
        return {
          title,
          price,
          condition,
          location: null,
          // Not available on Vinted
          url: window.location.href,
          description: descriptionJsonLd || descriptionDom,
          categoryId: null,
          categoryName: null
        };
      }
    } catch (err) {
      console.warn("[Monark] Vinted JSON-LD extraction failed:", err);
    }
    return null;
  }
  function extractEbayLocation() {
    const html = document.documentElement?.innerHTML || "";
    const jsonMatch = html.match(/"text":"(?:Lieu où se trouve l'objet|Item location)\s*:\s*([^"]+)"/i);
    if (jsonMatch) {
      const loc = jsonMatch[1].trim();
      return normalizeRegion(loc) || normalizeRegionFromCountryCity(loc);
    }
    const body = document.body?.textContent || "";
    const frMatch = body.match(/Lieu où se trouve l'objet\s*:\s*(.+?)(?:\s{2,}|Délai|Retour|Livraison|$)/);
    if (frMatch) {
      const loc = frMatch[1].trim();
      return normalizeRegion(loc) || normalizeRegionFromCountryCity(loc);
    }
    const enMatch = body.match(/Item location\s*:\s*(.+?)(?:\s{2,}|Delivery|Return|Shipping|$)/i);
    if (enMatch) {
      return normalizeRegion(enMatch[1].trim()) || normalizeRegionFromCountryCity(enMatch[1].trim());
    }
    return null;
  }
  function normalizeRegionFromCountryCity(text) {
    if (!text) return null;
    const city = text.split(",")[0].trim().toLowerCase();
    return CITY_REGION_HINTS[city] || null;
  }
  const LBC_CONDITION_MAP = {
    "neuf": "new",
    "etatneuf": "like_new",
    "tresbonetat": "like_new",
    "bonetat": "good",
    "etatcorrect": "fair",
    "pourpieces": "poor"
  };
  const LBC_REGION_MAP = {
    "alsace": "grand-est",
    "aquitaine": "nouvelle-aquitaine",
    "auvergne": "auvergne-rhone-alpes",
    "basse-normandie": "normandie",
    "bourgogne": "bourgogne-franche-comte",
    "bretagne": "bretagne",
    "centre": "centre-val-de-loire",
    "champagne-ardenne": "grand-est",
    "corse": "corse",
    "franche-comté": "bourgogne-franche-comte",
    "franche-comte": "bourgogne-franche-comte",
    "haute-normandie": "normandie",
    "ile-de-france": "ile-de-france",
    "île-de-france": "ile-de-france",
    "languedoc-roussillon": "occitanie",
    "limousin": "nouvelle-aquitaine",
    "lorraine": "grand-est",
    "midi-pyrénées": "occitanie",
    "midi-pyrenees": "occitanie",
    "nord-pas-de-calais": "hauts-de-france",
    "pays de la loire": "pays-de-la-loire",
    "pays-de-la-loire": "pays-de-la-loire",
    "picardie": "hauts-de-france",
    "poitou-charentes": "nouvelle-aquitaine",
    "provence-alpes-côte d'azur": "provence-alpes-cote-d-azur",
    "provence-alpes-cote d'azur": "provence-alpes-cote-d-azur",
    "rhône-alpes": "auvergne-rhone-alpes",
    "rhone-alpes": "auvergne-rhone-alpes",
    // New regions (already normalized)
    "auvergne-rhône-alpes": "auvergne-rhone-alpes",
    "auvergne-rhone-alpes": "auvergne-rhone-alpes",
    "bourgogne-franche-comté": "bourgogne-franche-comte",
    "grand est": "grand-est",
    "grand-est": "grand-est",
    "hauts-de-france": "hauts-de-france",
    "normandie": "normandie",
    "nouvelle-aquitaine": "nouvelle-aquitaine",
    "occitanie": "occitanie",
    "provence-alpes-cote-d-azur": "provence-alpes-cote-d-azur",
    "centre-val de loire": "centre-val-de-loire",
    "centre-val-de-loire": "centre-val-de-loire"
  };
  function extractFromNextData() {
    try {
      const scriptEl = document.getElementById("__NEXT_DATA__");
      if (!scriptEl?.textContent) return null;
      const data = JSON.parse(scriptEl.textContent);
      const ad = data?.props?.pageProps?.ad;
      if (!ad) {
        console.log("[Monark] __NEXT_DATA__ has no ad field (new Leboncoin structure), falling back to DOM");
        return null;
      }

      // Vérifier que les données correspondent à l'URL courante
      // Leboncoin met l'ID de l'annonce dans l'URL : /ad/xxx/1234567890
      const currentUrl = window.location.href;
      const urlIdMatch = currentUrl.match(/\/(\d{8,})(?:\?|$|#)/);
      const adId = ad.list_id || ad.ad_id || ad.id;
      if (urlIdMatch && adId && String(adId) !== urlIdMatch[1]) {
        console.log(`[Monark] __NEXT_DATA__ stale: ad ID ${adId} != URL ID ${urlIdMatch[1]}`);
        return null; // Données périmées — le retry dans analyze() réessaiera
      }

      const title = ad.subject || null;
      if (!title) return null;
      const rawPrice = ad.price;
      const price = Array.isArray(rawPrice) ? rawPrice[0] : typeof rawPrice === "number" ? rawPrice : null;
      const attrs = ad.attributes || [];
      const conditionAttr = attrs.find((a) => a.key === "condition");
      const conditionSlug = conditionAttr?.value || null;
      const condition = conditionSlug ? LBC_CONDITION_MAP[conditionSlug] || normalizeCondition(conditionAttr?.value_label || null, "leboncoin") : null;
      // Détecter l'état "Pour pièces" directement depuis les attributs Leboncoin
      const isPourPieces = conditionSlug === 'pourpieces' || conditionSlug === 'pour_pieces';
      const loc = ad.location || {};
      const regionName = (loc.region_name || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const deptName = (loc.department_name || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const location = LBC_REGION_MAP[regionName]
        || (deptName && DEPARTMENT_TO_REGION[deptName])
        || normalizeRegion(loc.city_label || loc.city || loc.zipcode || null);
      const description = ad.body || null;
      const categoryId = ad.category_id ?? null;
      const categoryName = ad.category_name ?? null;
      console.log("[Monark] Extracted from __NEXT_DATA__:", {
        title,
        price,
        condition,
        conditionSlug,
        location,
        regionName,
        descriptionLength: description?.length || 0,
        categoryId,
        categoryName
      });
      return {
        title,
        price,
        condition,
        location,
        url: window.location.href,
        description,
        categoryId,
        categoryName,
        isPourPieces
      };
    } catch (err) {
      console.warn("[Monark] __NEXT_DATA__ extraction failed:", err);
      return null;
    }
  }
  const DEPARTMENT_TO_REGION = {
    "ain": "auvergne-rhone-alpes",
    "allier": "auvergne-rhone-alpes",
    "ardeche": "auvergne-rhone-alpes",
    "cantal": "auvergne-rhone-alpes",
    "drome": "auvergne-rhone-alpes",
    "isere": "auvergne-rhone-alpes",
    "loire": "auvergne-rhone-alpes",
    "haute-loire": "auvergne-rhone-alpes",
    "puy-de-dome": "auvergne-rhone-alpes",
    "rhone": "auvergne-rhone-alpes",
    "savoie": "auvergne-rhone-alpes",
    "haute-savoie": "auvergne-rhone-alpes",
    "aisne": "hauts-de-france",
    "nord": "hauts-de-france",
    "oise": "hauts-de-france",
    "pas-de-calais": "hauts-de-france",
    "somme": "hauts-de-france",
    "bas-rhin": "grand-est",
    "haut-rhin": "grand-est",
    "moselle": "grand-est",
    "meurthe-et-moselle": "grand-est",
    "meuse": "grand-est",
    "vosges": "grand-est",
    "aube": "grand-est",
    "marne": "grand-est",
    "haute-marne": "grand-est",
    "ardennes": "grand-est",
    "calvados": "normandie",
    "eure": "normandie",
    "manche": "normandie",
    "orne": "normandie",
    "seine-maritime": "normandie",
    "cotes-d-armor": "bretagne",
    "finistere": "bretagne",
    "ille-et-vilaine": "bretagne",
    "morbihan": "bretagne",
    "loire-atlantique": "pays-de-la-loire",
    "maine-et-loire": "pays-de-la-loire",
    "mayenne": "pays-de-la-loire",
    "sarthe": "pays-de-la-loire",
    "vendee": "pays-de-la-loire",
    "cher": "centre-val-de-loire",
    "eure-et-loir": "centre-val-de-loire",
    "indre": "centre-val-de-loire",
    "indre-et-loire": "centre-val-de-loire",
    "loir-et-cher": "centre-val-de-loire",
    "loiret": "centre-val-de-loire",
    "charente": "nouvelle-aquitaine",
    "charente-maritime": "nouvelle-aquitaine",
    "correze": "nouvelle-aquitaine",
    "creuse": "nouvelle-aquitaine",
    "dordogne": "nouvelle-aquitaine",
    "gironde": "nouvelle-aquitaine",
    "landes": "nouvelle-aquitaine",
    "lot-et-garonne": "nouvelle-aquitaine",
    "pyrenees-atlantiques": "nouvelle-aquitaine",
    "deux-sevres": "nouvelle-aquitaine",
    "vienne": "nouvelle-aquitaine",
    "haute-vienne": "nouvelle-aquitaine",
    "ariege": "occitanie",
    "aude": "occitanie",
    "aveyron": "occitanie",
    "gard": "occitanie",
    "haute-garonne": "occitanie",
    "gers": "occitanie",
    "herault": "occitanie",
    "lot": "occitanie",
    "lozere": "occitanie",
    "hautes-pyrenees": "occitanie",
    "pyrenees-orientales": "occitanie",
    "tarn": "occitanie",
    "tarn-et-garonne": "occitanie",
    "alpes-de-haute-provence": "provence-alpes-cote-d-azur",
    "hautes-alpes": "provence-alpes-cote-d-azur",
    "alpes-maritimes": "provence-alpes-cote-d-azur",
    "bouches-du-rhone": "provence-alpes-cote-d-azur",
    "var": "provence-alpes-cote-d-azur",
    "vaucluse": "provence-alpes-cote-d-azur",
    "corse-du-sud": "corse",
    "haute-corse": "corse",
    "paris": "ile-de-france",
    "seine-et-marne": "ile-de-france",
    "yvelines": "ile-de-france",
    "essonne": "ile-de-france",
    "hauts-de-seine": "ile-de-france",
    "seine-saint-denis": "ile-de-france",
    "val-de-marne": "ile-de-france",
    "val-d-oise": "ile-de-france",
    "doubs": "bourgogne-franche-comte",
    "jura": "bourgogne-franche-comte",
    "haute-saone": "bourgogne-franche-comte",
    "territoire-de-belfort": "bourgogne-franche-comte",
    "cote-d-or": "bourgogne-franche-comte",
    "nievre": "bourgogne-franche-comte",
    "saone-et-loire": "bourgogne-franche-comte",
    "yonne": "bourgogne-franche-comte"
  };
  const CITY_REGION_HINTS = {
    "paris": "ile-de-france",
    "lyon": "auvergne-rhone-alpes",
    "marseille": "provence-alpes-cote-d-azur",
    "toulouse": "occitanie",
    "nice": "provence-alpes-cote-d-azur",
    "nantes": "pays-de-la-loire",
    "strasbourg": "grand-est",
    "montpellier": "occitanie",
    "bordeaux": "nouvelle-aquitaine",
    "lille": "hauts-de-france",
    "rennes": "bretagne",
    "reims": "grand-est",
    "nancy": "grand-est",
    "toulon": "provence-alpes-cote-d-azur",
    "grenoble": "auvergne-rhone-alpes",
    "dijon": "bourgogne-franche-comte",
    "angers": "pays-de-la-loire",
    "nimes": "occitanie",
    "clermont-ferrand": "auvergne-rhone-alpes",
    "le havre": "normandie",
    "rouen": "normandie",
    "metz": "grand-est",
    "besancon": "bourgogne-franche-comte",
    "perpignan": "occitanie",
    "orleans": "centre-val-de-loire",
    "caen": "normandie",
    "mulhouse": "grand-est",
    "brest": "bretagne",
    "tours": "centre-val-de-loire",
    "limoges": "nouvelle-aquitaine",
    "amiens": "hauts-de-france",
    "pau": "nouvelle-aquitaine",
    "poitiers": "nouvelle-aquitaine",
    "saint-etienne": "auvergne-rhone-alpes",
    "valence": "auvergne-rhone-alpes"
  };
  function normalizeRegion(locationText) {
    if (!locationText) return null;
    const lower = locationText.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    for (const [dept, region] of Object.entries(DEPARTMENT_TO_REGION)) {
      if (lower.includes(dept)) return region;
    }
    for (const [city, region] of Object.entries(CITY_REGION_HINTS)) {
      if (lower.includes(city)) return region;
    }
    const postalMatch = lower.match(/\b(\d{5})\b/);
    if (postalMatch) {
      const dept2 = postalMatch[1].substring(0, 2);
      const deptMap = {
        "01": "auvergne-rhone-alpes",
        "02": "hauts-de-france",
        "03": "auvergne-rhone-alpes",
        "04": "provence-alpes-cote-d-azur",
        "05": "provence-alpes-cote-d-azur",
        "06": "provence-alpes-cote-d-azur",
        "07": "auvergne-rhone-alpes",
        "08": "grand-est",
        "09": "occitanie",
        "10": "grand-est",
        "11": "occitanie",
        "12": "occitanie",
        "13": "provence-alpes-cote-d-azur",
        "14": "normandie",
        "15": "auvergne-rhone-alpes",
        "16": "nouvelle-aquitaine",
        "17": "nouvelle-aquitaine",
        "18": "centre-val-de-loire",
        "19": "nouvelle-aquitaine",
        "21": "bourgogne-franche-comte",
        "22": "bretagne",
        "23": "nouvelle-aquitaine",
        "24": "nouvelle-aquitaine",
        "25": "bourgogne-franche-comte",
        "26": "auvergne-rhone-alpes",
        "27": "normandie",
        "28": "centre-val-de-loire",
        "29": "bretagne",
        "30": "occitanie",
        "31": "occitanie",
        "32": "occitanie",
        "33": "nouvelle-aquitaine",
        "34": "occitanie",
        "35": "bretagne",
        "36": "centre-val-de-loire",
        "37": "centre-val-de-loire",
        "38": "auvergne-rhone-alpes",
        "39": "bourgogne-franche-comte",
        "40": "nouvelle-aquitaine",
        "41": "centre-val-de-loire",
        "42": "auvergne-rhone-alpes",
        "43": "auvergne-rhone-alpes",
        "44": "pays-de-la-loire",
        "45": "centre-val-de-loire",
        "46": "occitanie",
        "47": "nouvelle-aquitaine",
        "48": "occitanie",
        "49": "pays-de-la-loire",
        "50": "normandie",
        "51": "grand-est",
        "52": "grand-est",
        "53": "pays-de-la-loire",
        "54": "grand-est",
        "55": "grand-est",
        "56": "bretagne",
        "57": "grand-est",
        "58": "bourgogne-franche-comte",
        "59": "hauts-de-france",
        "60": "hauts-de-france",
        "61": "normandie",
        "62": "hauts-de-france",
        "63": "auvergne-rhone-alpes",
        "64": "nouvelle-aquitaine",
        "65": "occitanie",
        "66": "occitanie",
        "67": "grand-est",
        "68": "grand-est",
        "69": "auvergne-rhone-alpes",
        "70": "bourgogne-franche-comte",
        "71": "bourgogne-franche-comte",
        "72": "pays-de-la-loire",
        "73": "auvergne-rhone-alpes",
        "74": "auvergne-rhone-alpes",
        "75": "ile-de-france",
        "76": "normandie",
        "77": "ile-de-france",
        "78": "ile-de-france",
        "79": "nouvelle-aquitaine",
        "80": "hauts-de-france",
        "81": "occitanie",
        "82": "occitanie",
        "83": "provence-alpes-cote-d-azur",
        "84": "provence-alpes-cote-d-azur",
        "85": "pays-de-la-loire",
        "86": "nouvelle-aquitaine",
        "87": "nouvelle-aquitaine",
        "88": "grand-est",
        "89": "bourgogne-franche-comte",
        "90": "bourgogne-franche-comte",
        "91": "ile-de-france",
        "92": "ile-de-france",
        "93": "ile-de-france",
        "94": "ile-de-france",
        "95": "ile-de-france"
      };
      if (deptMap[dept2]) return deptMap[dept2];
    }
    return null;
  }
  function notifyMonarkSite() {
    const host = window.location.hostname;
    if (host === "monark-market.fr" || host === "www.monark-market.fr") {
      window.postMessage(
        { type: "MONARK_LENS_INSTALLED", version: EXTENSION_VERSION },
        "*"
      );
    }
  }
  let lastUrl = "";
  function observeNavigation(callback) {
    callback();
    lastUrl = window.location.href;
    if ("navigation" in window) {
      window.navigation.addEventListener("navigatesuccess", () => {
        if (window.location.href !== lastUrl) {
          lastUrl = window.location.href;
          callback();
        }
      });
    } else {
      let debounceTimer = null;
      const observer = new MutationObserver((mutations) => {
        // Ignorer les mutations causées par notre propre overlay
        const isOnlyOverlayChange = mutations.every(m => {
          return [...(m.addedNodes || []), ...(m.removedNodes || [])].every(node => {
            return node.nodeType !== 1 || (node.id && node.id.startsWith('monark'));
          });
        });
        if (isOnlyOverlayChange) return;
        if (window.location.href !== lastUrl) {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            lastUrl = window.location.href;
            callback();
          }, 300);
        }
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
    window.addEventListener("popstate", () => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        callback();
      }
    });
  }
  notifyMonarkSite();

  let componentDb = [];
  let dbLoaded = false;
  async function loadComponentDb() {
    if (dbLoaded && componentDb.length > 0) return;
    try {
      const response = await chrome.runtime.sendMessage({
        type: "GET_COMPONENT_DB"
      });
      if (Array.isArray(response) && response.length > 0) {
        componentDb = response;
        dbLoaded = true;
        console.log(
          `[Monark] Component DB loaded: ${componentDb.length} components`
        );
      }
    } catch (err) {
      console.error("[Monark] Failed to load component DB:", err);
    }
  }
  function normalize(text) {
    let t = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
    // Coller les suffixes CPU/GPU : "5800 x" → "5800x", "13900 k" → "13900k", "7800 x3d" → "7800x3d"
    t = t.replace(/(\d)\s+(x3d|x3|xt|xtx|xs|kf|ks|kx|hx|hs|x|k|g|f|e|s|u|h|p|ti|super)\b/g, '$1$2');
    // Coller préfixes GPU au numéro : "gtx 1080" → "gtx1080", "rx 7600" → "rx7600"
    t = t.replace(/\b(gtx|rtx|rx)\s+(\d)/g, '$1$2');
    return t;
  }
  const GPU_PATTERNS = [
    // NVIDIA GeForce — standard (RTX/GTX prefix)
    /\b(?:geforce\s*)?(?:rtx|gtx)\s*(\d{3,4})\s*(ti\s*super|super|ti)?\b/i,
    // NVIDIA — sans RTX/GTX mais avec suffixe ti/super (ex: "1080 Ti", "1080ti", "Nvidia 1080ti")
    /\b(?:nvidia\s*)?(?:geforce\s*)?(\d{4})\s*(ti\s*super|super|ti)\b/i,
    // AMD Radeon — standard
    /\b(?:radeon\s*)?rx\s*(\d{3,4})\s*(xt|xtx)?\b/i,
    // AMD Radeon — rx collé au numéro (ex: "rx7600", "rx7800xt")
    /\brx(\d{4})\s*(xt|xtx)?\b/i,
    // Intel Arc
    /\barc\s*(a\d{3,4})\b/i
  ];
  function extractGpuModel(title) {
    // Pattern 1: Standard NVIDIA (RTX/GTX prefix)
    const nvidiaStd = /\b(?:geforce\s*)?(?:rtx|gtx)\s*(\d{3,4})\s*(ti\s*super|super|ti)?\b/i;
    let m = nvidiaStd.exec(title);
    if (m) return m[0].trim();

    // Pattern 2: NVIDIA sans prefix mais avec suffixe (ex: "1080 Ti", "Nvidia 1080ti")
    const nvidiaSuffix = /\b(?:nvidia\s*)?(?:geforce\s*)?(\d{4})\s*(ti\s*super|super|ti)\b/i;
    m = nvidiaSuffix.exec(title);
    if (m) {
      // Reconstruire en ajoutant GTX/RTX selon le numéro
      const num = parseInt(m[1]);
      const suffix = m[2] || '';
      const prefix = num >= 2000 ? 'RTX' : 'GTX';
      return `${prefix} ${m[1]} ${suffix}`.trim();
    }

    // Pattern 3: AMD Radeon standard
    const amdStd = /\b(?:radeon\s*)?rx\s*(\d{3,4})\s*(xt|xtx)?\b/i;
    m = amdStd.exec(title);
    if (m) return m[0].trim();

    // Pattern 4: AMD rx collé (ex: "rx7600")
    const amdConcat = /\brx(\d{4})\s*(xt|xtx)?\b/i;
    m = amdConcat.exec(title);
    if (m) return `RX ${m[1]}${m[2] ? ' ' + m[2] : ''}`.trim();

    // Pattern 5: Intel Arc
    const arcPattern = /\barc\s*(a\d{3,4})\b/i;
    m = arcPattern.exec(title);
    if (m) return m[0].trim();

    return null;
  }
  function matchComponent(title) {
    if (!componentDb.length) return null;
    const normalizedTitle = normalize(title);
    let bestMatch = null;
    for (const component of componentDb) {
      const normalizedName = normalize(component.name);
      if (normalizedTitle.includes(normalizedName)) {
        const score = normalizedName.length * 2;
        if (!bestMatch || score > bestMatch.matchScore) {
          bestMatch = {
            componentId: component.id,
            componentName: component.name,
            category: component.category,
            matchScore: score,
            matchType: 'exact_name'
          };
        }
        continue;
      }
      if (component.aliases) {
        for (const alias of component.aliases) {
          const normalizedAlias = normalize(alias);
          if (normalizedAlias.length >= 3 && normalizedTitle.includes(normalizedAlias)) {
            const score = normalizedAlias.length;
            if (!bestMatch || score > bestMatch.matchScore) {
              bestMatch = {
                componentId: component.id,
                componentName: component.name,
                category: component.category,
                matchScore: score,
                matchType: 'alias'
              };
            }
          }
        }
      }
    }
    // GPU/CPU regex — always run as safety net
    const gpuModel = extractGpuModel(title);
    if (gpuModel) {
      const normalizedGpu = normalize(gpuModel);
      for (const component of componentDb) {
        const normalizedName = normalize(component.name);
        if (normalizedName.includes(normalizedGpu) || normalizedGpu.includes(normalizedName)) {
          const gpuScore = normalizedGpu.length * 3;
          if (!bestMatch || gpuScore > bestMatch.matchScore || bestMatch.matchType === 'alias' || bestMatch.category !== 'gpu') {
            bestMatch = {
              componentId: component.id,
              componentName: component.name,
              category: component.category,
              matchScore: gpuScore,
              matchType: 'gpu_regex'
            };
          }
          break;
        }
      }
    }
    return bestMatch;
  }
  function findVariantName(componentId, title) {
    const component = componentDb.find(c => c.id === componentId);
    if (!component?.aliases?.length) return null;
    const normalizedTitle = normalize(title);
    const baseName = normalize(component.name);
    let bestVariant = null;
    let bestLength = 0;
    for (const alias of component.aliases) {
      const na = normalize(alias);
      if (na.length <= baseName.length) continue;
      if (normalizedTitle.includes(na) && na.length > bestLength) {
        bestVariant = alias;
        bestLength = na.length;
      }
    }
    if (!bestVariant) return null;
    const name = component.name;
    let variantPart = bestVariant;
    if (variantPart.toLowerCase().startsWith(name.toLowerCase())) {
      variantPart = variantPart.substring(name.length).trim();
    } else {
      for (const prefix of ["GeForce ", "AMD Radeon ", "Radeon ", "Intel Arc ", "Intel Core ", "AMD Ryzen ", "AMD ", "Intel "]) {
        if (name.startsWith(prefix)) {
          const shortName = name.substring(prefix.length);
          if (variantPart.toLowerCase().startsWith(shortName.toLowerCase())) {
            variantPart = variantPart.substring(shortName.length).trim();
            break;
          }
        }
      }
    }
    variantPart = variantPart.replace(/^[\s\-–]+/, '').trim();
    return variantPart || null;
  }
  function fuzzyMatchScore(componentName, text, aliases) {
    // Tokeniser le nom du composant et chercher chaque token dans le texte
    const textTokens = new Set(text.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(t => t.length >= 2));

    // Essayer le nom principal
    const nameTokens = componentName.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(t => t.length >= 2);
    // Tokens significatifs = ceux qui ne sont pas génériques
    const genericTokens = new Set(['gb', 'tb', 'mhz', 'ddr4', 'ddr5', 'rgb', 'pro', 'plus', 'evo', 'the', 'and', 'with', 'for']);
    const significantTokens = nameTokens.filter(t => !genericTokens.has(t) && t.length >= 3);

    if (significantTokens.length === 0) return 0;

    let matched = 0;
    for (const token of significantTokens) {
      if (textTokens.has(token)) {
        matched++;
      } else {
        // Matching partiel pour les nombres (ex: "6000" dans "6000mhz")
        for (const tt of textTokens) {
          if (tt.includes(token) || token.includes(tt)) {
            matched += 0.5;
            break;
          }
        }
      }
    }

    const ratio = matched / significantTokens.length;
    // Exiger au moins 60% de match ET au moins 2 tokens significatifs matchés
    if (ratio >= 0.6 && matched >= 2) {
      return ratio * significantTokens.length; // Score = ratio * poids
    }
    return 0;
  }

  function matchAllComponents(text) {
    if (!componentDb.length) return [];
    const normalizedText = normalize(text);
    const matches = [];
    const usedComponentIds = new Set();

    // Trier par longueur décroissante du nom pour matcher les plus spécifiques d'abord
    const sortedDb = [...componentDb].sort(
      (a, b) => normalize(b.name).length - normalize(a.name).length
    );

    // Phase 1 : Matching exact (includes)
    for (const component of sortedDb) {
      if (usedComponentIds.has(component.id)) continue;
      const normalizedName = normalize(component.name);
      if (normalizedText.includes(normalizedName)) {
        matches.push({
          componentId: component.id,
          componentName: component.name,
          category: component.category,
          matchScore: normalizedName.length * 2,
          matchType: 'exact_name',
        });
        usedComponentIds.add(component.id);
        continue;
      }
      if (component.aliases) {
        let found = false;
        for (const alias of component.aliases) {
          const normalizedAlias = normalize(alias);
          if (normalizedAlias.length >= 4 && normalizedText.includes(normalizedAlias)) {
            matches.push({
              componentId: component.id,
              componentName: component.name,
              category: component.category,
              matchScore: normalizedAlias.length,
              matchType: 'exact_alias',
            });
            usedComponentIds.add(component.id);
            found = true;
            break;
          }
        }
        if (found) continue;
      }
    }

    // Phase 2 : Matching flou pour les catégories qui ont peu de matchs exacts
    const categoriesWithExact = new Set(matches.map(m => m.category));
    const fuzzyCategories = ['cpu', 'gpu', 'ram', 'ssd'].filter(cat => !categoriesWithExact.has(cat));

    if (fuzzyCategories.length > 0) {
      for (const component of sortedDb) {
        if (usedComponentIds.has(component.id)) continue;
        if (!fuzzyCategories.includes(component.category)) continue;

        const score = fuzzyMatchScore(component.name, normalizedText, component.aliases);
        if (score > 0) {
          // Vérifier qu'on n'a pas déjà un match pour cette catégorie en fuzzy
          if (!matches.find(m => m.category === component.category && m.matchType === 'fuzzy')) {
            matches.push({
              componentId: component.id,
              componentName: component.name,
              category: component.category,
              matchScore: score,
              matchType: 'fuzzy',
            });
            usedComponentIds.add(component.id);
          }
        }
      }
    }

    // Dédupliquer : si deux matchs de la même catégorie ont des noms similaires, garder le meilleur
    const deduped = [];
    const seenByCategory = {};
    // Trier par score décroissant pour garder le meilleur
    matches.sort((a, b) => b.matchScore - a.matchScore);
    for (const m of matches) {
      const key = m.category;
      if (!seenByCategory[key]) {
        seenByCategory[key] = [];
      }
      // Vérifier si un match de la même catégorie a déjà un nom très similaire
      const isDuplicate = seenByCategory[key].some(existing => {
        const existingTokens = new Set(normalize(existing.componentName).split(' '));
        const currentTokens = normalize(m.componentName).split(' ');
        const overlap = currentTokens.filter(t => t.length >= 3 && existingTokens.has(t)).length;
        if (overlap >= 2) return true;
        // Comparaison numérique : même numéro de modèle (4+ chiffres) + au moins 1 token commun
        if (overlap >= 1) {
          const getModelNums = tokens => [...tokens].map(t => t.match(/^(\d{4,})/)?.[1]).filter(Boolean);
          const existingNums = getModelNums(existingTokens);
          const currentNums = getModelNums(new Set(currentTokens));
          if (existingNums.some(en => currentNums.some(cn => en === cn))) return true;
        }
        return false;
      });
      if (!isDuplicate) {
        deduped.push(m);
        seenByCategory[key].push(m);
      } else {
        console.log(`[Monark] Deduplicated: ${m.componentName} (duplicate of existing ${key})`);
      }
    }
    console.log(`[Monark] matchAllComponents found ${deduped.length} components:`, deduped.map(m => `${m.componentName} (${m.matchType})`));
    return deduped;
  }
  function buildAnalyzePayload(listing, detection, match, intent, allComponents) {
    const uniqueCategories = new Set((allComponents || []).map(c => c.category));
    const isBundle = allComponents && allComponents.length >= 2 && uniqueCategories.size >= 2;
    return {
      url: listing.url,
      platform: detection.platform,
      price: listing.price,
      condition: listing.condition || null,
      region: listing.location || null,
      category_id: listing.categoryId || null,
      category_name: listing.categoryName || null,
      intent: {
        type: intent.type,
        confidence: intent.confidence,
        flags: intent.flags || [],
        quantity: intent.quantity || 1
      },
      primary_component_id: match.componentId,
      primary_variant_name: match.variantName || null,
      components: (allComponents && allComponents.length > 0 ? allComponents : [match]).map(c => ({
        component_id: c.componentId,
        category: c.category || "gpu",
        match_type: c.matchType || "exact_name"
      })),
      is_bundle: isBundle,
      user_confirmed_bundle: false
    };
  }
  function watchForDescription(detection, listing, match) {
    if (listing.description) return;
    if (detection.platform !== "leboncoin") return;
    const targetUrl = window.location.href;
    let watcherStopped = false;
    console.log("[Monark] Starting description watcher for SPA...");
    const checkInterval = setInterval(async () => {
      if (window.location.href !== targetUrl || watcherStopped) {
        clearInterval(checkInterval);
        return;
      }
      const freshListing = await extractListingData(detection.platform);
      if (freshListing?.description && freshListing.description.length > 10) {
        clearInterval(checkInterval);
        watcherStopped = true;
        console.log("[Monark] Description appeared! Length:", freshListing.description.length, "chars");
        const fullText = `${freshListing.title} ${freshListing.description}`;
        const allComponents = matchAllComponents(fullText);
        const uniqueCategories = new Set(allComponents.map(c => c.category));
        console.log("[Monark] Re-analysis with description:", allComponents.length, "components in", uniqueCategories.size, "categories");
        if (allComponents.length >= 2 && uniqueCategories.size >= 2) {
          console.log("[Monark] Upgrading to bundle analysis!");
          const intent = {
            type: "bundle",
            confidence: 0.85,
            flags: ["auto_detected_multicomponent", "description_watcher"],
            quantity: 1
          };
          const payload = buildAnalyzePayload(freshListing, detection, match, intent, allComponents);
          payload.is_bundle = true;
          showLoadingOverlay();
          const response = await chrome.runtime.sendMessage({ type: "ANALYZE_LISTING", payload });
          currentAnalyzeResponse = response;
          handleAnalyzeResponse(response, freshListing, match, allComponents, detection);
        }
      }
    }, 500);
    setTimeout(() => {
      if (!watcherStopped) {
        clearInterval(checkInterval);
        watcherStopped = true;
        console.log("[Monark] Description watcher timed out after 15s");
      }
    }, 15000);
    if (!analyze._descriptionWatcher) analyze._descriptionWatcher = {};
    analyze._descriptionWatcher.stop = () => {
      watcherStopped = true;
      clearInterval(checkInterval);
    };
  }
  function _convertPrimaryScore(ps, askingPrice) {
    if (!ps) return null;
    const pvm = ps.price_vs_market || 0;
    const rawScore = 10 * (-pvm / 100) * 2 + 5;
    const clampedScore = Math.max(0, Math.min(10, rawScore));
    return {
      component_id: ps.component_id,
      component_name: ps.component_name,
      category: ps.category,
      score: Math.round(clampedScore * 10) / 10,
      verdict: ps.verdict,
      verdict_label: ({
        excellente_affaire: "Excellente affaire",
        bonne_affaire: "Bonne affaire",
        prix_correct: "Prix correct",
        au_dessus_marche: "Au-dessus du marché",
        trop_cher: "Trop cher"
      })[ps.verdict] || ps.verdict,
      market_median: ps.market_median,
      asking_price: askingPrice,
      gap_percent: Math.abs(pvm),
      gap_direction: pvm < 0 ? "under" : "over",
      confidence: ps.confidence,
      data_points_30d: ps.data_points,
      trend_30d: ps.trend_30d || null,
      p25: ps.p25_price || null,
      p75: ps.p75_price || null
    };
  }
  function handleAnalyzeResponse(response, listing, match, allComponents, detection) {
    if (!response || response.error) {
      console.warn("[Monark] Analyze failed:", response?.error);
      removeOverlay();
      return;
    }
    console.log(`[Monark] Analyze response: type=${response.signal_type}, bundle=${response.is_bundle}, qualified=${response.is_qualified}, cached=${response.cached}`);
    currentAdHash = response.ad_hash;
    if (response.credits_remaining !== undefined) {
      currentCreditsRemaining = response.credits_remaining;
    }
    if (!response.is_qualified) {
      const filterIntent = {
        type: response.signal_type,
        confidence: 0.9,
        overlayMessage: (response.insights && response.insights[0]?.text) || `Annonce filtrée : ${response.signal_type}`,
        shouldOverlay: true
      };
      showFilteredOverlay(match.componentName, match.componentId, listing.price, filterIntent);
      return;
    }
    if (response.is_bundle && response.bundle_analysis) {
      const bundleResult = {
        components: response.bundle_analysis.components.map(c => ({
          component_id: c.component_id,
          component_name: c.component_name,
          category: c.category,
          median_price: c.market_median,
          p25_price: null,
          p75_price: null,
          data_points: c.data_points,
          confidence: c.confidence
        })),
        total_estimated_value: response.bundle_analysis.total_estimated_value,
        components_found: response.bundle_analysis.components_with_data,
        components_requested: response.bundle_analysis.components_found,
        verdict: response.bundle_analysis.verdict
      };
      showBundleAnalysisOverlay(allComponents || [], listing.price, bundleResult);
      return;
    }
    if (response.quantity_analysis) {
      const qa = response.quantity_analysis;
      const score = _convertPrimaryScore(qa.unit_score, qa.unit_price);
      if (score) {
        showScoreOverlay(score, {
          platform: detection.platform,
          condition: listing.condition,
          category: match.category || null,
          variantName: match.variantName || null,
          quantityNote: `Lot de ${qa.quantity} — prix unitaire : ${qa.unit_price}€`
        }, handleFlagClick, null);
        _postOverlaySetup(response);
        return;
      }
    }
    if (response.primary_score) {
      const score = _convertPrimaryScore(response.primary_score, listing.price);
      if (score) {
        showScoreOverlay(score, {
          platform: detection.platform,
          condition: listing.condition,
          category: match.category || null,
          variantName: match.variantName || null
        }, handleFlagClick, null);
        _postOverlaySetup(response);
        return;
      }
    }
    removeOverlay();
  }
  function _postOverlaySetup(response) {
    if (!shadowRoot) return;
    // If already upgraded, auto-load deep data
    if (response.already_upgraded) {
      handleDeepAnalysis(response.already_upgraded);
      return;
    }
    // If can't upgrade (not enough credits or not eligible), grey out button
    if (response.can_upgrade_quick === false) {
      var quickBtn = shadowRoot.getElementById('monark-quick-btn');
      if (quickBtn) {
        quickBtn.disabled = true;
        quickBtn.style.opacity = '0.5';
        quickBtn.textContent = '⚡ Analyse rapide — crédits insuffisants';
      }
    }
  }
  function isDbLoaded() {
    return dbLoaded && componentDb.length > 0;
  }

  const INTENT_PATTERNS = {
    // ── DEMANDE D'ACHAT ──
    wanted: {
      titlePatterns: [
        /\b(cherche|recherche|achète|ach[eè]te)\b/i,
        /\b(je\s+veux|je\s+souhaite|je\s+cherche)\b/i,
        /\b(wanted|wtb|looking\s+for|buying|iso)\b/i,
        /\b(qui\s+vend|qui\s+a\s+un[e]?)\b/i,
        /\b(besoin\s+d[e'])\b/i,
        /\b(à\s+la\s+recherche\s+d[e'])\b/i
      ],
      descPatterns: [
        /\b(je\s+recherche|je\s+cherche|[àa]\s+la\s+recherche)\b/i,
        /\b(j'?ach[eè]te)\b/i,
        /\b(recherche\s+uniquement)\b/i
      ],
      type: "wanted",
      shouldSignal: false,
      shouldOverlay: true,
      overlayMessage: "Demande d'achat — pas une vente"
    },
    // ── ÉCHANGE / TROC ──
    trade: {
      titlePatterns: [
        /\b(échange|echange|troc|swap|trade)\b/i,
        /\b(échange\s+possible|echange\s+possible)\b/i,
        /\bcontre\b.*\b(?:rtx|gtx|rx|\d{4})\b/i,
        /\b(?:rtx|gtx|rx)\s+\d{3,4}.*\bcontre\b/i
      ],
      descPatterns: [
        /\b(échange\s+uniquement|echange\s+uniquement|troc\s+uniquement)\b/i,
        /\b(j'?[ée]change)\b/i,
        /\b(je\s+troc|je\s+swap)\b/i,
        /\b(pas\s+de\s+vente|uniquement\s+[ée]change)\b/i,
        /\b(je\s+propose\s+.*[ée]change)\b/i,
        /\b(ouvert\s+[àa]\s+l'?[ée]change)\b/i
      ],
      type: "trade",
      shouldSignal: false,
      shouldOverlay: true,
      overlayMessage: "Échange / troc — pas de prix de vente fiable"
    },
    // ── BOÎTE / EMBALLAGE SEUL ──
    box_only: {
      titlePatterns: [
        /\b(bo[iî]te?|carton|emballage|packaging|box)\s+(de|du|d'|vide|seul[e]?|only|uniquement)\b/i,
        /\b(bo[iî]te?\s+(nvidia|amd|intel|geforce|radeon|msi|asus|gigabyte|evga|zotac|sapphire|corsair|crucial|samsung|kingston|wd|seagate))\b/i,
        /\b(nvidia|amd|geforce|radeon|msi|asus|gigabyte)\b.*\b(bo[iî]te?|carton|emballage)\b/i,
        /\bemballage\s+d'origine\b/i,
        /\bbo[iî]te?\s+vide\b/i
      ],
      descPatterns: [
        /\b(vend[s]?\s+(la\s+)?bo[iî]te?|vend[s]?\s+l'emballage)\b/i,
        /\b(bo[iî]te?\s+seul[e]?|emballage\s+seul|carton\s+seul)\b/i,
        /\b(sans\s+l[ea]\s+(carte|gpu|cpu|composant|produit|matériel))\b/i,
        /\b(bo[iî]te?\s+uniquement|only\s+box|empty\s+box)\b/i
      ],
      type: "box_only",
      shouldSignal: false,
      shouldOverlay: true,
      overlayMessage: "Boîte / emballage seul — pas le composant"
    },
    // ── COMPOSANT HS / PANNE ──
    broken: {
      titlePatterns: [
        /\b(hors\s+service|hs|en\s+panne|dead|mort[e]?|brick[ée]|grill[ée]|cram[ée])\b/i,
        /\b(d[ée]fectueu[sx]|d[ée]faillant[e]?|endommag[ée]|cass[ée]|fissur[ée])\b/i,
        /\b(ne\s+fonctionne\s+(pas|plus))\b/i,
        /\b(doesn'?t?\s+work|not\s+working|broken|faulty|defective)\b/i,
        /\b(pour\s+pi[eè]ces|for\s+parts|as[\s-]is)\b/i,
        /\b(artefact[s]?|artifact[s]?)\b/i,
        /\b(hs|h\.s\.|h\s+s)\b/i,
        /\b(à\s+r[ée]parer|needs?\s+repair|reparation)\b/i
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
        /\b(gpu\s+dead|carte\s+(morte|grillée|hs))\b/i
      ],
      type: "broken",
      shouldSignal: true,
      shouldOverlay: true,
      overlayMessage: "Composant HS / pour pièces"
    },
    // ── PC COMPLET / BUNDLE ──
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
        /\b(rig\s+complet)\b/i
      ],
      descPatterns: [
        /\b(vend[s]?\s+(mon|ma|un|le)\s+(pc|ordi|config|tour|setup))\b/i,
        /\b(ensemble\s+complet|tout\s+le\s+(pc|setup))\b/i,
        /\b(livr[ée]\s+avec\s+(écran|clavier|souris|moniteur))\b/i,
        /\b(ne\s+vend[s]?\s+pas\s+s[ée]par[ée]ment|pas\s+de\s+vente\s+s[ée]par[ée]e)\b/i,
        /\b(tout\s+ensemble|le\s+lot\s+complet)\b/i
      ],
      type: "bundle",
      shouldSignal: false,
      shouldOverlay: true,
      overlayMessage: "Ensemble / PC complet — prix non représentatif du composant seul"
    },
    // ── QUANTITÉ MULTIPLE / LOT ──
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
        /\b(?:rtx|gtx|rx)\s+\d{3,4}(?:\s*(?:ti|super))?\s+les\s+(\d+)\b/i
      ],
      descPatterns: [
        /\b(vend[s]?\s+(\d+)\s+(carte|gpu|ssd|barrette))/i,
        /\b(les\s+\d+\s+(ensemble|pour\s+le\s+lot))\b/i,
        /\b(prix\s+(pour\s+les\s+\d+|du\s+lot|le\s+lot|l'ensemble))\b/i
      ],
      type: "multiple",
      shouldSignal: false,
      shouldOverlay: true,
      overlayMessage: "Lot / quantité multiple — prix total, pas unitaire"
    },
    // ── ACCESSOIRE ──
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
        /\b(vis|screw|mount|fixation|bracket)\s.{0,10}(gpu|carte|ssd|m\.?2)/i
      ],
      descPatterns: [
        /\b(compatible\s+(avec\s+)?(rtx|gtx|rx|radeon|geforce))\b/i,
        /\b(pour\s+(rtx|gtx|rx|radeon|geforce))\b/i,
        /\b(s'installe\s+sur|se\s+monte\s+sur)\b/i
      ],
      type: "accessory",
      shouldSignal: false,
      shouldOverlay: true,
      overlayMessage: "Accessoire — pas le composant lui-même"
    },
    // ── RÉSERVÉ / VENDU ──
    reserved: {
      titlePatterns: [
        /\b(r[ée]serv[ée]e?)\b/i,
        /\b(vendu[e]?)\b(?!\s+(avec|en))/i,
        /\b(sold)\b/i,
        /\b(pending)\b/i,
        /\b(plus\s+disponible|indisponible)\b/i,
        /\b(not\s+available|no\s+longer\s+available)\b/i
      ],
      descPatterns: [
        /\b(déjà\s+vendu|already\s+sold)\b/i,
        /\b(annonce\s+expir[ée]e|listing\s+expired)\b/i
      ],
      type: "reserved",
      shouldSignal: false,
      shouldOverlay: true,
      overlayMessage: "Annonce réservée ou vendue"
    },
    // ── LOCATION / PRÊT ──
    rental: {
      titlePatterns: [
        /\b(location|loue|lou[ée]|à\s+louer)\b/i,
        /\b(rent|rental|for\s+rent|to\s+rent)\b/i,
        /\b(\/mois|\/semaine|\/jour|\/heure|par\s+mois|par\s+semaine|par\s+jour)\b/i,
        /\b(prêt|prête|emprunte[r]?)\b/i
      ],
      descPatterns: [
        /\b(tarif\s+(journalier|mensuel|hebdomadaire|horaire))\b/i,
        /\b(location\s+(courte|longue)\s+dur[ée]e)\b/i,
        /\b(je\s+loue|je\s+propose\s+en\s+location)\b/i,
        /\b(\d+\s*€?\s*\/\s*(mois|semaine|jour|heure|h|j|sem))\b/i
      ],
      type: "rental",
      shouldSignal: false,
      shouldOverlay: true,
      overlayMessage: "Location — pas une vente"
    },
    // ── EX-MINAGE / CRYPTO ──
    mining: {
      titlePatterns: [
        /\b(min[ée]|mining|minage|mineur|miné)\b/i,
        /\b(ex[\s-]?mining|ex[\s-]?minage)\b/i,
        /\b(rig\s+de\s+minage|mining\s+rig)\b/i,
        /\b(crypto|ethereum|bitcoin|eth)\b.*\b(carte|gpu|rtx|gtx|rx)/i,
        /\b(carte|gpu|rtx|gtx|rx)\b.*\b(crypto|ethereum|bitcoin|eth)/i
      ],
      descPatterns: [
        /\b(utilis[ée]\s+pour\s+(le\s+)?min(age|ing))\b/i,
        /\b(a\s+servi\s+[àa]\s+min(er|age|ing))\b/i,
        /\b(mining|minage)\s+(24|7|h24|non[\s-]?stop|intensif)/i,
        /\b(farm|ferme\s+de\s+minage)\b/i,
        /\b(hashrate|hash\s+rate|mh\/s|gh\/s|th\/s)\b/i,
        /\b(undervolted?|undervolt[ée]|repasted?)\b/i,
        /\b(bios\s+modifi[ée]|modded\s+bios|mining\s+bios)\b/i,
        /\b(power\s+limit|pl\s+\d+\s*%|tdp\s+r[ée]duit)\b/i
      ],
      type: "mining",
      shouldSignal: true,
      shouldOverlay: true,
      overlayMessage: "Composant ex-minage détecté"
    },
    // ── RECONDITIONNÉ / RMA ──
    rma_refurb: {
      titlePatterns: [
        /\b(reconditionn[ée]|refurbished|refurb)\b/i,
        /\b(rma|retourn?[ée]|outlet)\b/i,
        /\b(certifi[ée]\s+reconditionn[ée])\b/i,
        /\b(grade\s+[a-c])\b/i
      ],
      descPatterns: [
        /\b(reconditionn[ée]\s+(par|chez)\s+\w+)\b/i,
        /\b(retour\s+(sav|constructeur|fabricant|amazon|ldlc))\b/i,
        /\b(remplac[ée]\s+sous\s+garantie|rma\s+(nvidia|amd|asus|msi|evga))\b/i,
        /\b(garantie\s+(constructeur|fabricant)\s+(restante|en\s+cours))\b/i,
        /\b(remis\s+[àa]\s+neuf|like\s+refurb)\b/i
      ],
      type: "rma_refurb",
      shouldSignal: true,
      shouldOverlay: true,
      overlayMessage: "Composant reconditionné / RMA"
    },
    // ── PRIX SYMBOLIQUE ──
    symbolic_price: {
      titlePatterns: [
        /\b(faire\s+offre|prix\s+[àa]\s+d[ée]battre|[àa]\s+d[ée]battre)\b/i,
        /\b(offre[sz]?\s+vo[st]re\s+prix|meilleur[e]?\s+offre)\b/i,
        /\b(prix\s+en\s+mp|prix\s+[àa]\s+voir|prix\s+symbolique)\b/i,
        /\b(contacte[rz]\s+moi\s+pour\s+(le\s+)?prix)\b/i,
        /\b(best\s+offer|make\s+offer|obo|or\s+best\s+offer)\b/i,
        /\b(prix\s+cassé|braderie|liquidation|destockage|d[ée]stockage)\b/i,
        /\b(prix\s+n[ée]gociable|négociable|negotiable)\b/i
      ],
      descPatterns: [
        /\b(prix\s+à\s+d[ée]finir|prix\s+à\s+convenir|prix\s+sur\s+demande)\b/i,
        /\b(faites?\s+(moi\s+)?une?\s+offre)\b/i,
        /\b(prix\s+de\s+d[ée]part|starting\s+price)\b/i,
        /\b(n'h[ée]site[z]?\s+pas\s+[àa]\s+(proposer|faire\s+offre))\b/i,
        /\b(envoye[rz]?\s+(vos?\s+)?offre[s]?)\b/i,
        /\b(je\s+(ne\s+)?sais?\s+pas\s+(combien|quel\s+prix))\b/i
      ],
      type: "symbolic_price",
      shouldSignal: false,
      shouldOverlay: true,
      overlayMessage: "Prix symbolique / à débattre — prix non fiable"
    },
    // ── TEST / SPAM ──
    test_spam: {
      titlePatterns: [
        /\b(test\s+annonce|annonce\s+test|essai\s+annonce)\b/i,
        /\b(brouillon|draft|placeholder)\b/i,
        /^[a-z]{2,6}$/i,
        /^[\d\s.€]+$/,
        /^(.)\1{3,}$/
      ],
      descPatterns: [],
      type: "test_spam",
      shouldSignal: false,
      shouldOverlay: false,
      overlayMessage: ""
    },
    // ── PIÈCES DÉTACHÉES D'UN APPAREIL ──
    parts_from_device: {
      titlePatterns: [
        /\b(pi[eè]ces?\s+d[ée]tach[ée]e?s?\s+(pour|de|du|d'))\b/i,
        /\b(pour\s+pi[eè]ces?\s+d[ée]tach[ée]e?s?)\b/i,
        /\b(démontage|d[ée]mant[eè]lement|d[ée]sossage)\b/i
      ],
      descPatterns: [
        /\b(je\s+d[ée]monte|vend[s]?\s+les?\s+pi[eè]ces?\s+s[ée]par[ée]ment)\b/i,
        /\b(pi[eè]ces?\s+disponibles?\s*:\s*)/i
      ],
      type: "parts_from_device",
      shouldSignal: false,
      shouldOverlay: true,
      overlayMessage: "Pièces détachées — prix individuel incertain"
    },
    // ── VENDEUR PROFESSIONNEL ──
    professional: {
      titlePatterns: [],
      descPatterns: [
        /\b(professionnel|professional|entreprise|soci[ée]t[ée]|sarl|sas|eurl|auto[\s-]?entrepreneur)\b/i,
        /\b(garantie\s+(commerciale|magasin|boutique))\b/i,
        /\b(facture\s+tva|hors\s+taxe[s]?|ht\b|ttc\b)/i,
        /\b(stock\s+disponible|plusieurs?\s+disponible|quantit[ée]\s+disponible)\b/i,
        /\b(tarif\s+(pro|professionnel|entreprise|grossiste))\b/i,
        /\b(devis\s+sur\s+demande)\b/i
      ],
      type: "professional",
      shouldSignal: true,
      shouldOverlay: true,
      overlayMessage: "Vendeur professionnel détecté — prix potentiellement différent du marché C2C"
    }
  };
  const SYMBOLIC_PRICE_THRESHOLDS = {
    gpu: 15,
    cpu: 10,
    ram: 5,
    ssd: 5,
    default: 5
  };
  function isSymbolicPrice(price, componentCategory) {
    if (price <= 1) return true;
    const threshold = componentCategory ? SYMBOLIC_PRICE_THRESHOLDS[componentCategory] || SYMBOLIC_PRICE_THRESHOLDS.default : SYMBOLIC_PRICE_THRESHOLDS.default;
    return price <= threshold;
  }
  function classifyIntent(title, price, description, componentCategory) {
    const normalizedTitle = (title || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const normalizedDesc = (description || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").slice(0, 2e3);
    let bestMatch = null;
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
              quantity
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
                quantity: 1
              };
            }
            break;
          }
        }
      }
    }
    // Fix 1: Reject "wanted" from desc if sale-context patterns are present
    if (bestMatch && bestMatch.type === "wanted" && bestMatch.confidence < 0.85) {
      const saleContextPatterns = [
        /facture\s+d'?achat/, /date\s+d'?achat/, /test\s+(?:possible\s+)?avant\s+achat/,
        /essai\s+(?:possible\s+)?avant\s+achat/, /prix\s+d'?achat/, /suite\s+a\s+(?:un\s+|l'?)achat/,
        /achat\s+(?:le\s+)?\d/, /achat\s+(?:en\s+)?\w+\s+\d{4}/, /achat\s+direct/,
        /preuve\s+d'?achat/, /ticket\s+d'?achat/
      ];
      if (saleContextPatterns.some(p => p.test(normalizedDesc))) {
        bestMatch = null;
      }
    }
    // Fix 2a: Price aberration (obvious typo > 20000€)
    if (price > 20000 && !normalizedTitle.includes('serveur') && !normalizedTitle.includes('lot')
        && !normalizedDesc.includes('serveur') && !normalizedDesc.includes('lot')) {
      return {
        type: "sale",
        confidence: 0.3,
        flags: ['price_error_suspected'],
        quantity: 1,
        shouldSignal: false,
        shouldOverlay: true,
        overlayMessage: "Prix suspect — erreur de saisie probable"
      };
    }
    // Fix 2b: Price placeholder (0€ or 1€)
    if (price !== null && price <= 1 && (!bestMatch || bestMatch.type === "sale")) {
      bestMatch = {
        type: "symbolic_price",
        confidence: 0.85,
        flags: ['price_placeholder'],
        shouldSignal: false,
        shouldOverlay: true,
        overlayMessage: "Prix symbolique (1€) — prix réel non indiqué",
        quantity: 1
      };
    }
    // Fix 4: Exchange contra-patterns — reject trade if "pas d'échange"
    if (bestMatch && bestMatch.type === "trade") {
      if (/\bpas\s+d'?echange\b|\bn'?echange\s+pas\b|\baucun\s+echange\b/.test(normalizedDesc)) {
        bestMatch = null;
      }
    }
    if ((!bestMatch || bestMatch.type === "sale") && price !== null) {
      if (isSymbolicPrice(price, componentCategory)) {
        bestMatch = {
          type: "symbolic_price",
          confidence: 0.85,
          flags: [`price:symbolic:${price}€`],
          shouldSignal: false,
          shouldOverlay: true,
          overlayMessage: "Prix symbolique — négociation attendue",
          quantity: 1
        };
      }
    }
    if (bestMatch && bestMatch.type !== "sale") {
      return {
        type: bestMatch.type,
        confidence: bestMatch.confidence,
        flags: bestMatch.flags,
        quantity: bestMatch.quantity,
        shouldSignal: bestMatch.shouldSignal,
        shouldOverlay: bestMatch.shouldOverlay,
        overlayMessage: bestMatch.overlayMessage
      };
    }
    return {
      type: "sale",
      confidence: 0.5,
      flags: [],
      quantity: 1,
      shouldSignal: true,
      shouldOverlay: true
    };
  }
  const LBC_HARDWARE_CATEGORY_IDS = /* @__PURE__ */ new Set([
    15,
    16,
    17,
    44,
    2,
    3,
    4,
    5
  ]);
  const LBC_HARDWARE_CATEGORY_KEYWORDS = [
    "informatique",
    "ordinateur",
    "image",
    "son",
    "consoles",
    "jeux vid",
    "telephon",
    "téléphon",
    "multim",
    "accessoire",
    "composant",
    "peripherique",
    "périphérique",
    "photo",
    "video",
    "vidéo"
  ];
  function isHardwareCategory(listing) {
    if (listing.categoryId == null && listing.categoryName == null) return true;
    if (listing.categoryId != null && LBC_HARDWARE_CATEGORY_IDS.has(listing.categoryId)) return true;
    if (listing.categoryName) {
      const normalized = listing.categoryName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return LBC_HARDWARE_CATEGORY_KEYWORDS.some((kw) => normalized.includes(kw));
    }
    if (listing.categoryId != null) return false;
    return true;
  }
  const INTENT_ICONS = {
    sale: "✅",
    wanted: "🔎",
    trade: "🔄",
    box_only: "📦",
    broken: "⚠️",
    bundle: "🖥️",
    multiple: "📦",
    accessory: "🔧",
    symbolic_price: "💬",
    unknown: "❓",
    reserved: "🔒",
    rental: "🏠",
    mining: "⛏️",
    rma_refurb: "🔄",
    test_spam: "🚫",
    parts_from_device: "🔩",
    professional: "🏪"
  };

  function getIntentLabel(intentType) {
    const labels = {
      sale: "Vente standard",
      broken: "HS / pour pièces",
      bundle: "PC complet / bundle",
      box_only: "Boîte seule",
      trade: "Échange / troc",
      wanted: "Demande d'achat",
      mining: "Ex-minage",
      accessory: "Accessoire",
      symbolic_price: "Prix symbolique",
      reserved: "Réservé / vendu",
      rental: "Location",
      rma_refurb: "Reconditionné",
      multiple: "Lot",
      parts_from_device: "Pièces détachées",
      professional: "Vendeur pro",
      other: "Autre"
    };
    return labels[intentType] || intentType;
  }
  function renderConsensusBadge(consensus, variant = "filtered") {
    if (!consensus || consensus.total_voters <= 0) return "";
    let text = "";
    if (variant === "confirmation" && consensus.votes) {
      const voteDetails = Object.entries(consensus.votes).map(([type, count]) => `${getIntentLabel(type)} (${count})`).join(", ");
      text = `${consensus.total_voters} autre${consensus.total_voters > 1 ? "s" : ""} utilisateur${consensus.total_voters > 1 ? "s" : ""} pense${consensus.total_voters > 1 ? "nt" : ""} : ${voteDetails}`;
    } else if (consensus.has_consensus && consensus.consensus_intent) {
      if (consensus.consensus_intent === "sale") {
        text = `${consensus.total_voters} utilisateur${consensus.total_voters > 1 ? "s" : ""} confirme${consensus.total_voters > 1 ? "nt" : ""} : vente standard`;
      } else {
        text = `${consensus.total_voters} utilisateur${consensus.total_voters > 1 ? "s" : ""} confirme${consensus.total_voters > 1 ? "nt" : ""} : ${getIntentLabel(consensus.consensus_intent)}`;
      }
    } else {
      text = `${consensus.total_voters} vote${consensus.total_voters > 1 ? "s" : ""} communautaire${consensus.total_voters > 1 ? "s" : ""}`;
    }
    return `
    <div style="display:flex;align-items:center;gap:6px;margin:4px 0 8px;padding:6px 8px;background:#1a1a2e;border-radius:6px;border-left:2px solid #6366f1">
      <span style="font-size:12px">👥</span>
      <span style="font-size:11px;color:#94a3b8">${text}</span>
    </div>`;
  }
  const OVERLAY_ID = "monark-lens-overlay";
  let overlayHost = null;
  let shadowRoot = null;
  let overlayContainer = null;
  let isMinimized = false;
  let isQuickExpanded = false;
  let currentListingContext = null;
  function getOverlayStyles() {
    return `
    :host {
      all: initial;
      font-family: Inter, system-ui, -apple-system, sans-serif;
      position: fixed;
      top: 16px;
      right: 16px;
      z-index: 2147483647;
      pointer-events: none;
    }
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    .monark-overlay {
      pointer-events: auto;
      background: #1e1e2e;
      border: 1px solid rgba(99, 102, 241, 0.3);
      border-radius: 12px;
      padding: 0;
      min-width: 320px;
      max-width: 380px;
      color: #e2e8f0;
      font-size: 13px;
      line-height: 1.5;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(99, 102, 241, 0.1);
      opacity: 0;
      transform: translateY(-8px);
      animation: monark-fade-in 0.3s ease forwards;
      transition: all 0.2s ease;
    }

    @keyframes monark-fade-in {
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .monark-overlay.minimized {
      min-width: auto;
      padding: 8px 12px;
      cursor: pointer;
    }

    .monark-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid rgba(99, 102, 241, 0.15);
    }

    .monark-brand {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 600;
      font-size: 12px;
      color: #94a3b8;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }

    .monark-brand-icon {
      width: 16px;
      height: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .monark-score {
      font-size: 22px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }

    .monark-verdict {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 8px;
    }

    .monark-verdict-icon {
      font-size: 16px;
    }

    .monark-stats {
      display: flex;
      flex-direction: column;
      gap: 4px;
      color: #94a3b8;
      font-size: 12px;
      margin-bottom: 12px;
    }

    .monark-stat-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .monark-stat-value {
      color: #e2e8f0;
      font-weight: 500;
    }

    .monark-confidence {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .monark-confidence-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #334155;
    }

    .monark-confidence-dot.active {
      background: #6366f1;
    }

    .monark-divider {
      border: none;
      border-top: 1px solid rgba(148, 163, 184, 0.15);
      margin: 10px 0;
    }

    .monark-actions {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
    }

    .monark-btn {
      background: rgba(99, 102, 241, 0.15);
      color: #818cf8;
      border: 1px solid rgba(99, 102, 241, 0.3);
      border-radius: 6px;
      padding: 6px 12px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
      font-family: inherit;
    }

    .monark-btn:hover {
      background: rgba(99, 102, 241, 0.25);
      border-color: rgba(99, 102, 241, 0.5);
    }

    .monark-btn-estimate {
      background: rgba(16, 185, 129, 0.12);
      color: #10b981;
      border-color: rgba(16, 185, 129, 0.3);
    }

    .monark-btn-estimate:hover {
      background: rgba(16, 185, 129, 0.22);
      border-color: rgba(16, 185, 129, 0.5);
    }

    .monark-btn-close {
      background: none;
      border: none;
      color: #64748b;
      cursor: pointer;
      padding: 4px;
      font-size: 16px;
      line-height: 1;
      transition: color 0.15s;
      font-family: inherit;
    }

    .monark-btn-close:hover {
      color: #94a3b8;
    }

    .monark-credit-badge {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      background: rgba(16, 185, 129, 0.15);
      color: #10b981;
      border-radius: 4px;
      padding: 2px 6px;
      font-size: 11px;
      font-weight: 600;
      margin-left: 4px;
      animation: monark-fade-in 0.3s ease;
    }

    /* Quick analysis expanded section */
    .monark-quick {
      animation: monark-fade-in 0.3s ease;
    }

    .monark-quick-section {
      margin-top: 8px;
    }

    .monark-quick-title {
      font-size: 11px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
    }

    .monark-trend {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .monark-trend.positive { color: #10b981; }
    .monark-trend.negative { color: #ef4444; }

    .monark-price-range {
      display: flex;
      align-items: center;
      gap: 4px;
      margin: 6px 0;
    }

    .monark-price-bar {
      flex: 1;
      height: 6px;
      background: #334155;
      border-radius: 3px;
      position: relative;
      overflow: hidden;
    }

    .monark-price-fill {
      position: absolute;
      top: 0;
      left: 0;
      height: 100%;
      border-radius: 3px;
      transition: width 0.3s ease;
    }

    .monark-price-marker {
      position: absolute;
      top: -3px;
      width: 2px;
      height: 12px;
      background: #e2e8f0;
      border-radius: 1px;
    }

    .monark-insights {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-top: 8px;
    }

    .monark-insight {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      font-size: 12px;
      padding: 6px 8px;
      border-radius: 6px;
      background: rgba(30, 30, 46, 0.6);
    }

    .monark-insight.info { border-left: 2px solid #6366f1; }
    .monark-insight.warning { border-left: 2px solid #f59e0b; }
    .monark-insight.positive { border-left: 2px solid #10b981; }
    .monark-insight.negative { border-left: 2px solid #ef4444; }

    .monark-insight-icon {
      flex-shrink: 0;
      font-size: 12px;
    }

    .monark-loading {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      color: #64748b;
    }

    .monark-spinner {
      width: 20px;
      height: 20px;
      border: 2px solid #334155;
      border-top-color: #6366f1;
      border-radius: 50%;
      animation: monark-spin 0.8s linear infinite;
      margin-right: 8px;
    }

    @keyframes monark-spin {
      to { transform: rotate(360deg); }
    }

    .monark-minimized-content {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .monark-error {
      color: #f87171;
      font-size: 12px;
      padding: 8px;
      text-align: center;
    }

    /* === TABS === */
    .monark-tabs {
      display: flex;
      border-bottom: 1px solid rgba(99, 102, 241, 0.15);
      background: #1e1e2e;
      padding: 0;
    }
    .monark-tab {
      flex: 1;
      padding: 10px 0;
      text-align: center;
      font-size: 11px;
      font-weight: 600;
      color: #64748b;
      cursor: pointer;
      border: none;
      border-bottom: 2px solid transparent;
      background: none;
      transition: all 0.2s;
      font-family: inherit;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
    }
    .monark-tab.active {
      color: #6366f1;
      border-bottom-color: #6366f1;
    }
    .monark-tab:hover:not(.active) { color: #94a3b8; }
    .monark-tab-locked {
      opacity: 0.4;
      cursor: not-allowed !important;
      pointer-events: none;
    }
    .monark-tab-locked.unlocked {
      opacity: 1;
      cursor: pointer !important;
      pointer-events: auto;
    }

    /* === TAB CONTENT === */
    .monark-tab-content {
      padding: 12px 16px;
      max-height: 400px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .monark-tab-content::-webkit-scrollbar { width: 4px; }
    .monark-tab-content::-webkit-scrollbar-track { background: transparent; }
    .monark-tab-content::-webkit-scrollbar-thumb { background: #334155; border-radius: 2px; }

    /* === CARDS === */
    .monark-card {
      background: #2a2a3e;
      border-radius: 10px;
      border: 1px solid rgba(99, 102, 241, 0.15);
      overflow: hidden;
    }
    .monark-card-header {
      padding: 8px 12px;
      font-size: 10px;
      font-weight: 700;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1px solid rgba(99, 102, 241, 0.1);
    }
    .monark-detail-row {
      padding: 8px 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid rgba(99, 102, 241, 0.08);
    }
    .monark-detail-row:last-child { border-bottom: none; }
    .monark-detail-label { font-size: 11px; color: #94a3b8; }
    .monark-detail-value { font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums; }

    /* === STATS GRID === */
    .monark-stats-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .monark-stat-card {
      background: #2a2a3e;
      border-radius: 10px;
      padding: 10px;
      border: 1px solid rgba(99, 102, 241, 0.15);
      text-align: center;
    }
    .monark-stat-card-label {
      font-size: 9px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      font-weight: 700;
      margin-bottom: 4px;
    }
    .monark-stat-card-value {
      font-size: 16px;
      font-weight: 800;
      font-variant-numeric: tabular-nums;
    }
    .monark-stat-card-sub {
      font-size: 10px;
      color: #64748b;
      margin-top: 2px;
    }

    /* === COMPONENT ROWS (bundles) === */
    .monark-comp-row {
      padding: 10px 12px;
      display: flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
      transition: background 0.15s;
      border-bottom: 1px solid rgba(99, 102, 241, 0.08);
    }
    .monark-comp-row:last-child { border-bottom: none; }
    .monark-comp-row:hover { background: rgba(99, 102, 241, 0.05); }
    .monark-comp-expanded {
      padding: 8px 12px 12px;
      border-top: 1px solid rgba(99, 102, 241, 0.1);
      display: none;
      flex-direction: column;
      gap: 6px;
    }
    .monark-comp-expanded.open { display: flex; }

    /* === TYPE BADGES === */
    .monark-type-badge {
      font-size: 9px;
      font-weight: 700;
      padding: 1px 5px;
      border-radius: 3px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .monark-type-gpu { background: rgba(239,68,68,0.12); color: #ef4444; border: 1px solid rgba(239,68,68,0.25); }
    .monark-type-cpu { background: rgba(59,130,246,0.12); color: #3b82f6; border: 1px solid rgba(59,130,246,0.25); }
    .monark-type-ram { background: rgba(167,139,250,0.12); color: #a78bfa; border: 1px solid rgba(167,139,250,0.25); }
    .monark-type-ssd { background: rgba(34,211,238,0.12); color: #22d3ee; border: 1px solid rgba(34,211,238,0.25); }
    .monark-type-default { background: rgba(148,163,184,0.12); color: #94a3b8; border: 1px solid rgba(148,163,184,0.25); }

    /* === TOTAL CARD === */
    .monark-total-card {
      background: linear-gradient(135deg, rgba(99,102,241,0.08), rgba(99,102,241,0.03));
      border: 1px solid rgba(99,102,241,0.25);
      border-radius: 10px;
      padding: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    /* === INSIGHT TAGS === */
    .monark-insight-tag {
      font-size: 10px;
      padding: 3px 8px;
      border-radius: 6px;
      font-weight: 600;
      display: inline-block;
    }
    .monark-insight-positive { background: rgba(16,185,129,0.1); color: #10b981; border: 1px solid rgba(16,185,129,0.2); }
    .monark-insight-warning { background: rgba(245,158,11,0.1); color: #f59e0b; border: 1px solid rgba(245,158,11,0.2); }
    .monark-insight-negative { background: rgba(239,68,68,0.1); color: #ef4444; border: 1px solid rgba(239,68,68,0.2); }

    /* === ACTION BUTTONS === */
    .monark-btn-action {
      width: 100%;
      padding: 10px 16px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      font-family: inherit;
      transition: opacity 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    .monark-btn-action:hover { opacity: 0.9; }
    .monark-btn-action-primary {
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      border: none;
      color: #fff;
    }
    .monark-btn-action-secondary {
      background: rgba(99,102,241,0.1);
      border: 1px solid rgba(99,102,241,0.3);
      color: #6366f1;
    }
    .monark-btn-action-ghost {
      background: none;
      border: 1px solid rgba(99,102,241,0.2);
      color: #94a3b8;
      padding: 6px 10px;
      font-size: 11px;
    }

    /* === CREDITS BAR === */
    .monark-credits-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #2a2a3e;
      border-radius: 8px;
      padding: 6px 10px;
      margin: 8px 16px 0;
    }

    /* === MISSIONS === */
    .monark-missions-toggle {
      width: calc(100% - 32px);
      margin: 6px 16px 0;
      background: #2a2a3e;
      border: 1px solid rgba(99,102,241,0.15);
      border-radius: 8px;
      padding: 7px 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
      color: #e2e8f0;
      font-size: 11px;
      font-family: inherit;
    }
    .monark-mission-row {
      padding: 8px 12px;
      border-bottom: 1px solid rgba(99,102,241,0.08);
    }
    .monark-mission-row:last-child { border-bottom: none; }
    .monark-mission-progress {
      height: 4px;
      background: #334155;
      border-radius: 2px;
      flex: 1;
    }
    .monark-mission-fill {
      height: 100%;
      background: #6366f1;
      border-radius: 2px;
      transition: width 0.6s ease;
    }

    /* === FOOTER === */
    .monark-footer {
      padding: 8px 16px;
      border-top: 1px solid rgba(99, 102, 241, 0.15);
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 10px;
      color: #64748b;
    }
    .monark-status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #10b981;
      display: inline-block;
      margin-right: 4px;
    }
  `;
  }
  function createOverlay() {
    const existing = document.getElementById(OVERLAY_ID);
    if (existing) existing.remove();
    const host = document.createElement("div");
    host.id = OVERLAY_ID;
    const shadow = host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = getOverlayStyles();
    shadow.appendChild(style);
    const container = document.createElement("div");
    container.className = "monark-overlay";
    shadow.appendChild(container);
    document.body.appendChild(host);
    return { host, shadow, container };
  }
  function getVerdictIcon(verdict) {
    switch (verdict) {
      case "excellente_affaire":
        return "🔥";
      case "bonne_affaire":
        return "✅";
      case "prix_correct":
        return "➡️";
      case "au_dessus_marche":
        return "⚠️";
      case "trop_cher":
        return "🚫";
      default:
        return "❓";
    }
  }
  function renderConfidenceDots(confidence) {
    const filled = Math.round(confidence * 5);
    return Array.from(
      { length: 5 },
      (_, i) => `<span class="monark-confidence-dot ${i < filled ? "active" : ""}"></span>`
    ).join("");
  }
  function getInsightIcon(type) {
    switch (type) {
      case "info":
        return "ℹ️";
      case "warning":
        return "⚠️";
      case "positive":
        return "✅";
      case "negative":
        return "❌";
      default:
        return "•";
    }
  }
  function renderScoreRing(score, size) {
    size = size || 56;
    var r = (size - 8) / 2;
    var circ = 2 * Math.PI * r;
    var pct = Math.min(score, 10) / 10;
    var color = score >= 7 ? '#10b981' : score >= 5 ? '#f59e0b' : '#ef4444';
    return '<svg width="' + size + '" height="' + size + '" style="transform:rotate(-90deg)">' +
      '<circle cx="' + (size/2) + '" cy="' + (size/2) + '" r="' + r + '" fill="none" stroke="#334155" stroke-width="3.5"/>' +
      '<circle cx="' + (size/2) + '" cy="' + (size/2) + '" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="3.5"' +
      ' stroke-dasharray="' + circ + '" stroke-dashoffset="' + (circ * (1 - pct)) + '" stroke-linecap="round"' +
      ' style="transition:stroke-dashoffset 1s ease"/>' +
      '<text x="' + (size/2) + '" y="' + (size/2) + '" text-anchor="middle" dominant-baseline="central"' +
      ' fill="' + color + '" font-size="' + (size * 0.28) + '" font-weight="800"' +
      ' style="transform:rotate(90deg);transform-origin:center">' + score.toFixed(1) + '</text></svg>';
  }

  function renderTypeBadge(category) {
    var cat = (category || '').toLowerCase();
    var cls = ['gpu','cpu','ram','ssd'].includes(cat) ? 'monark-type-' + cat : 'monark-type-default';
    return '<span class="monark-type-badge ' + cls + '">' + cat.toUpperCase() + '</span>';
  }

  function renderInsightTags(listing) {
    var tags = [];
    var text = ((listing.title || '') + ' ' + (listing.description || '')).toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Helper : teste un pattern MAIS vérifie qu'il n'est pas nié
    function matchPositive(pattern, negations) {
      if (!pattern.test(text)) return false;
      if (negations) {
        for (var i = 0; i < negations.length; i++) {
          if (negations[i].test(text)) return false;
        }
      }
      return true;
    }

    // === POSITIF (vert) ===
    if (matchPositive(/garant|warranty|sous garant|encore garant|garantie constructeur|garantie restante/))
      tags.push({ label: 'Sous garantie', type: 'positive' });

    if (matchPositive(/facture|invoice|preuve d'achat|ticket de caisse|justificatif/,
      [/sans facture|pas de facture|perdu.*facture|facture non/]))
      tags.push({ label: 'Facture dispo', type: 'positive' });

    if (matchPositive(/boite d'origine|original box|emballage d'origine|carton d'origine|avec boite|boite complete|boite et accessoire/,
      [/sans boite|pas de boite|boite perdue|sans emballage/]))
      tags.push({ label: "Boîte d'origine", type: 'positive' });

    if (matchPositive(/jamais overclock|no overclock|stock settings|config d'origine|parametres d'usine/))
      tags.push({ label: 'Jamais overclocké', type: 'positive' });

    if (matchPositive(/undervolt|sous-voltage|tension reduite/))
      tags.push({ label: 'Undervolté', type: 'positive' });

    if (matchPositive(/peu utilis|rarement utilis|tres peu servi|quasi neuf|a peine utilis/,
      [/beaucoup utilis|souvent utilis|tres utilis/]))
      tags.push({ label: 'Peu utilisé', type: 'positive' });

    if (matchPositive(/upgrade|remplac|changement de config|passage en|migration vers|je passe sur/))
      tags.push({ label: 'Vendeur motivé', type: 'positive' });

    if (matchPositive(/negoci|a debattre|prix discutable|ouvert aux propositions|prix a voir/))
      tags.push({ label: 'Négociable', type: 'positive' });

    if (matchPositive(/urgent|depart|demenage|besoin de liquidite|vente rapide/,
      [/a (tres )?vite|merci.*vite|a bientot/]))
      tags.push({ label: 'Vente urgente', type: 'positive' });

    if (matchPositive(/avec accessoir|cable inclus|livr[ée] avec|accessoires fournis|kit complet|boite et accessoir/))
      tags.push({ label: 'Accessoires inclus', type: 'positive' });

    if (matchPositive(/nettoye|entretenu|pate thermique (refaite|change|neuve)|depoussiere|repaste/))
      tags.push({ label: 'Entretenu', type: 'positive' });

    if (matchPositive(/non[- ]fumeur|sans fumee|environnement sain/))
      tags.push({ label: 'Non-fumeur', type: 'positive' });

    if (matchPositive(/envoi possible|expedition|livraison possible|mondial relay|colissimo|chronopost/,
      [/pas d'envoi|pas de livraison|pas d'expedition|remise en main propre uniquement/]))
      tags.push({ label: 'Envoi possible', type: 'positive' });

    if (matchPositive(/etat neuf|comme neuf|parfait etat|excellent etat|mint condition|immacule/,
      [/hors service|defectueu|en panne|pour pieces|ne fonctionne/]))
      tags.push({ label: 'État impeccable', type: 'positive' });

    if (matchPositive(/test possible|test sur place|essai possible|a tester sur place|demonstration|possibilite de tester/))
      tags.push({ label: 'Test possible', type: 'positive' });

    if (matchPositive(/rma|remplac[ée] par le constructeur|retour sav|piece neuve|carte neuve/,
      [/hors service|defectueu|pour pieces/]))
      tags.push({ label: 'RMA / pièce neuve', type: 'positive' });

    // === ATTENTION (orange) ===
    if (matchPositive(/rayur|scratch|eraflu|marque d'usure|defaut cosmetique|legere trace/,
      [/aucune rayur|sans rayur|pas de rayur|aucun scratch/]))
      tags.push({ label: 'Défaut cosmétique', type: 'warning' });

    if (matchPositive(/bruit|coil whine|ventilateur bruyant|bruit de bobine|sifflement/,
      [/aucun bruit|pas de bruit|silencieu/]))
      tags.push({ label: 'Bruit signalé', type: 'warning' });

    if (matchPositive(/chauffe|surchauffe|temperature elevee|throttle|thermal throttl/,
      [/ne chauffe pas|pas de surchauffe|temperature normale/]))
      tags.push({ label: 'Chauffe signalée', type: 'warning' });

    if (matchPositive(/sans garantie|plus de garantie|garantie expiree|hors garantie|no warranty/))
      tags.push({ label: 'Sans garantie', type: 'warning' });

    if (matchPositive(/sans boite|pas de boite|sans emballage|sans carton|boite perdue/,
      [/avec boite|boite d'origine|boite complete|boite et/]))
      tags.push({ label: 'Sans boîte', type: 'warning' });

    if (matchPositive(/sans facture|pas de facture|perdu.*facture|facture non disponible/))
      tags.push({ label: 'Sans facture', type: 'warning' });

    if (matchPositive(/overclock|surcadenc/,
      [/jamais overclock|no overclock|pas overclock|pas ete overclock/]))
      tags.push({ label: 'A été overclocké', type: 'warning' });

    if (matchPositive(/repar[ée]|fix[ée]|ressoud[ée]/,
      [/jamais repar|pas repar|aucune reparation/]))
      tags.push({ label: 'Réparation passée', type: 'warning' });

    if (matchPositive(/pas d'envoi|pas de livraison|pas d'expedition|remise en main propre uniquement|en main propre seulement/))
      tags.push({ label: "Pas d'envoi", type: 'warning' });

    if (matchPositive(/bios modifi|flash[ée]|bios custom|vbios|modded/))
      tags.push({ label: 'BIOS modifié', type: 'warning' });

    // === NÉGATIF (rouge) ===
    if (matchPositive(/ex[- ]?mining|ex[- ]?minage|a servi (a |au |pour le? )?min(er|age|ing)|utilis[ée] pour (le )?min/,
      [/pas de minage|jamais mine|n'a pas servi (a |au |pour )?min|pas servi pour|jamais servi (a |au |pour )?min|pas mine|aucun minage/]))
      tags.push({ label: 'Ex-minage', type: 'negative' });

    if (matchPositive(/crash|instable|freeze|blue ?screen|bsod|plantage/,
      [/jamais crash|aucun crash|sans crash|pas de crash|aucun plantage|jamais plante/]))
      tags.push({ label: 'Instabilité signalée', type: 'negative' });

    if (matchPositive(/artefact|artifact|glitch|defaut d'affichage/,
      [/aucun artefact|sans artefact|pas d'artefact|zero artefact/]))
      tags.push({ label: 'Artefacts', type: 'negative' });

    // === INFOS (neutre) ===
    if (matchPositive(/pas d'[ée]change|aucun [ée]change|n'[ée]change pas/))
      tags.push({ label: "Pas d'échange", type: 'warning' });

    if (matchPositive(/uniquement\s+(du\s+)?gaming|juste\s+(du\s+)?jeu|que\s+(du\s+)?gaming/))
      tags.push({ label: 'Usage gaming', type: 'positive' });

    if (matchPositive(/suite\s+[àa]\s+(?:un\s+)?(?:achat|upgrade|passage)|car\s+(?:j'?ai|passage)\s.*(?:rtx|gtx|rx|\d{4})/))
      tags.push({ label: 'Vendu car upgrade', type: 'positive' });

    if (matchPositive(/12\s*v?\s*hpwr|12\+4\s*pin|16\s*pin/))
      tags.push({ label: 'Connecteur 12VHPWR', type: 'warning' });

    if (matchPositive(/backplate\b.*(?:cuivre|copper)|copper\s+backplate/))
      tags.push({ label: 'Backplate cuivre', type: 'positive' });

    return tags;
  }

  var _lastScoreArgs = null;
  let onFlagCallback = null;
  function showScoreOverlay(score, context, onFlag, consensus) {
    _lastScoreArgs = { score: score, context: context, onFlag: onFlag, consensus: consensus };
    onFlagCallback = onFlag || null;
    const { host, shadow, container } = createOverlay();
    overlayHost = host;
    shadowRoot = shadow;
    overlayContainer = container;
    isMinimized = false;
    isQuickExpanded = false;
    currentListingContext = context || null;
    const hasScore = score.score != null && score.verdict != null;
    const displayScore = hasScore ? score.score : 0;
    const scoreColor = hasScore ? getScoreColor(score.score) : '#64748b';
    const verdictColor = hasScore ? (VERDICT_COLORS[score.verdict] || '#94a3b8') : '#64748b';
    const gapSign = score.gap_direction === 'under' ? '-' : '+';
    const insights = currentListing ? renderInsightTags(currentListing) : [];

    container.innerHTML = `
    <div class="monark-header">
      <div class="monark-brand">
        <span class="monark-brand-icon">🔍</span>
        Monark Lens
      </div>
      ${hasScore ? renderScoreRing(displayScore, 40) : '<span style="color:#64748b;font-size:16px;font-weight:700">—</span>'}
    </div>

    ${hasScore ? `<div class="monark-credits-bar">
      <div style="display:flex;align-items:center;gap:4px">
        <span style="font-size:12px">💎</span>
        <span id="monark-credits-display" style="font-size:13px;font-weight:700;color:#6366f1"></span>
        <span style="font-size:10px;color:#64748b">crédits</span>
      </div>
      <div style="display:flex;align-items:center;gap:4px;background:rgba(16,185,129,0.1);padding:2px 6px;border-radius:10px">
        <span id="monark-session-credits" style="font-size:10px;color:#10b981;font-weight:600"></span>
      </div>
    </div>` : ''}

    <div class="monark-tabs">
      <button class="monark-tab active" data-tab="score">◎ Score</button>
      <button class="monark-tab monark-tab-locked" data-tab="analysis" disabled>🔒 Analyse</button>
    </div>

    <div id="monark-tab-score" class="monark-tab-content">
      ${hasScore ? `
      <div class="monark-verdict" style="color:${verdictColor};margin-bottom:2px">
        <span class="monark-verdict-icon">${getVerdictIcon(score.verdict)}</span>
        ${score.verdict_label}
      </div>

      ${context?.quantityNote ? '<div style="display:flex;align-items:center;gap:6px;padding:5px 10px;margin-bottom:6px;background:rgba(99,102,241,0.1);border-radius:8px;border-left:2px solid #6366f1"><span style="font-size:11px">📦</span><span style="font-size:11px;color:#a5b4fc;font-weight:600">' + context.quantityNote + '</span></div>' : ''}

      <div class="monark-card">
        <div class="monark-detail-row">
          <span class="monark-detail-label">Composant</span>
          <span class="monark-detail-value">${score.component_name || 'Inconnu'}${context?.variantName ? '<br><span style="font-size:10px;color:#94a3b8;font-weight:500">' + context.variantName + '</span>' : ''}</span>
        </div>
        <div class="monark-detail-row">
          <span class="monark-detail-label">Médiane marché</span>
          <span class="monark-detail-value" style="color:${score.gap_direction === 'under' ? '#10b981' : '#ef4444'}">
            ${score.market_median.toFixed(0)}€ (${gapSign}${Math.abs(score.gap_percent ?? 0).toFixed(1)}%)
          </span>
        </div>
        <div class="monark-detail-row">
          <span class="monark-detail-label">Confiance</span>
          <span class="monark-detail-value">
            ${renderConfidenceDots(score.confidence ?? 0)}
            <span style="color:#64748b;margin-left:4px">(${score.data_points_30d} obs.)</span>
          </span>
        </div>
        ${score.trend_30d != null ? '<div class="monark-detail-row"><span class="monark-detail-label">Tendance 30j</span><span class="monark-detail-value" style="color:' + (score.trend_30d >= 0 ? '#10b981' : '#ef4444') + '">' + (score.trend_30d >= 0 ? '↗ +' : '↘ ') + score.trend_30d.toFixed(1) + '%</span></div>' : ''}
        ${score.p25 != null && score.p75 != null ? '<div class="monark-detail-row"><span class="monark-detail-label">Fourchette</span><span class="monark-detail-value" style="color:#94a3b8">' + score.p25.toFixed(0) + '€ — ' + score.p75.toFixed(0) + '€</span></div>' : ''}
      </div>

      ${consensus && consensus.total_voters > 0 ? '<div style="display:flex;align-items:center;gap:6px;padding:6px 10px;background:#2a2a3e;border-radius:8px;border-left:2px solid #6366f1"><span style="font-size:11px">👥</span><span style="font-size:10px;color:#94a3b8">' + consensus.total_voters + ' vote' + (consensus.total_voters > 1 ? 's' : '') + ' communautaire' + (consensus.total_voters > 1 ? 's' : '') + '</span></div>' : ''}

      <div style="display:flex;flex-direction:column;gap:6px">
        <button class="monark-btn-action monark-btn-action-primary" id="monark-quick-btn">⚡ Analyse rapide — 5 crédits</button>
        <button class="monark-btn-action monark-btn-action-secondary" id="monark-estimate-btn">📊 Estimer sur Monark →</button>
        <div style="display:flex;gap:6px">
          <button class="monark-btn-action monark-btn-action-ghost" style="flex:1" id="monark-alert-btn">🔔 Alerte</button>
          <button class="monark-btn-action monark-btn-action-ghost" style="flex:1" id="monark-watchlist-btn">☆ Watchlist</button>
        </div>
      </div>

      ${insights.length > 0 ? '<div class="monark-card" style="padding:10px 12px"><div style="font-size:10px;font-weight:700;color:#94a3b8;margin-bottom:6px;display:flex;align-items:center;gap:4px"><span>📝</span> Insights description</div><div style="display:flex;flex-wrap:wrap;gap:4px">' + insights.map(function(t) { return '<span class="monark-insight-tag monark-insight-' + t.type + '">' + t.label + '</span>'; }).join('') + '</div></div>' : ''}
      ` : `
      <div style="text-align:center;padding:20px 0">
        <div style="font-size:12px;color:#94a3b8">${score.component_name || 'Composant'} · ${score.asking_price?.toFixed(0) || '?'}€</div>
        <div style="font-size:11px;color:#64748b;margin-top:8px">Pas assez de données marché</div>
        <button class="monark-btn-action monark-btn-action-secondary" id="monark-estimate-btn" style="margin-top:12px">📊 Estimer sur Monark →</button>
      </div>
      `}
    </div>

    <div id="monark-tab-analysis" class="monark-tab-content" style="display:none">
      <div id="monark-analysis-placeholder" style="text-align:center;padding:30px 0;color:#64748b">
        <div style="font-size:28px;margin-bottom:8px">📊</div>
        <div style="font-size:12px">Lancez l'analyse rapide pour voir les résultats détaillés</div>
      </div>
      <div id="monark-analysis-content" style="display:none"></div>
    </div>

    <div style="display:flex;gap:6px;justify-content:flex-end;padding:0 16px 8px">
      <button class="monark-btn-action monark-btn-action-ghost" id="monark-flag-btn">🚩 Signaler</button>
      <button class="monark-btn-action monark-btn-action-ghost" id="monark-close-btn">✕</button>
    </div>

    <div class="monark-footer">
      <span>Monark Lens v${EXTENSION_VERSION}</span>
      <span><span class="monark-status-dot"></span>Collecte active</span>
    </div>
  `;

    // Tab switching
    shadow.querySelectorAll('.monark-tab').forEach(function(tab) {
      tab.addEventListener('click', function() {
        if (this.classList.contains('monark-tab-locked')) return;
        var tabId = this.dataset.tab;
        shadow.querySelectorAll('.monark-tab').forEach(function(t) { t.classList.remove('active'); });
        this.classList.add('active');
        var scorePane = shadow.getElementById('monark-tab-score');
        var analysisPane = shadow.getElementById('monark-tab-analysis');
        if (scorePane) scorePane.style.display = tabId === 'score' ? 'flex' : 'none';
        if (analysisPane) analysisPane.style.display = tabId === 'analysis' ? 'flex' : 'none';
      });
    });

    // Credits display
    chrome.runtime.sendMessage({ type: 'GET_AUTH_STATE' }).then(function(auth) {
      var creditsEl = shadow.getElementById('monark-credits-display');
      var sessionEl = shadow.getElementById('monark-session-credits');
      if (creditsEl && auth) creditsEl.textContent = auth.unlimited ? '∞' : (auth.credits || 0);
      if (sessionEl && auth) sessionEl.textContent = '+' + (auth.sessionCredits || 0) + ' session';
    }).catch(function() {});

    // Event listeners
    shadow.getElementById('monark-close-btn')?.addEventListener('click', removeOverlay);
    shadow.getElementById('monark-quick-btn')?.addEventListener('click', function() {
      handleDeepAnalysis("quick");
    });
    shadow.getElementById('monark-estimate-btn')?.addEventListener('click', function() {
      window.open(buildEstimateUrl(score), '_blank');
    });
    shadow.getElementById('monark-flag-btn')?.addEventListener('click', function() {
      if (onFlagCallback) onFlagCallback(score.component_id, score.component_name || 'Inconnu', score.asking_price);
    });
    shadow.getElementById('monark-alert-btn')?.addEventListener('click', function() {
      var tabContent = shadowRoot.getElementById('monark-tab-score');
      if (!tabContent) return;

      var types = [
        { value: 'deal_detected', label: '🔥 Bonne affaire détectée', desc: 'Score ≥ 7/10 sur ce modèle' },
        { value: 'price_below', label: '📉 Prix sous mon seuil', desc: 'Quand le prix passe sous un seuil' },
        { value: 'new_listing', label: '🆕 Nouveau signal', desc: 'Nouveau signal reçu pour ce modèle' },
      ];

      tabContent.innerHTML =
        '<div style="display:flex;flex-direction:column;gap:8px;padding:8px 0">' +
          '<div style="font-size:13px;color:#e2e8f0;font-weight:600">Créer une alerte sur ce modèle :</div>' +
          '<div style="font-size:11px;color:#94a3b8">' + (score.component_name || 'Composant') + '</div>' +
          types.map(function(t) {
            return '<button data-alert-type="' + t.value + '" class="monark-alert-type-btn" style="display:block;width:100%;text-align:left;padding:12px 14px;background:#2a2a3e;border:1px solid rgba(99,102,241,0.15);border-radius:8px;color:#e2e8f0;font-size:12px;cursor:pointer;font-family:inherit;transition:all 0.15s;line-height:1.4">' +
              '<div style="font-weight:600">' + t.label + '</div>' +
              '<div style="font-size:10px;color:#64748b;margin-top:2px">' + t.desc + '</div>' +
            '</button>';
          }).join('') +
          '<button id="monark-alert-cancel" style="width:100%;padding:10px;background:none;border:1px solid rgba(99,102,241,0.2);border-radius:8px;color:#94a3b8;font-size:12px;cursor:pointer;font-family:inherit;margin-top:4px">← Retour</button>' +
        '</div>';

      // Hover effects
      tabContent.querySelectorAll('.monark-alert-type-btn').forEach(function(b) {
        b.addEventListener('mouseenter', function() { this.style.borderColor = 'rgba(99,102,241,0.4)'; this.style.background = 'rgba(99,102,241,0.1)'; });
        b.addEventListener('mouseleave', function() { this.style.borderColor = 'rgba(99,102,241,0.15)'; this.style.background = '#2a2a3e'; });
      });

      // Cancel = recréer l'overlay
      tabContent.querySelector('#monark-alert-cancel').addEventListener('click', function() {
        showScoreOverlay(_lastScoreArgs.score, _lastScoreArgs.context, _lastScoreArgs.onFlag, _lastScoreArgs.consensus);
      });

      // Clic sur un type
      tabContent.querySelectorAll('.monark-alert-type-btn').forEach(function(b) {
        b.addEventListener('click', function() {
          var alertType = this.dataset.alertType;
          var clickedBtn = this;

          // Désactiver tous les boutons
          tabContent.querySelectorAll('.monark-alert-type-btn').forEach(function(x) { x.disabled = true; x.style.opacity = '0.5'; });
          clickedBtn.style.opacity = '1';
          clickedBtn.innerHTML = '<div style="font-weight:600">⏳ Création en cours...</div>';

          var payload = {
            target_type: 'model',
            target_id: score.component_id,
            alert_type: alertType,
          };
          if (alertType === 'price_below' && score.market_median) {
            payload.price_threshold = Math.round(score.market_median * 0.85);
          }

          chrome.runtime.sendMessage({ type: 'CREATE_ALERT', payload: payload }).then(function(result) {
            if (result && !result.error) {
              clickedBtn.innerHTML = '<div style="font-weight:600;color:#10b981">✓ Alerte créée !</div>';
              setTimeout(function() {
                showScoreOverlay(_lastScoreArgs.score, _lastScoreArgs.context, _lastScoreArgs.onFlag, _lastScoreArgs.consensus);
                // Mettre à jour le bouton alerte
                var alertBtn = shadowRoot.getElementById('monark-alert-btn');
                if (alertBtn) {
                  alertBtn.textContent = '🔔 Alerte active';
                  alertBtn.style.color = '#10b981';
                  alertBtn.style.borderColor = 'rgba(16,185,129,0.4)';
                }
              }, 1200);
            } else {
              clickedBtn.innerHTML = '<div style="font-weight:600;color:#ef4444">✗ Erreur — ' + (result?.error || 'réessayez') + '</div>';
              setTimeout(function() {
                showScoreOverlay(_lastScoreArgs.score, _lastScoreArgs.context, _lastScoreArgs.onFlag, _lastScoreArgs.consensus);
              }, 2000);
            }
          }).catch(function() {
            clickedBtn.innerHTML = '<div style="font-weight:600;color:#ef4444">✗ Erreur réseau</div>';
            setTimeout(function() {
              showScoreOverlay(_lastScoreArgs.score, _lastScoreArgs.context, _lastScoreArgs.onFlag, _lastScoreArgs.consensus);
            }, 2000);
          });
        });
      });
    });
    shadow.getElementById('monark-watchlist-btn')?.addEventListener('click', function() {
      var btn = this;
      btn.disabled = true;
      btn.textContent = '☆ Ajout...';

      chrome.runtime.sendMessage({
        type: "ADD_WATCHLIST",
        payload: {
          target_type: "model",
          target_id: score.component_id,
        }
      }).then(function(result) {
        if (result?.error) {
          if (result.status === 409 || (result.error && result.error.includes('exist'))) {
            btn.textContent = '★ Déjà dans la watchlist';
            btn.style.color = '#6366f1';
            btn.style.borderColor = 'rgba(99,102,241,0.4)';
          } else {
            btn.textContent = '☆ Erreur';
            btn.style.color = '#ef4444';
            setTimeout(function() {
              btn.textContent = '☆ Watchlist';
              btn.style.color = '';
              btn.style.borderColor = '';
              btn.disabled = false;
            }, 2000);
          }
        } else {
          btn.textContent = '★ Ajouté ✓';
          btn.style.color = '#10b981';
          btn.style.borderColor = 'rgba(16,185,129,0.4)';
        }
      }).catch(function() {
        btn.textContent = '☆ Erreur';
        btn.style.color = '#ef4444';
        setTimeout(function() {
          btn.textContent = '☆ Watchlist';
          btn.style.color = '';
          btn.style.borderColor = '';
          btn.disabled = false;
        }, 2000);
      });
    });
  }
  function showConfirmationOverlay(componentName, componentId, price, intent, callbacks, consensus) {
    const { host, shadow, container } = createOverlay();
    overlayHost = host;
    shadowRoot = shadow;
    overlayContainer = container;
    isMinimized = false;
    const icon = INTENT_ICONS[intent.type] || "❓";
    const confirmLabels = {
      broken: "c'est HS / pour pièces",
      bundle: "c'est un PC complet",
      mining: "c'est du minage",
      box_only: "c'est la boîte seule",
      trade: "c'est un échange",
      wanted: "c'est une recherche",
      multiple: "c'est un lot",
      accessory: "c'est un accessoire",
      symbolic_price: "le prix n'est pas réel",
      reserved: "c'est réservé/vendu",
      rental: "c'est une location",
      rma_refurb: "c'est reconditionné",
      parts_from_device: "ce sont des pièces",
      professional: "c'est un vendeur pro"
    };
    container.innerHTML = `
    <div class="monark-header">
      <div class="monark-brand">
        <span class="monark-brand-icon">🔍</span>
        Monark Lens
      </div>
      <span style="font-size:18px">${icon}</span>
    </div>

    <div class="monark-tab-content">
      <div class="monark-verdict" style="color:#f59e0b;margin-bottom:2px">
        <span class="monark-verdict-icon">${icon}</span>
        Vérification nécessaire
      </div>

      <div class="monark-card">
        <div class="monark-detail-row">
          <span class="monark-detail-label">Composant</span>
          <span class="monark-detail-value">${componentName}</span>
        </div>
        ${price !== null ? `<div class="monark-detail-row">
          <span class="monark-detail-label">Prix</span>
          <span class="monark-detail-value">${price.toFixed(0)}€</span>
        </div>` : ''}
      </div>

      <div style="font-size:12px;color:#f59e0b;text-align:center;padding:4px 0">${intent.overlayMessage || 'Annonce spéciale détectée'}</div>
      <div style="font-size:11px;color:#94a3b8;text-align:center">Est-ce bien le cas ?</div>

      ${consensus && consensus.total_voters > 0 ? '<div style="display:flex;align-items:center;gap:6px;padding:6px 10px;background:#2a2a3e;border-radius:8px;border-left:2px solid #6366f1"><span style="font-size:11px">👥</span><span style="font-size:10px;color:#94a3b8">' + consensus.total_voters + ' autre' + (consensus.total_voters > 1 ? 's' : '') + ' ont voté</span></div>' : ''}

      <div style="display:flex;gap:8px">
        <button id="monark-confirm-yes" class="monark-btn-action monark-btn-action-primary" style="flex:1;background:linear-gradient(135deg,#f59e0b,#d97706)">
          ✓ Oui, ${confirmLabels[intent.type] || 'annonce spéciale'}
        </button>
        <button id="monark-confirm-no" class="monark-btn-action monark-btn-action-ghost" style="flex:1;border-color:rgba(16,185,129,0.4);color:#4ade80">
          ✗ Vente normale
        </button>
      </div>

      <div style="display:flex;gap:6px;justify-content:flex-end">
        <button class="monark-btn-action monark-btn-action-ghost" id="monark-close-btn">✕</button>
      </div>
    </div>

    <div class="monark-footer">
      <span>Monark Lens v${EXTENSION_VERSION}</span>
      <span><span class="monark-status-dot"></span>Collecte active</span>
    </div>
  `;
    shadow.getElementById("monark-confirm-yes")?.addEventListener("click", () => {
      callbacks.onConfirm(intent.type);
    });
    shadow.getElementById("monark-confirm-no")?.addEventListener("click", () => {
      callbacks.onOverride();
    });
    shadow.getElementById("monark-close-btn")?.addEventListener("click", removeOverlay);
  }
  function showFlagSelector(componentId, componentName, price, onFlagSelected, onCancel) {
    if (!overlayContainer || !shadowRoot) return;
    const flagOptions = [
      { type: "broken", icon: "⚠️", label: "Composant HS / pour pièces" },
      { type: "bundle", icon: "🖥️", label: "PC complet / bundle" },
      { type: "box_only", icon: "📦", label: "Boîte / emballage seul" },
      { type: "trade", icon: "🔄", label: "Échange / troc" },
      { type: "wanted", icon: "🔎", label: "Demande d'achat" },
      { type: "mining", icon: "⛏️", label: "Ex-minage" },
      { type: "accessory", icon: "🔧", label: "Accessoire uniquement" },
      { type: "symbolic_price", icon: "💬", label: "Prix symbolique / à négocier" },
      { type: "reserved", icon: "🔒", label: "Réservé / vendu" },
      { type: "multiple", icon: "📦", label: "Lot / quantité multiple" },
      { type: "rental", icon: "🏠", label: "Location" },
      { type: "rma_refurb", icon: "🔄", label: "Reconditionné / RMA" },
      { type: "professional", icon: "🏪", label: "Vendeur professionnel" },
      { type: "other", icon: "❓", label: "Autre anomalie" }
    ];
    overlayContainer.innerHTML = `
    <div class="monark-header">
      <div class="monark-brand">
        <span class="monark-brand-icon">🚩</span>
        Signaler cette annonce
      </div>
    </div>

    <div class="monark-tab-content">
      <div style="font-size:11px;color:#94a3b8;margin-bottom:4px">
        Quel est le problème avec cette annonce ?
      </div>

      <div id="monark-flag-list" style="display:flex;flex-direction:column;gap:4px;max-height:280px;overflow-y:auto;padding-right:4px">
        ${flagOptions.map((opt) => `
          <button class="monark-flag-option" data-type="${opt.type}" data-label="${opt.label}"
                  style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:#2a2a3e;border:1px solid #334155;border-radius:6px;color:#e2e8f0;cursor:pointer;font-size:11px;text-align:left;transition:border-color 0.2s,background 0.2s;font-family:inherit">
            <span style="flex-shrink:0">${opt.icon}</span>
            <span>${opt.label}</span>
          </button>
        `).join("")}
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center">
        <button id="monark-flag-cancel"
                style="font-size:11px;color:#64748b;background:none;border:none;cursor:pointer;padding:4px 0;font-family:inherit">
          ← Retour au score
        </button>
        <button class="monark-btn-action monark-btn-action-ghost" id="monark-close-btn">✕</button>
      </div>
    </div>
  `;
    shadowRoot.querySelectorAll(".monark-flag-option").forEach((btn) => {
      btn.addEventListener("mouseenter", () => {
        btn.style.borderColor = "#6366f1";
        btn.style.background = "#333352";
      });
      btn.addEventListener("mouseleave", () => {
        btn.style.borderColor = "#334155";
        btn.style.background = "#2a2a3e";
      });
    });
    shadowRoot.querySelectorAll(".monark-flag-option").forEach((btn) => {
      btn.addEventListener("click", () => {
        const type = btn.dataset.type;
        const label = btn.dataset.label;
        if (type) onFlagSelected(type, label || type);
      });
    });
    shadowRoot.getElementById("monark-flag-cancel")?.addEventListener("click", onCancel);
    shadowRoot.getElementById("monark-close-btn")?.addEventListener("click", removeOverlay);
  }
  const CONDITION_API_TO_ESTIMATOR = {
    "new": "neuf",
    "like_new": "comme-neuf",
    "good": "bon",
    "fair": "correct",
    "poor": "a-reparer"
  };
  function buildEstimateUrl(score) {
    const params = new URLSearchParams();
    params.set("component", String(score.component_id));
    params.set("model_name", score.component_name || "");
    params.set("price", String(Math.round(score.asking_price)));
    params.set("source", "lens");
    if (currentListingContext?.platform) {
      params.set("platform", currentListingContext.platform);
    }
    if (currentListingContext?.condition) {
      const estimatorCondition = CONDITION_API_TO_ESTIMATOR[currentListingContext.condition] || currentListingContext.condition;
      params.set("condition", estimatorCondition);
    }
    if (currentListingContext?.category) {
      params.set("category", currentListingContext.category);
    }
    return `${MONARK_WEB_URL}/estimator?${params.toString()}`;
  }
  async function requestQuickAnalysis(componentId, price) {
    if (!shadowRoot) return;
    var quickBtn = shadowRoot.getElementById('monark-quick-btn');
    var analysisPlaceholder = shadowRoot.getElementById('monark-analysis-placeholder');
    if (quickBtn) {
      quickBtn.disabled = true;
      quickBtn.textContent = '⏳ Analyse en cours...';
      quickBtn.style.opacity = '0.6';
    }
    try {
      const authState = await chrome.runtime.sendMessage({ type: "GET_AUTH_STATE" });
      if (!authState?.isLoggedIn) {
        if (quickBtn) { quickBtn.textContent = '⚡ Analyse rapide — 5 crédits'; quickBtn.disabled = false; quickBtn.style.opacity = '1'; }
        if (analysisPlaceholder) analysisPlaceholder.innerHTML = '<div style="font-size:12px;color:#ef4444;text-align:center;padding:20px 0">Connectez-vous dans l\'extension pour l\'analyse complète</div>';
        return;
      }
      if (!authState.unlimited && authState.credits < 5) {
        if (quickBtn) { quickBtn.textContent = '⚡ Analyse rapide — 5 crédits'; quickBtn.disabled = false; quickBtn.style.opacity = '1'; }
        if (analysisPlaceholder) analysisPlaceholder.innerHTML = '<div style="font-size:12px;color:#ef4444;text-align:center;padding:20px 0">Crédits insuffisants (' + authState.credits + ' / 5 requis)</div>';
        return;
      }
      const result = await chrome.runtime.sendMessage({
        type: "GET_QUICK",
        componentId,
        price
      });
      if (result.error) {
        throw new Error(result.error);
      }
      renderQuickAnalysis(result);
      isQuickExpanded = true;
    } catch (err) {
      if (quickBtn) { quickBtn.textContent = '⚡ Analyse rapide — 5 crédits'; quickBtn.disabled = false; quickBtn.style.opacity = '1'; }
      if (analysisPlaceholder) analysisPlaceholder.innerHTML = '<div style="font-size:12px;color:#ef4444;text-align:center;padding:20px 0">Erreur: ' + (err.message || "Impossible de charger l'analyse") + '</div>';
    }
  }
  function renderQuickAnalysis(data) {
    if (!shadowRoot) return;
    const md = data.market_data;
    const trend = md.trend_30d ?? 0;
    const liquidity = md.liquidity_score ?? 0;
    const pr = md.price_range ?? { p10: 0, p25: 0, p50: 0, p75: 0, p90: 0 };
    const p10 = pr.p10 ?? 0;
    const p25 = pr.p25 ?? 0;
    const p50 = pr.p50 ?? 0;
    const p75 = pr.p75 ?? 0;
    const p90 = pr.p90 ?? 0;

    var gapColor = (data.market_data?.gap_percent || 0) > 0 ? '#ef4444' : '#10b981';
    var trendColor = trend >= 0 ? '#10b981' : '#ef4444';

    // Remplir l'onglet Analyse
    var analysisContent = shadowRoot.getElementById('monark-analysis-content');
    var analysisPlaceholder = shadowRoot.getElementById('monark-analysis-placeholder');
    if (analysisPlaceholder) analysisPlaceholder.style.display = 'none';
    if (analysisContent) {
      analysisContent.style.display = 'flex';
      analysisContent.style.flexDirection = 'column';
      analysisContent.style.gap = '10px';

      analysisContent.innerHTML =
        '<div class="monark-stats-grid">' +
          '<div class="monark-stat-card"><div class="monark-stat-card-label">Écart marché</div><div class="monark-stat-card-value" style="color:' + gapColor + '">' + ((data.market_data?.gap_percent || 0) > 0 ? '+' : '') + (data.market_data?.gap_percent || 0).toFixed(1) + '%</div><div class="monark-stat-card-sub">' + ((data.market_data?.gap_percent || 0) > 0 ? 'surévalué' : 'sous-évalué') + '</div></div>' +
          '<div class="monark-stat-card"><div class="monark-stat-card-label">Tendance 30j</div><div class="monark-stat-card-value" style="color:' + trendColor + '">' + (trend >= 0 ? '+' : '') + trend.toFixed(1) + '%</div><div class="monark-stat-card-sub">' + (trend >= 0 ? 'hausse' : 'baisse') + '</div></div>' +
          '<div class="monark-stat-card"><div class="monark-stat-card-label">Volume</div><div class="monark-stat-card-value" style="color:#6366f1">' + (md.volume_30d || 0) + '</div><div class="monark-stat-card-sub">ventes 30j</div></div>' +
          '<div class="monark-stat-card"><div class="monark-stat-card-label">Liquidité</div><div class="monark-stat-card-value" style="color:#6366f1">' + (liquidity * 10).toFixed(1) + '/10</div><div class="monark-stat-card-sub">' + (liquidity >= 0.7 ? 'facile' : liquidity >= 0.4 ? 'moyen' : 'difficile') + '</div></div>' +
        '</div>' +
        '<div class="monark-card"><div class="monark-card-header">Détails du marché</div>' +
          '<div class="monark-detail-row"><span class="monark-detail-label">Médiane 30j</span><span class="monark-detail-value">' + p50.toFixed(0) + '€</span></div>' +
          '<div class="monark-detail-row"><span class="monark-detail-label">Prix annonce</span><span class="monark-detail-value">' + md.asking_price.toFixed(0) + '€</span></div>' +
          '<div class="monark-detail-row"><span class="monark-detail-label">Écart</span><span class="monark-detail-value" style="color:' + gapColor + '">' + ((data.market_data?.gap_percent || 0) > 0 ? '+' : '') + (data.market_data?.gap_percent || 0).toFixed(1) + '%</span></div>' +
          '<div class="monark-detail-row"><span class="monark-detail-label">P25 — P75</span><span class="monark-detail-value">' + p25.toFixed(0) + '€ — ' + p75.toFixed(0) + '€</span></div>' +
          '<div class="monark-detail-row"><span class="monark-detail-label">P10 — P90</span><span class="monark-detail-value">' + p10.toFixed(0) + '€ — ' + p90.toFixed(0) + '€</span></div>' +
        '</div>' +
        (data.insights && data.insights.length > 0 ?
          '<div class="monark-card"><div class="monark-card-header">Insights</div>' +
          data.insights.map(function(i) {
            return '<div class="monark-insight ' + i.type + '"><span class="monark-insight-icon">' + getInsightIcon(i.type) + '</span><span>' + i.message + '</span></div>';
          }).join('') +
          '</div>' : '');
    }

    // Marquer le bouton comme terminé
    var quickBtn = shadowRoot.getElementById('monark-quick-btn');
    if (quickBtn) {
      quickBtn.textContent = '✓ Analyse terminée';
      quickBtn.disabled = true;
      quickBtn.style.opacity = '0.6';
      quickBtn.style.cursor = 'default';
    }

    // Débloquer l'onglet Analyse
    var lockedTab = shadowRoot.querySelector('.monark-tab-locked');
    if (lockedTab) {
      lockedTab.classList.add('unlocked');
      lockedTab.classList.remove('monark-tab-locked');
      lockedTab.disabled = false;
      lockedTab.innerHTML = '📊 Analyse';
      lockedTab.addEventListener('click', function() {
        shadowRoot.querySelectorAll('.monark-tab').forEach(function(t) { t.classList.remove('active'); });
        lockedTab.classList.add('active');
        var scorePane = shadowRoot.getElementById('monark-tab-score');
        var analysisPane = shadowRoot.getElementById('monark-tab-analysis');
        if (scorePane) scorePane.style.display = 'none';
        if (analysisPane) analysisPane.style.display = 'flex';
      });
    }
  }
  async function handleDeepAnalysis(level) {
    if (!shadowRoot || !currentAdHash) return;
    var quickBtn = shadowRoot.getElementById('monark-quick-btn');
    var analysisPlaceholder = shadowRoot.getElementById('monark-analysis-placeholder');
    if (quickBtn) {
      quickBtn.disabled = true;
      quickBtn.textContent = '⏳ Analyse en cours...';
      quickBtn.style.opacity = '0.6';
    }
    try {
      const result = await chrome.runtime.sendMessage({
        type: "DEEP_ANALYZE",
        payload: { ad_hash: currentAdHash, analysis_level: level }
      });
      if (result.error) {
        if (result.error.includes('402') || result.error.toLowerCase().includes('insufficient') || result.error.toLowerCase().includes('crédit')) {
          if (quickBtn) { quickBtn.textContent = '⚡ Analyse rapide — 5 crédits'; quickBtn.disabled = false; quickBtn.style.opacity = '1'; }
          if (analysisPlaceholder) analysisPlaceholder.innerHTML = '<div style="font-size:12px;color:#ef4444;text-align:center;padding:20px 0">Crédits insuffisants</div>';
          return;
        }
        throw new Error(result.error);
      }
      updateAnalysisTab(result, level);
      // Update credits display
      if (result.credits_remaining !== undefined) {
        currentCreditsRemaining = result.credits_remaining;
        var creditsEl = shadowRoot.getElementById('monark-credits-display');
        if (creditsEl) creditsEl.textContent = result.credits_remaining;
      }
      // Mark button as done
      if (quickBtn) {
        quickBtn.textContent = '✓ Analyse terminée';
        quickBtn.disabled = true;
        quickBtn.style.opacity = '0.6';
        quickBtn.style.cursor = 'default';
      }
      // Unlock and switch to analysis tab
      var lockedTab = shadowRoot.querySelector('.monark-tab-locked');
      if (lockedTab) {
        lockedTab.classList.add('unlocked');
        lockedTab.classList.remove('monark-tab-locked');
        lockedTab.disabled = false;
        lockedTab.innerHTML = '📊 Analyse';
      }
      // Auto-switch to analysis tab
      shadowRoot.querySelectorAll('.monark-tab').forEach(function(t) { t.classList.remove('active'); });
      var analysisTab = shadowRoot.querySelector('[data-tab="analysis"]');
      if (analysisTab) analysisTab.classList.add('active');
      var scorePane = shadowRoot.getElementById('monark-tab-score');
      var analysisPane = shadowRoot.getElementById('monark-tab-analysis');
      if (scorePane) scorePane.style.display = 'none';
      if (analysisPane) analysisPane.style.display = 'flex';
      isQuickExpanded = true;
    } catch (err) {
      console.error("[Monark] Deep analysis error:", err);
      if (quickBtn) { quickBtn.textContent = '⚡ Analyse rapide — 5 crédits'; quickBtn.disabled = false; quickBtn.style.opacity = '1'; }
      if (analysisPlaceholder) analysisPlaceholder.innerHTML = '<div style="font-size:12px;color:#ef4444;text-align:center;padding:20px 0">Erreur: ' + (err.message || "Impossible de charger l'analyse") + '</div>';
    }
  }
  function updateAnalysisTab(deepResponse, level) {
    if (!shadowRoot) return;
    var analysisContent = shadowRoot.getElementById('monark-analysis-content');
    var analysisPlaceholder = shadowRoot.getElementById('monark-analysis-placeholder');
    if (analysisPlaceholder) analysisPlaceholder.style.display = 'none';
    if (!analysisContent) return;
    analysisContent.style.display = 'flex';
    analysisContent.style.flexDirection = 'column';
    analysisContent.style.gap = '10px';

    var ps = deepResponse.primary_score;
    var ba = deepResponse.bundle_analysis;
    var qa = deepResponse.quantity_analysis;
    var insights = deepResponse.insights || [];
    var html = '';

    // Primary score stats
    if (ps) {
      var pvm = ps.price_vs_market || 0;
      var gapColor = pvm > 0 ? '#ef4444' : '#10b981';
      var trend = ps.trend_30d ?? 0;
      var trendColor = trend >= 0 ? '#10b981' : '#ef4444';
      var liquidity = ps.liquidity ?? 0;
      var p25 = ps.p25_price ?? 0;
      var p75 = ps.p75_price ?? 0;
      var median = ps.market_median ?? 0;

      html += '<div class="monark-stats-grid">' +
        '<div class="monark-stat-card"><div class="monark-stat-card-label">Écart marché</div><div class="monark-stat-card-value" style="color:' + gapColor + '">' + (pvm > 0 ? '+' : '') + pvm.toFixed(1) + '%</div><div class="monark-stat-card-sub">' + (pvm > 0 ? 'surévalué' : 'sous-évalué') + '</div></div>' +
        '<div class="monark-stat-card"><div class="monark-stat-card-label">Tendance 30j</div><div class="monark-stat-card-value" style="color:' + trendColor + '">' + (trend >= 0 ? '+' : '') + trend.toFixed(1) + '%</div><div class="monark-stat-card-sub">' + (trend >= 0 ? 'hausse' : 'baisse') + '</div></div>' +
        '<div class="monark-stat-card"><div class="monark-stat-card-label">Données</div><div class="monark-stat-card-value" style="color:#6366f1">' + (ps.data_points || 0) + '</div><div class="monark-stat-card-sub">observations</div></div>' +
        '<div class="monark-stat-card"><div class="monark-stat-card-label">Liquidité</div><div class="monark-stat-card-value" style="color:#6366f1">' + (liquidity * 10).toFixed(1) + '/10</div><div class="monark-stat-card-sub">' + (liquidity >= 0.7 ? 'facile' : liquidity >= 0.4 ? 'moyen' : 'difficile') + '</div></div>' +
      '</div>';

      html += '<div class="monark-card"><div class="monark-card-header">Détails du marché</div>' +
        '<div class="monark-detail-row"><span class="monark-detail-label">Médiane 30j</span><span class="monark-detail-value">' + median.toFixed(0) + '€</span></div>' +
        '<div class="monark-detail-row"><span class="monark-detail-label">P25 — P75</span><span class="monark-detail-value">' + p25.toFixed(0) + '€ — ' + p75.toFixed(0) + '€</span></div>' +
        '<div class="monark-detail-row"><span class="monark-detail-label">Écart</span><span class="monark-detail-value" style="color:' + gapColor + '">' + (pvm > 0 ? '+' : '') + pvm.toFixed(1) + '%</span></div>' +
        (ps.negotiation_margin ? '<div class="monark-detail-row"><span class="monark-detail-label">Marge négo</span><span class="monark-detail-value" style="color:#f59e0b">' + ps.negotiation_margin + '</span></div>' : '') +
        '<div class="monark-detail-row"><span class="monark-detail-label">Verdict</span><span class="monark-detail-value">' + (ps.verdict || '—') + '</span></div>' +
      '</div>';
    }

    // Bundle analysis
    if (ba) {
      var bvColor = ba.value_difference_percent >= 0 ? '#10b981' : '#ef4444';
      html += '<div class="monark-card"><div class="monark-card-header">Analyse bundle (' + ba.components_found + ' composants)</div>' +
        '<div class="monark-detail-row"><span class="monark-detail-label">Valeur estimée</span><span class="monark-detail-value">' + ba.total_estimated_value.toFixed(0) + '€</span></div>' +
        '<div class="monark-detail-row"><span class="monark-detail-label">Différence</span><span class="monark-detail-value" style="color:' + bvColor + '">' + (ba.value_difference_percent >= 0 ? '+' : '') + ba.value_difference_percent.toFixed(1) + '%</span></div>' +
        '<div class="monark-detail-row"><span class="monark-detail-label">Verdict</span><span class="monark-detail-value">' + ba.verdict + '</span></div>';
      ba.components.forEach(function(c) {
        html += '<div class="monark-detail-row"><span class="monark-detail-label" style="font-size:10px">' + c.component_name + '</span><span class="monark-detail-value" style="font-size:10px">' + (c.market_median ? c.market_median.toFixed(0) + '€' : '?') + ' (' + c.data_points + ' obs.)</span></div>';
      });
      html += '</div>';
    }

    // Quantity analysis
    if (qa) {
      html += '<div class="monark-card"><div class="monark-card-header">Lot de ' + qa.quantity + '</div>' +
        '<div class="monark-detail-row"><span class="monark-detail-label">Prix unitaire</span><span class="monark-detail-value">' + qa.unit_price.toFixed(0) + '€</span></div>';
      if (qa.unit_score) {
        html += '<div class="monark-detail-row"><span class="monark-detail-label">Médiane unit.</span><span class="monark-detail-value">' + (qa.unit_score.market_median ? qa.unit_score.market_median.toFixed(0) + '€' : '?') + '</span></div>';
        html += '<div class="monark-detail-row"><span class="monark-detail-label">Verdict unit.</span><span class="monark-detail-value">' + (qa.unit_score.verdict || '—') + '</span></div>';
      }
      html += '</div>';
    }

    // Insights
    if (insights.length > 0) {
      html += '<div class="monark-card"><div class="monark-card-header">Insights</div>' +
        insights.map(function(i) {
          return '<div class="monark-insight ' + i.type + '"><span class="monark-insight-icon">' + getInsightIcon(i.type) + '</span><span>' + i.text + '</span></div>';
        }).join('') +
      '</div>';
    }

    // Credits used
    html += '<div style="text-align:center;padding:4px 0;font-size:10px;color:#64748b">' + (deepResponse.credits_used || 0) + ' crédit' + ((deepResponse.credits_used || 0) > 1 ? 's' : '') + ' utilisé' + ((deepResponse.credits_used || 0) > 1 ? 's' : '') + '</div>';

    analysisContent.innerHTML = html;
  }
  function showCreditBadge(credits) {
    if (!shadowRoot || !overlayContainer) return;
    const badge = document.createElement("span");
    badge.className = "monark-credit-badge";
    badge.textContent = `+${credits} cr`;
    const header = overlayContainer.querySelector(".monark-header");
    if (header) {
      header.appendChild(badge);
      setTimeout(() => badge.remove(), 4e3);
    }
  }
  function showFilteredOverlay(componentName, componentId, price, intent, consensus) {
    const { host, shadow, container } = createOverlay();
    overlayHost = host;
    shadowRoot = shadow;
    overlayContainer = container;
    isMinimized = false;
    const icon = INTENT_ICONS[intent.type] || "❓";
    const showEstimateBtn = ["broken", "bundle", "symbolic_price", "multiple"].includes(intent.type);
    container.innerHTML = `
    <div class="monark-header">
      <div class="monark-brand">
        <span class="monark-brand-icon">🔍</span>
        Monark Lens
      </div>
      <span style="font-size:18px">${icon}</span>
    </div>

    <div class="monark-tab-content">
      <div class="monark-verdict" style="color:#f59e0b;margin-bottom:2px">
        <span class="monark-verdict-icon">${icon}</span>
        Annonce filtrée
      </div>

      <div class="monark-card">
        <div class="monark-detail-row">
          <span class="monark-detail-label">Composant détecté</span>
          <span class="monark-detail-value">${componentName}</span>
        </div>
        ${price !== null ? `<div class="monark-detail-row">
          <span class="monark-detail-label">Prix affiché</span>
          <span class="monark-detail-value">${price.toFixed(0)}€</span>
        </div>` : ''}
        <div class="monark-detail-row">
          <span class="monark-detail-label" style="color:#f59e0b">${intent.overlayMessage || 'Annonce non standard'}</span>
        </div>
      </div>

      <div style="font-size:11px;color:#64748b;text-align:center">Non comptabilisée dans les stats marché.</div>

      ${consensus && consensus.total_voters > 0 ? '<div style="display:flex;align-items:center;gap:6px;padding:6px 10px;background:#2a2a3e;border-radius:8px;border-left:2px solid #6366f1"><span style="font-size:11px">👥</span><span style="font-size:10px;color:#94a3b8">' + consensus.total_voters + ' vote' + (consensus.total_voters > 1 ? 's' : '') + ' communautaire' + (consensus.total_voters > 1 ? 's' : '') + '</span></div>' : ''}

      ${showEstimateBtn ? '<button class="monark-btn-action monark-btn-action-secondary" id="monark-filtered-estimate-btn">📊 Estimer sur Monark →</button>' : ''}

      <div style="display:flex;gap:6px;justify-content:flex-end">
        <button class="monark-btn-action monark-btn-action-ghost" id="monark-close-btn">✕</button>
      </div>
    </div>

    <div class="monark-footer">
      <span>Monark Lens v${EXTENSION_VERSION}</span>
      <span><span class="monark-status-dot"></span>Collecte active</span>
    </div>
  `;
    shadow.getElementById("monark-close-btn")?.addEventListener("click", () => {
      removeOverlay();
    });
    shadow.getElementById("monark-filtered-estimate-btn")?.addEventListener("click", () => {
      const params = new URLSearchParams({
        component: String(componentId),
        price: String(price || 0),
        source: "lens"
      });
      window.open(`${MONARK_WEB_URL}/estimator?${params.toString()}`, "_blank");
    });
  }
  function showBundleAnalysisOverlay(allComponents, bundlePrice, bundleResult) {
    const { host, shadow, container } = createOverlay();
    overlayHost = host;
    shadowRoot = shadow;
    overlayContainer = container;
    isMinimized = false;

    const totalValue = bundleResult.total_estimated_value || 0;
    const diff = totalValue - bundlePrice;
    const diffPct = totalValue > 0 ? ((diff / totalValue) * 100).toFixed(1) : 0;
    const isGood = diff > 0;

    const verdictMap = {
      good_deal: { text: "Bonne affaire potentielle", color: "#10b981", icon: "✅" },
      fair: { text: "Prix dans la moyenne", color: "#f59e0b", icon: "➡️" },
      overpriced: { text: "Au-dessus de la valeur pièces", color: "#f97316", icon: "⚠️" },
      insufficient_data: { text: "Données insuffisantes", color: "#64748b", icon: "📊" },
    };
    const verdict = verdictMap[bundleResult.verdict] || verdictMap.insufficient_data;
    const unknownCount = bundleResult.components_requested - bundleResult.components_found;
    const bundleScore = bundleResult.verdict === 'good_deal' ? 8 : bundleResult.verdict === 'fair' ? 5.5 : 3;

    const componentsHtml = (bundleResult.components || []).map((c, i) => {
      const compScore = c.data_points >= 5 && c.median_price ? 7 : 0;
      return '<div class="monark-comp-row" data-comp-idx="' + i + '">' +
        renderScoreRing(compScore, 36) +
        '<div style="flex:1;min-width:0">' +
          '<div style="display:flex;align-items:center;gap:5px;margin-bottom:2px">' +
            renderTypeBadge(c.category) +
            '<span style="font-size:12px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + c.component_name + '</span>' +
          '</div>' +
          '<div style="font-size:10px;color:#64748b">' + c.data_points + ' obs.</div>' +
        '</div>' +
        '<div style="text-align:right;flex-shrink:0">' +
          (c.median_price != null
            ? '<div style="font-size:14px;font-weight:800;color:#6366f1;font-variant-numeric:tabular-nums">' + Math.round(c.median_price) + '€</div>'
            : '<div style="font-size:12px;color:#64748b">—</div>') +
        '</div>' +
        '<span class="monark-comp-arrow" style="color:#64748b;font-size:10px;margin-left:2px">▸</span>' +
      '</div>' +
      '<div class="monark-comp-expanded" data-comp-detail="' + i + '">' +
        '<div class="monark-detail-row"><span class="monark-detail-label">Médiane</span><span class="monark-detail-value">' + (c.median_price != null ? Math.round(c.median_price) + '€' : '—') + '</span></div>' +
        '<div class="monark-detail-row"><span class="monark-detail-label">Observations</span><span class="monark-detail-value">' + c.data_points + '</span></div>' +
        '<div class="monark-detail-row"><span class="monark-detail-label">Catégorie</span><span class="monark-detail-value">' + (c.category || '').toUpperCase() + '</span></div>' +
      '</div>';
    }).join('');

    container.innerHTML = `
    <div class="monark-header">
      <div class="monark-brand">
        <span class="monark-brand-icon">🖥️</span>
        Monark Lens — PC
      </div>
      ${renderScoreRing(bundleScore, 40)}
    </div>

    <div class="monark-tabs">
      <button class="monark-tab active" data-tab="bundle-score">◎ Score</button>
      <button class="monark-tab" data-tab="bundle-components">🔧 Composants</button>
      <button class="monark-tab" data-tab="bundle-analysis">📊 Analyse</button>
    </div>

    <div id="monark-tab-bundle-score" class="monark-tab-content">
      <div class="monark-verdict" style="color:${verdict.color};margin-bottom:2px">
        <span class="monark-verdict-icon">${verdict.icon}</span>
        ${verdict.text}
      </div>

      <div class="monark-stats-grid">
        <div class="monark-stat-card">
          <div class="monark-stat-card-label">Prix annonce</div>
          <div class="monark-stat-card-value" style="color:#e2e8f0">${Math.round(bundlePrice)}€</div>
        </div>
        <div class="monark-stat-card">
          <div class="monark-stat-card-label">Valeur pièces</div>
          <div class="monark-stat-card-value" style="color:${isGood ? '#10b981' : '#ef4444'}">~${Math.round(totalValue)}€</div>
          <div class="monark-stat-card-sub">${isGood ? '+' : ''}${diffPct}%</div>
        </div>
      </div>

      <div class="monark-total-card">
        <span style="font-size:13px;font-weight:700;color:#e2e8f0">Valeur totale estimée</span>
        <span style="font-size:18px;font-weight:800;color:#6366f1;font-variant-numeric:tabular-nums">${Math.round(totalValue)}€</span>
      </div>

      ${unknownCount > 0 ? '<div style="font-size:11px;color:#64748b;font-style:italic;text-align:center">+ ' + unknownCount + ' composant' + (unknownCount > 1 ? 's' : '') + ' sans données</div>' : ''}

      <button class="monark-btn-action monark-btn-action-secondary" id="monark-bundle-estimate-btn">📊 Détails sur Monark →</button>
    </div>

    <div id="monark-tab-bundle-components" class="monark-tab-content" style="display:none">
      <div class="monark-card">
        <div class="monark-card-header">Composants (${bundleResult.components_found}/${bundleResult.components_requested})</div>
        ${componentsHtml}
      </div>
      ${unknownCount > 0 ? '<div style="font-size:11px;color:#64748b;font-style:italic;text-align:center">+ ' + unknownCount + ' composant' + (unknownCount > 1 ? 's' : '') + ' sans données marché</div>' : ''}
    </div>

    <div id="monark-tab-bundle-analysis" class="monark-tab-content" style="display:none">
      <div class="monark-stats-grid">
        <div class="monark-stat-card">
          <div class="monark-stat-card-label">Composants trouvés</div>
          <div class="monark-stat-card-value" style="color:#6366f1">${bundleResult.components_found}</div>
          <div class="monark-stat-card-sub">sur ${bundleResult.components_requested}</div>
        </div>
        <div class="monark-stat-card">
          <div class="monark-stat-card-label">Écart prix</div>
          <div class="monark-stat-card-value" style="color:${isGood ? '#10b981' : '#ef4444'}">${isGood ? '+' : ''}${diffPct}%</div>
          <div class="monark-stat-card-sub">${isGood ? 'sous-évalué' : 'surévalué'}</div>
        </div>
      </div>
      <div class="monark-card">
        <div class="monark-card-header">Répartition valeur</div>
        ${(bundleResult.components || []).filter(function(c) { return c.median_price != null; }).map(function(c) {
          var pct = totalValue > 0 ? (c.median_price / totalValue * 100).toFixed(0) : 0;
          return '<div class="monark-detail-row"><span class="monark-detail-label">' + renderTypeBadge(c.category) + ' ' + c.component_name + '</span><span class="monark-detail-value">' + Math.round(c.median_price) + '€ (' + pct + '%)</span></div>';
        }).join('')}
      </div>
      <div style="font-size:10px;color:#64748b;text-align:center">Non comptabilisé dans les stats individuelles.</div>
    </div>

    <div style="display:flex;gap:6px;justify-content:flex-end;padding:0 16px 8px">
      <button class="monark-btn-action monark-btn-action-ghost" id="monark-close-btn">✕</button>
    </div>

    <div class="monark-footer">
      <span>Monark Lens v${EXTENSION_VERSION}</span>
      <span><span class="monark-status-dot"></span>Collecte active</span>
    </div>
  `;

    // Tab switching
    shadow.querySelectorAll('.monark-tab').forEach(function(tab) {
      tab.addEventListener('click', function() {
        var tabId = this.dataset.tab;
        shadow.querySelectorAll('.monark-tab').forEach(function(t) { t.classList.remove('active'); });
        this.classList.add('active');
        ['bundle-score', 'bundle-components', 'bundle-analysis'].forEach(function(id) {
          var pane = shadow.getElementById('monark-tab-' + id);
          if (pane) pane.style.display = id === tabId ? 'flex' : 'none';
        });
      });
    });

    // Expandable component rows
    shadow.querySelectorAll('.monark-comp-row').forEach(function(row) {
      row.addEventListener('click', function() {
        var idx = this.dataset.compIdx;
        var existingExpand = shadow.getElementById('monark-comp-expand-' + idx);

        // Fermer toutes les expansions ouvertes
        shadow.querySelectorAll('[id^="monark-comp-expand-"]').forEach(function(el) {
          el.remove();
        });
        // Réinitialiser toutes les flèches
        shadow.querySelectorAll('.monark-comp-row').forEach(function(r) {
          var a = r.querySelector('.monark-comp-arrow');
          if (a) a.textContent = '▸';
        });

        // Si on cliquait sur une déjà ouverte, juste la fermer
        if (existingExpand) return;

        // Créer l'expansion
        var comp = bundleResult.components[idx];
        if (!comp) return;

        var expandDiv = document.createElement('div');
        expandDiv.id = 'monark-comp-expand-' + idx;
        expandDiv.className = 'monark-comp-expanded open';
        expandDiv.innerHTML =
          '<div class="monark-detail-row"><span class="monark-detail-label">Médiane</span><span class="monark-detail-value">' + (comp.median_price != null ? comp.median_price.toFixed(0) + '€' : '—') + '</span></div>' +
          '<div class="monark-detail-row"><span class="monark-detail-label">Observations</span><span class="monark-detail-value">' + comp.data_points + '</span></div>' +
          '<div class="monark-detail-row"><span class="monark-detail-label">Catégorie</span><span class="monark-detail-value">' + (comp.category || '').toUpperCase() + '</span></div>' +
          (comp.p25_price != null && comp.p75_price != null ? '<div class="monark-detail-row"><span class="monark-detail-label">P25 — P75</span><span class="monark-detail-value">' + comp.p25_price.toFixed(0) + '€ — ' + comp.p75_price.toFixed(0) + '€</span></div>' : '');

        // Insérer APRÈS la row cliquée (avant le pré-rendu detail s'il existe)
        this.parentElement.insertBefore(expandDiv, this.nextSibling);
        var arrow = this.querySelector('.monark-comp-arrow');
        if (arrow) arrow.textContent = '▾';
      });
    });

    shadow.getElementById("monark-close-btn")?.addEventListener("click", removeOverlay);
    shadow.getElementById("monark-bundle-estimate-btn")?.addEventListener("click", () => {
      const params = new URLSearchParams({
        type: "bundle",
        components: (bundleResult.components || []).map(c => c.component_id).join(","),
        price: String(bundlePrice),
        source: "lens",
      });
      window.open(`${MONARK_WEB_URL}/estimator?${params.toString()}`, "_blank");
    });
  }
  function showLoadingOverlay() {
    const { host, shadow, container } = createOverlay();
    overlayHost = host;
    shadowRoot = shadow;
    overlayContainer = container;
    container.innerHTML = `
    <div class="monark-header">
      <div class="monark-brand">
        <span class="monark-brand-icon">🔍</span>
        Monark Lens
      </div>
    </div>
    <div class="monark-loading">
      <div class="monark-spinner"></div>
      Analyse en cours...
    </div>
  `;
  }
  function removeOverlay() {
    overlayHost?.remove();
    overlayHost = null;
    shadowRoot = null;
    overlayContainer = null;
    isMinimized = false;
    isQuickExpanded = false;
  }
  function isOverlayVisible() {
    return overlayHost !== null;
  }

  const SITE_ACCESS_KEY = "monark_access_token";
  const SITE_REFRESH_KEY = "monark_refresh_token";
  let lastKnownSiteToken = null;
  let syncInProgress = false;
  function initAuthSync() {
    const host = window.location.hostname;
    if (host !== "monark-market.fr" && host !== "www.monark-market.fr") return;
    console.log("[Monark] Auth sync initialized on monark-market.fr");
    initialSync();
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.action === "SYNC_TOKENS_TO_SITE") {
        handleExtensionToSite(message);
        sendResponse({ success: true });
      }
      return false;
    });
    lastKnownSiteToken = localStorage.getItem(SITE_ACCESS_KEY);
    setInterval(checkSiteAuthChanged, 2e3);
  }
  async function initialSync() {
    if (syncInProgress) return;
    syncInProgress = true;
    try {
      const siteToken = localStorage.getItem(SITE_ACCESS_KEY);
      const extensionTokens = await chrome.runtime.sendMessage({
        type: "GET_STORED_TOKENS"
      });
      const extensionHasToken = !!extensionTokens?.access_token;
      const siteHasToken = !!siteToken;
      if (siteHasToken && !extensionHasToken) {
        console.log("[Monark] Syncing auth: site → extension");
        await chrome.runtime.sendMessage({
          type: "SYNC_TOKENS_FROM_SITE",
          access_token: siteToken,
          refresh_token: localStorage.getItem(SITE_REFRESH_KEY)
        });
      } else if (extensionHasToken && !siteHasToken) {
        console.log("[Monark] Syncing auth: extension → site");
        localStorage.setItem(SITE_ACCESS_KEY, extensionTokens.access_token);
        if (extensionTokens.refresh_token) {
          localStorage.setItem(SITE_REFRESH_KEY, extensionTokens.refresh_token);
        }
        window.location.reload();
      }
    } catch (err) {
      console.warn("[Monark] Initial auth sync failed:", err);
    } finally {
      syncInProgress = false;
    }
  }
  function handleExtensionToSite(message) {
    if (message.access_token) {
      localStorage.setItem(SITE_ACCESS_KEY, message.access_token);
      if (message.refresh_token) {
        localStorage.setItem(SITE_REFRESH_KEY, message.refresh_token);
      }
      lastKnownSiteToken = message.access_token;
      console.log("[Monark] Extension login synced to site");
    } else {
      localStorage.removeItem(SITE_ACCESS_KEY);
      localStorage.removeItem(SITE_REFRESH_KEY);
      localStorage.removeItem("mock_current_user");
      lastKnownSiteToken = null;
      console.log("[Monark] Extension logout synced to site");
    }
    notifySiteAuthChanged();
  }
  async function checkSiteAuthChanged() {
    if (syncInProgress) return;
    const currentToken = localStorage.getItem(SITE_ACCESS_KEY);
    if (currentToken === lastKnownSiteToken) return;
    lastKnownSiteToken = currentToken;
    syncInProgress = true;
    try {
      if (currentToken) {
        console.log("[Monark] Detected site login, syncing to extension");
        await chrome.runtime.sendMessage({
          type: "SYNC_TOKENS_FROM_SITE",
          access_token: currentToken,
          refresh_token: localStorage.getItem(SITE_REFRESH_KEY)
        });
      } else {
        console.log("[Monark] Detected site logout, syncing to extension");
        await chrome.runtime.sendMessage({
          type: "SYNC_TOKENS_FROM_SITE",
          access_token: "",
          refresh_token: null
        });
      }
    } catch (err) {
      console.warn("[Monark] Site→Extension auth sync failed:", err);
    } finally {
      syncInProgress = false;
    }
  }
  function notifySiteAuthChanged() {
    window.dispatchEvent(new CustomEvent("monark-auth-sync"));
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: SITE_ACCESS_KEY,
        newValue: localStorage.getItem(SITE_ACCESS_KEY)
      })
    );
    window.location.reload();
  }

  let signalSentForUrl = null;
  let currentListing = null;
  let currentPlatform = null;
  let currentAdHash = null;
  let currentCreditsRemaining = 0;
  let currentAnalyzeResponse = null;
  const DECISION_CACHE_KEY = "monark_intent_decisions";
  const DECISION_CACHE_TTL = 7 * 24 * 60 * 60 * 1e3;
  async function getCachedDecision(url) {
    try {
      const data = await chrome.storage.local.get([DECISION_CACHE_KEY]);
      const cache = data[DECISION_CACHE_KEY] || {};
      const entry = cache[url];
      if (!entry) return null;
      if (Date.now() - entry.timestamp > DECISION_CACHE_TTL) {
        delete cache[url];
        await chrome.storage.local.set({ [DECISION_CACHE_KEY]: cache });
        return null;
      }
      return entry.intentType;
    } catch {
      return null;
    }
  }
  async function cacheDecision(url, intentType) {
    try {
      const data = await chrome.storage.local.get([DECISION_CACHE_KEY]);
      const cache = data[DECISION_CACHE_KEY] || {};
      const now = Date.now();
      const urls = Object.keys(cache);
      for (const key of urls) {
        if (now - (cache[key].timestamp || 0) > DECISION_CACHE_TTL) {
          delete cache[key];
        }
      }
      if (Object.keys(cache).length > 500) {
        const sorted = Object.keys(cache).sort((a, b) => (cache[a].timestamp || 0) - (cache[b].timestamp || 0));
        for (let i = 0; i < sorted.length - 400; i++) {
          delete cache[sorted[i]];
        }
      }
      cache[url] = { intentType, timestamp: now };
      await chrome.storage.local.set({ [DECISION_CACHE_KEY]: cache });
    } catch (err) {
      console.warn("[Monark] Failed to cache decision:", err);
    }
  }
  async function submitCommunityFlag(componentId, listingUrl, platform, intentType, source) {
    try {
      const authState = await chrome.runtime.sendMessage({ type: "GET_AUTH_STATE" });
      if (!authState?.isLoggedIn) {
        console.log("[Monark] Not logged in, skipping community flag");
        return;
      }
      const result = await chrome.runtime.sendMessage({
        type: "SUBMIT_FLAG",
        payload: {
          listing_url: listingUrl,
          platform,
          component_id: componentId,
          intent_type: intentType,
          source
        }
      });
      if (result?.error) {
        console.warn("[Monark] Community flag failed:", result.error);
      } else {
        console.log(`[Monark] Community flag submitted: ${intentType} (${source})`);
      }
    } catch (err) {
      console.warn("[Monark] Community flag error:", err);
    }
  }
  async function fetchConsensus(listingUrl, platform) {
    try {
      const authState = await chrome.runtime.sendMessage({ type: "GET_AUTH_STATE" });
      if (!authState?.isLoggedIn) return null;
      const timeoutPromise = new Promise(
        (_, reject) => setTimeout(() => reject(new Error("Consensus timeout")), 2e3)
      );
      const consensusPromise = chrome.runtime.sendMessage({
        type: "GET_CONSENSUS",
        listingUrl,
        platform
      });
      const result = await Promise.race([consensusPromise, timeoutPromise]);
      return result || null;
    } catch {
      return null;
    }
  }
  let lastAnalyzedUrl = null;
  async function analyze() {
    // Guard : empêcher les appels concurrents
    if (analyze._running) {
      console.log("[Monark] analyze() already running, skipping");
      return;
    }
    analyze._running = true;
    try {
      await _analyzeInner();
    } finally {
      analyze._running = false;
    }
  }
  async function _analyzeInner() {
    const { overlay_enabled } = await chrome.storage.local.get(["overlay_enabled"]);
    if (overlay_enabled === false) {
      removeOverlay();
      return;
    }
    const detection = detectPlatform();
    if (!detection) {
      removeOverlay();
      notifyDetectionStatus(null, null, null, null);
      return;
    }
    if (detection.pageType !== "detail") {
      removeOverlay();
      notifyDetectionStatus(detection.platform, null, null, null);
      return;
    }
    // Éviter de re-analyser la même URL
    if (window.location.href === lastAnalyzedUrl && currentAnalyzeResponse) {
      console.log("[Monark] Same URL already analyzed, skipping");
      return;
    }
    lastAnalyzedUrl = window.location.href;
    if (!isDbLoaded()) {
      await loadComponentDb();
    }
    let listing = await extractListingData(detection.platform);
    if (!listing) {
      // Retry : Leboncoin SPA peut mettre du temps à mettre à jour __NEXT_DATA__
      for (let attempt = 0; attempt < 3 && !listing; attempt++) {
        await sleep(800);
        listing = await extractListingData(detection.platform);
      }
    }
    if (!listing || !listing.title) {
      removeOverlay();
      notifyDetectionStatus(detection.platform, null, null, null);
      return;
    }
    // Description watcher (Phase 2) gère le cas SPA où la description arrive après
    if (detection.platform === "leboncoin") {
      if (!isHardwareCategory(listing)) {
        console.log(`[Monark] Non-hardware category ignored: ${listing.categoryName} (ID: ${listing.categoryId})`);
        removeOverlay();
        notifyDetectionStatus(detection.platform, null, null, null);
        return;
      }
    }
    const match = matchComponent(listing.title);
    if (match) {
      match.variantName = findVariantName(match.componentId, listing.title);
      if (match.variantName) {
        console.log(`[Monark] Variant detected: ${match.componentName} → ${match.variantName}`);
      }
    }
    if (!match || listing.price === null) {
      removeOverlay();
      notifyDetectionStatus(
        detection.platform,
        null,
        null,
        listing.price
      );
      return;
    }
    match.componentId;
    listing.price;
    let intent = classifyIntent(
      listing.title,
      listing.price,
      listing.description || null,
      match.category || void 0
    );
    // Leboncoin : si la catégorie de l'annonce contient "ordinateur" et intent=sale → bundle
    if (detection.platform === "leboncoin" && intent.type === "sale" && listing.categoryName) {
      const catNorm = listing.categoryName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (catNorm.includes("ordinateur")) {
        console.log(`[Monark] Category override: categoryName="${listing.categoryName}" → bundle`);
        intent = {
          type: "bundle",
          confidence: 0.85,
          flags: ["category:ordinateur"],
          quantity: 1,
          shouldSignal: false,
          shouldOverlay: true,
          overlayMessage: "Ensemble / PC complet — prix non représentatif du composant seul"
        };
      }
    }
    // Forcer le filtrage si Leboncoin indique "Pour pièces"
    if (listing.isPourPieces && intent.type === 'sale') {
      intent.type = 'broken';
      intent.confidence = 0.95;
      intent.flags = ['lbc_condition:pourpieces'];
      intent.shouldSignal = true;
      intent.shouldOverlay = true;
      intent.overlayMessage = 'Composant HS / pour pièces (état Leboncoin)';
      console.log('[Monark] Forced broken: Leboncoin condition = Pour pièces');
    }
    notifyDetectionStatus(
      detection.platform,
      match.componentId,
      match.componentName,
      listing.price
    );
    currentListing = listing;
    currentPlatform = detection.platform;

    // ══════════════════════════════════════════════════════════════
    // FLOW V2 : Scoring centralisé via ANALYZE_LISTING
    // ══════════════════════════════════════════════════════════════

    // ── Toujours tenter la détection multi-composants ──
    let allComponents = [];
    if (intent.type === "sale" || intent.type === "bundle" || intent.type === "multiple") {
      const fullText = `${listing.title} ${listing.description || ""}`;
      allComponents = matchAllComponents(fullText);

      // Auto-upgrade en bundle si >= 2 composants dans >= 2 catégories
      const uniqueCategories = new Set(allComponents.map(c => c.category));
      if (allComponents.length >= 2 && uniqueCategories.size >= 2 && intent.type === "sale") {
        console.log(`[Monark] Auto-detect bundle: ${allComponents.length} components in ${uniqueCategories.size} categories`);
        intent = {
          type: "bundle",
          confidence: Math.max(intent.confidence, 0.85),
          flags: [...(intent.flags || []), "auto_detected_multicomponent"],
          quantity: 1,
          shouldSignal: true,
          shouldOverlay: true,
          overlayMessage: "Ensemble / PC complet"
        };
      }
    }

    // ── Vérifier le cache local de décisions ──
    const cachedDecision = await getCachedDecision(listing.url);
    if (cachedDecision) {
      const criticalIntents = ["broken", "wanted", "trade", "reserved", "box_only"];
      if (cachedDecision === "sale" && criticalIntents.includes(intent.type) && intent.confidence >= 0.6) {
        console.log(`[Monark] Cache override: cached=sale but regex=${intent.type}`);
        cacheDecision(listing.url, intent.type);
      } else if (cachedDecision === "bundle" && intent.type === "sale") {
        console.log("[Monark] Cache hit: bundle → forcing bundle flow");
        intent.type = "bundle";
        if (allComponents.length < 2) {
          const freshListing = await extractListingData(detection.platform);
          if (freshListing?.description) {
            const fullText = `${freshListing.title} ${freshListing.description}`;
            allComponents = matchAllComponents(fullText);
          }
        }
      } else if (cachedDecision === "sale" && intent.type !== "sale") {
        console.log(`[Monark] Cache hit: sale → overriding ${intent.type}`);
        intent.type = "sale";
        intent.confidence = 0.9;
      }
    }

    // ── Construire le payload ──
    const payload = buildAnalyzePayload(listing, detection, match, intent, allComponents);

    // ── Demander confirmation si bundle auto-détecté sans cache ──
    const uniqueCats = new Set(allComponents.map(c => c.category));
    const isAutoBundle = allComponents.length >= 2 && uniqueCats.size >= 2;
    const isBundleByRegex = intent.type === "bundle" && intent.confidence >= 0.8 && !intent.flags?.includes("auto_detected_multicomponent");
    const hasCachedBundleDecision = cachedDecision === "bundle";

    if (isAutoBundle && !isBundleByRegex && !hasCachedBundleDecision && intent.type === "bundle") {
      console.log("[Monark] Showing bundle confirmation overlay");
      let consensus = null;
      fetchConsensus(listing.url, detection.platform).then(c => { if (c) consensus = c; }).catch(() => {});

      const bundleIntent = {
        type: "bundle",
        confidence: 0.7,
        flags: ["auto_detected_multicomponent"],
        quantity: 1,
        shouldOverlay: true,
        overlayMessage: `PC détecté : ${allComponents.map(c => c.componentName).join(", ")}`
      };

      showConfirmationOverlay(
        match.componentName,
        match.componentId,
        listing.price,
        bundleIntent,
        {
          onConfirm: async () => {
            cacheDecision(listing.url, "bundle");
            payload.user_confirmed_bundle = true;
            payload.is_bundle = true;
            showLoadingOverlay();
            const response = await chrome.runtime.sendMessage({ type: "ANALYZE_LISTING", payload });
            currentAnalyzeResponse = response;
            handleAnalyzeResponse(response, listing, match, allComponents, detection);
          },
          onOverride: async () => {
            cacheDecision(listing.url, "sale");
            payload.is_bundle = false;
            payload.intent.type = "sale";
            payload.components = [{ component_id: match.componentId, category: match.category || "gpu", match_type: "exact_name" }];
            showLoadingOverlay();
            const response = await chrome.runtime.sendMessage({ type: "ANALYZE_LISTING", payload });
            currentAnalyzeResponse = response;
            handleAnalyzeResponse(response, listing, match, [], detection);
          }
        },
        consensus
      );
      return;
    }

    // ── Confirmation pour les intents non-sale/non-bundle (broken, trade, etc.) ──
    if (intent.type !== "sale" && intent.type !== "bundle" && intent.type !== "multiple") {
      if (!intent.shouldOverlay) {
        removeOverlay();
        return;
      }

      const directDisplayTypes = ["wanted", "reserved", "rental", "test_spam", "symbolic_price"];
      if (intent.confidence >= 0.9 && directDisplayTypes.includes(intent.type)) {
        showLoadingOverlay();
        const response = await chrome.runtime.sendMessage({ type: "ANALYZE_LISTING", payload });
        currentAnalyzeResponse = response;
        handleAnalyzeResponse(response, listing, match, allComponents, detection);
        return;
      }

      let consensus = null;
      fetchConsensus(listing.url, detection.platform).then(c => { if (c) consensus = c; }).catch(() => {});

      showConfirmationOverlay(
        match.componentName,
        match.componentId,
        listing.price,
        intent,
        {
          onConfirm: async (intentType) => {
            submitCommunityFlag(match.componentId, listing.url, detection.platform, intentType, "auto_confirmed");
            cacheDecision(listing.url, intentType);
            payload.intent.type = intentType;
            showLoadingOverlay();
            const response = await chrome.runtime.sendMessage({ type: "ANALYZE_LISTING", payload });
            currentAnalyzeResponse = response;
            handleAnalyzeResponse(response, listing, match, allComponents, detection);
          },
          onOverride: async () => {
            submitCommunityFlag(match.componentId, listing.url, detection.platform, "sale", "auto_overridden");
            cacheDecision(listing.url, "sale");
            payload.intent.type = "sale";
            showLoadingOverlay();
            const response = await chrome.runtime.sendMessage({ type: "ANALYZE_LISTING", payload });
            currentAnalyzeResponse = response;
            handleAnalyzeResponse(response, listing, match, allComponents, detection);
          }
        },
        consensus
      );
      return;
    }

    // ── Flow principal : sale, bundle confirmé, multiple ──
    console.log(`[Monark] Sending ANALYZE_LISTING: type=${payload.intent.type}, bundle=${payload.is_bundle}, components=${payload.components.length}`);
    showLoadingOverlay();
    const response = await chrome.runtime.sendMessage({ type: "ANALYZE_LISTING", payload });
    currentAnalyzeResponse = response;
    handleAnalyzeResponse(response, listing, match, allComponents, detection);
    // Phase 2 : surveiller la description si elle n'était pas disponible
    if (!listing.description && allComponents.length < 2) {
      watchForDescription(detection, listing, match);
    }
  }
  function handleFlagClick(componentId, componentName, price) {
    if (!currentListing || !currentPlatform) return;
    showFlagSelector(
      componentId,
      componentName,
      price,
      (intentType, label) => {
        submitCommunityFlag(componentId, currentListing.url, currentPlatform, intentType, "manual_flag");
        cacheDecision(currentListing.url, intentType);
        const flagIntent = {
          type: intentType,
          overlayMessage: label
        };
        showFilteredOverlay(componentName, componentId, price, flagIntent);
      },
      () => {
        analyze();
      }
    );
  }
  const DEFECT_PATTERNS = [
    [/rayur|scratch|éraflu/i, "cosmetic_scratch"],
    [/jauni|yellowing/i, "yellowing"],
    [/pixel mort|dead pixel/i, "dead_pixel"],
    [/bruit|coil whine|ventilateur bruyant/i, "noise"],
    [/chauffe|surchauffe|overheat/i, "overheating"],
    [/crash|instable|instabilité|freeze/i, "instability"],
    [/répar[ée]|à réparer|hs|hors service|panne|défectueux/i, "needs_repair"],
    [/manqu|missing|absent/i, "missing_parts"],
    [/poussièr|dust/i, "dusty"],
    [/oxyd|corros/i, "corrosion"]
  ];
  function extractDefects(text) {
    const defects = [];
    for (const [pattern, label] of DEFECT_PATTERNS) {
      if (pattern.test(text)) {
        defects.push(label);
      }
    }
    return defects.length > 0 ? defects : null;
  }
  function launchBundleAnalysis(platform, listing, match, allComponents, intent, consensus) {
    const bundleIntent = {
      type: "bundle",
      confidence: intent?.confidence || 0.9,
      flags: intent?.flags || ["auto_detected"],
      quantity: 1,
      shouldSignal: true,
      shouldOverlay: true,
      overlayMessage: "Ensemble / PC complet"
    };
    showLoadingOverlay();
    chrome.runtime.sendMessage({
      type: "ANALYZE_BUNDLE",
      payload: {
        component_ids: allComponents.map(c => c.componentId),
        bundle_price: listing.price,
        platform,
        condition: listing.condition,
      }
    }).then(result => {
      if (result?.error) {
        console.warn("[Monark] Bundle analysis failed, using local data:", result.error);
        const fallbackResult = {
          components: allComponents.map(c => ({
            component_id: c.componentId,
            component_name: c.componentName,
            category: c.category,
            median_price: null,
            p25_price: null,
            p75_price: null,
            data_points: 0
          })),
          total_estimated_value: 0,
          components_found: allComponents.length,
          components_requested: allComponents.length,
          verdict: "insufficient_data"
        };
        showBundleAnalysisOverlay(allComponents, listing.price, fallbackResult);
      } else {
        console.log("[Monark] Bundle analysis:", result);
        showBundleAnalysisOverlay(allComponents, listing.price, result);
      }
    }).catch((err) => {
      console.warn("[Monark] Bundle analysis network error, using local data:", err);
      const fallbackResult = {
        components: allComponents.map(c => ({
          component_id: c.componentId,
          component_name: c.componentName,
          category: c.category,
          median_price: null,
          p25_price: null,
          p75_price: null,
          data_points: 0
        })),
        total_estimated_value: 0,
        components_found: allComponents.length,
        components_requested: allComponents.length,
        verdict: "insufficient_data"
      };
      showBundleAnalysisOverlay(allComponents, listing.price, fallbackResult);
    });
    sendPassiveSignal(platform, listing, match.componentId, bundleIntent, allComponents.map(c => c.componentId));
  }
  async function sendPassiveSignal(platform, listing, componentId, intent, bundleComponentIds) {
    if (signalSentForUrl === listing.url) return;
    try {
      const authState = await chrome.runtime.sendMessage({ type: "GET_AUTH_STATE" });
      if (!authState?.isLoggedIn) return;
      const stored = await chrome.storage.local.get(["auto_signal"]);
      if (stored.auto_signal === false) return;
      const pageText = document.body.textContent || "";
      const payload = {
        component_id: componentId,
        platform,
        price: listing.price,
        currency: "EUR",
        condition: listing.condition,
        region: listing.location,
        title: listing.title,
        listing_intent: intent?.type || "sale",
        quantity: intent?.quantity || 1,
        has_warranty: /garant|warranty/i.test(pageText),
        has_invoice: /facture|invoice|ticket de caisse|preuve d'achat/i.test(pageText),
        has_original_box: /bo[iî]te d'origine|original box|emballage d'origine|carton d'origine|bo[iî]te compl[eè]te|avec bo[iî]te|with box/i.test(pageText),
        defects: extractDefects(pageText),
        is_bundle: intent?.type === "bundle",
        bundle_component_ids: bundleComponentIds || null,
        signal_type: "passive",
        ad_hash: currentAdHash || null
      };
      console.log("[Monark] Passive signal payload:", JSON.stringify(payload, null, 2));
      const result = await chrome.runtime.sendMessage({
        type: "SEND_SIGNAL",
        payload
      });
      signalSentForUrl = listing.url;
      if (result?.credits_earned > 0) {
        showCreditBadge(result.credits_earned);
      }
      if (result?.listing_intent && result.listing_intent !== (intent?.type || "sale")) {
        console.log(
          `[Monark] Backend reclassified: regex=${intent?.type || "sale"} → llm=${result.listing_intent}`
        );
      }
    } catch (err) {
      console.warn("[Monark] Passive signal failed:", err);
    }
  }
  function notifyDetectionStatus(platform, componentId, componentName, price) {
    chrome.runtime.sendMessage({
      type: "DETECTION_STATUS",
      platform,
      componentId,
      componentName,
      price
    }).catch(() => {
    });
  }
  async function clearDecisionCache() {
    try {
      await chrome.storage.local.remove([DECISION_CACHE_KEY]);
      console.log("[Monark] Decision cache cleared");
    } catch (err) {
      console.warn("[Monark] Failed to clear cache:", err);
    }
  }
  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }
  async function init() {
    initAuthSync();
    loadComponentDb();
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.action === "TRIGGER_QUICK" && message.componentId && message.price) {
        if (!isOverlayVisible()) {
          showLoadingOverlay();
        }
        requestQuickAnalysis(message.componentId, message.price);
        sendResponse({ success: true });
        return false;
      }
      if (message.action === "CLEAR_DECISION_CACHE") {
        clearDecisionCache().then(() => sendResponse({ success: true }));
        return true;
      }
      return false;
    });
    let _scheduledForUrl = null;
    observeNavigation(() => {
      const currentUrl = window.location.href;
      if (currentUrl === _scheduledForUrl) {
        console.log("[Monark] Navigation callback already scheduled for this URL, skipping");
        return;
      }
      _scheduledForUrl = currentUrl;
      if (analyze._descriptionWatcher?.stop) {
        analyze._descriptionWatcher.stop();
        analyze._descriptionWatcher = null;
      }
      signalSentForUrl = null;
      currentListing = null;
      currentPlatform = null;
      currentAdHash = null;
      currentAnalyzeResponse = null;
      lastAnalyzedUrl = null;
      removeOverlay();
      setTimeout(() => {
        analyze();
      }, 800);
    });
  }
  init();

})();
