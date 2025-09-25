#!/usr/bin/env tsx
/**
 * DocLinter - 문서 구조 및 품질 규칙 검증 시스템
 * GPT 제안사항에 기반한 형식/예시/구조 일관성 체크
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { glob } from 'glob';
import yaml from 'yaml';

interface LintRule {
  name: string;
  description: string;
  pattern: string; // glob pattern for files to apply this rule
  required: string[]; // required sections/patterns
  forbidden?: string[]; // forbidden patterns
  suggestions?: string[]; // suggested additions
  severity: 'error' | 'warning' | 'info';
}

interface LintResult {
  file: string;
  rule: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  line?: number;
  suggestion?: string;
}

const DEFAULT_RULES: LintRule[] = [
  // Agent 문서 규칙
  {
    name: 'agent-structure',
    description: 'Agent 문서는 표준 구조를 따라야 함',
    pattern: 'docs/**/agent*.md',
    required: ['# Overview', '## Usage', '## Source Reference'],
    suggestions: ['## Examples', '## Configuration'],
    severity: 'error'
  },
  {
    name: 'api-docs-structure',
    description: 'API 문서는 표준 구조를 따라야 함',
    pattern: 'docs/**/API*.md',
    required: ['# API Reference', '## Endpoints', '## Examples'],
    suggestions: ['## Authentication', '## Error Handling'],
    severity: 'error'
  },
  {
    name: 'general-docs-structure',
    description: '일반 문서는 Overview 섹션이 필요함',
    pattern: 'docs/**/*.md',
    required: ['# '],
    suggestions: ['## Overview'],
    severity: 'warning'
  },
  // 코드 예시 규칙
  {
    name: 'code-examples-required',
    description: 'API 및 사용법 문서에는 코드 예시 필요',
    pattern: 'docs/**/{API,usage,USAGE,guide,GUIDE}*.md',
    required: ['```'],
    severity: 'warning'
  },
  // 타임스탬프 규칙
  {
    name: 'timestamp-tracking',
    description: '문서 신선도 추적을 위한 타임스탬프 권장',
    pattern: 'docs/**/*.md',
    required: [],
    suggestions: ['Last updated:', '_Generated:', 'Updated:'],
    severity: 'info'
  },
  // 링크 검증 규칙
  {
    name: 'valid-internal-links',
    description: '내부 링크는 유효한 파일을 가리켜야 함',
    pattern: 'docs/**/*.md',
    required: [],
    severity: 'error'
  },
  // TOC 규칙
  {
    name: 'toc-for-long-docs',
    description: '긴 문서는 목차를 포함해야 함',
    pattern: 'docs/**/*.md',
    required: [],
    suggestions: ['## Table of Contents', '## 목차'],
    severity: 'info'
  }
];

class DocLinter {
  private rules: LintRule[] = [];
  private projectRoot: string;

  constructor(projectRoot: string, customRulesPath?: string) {
    this.projectRoot = projectRoot;
    this.rules = [...DEFAULT_RULES];
  }

  async loadCustomRules(rulesPath: string): Promise<void> {
    try {
      const rulesContent = await fs.readFile(rulesPath, 'utf-8');
      const customRules = yaml.parse(rulesContent) as LintRule[];
      this.rules.push(...customRules);
      console.log(`✅ Loaded ${customRules.length} custom rules from ${rulesPath}`);
    } catch (error) {
      console.warn(`⚠️  Could not load custom rules from ${rulesPath}:`, error);
    }
  }

  async lintAll(): Promise<LintResult[]> {
    console.log('🔍 Starting document linting...');

    const results: LintResult[] = [];
    const docFiles = await glob('docs/**/*.md', { cwd: this.projectRoot });

    for (const docFile of docFiles) {
      const fileResults = await this.lintFile(docFile);
      results.push(...fileResults);
    }

    return results;
  }

