"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Info,
  BarChart3,
  PieChart,
  Target,
} from "lucide-react";

interface QualityMetric {
  score: number;
  description: string;
}

interface AugmentationResult {
  analysis: {
    type: string;
    confidence: number;
    characteristics: string[];
  };
  augmentations: Array<{
    type: string;
    reason: string;
    results: any[];
    summary: any;
  }>;
  evaluation: {
    overallScore: number;
    metrics: {
      diversity: QualityMetric;
      quality: QualityMetric;
      relevance: QualityMetric;
      usefulness: QualityMetric;
    };
    recommendations: string[];
    bestVariants: any[];
  };
}

interface QualitySummaryProps {
  result: AugmentationResult;
}

export default function QualitySummaryDashboard({
  result,
}: QualitySummaryProps) {
  // 전체 증강 결과 통계 계산
  const allResults = result.augmentations.flatMap((aug) => aug.results);
  const totalVariants = allResults.length;

  // 품질 분포 계산
  const qualityDistribution = allResults.reduce(
    (acc, item) => {
      const score = item.quality.score;
      if (score >= 0.8) acc.high++;
      else if (score >= 0.6) acc.medium++;
      else acc.low++;
      return acc;
    },
    { high: 0, medium: 0, low: 0 },
  );

  const distributionPercentages = {
    high: Math.round((qualityDistribution.high / totalVariants) * 100),
    medium: Math.round((qualityDistribution.medium / totalVariants) * 100),
    low: Math.round((qualityDistribution.low / totalVariants) * 100),
  };

  // 메트릭별 상태 분석
  const getMetricStatus = (score: number) => {
    if (score >= 0.8)
      return {
        status: "excellent",
        icon: CheckCircle2,
        color: "text-green-600",
      };
    if (score >= 0.6)
      return { status: "good", icon: TrendingUp, color: "text-blue-600" };
    if (score >= 0.4)
      return {
        status: "needs-improvement",
        icon: AlertTriangle,
        color: "text-yellow-600",
      };
    return { status: "poor", icon: TrendingDown, color: "text-red-600" };
  };

  // 취약점 분석
  const weakAreas = Object.entries(result.evaluation.metrics)
    .filter(([_, metric]) => metric.score < 0.6)
    .map(([key, metric]) => ({
      name:
        key === "diversity"
          ? "다양성"
          : key === "quality"
            ? "품질"
            : key === "relevance"
              ? "관련성"
              : "유용성",
      score: metric.score,
      key,
    }));

  // 개선 가이드 생성
  const getImprovementGuide = (metricKey: string, score: number) => {
    const guides = {
      diversity: {
        low: "표현 방식을 더 다양화해보세요. 예: '문체를 격식체와 반말체로 섞어서', '길이를 다양하게 조절해서'",
        medium: "생성 개수를 늘리거나 다른 증강 타입을 추가해보세요.",
        high: "우수한 다양성입니다! 현재 전략을 유지하세요.",
      },
      quality: {
        low: "더 명확하고 구체적인 입력을 제공해보세요. 예: '문법을 더 정확하게', '전문 용어 사용을 개선해서'",
        medium: "문맥을 더 풍부하게 제공하거나 참고 문서를 추가해보세요.",
        high: "훌륭한 언어 품질입니다!",
      },
      relevance: {
        low: "원본과 관련성이 높은 컨텍스트를 더 많이 제공해보세요. 예: '주제에서 벗어나지 않게', '핵심 메시지를 유지하면서'",
        medium: "RAG 문서와 더 관련성 높은 내용을 업로드해보세요.",
        high: "원본과의 관련성이 우수합니다!",
      },
      usefulness: {
        low: "실제 사용 목적을 더 구체적으로 명시해보세요. 예: '교육용으로', '업무 매뉴얼로 활용할 수 있게'",
        medium: "사용자 대상을 더 명확히 하거나 실용적 요소를 추가해보세요.",
        high: "실용성이 매우 높습니다!",
      },
    };

    const level = score >= 0.6 ? "high" : score >= 0.4 ? "medium" : "low";
    return guides[metricKey as keyof typeof guides][level];
  };

  return (
    <div className="space-y-6">
      {/* 전체 요약 카드 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            전체 증강 결과 요약
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {totalVariants}
              </div>
              <div className="text-sm text-gray-600">총 생성 개수</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {distributionPercentages.high}%
              </div>
              <div className="text-sm text-gray-600">고품질 (0.8+)</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {distributionPercentages.medium}%
              </div>
              <div className="text-sm text-gray-600">중품질 (0.6-0.8)</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {distributionPercentages.low}%
              </div>
              <div className="text-sm text-gray-600">저품질 (0.6 미만)</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 품질 분포 차트 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="w-5 h-5" />
            품질 분포 분석
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-green-700">
                    고품질
                  </span>
                  <span className="text-sm">{qualityDistribution.high}개</span>
                </div>
                <Progress
                  value={distributionPercentages.high}
                  className="h-3"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-yellow-700">
                    중품질
                  </span>
                  <span className="text-sm">
                    {qualityDistribution.medium}개
                  </span>
                </div>
                <Progress
                  value={distributionPercentages.medium}
                  className="h-3"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-red-700">
                    저품질
                  </span>
                  <span className="text-sm">{qualityDistribution.low}개</span>
                </div>
                <Progress value={distributionPercentages.low} className="h-3" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 메트릭별 상세 분석 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            메트릭별 상세 분석 및 개선 가이드
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Object.entries(result.evaluation.metrics).map(([key, metric]) => {
              const status = getMetricStatus(metric.score);
              const StatusIcon = status.icon;
              const guide = getImprovementGuide(key, metric.score);

              return (
                <div key={key} className="space-y-3 p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StatusIcon className={`w-4 h-4 ${status.color}`} />
                      <span className="font-medium">
                        {key === "diversity" && "다양성"}
                        {key === "quality" && "품질"}
                        {key === "relevance" && "관련성"}
                        {key === "usefulness" && "유용성"}
                      </span>
                    </div>
                    <Badge
                      variant={metric.score >= 0.6 ? "default" : "secondary"}
                    >
                      {metric.score.toFixed(2)}
                    </Badge>
                  </div>
                  <Progress value={metric.score * 100} className="h-2" />
                  <p className="text-xs text-gray-600">{metric.description}</p>
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      <strong>개선 방법:</strong> {guide}
                    </AlertDescription>
                  </Alert>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 취약점 및 개선 우선순위 */}
      {weakAreas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              개선이 필요한 영역
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {weakAreas.map((area, index) => (
                <Alert key={area.key} variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>{area.name}</strong> (점수: {area.score.toFixed(2)})
                    - 이 영역에 대한 구체적인 피드백을 제공하면 시스템이
                    자동으로 개선 전략을 수립합니다.
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 사용자 피드백 가이드 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="w-5 h-5 text-blue-600" />
            피드백 작성 가이드
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-medium text-green-700">
                  효과적인 피드백 예시
                </h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>
                    • "다양성을 높이려면 문체를 격식체와 반말체로 섞어서
                    생성해줘"
                  </li>
                  <li>
                    • "질문의 난이도를 초급/중급/고급으로 나누어서 만들어줘"
                  </li>
                  <li>
                    • "실무에서 바로 사용할 수 있는 구체적인 예시를 더 포함해줘"
                  </li>
                  <li>
                    • "전문 용어 설명을 더 자세히 추가해서 이해하기 쉽게 해줘"
                  </li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-red-700">피해야 할 피드백</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• "더 좋게 만들어줘" (구체성 부족)</li>
                  <li>• "이상해" (개선 방향 불명확)</li>
                  <li>• "다시 해줘" (무엇을 개선할지 모호)</li>
                  <li>• "완벽하게 해줘" (실행 가능성 부족)</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
