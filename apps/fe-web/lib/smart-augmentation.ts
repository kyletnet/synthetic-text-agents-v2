// 스마트 증강 시스템 - 입력 타입에 따른 자동 추천
import {
  DataAugmentationSystem,
  AugmentationRequest,
} from "./augmentation-utils";
import { RAGSystem } from "./rag-utils";

export interface InputAnalysis {
  type: "document" | "sentence" | "paragraph" | "qa_pair" | "code" | "unknown";
  confidence: number;
  characteristics: string[];
  recommendedAugmentations: RecommendedAugmentation[];
}

export interface RecommendedAugmentation {
  type: AugmentationRequest["augmentationType"];
  priority: "high" | "medium" | "low";
  reason: string;
  expectedOutput: string;
}

export interface SmartAugmentationSession {
  analysis: InputAnalysis;
  augmentations: any[];
  evaluation: AugmentationEvaluation;
}

export interface AugmentationEvaluation {
  overallScore: number;
  metrics: {
    diversity: { score: number; description: string };
    quality: { score: number; description: string };
    relevance: { score: number; description: string };
    usefulness: { score: number; description: string };
  };
  recommendations: string[];
  bestVariants: any[];
}

export class SmartAugmentationSystem {
  // 입력 분석 및 타입 감지
  static analyzeInput(input: string): InputAnalysis {
    const trimmed = input.trim();
    const wordCount = trimmed.split(/\s+/).length;
    const lineCount = trimmed.split("\n").length;
    const hasQuestionMarks = /\?/.test(trimmed);
    const hasColons = /:/.test(trimmed);
    const hasCodePatterns =
      /```|function|class|import|export|console\.log/.test(trimmed);
    const hasMarkdown = /#{1,6}\s|^\*\s|\[.*\]\(.*\)/.test(trimmed);

    let type: InputAnalysis["type"] = "unknown";
    let confidence = 0;
    let characteristics: string[] = [];

    // 코드 감지
    if (hasCodePatterns) {
      type = "code";
      confidence = 0.9;
      characteristics = ["코드 패턴 감지", "프로그래밍 언어"];
    }
    // Q&A 감지
    else if (hasQuestionMarks && hasColons && lineCount >= 2) {
      type = "qa_pair";
      confidence = 0.85;
      characteristics = ["질문-답변 구조", "대화형 형태"];
    }
    // 문서 감지 (긴 텍스트, 마크다운 등)
    else if (wordCount > 50 || hasMarkdown || lineCount > 5) {
      type = "document";
      confidence = 0.8;
      characteristics = ["긴 형태의 텍스트", "구조화된 내용"];
    }
    // 단락 감지
    else if (wordCount > 10 && lineCount > 1) {
      type = "paragraph";
      confidence = 0.75;
      characteristics = ["여러 문장", "단락 형태"];
    }
    // 문장 감지
    else if (wordCount <= 20) {
      type = "sentence";
      confidence = 0.7;
      characteristics = ["짧은 문장", "단일 아이디어"];
    }

    const recommendedAugmentations = this.getRecommendations(
      type,
      characteristics,
    );

    return {
      type,
      confidence,
      characteristics,
      recommendedAugmentations,
    };
  }

  // 타입별 추천 증강 방법
  private static getRecommendations(
    type: InputAnalysis["type"],
    characteristics: string[],
  ): RecommendedAugmentation[] {
    const recommendations: Record<string, RecommendedAugmentation[]> = {
      document: [
        {
          type: "qa_generation",
          priority: "high",
          reason: "문서 내용을 바탕으로 교육용 Q&A를 생성하여 학습 자료로 활용",
          expectedOutput: "문서 핵심 내용 기반 질문-답변 세트",
        },
        {
          type: "summarize",
          priority: "high",
          reason: "긴 문서의 핵심 내용을 간결하게 요약",
          expectedOutput: "핵심 포인트 중심의 요약본",
        },
        {
          type: "extend",
          priority: "medium",
          reason: "특정 섹션을 더 자세히 설명하여 보완",
          expectedOutput: "심화 설명이 추가된 확장 버전",
        },
      ],
      sentence: [
        {
          type: "paraphrase",
          priority: "high",
          reason: "같은 의미를 다양한 표현으로 변형하여 어휘 다양성 확보",
          expectedOutput: "의미는 동일하되 표현이 다른 문장들",
        },
        {
          type: "extend",
          priority: "high",
          reason: "간단한 문장을 구체적인 설명으로 확장",
          expectedOutput: "예시와 설명이 추가된 상세 버전",
        },
        {
          type: "style_transfer",
          priority: "medium",
          reason: "격식체/반말체 등 다양한 문체로 변환",
          expectedOutput: "다양한 상황에 맞는 문체 변형",
        },
      ],
      paragraph: [
        {
          type: "paraphrase",
          priority: "high",
          reason: "단락의 핵심 내용을 다른 방식으로 표현",
          expectedOutput: "구조와 표현이 다른 단락 버전들",
        },
        {
          type: "summarize",
          priority: "medium",
          reason: "단락의 핵심만 간추려서 요약",
          expectedOutput: "핵심 메시지 중심의 압축 버전",
        },
        {
          type: "extend",
          priority: "medium",
          reason: "단락에 추가 정보와 예시를 보강",
          expectedOutput: "더 풍부한 내용의 확장 단락",
        },
      ],
      qa_pair: [
        {
          type: "paraphrase",
          priority: "high",
          reason: "Q&A를 다양한 방식으로 표현하여 학습 데이터 확장",
          expectedOutput: "질문과 답변의 다양한 표현 버전",
        },
        {
          type: "extend",
          priority: "high",
          reason: "답변에 더 자세한 설명이나 예시 추가",
          expectedOutput: "더 상세하고 교육적인 답변",
        },
        {
          type: "style_transfer",
          priority: "medium",
          reason: "전문가/초보자 등 대상에 맞는 설명 톤 조절",
          expectedOutput: "대상별 맞춤형 Q&A",
        },
      ],
      code: [
        {
          type: "extend",
          priority: "high",
          reason: "코드에 주석과 설명을 추가하여 교육 자료화",
          expectedOutput: "주석과 설명이 풍부한 코드",
        },
        {
          type: "paraphrase",
          priority: "medium",
          reason: "같은 기능을 다른 방식으로 구현",
          expectedOutput: "동일 기능의 대안적 구현",
        },
      ],
      unknown: [
        {
          type: "paraphrase",
          priority: "medium",
          reason: "일반적인 패러프레이즈로 표현 다양화",
          expectedOutput: "다양한 표현 변형",
        },
        {
          type: "extend",
          priority: "medium",
          reason: "내용에 추가 정보 보완",
          expectedOutput: "보완된 확장 버전",
        },
      ],
    };

    return recommendations[type] || recommendations.unknown;
  }

  // 스마트 증강 실행
  static async performSmartAugmentation(
    input: string,
    options?: {
      useRecommended?: boolean;
      customCount?: number;
      includeRAG?: boolean;
    },
  ): Promise<SmartAugmentationSession> {
    const analysis = this.analyzeInput(input);
    const augmentations = [];

    // 추천된 증강 방법들 실행
    const highPriorityAugmentations = analysis.recommendedAugmentations
      .filter((rec) => rec.priority === "high")
      .slice(0, 2); // 상위 2개만

    for (const rec of highPriorityAugmentations) {
      const session = await DataAugmentationSystem.augmentData({
        input,
        augmentationType: rec.type,
        count: options?.customCount || 3,
        options: {
          useRAG: options?.includeRAG ?? true,
        },
      });

      augmentations.push({
        type: rec.type,
        reason: rec.reason,
        results: session.results,
        summary: session.summary,
      });
    }

    // 결과 평가
    const evaluation = this.evaluateAugmentations(
      input,
      augmentations,
      analysis,
    );

    return {
      analysis,
      augmentations,
      evaluation,
    };
  }

  // 증강 결과 종합 평가
  private static evaluateAugmentations(
    original: string,
    augmentations: any[],
    analysis: InputAnalysis,
  ): AugmentationEvaluation {
    const allResults = augmentations.flatMap((aug) => aug.results);

    if (allResults.length === 0) {
      return {
        overallScore: 0,
        metrics: {
          diversity: { score: 0, description: "증강 결과가 없습니다." },
          quality: { score: 0, description: "평가할 데이터가 없습니다." },
          relevance: { score: 0, description: "관련성을 측정할 수 없습니다." },
          usefulness: { score: 0, description: "유용성을 평가할 수 없습니다." },
        },
        recommendations: ["입력을 다시 확인해주세요."],
        bestVariants: [],
      };
    }

    // 메트릭 계산 (모든 점수를 0-1 범위로 제한)
    const diversityScore = this.calculateDiversity(allResults);
    const qualityScore = Math.min(
      Math.max(
        allResults.reduce((sum, r) => sum + (r.quality?.score || 0.7), 0) /
          allResults.length,
        0,
      ),
      1,
    );
    const relevanceScore = this.calculateRelevance(
      original,
      allResults,
      analysis,
    );
    const usefulnessScore = Math.min(
      Math.max(
        allResults.reduce(
          (sum, r) => sum + (r.quality?.metrics?.usefulness || 0.7),
          0,
        ) / allResults.length,
        0,
      ),
      1,
    );

    const overallScore =
      (diversityScore + qualityScore + relevanceScore + usefulnessScore) / 4;

    // 최고 성능 변형들 선별
    const bestVariants = allResults
      .sort((a, b) => b.quality.score - a.quality.score)
      .slice(0, 3);

    // 개선 추천사항
    const recommendations = this.generateRecommendations(overallScore, {
      diversity: diversityScore,
      quality: qualityScore,
      relevance: relevanceScore,
      usefulness: usefulnessScore,
    });

    return {
      overallScore: Math.round(overallScore * 100) / 100,
      metrics: {
        diversity: {
          score: Math.round(diversityScore * 100) / 100,
          description:
            "생성된 변형들의 표현 다양성 정도. 높을수록 더 다양한 스타일과 구조를 가짐.",
        },
        quality: {
          score: Math.round(qualityScore * 100) / 100,
          description:
            "언어적 품질과 자연스러움. 문법, 어휘 선택, 문체의 적절성을 종합 평가.",
        },
        relevance: {
          score: Math.round(relevanceScore * 100) / 100,
          description:
            "원본 내용과의 의미적 관련성. 핵심 메시지와 맥락이 얼마나 잘 보존되는지 측정.",
        },
        usefulness: {
          score: Math.round(usefulnessScore * 100) / 100,
          description:
            "실제 사용 가능성과 실용적 가치. 교육, 업무, 소통 등에서의 활용도.",
        },
      },
      recommendations,
      bestVariants,
    };
  }

  // 다양성 계산 (단순화된 버전)
  private static calculateDiversity(results: any[]): number {
    if (results.length <= 1) return 0.5;

    // 길이 다양성 (정규화)
    const lengths = results.map((r) => r.augmented.length);
    const lengthVariance = this.calculateVariance(lengths);
    const meanLength = lengths.reduce((sum, l) => sum + l, 0) / lengths.length;
    const lengthScore = Math.min(Math.sqrt(lengthVariance) / meanLength, 1); // 정규화

    // 타입 다양성
    const types = Array.from(new Set(results.map((r) => r.type)));
    const typeScore = Math.min(types.length / 3, 1);

    // 0-1 범위로 제한
    return Math.min((lengthScore + typeScore) / 2, 1);
  }

  // 관련성 계산
  private static calculateRelevance(
    _original: string,
    results: any[],
    analysis: InputAnalysis,
  ): number {
    // 입력 타입에 따른 기대 관련성 조정
    const baseScore =
      results.reduce((sum, r) => {
        const semantic = r.quality.metrics?.semantic_similarity || 0.7; // 기본값 설정
        return sum + Math.min(Math.max(semantic, 0), 1); // 0-1 범위로 제한
      }, 0) / results.length;

    // 타입별 가중치
    const typeWeights: Record<string, number> = {
      document: 0.9, // 문서는 높은 관련성 요구
      sentence: 0.8, // 문장은 적당한 관련성
      paragraph: 0.85, // 단락은 높은 관련성
      qa_pair: 0.9, // Q&A는 높은 관련성 요구
      code: 0.7, // 코드는 기능적 관련성
      unknown: 0.75, // 기본값
    };

    // 최종 점수도 0-1 범위로 제한
    return Math.min(
      Math.max(baseScore * (typeWeights[analysis.type] || 0.75), 0),
      1,
    );
  }

  // 분산 계산
  private static calculateVariance(numbers: number[]): number {
    const mean = numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
    const squaredDiffs = numbers.map((n) => Math.pow(n - mean, 2));
    return squaredDiffs.reduce((sum, sq) => sum + sq, 0) / numbers.length;
  }

  // 개선 추천사항 생성
  private static generateRecommendations(
    overallScore: number,
    metrics: any,
  ): string[] {
    const recommendations: string[] = [];

    if (overallScore < 0.6) {
      recommendations.push(
        "전반적인 증강 품질이 낮습니다. 더 구체적이고 명확한 입력을 제공해보세요.",
      );
    }

    if (metrics.diversity < 0.5) {
      recommendations.push(
        "생성된 변형의 다양성이 부족합니다. 다른 증강 타입을 시도하거나 증강 개수를 늘려보세요.",
      );
    }

    if (metrics.quality < 0.7) {
      recommendations.push(
        "언어적 품질을 개선하기 위해 더 명확하고 문법적으로 올바른 입력을 사용해보세요.",
      );
    }

    if (metrics.relevance < 0.6) {
      recommendations.push(
        "원본과의 관련성이 낮습니다. RAG 컨텍스트를 활용하거나 더 관련성 높은 문서를 업로드해보세요.",
      );
    }

    if (metrics.usefulness < 0.7) {
      recommendations.push(
        "실용성을 높이기 위해 구체적인 사용 목적에 맞는 증강 타입을 선택해보세요.",
      );
    }

    if (recommendations.length === 0) {
      recommendations.push(
        "훌륭한 증강 결과입니다! 생성된 변형들을 다양한 용도로 활용해보세요.",
      );
    }

    return recommendations;
  }
}
