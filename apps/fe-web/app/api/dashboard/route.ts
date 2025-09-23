/**
 * Performance Dashboard API endpoint
 * Provides real-time dashboard data for monitoring UI
 */

import { NextRequest, NextResponse } from "next/server";
import { getPerformanceDashboard } from "../../../src/shared/performanceDashboard";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const dashboard = getPerformanceDashboard();
    const url = new URL(request.url);
    const timeWindow = parseInt(url.searchParams.get("window") || "300000"); // 5 minutes default
    const section = url.searchParams.get("section"); // optional: overview, agents, system, trends, alerts

    if (!dashboard) {
      return NextResponse.json(
        { error: "Performance dashboard not initialized" },
        { status: 503 },
      );
    }

    if (section) {
      // Return specific section only
      const metrics = await dashboard.getDashboardMetrics(timeWindow);
      const sectionData = (metrics as any)[section];

      if (!sectionData) {
        return NextResponse.json(
          { error: `Invalid section: ${section}` },
          { status: 400 },
        );
      }

      return NextResponse.json(
        {
          timestamp: new Date().toISOString(),
          timeWindow,
          section,
          data: sectionData,
        },
        {
          status: 200,
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
          },
        },
      );
    }

    // Return full dashboard metrics
    const metrics = await dashboard.getDashboardMetrics(timeWindow);

    return NextResponse.json(
      {
        timestamp: new Date().toISOString(),
        timeWindow,
        ...metrics,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      },
    );
  } catch (error) {
    console.error("Dashboard endpoint error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve dashboard data" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const dashboard = getPerformanceDashboard();

    if (!dashboard) {
      return NextResponse.json(
        { error: "Performance dashboard not initialized" },
        { status: 503 },
      );
    }

    const body = await request.json();
    const { action, alertId } = body;

    if (action === "acknowledge_alert" && alertId) {
      const success = dashboard.acknowledgeAlert(alertId);

      if (success) {
        return NextResponse.json(
          { success: true, message: "Alert acknowledged successfully" },
          { status: 200 },
        );
      } else {
        return NextResponse.json(
          { error: "Alert not found or already acknowledged" },
          { status: 404 },
        );
      }
    }

    return NextResponse.json(
      { error: "Invalid action or missing parameters" },
      { status: 400 },
    );
  } catch (error) {
    console.error("Dashboard action error:", error);
    return NextResponse.json(
      { error: "Failed to process dashboard action" },
      { status: 500 },
    );
  }
}
