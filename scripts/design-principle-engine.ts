#!/usr/bin/env tsx

/**
 * Design Principle Engine
 * 모든 시스템 결정을 설계 원칙에 기반해서 자동으로 내리는 엔진
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { wrapWithGovernance } from "./lib/governance/engine-governance-template.js";

interface SystemContext {
  componentType: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  userImpact: "none" | "low" | "medium" | "high" | "blocking";
  purpose: string;
  dependencies: string[];
  integrationPoints: string[];
}

interface DesignDecision {
  placement: "core" | "advanced" | "internal";
  integration: {
    includeInStatus: boolean;
    includeInSync: boolean;
    includeInFix: boolean;
    includeInShip: boolean;
  };
  constraints: string[];
  approvalRequired: boolean;
  reasoning: string[];
}

interface DesignPrinciple {
  name: string;
  weight: number;
  apply(decision: DesignDecision, context: SystemContext): DesignDecision;
}

class DesignPrincipleEngine {
  private principles: DesignPrinciple[] = [];
  private projectRoot: string;

  constructor() {
    this.projectRoot = process.cwd();
    this.initializePrinciples();
  }

  private initializePrinciples(): void {
    // 원칙 1: 단순성 우선 (Simplicity First)
    this.principles.push({
      name: "SIMPLICITY_FIRST",
      weight: 10,
      apply: (decision, context) => {
        if (
          context.userImpact === "high" ||
          context.userImpact === "blocking"
        ) {
          decision.placement = "core";
          decision.reasoning.push(
            "High user impact requires core placement for simplicity",
          );
        } else if (
          context.componentType.includes("internal") ||
          context.componentType.includes("debug")
        ) {
          decision.placement = "internal";
          decision.reasoning.push(
            "Internal/debug components hidden for simplicity",
          );
        }
        return decision;
      },
    });

    // 원칙 2: 승인 기반 변경 (Approval-Based Changes)
    this.principles.push({
      name: "APPROVAL_BASED_CHANGES",
      weight: 9,
      apply: (decision, context) => {
        if (context.riskLevel === "high" || context.riskLevel === "critical") {
          decision.approvalRequired = true;
          decision.reasoning.push("High/critical risk requires approval");
        }
        if (
          context.purpose.includes("deploy") ||
          context.purpose.includes("release")
        ) {
          decision.approvalRequired = true;
          decision.reasoning.push(
            "Deployment/release operations require approval",
          );
        }
        return decision;
      },
    });

    // 원칙 3: 통합 대시보드 (Unified Dashboard)
    this.principles.push({
      name: "UNIFIED_DASHBOARD",
      weight: 8,
      apply: (decision, context) => {
        // 상태 관련 컴포넌트는 status에 통합
        if (
          context.purpose.includes("status") ||
          context.purpose.includes("health") ||
          context.purpose.includes("check")
        ) {
          decision.integration.includeInStatus = true;
          decision.reasoning.push(
            "Status/health/check components integrated into unified dashboard",
          );
        }

        // 보안 관련은 반드시 status에 포함
        if (
          context.purpose.includes("security") ||
          context.purpose.includes("secret") ||
          context.purpose.includes("audit")
        ) {
          decision.integration.includeInStatus = true;
          decision.constraints.push("MUST_PASS_FOR_DEPLOYMENT");
          decision.reasoning.push(
            "Security components mandatory in status for safety",
          );
        }

        // 동기화 관련은 sync에 통합
        if (
          context.purpose.includes("sync") ||
          context.purpose.includes("git") ||
          context.purpose.includes("commit")
        ) {
          decision.integration.includeInSync = true;
          decision.reasoning.push(
            "Sync/git/commit components integrated into sync workflow",
          );
        }

        // 수정 관련은 fix에 통합
        if (
          context.purpose.includes("fix") ||
          context.purpose.includes("repair") ||
          context.purpose.includes("lint")
        ) {
          decision.integration.includeInFix = true;
          decision.reasoning.push(
            "Fix/repair/lint components integrated into fix workflow",
          );
        }

        // 배포 관련은 ship에 통합
        if (
          context.purpose.includes("deploy") ||
          context.purpose.includes("release") ||
          context.purpose.includes("ship")
        ) {
          decision.integration.includeInShip = true;
          decision.reasoning.push(
            "Deploy/release/ship components integrated into ship workflow",
          );
        }

        return decision;
      },
    });

    // 원칙 4: 계층화된 복잡도 (Layered Complexity)
    this.principles.push({
      name: "LAYERED_COMPLEXITY",
      weight: 7,
      apply: (decision, context) => {
        // 개발자 전용 도구는 고급 레이어로
        if (
          context.componentType.includes("dev") ||
          context.componentType.includes("debug") ||
          context.componentType.includes("advanced")
        ) {
          decision.placement = "advanced";
          decision.reasoning.push(
            "Developer/debug/advanced tools placed in advanced layer",
          );
        }

        // 시스템 내부 작업은 내부 레이어로
        if (
          context.componentType.includes("system") ||
          context.componentType.includes("internal") ||
          context.componentType.includes("engine")
        ) {
          decision.placement = "internal";
          decision.reasoning.push(
            "System/internal/engine components hidden in internal layer",
          );
        }

        // 일반 사용자 도구는 핵심 레이어로 (4개 명령어 제한)
        if (decision.placement === "core") {
          const coreCount = this.countCoreComponents();
          if (coreCount >= 4) {
            decision.placement = "advanced";
            decision.reasoning.push(
              "Core layer limited to 4 commands, moved to advanced",
            );
          }
        }

        return decision;
      },
    });

    // 원칙 5: 자동 일관성 (Automatic Consistency)
    this.principles.push({
      name: "AUTOMATIC_CONSISTENCY",
      weight: 6,
      apply: (decision, context) => {
        // 일관성 제약 조건 추가
        if (decision.integration.includeInStatus) {
          decision.constraints.push("AUTO_INCLUDE_IN_HEALTH_METRICS");
          decision.constraints.push("MUST_PROVIDE_STATUS_SUMMARY");
          decision.reasoning.push(
            "Status integration requires health metrics and summary",
          );
        }

        if (decision.integration.includeInSync) {
          decision.constraints.push("MUST_BE_ATOMIC_OPERATION");
          decision.constraints.push("MUST_SUPPORT_ROLLBACK");
          decision.reasoning.push(
            "Sync integration requires atomic operations and rollback support",
          );
        }

        // 메타데이터 요구사항
        decision.constraints.push("MUST_HAVE_COMPONENT_METADATA");
        decision.reasoning.push(
          "All components must have metadata for automatic consistency",
        );

        return decision;
      },
    });
  }

  /**
   * 주어진 컨텍스트에 대해 모든 설계 원칙을 적용하여 결정을 내림
   */
  makeDecision(context: SystemContext): DesignDecision {
    let decision: DesignDecision = {
      placement: "internal", // 기본값: 내부
      integration: {
        includeInStatus: false,
        includeInSync: false,
        includeInFix: false,
        includeInShip: false,
      },
      constraints: [],
      approvalRequired: false,
      reasoning: [],
    };

    // 모든 원칙을 가중치 순으로 적용
    const sortedPrinciples = this.principles.sort(
      (a, b) => b.weight - a.weight,
    );

    for (const principle of sortedPrinciples) {
      decision = principle.apply(decision, context);
    }

    return decision;
  }

  /**
   * 스크립트 파일을 분석하여 SystemContext 생성
   */
  async analyzeScript(scriptPath: string): Promise<SystemContext> {
    return wrapWithGovernance("design-principle-engine", async () => {
      const fullPath = join(this.projectRoot, scriptPath);

      if (!existsSync(fullPath)) {
        throw new Error(`Script not found: ${scriptPath}`);
      }

      const content = readFileSync(fullPath, "utf8");
      const fileName = scriptPath.split("/").pop() || "";

      // 파일 내용과 이름을 분석하여 컨텍스트 추출
      const context: SystemContext = {
        componentType: this.detectComponentType(fileName, content),
        riskLevel: this.detectRiskLevel(fileName, content),
        userImpact: this.detectUserImpact(fileName, content),
        purpose: this.detectPurpose(fileName, content),
        dependencies: this.extractDependencies(content),
        integrationPoints: this.findIntegrationPoints(content),
      };

      return context;
    });
  }

  private detectComponentType(fileName: string, content: string): string {
    if (fileName.includes("test") || fileName.includes("spec")) return "test";
    if (fileName.includes("debug") || fileName.includes("dev"))
      return "development";
    if (fileName.includes("engine") || fileName.includes("system"))
      return "system";
    if (fileName.includes("validator") || fileName.includes("checker"))
      return "validation";
    if (fileName.includes("generator") || fileName.includes("builder"))
      return "generator";
    if (content.includes("class") && content.includes("Engine"))
      return "engine";
    return "utility";
  }

  private detectRiskLevel(
    fileName: string,
    content: string,
  ): SystemContext["riskLevel"] {
    if (fileName.includes("security") || fileName.includes("secret"))
      return "critical";
    if (fileName.includes("deploy") || fileName.includes("release"))
      return "high";
    if (content.includes("execSync") || content.includes("writeFileSync"))
      return "medium";
    if (fileName.includes("test") || fileName.includes("dev")) return "low";
    return "low";
  }

  private detectUserImpact(
    fileName: string,
    content: string,
  ): SystemContext["userImpact"] {
    if (fileName.includes("status") || fileName.includes("dashboard"))
      return "blocking";
    if (fileName.includes("security") || fileName.includes("validate"))
      return "high";
    if (fileName.includes("sync") || fileName.includes("fix")) return "medium";
    if (fileName.includes("test") || fileName.includes("internal"))
      return "none";
    return "low";
  }

  private detectPurpose(fileName: string, content: string): string {
    const purposes: string[] = [];

    if (fileName.includes("status") || content.includes("status"))
      purposes.push("status");
    if (fileName.includes("security") || content.includes("security"))
      purposes.push("security");
    if (fileName.includes("sync") || content.includes("sync"))
      purposes.push("sync");
    if (fileName.includes("fix") || content.includes("fix"))
      purposes.push("fix");
    if (fileName.includes("deploy") || content.includes("deploy"))
      purposes.push("deploy");
    if (fileName.includes("test") || content.includes("test"))
      purposes.push("test");
    if (fileName.includes("validate") || content.includes("validate"))
      purposes.push("validate");
    if (fileName.includes("check") || content.includes("check"))
      purposes.push("check");
    if (fileName.includes("git") || content.includes("git"))
      purposes.push("git");
    if (fileName.includes("audit") || content.includes("audit"))
      purposes.push("audit");

    return purposes.join(", ") || "utility";
  }

  private extractDependencies(content: string): string[] {
    const importMatches =
      content.match(/import.*from\s+["']([^"']+)["']/g) || [];
    return importMatches
      .map((match) => {
        const moduleMatch = match.match(/from\s+["']([^"']+)["']/);
        return moduleMatch ? moduleMatch[1] : "";
      })
      .filter((dep) => dep.length > 0);
  }

  private findIntegrationPoints(content: string): string[] {
    const points: string[] = [];

    if (content.includes("unified-dashboard")) points.push("unified-dashboard");
    if (content.includes("package.json")) points.push("package.json");
    if (content.includes("status")) points.push("status");
    if (content.includes("sync")) points.push("sync");
    if (content.includes("CI/CD") || content.includes("github"))
      points.push("ci-cd");

    return points;
  }

  private countCoreComponents(): number {
    // 실제 구현에서는 현재 core 레이어의 컴포넌트 수를 계산
    return 2; // 임시값
  }

  /**
   * 결정 결과를 사람이 읽기 쉬운 형태로 출력
   */
  formatDecision(context: SystemContext, decision: DesignDecision): string {
    return `
## 🎯 Design Decision for Component

### 📋 Context Analysis
- **Component Type**: ${context.componentType}
- **Risk Level**: ${context.riskLevel}
- **User Impact**: ${context.userImpact}
- **Purpose**: ${context.purpose}
- **Dependencies**: ${context.dependencies.join(", ")}

### ⚡ Decision Result
- **Placement**: ${decision.placement}
- **Approval Required**: ${decision.approvalRequired ? "YES" : "NO"}

### 🔗 Integration Points
- **Include in /status**: ${decision.integration.includeInStatus ? "YES" : "NO"}
- **Include in /sync**: ${decision.integration.includeInSync ? "YES" : "NO"}
- **Include in /fix**: ${decision.integration.includeInFix ? "YES" : "NO"}
- **Include in /ship**: ${decision.integration.includeInShip ? "YES" : "NO"}

### 📏 Constraints
${decision.constraints.map((c) => `- ${c}`).join("\n")}

### 🧠 Reasoning
${decision.reasoning.map((r) => `- ${r}`).join("\n")}
`;
  }

  /**
   * 모든 스크립트에 대해 설계 결정을 일괄 생성
   */
  async generateSystemDesign(): Promise<void> {
    return wrapWithGovernance("design-principle-engine", async () => {
      console.log("🏗️ Generating system-wide design decisions...");

      const { glob } = await import("glob");
      const scripts = await glob("scripts/**/*.{ts,js,sh}");

      for (const script of scripts) {
        try {
          console.log(`\n📝 Analyzing: ${script}`);
          const context = await this.analyzeScript(script);
          const decision = this.makeDecision(context);

          console.log(this.formatDecision(context, decision));
        } catch (error) {
          console.log(`❌ Failed to analyze ${script}: ${error}`);
        }
      }
    });
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const engine = new DesignPrincipleEngine();

  if (process.argv[2] === "analyze") {
    const scriptPath = process.argv[3];
    if (scriptPath) {
      engine
        .analyzeScript(scriptPath)
        .then((context) => {
          const decision = engine.makeDecision(context);
          console.log(engine.formatDecision(context, decision));
        })
        .catch(console.error);
    } else {
      engine.generateSystemDesign().catch(console.error);
    }
  }
}

export default DesignPrincipleEngine;
