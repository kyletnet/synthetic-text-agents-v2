#!/usr/bin/env tsx

/**
 * Quick Check - 선택적 체크 기능
 * 개발 중에 특정 부분만 빠르게 체크할 수 있는 도구
 */

import { execSync } from "child_process";
import { DesignPrincipleMapper } from "./lib/design-principle-mapper.js";

interface CheckResult {
  name: string;
  duration: number;
  success: boolean;
  issues: string[];
  warnings: string[];
  designPrinciples?: any[];
}

export class QuickCheck {
  private designPrincipleMapper: DesignPrincipleMapper;

  constructor() {
    this.designPrincipleMapper = new DesignPrincipleMapper();
  }

  /**
   * TypeScript 컴파일 체크만 실행 (30초)
   */
  async checkTypeScript(): Promise<CheckResult> {
    console.log("🔍 Quick TypeScript Check...");
    const startTime = Date.now();
    const issues: string[] = [];
    const warnings: string[] = [];

    try {
      // TypeScript 컴파일 실행
      const result = execSync("npx tsc --noEmit --pretty false", {
        encoding: "utf8",
        stdio: "pipe",
      });

      return {
        name: "TypeScript Compilation",
        duration: Date.now() - startTime,
        success: true,
        issues,
        warnings,
        designPrinciples: [],
      };
    } catch (error: any) {
      const output = error.stdout || error.stderr || "";
      const errorLines = output
        .split("\n")
        .filter(
          (line: string) => line.includes("error TS") && line.trim().length > 0,
        );

      errorLines.forEach((line: string) => {
        issues.push(line.trim());
      });

      // 설계 원칙 매핑
      const mockIssue = {
        category: "TypeScript Compilation",
        title: `${errorLines.length} TypeScript Compilation Errors`,
        description: `발견된 컴파일 오류: ${errorLines.length}개`,
        severity: "P0",
        impact: "시스템이 컴파일되지 않아 실행 불가능",
      };

      const designPrinciple =
        this.designPrincipleMapper.enhanceIssueWithDesignPrinciple(mockIssue);

      return {
        name: "TypeScript Compilation",
        duration: Date.now() - startTime,
        success: false,
        issues,
        warnings,
        designPrinciples: [designPrinciple],
      };
    }
  }

  /**
   * 메서드 시그니처 체크만 실행 (15초)
   */
  async checkMethodSignatures(): Promise<CheckResult> {
    console.log("🔍 Quick Method Signatures Check...");
    const startTime = Date.now();
    const issues: string[] = [];
    const warnings: string[] = [];

    try {
      // 간단한 grep 기반 체크
      const requestApprovalCheck = execSync(
        'find scripts -name "*.ts" -exec grep -l "requestApproval(" {} \\; | head -10',
        { encoding: "utf8" },
      );

      const files = requestApprovalCheck.split("\n").filter((f) => f.trim());

      for (const file of files) {
        try {
          const content = require("fs").readFileSync(file, "utf8");

          // 구식 2-파라미터 패턴 검사
          const oldPatternMatches = content.match(
            /requestApproval\s*\([^{,)]+,\s*[^{)]+\)/g,
          );
          if (oldPatternMatches && !content.includes("requestApproval({")) {
            issues.push(`${file}: 구식 requestApproval 시그니처 사용`);
          }

          // listSnapshots vs getSnapshots
          if (
            content.includes("listSnapshots(") &&
            !content.includes("getSnapshots(")
          ) {
            issues.push(`${file}: listSnapshots() 메서드가 존재하지 않음`);
          }
        } catch {
          // 파일 읽기 실패는 무시
        }
      }

      const designPrinciples = [];
      if (issues.length > 0) {
        const mockIssue = {
          category: "Method Signatures",
          title: `${issues.length} Method Signature Issues`,
          description: `발견된 시그니처 불일치: ${issues.length}개`,
          severity: "P1",
          impact: "런타임 오류 및 메서드 호출 실패",
        };
        designPrinciples.push(
          this.designPrincipleMapper.enhanceIssueWithDesignPrinciple(mockIssue),
        );
      }

      return {
        name: "Method Signatures",
        duration: Date.now() - startTime,
        success: issues.length === 0,
        issues,
        warnings,
        designPrinciples,
      };
    } catch (error) {
      issues.push(`Method signature check failed: ${error}`);

      return {
        name: "Method Signatures",
        duration: Date.now() - startTime,
        success: false,
        issues,
        warnings,
        designPrinciples: [],
      };
    }
  }

  /**
   * P0 이슈만 체크 (1분)
   */
  async checkP0Only(): Promise<CheckResult> {
    console.log("🔍 Quick P0 Critical Issues Check...");
    const startTime = Date.now();
    const issues: string[] = [];
    const warnings: string[] = [];
    const designPrinciples: any[] = [];

    // P0: TypeScript 컴파일 체크
    const tsResult = await this.checkTypeScript();
    if (!tsResult.success) {
      issues.push(...tsResult.issues);
      designPrinciples.push(...(tsResult.designPrinciples || []));
    }

    // P0: 중요 설정 파일 존재성 체크
    const criticalFiles = ["package.json", "tsconfig.json", ".gitignore"];

    criticalFiles.forEach((file) => {
      try {
        require("fs").accessSync(file);
      } catch {
        issues.push(`Critical file missing: ${file}`);
      }
    });

    // P0: 기본 스크립트 동작성 체크
    try {
      execSync("npm run dev:typecheck --dry-run", { stdio: "pipe" });
    } catch {
      warnings.push("dev:typecheck script may have issues");
    }

    if (issues.length === 0 && warnings.length === 0) {
      console.log("✅ All P0 checks passed");
    }

    return {
      name: "P0 Critical Issues",
      duration: Date.now() - startTime,
      success: issues.length === 0,
      issues,
      warnings,
      designPrinciples,
    };
  }

