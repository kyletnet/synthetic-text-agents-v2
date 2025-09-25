#!/usr/bin/env tsx
/**
 * AI Fix Engine - TypeScript 오류 자동 수정 시스템
 * ts:check 결과를 기반으로 실제 코드 수정을 시도
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { TypeScriptCompileChecker } from './ts-compile-checker.js';

interface FixAttempt {
  file: string;
  line: number;
  column: number;
  errorCode: string;
  errorMessage: string;
  fixApplied: string;
  success: boolean;
  confidence: number;
}

interface FixReport {
  timestamp: string;
  totalErrors: number;
  fixAttempts: number;
  successfulFixes: number;
  attempts: FixAttempt[];
  remainingErrors: number;
}

class AIFixEngine {
  private projectRoot: string;
  private tsChecker: TypeScriptCompileChecker;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.tsChecker = new TypeScriptCompileChecker(projectRoot);
  }

  async autoFix(filterType?: string): Promise<FixReport> {
    console.log('🤖 Starting AI-powered automatic fixes...');

    // 롤백 정보 저장을 위한 세션 ID 생성
    const sessionId = `fix-${Date.now()}`;
    await this.createFixSession(sessionId);

    // 1. 현재 TypeScript 오류 분석
    const compileReport = await this.tsChecker.checkCompilation();

    if (compileReport.summary.totalErrors === 0) {
      console.log('✅ No TypeScript errors found!');
      return {
        timestamp: new Date().toISOString(),
        totalErrors: 0,
        fixAttempts: 0,
        successfulFixes: 0,
        attempts: [],
        remainingErrors: 0
      };
    }

    console.log(`🔍 Found ${compileReport.summary.totalErrors} errors to fix`);

    // 2. 수정 가능한 오류들 필터링
    let errorsToFix = compileReport.errors;
    if (filterType) {
      errorsToFix = this.filterErrorsByType(compileReport.errors, filterType);
      console.log(`🎯 Filtering for '${filterType}': ${errorsToFix.length} errors selected`);
    }

    // 3. 파일별로 그룹화하여 수정 시도
    const fixAttempts: FixAttempt[] = [];
    const errorsByFile = this.groupErrorsByFile(errorsToFix);

    for (const [filePath, fileErrors] of Object.entries(errorsByFile)) {
      console.log(`🔧 Fixing ${fileErrors.length} errors in ${filePath}`);

      const fileFixAttempts = await this.fixErrorsInFile(filePath, fileErrors);
      fixAttempts.push(...fileFixAttempts);
    }

    // 4. 수정 후 재검증
    console.log('🔍 Re-checking after fixes...');
    const afterReport = await this.tsChecker.checkCompilation();

    const report: FixReport = {
      timestamp: new Date().toISOString(),
      totalErrors: compileReport.summary.totalErrors,
      fixAttempts: fixAttempts.length,
      successfulFixes: fixAttempts.filter(f => f.success).length,
      attempts: fixAttempts,
      remainingErrors: afterReport.summary.totalErrors
    };

    await this.generateFixReport(report);
    return report;
  }

  private filterErrorsByType(errors: any[], filterType: string): any[] {
    switch (filterType.toLowerCase()) {
      case 'typescript':
      case 'types':
        return errors.filter(e =>
          ['TS2345', 'TS2339', 'TS2304', 'TS2353'].includes(e.code)
        );

      case 'imports':
        return errors.filter(e =>
          e.code === 'TS2304' || e.message.includes('Cannot find')
        );

      case 'syntax':
        return errors.filter(e =>
          ['TS1002', 'TS1005', 'TS1109', 'TS1131'].includes(e.code)
        );

      case 'plugin':
      case 'plugins':
        return errors.filter(e => e.file.includes('plugin'));

      default:
        return errors;
    }
  }

  private groupErrorsByFile(errors: any[]): Record<string, any[]> {
    return errors.reduce((acc, error) => {
      if (!acc[error.file]) acc[error.file] = [];
      acc[error.file].push(error);
      return acc;
    }, {} as Record<string, any[]>);
  }

  private async fixErrorsInFile(filePath: string, errors: any[]): Promise<FixAttempt[]> {
    const attempts: FixAttempt[] = [];

    try {
      const fullPath = join(this.projectRoot, filePath);
      const originalContent = await fs.readFile(fullPath, 'utf-8');
      let modifiedContent = originalContent;
      let contentChanged = false;

      // 라인 번호 순서대로 정렬 (뒤에서부터 수정해야 라인 번호가 안 밀림)
      const sortedErrors = errors.sort((a, b) => b.line - a.line);

      for (const error of sortedErrors) {
        const fixResult = await this.attemptErrorFix(
          modifiedContent,
          error,
          filePath
        );

        attempts.push({
          file: filePath,
          line: error.line,
          column: error.column,
          errorCode: error.code,
          errorMessage: error.message,
          fixApplied: fixResult.fixDescription,
          success: fixResult.success,
          confidence: fixResult.confidence
        });

        if (fixResult.success && fixResult.newContent) {
          modifiedContent = fixResult.newContent;
          contentChanged = true;
          console.log(`   ✅ Fixed ${error.code} at line ${error.line}`);
        } else {
          console.log(`   ❌ Could not fix ${error.code} at line ${error.line}: ${fixResult.reason}`);
        }
      }

      // 수정사항이 있으면 파일 저장
      if (contentChanged) {
        // 롤백을 위한 백업 생성 (타임스탬프 포함)
        const backupPath = fullPath + `.backup.${Date.now()}`;
        await fs.writeFile(backupPath, originalContent);

        // 최신 백업 링크 업데이트
        const latestBackupPath = fullPath + '.backup.latest';
        await fs.writeFile(latestBackupPath, originalContent);

        // 파일 수정
        await fs.writeFile(fullPath, modifiedContent);
        console.log(`💾 Updated ${filePath} (backup: ${backupPath})`);

        // 롤백 세션에 추가
        await this.addToFixSession(filePath, backupPath, 'modified');
      }

    } catch (error) {
      console.error(`❌ Error processing ${filePath}:`, error);
    }

    return attempts;
  }

  private async attemptErrorFix(
    content: string,
    error: any,
    filePath: string
  ): Promise<{
    success: boolean;
    newContent?: string;
    fixDescription: string;
    confidence: number;
    reason?: string;
  }> {
    const lines = content.split('\n');
    const errorLine = lines[error.line - 1]; // 0-based index

    if (!errorLine) {
      return {
        success: false,
        fixDescription: 'Line not found',
        confidence: 0,
        reason: 'Invalid line number'
      };
    }

    // 오류 타입별 자동 수정 로직
    switch (error.code) {
      case 'TS2304': // Cannot find name
        return this.fixMissingName(content, error, lines);

      case 'TS2345': // Argument type not assignable
        return this.fixTypeAssignment(content, error, lines);

      case 'TS2339': // Property does not exist
        return this.fixMissingProperty(content, error, lines);

      case 'TS2353': // Unknown property in object literal
        return this.fixExtraProperty(content, error, lines);

      case 'TS1002': // Unterminated string literal
        return this.fixUnterminatedString(content, error, lines);

      case 'TS1005': // ';' expected
        return this.fixMissingSemicolon(content, error, lines);

      default:
        return {
          success: false,
          fixDescription: `No fix available for ${error.code}`,
          confidence: 0,
          reason: 'Unsupported error type'
        };
    }
  }

  private fixMissingName(content: string, error: any, lines: string[]): any {
    const missingName = error.message.match(/Cannot find name '([^']+)'/)?.[1];
    if (!missingName) {
      return { success: false, fixDescription: 'Could not extract missing name', confidence: 0 };
    }

    // 1. 일반적인 import 추가 시도
    const commonImports: Record<string, string> = {
      'fs': "import { promises as fs } from 'fs';",
      'path': "import { join, dirname } from 'path';",
      'glob': "import { glob } from 'glob';",
      'yaml': "import yaml from 'yaml';",
      'Logger': "import { Logger } from './logger.js';",
      'DocPlugin': "import { DocPlugin } from '../../plugins/types/DocPlugin.js';"
    };

    if (commonImports[missingName]) {
      // 파일 상단에 import 추가
      const importStatement = commonImports[missingName];
      const newContent = importStatement + '\n' + content;

      return {
        success: true,
        newContent,
        fixDescription: `Added import for ${missingName}`,
        confidence: 0.8
      };
    }

    // 2. 타입 정의 추가 (interface나 type이면)
    if (missingName.includes('Type') || missingName.includes('Interface')) {
      const lines = content.split('\n');
      const insertIndex = this.findInsertPositionForType(lines);

      lines.splice(insertIndex, 0, `type ${missingName} = any; // TODO: Define proper type`);

      return {
        success: true,
        newContent: lines.join('\n'),
        fixDescription: `Added placeholder type for ${missingName}`,
        confidence: 0.6
      };
    }

    return {
      success: false,
      fixDescription: `Unknown identifier: ${missingName}`,
      confidence: 0,
      reason: 'No automatic fix available'
    };
  }

  private fixTypeAssignment(content: string, error: any, lines: string[]): any {
    const errorLine = error.line - 1;
    const line = lines[errorLine];

    // 빈 객체 {} → 올바른 인터페이스 객체로 변경
    if (line.includes('{}') && error.message.includes('DocSyncContext')) {
      const replacement = line.replace('{}', `{
    projectRoot: process.cwd(),
    projectScope: 'default',
    changedFiles: [],
    documentMap: {},
    environment: 'development' as const,
    cache: new Map(),
    tempFiles: [],
    logger: console,
    traceId: 'trace-' + Date.now()
  }`);

      lines[errorLine] = replacement;

      return {
        success: true,
        newContent: lines.join('\n'),
        fixDescription: 'Fixed empty object to DocSyncContext',
        confidence: 0.9
      };
    }

    // "admin" → 올바른 DocPermission 값으로 변경
    if (line.includes('"admin"') && error.message.includes('DocPermission')) {
      const replacement = line.replace('"admin"', '"general-docs"');
      lines[errorLine] = replacement;

      return {
        success: true,
        newContent: lines.join('\n'),
        fixDescription: 'Fixed invalid DocPermission value',
        confidence: 0.8
      };
    }

    return {
      success: false,
      fixDescription: 'Complex type assignment - manual fix required',
      confidence: 0,
      reason: 'Cannot automatically determine correct type'
    };
  }

  private fixMissingProperty(content: string, error: any, lines: string[]): any {
    const propertyName = error.message.match(/'([^']+)'/)?.[1];
    if (!propertyName) {
      return { success: false, fixDescription: 'Could not extract property name', confidence: 0 };
    }

    // Optional chaining으로 안전하게 변경
    const errorLine = error.line - 1;
    const line = lines[errorLine];

    if (line.includes(`.${propertyName}`)) {
      const replacement = line.replace(`.${propertyName}`, `.${propertyName}?`);
      lines[errorLine] = replacement;

      return {
        success: true,
        newContent: lines.join('\n'),
        fixDescription: `Added optional chaining for ${propertyName}`,
        confidence: 0.7
      };
    }

    return {
      success: false,
      fixDescription: `Property ${propertyName} - interface extension needed`,
      confidence: 0,
      reason: 'Interface modification required'
    };
  }

  private fixExtraProperty(content: string, error: any, lines: string[]): any {
    const propertyName = error.message.match(/'([^']+)'/)?.[1];
    if (!propertyName) {
      return { success: false, fixDescription: 'Could not extract property name', confidence: 0 };
    }

    // 잘못된 속성 제거 또는 주석 처리
    const errorLine = error.line - 1;
    const line = lines[errorLine];

    if (line.includes(`${propertyName}:`)) {
      // 해당 라인을 주석 처리
      lines[errorLine] = `    // ${line.trim()} // TODO: Remove or fix property`;

      return {
        success: true,
        newContent: lines.join('\n'),
        fixDescription: `Commented out invalid property ${propertyName}`,
        confidence: 0.6
      };
    }

    return {
      success: false,
      fixDescription: `Invalid property ${propertyName} - manual review needed`,
      confidence: 0
    };
  }

  private fixUnterminatedString(content: string, error: any, lines: string[]): any {
    const errorLine = error.line - 1;
    const line = lines[errorLine];

    // 간단한 경우: 라인 끝에 " 추가
    if (line.includes('"') && !line.endsWith('"') && !line.endsWith('";')) {
      lines[errorLine] = line + '"';

      return {
        success: true,
        newContent: lines.join('\n'),
        fixDescription: 'Added missing closing quote',
        confidence: 0.8
      };
    }

    return {
      success: false,
      fixDescription: 'Complex string termination issue',
      confidence: 0,
      reason: 'Manual inspection required'
    };
  }

  private fixMissingSemicolon(content: string, error: any, lines: string[]): any {
    const errorLine = error.line - 1;
    const line = lines[errorLine];

    // 라인 끝에 세미콜론 추가
    if (!line.trim().endsWith(';') && !line.trim().endsWith('}')) {
      lines[errorLine] = line + ';';

      return {
        success: true,
        newContent: lines.join('\n'),
        fixDescription: 'Added missing semicolon',
        confidence: 0.9
      };
    }

    return {
      success: false,
      fixDescription: 'Semicolon placement unclear',
      confidence: 0
    };
  }

  private findInsertPositionForType(lines: string[]): number {
    // import 문들 이후에 타입 정의 삽입
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].startsWith('import') && !lines[i].startsWith('//') && lines[i].trim() !== '') {
        return i;
      }
    }
    return 0;
  }

  private async createFixSession(sessionId: string): Promise<void> {
    const sessionPath = join(this.projectRoot, 'reports/.fix-sessions');
    await fs.mkdir(sessionPath, { recursive: true });

    const sessionFile = join(sessionPath, `${sessionId}.json`);
    await fs.writeFile(sessionFile, JSON.stringify({
      sessionId,
      timestamp: new Date().toISOString(),
      modifiedFiles: [],
      status: 'active'
    }, null, 2));

    // 최신 세션 링크
    const latestSessionFile = join(sessionPath, 'latest.json');
    await fs.writeFile(latestSessionFile, JSON.stringify({ sessionId }));
  }

  private async addToFixSession(filePath: string, backupPath: string, action: string): Promise<void> {
    const sessionPath = join(this.projectRoot, 'reports/.fix-sessions');
    const latestSessionFile = join(sessionPath, 'latest.json');

    try {
      const latestSession = JSON.parse(await fs.readFile(latestSessionFile, 'utf-8'));
      const sessionFile = join(sessionPath, `${latestSession.sessionId}.json`);

      const session = JSON.parse(await fs.readFile(sessionFile, 'utf-8'));
      session.modifiedFiles.push({
        filePath,
        backupPath,
        action,
        timestamp: new Date().toISOString()
      });

      await fs.writeFile(sessionFile, JSON.stringify(session, null, 2));
    } catch (error) {
      console.error('Warning: Could not update fix session:', error);
    }
  }

  async rollback(): Promise<void> {
    console.log('🔄 Rolling back last AI fixes...');

    const sessionPath = join(this.projectRoot, 'reports/.fix-sessions');
    const latestSessionFile = join(sessionPath, 'latest.json');

    try {
      const latestSession = JSON.parse(await fs.readFile(latestSessionFile, 'utf-8'));
      const sessionFile = join(sessionPath, `${latestSession.sessionId}.json`);
      const session = JSON.parse(await fs.readFile(sessionFile, 'utf-8'));

      let restoredCount = 0;

      for (const modification of session.modifiedFiles) {
        try {
          const backupContent = await fs.readFile(modification.backupPath, 'utf-8');
          await fs.writeFile(join(this.projectRoot, modification.filePath), backupContent);
          console.log(`✅ Restored: ${modification.filePath}`);
          restoredCount++;
        } catch (error) {
          console.error(`❌ Failed to restore ${modification.filePath}:`, error);
        }
      }

      // 세션 완료 표시
      session.status = 'rolled_back';
      session.rollbackTimestamp = new Date().toISOString();
      await fs.writeFile(sessionFile, JSON.stringify(session, null, 2));

      console.log(`🔄 Rollback complete: ${restoredCount} files restored`);
      console.log('💡 Run npm run typecheck to verify the rollback');

    } catch (error) {
      console.error('❌ Rollback failed:', error);
      console.log('💡 You can manually restore from .backup.latest files');
    }
  }

  // Semi-automated integration: Get quick fix suggestions for status/sync
  async getFixSuggestions(): Promise<{
    totalErrors: number;
    fixableErrors: number;
    recommendedAction: string;
    successRate: number;
  }> {
    try {
      const { TypeScriptCompileChecker } = await import('./ts-compile-checker.js');
      const checker = new TypeScriptCompileChecker(this.projectRoot);
      const report = await checker.checkCompilation();

      let fixableCount = 0;

      // Estimate fixable errors based on common patterns
      for (const error of report.errors) {
        // Simple heuristic for fixable errors
        if (error.code.includes('2304') || // Cannot find name
            error.code.includes('1005') || // ';' expected
            error.code.includes('2345') || // Argument type mismatch
            error.code.includes('2339')) {  // Property does not exist
          fixableCount++;
        }
      }

      const successRate = report.errors.length > 0 ? Math.round((fixableCount / report.errors.length) * 100) : 0;

      let recommendedAction = '';
      if (report.errors.length === 0) {
        recommendedAction = 'No TypeScript errors found';
      } else if (fixableCount === 0) {
        recommendedAction = 'Manual fixes needed for complex errors';
      } else if (fixableCount <= 5) {
        recommendedAction = '/fix → Auto-fix available errors';
      } else {
        recommendedAction = '/fix typescript → Start with type errors first';
      }

      return {
        totalErrors: report.errors.length,
        fixableErrors: fixableCount,
        recommendedAction,
        successRate
      };
    } catch (error) {
      // Fallback for when TypeScript checker is not available
      return {
        totalErrors: 0,
        fixableErrors: 0,
        recommendedAction: 'TypeScript check not available',
        successRate: 0
      };
    }
  }

  private async generateFixReport(report: FixReport): Promise<void> {
    console.log('\n🤖 AI Fix Report');
    console.log('================');
    console.log(`🔍 Total errors found: ${report.totalErrors}`);
    console.log(`🔧 Fix attempts: ${report.fixAttempts}`);
    console.log(`✅ Successful fixes: ${report.successfulFixes}`);
    console.log(`❌ Remaining errors: ${report.remainingErrors}`);

    const successRate = report.fixAttempts > 0
      ? ((report.successfulFixes / report.fixAttempts) * 100).toFixed(1)
      : '0';
    console.log(`📊 Success rate: ${successRate}%`);

    if (report.successfulFixes > 0) {
      console.log('\n✅ Successfully applied fixes:');
      report.attempts
        .filter(a => a.success)
        .forEach(attempt => {
          console.log(`   • ${attempt.file}:${attempt.line} - ${attempt.fixApplied}`);
        });
    }

    if (report.attempts.some(a => !a.success)) {
      console.log('\n❌ Fixes that need manual attention:');
      report.attempts
        .filter(a => !a.success)
        .forEach(attempt => {
          console.log(`   • ${attempt.file}:${attempt.line} - ${attempt.errorCode}: ${attempt.fixApplied}`);
        });
    }

    // 리포트 저장
    await fs.mkdir(join(this.projectRoot, 'reports'), { recursive: true });
    await fs.writeFile(
      join(this.projectRoot, 'reports/ai-fix-report.json'),
      JSON.stringify(report, null, 2)
    );

    console.log('\n📋 Detailed report saved to: reports/ai-fix-report.json');

    if (report.successfulFixes > 0) {
      console.log('💾 Backup files created with .backup extension');
      console.log('🔄 Run npm run typecheck to verify fixes');
    }
  }
}

// CLI 실행
async function main() {
  const projectRoot = process.cwd();
  const fixEngine = new AIFixEngine(projectRoot);

  const command = process.argv[2];
  const filterType = process.argv[3];

  switch (command) {
    case 'auto':
    case undefined:
      await fixEngine.autoFix(filterType);
      break;

    case 'rollback':
      await fixEngine.rollback();
      break;

    case 'suggest':
      const suggestions = await fixEngine.getFixSuggestions();
      console.log('\n🤖 AI Fix Suggestions');
      console.log('====================');
      console.log(`🔍 Total TypeScript errors: ${suggestions.totalErrors}`);
      console.log(`🔧 Auto-fixable errors: ${suggestions.fixableErrors}`);
      console.log(`📊 Success rate estimate: ${suggestions.successRate}%`);
      console.log(`💡 Recommended action: ${suggestions.recommendedAction}`);
      break;

    default:
      console.log(`
Usage: tsx scripts/ai-fix-engine.ts [command] [filter]

Commands:
  auto          - Automatically fix TypeScript errors (default)
  rollback      - Rollback last AI fixes
  suggest       - Get AI fix suggestions without applying

Filters (for auto command):
  typescript    - Fix only type-related errors
  imports       - Fix only import-related errors
  syntax        - Fix only syntax errors
  plugins       - Fix only plugin-related errors

Examples:
  npm run fix                    # Auto-fix all errors
  npm run fix typescript         # Fix only TypeScript errors
  npm run fix:rollback          # Rollback last fixes
      `);
  }
}

// ES module main check
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { AIFixEngine };