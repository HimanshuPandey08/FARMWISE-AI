import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { retrieveWeather } from "@/lib/weather";
import { retrieveAgriculturalSources } from "@/lib/agricultural-retrieval";
import { generateGeminiRecommendation } from "@/lib/gemini";

// In-flight generation locks to prevent duplicate concurrent generation for the same diagnosis
const activeGenerations = new Map();

/**
 * GET: Fetches an existing saved consultation for the given diagnosisId.
 */
export async function GET(request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in first." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const diagnosisId = searchParams.get("diagnosisId");

    if (!diagnosisId || typeof diagnosisId !== "string" || !diagnosisId.trim()) {
      return NextResponse.json(
        { error: "A diagnosisId parameter is required." },
        { status: 400 }
      );
    }

    const existing = await db.collection("consultations").findOne({
      diagnosisId: diagnosisId.trim(),
      userId: session.user.id,
    });

    if (!existing) {
      return NextResponse.json(
        { error: "No saved consultation found for this diagnosis.", notFound: true },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      consultation: existing.recommendation,
      weatherContext: existing.weatherContext,
      evidenceSources: existing.agriculturalEvidenceMeta || [],
      isSaved: true,
      createdAt: existing.createdAt,
    });
  } catch (error) {
    console.error("Fetch consultation failed:", error);
    return NextResponse.json(
      { error: "Failed to retrieve consultation." },
      { status: 500 }
    );
  }
}

/**
 * POST: Generates or reuses a saved consultation for the authenticated user's diagnosis.
 */
export async function POST(request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in first." },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { diagnosisId, regenerate = false } = body;

    if (!diagnosisId || typeof diagnosisId !== "string" || !diagnosisId.trim()) {
      return NextResponse.json(
        { error: "A valid diagnosisId is required." },
        { status: 400 }
      );
    }

    const normalizedDiagnosisId = diagnosisId.trim();

    // 1. Verify diagnosis ownership
    let objectId;
    try {
      objectId = new ObjectId(normalizedDiagnosisId);
    } catch {
      return NextResponse.json(
        { error: "Invalid diagnosis ID format." },
        { status: 400 }
      );
    }

    const diagnosisDoc = await db.collection("diagnoses").findOne({
      _id: objectId,
      userId: session.user.id,
    });

    if (!diagnosisDoc) {
      return NextResponse.json(
        { error: "Diagnosis not found or you are not authorized to view it." },
        { status: 404 }
      );
    }

    // 2. Return existing saved consultation if regeneration is not explicitly requested
    if (!regenerate) {
      const existing = await db.collection("consultations").findOne({
        diagnosisId: normalizedDiagnosisId,
        userId: session.user.id,
      });

      if (existing?.recommendation) {
        return NextResponse.json({
          success: true,
          consultation: existing.recommendation,
          weatherContext: existing.weatherContext,
          evidenceSources: existing.agriculturalEvidenceMeta || [],
          isSaved: true,
          cached: true,
          createdAt: existing.createdAt,
        });
      }
    }

    // 3. Concurrency guard: check if generation is already in flight for this diagnosis
    const lockKey = `${session.user.id}:${normalizedDiagnosisId}`;
    if (activeGenerations.has(lockKey)) {
      try {
        const inFlightResult = await activeGenerations.get(lockKey);
        return NextResponse.json({
          success: true,
          consultation: inFlightResult,
          isSaved: true,
          cached: true,
        });
      } catch {
        // If in-flight generation threw, fall through to retry
      }
    }

    // 4. Execute weather and agricultural evidence retrieval in parallel
    const generationPromise = (async () => {
      const suspectedDiseases = (diagnosisDoc.diagnosis?.diseases || []).map(
        (d) => d.name
      );

      const [weather, agriculturalEvidence] = await Promise.all([
        retrieveWeather(diagnosisDoc.location).catch((err) => {
          console.warn("Weather retrieval failed gracefully:", err.message);
          return { available: false, reason: "Weather service unavailable" };
        }),
        retrieveAgriculturalSources({
          cropName: diagnosisDoc.cropName,
          suspectedDiseases,
        }).catch((err) => {
          console.warn("Agricultural source retrieval failed gracefully:", err.message);
          return [];
        }),
      ]);

      // 5. Generate recommendations with grounded Gemini engine
      const recommendation = await generateGeminiRecommendation({
        cropName: diagnosisDoc.cropName,
        cropAge: diagnosisDoc.cropAge,
        ageUnit: diagnosisDoc.ageUnit,
        soilType: diagnosisDoc.soilType,
        location: diagnosisDoc.location,
        budget: diagnosisDoc.budget,
        diagnosis: diagnosisDoc.diagnosis,
        weather,
        agriculturalEvidence,
      });

      // 6. Persist consultation to MongoDB
      const consultationRecord = {
        userId: session.user.id,
        diagnosisId: normalizedDiagnosisId,
        cropName: diagnosisDoc.cropName,
        recommendation,
        weatherContext: weather,
        agriculturalEvidenceMeta: (agriculturalEvidence || []).map((ev) => ({
          title: ev.title,
          publisher: ev.publisher || ev.sourceName || "Official Agricultural Source",
          url: ev.url,
          retrievedAt: ev.retrievedAt,
        })),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.collection("consultations").updateOne(
        { diagnosisId: normalizedDiagnosisId, userId: session.user.id },
        { $set: consultationRecord },
        { upsert: true }
      );

      return recommendation;
    })();

    activeGenerations.set(lockKey, generationPromise);

    try {
      const recommendation = await generationPromise;
      return NextResponse.json({
        success: true,
        consultation: recommendation,
        isSaved: true,
        regenerated: Boolean(regenerate),
      });
    } finally {
      activeGenerations.delete(lockKey);
    }
  } catch (error) {
    console.error("Generate recommendations failed:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Failed to generate agricultural recommendations.";

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
