#!/usr/bin/env node

/**
 * 스마트 승인 시스템
 * 신뢰도 기반으로 자동 승인 vs 수동 승인 결정
 */

interface RiskAssessment {
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  autoApprove: boolean;
  requiresExpertConsultation: boolean;
  reasons: string[];
  summary: string;
}

class SmartApprovalSystem {
  async assessRisk(analysisResults: any): Promise<RiskAssessment> {
    const risks: string[] = [];
    let riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "LOW";

    // 1. TypeScript 오류 심각도 평가
    if (analysisResults.typescript?.errors > 0) {
      if (analysisResults.typescript.errors > 10) {
        risks.push("🔴 TypeScript 오류 다수 (10개+)");
        riskLevel = "HIGH";
      } else {
        risks.push("🟡 TypeScript 오류 소수");
        riskLevel = "MEDIUM";
      }
    }

    // 2. 보안 이슈 평가
    if (analysisResults.security?.blockingIssues > 0) {
      risks.push("🚨 보안 차단 이슈 발견");
      riskLevel = "CRITICAL";
    }

    // 3. 시스템 통합 점수 평가
    if (analysisResults.integration?.score < 50) {
      risks.push("⚠️ 시스템 통합 점수 낮음 (<50)");
      riskLevel = riskLevel === "CRITICAL" ? "CRITICAL" : "HIGH";
    }

    // 4. 파일 변경 규모 평가
    if (analysisResults.changes?.modifiedFiles > 50) {
      risks.push("📁 대규모 파일 변경 (50개+)");
      riskLevel = riskLevel === "CRITICAL" ? "CRITICAL" : "HIGH";
    }

    // 5. 핵심 시스템 파일 변경 확인
    const criticalFiles = [
      "package.json",
      "CLAUDE.md",
      "tsconfig.json",
      ".claude/system-mode.yaml",
      "scripts/unified-dashboard.ts",
    ];
    if (
      analysisResults.changes?.files?.some((f: string) =>
        criticalFiles.some((cf) => f.includes(cf)),
      )
    ) {
      risks.push("⚡ 핵심 시스템 파일 변경");
      riskLevel = riskLevel === "CRITICAL" ? "CRITICAL" : "HIGH";
    }

    // 자동 승인 결정 로직
    const autoApprove = riskLevel === "LOW" || riskLevel === "MEDIUM";
    const requiresExpertConsultation = riskLevel === "CRITICAL";

    return {
      riskLevel,
      autoApprove,
      requiresExpertConsultation,
      reasons: risks,
      summary: this.generateSummary(riskLevel, risks),
    };
  }

  private generateSummary(riskLevel: string, risks: string[]): string {
    switch (riskLevel) {
      case "LOW":
        return "✅ 안전한 변경사항입니다. 자동 승인하여 진행합니다.";
      case "MEDIUM":
        return "🟡 일반적인 변경사항입니다. 자동 승인하여 진행합니다.";
      case "HIGH":
        return "⚠️ 주의가 필요한 변경사항입니다. 수동 승인이 필요합니다.";
      case "CRITICAL":
        return "🚨 중대한 변경사항입니다. 반드시 다른 LLM이나 개발자와 상의하세요!";
      default:
        return "❓ 평가 오류가 발생했습니다.";
    }
  }

  displayApprovalRequest(assessment: RiskAssessment): void {
    console.log("\n🧠 스마트 승인 시스템");
    console.log("===================");

    if (assessment.autoApprove) {
      console.log(`${assessment.summary}`);
      console.log("⏱️ 3초 후 자동 진행됩니다...");
      return;
    }

    console.log(`🎯 위험도: ${assessment.riskLevel}`);
    console.log(`📋 발견된 이슈:`);
    assessment.reasons.forEach((reason, i) => {
      console.log(`   ${i + 1}. ${reason}`);
    });

    console.log(`\n${assessment.summary}`);

    if (assessment.requiresExpertConsultation) {
      console.log("\n🆘 중대 이슈 감지!");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("⚠️  이것은 단순히 선택할 수 있는 일반적인 승인이 아닙니다!");
      console.log(
        "🔍 반드시 다른 LLM(Claude, GPT 등)이나 개발자에게 먼저 상의하세요.",
      );
      console.log(
        "📋 위의 이슈들을 복사해서 전문가에게 물어보신 후 진행하세요.",
      );
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    }

    console.log("\n💬 승인 옵션:");
    console.log("   /confirm-sync  - 승인 및 실행");
    console.log("   /deny-sync     - 거부");
  }
}

// CLI 실행
if (import.meta.url === `file://${process.argv[1]}`) {
  const smartApproval = new SmartApprovalSystem();

  // 테스트용 분석 결과 (실제로는 다른 시스템에서 받아옴)
  const mockAnalysis = {
    typescript: { errors: 0 },
    security: { blockingIssues: 0 },
    integration: { score: 75 },
    changes: { modifiedFiles: 3, files: ["src/test.ts"] },
  };

  smartApproval.assessRisk(mockAnalysis).then((assessment) => {
    smartApproval.displayApprovalRequest(assessment);
  });
}

export default SmartApprovalSystem;