  async lintFile(filePath: string): Promise<LintResult[]> {
    const results: LintResult[] = [];
    const fullPath = join(this.projectRoot, filePath);
    const content = await fs.readFile(fullPath, 'utf-8');
    const lines = content.split('\\n');

    // 적용 가능한 규칙 찾기
    const applicableRules = this.rules.filter(rule =>
      this.matchesPattern(filePath, rule.pattern)
    );

    for (const rule of applicableRules) {
      const ruleResults = await this.applyRule(filePath, content, lines, rule);
      results.push(...ruleResults);
    }

    return results;
  }

  private async applyRule(
    filePath: string,
    content: string,
    lines: string[],
    rule: LintRule
  ): Promise<LintResult[]> {
    const results: LintResult[] = [];

    switch (rule.name) {
      case 'agent-structure':
      case 'api-docs-structure':
      case 'general-docs-structure':
        results.push(...this.checkRequiredSections(filePath, content, rule));
        break;

      case 'code-examples-required':
        results.push(...this.checkCodeExamples(filePath, content, rule));
        break;

      case 'timestamp-tracking':
        results.push(...this.checkTimestamps(filePath, content, rule));
        break;

      case 'valid-internal-links':
        results.push(...await this.checkInternalLinks(filePath, content, rule));
        break;

      case 'toc-for-long-docs':
        results.push(...this.checkTableOfContents(filePath, content, lines, rule));
        break;
    }

    return results;
  }

  private checkRequiredSections(filePath: string, content: string, rule: LintRule): LintResult[] {
    const results: LintResult[] = [];

    for (const required of rule.required) {
      if (!content.includes(required)) {
        results.push({
          file: filePath,
          rule: rule.name,
          severity: rule.severity,
          message: `Missing required section: "${required}"`,
          suggestion: `Add "${required}" section to follow standard structure`
        });
      }
    }

    // 권장사항 체크
    if (rule.suggestions) {
      for (const suggestion of rule.suggestions) {
        if (!content.includes(suggestion)) {
          results.push({
            file: filePath,
            rule: rule.name,
            severity: 'info',
            message: `Consider adding: "${suggestion}"`,
            suggestion: `Adding "${suggestion}" would improve document completeness`
          });
        }
      }
    }

    return results;
  }

  private checkCodeExamples(filePath: string, content: string, rule: LintRule): LintResult[] {
    const results: LintResult[] = [];

    if (!content.includes('```')) {
      results.push({
        file: filePath,
        rule: rule.name,
        severity: rule.severity,
        message: 'No code examples found',
        suggestion: 'Add code examples with \\```\\` blocks to improve usability'
      });
    }

    return results;
  }

  private checkTimestamps(filePath: string, content: string, rule: LintRule): LintResult[] {
    const results: LintResult[] = [];

    const hasTimestamp = rule.suggestions?.some(pattern => content.includes(pattern));

    if (!hasTimestamp) {
      results.push({
        file: filePath,
        rule: rule.name,
        severity: rule.severity,
        message: 'No timestamp found for freshness tracking',
        suggestion: 'Add "Last updated: YYYY-MM-DD" or "_Generated:" timestamp'
      });
    }

    return results;
  }

  private async checkInternalLinks(filePath: string, content: string, rule: LintRule): Promise<LintResult[]> {
    const results: LintResult[] = [];

    // Markdown 링크 패턴 찾기
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;

    while ((match = linkRegex.exec(content)) !== null) {
      const [fullMatch, linkText, linkUrl] = match;

      // 내부 링크만 체크 (상대 경로)
      if (!linkUrl.startsWith('http') && !linkUrl.startsWith('#')) {
        const targetPath = join(this.projectRoot, linkUrl);

        try {
          await fs.access(targetPath);
        } catch {
          results.push({
            file: filePath,
            rule: rule.name,
            severity: rule.severity,
            message: `Broken internal link: "${linkUrl}"`,
            suggestion: `Verify that the target file exists: ${linkUrl}`
          });
        }
      }
    }

    return results;
  }

