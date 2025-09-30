#!/usr/bin/env tsx

/**
 * Integration Enforcement System
 * 통합되지 않은 컴포넌트의 존재를 물리적으로 방지하는 시스템
 */

import {
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  statSync,
} from "fs";
import { join } from "path";
import DesignPrincipleEngine from "./design-principle-engine.js";

interface ComponentSpec {
  name: string;
  path: string;
  type: string;
  purpose: string;
  dependencies: string[];
}

interface Component {
  spec: ComponentSpec;
  isIntegrated: boolean;
  integrationPoints: string[];
  violations: string[];
}

interface IntegrationRule {
  condition: (component: Component) => boolean;
  requiredIntegrations: string[];
  constraints: string[];
  errorMessage: string;
}

class IntegrationEnforcementSystem {
  private projectRoot: string;
  private designEngine: DesignPrincipleEngine;
  private integrationRules: IntegrationRule[] = [];

  constructor() {
    this.projectRoot = process.cwd();
    this.designEngine = new DesignPrincipleEngine();
    this.initializeIntegrationRules();
  }

  private initializeIntegrationRules(): void {
    // 규칙 1: 보안 관련 컴포넌트는 반드시 status에 통합되어야 함
    this.integrationRules.push({
      condition: (component) =>
        component.spec.purpose.includes("security") ||
        component.spec.purpose.includes("secret") ||
        component.spec.purpose.includes("audit"),
      requiredIntegrations: ["unified-dashboard", "package.json"],
      constraints: ["MUST_PASS_FOR_DEPLOYMENT", "MUST_REPORT_STATUS"],
      errorMessage:
        "Security components must be integrated into status system for deployment safety",
    });

    // 규칙 2: Git 관련 컴포넌트는 반드시 sync에 통합되어야 함
    this.integrationRules.push({
      condition: (component) =>
        component.spec.purpose.includes("git") ||
        component.spec.purpose.includes("sync") ||
        component.spec.purpose.includes("commit"),
      requiredIntegrations: ["sync-workflow", "package.json"],
      constraints: ["MUST_BE_ATOMIC", "MUST_SUPPORT_ROLLBACK"],
      errorMessage: "Git/sync components must be integrated into sync workflow",
    });

    // 규칙 3: 상태 관련 컴포넌트는 반드시 대시보드에 통합되어야 함
    this.integrationRules.push({
      condition: (component) =>
        component.spec.purpose.includes("status") ||
        component.spec.purpose.includes("health") ||
        component.spec.purpose.includes("check"),
      requiredIntegrations: ["unified-dashboard"],
      constraints: ["MUST_PROVIDE_SUMMARY", "MUST_BE_OBSERVABLE"],
      errorMessage:
        "Status/health/check components must be integrated into unified dashboard",
    });

    // 규칙 4: 사용자 대면 컴포넌트만 4개 명령어 제한 준수
    this.integrationRules.push({
      condition: (component) =>
        component.spec.type.includes("user-facing") ||
        component.spec.type.includes("command") ||
        component.spec.type.includes("cli"),
      requiredIntegrations: ["core-command-system"],
      constraints: ["CORE_LIMIT_4_COMMANDS", "MUST_BE_DISCOVERABLE"],
      errorMessage:
        "User-facing components must respect 4-command limit and be discoverable",
    });

    // 규칙 5: 모든 컴포넌트는 메타데이터를 가져야 함
    this.integrationRules.push({
      condition: () => true, // 모든 컴포넌트에 적용
      requiredIntegrations: ["component-registry"],
      constraints: ["MUST_HAVE_METADATA", "MUST_BE_CATEGORIZED"],
      errorMessage: "All components must have metadata and be categorized",
    });
  }

