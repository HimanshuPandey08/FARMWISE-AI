import { NextResponse } from "next/server";
import { getCommunityIntelligence, INTELLIGENCE_CONFIG } from "@/lib/community-intelligence";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    // Sanitize and validate query params
    const rawArea = searchParams.get("area");
    const rawCrop = searchParams.get("crop");
    const rawDays = searchParams.get("days");

    const area = typeof rawArea === "string" && rawArea.trim().length <= 100
      ? rawArea.trim()
      : null;

    const crop = typeof rawCrop === "string" && rawCrop.trim().length <= 100
      ? rawCrop.trim()
      : null;

    let timeRangeDays = INTELLIGENCE_CONFIG.DEFAULT_TIME_RANGE;
    if (rawDays) {
      const parsedDays = parseInt(rawDays, 10);
      if (INTELLIGENCE_CONFIG.SUPPORTED_TIME_RANGES.includes(parsedDays)) {
        timeRangeDays = parsedDays;
      }
    }

    const data = await getCommunityIntelligence({
      area,
      crop,
      timeRangeDays,
    });

    return NextResponse.json({
      success: true,
      ...data,
    });
  } catch (error) {
    console.error("[CommunityIntelligence API] Error:", error.message);
    return NextResponse.json(
      {
        success: false,
        error: "Unable to retrieve community intelligence data at this time.",
      },
      { status: 500 }
    );
  }
}
