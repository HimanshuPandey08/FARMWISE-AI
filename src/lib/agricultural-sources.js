export const AGRICULTURAL_SOURCES = [
  {
    id: "icar",
    name: "Indian Council of Agricultural Research",
    publisher: "ICAR",
    baseUrl: "https://icar.gov.in",
    approvedDomains: ["icar.gov.in", "icar.org.in"],
    urls: [
      "https://icar.gov.in/en/kharif-agro-advisory-farmers",
      "https://icar.gov.in/en/institutions",
    ],
    crops: ["rice", "wheat", "maize", "pulses", "vegetables"],
    topics: [
      "crop-management",
      "disease",
      "pest",
      "prevention",
      "agro-advisory",
    ],
    regions: ["India"],
    languages: ["en", "hi"],
    enabled: true,
  },
  {
    id: "iiwbr",
    name: "ICAR-Indian Institute of Wheat and Barley Research",
    publisher: "ICAR-IIWBR",
    baseUrl: "https://iiwbr.org.in",
    approvedDomains: ["iiwbr.org.in"],
    urls: ["https://iiwbr.org.in/crop-advisory/"],
    crops: ["wheat", "barley"],
    topics: [
      "disease",
      "pest",
      "crop-management",
      "prevention",
      "crop-advisory",
    ],
    regions: ["India"],
    languages: ["en", "hi"],
    enabled: true,
  },
  {
    id: "iihr",
    name: "ICAR-Indian Institute of Horticultural Research",
    publisher: "ICAR-IIHR",
    baseUrl: "https://www.iihr.res.in",
    approvedDomains: ["iihr.res.in"],
    urls: ["https://www.iihr.res.in/"],
    crops: [
      "tomato",
      "chilli",
      "mango",
      "banana",
      "vegetables",
      "fruits",
      "horticultural-crops",
    ],
    topics: [
      "disease",
      "pest",
      "prevention",
      "crop-management",
      "horticulture",
    ],
    regions: ["India"],
    languages: ["en"],
    enabled: true,
  },
  {
    id: "iari",
    name: "ICAR-Indian Agricultural Research Institute",
    publisher: "ICAR-IARI",
    baseUrl: "https://iari.res.in",
    approvedDomains: ["iari.res.in"],
    urls: ["https://iari.res.in/"],
    crops: ["wheat", "rice", "maize", "pulses", "vegetables"],
    topics: [
      "disease",
      "pest",
      "crop-management",
      "prevention",
      "research",
    ],
    regions: ["India"],
    languages: ["en"],
    enabled: true,
  },
];


const CROP_ALIASES = {
  paddy: "rice",
  "green gram": "pulses",
  moong: "pulses",
  lentil: "pulses",
  chickpea: "pulses",
  gram: "pulses",
  okra: "vegetables",
  bhindi: "vegetables",
  potato: "vegetables",
  apple: "fruits",
  citrus: "fruits",
};

function normalizeText(value = "") {
  return String(value).toLowerCase().trim();
}

export function selectAgriculturalSources({
  cropName = "",
  suspectedDiseases = [],
} = {}) {
  const crop = normalizeText(cropName);
  const normalizedCrop = CROP_ALIASES[crop] || crop;

  const diseases = Array.isArray(suspectedDiseases)
    ? suspectedDiseases.map(normalizeText)
    : [normalizeText(suspectedDiseases)];

  const matched = AGRICULTURAL_SOURCES.filter((source) => {
    if (!source.enabled) return false;

    const cropMatch = source.crops.some(
      (item) =>
        item === normalizedCrop ||
        item === crop ||
        (item === "vegetables" &&
          ["tomato", "chilli", "onion", "brinjal"].includes(crop)) ||
        (item === "fruits" &&
          ["mango", "banana", "apple", "citrus"].includes(crop))
    );

    return cropMatch;
  });

  // ICAR is the general fallback when no crop-specific source matches.
  const selected = matched.length
    ? matched
    : AGRICULTURAL_SOURCES.filter(
        (source) => source.enabled && source.id === "icar"
      );

  return selected.map((source) => ({
    id: source.id,
    name: source.name,
    publisher: source.publisher,
    urls: source.urls,
    approvedDomains: source.approvedDomains,
    relevantDiseases: diseases,
  }));
}