"use client";

import React, { useState, useEffect } from "react";

interface BaselineMetric {
  name: string;
  value: number;
  threshold: number;
  status: "pass" | "warn" | "fail";
  priority: "P0" | "P1" | "P2";
  description: string;
}

interface BaselineReport {
  session: string;
  timestamp: string;
  itemsAnalyzed: number;
  overallScore: number;
  gateStatus: "PASS" | "FAIL";
  canProceed: boolean;
  metrics: BaselineMetric[];
  alerts: {
    p0: string[];
    p1: string[];
    p2: string[];
  };
}

const BaselineDashboard: React.FC = () => {
  const [report, setReport] = useState<BaselineReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBaselineReport = async () => {
      try {
        // Mock data based on our actual baseline report
        const mockReport: BaselineReport = {
          session: "baseline_20250924_124136_dev_smoke",
          timestamp: "2025-09-24T03:41:36.674Z",
          itemsAnalyzed: 100,
          overallScore: 55.0,
          gateStatus: "FAIL",
          canProceed: false,
          metrics: [
            {
              name: "Evidence Quality",
              value: 0.0,
              threshold: 70.0,
              status: "fail",
              priority: "P0",
              description:
                "답변과 근거 텍스트의 정합성을 측정합니다. 현재 100% 근거가 누락되어 있습니다.",
            },
            {
              name: "Coverage Score",
              value: 0.0,
              threshold: 50.0,
              status: "fail",
              priority: "P2",
              description:
                "소스 텍스트의 중요 정보 커버리지를 측정합니다. 한국어 엔터티 추출 시스템이 작동하지 않고 있습니다.",
            },
            {
              name: "Duplication Rate",
              value: 0.0,
              threshold: 10.0,
              status: "pass",
              priority: "P2",
              description:
                "Q&A 쌍 간의 중복도를 검사합니다. 현재는 중복이 없어 양호합니다.",
            },
            {
              name: "Hallucination Rate",
              value: 0.0,
              threshold: 3.0,
              status: "pass",
              priority: "P1",
              description:
                "근거 없는 정보 생성을 탐지합니다. 현재 환각 현상이 발견되지 않았습니다.",
            },
            {
              name: "PII Violations",
              value: 0,
              threshold: 0,
              status: "pass",
              priority: "P0",
              description:
                "개인정보 노출을 검사합니다. 위반 사항이 발견되지 않았습니다.",
            },
            {
              name: "Question Type Balance",
              value: 100.0,
              threshold: 80.0,
              status: "fail",
              priority: "P2",
              description:
                "질문 유형의 균형성을 측정합니다. 4개 유형 중 2개만 존재하여 불균형합니다.",
            },
          ],
          alerts: {
            p0: ["Evidence missing rate: 100.0% > 20.0%"],
            p1: [],
            p2: [
              "Coverage rate FAIL: 0.0% <= 50.0%",
              "Quality score WARN: 55.0% <= 70.0%",
            ],
          },
        };

        setReport(mockReport);
      } catch (err) {
        console.error("Failed to fetch baseline report:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchBaselineReport();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchBaselineReport, 30000);
    return () => clearInterval(interval);
  }, []);

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-600";
    if (score >= 80) return "text-green-500";
    if (score >= 70) return "text-yellow-500";
    if (score >= 60) return "text-orange-500";
    return "text-red-500";
  };

  const getScoreIcon = (score: number) => {
    if (score >= 90) return "🟢";
    if (score >= 80) return "🟢";
    if (score >= 70) return "🟡";
    if (score >= 60) return "🟡";
    return "🔴";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pass":
        return "text-green-600 bg-green-100";
      case "warn":
        return "text-yellow-600 bg-yellow-100";
      case "fail":
        return "text-red-600 bg-red-100";
      default:
        return "text-gray-600 bg-gray-100";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "P0":
        return "bg-red-500 text-white";
      case "P1":
        return "bg-orange-500 text-white";
      case "P2":
        return "bg-yellow-500 text-white";
      default:
        return "bg-gray-500 text-white";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">베이스라인 리포트 로딩 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center text-red-600">
          <h2 className="text-2xl font-bold mb-2">
            베이스라인 리포트 로딩 실패
          </h2>
          <p>{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center text-gray-600">
          <h2 className="text-2xl font-bold mb-2">데이터 없음</h2>
          <p>베이스라인 리포트를 불러올 수 없습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                베이스라인 평가 대시보드
              </h1>
              <p className="text-gray-500 mt-1">세션: {report.session}</p>
            </div>
            <div
              className={`px-4 py-2 rounded-lg text-lg font-semibold ${
                report.gateStatus === "PASS"
                  ? "text-green-600 bg-green-100"
                  : "text-red-600 bg-red-100"
              }`}
            >
              {report.gateStatus === "PASS" ? "✅ 통과" : "❌ 실패"}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overall Score Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 mb-8">
          <div className="text-center">
            <div
              className={`text-6xl font-bold ${getScoreColor(
                report.overallScore,
              )} mb-4`}
            >
              {getScoreIcon(report.overallScore)} {report.overallScore}%
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
              종합 품질 점수
            </h2>
            <p className="text-gray-600 mb-6">
              {report.itemsAnalyzed}개 항목 분석 완료 •{" "}
              {new Date(report.timestamp).toLocaleString("ko-KR")}
            </p>

            {/* Score Interpretation */}
            <div className="bg-gray-50 rounded-lg p-4 text-left max-w-2xl mx-auto">
              <h3 className="font-semibold text-gray-900 mb-2">점수 해석</h3>
              <div className="space-y-1 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-green-600">
                    90-100%: 🟢 우수 - 운영 준비 완료
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-green-500">
                    80-89%: 🟢 양호 - 마이너 개선 후 운영
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-yellow-500">
                    70-79%: 🟡 보통 - 주요 개선 필요
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-orange-500">
                    60-69%: 🟡 미흡 - 상당한 개선 필요
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-red-500">
                    0-59%: 🔴 불량 - 운영 불가
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Alerts Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* P0 Critical */}
          <div className="bg-white rounded-lg shadow-sm border border-red-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                🚨 P0 Critical
              </h3>
              <span className="bg-red-500 text-white px-2 py-1 rounded text-sm font-semibold">
                {report.alerts.p0.length}
              </span>
            </div>
            <div className="space-y-2">
              {report.alerts.p0.length === 0 ? (
                <p className="text-gray-500 text-sm">위반 사항 없음</p>
              ) : (
                report.alerts.p0.map((alert, index) => (
                  <div
                    key={index}
                    className="bg-red-50 border border-red-200 rounded p-2 text-sm text-red-800"
                  >
                    {alert}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* P1 High */}
          <div className="bg-white rounded-lg shadow-sm border border-orange-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                ⚠️ P1 High
              </h3>
              <span className="bg-orange-500 text-white px-2 py-1 rounded text-sm font-semibold">
                {report.alerts.p1.length}
              </span>
            </div>
            <div className="space-y-2">
              {report.alerts.p1.length === 0 ? (
                <p className="text-gray-500 text-sm">위반 사항 없음</p>
              ) : (
                report.alerts.p1.map((alert, index) => (
                  <div
                    key={index}
                    className="bg-orange-50 border border-orange-200 rounded p-2 text-sm text-orange-800"
                  >
                    {alert}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* P2 Medium */}
          <div className="bg-white rounded-lg shadow-sm border border-yellow-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                🟡 P2 Medium
              </h3>
              <span className="bg-yellow-500 text-white px-2 py-1 rounded text-sm font-semibold">
                {report.alerts.p2.length}
              </span>
            </div>
            <div className="space-y-2">
              {report.alerts.p2.length === 0 ? (
                <p className="text-gray-500 text-sm">위반 사항 없음</p>
              ) : (
                report.alerts.p2.map((alert, index) => (
                  <div
                    key={index}
                    className="bg-yellow-50 border border-yellow-200 rounded p-2 text-sm text-yellow-800"
                  >
                    {alert}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Metrics Detail Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {report.metrics.map((metric, index) => (
            <div
              key={index}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900">
                  {metric.name}
                </h3>
                <span
                  className={`px-2 py-1 rounded text-xs font-semibold ${getPriorityColor(
                    metric.priority,
                  )}`}
                >
                  {metric.priority}
                </span>
              </div>

              <div className="mb-4">
                <div
                  className={`text-3xl font-bold mb-2 ${
                    getStatusColor(metric.status).split(" ")[0]
                  }`}
                >
                  {metric.value}
                  {metric.name.includes("Rate") ||
                  metric.name.includes("Score") ||
                  metric.name.includes("Balance")
                    ? "%"
                    : ""}
                </div>
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span>
                    임계값: {metric.threshold}
                    {metric.name.includes("Rate") ||
                    metric.name.includes("Score") ||
                    metric.name.includes("Balance")
                      ? "%"
                      : ""}
                  </span>
                  <span
                    className={`px-2 py-1 rounded ${getStatusColor(
                      metric.status,
                    )}`}
                  >
                    {metric.status.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="bg-gray-50 rounded p-3">
                <p className="text-sm text-gray-700">{metric.description}</p>
              </div>

              {/* Progress Bar */}
              <div className="mt-4">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      metric.status === "pass"
                        ? "bg-green-500"
                        : metric.status === "warn"
                        ? "bg-yellow-500"
                        : "bg-red-500"
                    }`}
                    style={{
                      width: `${Math.min(
                        100,
                        (metric.value / metric.threshold) * 100,
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            빠른 작업
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <button
              onClick={() => alert("베이스라인 테스트 재실행...")}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
            >
              🔄 다시 실행
            </button>
            <button
              onClick={() => alert("상세 리포트 보기...")}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition-colors"
            >
              📊 상세 리포트
            </button>
            <button
              onClick={() => alert("결과 내보내기...")}
              className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 transition-colors"
            >
              📥 내보내기
            </button>
            <button
              onClick={() => alert("문제 해결 가이드...")}
              className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600 transition-colors"
            >
              💡 개선 가이드
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BaselineDashboard;
