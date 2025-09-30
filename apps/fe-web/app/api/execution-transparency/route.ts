/**
 * 🔍 Execution Transparency API
 *
 * 실시간 LLM 실행 추적 및 투명성 대시보드
 * - 실행 메트릭
 * - 추적 로그
 * - 비용 분석
 * - 시스템 상태
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAPIGuard } from '@/lib/api-guard';
import { executionTracer } from '@/lib/execution-tracer';
import { LLMExecutionAuthority } from '@/lib/llm-execution-authority';

async function getTransparencyHandler(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action') || 'summary';

    switch (action) {
      case 'summary':
        return await getExecutionSummary();

      case 'metrics':
        return await getRealTimeMetrics();

      case 'traces':
        return await getRecentTraces(request);

      case 'system-status':
        return await getSystemStatus();

      case 'cost-analysis':
        return await getCostAnalysis(request);

      default:
        return NextResponse.json(
          { error: 'Invalid action. Available: summary, metrics, traces, system-status, cost-analysis' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('🚨 [ExecutionTransparency] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * 📊 실행 요약 통계
 */
async function getExecutionSummary() {
  const summary = executionTracer.getSummary();
  const systemIntegrity = LLMExecutionAuthority.validateSystemIntegrity();

  return NextResponse.json({
    success: true,
    summary: {
      ...summary,
      systemStatus: systemIntegrity.status,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * 📈 실시간 메트릭
 */
async function getRealTimeMetrics() {
  const metrics = executionTracer.getRealTimeMetrics();
  const systemIntegrity = LLMExecutionAuthority.validateSystemIntegrity();

  return NextResponse.json({
    success: true,
    metrics: {
      ...metrics,
      systemIntegrity: {
        status: systemIntegrity.status,
        checks: systemIntegrity.checks,
        score: Object.values(systemIntegrity.checks).filter(Boolean).length / Object.keys(systemIntegrity.checks).length,
      },
      performance: {
        apiResponseTime: metrics.averageCost > 0 ? 'normal' : 'degraded',
        guardEffectiveness: metrics.successRate,
        systemLoad: metrics.activeTraces > 100 ? 'high' : metrics.activeTraces > 50 ? 'medium' : 'low',
      },
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * 🔍 최근 추적 로그
 */
async function getRecentTraces(request: NextRequest) {
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '20');
  const traceId = url.searchParams.get('traceId');

  if (traceId) {
    // 특정 추적 조회
    const trace = executionTracer.getTrace(traceId);
    if (!trace) {
      return NextResponse.json(
        { error: 'Trace not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      trace,
    });
  }

  // 최근 추적들 조회 (실제 구현에서는 파일에서 읽거나 DB 쿼리)
  return NextResponse.json({
    success: true,
    traces: [], // 실제로는 최근 추적들을 반환
    pagination: {
      limit,
      total: 0,
      hasMore: false,
    },
    timestamp: new Date().toISOString(),
  });
}

/**
 * ⚙️ 시스템 상태
 */
async function getSystemStatus() {
  const systemIntegrity = LLMExecutionAuthority.validateSystemIntegrity();
  const diagnosticExecution = await LLMExecutionAuthority.performDiagnosticExecution();

  return NextResponse.json({
    success: true,
    systemStatus: {
      overall: systemIntegrity.status,
      components: {
        llmExecutionAuthority: {
          status: systemIntegrity.status,
          checks: systemIntegrity.checks,
          enabled: process.env.FEATURE_LLM_EXECUTION_AUTHORITY === 'true',
        },
        universalGuard: {
          status: systemIntegrity.checks.apiGuard ? 'healthy' : 'degraded',
          enabled: process.env.FEATURE_UNIVERSAL_GUARD_INJECTION === 'true',
        },
        executionTracer: {
          status: 'healthy',
          enabled: process.env.FEATURE_EXECUTION_TRANSPARENCY === 'true',
          activeTraces: executionTracer.getRealTimeMetrics().activeTraces,
        },
        middleware: {
          status: 'healthy',
          enabled: process.env.FEATURE_LLM_EXECUTION_AUTHORITY === 'true',
          strictMode: process.env.LLM_STRICT_MODE === 'true',
        },
      },
      diagnostics: {
        lastDiagnostic: diagnosticExecution,
        timestamp: new Date().toISOString(),
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        strictMode: process.env.LLM_STRICT_MODE === 'true',
        llmRequired: process.env.LLM_REQUIRED === 'true',
      },
    },
  });
}

/**
 * 💰 비용 분석
 */
async function getCostAnalysis(request: NextRequest) {
  const url = new URL(request.url);
  const period = url.searchParams.get('period') || '24h';

  // 시간 범위 계산
  const now = new Date();
  const timeRange = {
    start: new Date(),
    end: now,
  };

  switch (period) {
    case '1h':
      timeRange.start = new Date(now.getTime() - 60 * 60 * 1000);
      break;
    case '24h':
      timeRange.start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case '7d':
      timeRange.start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      timeRange.start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    default:
      timeRange.start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }

  const summary = executionTracer.getSummary(timeRange);

  return NextResponse.json({
    success: true,
    costAnalysis: {
      period,
      timeRange,
      summary: {
        totalCost: summary.totalCost,
        totalCalls: summary.totalCalls,
        totalTokens: summary.totalTokens,
        averageCostPerCall: summary.totalCalls > 0 ? summary.totalCost / summary.totalCalls : 0,
        averageTokensPerCall: summary.totalCalls > 0 ? summary.totalTokens / summary.totalCalls : 0,
      },
      breakdown: {
        byProvider: summary.providerBreakdown,
        byRoute: summary.routeBreakdown,
      },
      projections: {
        dailyRate: calculateDailyRate(summary, period),
        monthlyProjection: calculateMonthlyProjection(summary, period),
      },
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * 📈 일일 비용 계산
 */
function calculateDailyRate(summary: any, period: string): number {
  if (summary.totalCalls === 0) return 0;

  const hoursInPeriod = getHoursInPeriod(period);
  const hourlyRate = summary.totalCost / hoursInPeriod;
  return hourlyRate * 24;
}

/**
 * 📊 월간 예상 비용 계산
 */
function calculateMonthlyProjection(summary: any, period: string): number {
  const dailyRate = calculateDailyRate(summary, period);
  return dailyRate * 30;
}

/**
 * ⏰ 기간별 시간 계산
 */
function getHoursInPeriod(period: string): number {
  switch (period) {
    case '1h': return 1;
    case '24h': return 24;
    case '7d': return 24 * 7;
    case '30d': return 24 * 30;
    default: return 24;
  }
}

/**
 * 🔄 WebSocket 실시간 업데이트 (향후 확장용)
 */
async function postTransparencyHandler(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action;

    switch (action) {
      case 'subscribe':
        // WebSocket 구독 로직 (향후 구현)
        return NextResponse.json({
          success: true,
          message: 'Real-time subscription created',
          subscriptionId: `sub_${Date.now()}`,
        });

      case 'refresh':
        // 강제 메트릭 새로고침
        return await getRealTimeMetrics();

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('🚨 [ExecutionTransparency] POST Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// 🛡️ Apply API Guard protection
export const GET = withAPIGuard(getTransparencyHandler);
export const POST = withAPIGuard(postTransparencyHandler);

console.log('🔍 [ExecutionTransparency] API endpoint loaded');