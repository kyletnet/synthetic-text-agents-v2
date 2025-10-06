import { NextRequest, NextResponse } from "next/server";

interface ExpertFeedback {
  sessionId: string;
  feedback: string;
  focusAreas: string[];
  priority: "high" | "medium" | "low";
  expectedOutcome: string;
  timestamp: string;
}

// 피드백 저장소 (실제로는 데이터베이스 사용)
const feedbackStore = new Map<string, ExpertFeedback[]>();

export async function POST(request: NextRequest) {
  try {
    const feedback: ExpertFeedback = await request.json();

    // 피드백 유효성 검증
    if (!feedback.sessionId || !feedback.feedback?.trim()) {
      return NextResponse.json(
        { error: "sessionId와 feedback은 필수입니다." },
        { status: 400 },
      );
    }

    // 피드백 저장
    const sessionFeedbacks = feedbackStore.get(feedback.sessionId) || [];
    sessionFeedbacks.push({
      ...feedback,
      timestamp: new Date().toISOString(),
    });
    feedbackStore.set(feedback.sessionId, sessionFeedbacks);

    console.log(
      `💬 Expert feedback received for session ${feedback.sessionId}:`,
    );
    console.log(`📝 Feedback: ${feedback.feedback}`);
    console.log(`🎯 Focus areas: ${feedback.focusAreas.join(", ")}`);
    console.log(`⚡ Priority: ${feedback.priority}`);

    // 피드백 분석 및 개선 전략 생성 (여기서는 간단한 응답)
    const analysisResult = analyzeFeedback(feedback);

    return NextResponse.json({
      success: true,
      feedbackId: `feedback_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`,
      analysis: analysisResult,
      message:
        "피드백이 성공적으로 접수되었습니다. 3-Agent 시스템이 개선 전략을 수립 중입니다.",
      nextSteps: [
        "1. 피드백 해석 및 분석",
        "2. 개선 전략 수립",
        "3. 자동 개선 실행",
        "4. Before/After 비교 결과 제공",
      ],
    });
  } catch (error) {
    console.error("Expert feedback processing error:", error);
    return NextResponse.json(
      { error: "Failed to process expert feedback" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId");

  if (!sessionId) {
    return NextResponse.json(
      { error: "sessionId parameter is required" },
      { status: 400 },
    );
  }

  const feedbacks = feedbackStore.get(sessionId) || [];

  return NextResponse.json({
    success: true,
    sessionId,
    feedbacks,
    count: feedbacks.length,
  });
}

// 피드백 분석 함수 (실제로는 더 복잡한 AI 분석)
function analyzeFeedback(feedback: ExpertFeedback) {
  const { feedback: text, focusAreas, priority } = feedback;

  // 키워드 기반 간단한 분석
  const analysis = {
    intent: detectIntent(text),
    suggestedActions: generateActions(text, focusAreas),
    complexity: assessComplexity(text, focusAreas),
    estimatedImpact: estimateImpact(priority, focusAreas.length),
    confidence: calculateConfidence(text.length, focusAreas.length),
  };

  return analysis;
}

function detectIntent(text: string) {
  const lowerText = text.toLowerCase();

  if (
    lowerText.includes("다양") ||
    lowerText.includes("여러") ||
    lowerText.includes("섞어")
  ) {
    return "diversity_improvement";
  }
  if (
    lowerText.includes("품질") ||
    lowerText.includes("정확") ||
    lowerText.includes("자연스럽")
  ) {
    return "quality_enhancement";
  }
  if (
    lowerText.includes("실용") ||
    lowerText.includes("활용") ||
    lowerText.includes("사용")
  ) {
    return "usefulness_boost";
  }
  if (
    lowerText.includes("관련") ||
    lowerText.includes("맥락") ||
    lowerText.includes("연결")
  ) {
    return "relevance_improvement";
  }

  return "general_improvement";
}

function generateActions(text: string, focusAreas: string[]) {
  const actions: string[] = [];

  // 텍스트 기반 액션 추천
  if (text.includes("문체")) {
    actions.push("다양한 문체(격식체/반말체) 적용");
  }
  if (text.includes("길이")) {
    actions.push("다양한 길이의 텍스트 생성");
  }
  if (text.includes("난이도")) {
    actions.push("난이도별 버전 생성");
  }
  if (text.includes("예시")) {
    actions.push("구체적인 예시 추가");
  }
  if (text.includes("설명")) {
    actions.push("상세한 설명 보강");
  }

  // 포커스 영역 기반 액션 추가
  focusAreas.forEach((area) => {
    switch (area) {
      case "diversity":
        if (!actions.some((a) => a.includes("문체"))) {
          actions.push("표현 방식 다양화");
        }
        break;
      case "quality":
        actions.push("언어적 품질 향상");
        break;
      case "usefulness":
        actions.push("실용성 강화");
        break;
      case "relevance":
        actions.push("주제 연관성 개선");
        break;
    }
  });

  return actions.length > 0 ? actions : ["전반적인 품질 개선"];
}

function assessComplexity(text: string, focusAreas: string[]) {
  const textComplexity = text.split(".").length; // 문장 수
  const areaComplexity = focusAreas.length;

  const totalComplexity = textComplexity + areaComplexity * 2;

  if (totalComplexity > 10) return "high";
  if (totalComplexity > 5) return "medium";
  return "low";
}

function estimateImpact(priority: string, areaCount: number) {
  let baseImpact = 0;

  switch (priority) {
    case "high":
      baseImpact = 80;
      break;
    case "medium":
      baseImpact = 60;
      break;
    case "low":
      baseImpact = 40;
      break;
  }

  // 영역 수에 따른 가중치
  const areaWeight = Math.min(areaCount * 10, 20);

  return Math.min(baseImpact + areaWeight, 100);
}

function calculateConfidence(textLength: number, areaCount: number) {
  let confidence = 0.5; // 기본 신뢰도

  // 텍스트 길이에 따른 신뢰도
  if (textLength > 100) confidence += 0.3;
  else if (textLength > 50) confidence += 0.2;
  else if (textLength > 20) confidence += 0.1;

  // 영역 지정에 따른 신뢰도
  if (areaCount > 0) confidence += 0.2;
  if (areaCount > 2) confidence += 0.1;

  return Math.min(confidence, 0.95);
}
