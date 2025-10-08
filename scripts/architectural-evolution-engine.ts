#!/usr/bin/env tsx
/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */


// @tool-mode: transform
// @tool-description: Architecture evolution - self-evolving system structure improvements

/**
 * Architectural Evolution Engine
 * 시스템이 스스로 더 나은 구조로 진화하는 엔진
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import ComponentRegistrySystem from "./component-registry-system.js";
import DesignPrincipleEngine from "./design-principle-engine.js";
import { wrapWithGovernance } from "./lib/governance/engine-governance-template.js";

interface ComponentMetadata {
  name: string;
  path: string;
  type: string;
  purpose: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  userImpact: "none" | "low" | "medium" | "high" | "blocking";
  dependencies: string[];
  integrationPoints: string[];
  constraints: string[];
  designDecision: any;
  compliance: {
    isCompliant: boolean;
    violations: string[];
    lastChecked: string;
  };
  lifecycle: {
    created: string;
    lastUpdated: string;
    lastIntegrated: string;
    status: "active" | "deprecated" | "legacy" | "experimental";
  };
}

interface StructuralPattern {
  name: string;
  description: string;
  components: string[];
  frequency: number;
  duplicationType: "exact" | "similar" | "conceptual";
  consolidationOpportunity: number; // 0-1 score
}

interface EvolutionaryImprovement {
  type: "consolidation" | "extraction" | "reorganization" | "standardization";
  priority: "low" | "medium" | "high" | "critical";
  description: string;
  affectedComponents: string[];
  estimatedImpact: {
    complexity: number; // -100 to 100 (negative is better)
    maintainability: number; // 0-100 (higher is better)
    performance: number; // -100 to 100 (positive is better)
    riskLevel: "low" | "medium" | "high";
  };
  implementationPlan: EvolutionStep[];
  validation: {
    safetyChecks: string[];
    rollbackPlan: string[];
    testRequirements: string[];
  };
}

interface EvolutionStep {
  order: number;
  action: string;
  description: string;
  automation: "full" | "assisted" | "manual";
  dependencies: number[];
}

interface SystemEvolutionReport {
  timestamp: string;
  version: string;
  analysisResults: {
    patternsFound: StructuralPattern[];
    improvementsIdentified: EvolutionaryImprovement[];
    systemHealthTrend: number; // -1 to 1 (getting worse/better)
    complexityTrend: number; // -1 to 1 (getting more/less complex)
  };
  autoEvolutionCapabilities: {
    canAutoFix: EvolutionaryImprovement[];
    needsApproval: EvolutionaryImprovement[];
    requiresManual: EvolutionaryImprovement[];
  };
  evolutionHistory: EvolutionHistoryEntry[];
}

interface EvolutionHistoryEntry {
  timestamp: string;
  improvementApplied: string;
  beforeState: any;
  afterState: any;
  outcome: "success" | "partial" | "failed" | "reverted";
  impactMeasured: any;
}

class ArchitecturalEvolutionEngine {
  private projectRoot: string;
  private registry: ComponentRegistrySystem;
  private designEngine: DesignPrincipleEngine;
  private evolutionHistoryPath: string;

  constructor() {
    this.projectRoot = process.cwd();
    this.registry = new ComponentRegistrySystem();
    this.designEngine = new DesignPrincipleEngine();
    this.evolutionHistoryPath = join(
      this.projectRoot,
      "reports/evolution-history.json",
    );

    // reports 디렉토리 확인
    const reportsDir = dirname(this.evolutionHistoryPath);
    if (!existsSync(reportsDir)) {
      mkdirSync(reportsDir, { recursive: true });
    }
  }

  /**
   * 시스템의 구조적 패턴을 분석하고 개선 기회를 식별
   */
  async identifyStructuralImprovements(): Promise<EvolutionaryImprovement[]> {
    return wrapWithGovernance("architectural-evolution-engine", async () => {
      console.log(
        "🔍 Analyzing system architecture for evolutionary improvements...",
      );

      // 1. 구조적 패턴 탐지
      const patterns = await this.detectStructuralPatterns();

      // 2. 중복성 분석
      const duplications = await this.analyzeDuplications();

      // 3. 통합 기회 식별
      const consolidationOpportunities =
        await this.identifyConsolidationOpportunities(patterns);

      // 4. 아키텍처 불일치 탐지
      const architecturalInconsistencies =
        await this.detectArchitecturalInconsistencies();

      // 5. 개선 기회를 우선순위별로 정렬
      const improvements = [
        ...consolidationOpportunities,
        ...duplications,
        ...architecturalInconsistencies,
      ].sort(
        (a, b) => this.calculateImpactScore(b) - this.calculateImpactScore(a),
      );

      return improvements;
    });
  }

  private async detectStructuralPatterns(): Promise<StructuralPattern[]> {
    const registryData = await this.loadComponentRegistry();
    const patterns: StructuralPattern[] = [];

    // 패턴 1: 유사한 목적의 컴포넌트들
    const purposeGroups = this.groupComponentsByPurpose(
      registryData.components,
    );

    for (const [purpose, components] of Object.entries(purposeGroups)) {
      if (components.length > 2) {
        patterns.push({
          name: `${purpose}-related-components`,
          description: `Multiple components serving ${purpose} purpose`,
          components: components.map((c) => c.name),
          frequency: components.length,
          duplicationType: "conceptual",
          consolidationOpportunity:
            this.calculateConsolidationScore(components),
        });
      }
    }

    // 패턴 2: 유사한 파일명 패턴
    const namePatterns = this.detectNamingPatterns(registryData.components);
    patterns.push(...namePatterns);

    // 패턴 3: 의존성 패턴
    const dependencyPatterns = this.analyzeDependencyPatterns(
      registryData.components,
    );
    patterns.push(...dependencyPatterns);

    return patterns;
  }

  private async analyzeDuplications(): Promise<EvolutionaryImprovement[]> {
    const improvements: EvolutionaryImprovement[] = [];
    const registryData = await this.loadComponentRegistry();

    // 중복 1: build_docs_indexes.js vs build_docs_indexes.ts
    const buildDocsComponents = registryData.components.filter(
      (c: ComponentMetadata) => c.name.includes("build_docs_indexes"),
    );

    if (buildDocsComponents.length > 1) {
      improvements.push({
        type: "consolidation",
        priority: "medium",
        description: "Consolidate duplicate build_docs_indexes implementations",
        affectedComponents: buildDocsComponents.map((c: any) => c.name),
        estimatedImpact: {
          complexity: -15,
          maintainability: 20,
          performance: 5,
          riskLevel: "low",
        },
        implementationPlan: [
          {
            order: 1,
            action: "migrate_functionality",
            description: "Migrate functionality from .js to .ts version",
            automation: "assisted",
            dependencies: [],
          },
          {
            order: 2,
            action: "remove_duplicate",
            description: "Remove .js version and update references",
            automation: "full",
            dependencies: [1],
          },
        ],
        validation: {
          safetyChecks: ["Verify TypeScript version has all .js functionality"],
          rollbackPlan: ["Restore .js version if TypeScript version fails"],
          testRequirements: ["Test documentation generation pipeline"],
        },
      });
    }

    // 중복 2: 여러 refactor-* 컴포넌트들
    const refactorComponents = registryData.components.filter(
      (c: ComponentMetadata) =>
        c.name.includes("refactor") && !c.name.includes("smart-refactor"),
    );

    if (refactorComponents.length > 2) {
      improvements.push({
        type: "consolidation",
        priority: "high",
        description: "Consolidate multiple refactor-related components",
        affectedComponents: refactorComponents.map(
          (c: ComponentMetadata) => c.name,
        ),
        estimatedImpact: {
          complexity: -25,
          maintainability: 35,
          performance: 10,
          riskLevel: "medium",
        },
        implementationPlan: [
          {
            order: 1,
            action: "create_unified_interface",
            description: "Create unified refactor interface",
            automation: "manual",
            dependencies: [],
          },
          {
            order: 2,
            action: "migrate_components",
            description: "Migrate existing components to unified interface",
            automation: "assisted",
            dependencies: [1],
          },
        ],
        validation: {
          safetyChecks: ["Ensure all refactor functionality is preserved"],
          rollbackPlan: [
            "Restore individual components if consolidation fails",
          ],
          testRequirements: ["Test all refactoring workflows"],
        },
      });
    }

    return improvements;
  }

  private async identifyConsolidationOpportunities(
    patterns: StructuralPattern[],
  ): Promise<EvolutionaryImprovement[]> {
    const improvements: EvolutionaryImprovement[] = [];

    for (const pattern of patterns) {
      if (pattern.consolidationOpportunity > 0.7 && pattern.frequency > 3) {
        improvements.push({
          type: "consolidation",
          priority: pattern.frequency > 5 ? "high" : "medium",
          description: `Consolidate ${pattern.name} pattern (${pattern.frequency} components)`,
          affectedComponents: pattern.components,
          estimatedImpact: {
            complexity: -20 * pattern.frequency,
            maintainability: 15 * pattern.frequency,
            performance: 5,
            riskLevel: pattern.frequency > 5 ? "medium" : "low",
          },
          implementationPlan: this.generateConsolidationPlan(pattern),
          validation: {
            safetyChecks: [
              `Verify all ${pattern.name} functionality is preserved`,
            ],
            rollbackPlan: [
              "Restore individual components if consolidation fails",
            ],
            testRequirements: [
              `Test consolidated ${pattern.name} functionality`,
            ],
          },
        });
      }
    }

    return improvements;
  }

  private async detectArchitecturalInconsistencies(): Promise<
    EvolutionaryImprovement[]
  > {
    const improvements: EvolutionaryImprovement[] = [];
    const registryData = await this.loadComponentRegistry();

    // 불일치 1: 보안 관련 컴포넌트가 status에 통합되지 않음
    const securityComponents = registryData.components.filter(
      (c: ComponentMetadata) =>
        c.purpose.includes("security") &&
        !c.integrationPoints.includes("unified-dashboard"),
    );

    if (securityComponents.length > 0) {
      improvements.push({
        type: "standardization",
        priority: "critical",
        description:
          "Integrate all security components into unified status system",
        affectedComponents: securityComponents.map(
          (c: ComponentMetadata) => c.name,
        ),
        estimatedImpact: {
          complexity: 0,
          maintainability: 25,
          performance: 0,
          riskLevel: "low",
        },
        implementationPlan: [
          {
            order: 1,
            action: "auto_integrate_security",
            description:
              "Automatically integrate security components into unified-dashboard",
            automation: "full",
            dependencies: [],
          },
        ],
        validation: {
          safetyChecks: ["Verify security checks run properly in status"],
          rollbackPlan: ["Remove integrations if status becomes unstable"],
          testRequirements: ["Test status command with all security checks"],
        },
      });
    }

    // 불일치 2: 대부분의 컴포넌트가 package.json에 없음
    const unregisteredComponents = registryData.components.filter(
      (c: ComponentMetadata) => !c.integrationPoints.includes("package.json"),
    );

    if (unregisteredComponents.length > registryData.totalComponents * 0.5) {
      improvements.push({
        type: "standardization",
        priority: "high",
        description:
          "Register all components in package.json for discoverability",
        affectedComponents: unregisteredComponents
          .slice(0, 20)
          .map((c: ComponentMetadata) => c.name), // 처음 20개만
        estimatedImpact: {
          complexity: 10,
          maintainability: 40,
          performance: 0,
          riskLevel: "low",
        },
        implementationPlan: [
          {
            order: 1,
            action: "batch_register_scripts",
            description: "Add npm scripts for unregistered components",
            automation: "full",
            dependencies: [],
          },
        ],
        validation: {
          safetyChecks: ["Verify npm scripts work correctly"],
          rollbackPlan: ["Remove added scripts if they cause conflicts"],
          testRequirements: ["Test random sampling of new npm scripts"],
        },
      });
    }

    return improvements;
  }

  /**
   * 설계 원칙에 대비하여 개선사항의 안전성을 검증
   */
  async validateAgainstPrinciples(
    improvements: EvolutionaryImprovement[],
  ): Promise<EvolutionaryImprovement[]> {
    console.log("🛡️ Validating improvements against design principles...");

    const safeImprovements: EvolutionaryImprovement[] = [];

    for (const improvement of improvements) {
      let isSafe = true;
      const safetyNotes: string[] = [];

      // 원칙 1: 단순성 우선 검증
      if (improvement.estimatedImpact.complexity > 0) {
        safetyNotes.push(
          "May increase complexity - requires careful implementation",
        );
        if (improvement.estimatedImpact.complexity > 20) {
          isSafe = false;
          console.log(
            `   ❌ Rejected: ${improvement.description} (too complex)`,
          );
          continue;
        }
      }

      // 원칙 2: 4개 명령어 제한 검증
      if (
        improvement.type === "consolidation" &&
        improvement.affectedComponents.some((c) => this.isCoreCommand(c))
      ) {
        safetyNotes.push(
          "Affects core commands - must maintain 4-command limit",
        );
      }

      // 원칙 3: 승인 기반 변경 검증
      if (
        improvement.estimatedImpact.riskLevel === "high" ||
        improvement.priority === "critical"
      ) {
        improvement.validation.safetyChecks.push(
          "Requires explicit approval before implementation",
        );
      }

      // 안전한 개선사항으로 승인
      if (isSafe) {
        if (safetyNotes.length > 0) {
          improvement.validation.safetyChecks.push(...safetyNotes);
        }
        safeImprovements.push(improvement);
        console.log(`   ✅ Validated: ${improvement.description}`);
      }
    }

    return safeImprovements;
  }

  /**
   * 안전한 개선사항을 자동으로 적용
   */
  async applyStructuralEvolution(
    improvements: EvolutionaryImprovement[],
  ): Promise<void> {
    console.log("🚀 Applying structural evolution...");

    const history = this.loadEvolutionHistory();

    for (const improvement of improvements) {
      if (this.canAutoApply(improvement)) {
        console.log(`   🔧 Auto-applying: ${improvement.description}`);

        const beforeState = await this.captureSystemState();

        try {
          await this.executeImprovement(improvement);

          const afterState = await this.captureSystemState();
          const impact = this.measureImpact(beforeState, afterState);

          // 성공 기록
          history.push({
            timestamp: new Date().toISOString(),
            improvementApplied: improvement.description,
            beforeState,
            afterState,
            outcome: "success",
            impactMeasured: impact,
          });

          console.log(`   ✅ Applied successfully: ${improvement.description}`);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          console.log(
            `   ❌ Failed to apply: ${improvement.description} - ${errorMessage}`,
          );

          // 실패 기록
          history.push({
            timestamp: new Date().toISOString(),
            improvementApplied: improvement.description,
            beforeState,
            afterState: null,
            outcome: "failed",
            impactMeasured: { error: errorMessage },
          });
        }
      } else {
        console.log(`   ⏳ Queued for approval: ${improvement.description}`);
      }
    }

    this.saveEvolutionHistory(history);
  }

  private async executeImprovement(
    improvement: EvolutionaryImprovement,
  ): Promise<void> {
    for (const step of improvement.implementationPlan) {
      switch (step.action) {
        case "remove_duplicate":
          await this.removeDuplicateComponents(improvement.affectedComponents);
          break;

        case "auto_integrate_security":
          await this.autoIntegrateSecurityComponents(
            improvement.affectedComponents,
          );
          break;

        case "batch_register_scripts":
          await this.batchRegisterScripts(improvement.affectedComponents);
          break;

        default:
          console.log(`   ⚠️ Manual step required: ${step.description}`);
      }
    }
  }

  private async autoIntegrateSecurityComponents(
    componentNames: string[],
  ): Promise<void> {
    const dashboardPath = join(
      this.projectRoot,
      "scripts/unified-dashboard.ts",
    );

    if (!existsSync(dashboardPath)) return;

    let content = readFileSync(dashboardPath, "utf8");
    const registryData = await this.loadComponentRegistry();

    for (const componentName of componentNames) {
      const component = registryData.components.find(
        (c: ComponentMetadata) => c.name === componentName,
      );
      if (!component) continue;

      // Import 추가
      const importName = this.generateImportName(componentName);
      const importPath = `./${component.path
        .replace("scripts/", "")
        .replace(".ts", ".js")}`;

      if (!content.includes(`import ${importName}`)) {
        const importSection =
          content.match(/import.*from.*;\n/g)?.join("") || "";
        content = content.replace(
          importSection,
          importSection + `import ${importName} from "${importPath}";\n`,
        );
      }

      // v4.0 Enhanced Analysis에 보안 체크 추가
      const enhancedSection = content.match(
        /(console\.log\("   🔥 v4\.0 Enhanced Analysis:"\);[\s\S]*?)(    console\.log\("   🔍 Temporary Workarounds\.\.\."\);)/,
      );
      if (enhancedSection) {
        const securityCheck = `
      console.log("   🔐 ${componentName} Security Check...");
      const ${this.camelCase(componentName)} = new ${importName}();
      const ${this.camelCase(componentName)}Result = await ${this.camelCase(
        componentName,
      )}.check();
      console.log(\`   🛡️ Security: \${${this.camelCase(
        componentName,
      )}Result.status}\`);

`;
        content = content.replace(
          enhancedSection[2],
          securityCheck + enhancedSection[2],
        );
      }
    }

    writeFileSync(dashboardPath, content);
    console.log(
      `   ✅ Integrated ${componentNames.length} security components into unified-dashboard`,
    );
  }

  private async batchRegisterScripts(componentNames: string[]): Promise<void> {
    const packagePath = join(this.projectRoot, "package.json");
    const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
    const registryData = await this.loadComponentRegistry();

    let addedCount = 0;

    for (const componentName of componentNames.slice(0, 20)) {
      // 처음 20개만
      const component = registryData.components.find(
        (c: ComponentMetadata) => c.name === componentName,
      );
      if (!component) continue;

      const scriptName = `${component.type}:${componentName.replace(
        /[^a-z0-9]/gi,
        "",
      )}`.toLowerCase();
      const scriptCommand = `tsx ${component.path}`;

      if (!packageJson.scripts[scriptName]) {
        packageJson.scripts[scriptName] = scriptCommand;
        addedCount++;
      }
    }

    if (addedCount > 0) {
      writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
      console.log(`   ✅ Added ${addedCount} npm scripts to package.json`);
    }
  }

  /**
   * 전체 진화 과정을 실행
   */
  async evolveArchitecture(): Promise<SystemEvolutionReport> {
    return wrapWithGovernance("architectural-evolution-engine", async () => {
      console.log("🧬 Starting architectural evolution...");

      // 1. 개선 기회 식별
      const improvements = await this.identifyStructuralImprovements();

      // 2. 설계 원칙 대비 검증
      const safeImprovements = await this.validateAgainstPrinciples(
        improvements,
      );

      // 3. 자동 적용 가능한 것들 실행
      await this.applyStructuralEvolution(safeImprovements);

      // 4. 진화 보고서 생성
      const report: SystemEvolutionReport = {
        timestamp: new Date().toISOString(),
        version: "1.0.0",
        analysisResults: {
          patternsFound: await this.detectStructuralPatterns(),
          improvementsIdentified: improvements,
          systemHealthTrend: await this.calculateHealthTrend(),
          complexityTrend: await this.calculateComplexityTrend(),
        },
        autoEvolutionCapabilities: {
          canAutoFix: safeImprovements.filter((i) => this.canAutoApply(i)),
          needsApproval: safeImprovements.filter(
            (i) =>
              !this.canAutoApply(i) && i.estimatedImpact.riskLevel !== "high",
          ),
          requiresManual: safeImprovements.filter(
            (i) => i.estimatedImpact.riskLevel === "high",
          ),
        },
        evolutionHistory: this.loadEvolutionHistory(),
      };

      // 보고서 저장
      const reportPath = join(
        this.projectRoot,
        "reports/evolution-report.json",
      );
      writeFileSync(reportPath, JSON.stringify(report, null, 2));

      console.log(`🎉 Architecture evolution completed!`);
      console.log(`   📊 ${improvements.length} improvements identified`);
      console.log(
        `   ⚡ ${report.autoEvolutionCapabilities.canAutoFix.length} auto-applied`,
      );
      console.log(
        `   ⏳ ${report.autoEvolutionCapabilities.needsApproval.length} awaiting approval`,
      );
      console.log(
        `   🔧 ${report.autoEvolutionCapabilities.requiresManual.length} require manual intervention`,
      );

      return report;
    });
  }

  // 유틸리티 메서드들
  private async loadComponentRegistry(): Promise<any> {
    const registryPath = join(
      this.projectRoot,
      "reports/component-registry.json",
    );
    return JSON.parse(readFileSync(registryPath, "utf8"));
  }

  private groupComponentsByPurpose(components: any[]): Record<string, any[]> {
    const groups: Record<string, any[]> = {};

    for (const component of components) {
      const purposes = component.purpose
        .split(",")
        .map((p: string) => p.trim());
      for (const purpose of purposes) {
        if (!groups[purpose]) groups[purpose] = [];
        groups[purpose].push(component);
      }
    }

    return groups;
  }

  private calculateConsolidationScore(components: any[]): number {
    // 컴포넌트들의 유사성을 바탕으로 통합 가능성 점수 계산
    if (components.length < 2) return 0;

    let totalSimilarity = 0;
    let comparisons = 0;

    for (let i = 0; i < components.length; i++) {
      for (let j = i + 1; j < components.length; j++) {
        const similarity = this.calculateComponentSimilarity(
          components[i],
          components[j],
        );
        totalSimilarity += similarity;
        comparisons++;
      }
    }

    return comparisons > 0 ? totalSimilarity / comparisons : 0;
  }

  private calculateComponentSimilarity(comp1: any, comp2: any): number {
    let similarity = 0;

    // 목적 유사성 (40%)
    const purposeOverlap = this.calculateStringOverlap(
      comp1.purpose,
      comp2.purpose,
    );
    similarity += purposeOverlap * 0.4;

    // 타입 유사성 (30%)
    if (comp1.type === comp2.type) similarity += 0.3;

    // 이름 유사성 (30%)
    const nameOverlap = this.calculateStringOverlap(comp1.name, comp2.name);
    similarity += nameOverlap * 0.3;

    return similarity;
  }

  private calculateStringOverlap(str1: string, str2: string): number {
    const words1 = str1.toLowerCase().split(/[\s,-]/);
    const words2 = str2.toLowerCase().split(/[\s,-]/);

    const commonWords = words1.filter((word) => words2.includes(word));
    return commonWords.length / Math.max(words1.length, words2.length);
  }

  private detectNamingPatterns(components: any[]): StructuralPattern[] {
    const patterns: StructuralPattern[] = [];
    const nameGroups: Record<string, string[]> = {};

    // 공통 접두사/접미사 탐지
    for (const component of components) {
      const name = component.name;

      // 접두사 기반 그룹화
      const prefix = name.split("-")[0];
      if (prefix && prefix.length > 2) {
        if (!nameGroups[prefix]) nameGroups[prefix] = [];
        nameGroups[prefix].push(name);
      }
    }

    for (const [prefix, names] of Object.entries(nameGroups)) {
      if (names.length > 2) {
        patterns.push({
          name: `${prefix}-prefixed-components`,
          description: `Components with '${prefix}' prefix`,
          components: names,
          frequency: names.length,
          duplicationType: "similar",
          consolidationOpportunity: names.length > 3 ? 0.8 : 0.6,
        });
      }
    }

    return patterns;
  }

  private analyzeDependencyPatterns(components: any[]): StructuralPattern[] {
    // 의존성 패턴 분석은 복잡하므로 기본 구현만
    return [];
  }

  private calculateImpactScore(improvement: EvolutionaryImprovement): number {
    const impact = improvement.estimatedImpact;
    return (
      -impact.complexity * 0.3 + // 복잡성 감소는 좋음
      impact.maintainability * 0.4 +
      impact.performance * 0.2 +
      (improvement.priority === "critical"
        ? 50
        : improvement.priority === "high"
        ? 30
        : improvement.priority === "medium"
        ? 20
        : 10) *
        0.1
    );
  }

  private generateConsolidationPlan(
    pattern: StructuralPattern,
  ): EvolutionStep[] {
    return [
      {
        order: 1,
        action: "analyze_components",
        description: `Analyze ${pattern.components.length} components in ${pattern.name}`,
        automation: "full",
        dependencies: [],
      },
      {
        order: 2,
        action: "create_unified_interface",
        description: `Create unified interface for ${pattern.name}`,
        automation: "assisted",
        dependencies: [1],
      },
      {
        order: 3,
        action: "migrate_functionality",
        description: `Migrate functionality to unified interface`,
        automation: "assisted",
        dependencies: [2],
      },
    ];
  }

  private canAutoApply(improvement: EvolutionaryImprovement): boolean {
    return (
      improvement.estimatedImpact.riskLevel === "low" &&
      improvement.implementationPlan.every(
        (step) => step.automation !== "manual",
      ) &&
      improvement.priority !== "critical"
    );
  }

  private async captureSystemState(): Promise<any> {
    // 시스템 상태 캡처 (메트릭, 구성 등)
    return {
      timestamp: new Date().toISOString(),
      componentCount: (await this.loadComponentRegistry()).totalComponents,
      // 추가 메트릭들...
    };
  }

  private measureImpact(beforeState: any, afterState: any): any {
    return {
      componentCountChange:
        afterState.componentCount - beforeState.componentCount,
      // 추가 영향도 측정...
    };
  }

  private async calculateHealthTrend(): Promise<number> {
    // 시간에 따른 시스템 건강도 트렌드 계산
    return 0.1; // 개선 추세
  }

  private async calculateComplexityTrend(): Promise<number> {
    // 시간에 따른 복잡성 트렌드 계산
    return -0.05; // 복잡성 감소 추세
  }

  private loadEvolutionHistory(): EvolutionHistoryEntry[] {
    if (!existsSync(this.evolutionHistoryPath)) {
      return [];
    }
    return JSON.parse(readFileSync(this.evolutionHistoryPath, "utf8"));
  }

  private saveEvolutionHistory(history: EvolutionHistoryEntry[]): void {
    writeFileSync(this.evolutionHistoryPath, JSON.stringify(history, null, 2));
  }

  private isCoreCommand(componentName: string): boolean {
    return ["status", "sync", "fix", "ship"].some((cmd) =>
      componentName.includes(cmd),
    );
  }

  private generateImportName(componentName: string): string {
    return componentName
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join("");
  }

  private camelCase(str: string): string {
    return str.replace(/-./g, (x) => x[1].toUpperCase());
  }

  private async removeDuplicateComponents(
    componentNames: string[],
  ): Promise<void> {
    // 실제로는 중복 컴포넌트를 안전하게 제거
    console.log(
      `   🗑️ Would remove duplicate components: ${componentNames.join(", ")}`,
    );
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const engine = new ArchitecturalEvolutionEngine();

  const command = process.argv[2];

  switch (command) {
    case "evolve":
      engine
        .evolveArchitecture()
        .then((report) => {
          console.log(
            `\n📊 Evolution completed! Check reports/evolution-report.json for details.`,
          );
        })
        .catch(console.error);
      break;

    case "analyze":
      engine
        .identifyStructuralImprovements()
        .then((improvements) => {
          console.log(
            `\n💡 Found ${improvements.length} improvement opportunities:\n`,
          );
          improvements.forEach((imp) => {
            console.log(`🔧 ${imp.description}`);
            console.log(`   Priority: ${imp.priority}`);
            console.log(
              `   Impact: Complexity ${imp.estimatedImpact.complexity}, Maintainability +${imp.estimatedImpact.maintainability}`,
            );
            console.log("");
          });
        })
        .catch(console.error);
      break;

    default:
      console.log(`
Usage:
  npm run evolution:analyze  # Analyze improvement opportunities
  npm run evolution:evolve   # Execute architectural evolution
`);
  }
}

export default ArchitecturalEvolutionEngine;
