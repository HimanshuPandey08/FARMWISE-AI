
export const DEFAULT_GEMINI_MODELS = Object.freeze([
  "gemini-3.6-flash",
  "gemini-3.8-flash",
  "gemini-flash-latest",
]);

export function getGeminiModels() {
  const envModel = process.env.GEMINI_MODEL?.trim();
  if (envModel) {
    return [envModel, ...DEFAULT_GEMINI_MODELS.filter((m) => m !== envModel)];
  }
  return [...DEFAULT_GEMINI_MODELS];
}

export const GEMINI_MODELS = getGeminiModels();
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const REQUEST_TIMEOUT_MS = 25000;

function sanitizeErrorMessage(msg) {
  if (typeof msg !== "string") return "";
  return msg
    .replace(/key=[a-zA-Z0-9_\-]+/gi, "key=[REDACTED]")
    .replace(/Bearer\s+[a-zA-Z0-9_\-]+/gi, "Bearer [REDACTED]");
}

/**
 * Builds the controlled agronomic recommendation prompt for Gemini.
 */
export function buildRecommendationPrompt({
  cropName,
  cropAge,
  ageUnit,
  soilType,
  location,
  budget,
  diagnosis,
  weather,
  agriculturalEvidence = [],
}) {
  const topDisease = diagnosis?.diseases?.[0];
  const diseaseName = topDisease?.name || "Unspecified condition / general distress";
  const diseaseConfidence =
    typeof topDisease?.probability === "number"
      ? `${(topDisease.probability * 100).toFixed(1)}%`
      : "Not provided";
  const otherDiseases = (diagnosis?.diseases || [])
    .slice(1, 4)
    .map((d) => `${d.name} (${typeof d.probability === "number" ? (d.probability * 100).toFixed(1) + "%" : "N/A"})`)
    .join(", ");

  let weatherSection = "Current weather data is currently unavailable for this farm.";
  if (weather && weather.available) {
    weatherSection = `
- Resolved Location: ${weather.resolvedLocation || location}
- Temperature: ${weather.temperatureC ?? "N/A"} °C
- Relative Humidity: ${weather.humidityPercent ?? "N/A"}%
- Current Precipitation: ${weather.precipitationMm ?? 0} mm
- Forecast Precipitation (24h): ${weather.precipitationForecastMm ?? "N/A"} mm
- Max Rain Probability: ${weather.precipitationProbabilityMax ?? "N/A"}%
- Wind Speed: ${weather.windSpeedKmh ?? "N/A"} km/h
- Operational Spray Advisory: ${weather.sprayAdvisory || "Standard conditions"}
`.trim();
  }

  let evidenceSection = "No official institutional agricultural advisory bulletins could be retrieved for this crop/disease combination.";
  if (Array.isArray(agriculturalEvidence) && agriculturalEvidence.length > 0) {
    evidenceSection = agriculturalEvidence
      .map((ev, index) => {
        return `[Source ${index + 1}]
Title: ${ev.title}
Publisher: ${ev.publisher || ev.sourceName || "Agricultural Institution"}
URL: ${ev.url}
Verified Content Excerpt:
${(ev.content || "").slice(0, 1500)}
`;
      })
      .join("\n---\n");
  }

  return `You are FarmWise AI, an expert, conservative agricultural advisor specializing in Indian agronomy and crop disease management.

FARMER CONTEXT:
- Crop: ${cropName}
- Crop Stage / Age: ${cropAge} ${ageUnit || "days"}
- Soil Type: ${soilType}
- Farm Location: ${location}
- Farmer Treatment Budget: ${budget ? "₹" + budget : "Not specified"}

DISEASE SCREENING (AUTOMATED COMPUTER VISION ESTIMATE):
- Most Likely Suspected Disease: ${diseaseName}
- AI Screening Confidence: ${diseaseConfidence}
- Other Potential Matches: ${otherDiseases || "None noted"}
CRITICAL NOTICE: This is an automated visual identification estimate and is NOT a laboratory-confirmed diagnosis. Always recommend initial non-destructive field verification before chemical intervention.

WEATHER CONDITIONS & OPERATIONAL CONSTRAINTS:
${weatherSection}

GROUNDED AGRICULTURAL EVIDENCE:
${evidenceSection}

INSTRUCTIONS & RULES:
1. Ground your recommendations on verified agronomic practices and the provided agricultural evidence.
2. DO NOT hallucinate pesticide dosages or dangerous chemical mixtures. Prefer approved Central Insecticide Board & Registration Committee (CIBRC) / ICAR guidelines.
3. If weather indicates imminent rain (>= 5 mm) or wind (> 15 km/h), EXPLICITLY advise against foliar spraying to prevent chemical wash-off and environmental contamination.
4. In "whatToDo", prioritize:
   a. Cultural practices and immediate field sanitation (removing infected leaves).
   b. Safe organic / bio-control remedies (e.g. Neem formulations, Trichoderma).
   c. If chemical intervention is warranted, provide targeted, approved fungicide/insecticide names with standard dilution rates (e.g. per litre of water), keeping within the farmer's budget if possible.
5. In "whatToAvoid", warn against common damaging mistakes (e.g. overhead irrigation, overdosing, spraying during heat of the day, mixing incompatible chemicals).
6. In "estimatedCost", estimate the treatment cost in INR (Indian Rupees) with an explicit explanation of what it covers. If budget was specified, evaluate whether the plan fits within budget.
7. In "sources", cite ONLY the exact URLs and titles provided in the GROUNDED AGRICULTURAL EVIDENCE above. If no evidence was provided, return an empty array []. NEVER fabricate citations or URLs.
8. Output MUST be valid, parseable JSON only conforming strictly to the requested schema.

RESPONSE JSON SCHEMA:
{
  "summary": "Concise 1-2 sentence overview of diagnosis and primary recommendation",
  "diagnosis": {
    "diseaseName": "${diseaseName}",
    "confidence": ${typeof topDisease?.probability === "number" ? topDisease.probability : "null"},
    "severity": "Mild" | "Moderate" | "Severe",
    "isConfirmed": false
  },
  "weather": {
    "available": ${weather?.available ? "true" : "false"},
    "temperatureC": ${typeof weather?.temperatureC === "number" ? weather.temperatureC : "null"},
    "humidityPercent": ${typeof weather?.humidityPercent === "number" ? weather.humidityPercent : "null"},
    "precipitationForecastMm": ${typeof weather?.precipitationForecastMm === "number" ? weather.precipitationForecastMm : "null"},
    "windSpeedKmh": ${typeof weather?.windSpeedKmh === "number" ? weather.windSpeedKmh : "null"},
    "sprayAdvisory": "${weather?.sprayAdvisory ? weather.sprayAdvisory.replace(/"/g, "'") : ""}",
    "retrievedAt": "${weather?.retrievedAt || new Date().toISOString()}"
  },
  "actionPlan": {
    "whatToDo": [
      "Step 1...",
      "Step 2..."
    ],
    "whatToAvoid": [
      "Avoid 1...",
      "Avoid 2..."
    ],
    "estimatedCost": {
      "amount": 450,
      "currency": "INR",
      "basis": "Explanation of treatment costs and inputs"
    },
    "riskIfUntreated": "Consequences of delayed intervention...",
    "checkAgainInDays": 5
  },
  "reasoning": [
    "Agronomic reasoning point 1...",
    "Agronomic reasoning point 2..."
  ],
  "sources": [
    {
      "title": "Title from provided evidence",
      "url": "https://..."
    }
  ]
}`;
}

