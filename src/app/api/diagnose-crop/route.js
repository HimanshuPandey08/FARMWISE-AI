import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const CROP_HEALTH_URL =
  "https://crop.kindwise.com/api/v1/identification";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

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
    const apiKey = process.env.CROP_HEALTH_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Crop.health API key is not configured." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { imageUrl, latitude, longitude } = body;

    if (!imageUrl || typeof imageUrl !== "string") {
      return NextResponse.json(
        { error: "A Cloudinary image URL is required." },
        { status: 400 }
      );
    }

    // Accept only HTTPS images hosted on Cloudinary.
    let parsedUrl;

    try {
      parsedUrl = new URL(imageUrl);
    } catch {
      return NextResponse.json(
        { error: "Invalid image URL." },
        { status: 400 }
      );
    }

    if (
      parsedUrl.protocol !== "https:" ||
      parsedUrl.hostname !== "res.cloudinary.com"
    ) {
      return NextResponse.json(
        { error: "Please provide a valid Cloudinary image URL." },
        { status: 400 }
      );
    }

    // Download the image from Cloudinary.
    const imageResponse = await fetch(parsedUrl, {
      signal: AbortSignal.timeout(20000),
    });

    if (!imageResponse.ok) {
      return NextResponse.json(
        { error: "Could not retrieve the uploaded image." },
        { status: 502 }
      );
    }

    const contentType =
      imageResponse.headers.get("content-type") || "";

    if (!["image/jpeg", "image/png", "image/webp"].includes(
      contentType.split(";")[0].trim().toLowerCase()
    )) {
      return NextResponse.json(
        { error: "The uploaded file must be a JPEG, PNG, or WebP image." },
        { status: 400 }
      );
    }

    const declaredLength = Number(
      imageResponse.headers.get("content-length") || 0
    );

    if (declaredLength > MAX_IMAGE_SIZE) {
      return NextResponse.json(
        { error: "Image must be 5 MB or smaller." },
        { status: 413 }
      );
    }

    const imageBuffer = Buffer.from(
      await imageResponse.arrayBuffer()
    );

    if (
      imageBuffer.length === 0 ||
      imageBuffer.length > MAX_IMAGE_SIZE
    ) {
      return NextResponse.json(
        { error: "Image must be between 1 byte and 5 MB." },
        { status: 413 }
      );
    }

    // Crop.health accepts images as Base64 strings in a JSON array.
    const payload = {
      images: [imageBuffer.toString("base64")],
    };

    if (
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180
    ) {
      payload.latitude = latitude;
      payload.longitude = longitude;
    }

    const apiResponse = await fetch(CROP_HEALTH_URL, {
      method: "POST",
      headers: {
        "Api-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(60000),
    });

    const responseData = await apiResponse.json().catch(() => null);

    if (!apiResponse.ok) {
      console.error(
        "Crop.health API error:",
        apiResponse.status,
        responseData
      );

      const status =
        apiResponse.status === 401 ? 502 :
        apiResponse.status === 429 ? 429 : 502;

      return NextResponse.json(
        {
          error:
            apiResponse.status === 401
              ? "Crop.health rejected the API key. Check your key and product access."
              : apiResponse.status === 429
              ? "Crop.health credits or request limits may have been reached."
              : "Crop.health could not process the image.",
          providerStatus: apiResponse.status,
        },
        { status }
      );
    }

    const result = responseData?.result;

    if (!result) {
      return NextResponse.json(
        { error: "Crop.health returned an unexpected response." },
        { status: 502 }
      );
    }

    const crops = result.crop?.suggestions ?? [];
    const diseases = result.disease?.suggestions ?? [];

    return NextResponse.json({
      success: true,
      accessToken: responseData.access_token ?? null,

      crop: crops[0]
        ? {
            name: crops[0].name,
            scientificName: crops[0].scientific_name ?? null,
            probability: crops[0].probability,
          }
        : null,

      diseases: diseases.map((disease) => ({
        id: disease.id,
        name: disease.name,
        scientificName: disease.scientific_name ?? null,
        probability: disease.probability,
        details: disease.details ?? null,
      })),

      // Preserve the provider's original response for later processing.
      rawResult: result,
    });
  } catch (error) {
    console.error("Crop.health diagnosis failed:", error);

    return NextResponse.json(
      {
        error:
          error.name === "TimeoutError"
            ? "The diagnosis request timed out. Please try again."
            : "Unable to diagnose the crop right now.",
      },
      { status: 500 }
    );
  }
}
