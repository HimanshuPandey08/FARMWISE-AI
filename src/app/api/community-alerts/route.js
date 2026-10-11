import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { refreshUserAlerts } from "@/lib/community-alerts";

export async function GET(request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required to access personalized alerts." },
        { status: 401 }
      );
    }

    const alerts = await refreshUserAlerts(session.user.id);
    const unreadCount = alerts.filter((a) => !a.isRead).length;

    return NextResponse.json({
      success: true,
      alerts,
      unreadCount,
    });
  } catch (error) {
    console.error("[CommunityAlerts API] Error:", error.message);
    return NextResponse.json(
      { error: "Unable to retrieve alerts at this time." },
      { status: 500 }
    );
  }
}
