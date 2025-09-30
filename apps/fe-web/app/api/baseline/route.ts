import { NextResponse } from "next/server";

export interface BaselineMetrics {
  lastUpdated: string;
  version: string;
  qualityBaseline: {
    target: number;
    current: number;
    trend: "improving" | "stable" | "declining";
    historicalData: {
      date: string;
      value: number;
    }[];
  };
  performanceBaseline: {
    responseTime: {
      target: number; // ms
      current: number;
      p95: number;
      p99: number;
    };
    throughput: {
      target: number; // requests/min
      current: number;
    };
    errorRate: {
      target: number; // %
      current: number;
    };
  };
  categories: {
    [key: string]: {
      samples: number;
      averageQuality: number;
      baseline: number;
      status: "above" | "at" | "below";
    };
  };
  recommendations: {
    priority: "high" | "medium" | "low";
    category: string;
    issue: string;
    action: string;
    expectedImpact: string;
  }[];
}

export async function GET(): Promise<NextResponse> {
  try {
    // 실제 베이스라인 메트릭 수집 (현재는 시뮬레이션)
    const baselineData: BaselineMetrics = {
      lastUpdated: new Date().toISOString(),
      version: "1.0.0",
      qualityBaseline: {
        target: 0.85,
        current: 0.847,
        trend: "stable",
        historicalData: [
          { date: "2024-01-01", value: 0.821 },
          { date: "2024-01-08", value: 0.835 },
          { date: "2024-01-15", value: 0.843 },
          { date: "2024-01-22", value: 0.847 },
          { date: "2024-01-29", value: 0.852 },
          { date: "2024-02-05", value: 0.847 },
        ],
      },
      performanceBaseline: {
        responseTime: {
          target: 2000, // 2초
          current: 1245,
          p95: 1890,
          p99: 2340,
        },
        throughput: {
          target: 30, // 분당 30건
          current: 28,
        },
        errorRate: {
          target: 2.0, // 2%
          current: 1.2,
        },
      },
      categories: {
        paraphrase: {
          samples: 345,
          averageQuality: 0.89,
          baseline: 0.85,
          status: "above",
        },
        extend: {
          samples: 234,
          averageQuality: 0.81,
          baseline: 0.85,
          status: "below",
        },
        summarize: {
          samples: 187,
          averageQuality: 0.88,
          baseline: 0.85,
          status: "above",
        },
        qa_generation: {
          samples: 278,
          averageQuality: 0.86,
          baseline: 0.85,
          status: "above",
        },
        style_transfer: {
          samples: 203,
          averageQuality: 0.83,
          baseline: 0.85,
          status: "below",
        },
      },
      recommendations: [
        {
          priority: "high",
          category: "extend",
          issue: "텍스트 확장 품질이 베이스라인 0.85 아래로 떨어짐 (현재 0.81)",
          action: "LLM 프롬프트 개선 및 컨텍스트 보강",
          expectedImpact: "품질 점수 0.87까지 향상 예상",
        },
        {
          priority: "medium",
          category: "style_transfer",
          issue: "스타일 변환 품질 저하 (현재 0.83)",
          action: "스타일별 전용 프롬프트 템플릿 도입",
          expectedImpact: "일관성 있는 0.86+ 품질 달성",
        },
        {
          priority: "low",
          category: "performance",
          issue: "처리량이 목표치보다 7% 낮음",
          action: "병렬 처리 및 캐싱 최적화",
          expectedImpact: "처리량 15% 향상",
        },
      ],
    };

    return NextResponse.json(baselineData);
  } catch (error) {
    console.error("Baseline API error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
