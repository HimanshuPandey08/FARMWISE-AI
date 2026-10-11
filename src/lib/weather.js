
const GEOCODING_BASE_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_BASE_URL = "https://api.open-meteo.com/v1/forecast";
const REQUEST_TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

// In-memory cache to avoid redundant external network calls
const weatherCache = new Map();

function getCached(key) {
  const item = weatherCache.get(key);
  if (!item) return null;
  if (Date.now() - item.timestamp > CACHE_TTL_MS) {
    weatherCache.delete(key);
    return null;
  }
  return item.data;
}

function setCache(key, data) {
  weatherCache.set(key, { data, timestamp: Date.now() });
}

function buildSprayAdvisory({ precipitationForecastMm, precipitationMm, windSpeedKmh, humidityPercent }) {
  if (precipitationForecastMm > 5 || precipitationMm > 2) {
    return "Caution: Rain forecast in the next 24-48 hours. Postpone foliar spraying to prevent chemical wash-off.";
  }
  if (windSpeedKmh > 15) {
    return "Caution: Wind speeds exceed 15 km/h. Avoid foliar spraying to prevent spray drift onto neighboring crops.";
  }
  if (humidityPercent > 85) {
    return "Notice: High atmospheric humidity accelerates fungal incubation. Monitor foliage closely and prioritize early morning sprays if required.";
  }
  return "Favorable: Moderate weather conditions. Suitable for targeted foliar or soil treatment.";
}

/**
 * Geocodes a freeform location string into coordinates using Open-Meteo Geocoding API.
 */
async function geocodeLocation(locationString) {
  if (!locationString || typeof locationString !== "string") {
    return null;
  }

  const trimmed = locationString.trim();

  // Check if coordinates were entered directly: "latitude, longitude"
  const coordMatch = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (coordMatch) {
    const lat = Number(coordMatch[1]);
    const lon = Number(coordMatch[2]);
    if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      return {
        latitude: lat,
        longitude: lon,
        displayName: `${lat.toFixed(3)}, ${lon.toFixed(3)}`,
      };
    }
  }

  // Candidate queries (try full string, then town/district if comma-separated)
  const candidateQueries = [trimmed];
  if (trimmed.includes(",")) {
    const parts = trimmed.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length > 1) {
      candidateQueries.push(parts[parts.length - 1]); // e.g. state or major district
      candidateQueries.push(parts[0]); // e.g. town
    }
  }

  for (const query of candidateQueries) {
    try {
      const url = new URL(GEOCODING_BASE_URL);
      url.searchParams.set("name", query);
      url.searchParams.set("count", "1");
      url.searchParams.set("language", "en");
      url.searchParams.set("format", "json");

      const response = await fetch(url.toString(), {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: {
          Accept: "application/json",
          "User-Agent": "FarmWiseAI/1.0 weather research",
        },
      });

      if (!response.ok) continue;

      const data = await response.json().catch(() => null);
      if (data?.results && data.results.length > 0) {
        const top = data.results[0];
        const displayParts = [top.name, top.admin1, top.country].filter(Boolean);
        return {
          latitude: top.latitude,
          longitude: top.longitude,
          displayName: displayParts.join(", "),
        };
      }
    } catch {
      // Continue to next candidate query if available
    }
  }

  return null;
}

/**
 * Retrieves current and forecast weather conditions for a farmer's location using Open-Meteo.
 *
 * @param {string} location - Location string (e.g. "Nashik, Maharashtra" or "28.6, 77.2")
 * @returns {Promise<Object>} Normalized weather data object
 */
export async function retrieveWeather(location) {
  if (!location || typeof location !== "string" || !location.trim()) {
    return {
      available: false,
      reason: "No farm location provided in diagnosis record.",
      temperatureC: null,
      humidityPercent: null,
      precipitationForecastMm: null,
      windSpeedKmh: null,
      sprayAdvisory: null,
      retrievedAt: new Date().toISOString(),
    };
  }

  const cacheKey = location.trim().toLowerCase();
  const cached = getCached(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const coords = await geocodeLocation(location);

    if (!coords) {
      const fallback = {
        available: false,
        reason: `Could not geocode location "${location}".`,
        temperatureC: null,
        humidityPercent: null,
        precipitationForecastMm: null,
        windSpeedKmh: null,
        sprayAdvisory: null,
        retrievedAt: new Date().toISOString(),
      };
      setCache(cacheKey, fallback);
      return fallback;
    }

    const forecastUrl = new URL(FORECAST_BASE_URL);
    forecastUrl.searchParams.set("latitude", String(coords.latitude));
    forecastUrl.searchParams.set("longitude", String(coords.longitude));
    forecastUrl.searchParams.set(
      "current",
      "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m"
    );
    forecastUrl.searchParams.set(
      "daily",
      "precipitation_sum,precipitation_probability_max"
    );
    forecastUrl.searchParams.set("timezone", "auto");
    forecastUrl.searchParams.set("forecast_days", "3");

    const response = await fetch(forecastUrl.toString(), {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        Accept: "application/json",
        "User-Agent": "FarmWiseAI/1.0 weather research",
      },
    });

    if (!response.ok) {
      const errorResult = {
        available: false,
        reason: `Weather provider responded with status ${response.status}.`,
        temperatureC: null,
        humidityPercent: null,
        precipitationForecastMm: null,
        windSpeedKmh: null,
        sprayAdvisory: null,
        retrievedAt: new Date().toISOString(),
      };
      setCache(cacheKey, errorResult);
      return errorResult;
    }

    const data = await response.json();
    const current = data?.current || {};
    const daily = data?.daily || {};

    const temperatureC =
      typeof current.temperature_2m === "number" ? current.temperature_2m : null;
    const humidityPercent =
      typeof current.relative_humidity_2m === "number"
        ? current.relative_humidity_2m
        : null;
    const precipitationMm =
      typeof current.precipitation === "number" ? current.precipitation : 0;
    const windSpeedKmh =
      typeof current.wind_speed_10m === "number" ? current.wind_speed_10m : null;

    const precipitationForecastMm = Array.isArray(daily.precipitation_sum)
      ? daily.precipitation_sum[0] ?? precipitationMm
      : precipitationMm;

    const precipitationProbabilityMax = Array.isArray(
      daily.precipitation_probability_max
    )
      ? daily.precipitation_probability_max[0] ?? null
      : null;

    const sprayAdvisory = buildSprayAdvisory({
      precipitationForecastMm: precipitationForecastMm ?? 0,
      precipitationMm,
      windSpeedKmh: windSpeedKmh ?? 0,
      humidityPercent: humidityPercent ?? 50,
    });

    const result = {
      available: true,
      resolvedLocation: coords.displayName,
      latitude: coords.latitude,
      longitude: coords.longitude,
      temperatureC,
      humidityPercent,
      precipitationMm,
      precipitationForecastMm,
      precipitationProbabilityMax,
      windSpeedKmh,
      sprayAdvisory,
      retrievedAt: new Date().toISOString(),
    };

    setCache(cacheKey, result);
    return result;
  } catch (err) {
    const errorResult = {
      available: false,
      reason:
        err.name === "TimeoutError"
          ? "Weather service request timed out."
          : "Weather data could not be retrieved.",
      temperatureC: null,
      humidityPercent: null,
      precipitationForecastMm: null,
      windSpeedKmh: null,
      sprayAdvisory: null,
      retrievedAt: new Date().toISOString(),
    };
    return errorResult;
  }
}
