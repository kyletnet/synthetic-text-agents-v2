"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  MessageSquare,
  Send,
  Lightbulb,
  Target,
  AlertCircle,
  CheckCircle2,
  Brain,
  Loader2,
} from "lucide-react";

interface ExpertFeedbackProps {
  sessionId: string;
  currentResult: any;
  onFeedbackSubmit: (feedback: ExpertFeedback) => Promise<void>;
}

interface ExpertFeedback {
  sessionId: string;
  feedback: string;
  focusAreas: string[];
  priority: "high" | "medium" | "low";
  expectedOutcome: string;
  timestamp: string;
}

const FOCUS_AREAS = [
  {
    id: "diversity",
    label: "다양성",
    description: "표현 방식, 문체, 구조의 다양화",
  },
  { id: "quality", label: "품질", description: "언어적 정확성, 자연스러움" },
  { id: "relevance", label: "관련성", description: "원본과의 의미적 연결성" },
  { id: "usefulness", label: "유용성", description: "실제 활용 가능성" },
  { id: "creativity", label: "창의성", description: "독창적이고 참신한 접근" },
  { id: "context", label: "맥락 이해", description: "상황과 목적에 맞는 생성" },
];

const PRIORITY_LEVELS = [
  {
    value: "high",
    label: "높음",
    color: "bg-red-100 text-red-800",
    description: "즉시 개선 필요",
  },
  {
    value: "medium",
    label: "보통",
    color: "bg-yellow-100 text-yellow-800",
    description: "점진적 개선",
  },
  {
    value: "low",
    label: "낮음",
    color: "bg-green-100 text-green-800",
    description: "선택적 개선",
  },
];

const FEEDBACK_EXAMPLES = [
  {
    category: "다양성 개선",
    examples: [
      '"문체를 격식체와 반말체로 섞어서 생성해줘"',
      '"질문 길이를 짧은 것과 긴 것으로 다양하게 만들어줘"',
      '"초급, 중급, 고급 난이도로 나누어서 생성해줘"',
    ],
  },
  {
    category: "품질 개선",
    examples: [
      '"전문 용어를 더 정확하게 사용해서 개선해줘"',
      '"문법적 오류를 줄이고 더 자연스럽게 만들어줘"',
      '"설명을 더 논리적으로 구조화해서 작성해줘"',
    ],
  },
  {
    category: "실용성 강화",
    examples: [
      '"실무에서 바로 사용할 수 있는 구체적인 예시를 추가해줘"',
      '"학습자가 이해하기 쉽도록 단계별로 설명해줘"',
      '"현실적인 상황을 반영한 문제로 만들어줘"',
    ],
  },
];