  /**
   * Node.js 호환성 체크 (20초)
   */
  async checkNodeCompatibility(): Promise<CheckResult> {
    console.log("🔍 Quick Node.js Compatibility Check...");
    const startTime = Date.now();
    const issues: string[] = [];
    const warnings: string[] = [];

    try {
      // ESM/CommonJS 혼재 사용 검사
      const result = execSync(
        'find scripts -name "*.ts" -exec grep -l "import.*from" {} \\; | head -5',
        { encoding: "utf8" },
      );

      const files = result.split("\n").filter((f) => f.trim());

      for (const file of files) {
        try {
          const content = require("fs").readFileSync(file, "utf8");

          const hasESMImports = /^import\s+.*from\s+['"].+['"];?\s*$/m.test(
            content,
          );
          const hasCommonJSRequire = /require\s*\(\s*['"].+['"]\s*\)/.test(
            content,
          );

          if (hasESMImports && hasCommonJSRequire) {
            issues.push(`${file}: ESM과 CommonJS 혼재 사용`);
          }

          // 글로벌 변수 잘못된 사용 패턴
          if (content.includes("fs.watch(") && content.includes("**/*.ts")) {
            issues.push(`${file}: 파일 감시에서 glob 패턴 잘못 사용`);
          }
        } catch {
          // 파일 읽기 실패는 무시
        }
      }

      const designPrinciples = [];
      if (issues.length > 0) {
        const mockIssue = {
          category: "Node.js Compatibility",
          title: `${issues.length} Node.js Compatibility Issues`,
          description: `발견된 호환성 문제: ${issues.length}개`,
          severity: "P2",
          impact: "런타임 오류 및 불안정한 동작",
        };
        designPrinciples.push(
          this.designPrincipleMapper.enhanceIssueWithDesignPrinciple(mockIssue),
        );
      }

      return {
        name: "Node.js Compatibility",
        duration: Date.now() - startTime,
        success: issues.length === 0,
        issues,
        warnings,
        designPrinciples,
      };
    } catch (error) {
      issues.push(`Node.js compatibility check failed: ${error}`);

      return {
        name: "Node.js Compatibility",
        duration: Date.now() - startTime,
        success: false,
        issues,
        warnings,
        designPrinciples: [],
      };
    }
  }

  /**
   * 결과 출력
   */
  private displayResults(results: CheckResult[]): void {
    console.log("\\n" + "═".repeat(60));
    console.log("🚀 Quick Check Results");
    console.log("═".repeat(60));

    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
    const successCount = results.filter((r) => r.success).length;

    console.log(
      `\\n📊 Summary: ${successCount}/${
        results.length
      } checks passed in ${Math.round(totalDuration / 1000)}s`,
    );

    results.forEach((result) => {
      const icon = result.success ? "✅" : "❌";
      const duration = Math.round(result.duration / 1000);

      console.log(`\\n${icon} ${result.name} (${duration}s)`);

      if (result.issues.length > 0) {
        console.log("   Issues:");
        result.issues.slice(0, 3).forEach((issue) => {
          console.log(`   • ${issue.slice(0, 80)}...`);
        });

        if (result.issues.length > 3) {
          console.log(`   • ... and ${result.issues.length - 3} more`);
        }
      }

      if (result.warnings.length > 0) {
        console.log("   Warnings:");
        result.warnings.slice(0, 2).forEach((warning) => {
          console.log(`   ⚠️ ${warning}`);
        });
      }

      // 설계 원칙 위반 표시
      if (result.designPrinciples && result.designPrinciples.length > 0) {
        result.designPrinciples.forEach((dp) => {
          if (dp.designPrinciple) {
            console.log(
              `   🎯 Violates: ${dp.designPrinciple.id} - ${dp.designPrinciple.name}`,
            );
            console.log(
              `      Impact: ${dp.designPrinciple.architecturalImpact}`,
            );
          }
        });
      }
    });

    console.log("\\n" + "═".repeat(60));
  }

  /**
   * CLI 명령어 처리
   */
  async runCommand(command: string): Promise<void> {
    const results: CheckResult[] = [];

    switch (command) {
      case "typescript":
        results.push(await this.checkTypeScript());
        break;

      case "signatures":
        results.push(await this.checkMethodSignatures());
        break;

      case "P0-only":
      case "p0":
        results.push(await this.checkP0Only());
        break;

      case "node":
      case "compatibility":
        results.push(await this.checkNodeCompatibility());
        break;

      case "quick":
        // 가장 중요한 체크들만
        results.push(await this.checkTypeScript());
        results.push(await this.checkP0Only());
        break;

      case "all":
        results.push(await this.checkTypeScript());
        results.push(await this.checkMethodSignatures());
        results.push(await this.checkNodeCompatibility());
        results.push(await this.checkP0Only());
        break;

      default:
        console.log(
          "❌ Unknown command. Available: typescript, signatures, P0-only, node, quick, all",
        );
        return;
    }

    this.displayResults(results);

    // 실패한 체크가 있으면 exit code 1
    const hasFailures = results.some((r) => !r.success);
    if (hasFailures) {
      process.exit(1);
    }
  }
}

// CLI 실행
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2] || "quick";
  const quickCheck = new QuickCheck();

  quickCheck.runCommand(command).catch((error) => {
    console.error("❌ Quick check failed:", error);
    process.exit(1);
  });
}
