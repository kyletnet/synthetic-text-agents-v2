import { NextRequest, NextResponse } from 'next/server';
import { SmartAugmentationSystem } from '@/lib/smart-augmentation';
import { ExecutionVerifier } from '@/lib/execution-verifier';
import { withAPIGuard } from '@/lib/api-guard';

async function smartAugmentHandler(request: NextRequest) {
  const sessionId = `smart_aug_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

  try {
    const body = await request.json();
    const { input, options } = body;

    if (!input?.trim()) {
      return NextResponse.json(
        { error: '입력 텍스트가 필요합니다.' },
        { status: 400 }
      );
    }

    const startTime = Date.now();

    // 스마트 증강 실행
    const session = await SmartAugmentationSystem.performSmartAugmentation(input, {
      useRecommended: options?.useRecommended ?? true,
      customCount: options?.customCount || 3,
      includeRAG: options?.includeRAG ?? true,
    });

    const processingTime = Date.now() - startTime;

    // 🔍 CRITICAL: ExecutionVerifier로 Mock 데이터 오염 검사
    const verification = ExecutionVerifier.verifySession(session);
    const envPolicy = ExecutionVerifier.checkEnvironmentPolicy();

    // 환경 정책 경고 로깅
    if (envPolicy.warnings.length > 0) {
      envPolicy.warnings.forEach(warning => console.warn(`⚠️ [ExecutionVerifier] ${warning}`));
    }

    console.log(`🧠 Smart augmentation: "${input.substring(0, 50)}..." (${session.analysis.type}, confidence: ${session.analysis.confidence}, ${processingTime}ms)`);
    console.log(`🔍 [ExecutionVerifier] Source: ${verification.source}, Verified: ${verification.verified}`);

    return NextResponse.json({
      success: true,
      sessionId,
      session,
      verification: {
        source: verification.source,
        verified: verification.verified,
        strictMode: envPolicy.strictMode,
        warnings: envPolicy.warnings,
      },
      metadata: {
        processingTime,
        inputLength: input.length,
        detectedType: session.analysis.type,
        confidence: session.analysis.confidence,
        totalVariants: session.augmentations.reduce((sum, aug) => sum + aug.results.length, 0),
        overallScore: session.evaluation.overallScore,
        timestamp: new Date().toISOString(),
        sourceVerification: verification.source, // CRITICAL: 실행 소스 명시
      },
    });

  } catch (error) {
    console.error('Smart augmentation error:', error);
    return NextResponse.json(
      { error: '스마트 증강에 실패했습니다.', sessionId },
      { status: 500 }
    );
  }
}

async function getHandler() {
  // 스마트 증강 시스템 정보
  return NextResponse.json({
    success: true,
    info: {
      description: '지능형 데이터 증강 시스템',
      features: [
        '자동 입력 타입 감지',
        '타입별 최적 증강 방법 추천',
        'RAG 컨텍스트 통합',
        '종합 품질 평가 및 시각화',
        '개선 추천사항 제공'
      ],
      supportedTypes: [
        { type: 'document', description: '긴 텍스트, 마크다운 문서' },
        { type: 'sentence', description: '짧은 문장, 단일 아이디어' },
        { type: 'paragraph', description: '여러 문장의 단락' },
        { type: 'qa_pair', description: '질문-답변 형태' },
        { type: 'code', description: '프로그래밍 코드' },
      ],
      evaluationMetrics: [
        { metric: 'diversity', description: '생성된 변형들의 표현 다양성' },
        { metric: 'quality', description: '언어적 품질과 자연스러움' },
        { metric: 'relevance', description: '원본 내용과의 의미적 관련성' },
        { metric: 'usefulness', description: '실제 사용 가능성과 실용적 가치' },
      ],
    },
  });
}

// 🛡️ Apply API Guard protection
export const POST = withAPIGuard(smartAugmentHandler);
export const GET = withAPIGuard(getHandler);