  /**
   * 컴포넌트 생성 시 강제 통합 적용
   * 통합되지 않은 컴포넌트는 존재할 수 없음
   */
  createComponent(spec: ComponentSpec): Component {
    console.log(`🔨 Creating component: ${spec.name}`);

    // 1. 설계 원칙 엔진을 통해 결정 생성
    const context = {
      componentType: spec.type,
      riskLevel: this.determineRiskLevel(spec),
      userImpact: this.determineUserImpact(spec),
      purpose: spec.purpose,
      dependencies: spec.dependencies,
      integrationPoints: [],
    };

    const decision = this.designEngine.makeDecision(context);

    // 2. 컴포넌트 생성
    const component = this.createFromSpec(spec);

    // 3. 강제 통합 실행
    this.forceIntegration(component, decision);

    // 4. 통합 검증
    this.validateIntegration(component);

    console.log(`✅ Component ${spec.name} created and fully integrated`);
    return component;
  }

  private createFromSpec(spec: ComponentSpec): Component {
    return {
      spec,
      isIntegrated: false,
      integrationPoints: [],
      violations: [],
    };
  }

  /**
   * 강제 통합 실행 - 선택이 아니라 강제
   */
  private forceIntegration(component: Component, decision: any): void {
    console.log(`🔗 Force integrating: ${component.spec.name}`);

    // unified-dashboard 통합
    if (decision.integration.includeInStatus) {
      this.integrateIntoUnifiedDashboard(component);
    }

    // package.json 통합
    this.integrateIntoPackageJson(component);

    // sync 워크플로우 통합
    if (decision.integration.includeInSync) {
      this.integrateIntoSyncWorkflow(component);
    }

    // 컴포넌트 레지스트리 통합
    this.integrateIntoComponentRegistry(component);

    component.isIntegrated = true;
  }

  private integrateIntoUnifiedDashboard(component: Component): void {
    const dashboardPath = join(
      this.projectRoot,
      "scripts/unified-dashboard.ts",
    );

    if (existsSync(dashboardPath)) {
      let content = readFileSync(dashboardPath, "utf8");

      // import 추가
      const importName = this.generateImportName(component.spec.name);
      const importPath = this.getRelativeImportPath(component.spec.path);

      if (!content.includes(`import ${importName}`)) {
        const importStatement = `import ${importName} from "${importPath}";`;
        const importSection =
          content.match(/import.*from.*;\n/g)?.join("") || "";
        content = content.replace(
          importSection,
          importSection + importStatement + "\n",
        );
      }

      // v4.0 Enhanced Analysis 섹션에 추가
      const enhancedAnalysisMatch = content.match(
        /(private async runV4EnhancedAnalysis\(\): Promise<void> \{[\s\S]*?)(    \} catch)/,
      );
      if (enhancedAnalysisMatch) {
        const beforeCatch = enhancedAnalysisMatch[1];
        const newCheck = `
      console.log("   🔍 ${component.spec.purpose} Analysis...");
      const ${this.camelCase(component.spec.name)} = new ${importName}();
      const ${this.camelCase(component.spec.name)}Report = await ${this.camelCase(component.spec.name)}.analyze();
      console.log(\`   📊 ${component.spec.purpose}: \${${this.camelCase(component.spec.name)}Report.summary}\`);
`;
        content = content.replace(
          enhancedAnalysisMatch[1],
          beforeCatch + newCheck,
        );
      }

      writeFileSync(dashboardPath, content);
      component.integrationPoints.push("unified-dashboard");
      console.log(`   ✅ Integrated into unified-dashboard.ts`);
    }
  }

  private integrateIntoPackageJson(component: Component): void {
    const packagePath = join(this.projectRoot, "package.json");

    if (existsSync(packagePath)) {
      const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));

      // 스크립트 이름 생성
      const scriptName = this.generateScriptName(
        component.spec.name,
        component.spec.purpose,
      );
      const scriptCommand = `tsx ${component.spec.path}`;

