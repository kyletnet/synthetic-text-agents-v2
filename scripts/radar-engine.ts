#!/usr/bin/env tsx

// @tool-mode: analyze
// @tool-description: Deep system inspection - detects technical debt, coverage gaps, and security issues

/**
 * Radar Engine - System Issue Detection
 *
 * Purpose: 정밀 시스템 진단 - 치명적 이슈 발견에 집중
 *
 * What it does:
 * - 숨겨진 기술 부채 발견
 * - 테스트 커버리지 갭 분석
 * - 아키텍처 위반 패턴 탐지
 * - 사용되지 않는 코드/문서 발견
 * - 보안 취약점 스캔
 *
 * When to use: 정기 점검 (주 1회) 또는 큰 변경 전
 */

import { execSync } from "child_process";
import { existsSync, readFileSync, statSync, readdirSync } from "fs";
import { join } from "path";

interface DeepInspectionResult {
  timestamp: string;
  criticalIssues: CriticalIssue[];
  healthScore: number;
  recommendations: Recommendation[];
  summary: InspectionSummary;
}

interface CriticalIssue {
  id: string;
  severity: "P0" | "P1" | "P2";
  category: string;
  description: string;
  impact: string;
  files?: string[];
  count?: number;
  suggestedFix?: string;
}

interface Recommendation {
  priority: "high" | "medium" | "low";
  action: string;
  reason: string;
  command?: string;
}

interface InspectionSummary {
  totalIssues: number;
  p0Count: number;
  p1Count: number;
  p2Count: number;
  filesScanned: number;
  timeElapsed: string;
}

const REPO_ROOT = process.cwd();

// ANSI Colors
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

