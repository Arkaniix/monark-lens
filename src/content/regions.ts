// src/content/regions.ts — normalisation région FR (porté verbatim du v1).
// Données pures (LBC_REGION_MAP / DEPARTMENT_TO_REGION / CITY_REGION_HINTS / code postal→dept).

export const LBC_REGION_MAP: Record<string, string> = {
  alsace: "grand-est",
  aquitaine: "nouvelle-aquitaine",
  auvergne: "auvergne-rhone-alpes",
  "basse-normandie": "normandie",
  bourgogne: "bourgogne-franche-comte",
  bretagne: "bretagne",
  centre: "centre-val-de-loire",
  "champagne-ardenne": "grand-est",
  corse: "corse",
  "franche-comté": "bourgogne-franche-comte",
  "franche-comte": "bourgogne-franche-comte",
  "haute-normandie": "normandie",
  "ile-de-france": "ile-de-france",
  "île-de-france": "ile-de-france",
  "languedoc-roussillon": "occitanie",
  limousin: "nouvelle-aquitaine",
  lorraine: "grand-est",
  "midi-pyrénées": "occitanie",
  "midi-pyrenees": "occitanie",
  "nord-pas-de-calais": "hauts-de-france",
  "pays de la loire": "pays-de-la-loire",
  "pays-de-la-loire": "pays-de-la-loire",
  picardie: "hauts-de-france",
  "poitou-charentes": "nouvelle-aquitaine",
  "provence-alpes-côte d'azur": "provence-alpes-cote-d-azur",
  "provence-alpes-cote d'azur": "provence-alpes-cote-d-azur",
  "rhône-alpes": "auvergne-rhone-alpes",
  "rhone-alpes": "auvergne-rhone-alpes",
  "auvergne-rhône-alpes": "auvergne-rhone-alpes",
  "auvergne-rhone-alpes": "auvergne-rhone-alpes",
  "bourgogne-franche-comté": "bourgogne-franche-comte",
  "grand est": "grand-est",
  "grand-est": "grand-est",
  "hauts-de-france": "hauts-de-france",
  normandie: "normandie",
  "nouvelle-aquitaine": "nouvelle-aquitaine",
  occitanie: "occitanie",
  "provence-alpes-cote-d-azur": "provence-alpes-cote-d-azur",
  "centre-val de loire": "centre-val-de-loire",
  "centre-val-de-loire": "centre-val-de-loire",
};

