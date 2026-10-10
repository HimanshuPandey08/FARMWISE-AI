
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/mongodb";

export async function POST(request) {
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

    const {
      cropName,
      cropAge,
      ageUnit,
      location,
      soilType,
      budget,
      image,
      diagnosis,
    } = body;

    if (
      typeof cropName !== "string" ||
      !cropName.trim() ||
      typeof image !== "string" ||
      !image.startsWith("https://res.cloudinary.com/") ||
      !diagnosis ||
      typeof diagnosis !== "object" ||
      Array.isArray(diagnosis)
    ) {
      return NextResponse.json(
        { error: "Invalid diagnosis data." },
        { status: 400 }
      );
    }

    const document = {
      userId: session.user.id,
      cropName: cropName.trim().slice(0, 150),
      cropAge: String(cropAge ?? "").slice(0, 50),
      ageUnit: String(ageUnit ?? "").slice(0, 30),
      location: String(location ?? "").slice(0, 150),
      soilType: String(soilType ?? "").slice(0, 100),
      budget: Number.isFinite(Number(budget))
        ? Number(budget)
        : null,
      image,
      diagnosis,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection("diagnoses").insertOne(document);

    return NextResponse.json(
      {
        success: true,
        diagnosisId: result.insertedId.toString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Save diagnosis failed:", error);

    return NextResponse.json(
      { error: "Unable to save diagnosis." },
      { status: 500 }
    );
  }
}

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

    const diagnoses = await db
      .collection("diagnoses")
      .find(
        { userId: session.user.id },
        {
          projection: {
            userId: 0,
          },
        }
      )
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    return NextResponse.json({
      diagnoses: diagnoses.map((item) => ({
        ...item,
        _id: item._id.toString(),
      })),
    });
  } catch (error) {
    console.error("Fetch diagnoses failed:", error);

    return NextResponse.json(
      { error: "Unable to retrieve diagnosis history." },
      { status: 500 }
    );
  }
}