  private checkTableOfContents(
    filePath: string,
    content: string,
    lines: string[],
    rule: LintRule
  ): LintResult[] {
    const results: LintResult[] = [];

    // 긴 문서인지 확인 (20줄 이상이고 여러 섹션이 있는 경우)
    const isLongDoc = lines.length > 20;
    const hasMultipleSections = (content.match(/^#{1,3} /gm) || []).length > 3;

    if (isLongDoc && hasMultipleSections) {
      const hasTOC = rule.suggestions?.some(pattern => content.includes(pattern));

      if (!hasTOC) {
        results.push({
          file: filePath,
          rule: rule.name,
          severity: rule.severity,
          message: 'Long document without table of contents',
          suggestion: 'Consider adding a table of contents for better navigation'
        });
      }
    }

    return results;
  }

  private matchesPattern(filePath: string, pattern: string): boolean {
    // 간단한 glob 패턴 매칭
    const regexPattern = pattern
      .replace(/\\*\\*/g, '.*')
      .replace(/\\*/g, '[^/]*')
      .replace(/\\?/g, '.');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(filePath);
  }

  async generateReport(results: LintResult[]): Promise<void> {
    const errorCount = results.filter(r => r.severity === 'error').length;
    const warningCount = results.filter(r => r.severity === 'warning').length;
    const infoCount = results.filter(r => r.severity === 'info').length;

    console.log('\\n📋 Doc Linting Report');
    console.log('=====================');
    console.log(`🔴 Errors: ${errorCount}`);
    console.log(`🟡 Warnings: ${warningCount}`);
    console.log(`🔵 Info: ${infoCount}`);
    console.log(`📄 Total files checked: ${new Set(results.map(r => r.file)).size}`);

    if (results.length === 0) {
      console.log('\\n✅ All documents passed linting!');
      return;
    }

    // 파일별 그룹화
    const byFile = results.reduce((acc, result) => {
      if (!acc[result.file]) acc[result.file] = [];
      acc[result.file].push(result);
      return acc;
    }, {} as Record<string, LintResult[]>);

    console.log('\\n📝 Issues by file:');
    for (const [file, fileResults] of Object.entries(byFile)) {
      console.log(`\\n📄 ${file}:`);
      for (const result of fileResults) {
        const icon = result.severity === 'error' ? '🔴' :
                    result.severity === 'warning' ? '🟡' : '🔵';
        console.log(`   ${icon} ${result.message}`);
        if (result.suggestion) {
          console.log(`      💡 ${result.suggestion}`);
        }
      }
    }

    // 보고서 파일 저장
    const reportPath = join(this.projectRoot, 'reports/doc-lint-report.json');
    await fs.mkdir(join(this.projectRoot, 'reports'), { recursive: true });

    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalFiles: new Set(results.map(r => r.file)).size,
        errorCount,
        warningCount,
        infoCount
      },
      results
    };

    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`\\n📋 Detailed report saved to: ${reportPath}`);
  }
}

// CLI 실행
async function main() {
  const projectRoot = process.cwd();
  const linter = new DocLinter(projectRoot);

  // 커스텀 규칙 로드 (있는 경우)
  const customRulesPath = join(projectRoot, 'docs/.doclint.yml');
  try {
    await fs.access(customRulesPath);
    await linter.loadCustomRules(customRulesPath);
  } catch {
    // 커스텀 규칙 파일이 없으면 기본 규칙만 사용
  }

  const command = process.argv[2];
  const targetFile = process.argv[3];

  if (command === 'file' && targetFile) {
    const results = await linter.lintFile(targetFile);
    await linter.generateReport(results);
  } else {
    const results = await linter.lintAll();
    await linter.generateReport(results);
  }
}

if (require.main === module) {
  main().catch(console.error);
}