export const DEPARTMENT_TO_REGION: Record<string, string> = {
  ain: "auvergne-rhone-alpes", allier: "auvergne-rhone-alpes", ardeche: "auvergne-rhone-alpes",
  cantal: "auvergne-rhone-alpes", drome: "auvergne-rhone-alpes", isere: "auvergne-rhone-alpes",
  loire: "auvergne-rhone-alpes", "haute-loire": "auvergne-rhone-alpes", "puy-de-dome": "auvergne-rhone-alpes",
  rhone: "auvergne-rhone-alpes", savoie: "auvergne-rhone-alpes", "haute-savoie": "auvergne-rhone-alpes",
  aisne: "hauts-de-france", nord: "hauts-de-france", oise: "hauts-de-france",
  "pas-de-calais": "hauts-de-france", somme: "hauts-de-france",
  "bas-rhin": "grand-est", "haut-rhin": "grand-est", moselle: "grand-est",
  "meurthe-et-moselle": "grand-est", meuse: "grand-est", vosges: "grand-est",
  aube: "grand-est", marne: "grand-est", "haute-marne": "grand-est", ardennes: "grand-est",
  calvados: "normandie", eure: "normandie", manche: "normandie", orne: "normandie", "seine-maritime": "normandie",
  "cotes-d-armor": "bretagne", finistere: "bretagne", "ille-et-vilaine": "bretagne", morbihan: "bretagne",
  "loire-atlantique": "pays-de-la-loire", "maine-et-loire": "pays-de-la-loire", mayenne: "pays-de-la-loire",
  sarthe: "pays-de-la-loire", vendee: "pays-de-la-loire",
  cher: "centre-val-de-loire", "eure-et-loir": "centre-val-de-loire", indre: "centre-val-de-loire",
  "indre-et-loire": "centre-val-de-loire", "loir-et-cher": "centre-val-de-loire", loiret: "centre-val-de-loire",
  charente: "nouvelle-aquitaine", "charente-maritime": "nouvelle-aquitaine", correze: "nouvelle-aquitaine",
  creuse: "nouvelle-aquitaine", dordogne: "nouvelle-aquitaine", gironde: "nouvelle-aquitaine",
  landes: "nouvelle-aquitaine", "lot-et-garonne": "nouvelle-aquitaine", "pyrenees-atlantiques": "nouvelle-aquitaine",
  "deux-sevres": "nouvelle-aquitaine", vienne: "nouvelle-aquitaine", "haute-vienne": "nouvelle-aquitaine",
  ariege: "occitanie", aude: "occitanie", aveyron: "occitanie", gard: "occitanie", "haute-garonne": "occitanie",
  gers: "occitanie", herault: "occitanie", lot: "occitanie", lozere: "occitanie", "hautes-pyrenees": "occitanie",
  "pyrenees-orientales": "occitanie", tarn: "occitanie", "tarn-et-garonne": "occitanie",
  "alpes-de-haute-provence": "provence-alpes-cote-d-azur", "hautes-alpes": "provence-alpes-cote-d-azur",
  "alpes-maritimes": "provence-alpes-cote-d-azur", "bouches-du-rhone": "provence-alpes-cote-d-azur",
  var: "provence-alpes-cote-d-azur", vaucluse: "provence-alpes-cote-d-azur",
  "corse-du-sud": "corse", "haute-corse": "corse",
  paris: "ile-de-france", "seine-et-marne": "ile-de-france", yvelines: "ile-de-france", essonne: "ile-de-france",
  "hauts-de-seine": "ile-de-france", "seine-saint-denis": "ile-de-france", "val-de-marne": "ile-de-france",
  "val-d-oise": "ile-de-france",
  doubs: "bourgogne-franche-comte", jura: "bourgogne-franche-comte", "haute-saone": "bourgogne-franche-comte",
  "territoire-de-belfort": "bourgogne-franche-comte", "cote-d-or": "bourgogne-franche-comte",
  nievre: "bourgogne-franche-comte", "saone-et-loire": "bourgogne-franche-comte", yonne: "bourgogne-franche-comte",
};

export const CITY_REGION_HINTS: Record<string, string> = {
  paris: "ile-de-france", lyon: "auvergne-rhone-alpes", marseille: "provence-alpes-cote-d-azur",
  toulouse: "occitanie", nice: "provence-alpes-cote-d-azur", nantes: "pays-de-la-loire",
  strasbourg: "grand-est", montpellier: "occitanie", bordeaux: "nouvelle-aquitaine", lille: "hauts-de-france",
  rennes: "bretagne", reims: "grand-est", nancy: "grand-est", toulon: "provence-alpes-cote-d-azur",
  grenoble: "auvergne-rhone-alpes", dijon: "bourgogne-franche-comte", angers: "pays-de-la-loire",
  nimes: "occitanie", "clermont-ferrand": "auvergne-rhone-alpes", "le havre": "normandie", rouen: "normandie",
  metz: "grand-est", besancon: "bourgogne-franche-comte", perpignan: "occitanie", orleans: "centre-val-de-loire",
  caen: "normandie", mulhouse: "grand-est", brest: "bretagne", tours: "centre-val-de-loire",
  limoges: "nouvelle-aquitaine", amiens: "hauts-de-france", pau: "nouvelle-aquitaine", poitiers: "nouvelle-aquitaine",
  "saint-etienne": "auvergne-rhone-alpes", valence: "auvergne-rhone-alpes",
};

