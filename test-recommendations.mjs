import assert from "node:assert";
import {
  buildRecommendationPrompt,
  validateRecommendation,
  DEFAULT_GEMINI_MODELS,
  getGeminiModels,
  generateGeminiRecommendation,
} from "./src/lib/gemini.js";

async function runRecommendationTests() {
  console.log("Starting recommendation engine unit tests...\n");

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

  // Test 1: Prompt includes all required grounded fields
  await test("1. buildRecommendationPrompt grounds with crop, weather, and evidence", () => {
    const prompt = buildRecommendationPrompt({
      cropName: "Tomato",
      cropAge: 45,
      ageUnit: "days",
      soilType: "Loamy",
      location: "Nashik, Maharashtra",
      budget: 1500,
      diagnosis: {
        diseases: [
          { name: "Early Blight", probability: 0.88 },
          { name: "Septoria Leaf Spot", probability: 0.12 },
        ],
      },
      weather: {
        available: true,
        temperatureC: 28,
        humidityPercent: 75,
        precipitationForecastMm: 0,
        windSpeedKmh: 10,
        sprayAdvisory: "Favorable conditions for foliar spray.",
      },
      agriculturalEvidence: [
        {
          title: "ICAR Tomato Advisory Bulletin",
          publisher: "ICAR-IIHR",
          url: "https://www.iihr.res.in/tomato-advisory",
          content: "Spray Mancozeb 75 WP at 2 g/L for Alternaria solani early blight.",
        },
      ],
    });

    assert.ok(prompt.includes("Tomato"), "Must mention crop name");
    assert.ok(prompt.includes("Early Blight"), "Must mention suspected disease");
    assert.ok(prompt.includes("Nashik, Maharashtra"), "Must mention location");
    assert.ok(prompt.includes("₹1500"), "Must mention budget");
    assert.ok(prompt.includes("Favorable conditions for foliar spray"), "Must include weather advisory");
    assert.ok(prompt.includes("https://www.iihr.res.in/tomato-advisory"), "Must include verified evidence URL");
    assert.ok(prompt.includes("NOT a laboratory-confirmed diagnosis"), "Must caution about visual screening");
  });

  // Test 2: Validation of a well-formed Gemini response
  await test("2. validateRecommendation parses and validates structured response", () => {
    const rawGeminiJson = {
      summary: "Apply foliar Mancozeb spray and remove infected lower leaves to arrest early blight spread.",
      diagnosis: {
        diseaseName: "Early Blight",
        confidence: 0.88,
        severity: "Moderate",
        isConfirmed: true, // Should be corrected to false by validator
      },
      weather: {
        available: true,
        temperatureC: 28,
        humidityPercent: 75,
        precipitationForecastMm: 0,
        windSpeedKmh: 10,
      },
      actionPlan: {
        whatToDo: [
          "Spray Mancozeb 75 WP @ 2g per litre of water in early morning.",
          "Remove and safely burn severely blighted lower foliage.",
        ],
        whatToAvoid: [
          "Avoid overhead sprinkler irrigation to reduce leaf moisture.",
          "Do not exceed recommended chemical dosage.",
        ],
        estimatedCost: {
          amount: 450,
          currency: "INR",
          basis: "Cost for 250g pack of Mancozeb fungicide",
        },
        riskIfUntreated: "Defoliation and significant reduction in fruit yield.",
        checkAgainInDays: 5,
      },
      reasoning: [
        "Moderate temperature and high humidity create ideal conditions for Alternaria spore proliferation.",
      ],
      sources: [
        {
          title: "ICAR Tomato Advisory Bulletin",
          url: "https://www.iihr.res.in/tomato-advisory",
        },
      ],
    };

    const validated = validateRecommendation(rawGeminiJson, {
      diagnosis: { diseases: [{ name: "Early Blight", probability: 0.88 }] },
      weather: { available: true, temperatureC: 28 },
      agriculturalEvidence: [
        {
          title: "ICAR Tomato Advisory Bulletin",
          url: "https://www.iihr.res.in/tomato-advisory",
          publisher: "ICAR-IIHR",
        },
      ],
    });

    assert.strictEqual(validated.summary, rawGeminiJson.summary);
    assert.strictEqual(validated.diagnosis.diseaseName, "Early Blight");
    assert.strictEqual(validated.diagnosis.isConfirmed, false, "Must strictly enforce isConfirmed: false");
    assert.strictEqual(validated.actionPlan.whatToDo.length, 2);
    assert.strictEqual(validated.actionPlan.whatToAvoid.length, 2);
    assert.strictEqual(validated.actionPlan.estimatedCost.amount, 450);
    assert.strictEqual(validated.sources.length, 1);
    assert.strictEqual(validated.sources[0].url, "https://www.iihr.res.in/tomato-advisory");
  });

  // Test 3: Hallucinated citations are stripped
  await test("3. validateRecommendation strictly strips unverified or hallucinated citations", () => {
    const rawGeminiJson = {
      summary: "Apply treatment.",
      diagnosis: { diseaseName: "Early Blight" },
      actionPlan: {
        whatToDo: ["Inspect plants daily."],
        whatToAvoid: ["Do not over-water."],
      },
      sources: [
        { title: "Fake Blog", url: "https://fake-farming-tips.com/cure" },
        { title: "Real Source", url: "https://www.iihr.res.in/tomato-advisory" },
      ],
    };

    const validated = validateRecommendation(rawGeminiJson, {
      diagnosis: { diseases: [{ name: "Early Blight" }] },
      weather: { available: false },
      agriculturalEvidence: [
        {
          title: "Real Source",
          url: "https://www.iihr.res.in/tomato-advisory",
          publisher: "ICAR-IIHR",
        },
      ],
    });

    assert.strictEqual(validated.sources.length, 1, "Only real verified source should be retained");
    assert.strictEqual(validated.sources[0].url, "https://www.iihr.res.in/tomato-advisory");
  });

  // Test 4: Missing or invalid inputs receive safe defaults
  await test("4. validateRecommendation provides safe fallbacks for missing action items", () => {
    const rawSparseJson = {
      summary: "",
      actionPlan: {
        whatToDo: [],
        whatToAvoid: [],
      },
    };

    const validated = validateRecommendation(rawSparseJson, {
      diagnosis: { diseases: [{ name: "Late Blight" }] },
    });

    assert.ok(validated.summary.length > 0, "Summary must be populated with fallback");
    assert.ok(validated.actionPlan.whatToDo.length >= 1, "Must populate safe fallback actions");
    assert.ok(validated.actionPlan.whatToAvoid.length >= 1, "Must populate safe fallback cautions");
    assert.strictEqual(validated.diagnosis.diseaseName, "Late Blight");
  });

  // Test 5: Model selection configuration
  await test("5. Model configuration defaults to gemini-3.6-flash and excludes deprecated models", () => {
    assert.strictEqual(DEFAULT_GEMINI_MODELS[0], "gemini-3.6-flash", "Primary candidate must be gemini-3.6-flash");
    assert.ok(DEFAULT_GEMINI_MODELS.includes("gemini-3.8-flash"), "Should include gemini-3.8-flash as fallback");
    assert.ok(DEFAULT_GEMINI_MODELS.includes("gemini-flash-latest"), "Should include gemini-flash-latest as fallback");
    assert.ok(!DEFAULT_GEMINI_MODELS.includes("gemini-1.5-flash"), "Retired gemini-1.5-flash must be removed");
    assert.ok(!DEFAULT_GEMINI_MODELS.includes("gemini-2.5-flash"), "Retired gemini-2.5-flash must be removed");

    // Test environment override
    const originalEnv = process.env.GEMINI_MODEL;
    try {
      process.env.GEMINI_MODEL = "gemini-custom-model";
      const models = getGeminiModels();
      assert.strictEqual(models[0], "gemini-custom-model");
    } finally {
      if (originalEnv) {
        process.env.GEMINI_MODEL = originalEnv;
      } else {
        delete process.env.GEMINI_MODEL;
      }
    }
  });

  // Test 6: Fallback handling when primary model returns 404 or fails
  await test("6. Fallback executes next model when primary model encounters 404 / 503", async () => {
    const originalFetch = globalThis.fetch;
    const originalKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = "dummy-test-key-mock";

    const attemptedUrls = [];

    const mockSuccessResponse = {
      summary: "Early blight management recommended with Mancozeb.",
      diagnosis: { diseaseName: "Early Blight", severity: "Moderate", isConfirmed: false },
      weather: { available: true, temperatureC: 25 },
      actionPlan: {
        whatToDo: ["Apply foliar spray."],
        whatToAvoid: ["Do not spray during rain."],
        estimatedCost: { amount: 500, currency: "INR", basis: "Fungicide" },
        riskIfUntreated: "Leaf defoliation.",
        checkAgainInDays: 7,
      },
      reasoning: ["Fungal infection favored by warm humid conditions."],
      sources: [],
    };

    globalThis.fetch = async (url) => {
      attemptedUrls.push(url.toString());
      if (url.toString().includes("model-unavailable-404")) {
        return new Response(
          JSON.stringify({
            error: {
              code: 404,
              message: "models/model-unavailable-404 is not found for API version v1beta",
              status: "NOT_FOUND",
            },
          }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.toString().includes("model-working-fallback")) {
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ text: JSON.stringify(mockSuccessResponse) }],
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response("Not found", { status: 404 });
    };

    try {
      const res = await generateGeminiRecommendation({
        cropName: "Tomato",
        diagnosis: { diseases: [{ name: "Early Blight" }] },
        models: ["model-unavailable-404", "model-working-fallback"],
      });

      assert.strictEqual(attemptedUrls.length, 2, "Should attempt both models in order");
      assert.ok(attemptedUrls[0].includes("model-unavailable-404"), "First attempt should be primary");
      assert.ok(attemptedUrls[1].includes("model-working-fallback"), "Second attempt should be fallback");
      assert.strictEqual(res.diagnosis.diseaseName, "Early Blight");
      assert.strictEqual(res.actionPlan.whatToDo[0], "Apply foliar spray.");
    } finally {
      globalThis.fetch = originalFetch;
      if (originalKey) {
        process.env.GEMINI_API_KEY = originalKey;
      } else {
        delete process.env.GEMINI_API_KEY;
      }
    }
  });

  // Test 7: All candidate models fail throws clean error without leaking keys
  await test("7. Exhaustion of all candidate models throws error with redacted credentials", async () => {
    const originalFetch = globalThis.fetch;
    const originalKey = process.env.GEMINI_API_KEY;
    const secretKey = "super-secret-gemini-key-12345";
    process.env.GEMINI_API_KEY = secretKey;

    globalThis.fetch = async (url) => {
      return new Response(
        JSON.stringify({
          error: {
            code: 503,
            message: `Service unavailable at ${url}`,
            status: "UNAVAILABLE",
          },
        }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    };

    try {
      let threw = false;
      try {
        await generateGeminiRecommendation({
          cropName: "Potato",
          diagnosis: { diseases: [{ name: "Late Blight" }] },
          models: ["failing-model-1", "failing-model-2"],
        });
      } catch (err) {
        threw = true;
        assert.ok(!err.message.includes(secretKey), "Error message MUST NOT contain raw API key");
        assert.ok(err.message.includes("failing-model"), "Error message should mention failed model");
      }
      assert.ok(threw, "Must throw when all candidate models fail");
    } finally {
      globalThis.fetch = originalFetch;
      if (originalKey) {
        process.env.GEMINI_API_KEY = originalKey;
      } else {
        delete process.env.GEMINI_API_KEY;
      }
    }
  });

  console.log(`\nRecommendation test results: ${passed}/${total} passed.`);
  if (passed !== total) process.exit(1);
}

runRecommendationTests();
