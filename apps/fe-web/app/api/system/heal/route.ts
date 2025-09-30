/**
 * 🔄 System Self-Healing API Endpoint
 *
 * Self-Healing Engine과 연결된 자동 복구 시스템 API
 * - 수동 치유 실행
 * - 치유 통계 및 히스토리 조회
 * - 자동 치유 상태 관리
 */

import { NextRequest, NextResponse } from "next/server";
import { selfHealingEngine } from "../../../../lib/self-healing-engine";

// 🛡️ API Guard 적용
import { withAPIGuard } from "../../../../lib/api-guard";

async function healHandler(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const method = request.method;

    if (method === "GET") {
      // 치유 상태 및 통계 조회
      const action = url.searchParams.get("action");
      const type = url.searchParams.get("type");

      switch (action) {
        case "stats":
          const stats = selfHealingEngine.getHealingStats();
          return NextResponse.json({
            success: true,
            stats,
            timestamp: new Date().toISOString(),
          });

        case "history":
          const history = selfHealingEngine.getHealingHistory();
          const limit = parseInt(url.searchParams.get("limit") || "20");
          return NextResponse.json({
            success: true,
            history: history.slice(-limit),
            total: history.length,
            timestamp: new Date().toISOString(),
          });

        default:
          // 기본: 치유 통계 반환
          const healingStats = selfHealingEngine.getHealingStats();
          return NextResponse.json({
            success: true,
            stats: healingStats,
            timestamp: new Date().toISOString(),
          });
      }
    } else if (method === "POST") {
      // 수동 치유 실행
      const body = await request.json().catch(() => ({}));
      const { action, actionType } = body;

      switch (action) {
        case "heal":
          console.log(
            `🔄 [Heal API] Manual healing requested${actionType ? ` for: ${actionType}` : ""}`,
          );

          const healingResults = await selfHealingEngine.manualHeal(actionType);

          const successCount = healingResults.filter((r) => r.success).length;
          const totalCount = healingResults.length;

          return NextResponse.json({
            success: true,
            results: healingResults,
            summary: {
              total: totalCount,
              successful: successCount,
              failed: totalCount - successCount,
              overallSuccess: successCount > 0,
            },
            timestamp: new Date().toISOString(),
          });

        case "stop":
          selfHealingEngine.stopAutomaticHealing();
          return NextResponse.json({
            success: true,
            message: "Automatic healing stopped",
            timestamp: new Date().toISOString(),
          });

        default:
          return NextResponse.json(
            {
              success: false,
              error: 'Invalid action. Use "heal" or "stop"',
              availableActions: ["heal", "stop"],
              timestamp: new Date().toISOString(),
            },
            { status: 400 },
          );
      }
    } else {
      return NextResponse.json(
        {
          success: false,
          error: "Method not allowed",
          allowedMethods: ["GET", "POST"],
          timestamp: new Date().toISOString(),
        },
        { status: 405 },
      );
    }
  } catch (error) {
    console.error("🚨 [Heal API] Error in healing API:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Healing API failed",
        details: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}

// GET 및 POST 요청 핸들러 (API Guard 적용)
export const GET = withAPIGuard(healHandler);
export const POST = withAPIGuard(healHandler);