const POSTAL_DEPT_TO_REGION: Record<string, string> = {
  "01": "auvergne-rhone-alpes", "02": "hauts-de-france", "03": "auvergne-rhone-alpes",
  "04": "provence-alpes-cote-d-azur", "05": "provence-alpes-cote-d-azur", "06": "provence-alpes-cote-d-azur",
  "07": "auvergne-rhone-alpes", "08": "grand-est", "09": "occitanie", "10": "grand-est", "11": "occitanie",
  "12": "occitanie", "13": "provence-alpes-cote-d-azur", "14": "normandie", "15": "auvergne-rhone-alpes",
  "16": "nouvelle-aquitaine", "17": "nouvelle-aquitaine", "18": "centre-val-de-loire", "19": "nouvelle-aquitaine",
  "21": "bourgogne-franche-comte", "22": "bretagne", "23": "nouvelle-aquitaine", "24": "nouvelle-aquitaine",
  "25": "bourgogne-franche-comte", "26": "auvergne-rhone-alpes", "27": "normandie", "28": "centre-val-de-loire",
  "29": "bretagne", "30": "occitanie", "31": "occitanie", "32": "occitanie", "33": "nouvelle-aquitaine",
  "34": "occitanie", "35": "bretagne", "36": "centre-val-de-loire", "37": "centre-val-de-loire",
  "38": "auvergne-rhone-alpes", "39": "bourgogne-franche-comte", "40": "nouvelle-aquitaine", "41": "centre-val-de-loire",
  "42": "auvergne-rhone-alpes", "43": "auvergne-rhone-alpes", "44": "pays-de-la-loire", "45": "centre-val-de-loire",
  "46": "occitanie", "47": "nouvelle-aquitaine", "48": "occitanie", "49": "pays-de-la-loire", "50": "normandie",
  "51": "grand-est", "52": "grand-est", "53": "pays-de-la-loire", "54": "grand-est", "55": "grand-est",
  "56": "bretagne", "57": "grand-est", "58": "bourgogne-franche-comte", "59": "hauts-de-france",
  "60": "hauts-de-france", "61": "normandie", "62": "hauts-de-france", "63": "auvergne-rhone-alpes",
  "64": "nouvelle-aquitaine", "65": "occitanie", "66": "occitanie", "67": "grand-est", "68": "grand-est",
  "69": "auvergne-rhone-alpes", "70": "bourgogne-franche-comte", "71": "bourgogne-franche-comte",
  "72": "pays-de-la-loire", "73": "auvergne-rhone-alpes", "74": "auvergne-rhone-alpes", "75": "ile-de-france",
  "76": "normandie", "77": "ile-de-france", "78": "ile-de-france", "79": "nouvelle-aquitaine",
  "80": "hauts-de-france", "81": "occitanie", "82": "occitanie", "83": "provence-alpes-cote-d-azur",
  "84": "provence-alpes-cote-d-azur", "85": "pays-de-la-loire", "86": "nouvelle-aquitaine", "87": "nouvelle-aquitaine",
  "88": "grand-est", "89": "bourgogne-franche-comte", "90": "bourgogne-franche-comte", "91": "ile-de-france",
  "92": "ile-de-france", "93": "ile-de-france", "94": "ile-de-france", "95": "ile-de-france",
};

function deaccentLower(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function normalizeRegion(locationText: string | null): string | null {
  if (!locationText) return null;
  const lower = deaccentLower(locationText).trim();
  for (const [dept, region] of Object.entries(DEPARTMENT_TO_REGION)) {
    if (lower.includes(dept)) return region;
  }
  for (const [city, region] of Object.entries(CITY_REGION_HINTS)) {
    if (lower.includes(city)) return region;
  }
  const postalMatch = lower.match(/\b(\d{5})\b/);
  if (postalMatch) {
    const dept2 = postalMatch[1].substring(0, 2);
    if (POSTAL_DEPT_TO_REGION[dept2]) return POSTAL_DEPT_TO_REGION[dept2];
  }
  return null;
}

export function normalizeRegionFromCountryCity(text: string | null): string | null {
  if (!text) return null;
  const city = text.split(",")[0].trim().toLowerCase();
  return CITY_REGION_HINTS[city] || null;
}
