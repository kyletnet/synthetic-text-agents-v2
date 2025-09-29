import { NextRequest, NextResponse } from 'next/server';
import { DataAugmentationSystem, AugmentationRequest } from '@/lib/augmentation-utils';

export async function POST(request: NextRequest) {
  const sessionId = `augment_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

  try {
    const body: AugmentationRequest = await request.json();
    const { input, augmentationType, count, options } = body;

    // 입력 검증
    if (!input?.trim()) {
      return NextResponse.json(
        { error: '입력 텍스트가 필요합니다.' },
        { status: 400 }
      );
    }

    if (!augmentationType) {
      return NextResponse.json(
        { error: '증강 타입을 선택해주세요.' },
        { status: 400 }
      );
    }

    if (count < 1 || count > 20) {
      return NextResponse.json(
        { error: '증강 개수는 1-20 사이여야 합니다.' },
        { status: 400 }
      );
    }

    // 데이터 증강 실행
    const startTime = Date.now();
    const session = await DataAugmentationSystem.augmentData({
      input,
      augmentationType,
      count,
      options: {
        useRAG: options?.useRAG ?? true,  // 기본적으로 RAG 사용
        style: options?.style,
        length: options?.length,
        domain: options?.domain,
      },
    });

    const processingTime = Date.now() - startTime;

    console.log(`🔄 Data augmentation: "${input.substring(0, 50)}..." (${augmentationType}, ${count} variants, ${processingTime}ms)`);

    return NextResponse.json({
      success: true,
      sessionId,
      session,
      metadata: {
        processingTime,
        inputLength: input.length,
        averageQuality: session.summary.averageQuality,
        ragUsed: session.summary.ragContextUsed,
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('Augmentation error:', error);
    return NextResponse.json(
      { error: '데이터 증강에 실패했습니다.', sessionId },
      { status: 500 }
    );
  }
}

export async function GET() {
  // 증강 시스템 정보 제공
  const stats = DataAugmentationSystem.getAugmentationStats();

  return NextResponse.json({
    success: true,
    stats,
    info: {
      description: '범용 데이터 증강 시스템',
      supportedInputs: ['문장', '문서', 'Q&A', '코드', '설명'],
      features: [
        'RAG 컨텍스트 통합',
        '다양한 증강 타입',
        '실시간 품질 평가',
        '배치 처리 지원'
      ],
    },
  });
}