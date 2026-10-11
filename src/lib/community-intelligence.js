import { db } from "./mongodb.js";

/**
 * Deterministic thresholds and configuration for Community Disease Intelligence.
 */
export const INTELLIGENCE_CONFIG = Object.freeze({
  // Minimum distinct farmers reporting before publishing an area signal (privacy threshold)
  MIN_CONTRIBUTORS_FOR_PUBLIC_STATS: 3,

  // Minimum reports and contributors required to establish a disease watch or signal
  MIN_REPORTS_FOR_WATCH: 3,
  MIN_CONTRIBUTORS_FOR_WATCH: 2,

  // Thresholds for classifying elevated signal vs watch
  MIN_REPORTS_FOR_ELEVATED: 5,
  MIN_CONTRIBUTORS_FOR_ELEVATED: 3,
  ELEVATED_SURGE_RATIO: 1.5, // 50% increase over preceding baseline

  // Minimum AI prediction probability to consider record eligible
  MIN_DISEASE_PROBABILITY: 0.50,

  // Supported observation windows in days
  SUPPORTED_TIME_RANGES: Object.freeze([7, 14, 30]),
  DEFAULT_TIME_RANGE: 14,
});

/**
 * Normalizes crop names into clean, standardized title-case labels.
 */
export function normalizeCropName(rawCrop) {
  if (!rawCrop || typeof rawCrop !== "string") return "Unknown Crop";
  const cleaned = rawCrop.trim().toLowerCase();
  if (!cleaned) return "Unknown Crop";

  // Common synonym normalization for Indian agriculture
  if (cleaned.includes("wheat") || cleaned.includes("gehun")) return "Wheat";
  if (cleaned.includes("tomato") || cleaned.includes("tamatar")) return "Tomato";
  if (cleaned.includes("potato") || cleaned.includes("aloo")) return "Potato";
  if (cleaned.includes("rice") || cleaned.includes("paddy") || cleaned.includes("dhan")) return "Rice (Paddy)";
  if (cleaned.includes("pumpkin") || cleaned.includes("kaddu")) return "Pumpkin";
  if (cleaned.includes("mango") || cleaned.includes("aam")) return "Mango";
  if (cleaned.includes("cotton") || cleaned.includes("kapas")) return "Cotton";
  if (cleaned.includes("chilli") || cleaned.includes("chili") || cleaned.includes("mirch")) return "Chilli";
  if (cleaned.includes("maize") || cleaned.includes("corn") || cleaned.includes("makka")) return "Maize";
  if (cleaned.includes("mustard") || cleaned.includes("sarson")) return "Mustard";
  if (cleaned.includes("onion") || cleaned.includes("pyaz")) return "Onion";
  if (cleaned.includes("sugarcane") || cleaned.includes("ganna")) return "Sugarcane";
  if (cleaned.includes("grape") || cleaned.includes("angoor")) return "Grapevine";
  if (cleaned.includes("citrus") || cleaned.includes("lemon") || cleaned.includes("nimbu")) return "Citrus";

  // Title-case fallback
  return cleaned
    .split(/[\s_-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Normalizes disease names, strips scientific parentheticals, and excludes healthy states.
 */
export function normalizeDiseaseName(rawDisease) {
  if (!rawDisease || typeof rawDisease !== "string") return null;
  const cleaned = rawDisease.trim().toLowerCase();
  if (!cleaned) return null;

  // Non-disease or healthy states should not trigger alerts
  if (
    cleaned === "healthy" ||
    cleaned.includes("no disease") ||
    cleaned.includes("no diseases") ||
    cleaned === "normal"
  ) {
    return "Healthy Plant";
  }

  // Remove scientific parentheticals (e.g. "Early blight (Alternaria solani)" -> "Early blight")
  const stripped = cleaned.replace(/\s*\([^)]*\)/g, "").trim();

  // Common normalizations
  if (stripped.includes("powdery mildew")) return "Powdery Mildew";
  if (stripped.includes("downy mildew")) return "Downy Mildew";
  if (stripped.includes("early blight")) return "Early Blight";
  if (stripped.includes("late blight")) return "Late Blight";
  if (stripped.includes("yellow rust") || stripped.includes("stripe rust")) return "Yellow (Stripe) Rust";
  if (stripped.includes("brown rust") || stripped.includes("leaf rust")) return "Brown (Leaf) Rust";
  if (stripped.includes("verticillium wilt")) return "Verticillium Wilt";
  if (stripped.includes("fusarium wilt")) return "Fusarium Wilt";
  if (stripped.includes("leaf spot") || stripped.includes("cercospora")) return "Leaf Spot";
  if (stripped.includes("blast")) return "Blast Disease";
  if (stripped.includes("bacterial blight")) return "Bacterial Blight";
  if (stripped.includes("false smut")) return "False Smut";
  if (stripped.includes("nutrient deficiency")) return "Nutrient Deficiency";

  // General title-case
  return stripped
    .split(/[\s_-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Coarsens and normalizes location strings into privacy-safe regional labels (e.g. District / City).
 * Strips street names, house numbers, or specific landmarks.
 */
export function normalizeGeographicArea(rawLocation) {
  if (!rawLocation || typeof rawLocation !== "string") return null;
  const trimmed = rawLocation.trim();
  if (!trimmed || trimmed.length < 2) return null;

  // Coordinate detection: coarse rounding (2 decimal places ~ 1.1km) for privacy preservation
  const coordMatch = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (coordMatch) {
    const lat = parseFloat(coordMatch[1]);
    const lon = parseFloat(coordMatch[2]);
    if (!Number.isNaN(lat) && !Number.isNaN(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
      const latDir = lat >= 0 ? "N" : "S";
      const lonDir = lon >= 0 ? "E" : "W";
      return `Area (${Math.abs(lat).toFixed(2)}${latDir}, ${Math.abs(lon).toFixed(2)}${lonDir})`;
    }
  }

  // Split comma or dash separated locations (e.g. "Village X, Prayagraj, UP, India" -> "Prayagraj")
  const parts = trimmed
    .split(/[,;\-]+/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length === 0) return null;

  // Known country names to exclude if solitary
  const nonAreaWords = new Set(["india", "bharat", "asia", "na", "null", "undefined"]);

  // Pick the most specific regional/district token
  let candidate = parts[0];
  if (parts.length > 1) {
    // If first part looks like a village or street, pick district part if available
    const nonCountry = parts.filter((p) => !nonAreaWords.has(p.toLowerCase()));
    if (nonCountry.length >= 2) {
      candidate = nonCountry[nonCountry.length - 2]; // Usually District in "Village, District, State"
    } else if (nonCountry.length === 1) {
      candidate = nonCountry[0];
    }
  }

  const cleanCandidate = candidate.trim().toLowerCase();
  if (cleanCandidate.length < 2 || nonAreaWords.has(cleanCandidate)) {
    return null;
  }

  // Title-case result
  return cleanCandidate
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Evaluates aggregated reports against baseline to determine deterministic signal status.
 */
export function evaluateSignalStatus({
  currentReports,
  distinctContributors,
  baselineReports = 0,
  baselineContributors = 0,
}) {
  const {
    MIN_CONTRIBUTORS_FOR_PUBLIC_STATS,
    MIN_REPORTS_FOR_WATCH,
    MIN_CONTRIBUTORS_FOR_WATCH,
    MIN_REPORTS_FOR_ELEVATED,
    MIN_CONTRIBUTORS_FOR_ELEVATED,
    ELEVATED_SURGE_RATIO,
  } = INTELLIGENCE_CONFIG;

  // Privacy protection: small-group reporting cannot be presented as community pattern
  if (distinctContributors < MIN_CONTRIBUTORS_FOR_WATCH) {
    return {
      status: "insufficient_data",
      evidenceLevel: "low",
      trend: "insufficient_data",
      explanation: `Only ${distinctContributors} contributing user reported in this window. Minimum ${MIN_CONTRIBUTORS_FOR_WATCH} independent contributors required to establish a community signal.`,
    };
  }

  // Determine trend direction
  let trend = "stable";
  if (baselineReports === 0) {
    trend = "new_signal";
  } else if (currentReports >= baselineReports * ELEVATED_SURGE_RATIO) {
    trend = "surging";
  } else if (currentReports >= baselineReports * 1.2) {
    trend = "rising";
  } else if (currentReports <= baselineReports * 0.7) {
    trend = "declining";
  }

  // Check for Elevated Signal
  const isSurge =
    baselineReports > 0 &&
    currentReports >= baselineReports * ELEVATED_SURGE_RATIO;

  const isStrongCount =
    currentReports >= MIN_REPORTS_FOR_ELEVATED &&
    distinctContributors >= MIN_CONTRIBUTORS_FOR_ELEVATED;

  if (isStrongCount || (isSurge && distinctContributors >= MIN_CONTRIBUTORS_FOR_WATCH)) {
    return {
      status: "elevated_signal",
      evidenceLevel: distinctContributors >= MIN_CONTRIBUTORS_FOR_ELEVATED ? "high" : "moderate",
      trend,
      explanation: `Elevated disease signal: ${currentReports} reports from ${distinctContributors} independent farmers (compared to ${baselineReports} in prior period).`,
    };
  }

  // Check for Watch
  if (
    currentReports >= MIN_REPORTS_FOR_WATCH &&
    distinctContributors >= MIN_CONTRIBUTORS_FOR_WATCH
  ) {
    return {
      status: "watch",
      evidenceLevel: "moderate",
      trend,
      explanation: `Observation watch: ${currentReports} reports from ${distinctContributors} independent farmers. Signal is persistent across multiple farms.`,
    };
  }

  return {
    status: "insufficient_data",
    evidenceLevel: "low",
    trend,
    explanation: `Current report volume (${currentReports} reports, ${distinctContributors} contributor) is below the minimum threshold for active signal classification.`,
  };
}

/**
 * Generates sensible, non-prescriptive agronomic guidance for an emerging signal.
 */
export function getRecommendedAction(disease, crop) {
  return {
    preventativeAction: `Visually inspect ${crop} fields for early symptomatic foliage or lesions. Avoid overhead watering to limit prolonged leaf wetness.`,
    scoutingAdvice: `Examine lower canopy leaves and stems for signs typical of ${disease}. Document progression in morning daylight.`,
    actions: [
      `Visually inspect ${crop} fields for early symptomatic foliage or lesions.`,
      "Document and photograph affected leaves in morning daylight to monitor progression.",
      "Avoid unnecessary prophylactic pesticide spraying unless field symptoms are verified.",
      "Check local Krishi Vigyan Kendra (KVK) or extension advisory bulletin for current advisories.",
    ],
    disclaimer: "Non-prescriptive community intelligence. Consult your local Krishi Vigyan Kendra (KVK) for chemical treatment decisions.",
  };
}

/**
 * Primary server-side function to aggregate eligible community diagnoses.
 * Executes MongoDB aggregations and calculates community intelligence metrics.
 */
export async function getCommunityIntelligence({
  area = null,
  crop = null,
  timeRangeDays = INTELLIGENCE_CONFIG.DEFAULT_TIME_RANGE,
} = {}) {
  const days = INTELLIGENCE_CONFIG.SUPPORTED_TIME_RANGES.includes(Number(timeRangeDays))
    ? Number(timeRangeDays)
    : INTELLIGENCE_CONFIG.DEFAULT_TIME_RANGE;

  const now = new Date();
  const currentWindowStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const baselineWindowStart = new Date(now.getTime() - days * 2 * 24 * 60 * 60 * 1000);

  // 1. Fetch eligible records within both the current window and baseline window
  const rawRecords = await db
    .collection("diagnoses")
    .find(
      {
        createdAt: { $gte: baselineWindowStart, $lte: now },
        location: { $exists: true, $ne: null, $ne: "" },
        cropName: { $exists: true, $ne: null, $ne: "" },
        "diagnosis.diseases": { $exists: true, $type: "array", $ne: [] },
      },
      {
        projection: {
          _id: 1,
          userId: 1,
          cropName: 1,
          location: 1,
          diagnosis: 1,
          createdAt: 1,
        },
      }
    )
    .toArray();

  // 2. Preprocess and normalize records in application memory for robust grouping
  const normalizedRecords = [];
  for (const doc of rawRecords) {
    const rawCrop = doc.cropName || doc.diagnosis?.crop?.name;
    const normalizedCrop = normalizeCropName(rawCrop);
    const normalizedArea = normalizeGeographicArea(doc.location);

    if (!normalizedArea) continue; // Skip unresolvable locations

    const topDisease = doc.diagnosis?.diseases?.[0];
    if (!topDisease) continue;

    const normalizedDisease = normalizeDiseaseName(topDisease.name);
    if (!normalizedDisease) continue;

    const probability = Number(topDisease.probability) || 0;
    const isHealthy = normalizedDisease === "Healthy Plant";

    // Eligible if probability is at least configured threshold or healthy status
    if (!isHealthy && probability < INTELLIGENCE_CONFIG.MIN_DISEASE_PROBABILITY) {
      continue;
    }

    const createdAt = new Date(doc.createdAt);
    const isCurrentWindow = createdAt >= currentWindowStart;
    const isBaselineWindow = createdAt >= baselineWindowStart && createdAt < currentWindowStart;

    normalizedRecords.push({
      id: doc._id.toString(),
      userId: String(doc.userId || "anonymous"),
      crop: normalizedCrop,
      area: normalizedArea,
      disease: normalizedDisease,
      isHealthy,
      probability,
      createdAt,
      isCurrentWindow,
      isBaselineWindow,
    });
  }

  // 3. Extract all available filter values across all known data
  const availableAreasSet = new Set();
  const availableCropsSet = new Set();
  for (const r of normalizedRecords) {
    if (r.isCurrentWindow) {
      availableAreasSet.add(r.area);
      availableCropsSet.add(r.crop);
    }
  }

  const availableAreas = Array.from(availableAreasSet).sort();
  const availableCrops = Array.from(availableCropsSet).sort();

  // 4. Apply user filters if specified
  const filteredArea = area ? normalizeGeographicArea(area) : null;
  const filteredCrop = crop ? normalizeCropName(crop) : null;

  const currentRecords = normalizedRecords.filter((r) => {
    if (!r.isCurrentWindow) return false;
    if (filteredArea && r.area.toLowerCase() !== filteredArea.toLowerCase()) return false;
    if (filteredCrop && r.crop.toLowerCase() !== filteredCrop.toLowerCase()) return false;
    return true;
  });

  const baselineRecords = normalizedRecords.filter((r) => {
    if (!r.isBaselineWindow) return false;
    if (filteredArea && r.area.toLowerCase() !== filteredArea.toLowerCase()) return false;
    if (filteredCrop && r.crop.toLowerCase() !== filteredCrop.toLowerCase()) return false;
    return true;
  });

  // 5. Aggregate Top Diseases (Excluding "Healthy Plant" from disease rankings)
  const diseaseMap = new Map();
  const cropMap = new Map();
  const areaMap = new Map();

  for (const r of currentRecords) {
    // Crop breakdown
    cropMap.set(r.crop, (cropMap.get(r.crop) || 0) + 1);

    // Area breakdown
    areaMap.set(r.area, (areaMap.get(r.area) || 0) + 1);

    // Disease breakdown
    if (!r.isHealthy) {
      const entry = diseaseMap.get(r.disease) || {
        disease: r.disease,
        count: 0,
        crops: new Set(),
        areas: new Set(),
      };
      entry.count += 1;
      entry.crops.add(r.crop);
      entry.areas.add(r.area);
      diseaseMap.set(r.disease, entry);
    }
  }

  const topDiseases = Array.from(diseaseMap.values())
    .map((d) => ({
      disease: d.disease,
      count: d.count,
      cropsCount: d.crops.size,
      areasCount: d.areas.size,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const cropDistribution = Array.from(cropMap.entries())
    .map(([cropName, count]) => ({ crop: cropName, count }))
    .sort((a, b) => b.count - a.count);

  // 6. Cluster signals by [area, crop, disease]
  const clusterMap = new Map();

  for (const r of currentRecords) {
    if (r.isHealthy) continue; // Signals are for disease patterns

    const key = `${r.area}::${r.crop}::${r.disease}`;
    const cluster = clusterMap.get(key) || {
      area: r.area,
      crop: r.crop,
      disease: r.disease,
      currentReports: 0,
      contributors: new Set(),
      latestDate: r.createdAt,
    };

    cluster.currentReports += 1;
    cluster.contributors.add(r.userId);
    if (r.createdAt > cluster.latestDate) {
      cluster.latestDate = r.createdAt;
    }
    clusterMap.set(key, cluster);
  }

  // Calculate baseline counts for each cluster
  const baselineClusterCounts = new Map();
  for (const r of baselineRecords) {
    if (r.isHealthy) continue;
    const key = `${r.area}::${r.crop}::${r.disease}`;
    const b = baselineClusterCounts.get(key) || { count: 0, contributors: new Set() };
    b.count += 1;
    b.contributors.add(r.userId);
    baselineClusterCounts.set(key, b);
  }

  // 7. Evaluate and format detected signals
  const signals = [];

  for (const [key, cluster] of clusterMap.entries()) {
    const baseline = baselineClusterCounts.get(key) || { count: 0, contributors: new Set() };
    const distinctContributorsCount = cluster.contributors.size;

    const evaluation = evaluateSignalStatus({
      currentReports: cluster.currentReports,
      distinctContributors: distinctContributorsCount,
      baselineReports: baseline.count,
      baselineContributors: baseline.contributors.size,
    });

    // Privacy suppression: If contributors are below minimum privacy threshold,
    // redact exact contributor counts in public results to prevent small-group inference
    const isPublicStatAllowed =
      distinctContributorsCount >= INTELLIGENCE_CONFIG.MIN_CONTRIBUTORS_FOR_PUBLIC_STATS;

    signals.push({
      id: Buffer.from(key).toString("base64url").slice(0, 16),
      area: cluster.area,
      crop: cluster.crop,
      disease: cluster.disease,
      timeWindowDays: days,
      reportCount: cluster.currentReports,
      contributorCount: isPublicStatAllowed ? distinctContributorsCount : null,
      contributorCountDisplay: isPublicStatAllowed
        ? `${distinctContributorsCount} independent farms`
        : "Small sample (suppressed for privacy)",
      baselineReportCount: baseline.count,
      status: evaluation.status,
      evidenceLevel: evaluation.evidenceLevel,
      trend: evaluation.trend,
      explanation: evaluation.explanation,
      lastObservedAt: cluster.latestDate.toISOString(),
      recommendations: getRecommendedAction(cluster.disease, cluster.crop),
    });
  }

  // Sort signals: elevated_signal first, then watch, then by reportCount descending
  const statusWeight = { elevated_signal: 3, watch: 2, insufficient_data: 1 };
  signals.sort((a, b) => {
    const diff = (statusWeight[b.status] || 0) - (statusWeight[a.status] || 0);
    if (diff !== 0) return diff;
    return b.reportCount - a.reportCount;
  });

  const totalEligibleReports = currentRecords.length;
  const distinctAreasCount = availableAreasSet.size;
  const hasInsufficientData = totalEligibleReports < INTELLIGENCE_CONFIG.MIN_REPORTS_FOR_WATCH;

  return {
    meta: {
      timeRangeDays: days,
      windowStart: currentWindowStart.toISOString(),
      windowEnd: now.toISOString(),
      appliedAreaFilter: filteredArea,
      appliedCropFilter: filteredCrop,
      lastUpdated: now.toISOString(),
    },
    summary: {
      totalEligibleReports,
      distinctAreasCount,
      activeSignalsCount: signals.filter((s) => s.status !== "insufficient_data").length,
      insufficientData: hasInsufficientData,
      insufficientDataMessage: hasInsufficientData
        ? `Community data currently sparse for this selection (${totalEligibleReports} reports). A minimum of ${INTELLIGENCE_CONFIG.MIN_REPORTS_FOR_WATCH} verified reports across multiple independent farmers is required before early-warning signals can be reliably established.`
        : null,
      topDiseases,
      cropDistribution,
    },
    signals,
    filters: {
      areas: availableAreas,
      crops: availableCrops,
      timeRanges: INTELLIGENCE_CONFIG.SUPPORTED_TIME_RANGES,
    },
  };
}
