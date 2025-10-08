#!/usr/bin/env tsx
/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Refactor Advisor - 패턴 학습 기반 리팩토링 제안 시스템
 * 최근 오류 패턴과 수정 이력을 학습하여 코파일럿 기능 제공
 */

import { promises as fs } from "fs";
import { join } from "path";
import { glob } from "glob";

interface ErrorPattern {
  errorCode: string;
  errorType: string;
  filePattern: string;
  frequency: number;
  lastSeen: string;
  commonFixes: string[];
  successRate: number;
}

interface RefactorSuggestion {
  id: string;
  title: string;
  description: string;
  confidence: number;
  effort: "LOW" | "MEDIUM" | "HIGH";
  impact: "LOW" | "MEDIUM" | "HIGH";
  category: string;
  files: string[];
  codeExample?: string;
  reasoning: string;
}

interface LearningData {
  timestamp: string;
  patterns: ErrorPattern[];
  suggestions: RefactorSuggestion[];
  projectStats: {
    totalErrors: number;
    fixedErrors: number;
    commonErrorTypes: Record<string, number>;
    improveableFiles: string[];
  };
}

class RefactorAdvisor {
  private projectRoot: string;
  private learningDataPath: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.learningDataPath = join(projectRoot, "reports/refactor-learning.json");
  }

  async learnFromHistory(): Promise<void> {
    console.log("🧠 Learning from error patterns and fix history...");

    // 1. 기존 리포트들에서 패턴 학습
    const patterns = await this.analyzeErrorPatterns();

    // 2. 코드베이스 분석으로 리팩토링 기회 발견
    const suggestions = await this.generateSmartSuggestions(patterns);

    // 3. 학습 데이터 저장
    const learningData: LearningData = {
      timestamp: new Date().toISOString(),
      patterns,
      suggestions,
      projectStats: await this.calculateProjectStats(),
    };

    await fs.writeFile(
      this.learningDataPath,
      JSON.stringify(learningData, null, 2),
    );

    console.log(`✅ Learned ${patterns.length} error patterns`);
    console.log(`💡 Generated ${suggestions.length} smart suggestions`);
    console.log(`📊 Updated project statistics`);
  }

  async provideSuggestions(): Promise<RefactorSuggestion[]> {
    try {
      const learningData = JSON.parse(
        await fs.readFile(this.learningDataPath, "utf-8"),
      ) as LearningData;

      // 신선도 체크 (1일 이상 오래되면 재학습 권장)
      const dataAge = Date.now() - new Date(learningData.timestamp).getTime();
      const daysSinceUpdate = Math.floor(dataAge / (1000 * 60 * 60 * 24));

      if (daysSinceUpdate > 1) {
        console.log(
          `⚠️  Learning data is ${daysSinceUpdate} days old. Consider running npm run advisor:learn`,
        );
      }

      return learningData.suggestions
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 10); // 상위 10개 제안
    } catch (error) {
      console.log(
        "📚 No learning data found. Run npm run advisor:learn first.",
      );
      return [];
    }
  }

  private async analyzeErrorPatterns(): Promise<ErrorPattern[]> {
    const patterns = new Map<string, ErrorPattern>();

    // TypeScript 체크 리포트들 분석
    const reportFiles = [
      "reports/ts-compile-report.json",
      "reports/ai-fix-report.json",
      "reports/doc-audit-report.json",
    ];

    for (const reportFile of reportFiles) {
      try {
        const reportPath = join(this.projectRoot, reportFile);
        const report = JSON.parse(await fs.readFile(reportPath, "utf-8"));

        if (report.errors) {
          this.extractPatternsFromErrors(report.errors, patterns);
        }

        if (report.attempts) {
          this.extractPatternsFromFixAttempts(report.attempts, patterns);
        }
      } catch (error) {
        // 리포트 파일이 없으면 스킵
        continue;
      }
    }

    return Array.from(patterns.values()).sort(
      (a, b) => b.frequency - a.frequency,
    );
  }

  private extractPatternsFromErrors(
    errors: any[],
    patterns: Map<string, ErrorPattern>,
  ): void {
    for (const error of errors) {
      const key = `${error.code}-${this.getFilePattern(error.file)}`;

      if (patterns.has(key)) {
        const pattern = patterns.get(key)!;
        pattern.frequency++;
        pattern.lastSeen = new Date().toISOString();
      } else {
        patterns.set(key, {
          errorCode: error.code,
          errorType: this.categorizeErrorType(error.code),
          filePattern: this.getFilePattern(error.file),
          frequency: 1,
          lastSeen: new Date().toISOString(),
          commonFixes: [],
          successRate: 0,
        });
      }
    }
  }

  private extractPatternsFromFixAttempts(
    attempts: any[],
    patterns: Map<string, ErrorPattern>,
  ): void {
    for (const attempt of attempts) {
      const key = `${attempt.errorCode}-${this.getFilePattern(attempt.file)}`;

      if (patterns.has(key)) {
        const pattern = patterns.get(key)!;

        if (attempt.success) {
          pattern.commonFixes.push(attempt.fixApplied);
          pattern.successRate = (pattern.successRate + attempt.confidence) / 2;
        }
      }
    }
  }

  private categorizeErrorType(errorCode: string): string {
    if (["TS2345", "TS2339", "TS2304"].includes(errorCode))
      return "type-system";
    if (["TS1002", "TS1005", "TS1109"].includes(errorCode)) return "syntax";
    if (errorCode === "TS2307") return "imports";
    return "other";
  }

  private getFilePattern(filePath: string): string {
    if (filePath.includes("/agents/")) return "agents";
    if (filePath.includes("/shared/")) return "shared";
    if (filePath.includes("/core/")) return "core";
    if (filePath.includes("/scripts/")) return "scripts";
    if (filePath.includes("/docs/")) return "docs";
    return "other";
  }

  private async generateSmartSuggestions(
    patterns: ErrorPattern[],
  ): Promise<RefactorSuggestion[]> {
    const suggestions: RefactorSuggestion[] = [];

    // 1. 가장 빈번한 오류 패턴 기반 제안
    const topPatterns = patterns.slice(0, 5);
    for (const pattern of topPatterns) {
      const suggestion = this.createPatternBasedSuggestion(pattern);
      if (suggestion) suggestions.push(suggestion);
    }

    // 2. 코드베이스 분석 기반 제안
    const codeAnalysisSuggestions = await this.analyzeCodebaseForImprovements();
    suggestions.push(...codeAnalysisSuggestions);

    // 3. 프로젝트 구조 개선 제안
    const structureSuggestions = await this.suggestStructuralImprovements();
    suggestions.push(...structureSuggestions);

    return suggestions.slice(0, 15); // 상위 15개 제안
  }

  private createPatternBasedSuggestion(
    pattern: ErrorPattern,
  ): RefactorSuggestion | null {
    const baseId = `pattern-${pattern.errorCode}-${pattern.filePattern}`;

    switch (pattern.errorType) {
      case "type-system":
        return {
          id: baseId,
          title: `개선 Type Safety in ${pattern.filePattern} files`,
          description: `${pattern.frequency}개의 ${pattern.errorCode} 오류가 반복적으로 발생하고 있습니다. 인터페이스 정의를 개선하거나 타입 가드를 추가하는 것을 고려해보세요.`,
          confidence: Math.min(pattern.frequency * 0.1, 0.9),
          effort: pattern.frequency > 5 ? "HIGH" : "MEDIUM",
          impact: "HIGH",
          category: "Type Safety",
          files: [pattern.filePattern],
          codeExample: this.generateTypeFixExample(pattern),
          reasoning: `패턴 분석: ${pattern.frequency}회 발생, 성공률 ${(
            pattern.successRate * 100
          ).toFixed(1)}%`,
        };

      case "imports":
        return {
          id: baseId,
          title: `Import 구조 정리 in ${pattern.filePattern}`,
          description: `Import 관련 오류가 ${pattern.frequency}회 발생했습니다. 모듈 구조를 재검토하거나 배럴 익스포트 패턴을 도입해보세요.`,
          confidence: 0.8,
          effort: "MEDIUM",
          impact: "MEDIUM",
          category: "Module Structure",
          files: [pattern.filePattern],
          reasoning: `Import 오류 반복 패턴 감지`,
        };

      default:
        return null;
    }
  }

  private async analyzeCodebaseForImprovements(): Promise<
    RefactorSuggestion[]
  > {
    const suggestions: RefactorSuggestion[] = [];

    // 1. 중복 코드 패턴 감지
    const duplicatePatterns = await this.findDuplicatePatterns();
    if (duplicatePatterns.length > 0) {
      suggestions.push({
        id: "duplicate-code-refactor",
        title: "중복 코드 리팩토링 기회",
        description: `${duplicatePatterns.length}개의 중복 코드 패턴을 발견했습니다. 공통 유틸리티 함수나 베이스 클래스로 추출을 고려해보세요.`,
        confidence: 0.7,
        effort: "HIGH",
        impact: "HIGH",
        category: "Code Reuse",
        files: duplicatePatterns,
        reasoning: "중복 코드 패턴 자동 감지",
      });
    }

    // 2. 복잡한 함수 식별
    const complexFiles = await this.findComplexFunctions();
    if (complexFiles.length > 0) {
      suggestions.push({
        id: "function-complexity-reduction",
        title: "함수 복잡도 감소",
        description: `복잡한 함수들이 발견되었습니다. 작은 함수로 분해하거나 책임을 분리하는 것을 고려해보세요.`,
        confidence: 0.6,
        effort: "MEDIUM",
        impact: "MEDIUM",
        category: "Code Clarity",
        files: complexFiles.slice(0, 5),
        reasoning: "함수 복잡도 분석 기반",
      });
    }

    return suggestions;
  }

  private async suggestStructuralImprovements(): Promise<RefactorSuggestion[]> {
    const suggestions: RefactorSuggestion[] = [];

    // 파일 구조 분석
    const tsFiles = await glob("src/**/*.ts", { cwd: this.projectRoot });

    // 너무 많은 export가 있는 파일 찾기
    for (const file of tsFiles.slice(0, 10)) {
      // 샘플링
      try {
        const content = await fs.readFile(
          join(this.projectRoot, file),
          "utf-8",
        );
        const exportCount = (content.match(/^export /gm) || []).length;

        if (exportCount > 10) {
          suggestions.push({
            id: `barrel-export-${file.replace(/[^a-zA-Z0-9]/g, "-")}`,
            title: `${file} 모듈 분리 고려`,
            description: `이 파일에서 ${exportCount}개의 export를 발견했습니다. 여러 모듈로 분리하거나 배럴 패턴 적용을 고려해보세요.`,
            confidence: 0.5,
            effort: "HIGH",
            impact: "MEDIUM",
            category: "Module Structure",
            files: [file],
            reasoning: `높은 export 수 (${exportCount}개)`,
          });
        }
      } catch (error) {
        continue;
      }
    }

    return suggestions;
  }

  private generateTypeFixExample(pattern: ErrorPattern): string {
    switch (pattern.errorCode) {
      case "TS2345":
        return `// Before: Type mismatch
const context = {};

// After: Proper typing
const context: DocSyncContext = {
  projectRoot: process.cwd(),
  projectScope: 'default',
  // ... other required properties
};`;

      case "TS2339":
        return `// Before: Property access error
obj.config.setting = true;

// After: Safe property access
obj.config?.setting = true;
// or
if (obj.config) {
  obj.config.setting = true;
}`;

      default:
        return "// 구체적인 예시를 위해 코드를 분석해보세요.";
    }
  }

  private async findDuplicatePatterns(): Promise<string[]> {
    // 간단한 휴리스틱: 비슷한 함수명이나 클래스명을 가진 파일들 찾기
    const tsFiles = await glob("src/**/*.ts", { cwd: this.projectRoot });
    const duplicateFiles: string[] = [];

    // 실제로는 더 정교한 AST 분석이 필요하지만, 여기서는 간단한 패턴으로
    const functionPatterns = new Map<string, string[]>();

    for (const file of tsFiles.slice(0, 20)) {
      try {
        const content = await fs.readFile(
          join(this.projectRoot, file),
          "utf-8",
        );
        const functions =
          content.match(/function\s+(\w+)|const\s+(\w+)\s*=/g) || [];

        for (const func of functions) {
          const name = func.match(/\w+/g)?.[1] || "";
          if (name && name.length > 3) {
            if (!functionPatterns.has(name)) functionPatterns.set(name, []);
            functionPatterns.get(name)!.push(file);
          }
        }
      } catch (error) {
        continue;
      }
    }

    // 같은 이름의 함수가 여러 파일에 있는 경우
    for (const [name, files] of functionPatterns.entries()) {
      if (files.length > 1) {
        duplicateFiles.push(...files);
      }
    }

    return Array.from(new Set(duplicateFiles));
  }

  private async findComplexFunctions(): Promise<string[]> {
    const complexFiles: string[] = [];
    const tsFiles = await glob("src/**/*.ts", { cwd: this.projectRoot });

    for (const file of tsFiles.slice(0, 20)) {
      try {
        const content = await fs.readFile(
          join(this.projectRoot, file),
          "utf-8",
        );

        // 간단한 복잡도 측정: 긴 함수나 많은 조건문
        const lines = content.split("\n");
        let inFunction = false;
        let functionLength = 0;
        let conditionCount = 0;

        for (const line of lines) {
          if (
            line.includes("function") ||
            line.includes("=>") ||
            line.includes("async")
          ) {
            inFunction = true;
            functionLength = 0;
            conditionCount = 0;
          }

          if (inFunction) {
            functionLength++;
            if (
              line.includes("if") ||
              line.includes("switch") ||
              line.includes("for") ||
              line.includes("while")
            ) {
              conditionCount++;
            }

            if (
              line.includes("}") &&
              (functionLength > 50 || conditionCount > 5)
            ) {
              complexFiles.push(file);
              break;
            }
          }
        }
      } catch (error) {
        continue;
      }
    }

    return Array.from(new Set(complexFiles));
  }

  private async calculateProjectStats(): Promise<LearningData["projectStats"]> {
    const stats = {
      totalErrors: 0,
      fixedErrors: 0,
      commonErrorTypes: {} as Record<string, number>,
      improveableFiles: [] as string[],
    };

    // AI Fix 리포트에서 통계 수집
    try {
      const fixReport = JSON.parse(
        await fs.readFile(
          join(this.projectRoot, "reports/ai-fix-report.json"),
          "utf-8",
        ),
      );

      stats.totalErrors = fixReport.totalErrors || 0;
      stats.fixedErrors = fixReport.successfulFixes || 0;

      if (fixReport.attempts) {
        for (const attempt of fixReport.attempts) {
          const errorType = this.categorizeErrorType(attempt.errorCode);
          stats.commonErrorTypes[errorType] =
            (stats.commonErrorTypes[errorType] || 0) + 1;

          if (!attempt.success) {
            stats.improveableFiles.push(attempt.file);
          }
        }
      }

      stats.improveableFiles = Array.from(new Set(stats.improveableFiles));
    } catch (error) {
      // 리포트가 없으면 빈 통계
    }

    return stats;
  }

  async generateReport(): Promise<void> {
    const suggestions = await this.provideSuggestions();

    console.log("\n🧠 Refactor Advisor Report");
    console.log("==========================");

    if (suggestions.length === 0) {
      console.log(
        "📚 No suggestions available. Run npm run advisor:learn first.",
      );
      return;
    }

    console.log(`💡 ${suggestions.length} smart suggestions available\n`);

    // 카테고리별로 그룹화
    const byCategory = suggestions.reduce(
      (acc, suggestion) => {
        if (!acc[suggestion.category]) acc[suggestion.category] = [];
        acc[suggestion.category].push(suggestion);
        return acc;
      },
      {} as Record<string, RefactorSuggestion[]>,
    );

    for (const [category, categorySuggestions] of Object.entries(byCategory)) {
      console.log(`📂 ${category}:`);

      for (const suggestion of categorySuggestions.slice(0, 3)) {
        const confidenceBar = "█".repeat(
          Math.floor(suggestion.confidence * 10),
        );
        console.log(
          `   ${
            suggestion.confidence >= 0.7
              ? "🎯"
              : suggestion.confidence >= 0.5
              ? "💡"
              : "🤔"
          } ${suggestion.title}`,
        );
        console.log(
          `      Confidence: ${confidenceBar} ${(
            suggestion.confidence * 100
          ).toFixed(0)}%`,
        );
        console.log(
          `      Effort: ${suggestion.effort}, Impact: ${suggestion.impact}`,
        );
        console.log(`      ${suggestion.description}`);
        console.log("");
      }
    }

    // 상위 3개 추천
    console.log("🎯 Top Recommendations:");
    const topSuggestions = suggestions.slice(0, 3);
    for (let i = 0; i < topSuggestions.length; i++) {
      const suggestion = topSuggestions[i];
      console.log(
        `   ${i + 1}. ${suggestion.title} (${(
          suggestion.confidence * 100
        ).toFixed(0)}% confidence)`,
      );
      if (suggestion.codeExample) {
        console.log("      Example:");
        console.log(
          suggestion.codeExample
            .split("\n")
            .map((line) => `      ${line}`)
            .join("\n"),
        );
      }
    }

    console.log("\n📊 For detailed analysis: reports/refactor-learning.json");
  }
}

// CLI 실행
async function main() {
  const projectRoot = process.cwd();
  const advisor = new RefactorAdvisor(projectRoot);

  const command = process.argv[2];

  switch (command) {
    case "learn":
      await advisor.learnFromHistory();
      break;

    case "suggest":
    case undefined:
      await advisor.generateReport();
      break;

    default:
      console.log(`
Usage: tsx scripts/refactor-advisor.ts [command]

Commands:
  learn     - Learn from error patterns and fix history
  suggest   - Provide smart refactoring suggestions (default)

Examples:
  npm run advisor:learn
  npm run advisor:suggest
      `);
  }
}

// ES module main check
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { RefactorAdvisor };
