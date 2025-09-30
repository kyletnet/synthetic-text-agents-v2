#!/usr/bin/env tsx

/**
 * Documentation Quality Gate for CI/CD
 *
 * Validates documentation quality and blocks CI if critical issues found
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import * as glob from 'glob';

interface GateRule {
  name: string;
  blocking: boolean;
  check: () => { passed: boolean; message: string; details?: string[] };
}

interface GateReport {
  overall: 'PASS' | 'FAIL';
  summary: {
    passed: number;
    failed: number;
    totalRules: number;
  };
  rules: Array<{
    name: string;
    blocking: boolean;
    result: {
      passed: boolean;
      message: string;
      details?: string[];
    };
  }>;
}

class DocQualityGate {
  private rootDir: string;
  private rules: GateRule[];

  constructor() {
    this.rootDir = process.cwd();
    this.rules = [
      {
        name: 'CLAUDE.md exists',
        blocking: true,
        check: () => this.checkCLAUDEmdExists()
      },
      {
        name: 'Core documentation files exist',
        blocking: true,
        check: () => this.checkCoreDocsExist()
      },
      {
        name: 'No empty markdown files',
        blocking: false,
        check: () => this.checkNoEmptyMarkdown()
      },
      {
        name: 'LLM signals index is valid',
        blocking: false,
        check: () => this.checkLLMSignalsIndex()
      }
    ];
  }

  private checkCLAUDEmdExists(): { passed: boolean; message: string } {
    const claudePath = join(this.rootDir, 'CLAUDE.md');
    if (!existsSync(claudePath)) {
      return {
        passed: false,
        message: 'CLAUDE.md is missing - required for project instructions'
      };
    }

    const content = readFileSync(claudePath, 'utf-8');
    if (content.length < 100) {
      return {
        passed: false,
        message: 'CLAUDE.md is too short - must contain meaningful instructions'
      };
    }

    return {
      passed: true,
      message: 'CLAUDE.md exists and has content'
    };
  }

  private checkCoreDocsExist(): { passed: boolean; message: string; details?: string[] } {
    const requiredDocs = [
      'DEVELOPMENT_STANDARDS.md',
      'LLM_DEVELOPMENT_CONTRACT.md',
      'docs/llm_friendly_summary.md'
    ];

    const missing: string[] = [];
    for (const doc of requiredDocs) {
      if (!existsSync(join(this.rootDir, doc))) {
        missing.push(doc);
      }
    }

    if (missing.length > 0) {
      return {
        passed: false,
        message: `${missing.length} core documentation files missing`,
        details: missing
      };
    }

    return {
      passed: true,
      message: 'All core documentation files exist'
    };
  }

  private checkNoEmptyMarkdown(): { passed: boolean; message: string; details?: string[] } {
    const mdFiles = glob.sync('docs/**/*.md', { cwd: this.rootDir });
    const emptyFiles: string[] = [];

    for (const file of mdFiles) {
      const fullPath = join(this.rootDir, file);
      const content = readFileSync(fullPath, 'utf-8').trim();
      if (content.length < 10) {
        emptyFiles.push(file);
      }
    }

    if (emptyFiles.length > 0) {
      return {
        passed: false,
        message: `${emptyFiles.length} markdown files are empty or too short`,
        details: emptyFiles.slice(0, 5)
      };
    }

    return {
      passed: true,
      message: 'No empty markdown files found'
    };
  }

  private checkLLMSignalsIndex(): { passed: boolean; message: string } {
    const indexPath = join(this.rootDir, 'docs/.llm-signals-index.json');
    if (!existsSync(indexPath)) {
      return {
        passed: false,
        message: 'LLM signals index not found - run npm run docs:refresh'
      };
    }

    try {
      const content = readFileSync(indexPath, 'utf-8');
      JSON.parse(content); // Validate JSON
      return {
        passed: true,
        message: 'LLM signals index is valid'
      };
    } catch {
      return {
        passed: false,
        message: 'LLM signals index is invalid JSON'
      };
    }
  }

  async execute(): Promise<void> {
    console.log('🔐 Running Documentation Quality Gate...\n');

    const report: GateReport = {
      overall: 'PASS',
      summary: {
        passed: 0,
        failed: 0,
        totalRules: this.rules.length
      },
      rules: []
    };

    for (const rule of this.rules) {
      console.log(`📋 Checking: ${rule.name}...`);
      const result = rule.check();

      report.rules.push({
        name: rule.name,
        blocking: rule.blocking,
        result
      });

      if (result.passed) {
        report.summary.passed++;
        console.log(`   ✅ ${result.message}`);
      } else {
        report.summary.failed++;
        console.log(`   ❌ ${result.message}`);
        if (result.details) {
          result.details.forEach(detail => {
            console.log(`      - ${detail}`);
          });
        }
        if (rule.blocking) {
          report.overall = 'FAIL';
        }
      }
    }

    // Write report
    const reportsDir = join(this.rootDir, 'reports');
    if (!existsSync(reportsDir)) {
      require('fs').mkdirSync(reportsDir, { recursive: true });
    }

    const reportPath = join(reportsDir, 'doc-gate-report.json');
    writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log(`\n📊 Quality Gate Summary:`);
    console.log(`   Overall: ${report.overall === 'PASS' ? '✅' : '❌'} ${report.overall}`);
    console.log(`   Passed: ${report.summary.passed}/${report.summary.totalRules}`);
    console.log(`   Failed: ${report.summary.failed}/${report.summary.totalRules}`);
    console.log(`\n📄 Report saved to: ${reportPath}`);

    if (report.overall === 'FAIL') {
      console.log('\n❌ Documentation Quality Gate FAILED');
      console.log('💡 Fix blocking issues before proceeding');
      process.exit(1);
    }

    console.log('\n✅ Documentation Quality Gate PASSED');
  }
}

// CLI execution
async function main() {
  const gate = new DocQualityGate();
  await gate.execute();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

export { DocQualityGate };