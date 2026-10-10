
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/mongodb";

export async function GET(request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json(
        { error: "Please log in first." },
        { status: 401 }
      );
    }

    const profile = await db.collection("farmerProfiles").findOne(
      { userId: session.user.id },
      { projection: { _id: 0, userId: 0 } }
    );

    return NextResponse.json({ profile });
  } catch (error) {
    console.error("Get farmer profile failed:", error);

    return NextResponse.json(
      { error: "Unable to retrieve farmer profile." },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json(
        { error: "Please log in first." },
        { status: 401 }
      );
    }

    const body = await request.json();

    const allowedFields = [
      "phone",
      "village",
      "district",
      "state",
      "farmSize",
      "soilType",
    ];

    const profile = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (
          typeof body[field] !== "string" ||
          body[field].length > 150
        ) {
          return NextResponse.json(
            { error: `Invalid value for ${field}.` },
            { status: 400 }
          );
        }

        profile[field] = body[field].trim();
      }
    }

    if (Object.keys(profile).length === 0) {
      return NextResponse.json(
        { error: "Provide at least one profile field." },
        { status: 400 }
      );
    }

    await db.collection("farmerProfiles").updateOne(
      { userId: session.user.id },
      {
        $set: {
          ...profile,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          userId: session.user.id,
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );

    return NextResponse.json({
      success: true,
      message: "Farmer profile saved.",
    });
  } catch (error) {
    console.error("Save farmer profile failed:", error);

    return NextResponse.json(
      { error: "Unable to save farmer profile." },
      { status: 500 }
    );
  }
}
