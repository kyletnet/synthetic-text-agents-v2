import { NextResponse } from "next/server";

export interface DashboardMetrics {
  overview: {
    totalSessions: number;
    totalQAGenerated: number;
    averageQuality: number;
    systemUptime: number;
  };
  qualityDistribution: {
    excellent: number; // 0.9+
    good: number; // 0.7-0.89
    fair: number; // 0.5-0.69
    poor: number; // <0.5
  };
  recentActivity: {
    timestamp: string;
    type: string;
    quality: number;
    summary: string;
  }[];
  systemHealth: {
    llmConnection: "connected" | "disconnected" | "degraded";
    apiPerformance: number; // ms average response time
    errorRate: number; // percentage
  };
  topCategories: {
    category: string;
    count: number;
    averageQuality: number;
  }[];
}

export async function GET(): Promise<NextResponse> {
  try {
    // 실제 메트릭 데이터 수집 (현재는 시뮬레이션)
    const dashboardData: DashboardMetrics = {
      overview: {
        totalSessions: 156,
        totalQAGenerated: 1247,
        averageQuality: 0.847,
        systemUptime: Math.floor(process.uptime()),
      },
      qualityDistribution: {
        excellent: 487, // 39%
        good: 623, // 50%
        fair: 112, // 9%
        poor: 25, // 2%
      },
      recentActivity: [
        {
          timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
          type: "paraphrase",
          quality: 0.92,
          summary: "문서 패러프레이즈 5건 생성",
        },
        {
          timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
          type: "qa_generation",
          quality: 0.88,
          summary: "Q&A 생성 12건 완료",
        },
        {
          timestamp: new Date(Date.now() - 32 * 60 * 1000).toISOString(),
          type: "extend",
          quality: 0.75,
          summary: "문서 확장 8건 처리",
        },
        {
          timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
          type: "summarize",
          quality: 0.91,
          summary: "요약 생성 3건 완료",
        },
      ],
      systemHealth: {
        llmConnection:
          process.env.ANTHROPIC_API_KEY &&
          !process.env.ANTHROPIC_API_KEY.includes("your_api_key_here")
            ? "connected"
            : "disconnected",
        apiPerformance: 245, // ms
        errorRate: 1.2, // %
      },
      topCategories: [
        { category: "문서 패러프레이즈", count: 345, averageQuality: 0.89 },
        { category: "Q&A 생성", count: 278, averageQuality: 0.86 },
        { category: "텍스트 확장", count: 234, averageQuality: 0.81 },
        { category: "요약 생성", count: 187, averageQuality: 0.88 },
        { category: "스타일 변환", count: 203, averageQuality: 0.83 },
      ],
    };

    return NextResponse.json(dashboardData);
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
