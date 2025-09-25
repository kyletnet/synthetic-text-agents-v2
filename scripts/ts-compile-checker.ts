#!/usr/bin/env tsx
/**
 * TypeScript Compilation Integrity Checker
 * 컴파일 오류를 P0 우선순위로 분류하고 리팩토링 시스템과 연동
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import { join } from 'path';

const execAsync = promisify(exec);

interface TSError {
  file: string;
  line: number;
  column: number;
  code: string;
  message: string;
  severity: 'error' | 'warning';
}

interface CompileReport {
  timestamp: string;
  overall: 'PASS' | 'FAIL';
  summary: {
    totalErrors: number;
    criticalErrors: number;
    warningCount: number;
    filesWithErrors: number;
  };
  errors: TSError[];
  recommendations: string[];
}

class TypeScriptCompileChecker {
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  async checkCompilation(): Promise<CompileReport> {
    console.log('🔧 Running TypeScript Compilation Check...');

    try {
      const { stdout, stderr } = await execAsync('npm run typecheck', {
        cwd: this.projectRoot
      });

      // stdout에 오류가 있을 수도 있음
      const combinedOutput = (stdout || '') + (stderr || '');
      const errors = this.parseTypeScriptErrors(combinedOutput);

      if (errors.length === 0) {
        // 진짜 성공
        return {
          timestamp: new Date().toISOString(),
          overall: 'PASS',
          summary: {
            totalErrors: 0,
            criticalErrors: 0,
            warningCount: 0,
            filesWithErrors: 0
          },
          errors: [],
          recommendations: ['✅ TypeScript compilation is clean']
        };
      } else {
        // stdout에서 오류 발견
        return this.createFailureReport(errors);
      }

    } catch (error: any) {
      // 컴파일 오류가 있는 경우 (exit code != 0)
      const errorOutput = (error.stdout || '') + (error.stderr || '');
      const errors = this.parseTypeScriptErrors(errorOutput);

      return this.createFailureReport(errors);
    }
  }

  private createFailureReport(errors: TSError[]): CompileReport {
    const criticalErrors = errors.filter(e => this.isCriticalError(e));
    const warnings = errors.filter(e => e.severity === 'warning');

    return {
      timestamp: new Date().toISOString(),
      overall: criticalErrors.length > 0 ? 'FAIL' : 'PASS',
      summary: {
        totalErrors: errors.length,
        criticalErrors: criticalErrors.length,
        warningCount: warnings.length,
        filesWithErrors: new Set(errors.map(e => e.file)).size
      },
      errors,
      recommendations: this.generateSmartRecommendations(errors)
    };
  }

  private parseTypeScriptErrors(output: string): TSError[] {
    const errors: TSError[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      // TypeScript 오류 패턴: file.ts(line,col): error TSxxxx: message
      const match = line.match(/^(.+\\.ts)\\((\\d+),(\\d+)\\):\\s+(error|warning)\\s+TS(\\d+):\\s*(.+)$/);

      if (match) {
        const [, file, lineStr, columnStr, severity, code, message] = match;

        errors.push({
          file: file.replace(this.projectRoot + '/', ''),
          line: parseInt(lineStr),
          column: parseInt(columnStr),
          code: `TS${code}`,
          message: message.trim(),
          severity: severity as 'error' | 'warning'
        });
      }
    }

    return errors;
  }

  private isCriticalError(error: TSError): boolean {
    // 빌드를 완전히 차단하는 Critical 오류들
    const criticalCodes = [
      'TS1002', // Unterminated string literal
      'TS1005', // ';' expected
      'TS1109', // Expression expected
      'TS1128', // Declaration or statement expected
      'TS1131', // Property or signature expected
      'TS2304', // Cannot find name
      'TS2307', // Cannot find module
      'TS2345', // Argument type not assignable
      'TS2353', // Unknown property in object literal
      'TS2339', // Property does not exist
    ];

    return criticalCodes.includes(error.code) ||
           error.message.includes('Cannot find') ||
           error.message.includes('does not exist') ||
           error.message.includes('Unterminated');
  }

  private generateSmartRecommendations(errors: TSError[]): string[] {
    const recommendations: string[] = [];

    // 🧠 스마트 리팩토링 추천 생성
    const errorGroups = this.groupErrorsByPattern(errors);

    for (const [pattern, patternErrors] of Object.entries(errorGroups)) {
      const refactorPrompt = this.generateRefactorPrompt(pattern, patternErrors);
      if (refactorPrompt) {
        recommendations.push(refactorPrompt);
      }
    }

    return recommendations;
  }

  private generateRecommendations(errors: TSError[]): string[] {
    const recommendations: string[] = [];

    // 파일별 오류 그룹화
    const errorsByFile = errors.reduce((acc, error) => {
      if (!acc[error.file]) acc[error.file] = [];
      acc[error.file].push(error);
      return acc;
    }, {} as Record<string, TSError[]>);

    // 가장 문제가 많은 파일들
    const problematicFiles = Object.entries(errorsByFile)
      .sort(([, a], [, b]) => b.length - a.length)
      .slice(0, 3);

    if (problematicFiles.length > 0) {
      recommendations.push('🎯 Priority Files to Fix:');
      problematicFiles.forEach(([file, fileErrors]) => {
        recommendations.push(`   - ${file}: ${fileErrors.length} errors`);
      });
    }

    // 공통 오류 패턴 분석
    const errorCounts = errors.reduce((acc, error) => {
      acc[error.code] = (acc[error.code] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topErrors = Object.entries(errorCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3);

    if (topErrors.length > 0) {
      recommendations.push('📊 Most Common Error Types:');
      topErrors.forEach(([code, count]) => {
        recommendations.push(`   - ${code}: ${count} occurrences`);

        // 구체적인 해결책 제공
        if (code === 'TS2345') {
          recommendations.push('     💡 Fix: Check argument types and interface compatibility');
        } else if (code === 'TS2339') {
          recommendations.push('     💡 Fix: Verify property names and interface definitions');
        } else if (code === 'TS2304') {
          recommendations.push('     💡 Fix: Add missing imports or check variable declarations');
        }
      });
    }

    // 즉시 수정 가능한 간단한 것들
    if (errors.some(e => e.code === 'TS1002')) {
      recommendations.push('🚨 Immediate: Fix unterminated string literals');
    }

    if (errors.some(e => e.code === 'TS1005')) {
      recommendations.push('🚨 Immediate: Add missing semicolons or fix syntax');
    }

    return recommendations;
  }

  private groupErrorsByPattern(errors: TSError[]): Record<string, TSError[]> {
    const groups: Record<string, TSError[]> = {};

    for (const error of errors) {
      let pattern = 'other';

      // 패턴별 분류
      if (error.code === 'TS2345' && error.message.includes('not assignable')) {
        pattern = 'type-mismatch';
      } else if (error.code === 'TS2339' && error.message.includes('does not exist')) {
        pattern = 'missing-property';
      } else if (error.code === 'TS2304' && error.message.includes('Cannot find name')) {
        pattern = 'missing-import';
      } else if (error.code === 'TS2353' && error.message.includes('unknown properties')) {
        pattern = 'extra-property';
      } else if (['TS1002', 'TS1005', 'TS1109'].includes(error.code)) {
        pattern = 'syntax-error';
      } else if (error.file.includes('pluginLoader')) {
        pattern = 'plugin-system';
      }

      if (!groups[pattern]) groups[pattern] = [];
      groups[pattern].push(error);
    }

    return groups;
  }

  private generateRefactorPrompt(pattern: string, errors: TSError[]): string | null {
    const firstError = errors[0];
    const affectedFiles = Array.from(new Set(errors.map(e => e.file)));

    switch (pattern) {
      case 'type-mismatch':
        return `🔧 REFACTOR: Fix type compatibility in ${affectedFiles.join(', ')}

   Problem: ${errors.length} type assignment errors
   Example: ${firstError.message}

   💡 Suggested Fix:
   \`\`\`typescript
   // Check interface compatibility between source and target types
   // Consider using type assertions or updating interface definitions
   // Look for missing required properties in object literals
   \`\`\`

   🎯 Action: Review and align interface definitions, ensure all required properties are provided`;

      case 'missing-property':
        return `🔧 REFACTOR: Add missing properties in ${affectedFiles.join(', ')}

   Problem: ${errors.length} undefined property access errors
   Example: ${firstError.message}

   💡 Suggested Fix:
   \`\`\`typescript
   // Option 1: Add missing property to interface
   interface YourInterface {
     existingProp: string;
     ${errors.map(e => {
           const prop = e.message.match(/'([^']+)'/)?.[1] || 'newProp';
           return `${prop}: any; // TODO: Define proper type`;
         }).join('\n     ')}
   }

   // Option 2: Use optional chaining
   obj.${errors[0].message.match(/'([^']+)'/)?.[1] || 'property'}?.someMethod();
   \`\`\`

   🎯 Action: Extend interfaces or use safe property access`;

      case 'missing-import':
        return `🔧 REFACTOR: Add missing imports in ${affectedFiles.join(', ')}

   Problem: ${errors.length} undefined identifier errors
   Example: ${firstError.message}

   💡 Suggested Fix:
   \`\`\`typescript
   ${errors.map(e => {
           const name = e.message.match(/Cannot find name '([^']+)'/)?.[1] || 'UnknownType';
           return `import { ${name} } from './appropriate-module';`;
         }).join('\n   ')}
   \`\`\`

   🎯 Action: Add missing imports or check variable declarations`;

      case 'plugin-system':
        return `🔧 REFACTOR: Fix plugin system integration in ${affectedFiles.join(', ')}

   Problem: ${errors.length} plugin-related type errors
   Example: ${firstError.message}

   💡 Suggested Fix:
   \`\`\`typescript
   // Update DocSyncContext with missing properties
   const context: DocSyncContext = {
     projectRoot: process.cwd(),
     projectScope: 'default',
     changedFiles: [],
     documentMap: {},
     environment: 'development',
     cache: new Map(),
     tempFiles: [],
     logger: console,
     traceId: 'trace-' + Date.now()
   };

   // Use correct DocPermission values
   const validPermissions: DocPermission[] = ['general-docs', 'core-system'];
   \`\`\`

   🎯 Action: Update plugin interfaces and provide required context properties`;

      case 'syntax-error':
        return `🚨 URGENT: Fix syntax errors in ${affectedFiles.join(', ')}

   Problem: ${errors.length} parsing/syntax errors blocking compilation
   Example: ${firstError.message}

   💡 Immediate Actions:
   - Check for unterminated strings, missing semicolons
   - Verify bracket matching and proper escape sequences
   - Look for malformed regular expressions

   🎯 Priority: Fix these immediately to unblock compilation`;

      default:
        return null;
    }
  }

  async generateReport(report: CompileReport): Promise<void> {
    console.log('\n🔧 TypeScript Compilation Report');
    console.log('================================');
    console.log(`📊 Overall: ${report.overall}`);
    console.log(`🔴 Critical Errors: ${report.summary.criticalErrors}`);
    console.log(`⚠️  Total Issues: ${report.summary.totalErrors}`);
    console.log(`📄 Files Affected: ${report.summary.filesWithErrors}`);

    if (report.summary.criticalErrors > 0) {
      console.log('\n🚨 CRITICAL COMPILATION ERRORS:');
      const criticalErrors = report.errors.filter(e => this.isCriticalError(e));

      criticalErrors.slice(0, 10).forEach(error => {
        console.log(`   🔴 ${error.file}:${error.line}:${error.column}`);
        console.log(`      ${error.code}: ${error.message}`);
      });

      if (criticalErrors.length > 10) {
        console.log(`   ... and ${criticalErrors.length - 10} more critical errors`);
      }
    }

    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      report.recommendations.forEach(rec => console.log(`   ${rec}`));
    }

    // 리포트 저장
    const reportPath = join(this.projectRoot, 'reports/ts-compile-report.json');
    await fs.mkdir(join(this.projectRoot, 'reports'), { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📋 Detailed report saved: ${reportPath}`);

    // 리팩토링 시스템 통합용 플래그
    if (report.summary.criticalErrors > 0) {
      await fs.writeFile(
        join(this.projectRoot, 'reports/.ts-compile-blocked'),
        JSON.stringify({
          blocked: true,
          criticalErrors: report.summary.criticalErrors,
          message: 'TypeScript compilation blocked due to critical errors'
        })
      );
    }
  }

  // 리팩토링 감사 시스템과의 통합
  async generateRefactorIssues(): Promise<any[]> {
    const report = await this.checkCompilation();

    if (report.summary.criticalErrors === 0) {
      return [];
    }

    const criticalErrors = report.errors.filter(e => this.isCriticalError(e));

    return [{
      id: 'ts-compilation-errors',
      title: 'TypeScript Compilation Errors',
      priority: 'P0',
      severity: 'CRITICAL',
      category: 'Build System',
      description: `${criticalErrors.length} critical TypeScript compilation errors blocking build`,
      impact: 'System cannot compile - blocks all development work',
      effort: 'HIGH',
      files: Array.from(new Set(criticalErrors.map(e => e.file))),
      details: {
        totalErrors: report.summary.totalErrors,
        criticalErrors: report.summary.criticalErrors,
        topErrors: criticalErrors.slice(0, 5).map(e => ({
          file: e.file,
          line: e.line,
          code: e.code,
          message: e.message
        }))
      },
      recommendations: report.recommendations
    }];
  }
}

// CLI 실행
async function main() {
  const projectRoot = process.cwd();
  const checker = new TypeScriptCompileChecker(projectRoot);

  const command = process.argv[2];

  switch (command) {
    case 'check':
    case undefined:
      const report = await checker.checkCompilation();
      await checker.generateReport(report);
      process.exit(report.overall === 'PASS' ? 0 : 1);
      break;

    case 'refactor-issues':
      const issues = await checker.generateRefactorIssues();
      console.log(JSON.stringify(issues, null, 2));
      break;

    default:
      console.log('Usage: tsx scripts/ts-compile-checker.ts [check|refactor-issues]');
  }
}

// ES module main check
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { TypeScriptCompileChecker };