import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { markAlertAsRead, dismissAlert } from "@/lib/community-alerts";

export async function PATCH(request, { params }) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    const resolvedParams = await Promise.resolve(params);
    const alertId = resolvedParams?.id;

    if (!alertId || typeof alertId !== "string") {
      return NextResponse.json(
        { error: "Valid alert ID is required." },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const action = body?.action;

    let success = false;
    if (action === "read") {
      success = await markAlertAsRead(session.user.id, alertId);
    } else if (action === "dismiss") {
      success = await dismissAlert(session.user.id, alertId);
    } else {
      return NextResponse.json(
        { error: "Invalid action. Supported actions: 'read', 'dismiss'." },
        { status: 400 }
      );
    }

    if (!success) {
      return NextResponse.json(
        { error: "Alert not found or unauthorized." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      action,
      alertId,
    });
  } catch (error) {
    console.error("[CommunityAlerts PATCH API] Error:", error.message);
    return NextResponse.json(
      { error: "Failed to update alert." },
      { status: 500 }
    );
  }
}
