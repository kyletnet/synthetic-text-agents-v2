/**
 * Metrics API endpoint for APM integration
 * Provides Prometheus-compatible metrics and performance data
 */

import { NextRequest, NextResponse } from "next/server";
import { getPerformanceMonitor } from "../../../src/shared/performanceMonitoring";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const performanceMonitor = getPerformanceMonitor();
    const url = new URL(request.url);
    const format = url.searchParams.get("format") || "json";
    const timeWindow = parseInt(url.searchParams.get("window") || "300000"); // 5 minutes default

    if (!performanceMonitor) {
      return NextResponse.json(
        { error: "Performance monitoring not initialized" },
        { status: 503 },
      );
    }

    if (format === "prometheus") {
      const prometheusMetrics = performanceMonitor.exportPrometheusMetrics();
      return new NextResponse(prometheusMetrics, {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      });
    }

    // Get performance summary
    const summary = performanceMonitor.getPerformanceSummary(timeWindow);

    // Get current system metrics
    const systemMetrics = await performanceMonitor.getSystemMetrics();
    summary.system = systemMetrics;

    return NextResponse.json(
      {
        timestamp: new Date().toISOString(),
        timeWindow,
        summary,
        uptime: Date.now() - process.uptime() * 1000,
        environment: process.env.ENVIRONMENT || "development",
        version: process.env.npm_package_version || "1.0.0",
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      },
    );
  } catch (error) {
    console.error("Metrics endpoint error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve metrics" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const performanceMonitor = getPerformanceMonitor();

    if (!performanceMonitor) {
      return NextResponse.json(
        { error: "Performance monitoring not initialized" },
        { status: 503 },
      );
    }

    const body = await request.json();
    const { metric } = body;

    if (!metric || !metric.name || metric.value === undefined) {
      return NextResponse.json(
        { error: "Invalid metric format. Required: name, value" },
        { status: 400 },
      );
    }

    performanceMonitor.recordMetric({
      name: metric.name,
      value: metric.value,
      unit: metric.unit || "count",
      timestamp: new Date(metric.timestamp) || new Date(),
      tags: metric.tags || {},
      labels: metric.labels || {},
    });

    return NextResponse.json(
      { success: true, message: "Metric recorded successfully" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Metrics recording error:", error);
    return NextResponse.json(
      { error: "Failed to record metric" },
      { status: 500 },
    );
  }
}
