/**
 * Intent Classification Types
 *
 * Phase 7: Intent-Driven RAG
 *
 * Purpose:
 * - Understand user's true intention beyond surface text
 * - Guide retrieval strategy based on intent type
 * - Optimize prompt and context selection
 */

/**
 * Query Intent Types
 */
export type IntentType =
  | 'factual'       // 사실 확인: "가격은?", "언제?"
  | 'procedural'    // 절차 설명: "어떻게?", "방법은?"
  | 'comparative'   // 비교 분석: "차이점은?", "더 나은?"
  | 'explanatory'   // 설명 요청: "왜?", "이유는?"
  | 'navigational'  // 위치/문서 찾기: "어디서?", "문서는?"
  | 'aggregative';  // 집계/요약: "전체", "모두"

/**
 * Expected Answer Type
 */
export type AnswerType =
  | 'numeric'       // 숫자 답변
  | 'text'          // 텍스트 답변
  | 'list'          // 목록 답변
  | 'table'         // 표 답변
  | 'boolean'       // 예/아니오
  | 'date';         // 날짜 답변

/**
 * Query Intent
 */
export interface QueryIntent {
  type: IntentType;
  entities: string[];        // 추출된 개체명
  keywords: string[];        // 핵심 키워드
  expectedAnswerType: AnswerType;
  confidence: number;        // 0-1 (분류 신뢰도)
  reasoning?: string;        // 분류 근거 (디버깅용)
}

/**
 * Intent Classification Result
 */
export interface IntentClassificationResult {
  intent: QueryIntent;
  alternativeIntents?: QueryIntent[]; // 가능한 대안 해석
  processingTime: number;    // ms
  cost: {
    tokens: number;
    usd: number;
  };
}

/**
 * Context Strategy based on Intent
 */
export interface ContextStrategy {
  intentType: IntentType;
  retrievalStrategy: 'precise' | 'broad' | 'structured' | 'narrative';
  preferredChunkTypes: ('section' | 'table' | 'list' | 'paragraph')[];
  contextWindowSize: 'small' | 'medium' | 'large';
  requiresCitation: boolean;
  allowsSynthesis: boolean;  // 여러 Context 통합 허용 여부
}