function log(message: string, color: keyof typeof colors = "reset"): void {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function execCommand(command: string, silent = true): string {
  try {
    return execSync(command, {
      cwd: REPO_ROOT,
      encoding: "utf-8",
      stdio: silent ? "pipe" : "inherit",
    });
  } catch (error) {
    return "";
  }
}

// ===================================
// Critical Checks
// ===================================

/**
 * 1. 테스트되지 않은 Critical 파일 탐지
 */
function findUntestedCriticalFiles(): CriticalIssue[] {
  log("\n🔍 Scanning untested critical files...", "cyan");

  // Critical: 핵심 인프라 파일들 (반드시 테스트 필요)
  const criticalPatterns = [
    "src/shared/bus.ts",
    "src/shared/config.ts",
    "src/shared/errorTracking.ts",
    "src/shared/backupSystem.ts",
    "src/shared/rateLimiter.ts",
    "src/shared/logForwarder.ts",
    "src/shared/registry.ts",
    "src/shared/pluginLoader.ts",
    "src/shared/metrics.ts",
  ];

  const coverageReport = join(REPO_ROOT, "coverage/coverage-final.json");
  let untestedFiles: string[] = [];

  if (existsSync(coverageReport)) {
    // Use actual coverage report (coverage-final.json from vitest)
    const coverage = JSON.parse(readFileSync(coverageReport, "utf-8"));

    // Also scan for ANY file in src/shared with 0% coverage
    Object.keys(coverage).forEach((filePath) => {
      const cov = coverage[filePath];

      // Check if file has 0% coverage (all statement counts are 0)
      const hasZeroCoverage =
        cov.s && Object.values(cov.s).every((v) => v === 0);

      if (
        filePath.includes("/src/shared/") &&
        filePath.endsWith(".ts") &&
        !filePath.includes(".test.") &&
        hasZeroCoverage &&
        !untestedFiles.some((f) => filePath.includes(f))
      ) {
        const relativePath = filePath.replace(REPO_ROOT + "/", "");
        untestedFiles.push(relativePath);
      }
    });
  } else {
    // No coverage report - generate it first
    log("⚠️  No coverage report found. Generating...", "yellow");
    execCommand("npm run test:coverage", false);

    // Retry after generation
    if (existsSync(coverageReport)) {
      const coverage = JSON.parse(readFileSync(coverageReport, "utf-8"));

      Object.keys(coverage).forEach((filePath) => {
        const cov = coverage[filePath];
        const hasZeroCoverage =
          cov.s && Object.values(cov.s).every((v) => v === 0);

        if (
          filePath.includes("/src/shared/") &&
          filePath.endsWith(".ts") &&
          !filePath.includes(".test.") &&
          hasZeroCoverage
        ) {
          const relativePath = filePath.replace(REPO_ROOT + "/", "");
          untestedFiles.push(relativePath);
        }
      });
    } else {
      // Fallback: assume all critical files are untested
      untestedFiles = criticalPatterns.filter((path) =>
        existsSync(join(REPO_ROOT, path)),
      );
    }
  }

  if (untestedFiles.length > 0) {
    return [
      {
        id: "untested-critical",
        severity: "P0",
        category: "Testing",
        description: `${untestedFiles.length}개의 핵심 파일에 테스트 없음`,
        impact: "런타임 에러 발생 시 감지 불가능",
        files: untestedFiles,
        suggestedFix: "각 파일에 최소 smoke test 추가",
      },
    ];
  }

  return [];
}

/**
 * 품질 영향 분석: 파일이 품질을 위해 큰 것인지 구조 문제인지 판단
 */
function analyzeFileQualityImpact(
  filePath: string,
  content: string,
): {
  isQualityEssential: boolean;
  reason: string;
} {
  // 도메인 데이터 패턴 (품질에 필수적인 내용)
  const qualityPatterns = [
    /const\s+\w+:\s*Record<string,\s*string\[\]>\s*=\s*\{/g, // 도메인 매핑 데이터
    /knowledgeBase\.set\(/g, // 지식 베이스 데이터
    /marketDynamics:|keyStakeholders:|bestPractices:/g, // 도메인 지식
    /DOMAIN_\w+:\s*Record/g, // 도메인 상수
    /private\s+\w+Emotions|Motivations|Stressors/g, // 심리/동기 데이터
  ];

  // 중복 boilerplate 패턴 (리팩토링 가능)
  const boilerplatePatterns = [
    /\/\/\s*TODO|\/\/\s*FIXME/g, // TODO/FIXME 코멘트
    /console\.log\(/g, // 디버그 로그
    /import\s+.*from\s+["'].*["'];?\s*$/gm, // import 문
  ];

  let qualitySignals = 0;
  let boilerplateSignals = 0;

  // 품질 신호 카운트
  for (const pattern of qualityPatterns) {
    const matches = content.match(pattern);
    if (matches) qualitySignals += matches.length;
  }

  // Boilerplate 신호 카운트
  for (const pattern of boilerplatePatterns) {
    const matches = content.match(pattern);
    if (matches) boilerplateSignals += matches.length;
  }

  // Agent 파일들은 도메인 지식 포함 가능성 높음
  if (filePath.includes("/agents/") && qualitySignals > 5) {
    return {
      isQualityEssential: true,
      reason: "도메인 전문 지식 데이터 포함 (QA 품질에 필수)",
    };
  }

  // shared/ 파일들도 핵심 인프라
  if (filePath.includes("/shared/") && qualitySignals > 3) {
    return {
      isQualityEssential: true,
      reason: "핵심 인프라 로직 (시스템 안정성에 필수)",
    };
  }

  // Boilerplate가 많으면 구조 문제
  if (boilerplateSignals > qualitySignals * 2) {
    return {
      isQualityEssential: false,
      reason: "중복 코드/boilerplate 다수 (리팩토링 권장)",
    };
  }

  // 기본: 신호 비율로 판단
  if (qualitySignals > 10) {
    return {
      isQualityEssential: true,
      reason: "도메인 지식/비즈니스 로직 집약 (품질 유지 필요)",
    };
  }

  return {
    isQualityEssential: false,
    reason: "구조 개선 가능 (모듈 분리 고려)",
  };
}

/**
 * 2. 대형 파일 (1000줄 이상) 탐지 + 품질 영향 분석
 */
function findLargeFiles(): CriticalIssue[] {
  log("\n🔍 Scanning large files (1000+ lines)...", "cyan");

  const largeFiles: {
    path: string;
    lines: number;
    isQualityEssential: boolean;
    reason: string;
  }[] = [];
  const searchDirs = ["src", "scripts"];

  for (const dir of searchDirs) {
    const dirPath = join(REPO_ROOT, dir);
    if (!existsSync(dirPath)) continue;

    const files = execCommand(
      `find ${dirPath} -name "*.ts" -type f ! -path "*/node_modules/*"`,
    )
      .split("\n")
      .filter(Boolean);

    for (const file of files) {
      const content = readFileSync(file, "utf-8");
      const lines = content.split("\n").length;
      if (lines >= 1000) {
        const relativePath = file.replace(REPO_ROOT + "/", "");
        const { isQualityEssential, reason } = analyzeFileQualityImpact(
          relativePath,
          content,
        );

        largeFiles.push({
          path: relativePath,
          lines,
          isQualityEssential,
          reason,
        });
      }
    }
  }

  // 품질 필수 파일과 구조 문제 파일 분리
  const qualityEssential = largeFiles.filter((f) => f.isQualityEssential);
  const structureIssues = largeFiles.filter((f) => !f.isQualityEssential);

  const issues: CriticalIssue[] = [];

  // 구조 문제 파일만 P1으로 보고
  if (structureIssues.length > 0) {
    issues.push({
      id: "large-files-structure",
      severity: "P1",
      category: "Code Structure",
      description: `${structureIssues.length}개의 거대 파일 (리팩토링 권장)`,
      impact: "유지보수성 저하, 코드 리뷰 어려움",
      files: structureIssues.map(
        (f) => `${f.path} (${f.lines} lines) - ${f.reason}`,
      ),
      suggestedFix: "모듈 분리 또는 중복 제거",
    });
  }

  // 품질 필수 파일은 P2 정보성으로만 보고
  if (qualityEssential.length > 0) {
    issues.push({
      id: "large-files-quality",
      severity: "P2",
      category: "Code Structure",
      description: `${qualityEssential.length}개의 거대 파일 (품질 유지 필요)`,
      impact: "크지만 도메인 지식/품질을 위해 필요한 크기",
      files: qualityEssential.map(
        (f) => `${f.path} (${f.lines} lines) - ${f.reason}`,
      ),
      suggestedFix: "신중한 검토 후에만 리팩토링 (품질 영향 확인 필수)",
    });
  }

  return issues;
}

/**
 * 3. Deprecated 파일 불일치 탐지
 */
function findDeprecatedMismatches(): CriticalIssue[] {
  log("\n🔍 Scanning deprecated file mismatches...", "cyan");

  const issues: CriticalIssue[] = [];

  // 문서에서 deprecated로 표시된 파일들
  const deprecatedInDocs = [
    "scripts/smart-maintenance-orchestrator.ts",
    "scripts/fix-orchestrator.ts",
    "scripts/unified-dashboard.ts",
  ];

  const existingDeprecated = deprecatedInDocs.filter((path) =>
    existsSync(join(REPO_ROOT, path)),
  );

  if (existingDeprecated.length > 0) {
    issues.push({
      id: "deprecated-still-exists",
      severity: "P1",
      category: "Documentation",
      description: `${existingDeprecated.length}개의 deprecated 파일이 여전히 존재`,
      impact: "개발자 혼란, 레거시 코드 참조 위험",
      files: existingDeprecated,
      suggestedFix: "파일 삭제 또는 legacy/ 디렉토리로 이동",
    });
  }

  return issues;
}

/**
 * 4. 백업 및 불필요한 파일 탐지
 */
function findUnnecessaryFiles(): CriticalIssue[] {
  log("\n🔍 Scanning unnecessary backup files...", "cyan");

  const patterns = [
    "**/*.backup",
    "**/*.old",
    "**/*.deprecated",
    ".system-backups",
  ];

  let foundFiles: string[] = [];

  for (const pattern of patterns) {
    const result = execCommand(
      `find . -name "${pattern}" ! -path "*/node_modules/*" ! -path "*/.git/*" 2>/dev/null || true`,
    );
    foundFiles = foundFiles.concat(result.split("\n").filter(Boolean));
  }

  if (foundFiles.length > 0) {
    const totalSize = foundFiles.reduce((sum, file) => {
      try {
        const stats = statSync(file);
        return sum + (stats.isDirectory() ? getDirSize(file) : stats.size);
      } catch {
        return sum;
      }
    }, 0);

    return [
      {
        id: "unnecessary-files",
        severity: "P2",
        category: "Cleanup",
        description: `${foundFiles.length}개의 불필요한 백업 파일 (${(totalSize / 1024 / 1024).toFixed(2)}MB)`,
        impact: "저장소 크기 증가, 혼란 유발",
        files: foundFiles.slice(0, 10), // 최대 10개만 표시
        count: foundFiles.length,
        suggestedFix:
          "rm -rf .system-backups && find . -name '*.backup' -delete",
      },
    ];
  }

  return [];
}

function getDirSize(dirPath: string): number {
  let size = 0;
  try {
    const files = readdirSync(dirPath);
    for (const file of files) {
      const fullPath = join(dirPath, file);
      const stats = statSync(fullPath);
      size += stats.isDirectory() ? getDirSize(fullPath) : stats.size;
    }
  } catch {
    // Ignore errors
  }
  return size;
}

/**
 * 5. 중복 의존성 탐지
 */
function findDuplicateDependencies(): CriticalIssue[] {
  log("\n🔍 Scanning duplicate dependencies...", "cyan");

  const result = execCommand("npm ls --all --json 2>/dev/null || true");
  if (!result) return [];

  try {
    const depsTree = JSON.parse(result);
    const duplicates = findDuplicatesInTree(depsTree);

    if (duplicates.length > 0) {
      return [
        {
          id: "duplicate-deps",
          severity: "P2",
          category: "Dependencies",
          description: `${duplicates.length}개의 중복 의존성 발견`,
          impact: "번들 크기 증가, 버전 충돌 위험",
          files: duplicates.slice(0, 10),
          count: duplicates.length,
          suggestedFix: "npm dedupe",
        },
      ];
    }
  } catch {
    // JSON parse error, skip
  }

  return [];
}

function findDuplicatesInTree(tree: any): string[] {
  const seen = new Map<string, Set<string>>();
  const duplicates: string[] = [];

  function traverse(node: any) {
    if (!node || !node.dependencies) return;

    for (const [name, dep] of Object.entries(node.dependencies as any)) {
      const depInfo = dep as any;
      const version = depInfo.version;
      if (!seen.has(name)) {
        seen.set(name, new Set([version]));
      } else {
        const versions = seen.get(name)!;
        if (!versions.has(version)) {
          versions.add(version);
          duplicates.push(`${name} (${Array.from(versions).join(", ")})`);
        }
      }
      traverse(depInfo);
    }
  }

  traverse(tree);
  return duplicates;
}

/**
 * 6. Dead Code 탐지 (export되지 않은 큰 함수/클래스)
 */
function findDeadCode(): CriticalIssue[] {
  log("\n🔍 Scanning for potential dead code...", "cyan");

  // ts-prune 같은 도구가 있으면 사용, 없으면 간단한 휴리스틱
  const result = execCommand(
    "npx ts-prune --error 2>/dev/null || echo 'ts-prune not available'",
  );

  if (result.includes("used in module")) {
    const lines = result.split("\n").filter((l) => l.includes("used in"));
    if (lines.length > 10) {
      return [
        {
          id: "dead-code",
          severity: "P2",
          category: "Code Quality",
          description: `${lines.length}개의 사용되지 않는 export 발견`,
          impact: "번들 크기 증가, 코드베이스 복잡도 증가",
          count: lines.length,
          suggestedFix: "사용되지 않는 export 제거",
        },
      ];
    }
  }

  return [];
}

/**
 * 7. 보안 취약점 스캔
 */
function scanSecurityVulnerabilities(): CriticalIssue[] {
  log("\n🔍 Scanning security vulnerabilities...", "cyan");

  const auditResult = execCommand("npm audit --json 2>/dev/null || true");
  if (!auditResult) return [];

  try {
    const audit = JSON.parse(auditResult);
    const vulnerabilities = audit.metadata?.vulnerabilities;

    if (
      vulnerabilities &&
      (vulnerabilities.critical > 0 || vulnerabilities.high > 0)
    ) {
      return [
        {
          id: "security-vulnerabilities",
          severity: vulnerabilities.critical > 0 ? "P0" : "P1",
          category: "Security",
          description: `${vulnerabilities.critical} critical, ${vulnerabilities.high} high vulnerabilities`,
          impact: "보안 위험, 프로덕션 배포 차단",
          suggestedFix: "npm audit fix",
        },
      ];
    }
  } catch {
    // Audit JSON parse error
  }

  return [];
}

/**
 * 8. Git 이슈 탐지 (커밋되지 않은 큰 파일 등)
 */
function findGitIssues(): CriticalIssue[] {
  log("\n🔍 Scanning git issues...", "cyan");

  const issues: CriticalIssue[] = [];

  // Uncommitted large files
  const status = execCommand("git status --porcelain");
  if (status) {
    const largeUncommitted = status
      .split("\n")
      .filter((line) => {
        const match = line.match(/^[AM]\s+(.+)$/);
        if (!match) return false;
        const file = match[1];
        try {
          const stats = statSync(join(REPO_ROOT, file));
          return stats.size > 1024 * 1024; // 1MB+
        } catch {
          return false;
        }
      })
      .map((line) => line.substring(3));

    if (largeUncommitted.length > 0) {
      issues.push({
        id: "large-uncommitted",
        severity: "P2",
        category: "Git",
        description: `${largeUncommitted.length}개의 큰 파일이 커밋되지 않음 (1MB+)`,
        impact: "저장소 크기 증가 위험",
        files: largeUncommitted,
        suggestedFix: ".gitignore 추가 또는 Git LFS 사용",
      });
    }
  }

  return issues;
}

// ===================================
// Main Execution
// ===================================

async function runDeepInspection(): Promise<DeepInspectionResult> {
  const startTime = Date.now();

  log("\n" + "=".repeat(60), "magenta");
  log("📡 Radar Engine v1.0 - System Issue Detection", "magenta");
  log("=".repeat(60) + "\n", "magenta");
  log("정밀 시스템 스캔 시작...\n", "cyan");

  const allIssues: CriticalIssue[] = [];

  // Run all checks
  allIssues.push(...findUntestedCriticalFiles());
  allIssues.push(...findLargeFiles());
  allIssues.push(...findDeprecatedMismatches());
  allIssues.push(...findUnnecessaryFiles());
  allIssues.push(...findDuplicateDependencies());
  allIssues.push(...findDeadCode());
  allIssues.push(...scanSecurityVulnerabilities());
  allIssues.push(...findGitIssues());

  const p0Issues = allIssues.filter((i) => i.severity === "P0");
  const p1Issues = allIssues.filter((i) => i.severity === "P1");
  const p2Issues = allIssues.filter((i) => i.severity === "P2");

  // Calculate health score
  const healthScore = Math.max(
    0,
    100 - p0Issues.length * 20 - p1Issues.length * 10 - p2Issues.length * 5,
  );

  // Generate recommendations
  const recommendations: Recommendation[] = [];

  if (p0Issues.length > 0) {
    recommendations.push({
      priority: "high",
      action: "P0 이슈 즉시 해결",
      reason: "치명적 문제로 시스템 안정성에 영향",
      command: "npm run fix",
    });
  }

  if (p1Issues.length > 0) {
    recommendations.push({
      priority: "high",
      action: "P1 이슈 1주일 내 해결",
      reason: "중요한 개선 사항",
    });
  }

  if (allIssues.some((i) => i.id === "unnecessary-files")) {
    recommendations.push({
      priority: "medium",
      action: "불필요한 백업 파일 삭제",
      reason: "저장소 크기 감소, 혼란 제거",
      command:
        "rm -rf .system-backups && find . -name '*.backup' -o -name '*.old' | xargs rm",
    });
  }

  const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);

  const result: DeepInspectionResult = {
    timestamp: new Date().toISOString(),
    criticalIssues: allIssues,
    healthScore,
    recommendations,
    summary: {
      totalIssues: allIssues.length,
      p0Count: p0Issues.length,
      p1Count: p1Issues.length,
      p2Count: p2Issues.length,
      filesScanned: 0, // TODO: count actual files scanned
      timeElapsed: `${elapsedTime}s`,
    },
  };

  // Print results
  printResults(result);

  return result;
}

function printResults(result: DeepInspectionResult): void {
  log("\n" + "=".repeat(60), "magenta");
  log("📊 Deep Inspection Results", "magenta");
  log("=".repeat(60) + "\n", "magenta");

  // Health Score
  const scoreColor =
    result.healthScore >= 80
      ? "green"
      : result.healthScore >= 60
        ? "yellow"
        : "red";
  log(
    `🎯 Health Score: ${result.healthScore}/100\n`,
    scoreColor as keyof typeof colors,
  );

  // Summary
  log(`📋 Summary:`, "cyan");
  log(`   Total Issues: ${result.summary.totalIssues}`);
  log(`   🔴 P0 Critical: ${result.summary.p0Count}`);
  log(`   🟡 P1 High: ${result.summary.p1Count}`);
  log(`   🟢 P2 Medium: ${result.summary.p2Count}`);
  log(`   ⏱️  Time: ${result.summary.timeElapsed}\n`);

  // Critical Issues
  if (result.criticalIssues.length > 0) {
    log("🔍 Critical Issues:\n", "yellow");

    for (const issue of result.criticalIssues) {
      const severityColor =
        issue.severity === "P0"
          ? "red"
          : issue.severity === "P1"
            ? "yellow"
            : "cyan";
      log(
        `   [${issue.severity}] ${issue.category}: ${issue.description}`,
        severityColor as keyof typeof colors,
      );
      log(`   Impact: ${issue.impact}`);

      if (issue.files && issue.files.length > 0) {
        const displayFiles = issue.files.slice(0, 5);
        log(`   Files (${issue.count || issue.files.length}):`);
        displayFiles.forEach((f) => log(`     - ${f}`));
        if (issue.files.length > 5) {
          log(`     ... and ${issue.files.length - 5} more`);
        }
      }

      if (issue.suggestedFix) {
        log(`   💡 Fix: ${issue.suggestedFix}`, "green");
      }
      log("");
    }
  } else {
    log("✅ No critical issues found!\n", "green");
  }

  // Recommendations
  if (result.recommendations.length > 0) {
    log("🚀 Recommended Actions:\n", "cyan");
    result.recommendations.forEach((rec, i) => {
      log(`   ${i + 1}. [${rec.priority.toUpperCase()}] ${rec.action}`);
      log(`      Reason: ${rec.reason}`);
      if (rec.command) {
        log(`      Command: ${rec.command}`, "green");
      }
      log("");
    });
  }

  log("=".repeat(60), "magenta");
  log("✅ Radar Scan Complete", "green");
  log("=".repeat(60) + "\n", "magenta");

  // Final one-line summary
  const summaryText = `Health: ${result.healthScore}/100 | Issues: ${result.summary.totalIssues} (P0: ${result.summary.p0Count}, P1: ${result.summary.p1Count}, P2: ${result.summary.p2Count}) | Time: ${result.summary.timeElapsed}`;
  log(`\n📊 ${summaryText}\n`, "cyan");

  if (result.summary.p0Count > 0) {
    log("⚠️  CRITICAL: Run `/fix` to address P0 issues immediately!\n", "red");
  } else if (result.summary.p1Count > 0) {
    log("ℹ️  Run `/fix` to address P1 issues within 1 week.\n", "yellow");
  } else {
    log("✨ System is healthy! No critical issues detected.\n", "green");
  }
}

// Run
runDeepInspection().catch((error) => {
  log(`\n❌ Error: ${error.message}`, "red");
  process.exit(1);
});