export default function ExpertFeedbackPanel({
  sessionId,
  currentResult,
  onFeedbackSubmit,
}: ExpertFeedbackProps) {
  const [feedback, setFeedback] = useState("");
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [priority, setPriority] = useState<"high" | "medium" | "low">("medium");
  const [expectedOutcome, setExpectedOutcome] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showExamples, setShowExamples] = useState(false);

  // 현재 결과 기반 개선 제안
  const weakAreas = Object.entries(currentResult.evaluation.metrics)
    .filter(([_, metric]: [string, any]) => metric.score < 0.7)
    .map(([key, metric]: [string, any]) => ({
      key,
      name:
        key === "diversity"
          ? "다양성"
          : key === "quality"
          ? "품질"
          : key === "relevance"
          ? "관련성"
          : "유용성",
      score: metric.score,
    }));

  const handleAreaToggle = (areaId: string) => {
    setSelectedAreas((prev) =>
      prev.includes(areaId)
        ? prev.filter((id) => id !== areaId)
        : [...prev, areaId],
    );
  };

  const handleSubmit = async () => {
    if (!feedback.trim()) {
      alert("피드백을 입력해주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      const feedbackData: ExpertFeedback = {
        sessionId,
        feedback: feedback.trim(),
        focusAreas: selectedAreas,
        priority,
        expectedOutcome: expectedOutcome.trim(),
        timestamp: new Date().toISOString(),
      };

      await onFeedbackSubmit(feedbackData);

      // 성공 후 초기화
      setFeedback("");
      setSelectedAreas([]);
      setPriority("medium");
      setExpectedOutcome("");
    } catch (error) {
      console.error("피드백 제출 실패:", error);
      alert("피드백 제출에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const insertExample = (example: string) => {
    setFeedback(
      (prev) => prev + (prev ? "\n" : "") + example.replace(/"/g, ""),
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-blue-600" />
          전문가 피드백
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 취약점 기반 제안 */}
        {weakAreas.length > 0 && (
          <Alert>
            <Target className="h-4 w-4" />
            <AlertDescription>
              <strong>개선 추천 영역:</strong>{" "}
              {weakAreas.map((area) => area.name).join(", ")}
              <div className="mt-2 text-sm">
                이 영역들에 대한 구체적인 피드백을 제공하면 더 효과적인 개선이
                가능합니다.
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* 집중 개선 영역 선택 */}
        <div className="space-y-3">
          <h4 className="font-medium flex items-center gap-2">
            <Target className="w-4 h-4" />
            집중 개선 영역 (복수 선택 가능)
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {FOCUS_AREAS.map((area) => (
              <button
                key={area.id}
                onClick={() => handleAreaToggle(area.id)}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  selectedAreas.includes(area.id)
                    ? "bg-blue-50 border-blue-300 text-blue-800"
                    : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                }`}
              >
                <div className="font-medium text-sm">{area.label}</div>
                <div className="text-xs text-gray-600 mt-1">
                  {area.description}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 우선순위 선택 */}
        <div className="space-y-3">
          <h4 className="font-medium">개선 우선순위</h4>
          <div className="flex gap-2">
            {PRIORITY_LEVELS.map((level) => (
              <button
                key={level.value}
                onClick={() => setPriority(level.value as any)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  priority === level.value
                    ? level.color
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {level.label}
                <div className="text-xs mt-1">{level.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 피드백 예시 보기/숨기기 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">구체적인 개선 요청</h4>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowExamples(!showExamples)}
            >
              <Lightbulb className="w-4 h-4 mr-1" />
              {showExamples ? "예시 숨기기" : "예시 보기"}
            </Button>
          </div>

          {/* 피드백 예시 */}
          {showExamples && (
            <div className="bg-gray-50 p-4 rounded-lg space-y-4">
              {FEEDBACK_EXAMPLES.map((category, idx) => (
                <div key={idx}>
                  <h5 className="font-medium text-sm text-gray-700 mb-2">
                    {category.category}
                  </h5>
                  <div className="space-y-1">
                    {category.examples.map((example, exIdx) => (
                      <button
                        key={exIdx}
                        onClick={() => insertExample(example)}
                        className="block w-full text-left text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-2 rounded transition-colors"
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 피드백 입력 */}
          <Textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="예: '다양성을 높이려면 문체를 격식체와 반말체로 섞어서 생성해줘. 그리고 질문 길이도 짧은 것과 긴 것으로 다양하게 만들어줘.'"
            className="min-h-[120px]"
          />
          <div className="text-sm text-gray-600">
            💡 구체적이고 실행 가능한 개선 방향을 제시해주세요. 시스템이
            자동으로 전략을 수립합니다.
          </div>
        </div>

        {/* 기대 결과 (선택사항) */}
        <div className="space-y-3">
          <h4 className="font-medium">기대하는 결과 (선택사항)</h4>
          <Textarea
            value={expectedOutcome}
            onChange={(e) => setExpectedOutcome(e.target.value)}
            placeholder="예: '초급자도 이해할 수 있는 쉬운 설명이 포함된 다양한 형태의 Q&A'"
            className="min-h-[60px]"
          />
        </div>

        {/* 제출 버튼 */}
        <div className="flex justify-end gap-3">
          <Button
            onClick={handleSubmit}
            disabled={!feedback.trim() || isSubmitting}
            className="flex items-center gap-2"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {isSubmitting ? "피드백 처리 중..." : "개선 요청 제출"}
          </Button>
        </div>

        {/* 안내 메시지 */}
        <Alert>
          <Brain className="h-4 w-4" />
          <AlertDescription>
            <strong>다음 단계:</strong> 제출된 피드백을 8-Agent 시스템이
            분석하여 구체적인 개선 전략을 수립하고, 자동으로 개선된 증강 결과를
            생성합니다.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
