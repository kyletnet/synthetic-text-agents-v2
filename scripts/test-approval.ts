#!/usr/bin/env tsx
/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */


import { readFileSync, existsSync } from "fs";
import { join } from "path";

interface PendingApproval {
  type: "evolution" | "refactor" | "security";
  source: string;
  count: number;
  priority: "critical" | "high" | "medium" | "low";
  description: string;
  command: string;
  impact: string;
}

function collectPendingApprovals(): PendingApproval[] {
  const approvals: PendingApproval[] = [];

  console.log("🔍 Collecting pending approvals...");

  // 1. 아키텍처 진화 승인 대기
  try {
    const evolutionReportPath = join(
      process.cwd(),
      "reports",
      "evolution-report.json",
    );
    console.log(`📂 Checking evolution report: ${evolutionReportPath}`);
    console.log(`📂 File exists: ${existsSync(evolutionReportPath)}`);

    if (existsSync(evolutionReportPath)) {
      const report = JSON.parse(readFileSync(evolutionReportPath, "utf8"));
      console.log("📊 Report loaded successfully");
      console.log(
        "🔍 autoEvolutionCapabilities exists:",
        !!report.autoEvolutionCapabilities,
      );
      console.log(
        "🔍 needsApproval exists:",
        !!report.autoEvolutionCapabilities?.needsApproval,
      );
      console.log(
        "🔍 needsApproval length:",
        report.autoEvolutionCapabilities?.needsApproval?.length || 0,
      );

      if (report.autoEvolutionCapabilities?.needsApproval?.length > 0) {
        console.log("✅ Found evolution approvals!");
        approvals.push({
          type: "evolution",
          source: "architectural-evolution-engine",
          count: report.autoEvolutionCapabilities.needsApproval.length,
          priority: "high",
          description: `아키텍처 진화 승인 대기 (${report.autoEvolutionCapabilities.needsApproval.length}개)`,
          command: "/approve-evolution 또는 npm run evolution:approve",
          impact: "시스템 구조 개선, 중복 제거",
        });
      } else {
        console.log("❌ No evolution approvals found");
      }
    }
  } catch (error) {
    console.log("❌ Error loading evolution report:", error);
  }

  console.log(`📋 Total approvals collected: ${approvals.length}`);
  return approvals;
}

// 대화형 승인 요청 테스트
async function testApprovalFlow(): Promise<void> {
  console.log("🧪 Testing approval flow...\n");

  const approvals = collectPendingApprovals();

  if (approvals.length === 0) {
    console.log("🚫 No approvals to test");
    return;
  }

  const dangerousApprovals = approvals.filter(
    (approval) =>
      approval.priority === "high" ||
      approval.priority === "critical" ||
      approval.type === "evolution",
  );

  console.log(`\n⚠️  Found ${dangerousApprovals.length} dangerous approvals`);

  if (dangerousApprovals.length > 0) {
    console.log("\n🎯 Would show y/n dialog for:");
    dangerousApprovals.forEach((approval, idx) => {
      console.log(`   ${idx + 1}. ${approval.description}`);
      console.log(`      Priority: ${approval.priority}`);
      console.log(`      Command: ${approval.command}`);
    });
  }
}

// 직접 실행 시
if (import.meta.url === `file://${process.argv[1]}`) {
  testApprovalFlow();
}