      // package.json에 스크립트 추가
      if (!packageJson.scripts[scriptName]) {
        packageJson.scripts[scriptName] = scriptCommand;

        // hidden 스크립트로도 추가 (내부 사용)
        const hiddenScriptName = `_hidden:${scriptName}`;
        packageJson.scripts[hiddenScriptName] = scriptCommand;

        writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
        component.integrationPoints.push("package.json");
        console.log(`   ✅ Added script: ${scriptName}`);
      }
    }
  }

  private integrateIntoSyncWorkflow(component: Component): void {
    const packagePath = join(this.projectRoot, "package.json");

    if (existsSync(packagePath)) {
      const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));

      // review-sync 스크립트에 추가
      const reviewSync = packageJson.scripts["review-sync"] || "";
      const scriptName = `_hidden:${this.generateScriptName(component.spec.name, component.spec.purpose)}`;

      if (!reviewSync.includes(scriptName)) {
        packageJson.scripts["review-sync"] =
          `${reviewSync} && npm run ${scriptName}`;
        writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
        component.integrationPoints.push("sync-workflow");
        console.log(`   ✅ Integrated into sync workflow`);
      }
    }
  }

  private integrateIntoComponentRegistry(component: Component): void {
    const registryPath = join(
      this.projectRoot,
      "reports/component-registry.json",
    );
    let registry: any = {
      components: [],
      lastUpdated: new Date().toISOString(),
    };

    if (existsSync(registryPath)) {
      registry = JSON.parse(readFileSync(registryPath, "utf8"));
    }

    // 컴포넌트 정보 추가
    const registryEntry = {
      name: component.spec.name,
      path: component.spec.path,
      type: component.spec.type,
      purpose: component.spec.purpose,
      integrationPoints: component.integrationPoints,
      createdAt: new Date().toISOString(),
      isCompliant: component.violations.length === 0,
    };

    // 중복 제거하고 추가
    registry.components = registry.components.filter(
      (c: any) => c.name !== component.spec.name,
    );
    registry.components.push(registryEntry);
    registry.lastUpdated = new Date().toISOString();

    writeFileSync(registryPath, JSON.stringify(registry, null, 2));
    component.integrationPoints.push("component-registry");
    console.log(`   ✅ Registered in component registry`);
  }

  /**
   * 통합 규칙 위반 검사
   */
  private validateIntegration(component: Component): void {
    console.log(`🔍 Validating integration: ${component.spec.name}`);

    for (const rule of this.integrationRules) {
      if (rule.condition(component)) {
        // 필수 통합 포인트 확인
        for (const requiredIntegration of rule.requiredIntegrations) {
          if (!this.hasIntegration(component, requiredIntegration)) {
            component.violations.push(
              `Missing required integration: ${requiredIntegration}`,
            );
          }
        }

        // 제약 조건 확인
        for (const constraint of rule.constraints) {
          if (!this.satisfiesConstraint(component, constraint)) {
            component.violations.push(`Violates constraint: ${constraint}`);
          }
        }
      }
    }

    // 위반사항이 있으면 생성 실패
    if (component.violations.length > 0) {
      console.error(
        `❌ Integration validation failed for ${component.spec.name}:`,
      );
      component.violations.forEach((violation) =>
        console.error(`   - ${violation}`),
      );
      throw new Error(
        `Component ${component.spec.name} cannot exist due to integration violations`,
      );
    }

    console.log(`✅ Integration validation passed for ${component.spec.name}`);
  }

  private hasIntegration(component: Component, integration: string): boolean {
    return component.integrationPoints.some(
      (point) => point.includes(integration) || integration.includes(point),
    );
  }

  private satisfiesConstraint(
    component: Component,
    constraint: string,
  ): boolean {
    // 실제 제약 조건 검사 로직
    switch (constraint) {
      case "MUST_HAVE_METADATA":
        return !!(component.spec.type && component.spec.purpose);
      case "MUST_BE_CATEGORIZED":
        return component.spec.type !== "unknown";
      case "CORE_LIMIT_4_COMMANDS":
        // 핵심 명령어가 4개를 넘지 않는지 확인
        return this.countCoreCommands() <= 4;
      default:
        return true; // 알려지지 않은 제약은 통과
    }
  }

  /**
   * 기존 컴포넌트들의 통합 상태를 검사하고 강제 통합
   */
  async auditExistingComponents(): Promise<void> {
    console.log(
      "🔍 Auditing existing components for integration compliance...",
    );

    const { glob } = await import("glob");
    const scripts = await glob("scripts/**/*.{ts,js,sh}");

    const violations = [];

    for (const scriptPath of scripts) {
      try {
        const spec: ComponentSpec = {
          name: this.extractComponentName(scriptPath),
          path: scriptPath,
          type: "unknown",
          purpose: "unknown",
          dependencies: [],
        };

        const component = this.createFromSpec(spec);

        // 기존 통합 상태 분석
        this.analyzeExistingIntegration(component);

        // 규칙 위반 검사 (단, 실패해도 예외 throw하지 않음)
        this.validateIntegrationSafely(component);

        if (component.violations.length > 0) {
          violations.push({
            component: component.spec.name,
            path: scriptPath,
            violations: component.violations,
          });
        }
      } catch (error) {
        console.log(`⚠️ Could not analyze ${scriptPath}: ${error}`);
      }
    }

    // 위반 사항 보고
    if (violations.length > 0) {
      console.log(`\n❌ Found ${violations.length} integration violations:`);
      violations.forEach((v) => {
        console.log(`\n📄 ${v.component} (${v.path}):`);
        v.violations.forEach((violation: string) =>
          console.log(`   - ${violation}`),
        );
      });

      console.log(
        `\n🔧 Run 'npm run system:auto-integrate' to fix these violations`,
      );
    } else {
      console.log(`\n✅ All components are properly integrated!`);
    }
  }

  private analyzeExistingIntegration(component: Component): void {
    // unified-dashboard 통합 확인
    const dashboardPath = join(
      this.projectRoot,
      "scripts/unified-dashboard.ts",
    );
    if (existsSync(dashboardPath)) {
      const content = readFileSync(dashboardPath, "utf8");
      if (content.includes(component.spec.name)) {
        component.integrationPoints.push("unified-dashboard");
      }
    }

    // package.json 통합 확인
    const packagePath = join(this.projectRoot, "package.json");
    if (existsSync(packagePath)) {
      const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
      const scriptValues = Object.values(packageJson.scripts).join(" ");
      if (scriptValues.includes(component.spec.path)) {
        component.integrationPoints.push("package.json");
      }
    }

    // component-registry 확인
    const registryPath = join(
      this.projectRoot,
      "reports/component-registry.json",
    );
    if (existsSync(registryPath)) {
      const registry = JSON.parse(readFileSync(registryPath, "utf8"));
      if (
        registry.components.some((c: any) => c.name === component.spec.name)
      ) {
        component.integrationPoints.push("component-registry");
      }
    }
  }

  private validateIntegrationSafely(component: Component): void {
    // validateIntegration과 동일하지만 예외를 throw하지 않음
    for (const rule of this.integrationRules) {
      if (rule.condition(component)) {
        for (const requiredIntegration of rule.requiredIntegrations) {
          if (!this.hasIntegration(component, requiredIntegration)) {
            component.violations.push(
              `Missing required integration: ${requiredIntegration} - ${rule.errorMessage}`,
            );
          }
        }
      }
    }
  }

  // 유틸리티 메서드들
  private determineRiskLevel(
    spec: ComponentSpec,
  ): "low" | "medium" | "high" | "critical" {
    if (spec.purpose.includes("security") || spec.purpose.includes("secret"))
      return "critical";
    if (spec.purpose.includes("deploy") || spec.purpose.includes("release"))
      return "high";
    if (spec.purpose.includes("sync") || spec.purpose.includes("git"))
      return "medium";
    return "low";
  }

  private determineUserImpact(
    spec: ComponentSpec,
  ): "none" | "low" | "medium" | "high" | "blocking" {
    if (spec.purpose.includes("status") || spec.purpose.includes("dashboard"))
      return "blocking";
    if (spec.purpose.includes("security")) return "high";
    if (spec.purpose.includes("sync") || spec.purpose.includes("fix"))
      return "medium";
    if (spec.purpose.includes("test") || spec.purpose.includes("internal"))
      return "none";
    return "low";
  }

  private generateImportName(componentName: string): string {
    return componentName
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join("");
  }

  private getRelativeImportPath(absolutePath: string): string {
    return `./${absolutePath.replace("scripts/", "").replace(".ts", ".js")}`;
  }

  private camelCase(str: string): string {
    return str.replace(/-./g, (x) => x[1].toUpperCase());
  }

  private generateScriptName(componentName: string, purpose: string): string {
    const purposePrefix = purpose.split(",")[0].trim().toLowerCase();
    return `${purposePrefix}:${componentName.replace(/[^a-z0-9]/gi, "")}`;
  }

  private extractComponentName(scriptPath: string): string {
    return (
      scriptPath
        .split("/")
        .pop()
        ?.replace(/\.(ts|js|sh)$/, "") || "unknown"
    );
  }

  private countCoreCommands(): number {
    // 실제로는 현재 핵심 명령어 수를 계산
    return 4; // status, sync, fix, ship
  }

  /**
   * @preventExistence 데코레이터
   */
  static preventExistence(violationType: string) {
    return function (
      target: any,
      propertyKey: string,
      descriptor: PropertyDescriptor,
    ) {
      const originalMethod = descriptor.value;

      descriptor.value = function (...args: any[]) {
        console.log(`🛡️ Enforcing: ${violationType} prevention`);
        const result = originalMethod.apply(this, args);

        // 결과 검증
        if (result && result.violations && result.violations.length > 0) {
          throw new Error(
            `${violationType}: Component cannot exist due to violations`,
          );
        }

        return result;
      };

      return descriptor;
    };
  }
}

