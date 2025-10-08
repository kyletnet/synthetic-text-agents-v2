#!/usr/bin/env tsx
/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */


/**
 * Component Registry System
 * 모든 컴포넌트의 메타데이터와 통합 상태를 중앙에서 관리
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import DesignPrincipleEngine from "./design-principle-engine.js";
import IntegrationEnforcementSystem from "./integration-enforcement-system.js";

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

interface ComponentRegistry {
  version: string;
  lastUpdated: string;
  totalComponents: number;
  complianceStats: {
    compliant: number;
    violations: number;
    unregistered: number;
  };
  components: ComponentMetadata[];
  integrationHealth: {
    unifiedDashboard: number;
    packageJson: number;
    coreCommands: number;
    documented: number;
  };
}

class ComponentRegistrySystem {
  private projectRoot: string;
  private registryPath: string;
  private designEngine: DesignPrincipleEngine;
  private enforcementSystem: IntegrationEnforcementSystem;

  constructor() {
    this.projectRoot = process.cwd();
    this.registryPath = join(
      this.projectRoot,
      "reports/component-registry.json",
    );
    this.designEngine = new DesignPrincipleEngine();
    this.enforcementSystem = new IntegrationEnforcementSystem();

    // reports 디렉토리가 없으면 생성
    const reportsDir = dirname(this.registryPath);
    if (!existsSync(reportsDir)) {
      mkdirSync(reportsDir, { recursive: true });
    }
  }

  /**
   * 전체 시스템의 컴포넌트 레지스트리를 생성/업데이트 (성능 최적화)
   */
  async generateCompleteRegistry(): Promise<ComponentRegistry> {
    console.log("🏗️ Generating complete component registry...");

    // 1. 기존 레지스트리 로드 (있는 경우)
    const existingRegistry = this.loadExistingRegistryForUpdate();
    const existingComponents = new Map<string, ComponentMetadata>();

    if (existingRegistry) {
      console.log(
        `   📊 Loading existing registry (${existingRegistry.components.length} components)`,
      );
      existingRegistry.components.forEach((comp) => {
        existingComponents.set(comp.path, comp);
      });
    }

    const { glob } = await import("glob");
    const { statSync } = await import("fs");

    console.log("   🔍 Scanning script files...");
    const scripts = await glob("scripts/**/*.{ts,js,sh}");
    console.log(`   📁 Found ${scripts.length} scripts to analyze`);

    const components: ComponentMetadata[] = [];
    let processedCount = 0;
    let skippedCount = 0;

    for (const scriptPath of scripts) {
      try {
        // 파일 수정 시간 확인 (캐싱 최적화)
        const fileStats = statSync(join(this.projectRoot, scriptPath));
        const lastModified = fileStats.mtime.toISOString();

        const existing = existingComponents.get(scriptPath);

        // 파일이 변경되지 않았으면 기존 메타데이터 재사용
        if (existing && existing.lifecycle.lastUpdated === lastModified) {
          components.push(existing);
          skippedCount++;

          // 진행률 표시 (매 10개마다)
          if ((processedCount + skippedCount) % 10 === 0) {
            console.log(
              `   📈 Progress: ${processedCount + skippedCount}/${
                scripts.length
              } (${skippedCount} cached)`,
            );
          }
          continue;
        }

        // 새로운 메타데이터 생성
        const metadata = await this.generateComponentMetadata(scriptPath);
        metadata.lifecycle.lastUpdated = lastModified;
        components.push(metadata);
        processedCount++;

        // 진행률 표시 (매 10개마다)
        if ((processedCount + skippedCount) % 10 === 0) {
          console.log(
            `   📈 Progress: ${processedCount + skippedCount}/${
              scripts.length
            } (${processedCount} analyzed, ${skippedCount} cached)`,
          );
        }
      } catch (error) {
        console.log(`   ⚠️ Failed to register ${scriptPath}: ${error}`);
      }
    }

    console.log(
      `   ✅ Analysis complete: ${processedCount} analyzed, ${skippedCount} cached from previous run`,
    );

    // 레지스트리 생성
    const registry: ComponentRegistry = {
      version: "1.0.0",
      lastUpdated: new Date().toISOString(),
      totalComponents: components.length,
      complianceStats: this.calculateComplianceStats(components),
      components: components.sort((a, b) => a.name.localeCompare(b.name)),
      integrationHealth: this.calculateIntegrationHealth(components),
    };

    // 레지스트리 저장
    this.saveRegistry(registry);

    console.log(
      `✅ Registry generated: ${components.length} components registered`,
    );
    return registry;
  }

  /**
   * 개별 컴포넌트의 메타데이터 생성
   */
  private async generateComponentMetadata(
    scriptPath: string,
  ): Promise<ComponentMetadata> {
    // 1. 설계 엔진으로 컨텍스트 분석
    const context = await this.designEngine.analyzeScript(scriptPath);
    const decision = this.designEngine.makeDecision(context);

    // 2. 현재 통합 상태 분석
    const integrationPoints = await this.analyzeCurrentIntegration(scriptPath);

    // 3. 컴플라이언스 검사
    const compliance = await this.checkCompliance(scriptPath, decision);

    // 4. 라이프사이클 정보 수집
    const lifecycle = await this.collectLifecycleInfo(scriptPath);

    const componentName = this.extractComponentName(scriptPath);

    return {
      name: componentName,
      path: scriptPath,
      type: context.componentType,
      purpose: context.purpose,
      riskLevel: context.riskLevel,
      userImpact: context.userImpact,
      dependencies: context.dependencies,
      integrationPoints,
      constraints: decision.constraints,
      designDecision: decision,
      compliance,
      lifecycle,
    };
  }

  private async analyzeCurrentIntegration(
    scriptPath: string,
  ): Promise<string[]> {
    const integrationPoints: string[] = [];

    // unified-dashboard 통합 확인
    const dashboardPath = join(
      this.projectRoot,
      "scripts/unified-dashboard.ts",
    );
    if (existsSync(dashboardPath)) {
      const content = readFileSync(dashboardPath, "utf8");
      const componentName = this.extractComponentName(scriptPath);
      if (content.includes(componentName) || content.includes(scriptPath)) {
        integrationPoints.push("unified-dashboard");
      }
    }

    // package.json 통합 확인
    const packagePath = join(this.projectRoot, "package.json");
    if (existsSync(packagePath)) {
      const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
      const scriptValues = Object.values(packageJson.scripts).join(" ");
      if (scriptValues.includes(scriptPath)) {
        integrationPoints.push("package.json");
      }
    }

    // CI/CD 통합 확인
    const ciPath = join(this.projectRoot, ".github/workflows/ci.yml");
    if (existsSync(ciPath)) {
      const ciContent = readFileSync(ciPath, "utf8");
      if (ciContent.includes(scriptPath)) {
        integrationPoints.push("ci-cd");
      }
    }

    // ARCHITECTURE.md 문서화 확인
    const archPath = join(this.projectRoot, "docs/ARCHITECTURE.md");
    if (existsSync(archPath)) {
      const archContent = readFileSync(archPath, "utf8");
      if (archContent.includes(this.extractComponentName(scriptPath))) {
        integrationPoints.push("documentation");
      }
    }

    return integrationPoints;
  }

  private async checkCompliance(
    scriptPath: string,
    decision: any,
  ): Promise<ComponentMetadata["compliance"]> {
    const violations: string[] = [];

    // 필수 통합 포인트 확인
    if (decision.integration.includeInStatus) {
      const integrationPoints = await this.analyzeCurrentIntegration(
        scriptPath,
      );
      if (!integrationPoints.includes("unified-dashboard")) {
        violations.push("Required integration with unified-dashboard missing");
      }
    }

    // 메타데이터 요구사항 확인
    if (!decision.constraints.includes("MUST_HAVE_COMPONENT_METADATA")) {
      // 스크립트 내부에서 메타데이터 존재 확인
      const content = readFileSync(join(this.projectRoot, scriptPath), "utf8");
      if (!content.includes("/**") && !content.includes("*")) {
        violations.push("Missing component documentation/metadata");
      }
    }

    // 4개 명령어 제한 확인 (core 레벨인 경우)
    if (decision.placement === "core") {
      // 실제 핵심 명령어 수 확인 필요
    }

    return {
      isCompliant: violations.length === 0,
      violations,
      lastChecked: new Date().toISOString(),
    };
  }

  private async collectLifecycleInfo(
    scriptPath: string,
  ): Promise<ComponentMetadata["lifecycle"]> {
    const { execSync } = await import("child_process");

    try {
      // Git을 통해 파일 생성/수정 정보 수집
      const createdDate = execSync(
        `git log --format="%ai" --reverse ${scriptPath} | head -1`,
        { encoding: "utf8", cwd: this.projectRoot },
      ).trim();

      const lastUpdated = execSync(`git log -1 --format="%ai" ${scriptPath}`, {
        encoding: "utf8",
        cwd: this.projectRoot,
      }).trim();

      // 파일 이름으로 상태 추정
      let status: ComponentMetadata["lifecycle"]["status"] = "active";
      const fileName = scriptPath.toLowerCase();

      if (fileName.includes("legacy") || fileName.includes("old")) {
        status = "legacy";
      } else if (fileName.includes("deprecated")) {
        status = "deprecated";
      } else if (
        fileName.includes("experimental") ||
        fileName.includes("test")
      ) {
        status = "experimental";
      }

      return {
        created: createdDate || new Date().toISOString(),
        lastUpdated: lastUpdated || new Date().toISOString(),
        lastIntegrated: new Date().toISOString(), // 실제로는 통합 히스토리에서 가져와야 함
        status,
      };
    } catch (error) {
      // Git 정보를 가져올 수 없는 경우 기본값
      const now = new Date().toISOString();
      return {
        created: now,
        lastUpdated: now,
        lastIntegrated: now,
        status: "active",
      };
    }
  }

  private calculateComplianceStats(
    components: ComponentMetadata[],
  ): ComponentRegistry["complianceStats"] {
    const compliant = components.filter(
      (c) => c.compliance?.isCompliant === true,
    ).length;
    const violations = components.length - compliant;

    return {
      compliant,
      violations,
      unregistered: 0, // 모든 컴포넌트가 등록되었으므로 0
    };
  }

  private calculateIntegrationHealth(
    components: ComponentMetadata[],
  ): ComponentRegistry["integrationHealth"] {
    const total = components.length;

    return {
      unifiedDashboard:
        (components.filter((c) =>
          c.integrationPoints.includes("unified-dashboard"),
        ).length /
          total) *
        100,
      packageJson:
        (components.filter((c) => c.integrationPoints.includes("package.json"))
          .length /
          total) *
        100,
      coreCommands: components.filter(
        (c) => c.designDecision?.placement === "core",
      ).length,
      documented:
        (components.filter((c) => c.integrationPoints.includes("documentation"))
          .length /
          total) *
        100,
    };
  }

  private saveRegistry(registry: ComponentRegistry): void {
    writeFileSync(this.registryPath, JSON.stringify(registry, null, 2));
    console.log(`📄 Registry saved to: ${this.registryPath}`);
  }

  /**
   * 레지스트리에서 컴포넌트 검색
   */
  async searchComponents(query: string): Promise<ComponentMetadata[]> {
    const registry = await this.loadRegistry();

    return registry.components.filter(
      (component) =>
        component.name.toLowerCase().includes(query.toLowerCase()) ||
        component.purpose.toLowerCase().includes(query.toLowerCase()) ||
        component.type.toLowerCase().includes(query.toLowerCase()),
    );
  }

  /**
   * 컴플라이언스 위반 컴포넌트 조회
   */
  async getNonCompliantComponents(): Promise<ComponentMetadata[]> {
    const registry = await this.loadRegistry();

    return registry.components.filter(
      (component) => !component.compliance.isCompliant,
    );
  }

  /**
   * 통합 상태별 컴포넌트 분류
   */
  async getComponentsByIntegration(): Promise<
    Record<string, ComponentMetadata[]>
  > {
    const registry = await this.loadRegistry();

    return {
      unifiedDashboard: registry.components.filter((c) =>
        c.integrationPoints.includes("unified-dashboard"),
      ),
      packageJson: registry.components.filter((c) =>
        c.integrationPoints.includes("package.json"),
      ),
      cicd: registry.components.filter((c) =>
        c.integrationPoints.includes("ci-cd"),
      ),
      documentation: registry.components.filter((c) =>
        c.integrationPoints.includes("documentation"),
      ),
      unintegrated: registry.components.filter(
        (c) => c.integrationPoints.length === 0,
      ),
    };
  }

  /**
   * 자동 통합 제안 생성
   */
  async generateIntegrationSuggestions(): Promise<string[]> {
    const nonCompliant = await this.getNonCompliantComponents();
    const suggestions: string[] = [];

    for (const component of nonCompliant) {
      if (
        component.designDecision?.integration?.includeInStatus &&
        !component.integrationPoints.includes("unified-dashboard")
      ) {
        suggestions.push(
          `Integrate ${component.name} into unified-dashboard.ts (required for status display)`,
        );
      }

      if (!component.integrationPoints.includes("package.json")) {
        suggestions.push(
          `Add ${component.name} to package.json scripts for CLI access`,
        );
      }

      if (
        component.riskLevel === "critical" &&
        !component.integrationPoints.includes("ci-cd")
      ) {
        suggestions.push(
          `Add ${component.name} to CI/CD pipeline (critical component)`,
        );
      }
    }

    return suggestions;
  }

  /**
   * 레지스트리 요약 보고서 생성
   */
  generateRegistrySummary(): string {
    const registry = this.loadRegistrySync();

    return `
## 📋 Component Registry Summary

### 📊 Overview
- **Total Components**: ${registry.totalComponents}
- **Compliant**: ${registry.complianceStats.compliant} (${Math.round(
      (registry.complianceStats.compliant / registry.totalComponents) * 100,
    )}%)
- **Non-compliant**: ${registry.complianceStats.violations} (${Math.round(
      (registry.complianceStats.violations / registry.totalComponents) * 100,
    )}%)

### 🔗 Integration Health
- **Unified Dashboard**: ${Math.round(
      registry.integrationHealth.unifiedDashboard,
    )}% integrated
- **Package.json**: ${Math.round(
      registry.integrationHealth.packageJson,
    )}% integrated
- **Core Commands**: ${registry.integrationHealth.coreCommands} components
- **Documented**: ${Math.round(
      registry.integrationHealth.documented,
    )}% documented

### ⚠️ Top Issues
${registry.components
  .filter((c) => c.compliance?.isCompliant !== true)
  .slice(0, 5)
  .map(
    (c) =>
      `- **${c.name}**: ${c.compliance?.violations?.length || 0} violations`,
  )
  .join("\n")}

### 🎯 Quick Actions
- Run \`npm run integration:auto-fix\` to fix common integration issues
- Run \`npm run registry:update\` to refresh component analysis
- Run \`npm run registry:search <term>\` to find specific components

**Registry Version**: ${registry.version}
**Last Updated**: ${new Date(registry.lastUpdated).toLocaleString()}
`;
  }

  private async loadRegistry(): Promise<ComponentRegistry> {
    if (!existsSync(this.registryPath)) {
      return await this.generateCompleteRegistry();
    }

    return JSON.parse(readFileSync(this.registryPath, "utf8"));
  }

  /**
   * 동기적으로 레지스트리 로드 (외부 접근용)
   */
  public getRegistryData(): ComponentRegistry {
    if (!existsSync(this.registryPath)) {
      throw new Error(
        "Registry not found. Run npm run registry:generate first.",
      );
    }

    return JSON.parse(readFileSync(this.registryPath, "utf8"));
  }

  private loadRegistrySync(): ComponentRegistry {
    if (!existsSync(this.registryPath)) {
      throw new Error(
        "Registry not found. Run npm run registry:generate first.",
      );
    }

    return JSON.parse(readFileSync(this.registryPath, "utf8"));
  }

  /**
   * 업데이트용 기존 레지스트리 로드 (오류 시 null 반환)
   */
  private loadExistingRegistryForUpdate(): ComponentRegistry | null {
    try {
      if (!existsSync(this.registryPath)) {
        return null;
      }
      return JSON.parse(readFileSync(this.registryPath, "utf8"));
    } catch (error) {
      console.log(
        `   ℹ️ Could not load existing registry for caching: ${error}`,
      );
      return null;
    }
  }

  private extractComponentName(scriptPath: string): string {
    return (
      scriptPath
        .split("/")
        .pop()
        ?.replace(/\.(ts|js|sh)$/, "") || "unknown"
    );
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const registry = new ComponentRegistrySystem();
  const command = process.argv[2];

  switch (command) {
    case "generate":
      registry
        .generateCompleteRegistry()
        .then((reg) => {
          console.log(registry.generateRegistrySummary());
        })
        .catch(console.error);
      break;

    case "search":
      const query = process.argv[3];
      if (query) {
        registry
          .searchComponents(query)
          .then((components) => {
            console.log(
              `\n🔍 Found ${components.length} components matching "${query}":\n`,
            );
            components.forEach((c) => {
              console.log(`📄 ${c.name} (${c.type}) - ${c.purpose}`);
              console.log(`   Path: ${c.path}`);
              console.log(
                `   Integration: ${c.integrationPoints.join(", ") || "None"}`,
              );
              console.log(
                `   Compliant: ${
                  c.compliance?.isCompliant === true ? "✅" : "❌"
                }\n`,
              );
            });
          })
          .catch(console.error);
      }
      break;

    case "violations":
      registry
        .getNonCompliantComponents()
        .then((components) => {
          console.log(
            `\n❌ Found ${components.length} non-compliant components:\n`,
          );
          components.forEach((c) => {
            console.log(`📄 ${c.name}:`);
            c.compliance?.violations?.forEach((v) => console.log(`   - ${v}`));
            console.log("");
          });
        })
        .catch(console.error);
      break;

    case "suggestions":
      registry
        .generateIntegrationSuggestions()
        .then((suggestions) => {
          console.log(`\n💡 Integration suggestions:\n`);
          suggestions.forEach((s) => console.log(`- ${s}`));
        })
        .catch(console.error);
      break;

    case "summary":
      console.log(registry.generateRegistrySummary());
      break;

    default:
      console.log(`
Usage:
  npm run registry:generate    # Generate complete component registry
  npm run registry:search <query>  # Search components
  npm run registry:violations  # Show non-compliant components
  npm run registry:suggestions # Get integration suggestions
  npm run registry:summary     # Show registry summary
`);
  }
}

export default ComponentRegistrySystem;
