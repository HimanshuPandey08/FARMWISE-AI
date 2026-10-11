import assert from "node:assert";
import { retrieveWeather } from "./src/lib/weather.js";

async function runWeatherTests() {
  console.log("Starting weather service unit tests...\n");

  const originalFetch = globalThis.fetch;
  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      await fn();
      passed++;
      console.log(`PASS: ${name}`);
    } catch (err) {
      console.error(`FAIL: ${name}`);
      console.error(err);
    }
  }

  // Test 1: Empty or invalid location returns available: false without throwing
  await test("1. Empty or missing location handled gracefully", async () => {
    const result = await retrieveWeather("");
    assert.strictEqual(result.available, false);
    assert.strictEqual(result.temperatureC, null);
  });

  // Test 2: Direct coordinate string is parsed and forecast requested
  await test("2. Direct coordinates parsed and forecast fetched", async () => {
    globalThis.fetch = async (url) => {
      const urlStr = String(url);
      if (urlStr.includes("api.open-meteo.com/v1/forecast")) {
        return new Response(
          JSON.stringify({
            current: {
              temperature_2m: 29.5,
              relative_humidity_2m: 64,
              precipitation: 0.0,
              wind_speed_10m: 11.2,
            },
            daily: {
              precipitation_sum: [0.5, 0.0, 1.2],
              precipitation_probability_max: [20, 10, 45],
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      return new Response("Not found", { status: 404 });
    };

    const result = await retrieveWeather("19.997, 73.789");
    assert.strictEqual(result.available, true);
    assert.strictEqual(result.temperatureC, 29.5);
    assert.strictEqual(result.humidityPercent, 64);
    assert.strictEqual(result.windSpeedKmh, 11.2);
    assert.ok(result.sprayAdvisory.length > 0);
  });

  // Test 3: Location geocoding + forecast combined flow
  await test("3. Freeform town location geocoded and forecast returned", async () => {
    globalThis.fetch = async (url) => {
      const urlStr = String(url);
      if (urlStr.includes("geocoding-api.open-meteo.com")) {
        return new Response(
          JSON.stringify({
            results: [
              {
                name: "Nashik",
                latitude: 19.9975,
                longitude: 73.7898,
                admin1: "Maharashtra",
                country: "India",
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      if (urlStr.includes("api.open-meteo.com/v1/forecast")) {
        return new Response(
          JSON.stringify({
            current: {
              temperature_2m: 27.0,
              relative_humidity_2m: 88,
              precipitation: 3.5,
              wind_speed_10m: 18.0,
            },
            daily: {
              precipitation_sum: [8.0],
              precipitation_probability_max: [80],
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      return new Response("Not found", { status: 404 });
    };

    const result = await retrieveWeather("Nashik, Maharashtra");
    assert.strictEqual(result.available, true);
    assert.strictEqual(result.resolvedLocation, "Nashik, Maharashtra, India");
    assert.strictEqual(result.temperatureC, 27.0);
    assert.strictEqual(result.humidityPercent, 88);
    // Spray advisory should warn about rain/wind
    assert.ok(result.sprayAdvisory.includes("Caution: Rain forecast"));
  });

  // Test 4: Geocoding failure returns fallback
  await test("4. Unknown location fails gracefully", async () => {
    globalThis.fetch = async () => {
      return new Response(JSON.stringify({ results: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    const result = await retrieveWeather("NonExistentPlaceXYZ123456");
    assert.strictEqual(result.available, false);
    assert.ok(result.reason.includes("Could not geocode"));
  });

  // Test 5: Network exception does not crash caller
  await test("5. Network timeout / error returns unavailable status", async () => {
    globalThis.fetch = async () => {
      throw new Error("Connection failed");
    };

    const result = await retrieveWeather("Varanasi, UP");
    assert.strictEqual(result.available, false);
    assert.ok(typeof result.reason === "string" && result.reason.length > 0);
  });

  globalThis.fetch = originalFetch;

  console.log(`\nWeather test results: ${passed}/${total} passed.`);
  if (passed !== total) process.exit(1);
}

runWeatherTests();