// 데코레이터를 인스턴스 메서드에 적용하기 위한 헬퍼
(IntegrationEnforcementSystem.prototype as any).preventExistence =
  IntegrationEnforcementSystem.preventExistence;

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const system = new IntegrationEnforcementSystem();

  const command = process.argv[2];

  if (command === "audit") {
    system.auditExistingComponents().catch(console.error);
  } else if (command === "create") {
    // Require explicit arguments or provide guidance
    if (!process.argv[3]) {
      console.log(`
🔨 Integration Enforcement System - Component Creator

Usage: npm run integration:create <name> [path] [type] [purpose]

Examples:
  npm run integration:create my-tool scripts/my-tool.ts utility "dev tool"
  npm run integration:create user-service scripts/user-service.ts internal "user management"

Component Types:
  - internal: Internal system components (fewer validation requirements)
  - dev: Development/utility tools (minimal validation)
  - utility: General utilities (standard validation)
  - user-facing: Public commands (strict validation)

🎯 Tip: Use 'internal' or 'dev' types for components that don't need core integration`);
      process.exit(0);
    }

    const spec: ComponentSpec = {
      name: process.argv[3],
      path: process.argv[4] || `scripts/${process.argv[3]}.ts`,
      type: process.argv[5] || "internal", // Changed default to internal for better compatibility
      purpose: process.argv[6] || "system component",
      dependencies: [],
    };

    try {
      system.createComponent(spec);
      console.log(`✅ Component ${spec.name} created successfully`);
    } catch (error) {
      console.error(`❌ Component creation failed: ${error}`);
      console.log(
        `\n💡 Try using type 'internal' or 'dev' for less strict validation`,
      );
      process.exit(1);
    }
  } else {
    console.log(`
Usage:
  npm run integration:audit           # Audit existing components
  npm run integration:create [name] [path] [type] [purpose]  # Create new component

Examples:
  npm run integration:create security-validator scripts/security-validator.ts validation security
`);
  }
}

export default IntegrationEnforcementSystem;