/**
 * Validates and sanitizes Gemini JSON output against the required contract.
 */
export function validateRecommendation(raw, { diagnosis, weather, agriculturalEvidence = [] }) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Gemini response is not a valid JSON object.");
  }

  const topDisease = diagnosis?.diseases?.[0];
  const expectedDiseaseName = topDisease?.name || "Unspecified condition";

  // Validate Summary
  const summary =
    typeof raw.summary === "string" && raw.summary.trim().length > 0
      ? raw.summary.trim()
      : `Diagnosis recommendations for ${expectedDiseaseName}.`;

  // Validate Diagnosis block
  const rawDiag = raw.diagnosis || {};
  const validatedDiagnosis = {
    diseaseName:
      typeof rawDiag.diseaseName === "string" && rawDiag.diseaseName.trim()
        ? rawDiag.diseaseName.trim()
        : expectedDiseaseName,
    confidence:
      typeof rawDiag.confidence === "number"
        ? Math.min(Math.max(rawDiag.confidence, 0), 1)
        : typeof topDisease?.probability === "number"
        ? topDisease.probability
        : null,
    severity: ["Mild", "Moderate", "Severe"].includes(rawDiag.severity)
      ? rawDiag.severity
      : "Moderate",
    isConfirmed: false, // Must remain false as this is an AI visual estimate
  };

  // Validate Weather block
  const rawWeather = raw.weather || {};
  const validatedWeather = {
    available: Boolean(weather?.available ?? rawWeather.available),
    temperatureC:
      typeof weather?.temperatureC === "number"
        ? weather.temperatureC
        : typeof rawWeather.temperatureC === "number"
        ? rawWeather.temperatureC
        : null,
    humidityPercent:
      typeof weather?.humidityPercent === "number"
        ? weather.humidityPercent
        : typeof rawWeather.humidityPercent === "number"
        ? rawWeather.humidityPercent
        : null,
    precipitationForecastMm:
      typeof weather?.precipitationForecastMm === "number"
        ? weather.precipitationForecastMm
        : typeof rawWeather.precipitationForecastMm === "number"
        ? rawWeather.precipitationForecastMm
        : null,
    windSpeedKmh:
      typeof weather?.windSpeedKmh === "number"
        ? weather.windSpeedKmh
        : typeof rawWeather.windSpeedKmh === "number"
        ? rawWeather.windSpeedKmh
        : null,
    sprayAdvisory:
      weather?.sprayAdvisory ||
      (typeof rawWeather.sprayAdvisory === "string" ? rawWeather.sprayAdvisory : null),
    retrievedAt: weather?.retrievedAt || rawWeather.retrievedAt || new Date().toISOString(),
  };

  // Validate Action Plan
  const rawPlan = raw.actionPlan || {};

  const whatToDo = Array.isArray(rawPlan.whatToDo)
    ? rawPlan.whatToDo.filter((item) => typeof item === "string" && item.trim().length > 0)
    : [];

  if (whatToDo.length === 0) {
    whatToDo.push("Inspect the affected plants daily and isolate diseased foliage.");
    whatToDo.push("Consult your nearest Krishi Vigyan Kendra (KVK) or extension officer for local confirmation.");
  }

  const whatToAvoid = Array.isArray(rawPlan.whatToAvoid)
    ? rawPlan.whatToAvoid.filter((item) => typeof item === "string" && item.trim().length > 0)
    : [];

  if (whatToAvoid.length === 0) {
    whatToAvoid.push("Avoid overhead sprinkler irrigation while leaves show active lesions.");
    whatToAvoid.push("Do not apply unverified chemical mixtures or exceed recommended application rates.");
  }

  const rawCost = rawPlan.estimatedCost || {};
  const estimatedCost = {
    amount:
      typeof rawCost.amount === "number" && rawCost.amount >= 0
        ? Math.round(rawCost.amount)
        : null,
    currency: "INR",
    basis:
      typeof rawCost.basis === "string" && rawCost.basis.trim()
        ? rawCost.basis.trim()
        : null,
  };

  const riskIfUntreated =
    typeof rawPlan.riskIfUntreated === "string" && rawPlan.riskIfUntreated.trim()
      ? rawPlan.riskIfUntreated.trim()
      : "If untreated, fungal and bacterial pathogens can spread rapidly to neighboring crop rows, leading to significant yield loss.";

  const checkAgainInDays =
    typeof rawPlan.checkAgainInDays === "number" && rawPlan.checkAgainInDays > 0
      ? Math.round(rawPlan.checkAgainInDays)
      : 5;

  // Validate Reasoning
  const reasoning = Array.isArray(raw.reasoning)
    ? raw.reasoning.filter((item) => typeof item === "string" && item.trim().length > 0)
    : ["Recommendations are tailored to the detected visual symptoms and current local weather conditions."];

  // Validate Sources (Crucial: filter out hallucinated citations!)
  const approvedUrls = new Set(
    (agriculturalEvidence || [])
      .map((e) => (typeof e?.url === "string" ? e.url.trim().toLowerCase() : ""))
      .filter(Boolean)
  );

  const validatedSources = [];
  if (Array.isArray(raw.sources)) {
    for (const source of raw.sources) {
      if (source && typeof source.url === "string") {
        const normalizedUrl = source.url.trim().toLowerCase();
        // Only accept citations that match retrieved evidence URLs
        if (approvedUrls.has(normalizedUrl)) {
          const matchingEvidence = agriculturalEvidence.find(
            (e) => e?.url?.trim()?.toLowerCase() === normalizedUrl
          );
          validatedSources.push({
            title: source.title || matchingEvidence?.title || "Agricultural Advisory",
            url: source.url.trim(),
            publisher: matchingEvidence?.publisher || matchingEvidence?.sourceName || "Official Agricultural Source",
          });
        }
      }
    }
  }

  return {
    summary,
    diagnosis: validatedDiagnosis,
    weather: validatedWeather,
    actionPlan: {
      whatToDo,
      whatToAvoid,
      estimatedCost,
      riskIfUntreated,
      checkAgainInDays,
    },
    reasoning,
    sources: validatedSources,
  };
}

