/**
 * 🔍 System Health API Endpoint
 *
 * Auto-Detection Engine과 연결된 시스템 건강 상태 API
 * - 실시간 시스템 건강 체크
 * - 카테고리별 상세 분석
 * - 자동 감지 결과 및 권장사항
 */

import { NextRequest, NextResponse } from 'next/server';
import { autoDetectionEngine } from '../../../../lib/auto-detection-engine';

// 🛡️ API Guard 적용
import { withAPIGuard } from '../../../../lib/api-guard';

async function healthHandler(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    const history = url.searchParams.get('history') === 'true';

    // 특정 카테고리만 검사하는 경우
    if (category) {
      const categoryResults = await autoDetectionEngine.checkCategory(category);
      return NextResponse.json({
        success: true,
        category,
        results: categoryResults,
        timestamp: new Date().toISOString()
      });
    }

    // 탐지 기록만 조회하는 경우
    if (history) {
      const detectionHistory = autoDetectionEngine.getDetectionHistory();
      return NextResponse.json({
        success: true,
        history: detectionHistory.slice(-50), // 최근 50개만
        timestamp: new Date().toISOString()
      });
    }

    // 전체 시스템 건강 체크 실행
    const systemHealth = await autoDetectionEngine.performFullHealthCheck();

    return NextResponse.json({
      success: true,
      health: systemHealth,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('🚨 [Health API] Error performing health check:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Health check failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// GET 요청 핸들러 (API Guard 적용)
export const GET = withAPIGuard(healthHandler);