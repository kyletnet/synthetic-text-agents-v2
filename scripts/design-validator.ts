#!/usr/bin/env tsx

/**
 * Design Validator - 설계 원칙 준수 여부 검증
 *
 * Purpose: /maintain, pre-commit, CI에서 자동 실행되어
 * 모든 코드가 설계 원칙을 준수하는지 검증
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import * as glob from 'glob';

interface DesignViolation {
  file: string;
  line?: number;
  rule: string;
  severity: 'P0' | 'P1' | 'P2';
  message: string;
  suggestion: string;
}

class DesignValidator {
  private violations: DesignViolation[] = [];
  private rootDir: string;

  constructor() {
    this.rootDir = process.cwd();
  }

  async validate(): Promise<{ success: boolean; violations: DesignViolation[] }> {
    console.log('🔍 [DesignValidator] Starting design principle validation...');

    // Rule 1: No hardcoded forced execution
    await this.checkNoHardcodedForcedExecution();

    // Rule 2: All child processes must use ProcessLifecycleManager
    await this.checkProcessLifecycleUsage();

    // Rule 3: All LLM calls must go through LLM Execution Authority
    await this.checkLLMExecutionAuthority();

    // Rule 4: Critical tasks must use priority-based scheduling
    await this.checkPriorityBasedScheduling();

    // Rule 5: No TTY-blocking calls without isTTY check
    await this.checkTTYDetection();

    // Rule 6: All stdio must be inherit for user-facing commands
    await this.checkStdioInherit();

    // Rule 7: All healing must respect dormant mode
    await this.checkDormantModeRespect();

    const p0Count = this.violations.filter(v => v.severity === 'P0').length;
    const p1Count = this.violations.filter(v => v.severity === 'P1').length;

    console.log(`\n📊 [DesignValidator] Validation complete:`);
    console.log(`   🔴 P0 Critical: ${p0Count}`);
    console.log(`   🟡 P1 High: ${p1Count}`);
    console.log(`   🟢 P2 Medium: ${this.violations.length - p0Count - p1Count}`);

    if (p0Count > 0) {
      console.log('\n❌ [DesignValidator] FAILED - P0 violations must be fixed');
      this.printViolations();
      return { success: false, violations: this.violations };
    }

    if (p1Count > 0) {
      console.log('\n⚠️ [DesignValidator] WARNING - P1 violations should be addressed');
      this.printViolations();
    }

    console.log('\n✅ [DesignValidator] All design principles validated');
    return { success: true, violations: this.violations };
  }

  private async checkNoHardcodedForcedExecution(): Promise<void> {
    const files = glob.sync('scripts/**/*.ts', { cwd: this.rootDir });

    for (const file of files) {
      const content = this.readFile(join(this.rootDir, file));
      if (!content) continue;

      // Check for task name hardcoding
      if (content.match(/if\s*\(\s*task(Name|\.name)\s*===\s*['"][^'"]+['"]\s*\)/)) {
        this.addViolation({
          file,
          rule: 'NO_HARDCODED_FORCED_EXECUTION',
          severity: 'P0',
          message: 'Hardcoded task name check detected',
          suggestion: 'Use priority-based scheduling instead of hardcoding task names'
        });
      }

      // Check for forceExecute flags
      if (content.match(/forceExecute\s*=\s*true/)) {
        this.addViolation({
          file,
          rule: 'NO_HARDCODED_FORCED_EXECUTION',
          severity: 'P0',
          message: 'Hardcoded forceExecute flag detected',
          suggestion: 'Use mode-based execution (SMART/FORCE) instead'
        });
      }
    }
  }

  private async checkProcessLifecycleUsage(): Promise<void> {
    const files = glob.sync('{scripts,apps}/**/*.ts', {
      cwd: this.rootDir,
      ignore: ['**/node_modules/**', '**/dist/**', '**/*.d.ts']
    });

    for (const file of files) {
      const content = this.readFile(join(this.rootDir, file));
      if (!content) continue;

      // Check for spawn/fork calls (long-running processes) - execSync is synchronous, so less critical
      const hasImport = content.includes('child_process');
      const hasAsyncProcess = content.match(/=\s*(spawn|fork)\s*\(/);
      const hasManager = content.includes('processLifecycleManager') ||
                        content.includes('ProcessLifecycleManager');

      // Only flag if uses spawn/fork (not execSync) AND doesn't use manager
      // Critical for: API routes, long-running scripts, background tasks
      if (hasImport && hasAsyncProcess && !hasManager &&
          (file.includes('app/api/') || file.includes('dev-environment') ||
           file.includes('adaptive-execution'))) {
        this.addViolation({
          file,
          rule: 'USE_PROCESS_LIFECYCLE_MANAGER',
          severity: 'P0',
          message: 'Direct spawn/fork usage without ProcessLifecycleManager',
          suggestion: 'Use processLifecycleManager.spawnManaged() to prevent orphan processes'
        });
      }
    }
  }

  private async checkLLMExecutionAuthority(): Promise<void> {
    const files = glob.sync('apps/**/*.ts', {
      cwd: this.rootDir,
      ignore: ['**/node_modules/**', '**/dist/**', '**/*.d.ts']
    });

    for (const file of files) {
      const content = this.readFile(join(this.rootDir, file));
      if (!content) continue;

      // Check for direct Anthropic API calls
      if (content.includes('anthropic.messages.create') &&
          !content.includes('LLMExecutionAuthority') &&
          !file.includes('anthropic-client')) {
        this.addViolation({
          file,
          rule: 'USE_LLM_EXECUTION_AUTHORITY',
          severity: 'P0',
          message: 'Direct Anthropic API call without LLM Execution Authority',
          suggestion: 'All LLM calls must go through LLMExecutionAuthority.authorizeExecution()'
        });
      }
    }
  }

  private async checkPriorityBasedScheduling(): Promise<void> {
    const files = glob.sync('scripts/*maintenance*.ts', { cwd: this.rootDir });

    for (const file of files) {
      const content = this.readFile(join(this.rootDir, file));
      if (!content) continue;

      // Check if getTasksDue has priority logic
      if (content.includes('getTasksDue') &&
          !content.includes('task.priority === "critical"') &&
          content.includes('return false')) {
        this.addViolation({
          file,
          rule: 'PRIORITY_BASED_SCHEDULING',
          severity: 'P0',
          message: 'Task scheduling does not respect priority levels',
          suggestion: 'Critical priority tasks must always execute regardless of time filters'
        });
      }
    }
  }

  private async checkTTYDetection(): Promise<void> {
    const files = glob.sync('scripts/**/*approval*.ts', { cwd: this.rootDir });

    for (const file of files) {
      const content = this.readFile(join(this.rootDir, file));
      if (!content) continue;

      // Check for stdin usage without TTY check
      if (content.includes('process.stdin') &&
          content.match(/readline|createInterface/) &&
          !content.includes('process.stdin.isTTY')) {
        this.addViolation({
          file,
          rule: 'CHECK_TTY_BEFORE_STDIN',
          severity: 'P0',
          message: 'stdin usage without isTTY check',
          suggestion: 'Check process.stdin.isTTY and queue approvals in non-interactive mode'
        });
      }
    }
  }

  private async checkStdioInherit(): Promise<void> {
    const files = glob.sync('scripts/**/*.ts', { cwd: this.rootDir });

    for (const file of files) {
      const content = this.readFile(join(this.rootDir, file));
      if (!content) continue;

      // Check for stdio: pipe in user-facing commands that don't parse output
      // Only flag if there's no .match() or string parsing after execSync
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.match(/execSync.*stdio:\s*["']pipe["']/) &&
            (file.includes('maintenance') || file.includes('orchestrator'))) {
          // Check if next few lines use .match() or parse the result
          const contextLines = lines.slice(Math.max(0, i - 2), i + 5).join('\n');
          if (!contextLines.match(/\.match\(|\.includes\(|parseInt\(|parseFloat\(/)) {
            this.addViolation({
              file,
              line: i + 1,
              rule: 'STDIO_INHERIT_FOR_USER_COMMANDS',
              severity: 'P1',
              message: 'stdio:pipe hides output from user without parsing',
              suggestion: 'Use stdio:inherit for user-facing commands or parse the output'
            });
          }
        }
      }
    }
  }

  private async checkDormantModeRespect(): Promise<void> {
    const files = glob.sync('apps/**/lib/*healing*.ts', { cwd: this.rootDir });

    for (const file of files) {
      const content = this.readFile(join(this.rootDir, file));
      if (!content) continue;

      // Check if performAutomaticHealing checks dormant mode
      if (content.includes('performAutomaticHealing') &&
          content.includes('async performAutomaticHealing') &&
          !content.includes('if (this.dormantMode)')) {
        this.addViolation({
          file,
          rule: 'RESPECT_DORMANT_MODE',
          severity: 'P0',
          message: 'Healing does not check dormant mode',
          suggestion: 'Add dormant mode check at start of performAutomaticHealing()'
        });
      }
    }
  }

  private readFile(path: string): string | null {
    try {
      if (existsSync(path)) {
        return readFileSync(path, 'utf-8');
      }
    } catch (error) {
      // Ignore errors
    }
    return null;
  }

  private addViolation(violation: DesignViolation): void {
    this.violations.push(violation);
  }

  private printViolations(): void {
    const grouped = this.violations.reduce((acc, v) => {
      if (!acc[v.severity]) acc[v.severity] = [];
      acc[v.severity].push(v);
      return acc;
    }, {} as Record<string, DesignViolation[]>);

    for (const severity of ['P0', 'P1', 'P2'] as const) {
      const violations = grouped[severity] || [];
      if (violations.length === 0) continue;

      console.log(`\n${'='.repeat(80)}`);
      console.log(`${severity} Violations (${violations.length}):`);
      console.log('='.repeat(80));

      violations.forEach((v, i) => {
        console.log(`\n${i + 1}. [${v.rule}] ${v.file}`);
        console.log(`   ❌ ${v.message}`);
        console.log(`   💡 ${v.suggestion}`);
      });
    }
  }
}

// CLI execution
async function main() {
  const validator = new DesignValidator();
  const result = await validator.validate();

  process.exit(result.success ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ [DesignValidator] Fatal error:', error);
    process.exit(1);
  });
}

export { DesignValidator };