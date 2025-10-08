/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Infrastructure: File Gap Scanner
 *
 * Concrete implementations of gap detectors that scan files and directories.
 * These detectors interact with the file system and external tools.
 */

import { readFile, writeFile, appendFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { execSync } from "child_process";
import { glob } from "glob";
import * as path from "path";

import type {
  Gap,
  GapDetectionContext,
} from "../../domain/analysis/gap-types.js";
import {
  BaseGapDetector,
  DocumentLifecycleRules,
  GracePeriodRules,
} from "../../domain/analysis/gap-detector.js";

// ============================================================================
// CLI Documentation Detector
// ============================================================================

export class CLIDocumentationDetector extends BaseGapDetector {
  constructor() {
    super("cli-documentation");
  }

  async detect(context: GapDetectionContext): Promise<readonly Gap[]> {
    const packageJson = JSON.parse(await readFile("package.json", "utf-8"));
    const scripts = Object.keys(packageJson.scripts);

    const excludePatterns = (context.config?.excludePatterns as string[]) || [];
    const requiredDocs = (context.config?.requiredDocs as string[]) || [];

    const gaps: Gap[] = [];

    for (const requiredDoc of requiredDocs) {
      if (!existsSync(requiredDoc)) continue;

      const docContent = await readFile(requiredDoc, "utf-8");

      for (const script of scripts) {
        // Skip excluded patterns
        if (excludePatterns.some((pattern) => script.startsWith(pattern))) {
          continue;
        }

        // Check if script is documented
        if (!docContent.includes(script)) {
          gaps.push(
            this.createGap(context, {
              id: `cli-doc-${script}`,
              title: `Undocumented CLI command: ${script}`,
              description: `'${script}' exists in package.json but not documented in ${requiredDoc}`,
              details: {
                command: script,
                documentation: requiredDoc,
              },
            }),
          );
        }
      }
    }

    return gaps;
  }
}

// ============================================================================
// Governance Sync Detector
// ============================================================================

export class GovernanceSyncDetector extends BaseGapDetector {
  constructor() {
    super("governance-sync");
  }

  async detect(context: GapDetectionContext): Promise<readonly Gap[]> {
    const governanceFile = context.config?.governanceFile as string;
    const codeFiles = (context.config?.codeFiles as string[]) || [];

    if (!existsSync(governanceFile)) {
      return [];
    }

    const governanceRules = JSON.parse(await readFile(governanceFile, "utf-8"));
    const gaps: Gap[] = [];

    // Check CACHE_TTL consistency
    const cacheTtlRule = governanceRules.rules?.find(
      (r: { id: string }) => r.id === "CACHE_TTL",
    );

    if (cacheTtlRule && codeFiles.length > 0) {
      for (const codeFile of codeFiles) {
        if (!existsSync(codeFile)) continue;

        const codeContent = await readFile(codeFile, "utf-8");
        const ttlMatch = codeContent.match(/TTL_SECONDS\s*=\s*(\d+)/);

        if (ttlMatch) {
          const codeTtl = parseInt(ttlMatch[1]);
          const ruleTtl = cacheTtlRule.ttlSeconds;

          if (codeTtl !== ruleTtl) {
            gaps.push(
              this.createGap(context, {
                id: "governance-ttl-mismatch",
                title: "Governance rule mismatch: CACHE_TTL",
                description: `Code: ${codeTtl}s, Governance: ${ruleTtl}s`,
                details: {
                  codeFile,
                  codeTtl,
                  ruleTtl,
                },
                fix: async () => {
                  // Auto-fix: Update governance to match code
                  cacheTtlRule.ttlSeconds = codeTtl;
                  cacheTtlRule.description = `${codeTtl / 60}분 TTL 엄수`;
                  await writeFile(
                    governanceFile,
                    JSON.stringify(governanceRules, null, 2) + "\n",
                  );
                },
              }),
            );
          }
        }
      }
    }

    return gaps;
  }
}

// ============================================================================
// PII Masking Detector
// ============================================================================

export class PIIMaskingDetector extends BaseGapDetector {
  constructor() {
    super("pii-masking");
  }

  async detect(context: GapDetectionContext): Promise<readonly Gap[]> {
    const requiredFunctions =
      (context.config?.requiredFunctions as string[]) || [];
    const targetFiles = (context.config?.targetFiles as string[]) || [];

    const gaps: Gap[] = [];

    for (const targetFile of targetFiles) {
      if (!existsSync(targetFile)) continue;

      const content = await readFile(targetFile, "utf-8");

      const missingFunctions = requiredFunctions.filter(
        (fn) => !content.includes(fn),
      );

      if (missingFunctions.length > 0) {
        gaps.push(
          this.createGap(context, {
            id: "pii-masking-missing",
            title: `PII masking not implemented in ${path.basename(
              targetFile,
            )}`,
            description: `Missing functions: ${missingFunctions.join(", ")}`,
            details: {
              file: targetFile,
              missingFunctions,
            },
          }),
        );
      }
    }

    return gaps;
  }
}

// ============================================================================
// Test Coverage Detector
// ============================================================================

export class TestCoverageDetector extends BaseGapDetector {
  constructor() {
    super("test-coverage");
  }

  async detect(context: GapDetectionContext): Promise<readonly Gap[]> {
    const gaps: Gap[] = [];

    try {
      // Get recently added files (last commit)
      const newFiles = execSync(
        "git diff --name-only --diff-filter=A HEAD~1 HEAD scripts/",
        {
          encoding: "utf-8",
        },
      )
        .trim()
        .split("\n")
        .filter(Boolean);

      for (const file of newFiles) {
        if (!file.endsWith(".ts")) continue;

        const testFile = file
          .replace("scripts/", "tests/")
          .replace(".ts", ".test.ts");

        if (!existsSync(testFile)) {
          gaps.push(
            this.createGap(context, {
              id: `test-coverage-${path.basename(file)}`,
              title: `Missing test: ${path.basename(file)}`,
              description: `New file ${file} has no corresponding test`,
              details: {
                file,
                expectedTest: testFile,
              },
            }),
          );
        }
      }
    } catch {
      // No git history or no new files - skip
    }

    return gaps;
  }
}

// ============================================================================
// Document Cross-References Detector
// ============================================================================

export class DocCrossRefsDetector extends BaseGapDetector {
  constructor() {
    super("doc-cross-refs");
  }

  async detect(context: GapDetectionContext): Promise<readonly Gap[]> {
    const minReferences = (context.config?.minReferences as number) || 10;
    const patterns = (context.config?.patterns as string[]) || [];

    const docFiles = await glob("docs/**/*.md");
    let totalRefs = 0;

    for (const file of docFiles) {
      const content = await readFile(file, "utf-8");

      for (const pattern of patterns) {
        const regex = new RegExp(pattern, "g");
        const matches = content.match(regex) || [];
        totalRefs += matches.length;
      }
    }

    if (totalRefs < minReferences) {
      return [
        this.createGap(context, {
          id: "doc-cross-refs-insufficient",
          title: "Insufficient document cross-references",
          description: `Only ${totalRefs} cross-references found (minimum: ${minReferences})`,
          details: {
            found: totalRefs,
            minimum: minReferences,
            patterns,
          },
        }),
      ];
    }

    return [];
  }
}

// ============================================================================
// Agent E2E Detector
// ============================================================================

export class AgentE2EDetector extends BaseGapDetector {
  constructor() {
    super("agent-e2e");
  }

  async detect(context: GapDetectionContext): Promise<readonly Gap[]> {
    const requiredChains = (context.config?.requiredChains as string[]) || [];
    const testPattern =
      (context.config?.testPattern as string) || "tests/**/*.test.ts";

    const testFiles = await glob(testPattern);
    let hasE2E = false;

    for (const file of testFiles) {
      const content = await readFile(file, "utf-8");

      // Check if test covers agent chain
      const hasAllAgents = requiredChains.every((chain) => {
        const agents = chain.split("→").map((a) => a.trim());
        return agents.every((agent) => content.includes(agent));
      });

      if (hasAllAgents) {
        hasE2E = true;
        break;
      }
    }

    if (!hasE2E) {
      return [
        this.createGap(context, {
          id: "agent-e2e-missing",
          title: "Agent chain E2E test missing",
          description: `No test covers: ${requiredChains.join(", ")}`,
          details: {
            requiredChains,
            testPattern,
          },
        }),
      ];
    }

    return [];
  }
}

// ============================================================================
// Archived Docs Reactivation Detector
// ============================================================================

export class ArchivedDocsReactivationDetector extends BaseGapDetector {
  constructor() {
    super("archived-docs-reactivation");
  }

  async detect(context: GapDetectionContext): Promise<readonly Gap[]> {
    const archivedPath =
      (context.config?.archivedPath as string) || "docs/archived/**";
    const archivedDocs = await glob(archivedPath);

    const gaps: Gap[] = [];

    for (const archivedDoc of archivedDocs) {
      const references: string[] = [];

      // Search in active docs
      const activeDocs = await glob("docs/active/**/*.md");
      for (const activeDoc of activeDocs) {
        const content = await readFile(activeDoc, "utf-8");
        const docName = path.basename(archivedDoc);

        if (content.includes(docName) || content.includes(archivedDoc)) {
          references.push(activeDoc);
        }
      }

      // Search in source code
      const sourceFiles = await glob("src/**/*.ts");
      for (const sourceFile of sourceFiles) {
        const content = await readFile(sourceFile, "utf-8");
        const docName = path.basename(archivedDoc);

        if (content.includes(docName) || content.includes(archivedDoc)) {
          references.push(sourceFile);
        }
      }

      if (references.length > 0) {
        gaps.push(
          this.createGap(context, {
            id: `archived-reactivation-${path.basename(archivedDoc)}`,
            title: `Archived document referenced: ${path.basename(
              archivedDoc,
            )}`,
            description: `${references.length} reference(s) to archived document. Consider reactivating or updating references.`,
            details: {
              archivedDoc,
              references,
              action:
                "Move back to docs/active/ if still needed, or remove references",
            },
          }),
        );
      }
    }

    return gaps;
  }
}

// ============================================================================
// Document Lifecycle Detector
// ============================================================================

export class DocLifecycleDetector extends BaseGapDetector {
  constructor() {
    super("doc-lifecycle");
  }

  async detect(context: GapDetectionContext): Promise<readonly Gap[]> {
    const maxDeprecatedAge = (context.config?.maxDeprecatedAge as number) || 90;
    const requireReplacement =
      (context.config?.requireReplacement as boolean) ?? true;

    const deprecatedDocs = await glob("docs/deprecated/**/*.md");
    const gaps: Gap[] = [];

    for (const doc of deprecatedDocs) {
      try {
        const content = await readFile(doc, "utf-8");

        if (!DocumentLifecycleRules.hasFrontmatter(content)) {
          gaps.push(
            this.createGap(context, {
              id: `lifecycle-no-metadata-${path.basename(doc)}`,
              title: `Deprecated doc missing metadata: ${path.basename(doc)}`,
              description: `Deprecated document has no frontmatter with deprecation date`,
              details: {
                doc,
                action: "Add frontmatter with deprecatedDate and replacedBy",
              },
            }),
          );
          continue;
        }

        const frontmatter = DocumentLifecycleRules.extractFrontmatter(content);

        if (!frontmatter?.deprecatedDate) {
          gaps.push(
            this.createGap(context, {
              id: `lifecycle-no-date-${path.basename(doc)}`,
              title: `Deprecated doc missing date: ${path.basename(doc)}`,
              description: `No deprecatedDate field in frontmatter`,
              details: { doc },
            }),
          );
          continue;
        }

        // Check age
        if (
          DocumentLifecycleRules.isTooOld(
            frontmatter.deprecatedDate,
            maxDeprecatedAge,
          )
        ) {
          const ageInDays = GracePeriodRules.daysSince(
            frontmatter.deprecatedDate,
          );
          gaps.push(
            this.createGap(context, {
              id: `lifecycle-too-old-${path.basename(doc)}`,
              title: `Deprecated doc too old: ${path.basename(doc)}`,
              description: `Deprecated ${ageInDays} days ago (max: ${maxDeprecatedAge} days)`,
              details: {
                doc,
                ageInDays,
                maxAge: maxDeprecatedAge,
                action: "Archive or delete this document",
              },
            }),
          );
        }

        // Check replacement
        if (
          requireReplacement &&
          !DocumentLifecycleRules.hasReplacement(frontmatter)
        ) {
          gaps.push(
            this.createGap(context, {
              id: `lifecycle-no-replacement-${path.basename(doc)}`,
              title: `Deprecated doc missing replacement: ${path.basename(
                doc,
              )}`,
              description: `No replacedBy field specified`,
              details: {
                doc,
                action: "Add replacedBy field with new document path",
              },
            }),
          );
        }
      } catch {
        // Skip files that can't be read
      }
    }

    return gaps;
  }
}

// ============================================================================
// Deprecated Reference Enforcement Detector
// ============================================================================

export class DeprecatedReferenceEnforcementDetector extends BaseGapDetector {
  constructor() {
    super("deprecated-reference-enforcement");
  }

  async detect(context: GapDetectionContext): Promise<readonly Gap[]> {
    const gracePeriod = (context.config?.allowGracePeriod as number) || 7;
    const exemptions = (context.config?.exemptions as string[]) || [];

    const deprecatedDocs = await glob("docs/deprecated/**/*.md");
    const gaps: Gap[] = [];

    for (const deprecatedDoc of deprecatedDocs) {
      try {
        const content = await readFile(deprecatedDoc, "utf-8");
        const frontmatter = DocumentLifecycleRules.extractFrontmatter(content);

        let daysSinceDeprecation = 0;
        if (frontmatter?.deprecatedDate) {
          daysSinceDeprecation = GracePeriodRules.daysSince(
            frontmatter.deprecatedDate,
          );
        }

        // Find references
        const references: string[] = [];

        const sourceFiles = await glob("**/*.{ts,md,tsx,js}", {
          ignore: [
            "node_modules/**",
            "dist/**",
            "docs/deprecated/**",
            ...exemptions,
          ],
        });

        const docName = path.basename(deprecatedDoc);
        const docPath = deprecatedDoc;

        for (const sourceFile of sourceFiles) {
          const fileContent = await readFile(sourceFile, "utf-8");

          if (fileContent.includes(docName) || fileContent.includes(docPath)) {
            references.push(sourceFile);
          }
        }

        if (references.length === 0) continue;

        // Determine severity based on grace period
        const inGracePeriod = frontmatter?.deprecatedDate
          ? GracePeriodRules.isInGracePeriod(
              frontmatter.deprecatedDate,
              gracePeriod,
            )
          : false;

        const severity = inGracePeriod ? "P2" : context.severity;

        const gracePeriodRemaining = frontmatter?.deprecatedDate
          ? GracePeriodRules.remainingGracePeriodDays(
              frontmatter.deprecatedDate,
              gracePeriod,
            )
          : 0;

        gaps.push({
          ...this.createGap(
            { ...context, severity },
            {
              id: `deprecated-ref-${path.basename(deprecatedDoc)}`,
              title: `Deprecated doc referenced: ${path.basename(
                deprecatedDoc,
              )}`,
              description: inGracePeriod
                ? `${references.length} reference(s) found. Grace period ends in ${gracePeriodRemaining} day(s)`
                : `${references.length} reference(s) to deprecated doc. Grace period expired.`,
              details: {
                deprecatedDoc,
                references,
                daysSinceDeprecation,
                gracePeriodRemaining,
                action: inGracePeriod
                  ? "Update references before grace period expires"
                  : "URGENT: Update all references immediately",
              },
            },
          ),
          severity,
        });
      } catch {
        // Skip files that can't be processed
      }
    }

    return gaps;
  }
}

// ============================================================================
// Configuration Override Logger
// ============================================================================

export class ConfigurationOverrideLogger {
  async logOverride(override: {
    user: string;
    originalMode: string;
    overrideMode: string;
    timestamp: Date;
    ci: boolean;
  }): Promise<void> {
    try {
      // Ensure reports directory exists
      if (!existsSync("reports")) {
        await mkdir("reports", { recursive: true });
      }

      const logEntry = {
        ...override,
        timestamp: override.timestamp.toISOString(),
      };

      await appendFile(
        "reports/gap-override.log",
        JSON.stringify(logEntry) + "\n",
      );
    } catch (error) {
      // Log to console if file logging fails
      console.warn("Warning: Could not log override to file");
    }
  }
}