/**
 * Invokes the Google Gemini API to generate structured agricultural recommendations.
 */
export async function generateGeminiRecommendation({
  cropName,
  cropAge,
  ageUnit,
  soilType,
  location,
  budget,
  diagnosis,
  weather,
  agriculturalEvidence = [],
  models = getGeminiModels(),
}) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured in server environment.");
  }

  const prompt = buildRecommendationPrompt({
    cropName,
    cropAge,
    ageUnit,
    soilType,
    location,
    budget,
    diagnosis,
    weather,
    agriculturalEvidence,
  });

  let lastError = null;
  const candidateModels = Array.isArray(models) && models.length > 0 ? models : getGeminiModels();

  for (const model of candidateModels) {
    try {
      const url = `${GEMINI_API_BASE}/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;

      const response = await fetch(url, {
        method: "POST",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2,
          },
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        const sanitizedBody = sanitizeErrorMessage(errorBody.slice(0, 300));
        const status = response.status;

        console.warn(
          `[Gemini API] Model "${model}" failed (HTTP ${status}): ${sanitizedBody}. Trying fallback model if available...`
        );

        throw new Error(
          `Gemini API (${model}) failed with status ${status}: ${sanitizedBody}`
        );
      }

      const result = await response.json();
      const candidateText =
        result?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!candidateText) {
        console.warn(
          `[Gemini API] Model "${model}" returned an empty candidate response. Trying fallback model if available...`
        );
        throw new Error(`Gemini (${model}) returned an empty candidate response.`);
      }

      let parsedJson;
      try {
        parsedJson = JSON.parse(candidateText);
      } catch (err) {
        // Fallback: extract JSON block if wrapped in markdown code fence
        const jsonMatch =
          candidateText.match(/```json\s*([\s\S]*?)\s*```/) ||
          candidateText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedJson = JSON.parse(jsonMatch[1] || jsonMatch[0]);
        } else {
          console.warn(
            `[Gemini API] Model "${model}" returned non-JSON output. Trying fallback model if available...`
          );
          throw new Error("Could not parse Gemini output as JSON: " + err.message);
        }
      }

      return validateRecommendation(parsedJson, {
        diagnosis,
        weather,
        agriculturalEvidence,
      });
    } catch (err) {
      lastError = err;
      // Continue to next model in list
      continue;
    }
  }

  throw (
    lastError ||
    new Error(
      `Failed to generate recommendations from all attempted Gemini models: ${candidateModels.join(", ")}`
    )
  );
}
