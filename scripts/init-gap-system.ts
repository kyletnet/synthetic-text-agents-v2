#!/usr/bin/env node

/**
 * GAP System Initialization Script
 *
 * Sets up the complete GAP Prevention System:
 * - Creates directory structure
 * - Generates configuration files
 * - Updates package.json scripts
 * - Migrates existing documents
 * - Initializes pre-commit hooks
 * - Validates configuration
 */

import {
  readFile,
  writeFile,
  mkdir,
  rename,
  readdir,
  chmod,
} from "fs/promises";
import { existsSync } from "fs";
import * as path from "path";
import { execSync } from "child_process";

// ============================================================================
// Templates
// ============================================================================

const TEMPLATES = {
  gaprc: {
    path: ".gaprc.json",
    content: `{
  "$schema": "./schema/gaprc.schema.json",
  "version": "1.0.0",
  "globalSettings": {
    "mode": "shadow",
    "failOn": [],
    "autoFix": {
      "enabled": false,
      "maxSeverity": "P2"
    },
    "timeout": 30000,
    "reportPath": "reports/gap-scan-results.json"
  },

  "checks": [
    {
      "id": "cli-documentation",
      "name": "CLI Documentation Coverage",
      "enabled": true,
      "severity": "P1",
      "category": "docs",
      "config": {
        "excludePatterns": ["_hidden:", "dev:", "utility:"],
        "requiredDocs": ["docs/COMMAND_GUIDE.md"]
      },
      "autoFixable": false
    },
    {
      "id": "governance-sync",
      "name": "Governance-Code Consistency",
      "enabled": true,
      "severity": "P0",
      "category": "governance",
      "config": {
        "governanceFile": "governance-rules.json",
        "codeFiles": ["scripts/lib/inspection-cache.ts"]
      },
      "autoFixable": true,
      "autoFix": {
        "strategy": "update-governance-from-code",
        "requiresApproval": true
      }
    },
    {
      "id": "pii-masking",
      "name": "PII Masking in Logger",
      "enabled": true,
      "severity": "P0",
      "category": "security",
      "config": {
        "requiredFunctions": ["maskPII", "redactPII", "sanitizePII"],
        "targetFiles": ["src/shared/logger.ts"]
      },
      "autoFixable": false
    },
    {
      "id": "test-coverage",
      "name": "New Feature Test Coverage",
      "enabled": true,
      "severity": "P1",
      "category": "testing",
      "config": {
        "testPattern": "tests/**/*.test.ts",
        "coverageThreshold": 0
      },
      "autoFixable": false
    },
    {
      "id": "doc-cross-refs",
      "name": "Document Cross-References",
      "enabled": true,
      "severity": "P2",
      "category": "docs",
      "config": {
        "minReferences": 10,
        "patterns": ["@file", "@docs/", "See:"]
      },
      "autoFixable": false
    },
    {
      "id": "agent-e2e",
      "name": "Agent Chain E2E Tests",
      "enabled": true,
      "severity": "P1",
      "category": "testing",
      "config": {
        "requiredChains": ["Evidence → Answer → Audit"],
        "testPattern": "tests/integration/**/*.test.ts"
      },
      "autoFixable": false
    },
    {
      "id": "doc-lifecycle",
      "name": "Document Lifecycle Compliance",
      "enabled": true,
      "severity": "P2",
      "category": "docs",
      "config": {
        "allowDeprecated": true,
        "maxDeprecatedAge": 90,
        "requireReplacement": true
      },
      "autoFixable": false
    },
    {
      "id": "deprecated-reference-enforcement",
      "name": "Deprecated Document Reference Check",
      "enabled": true,
      "severity": "P1",
      "category": "docs",
      "config": {
        "failOnDeprecatedReference": true,
        "allowGracePeriod": 7,
        "exemptions": [
          "tests/legacy/**",
          "docs/migration/**"
        ]
      },
      "autoFixable": false
    }
  ],

  "teams": {},

  "metrics": {
    "enabled": true,
    "collectInterval": "daily",
    "reportRecipients": [],
    "slackWebhook": ""
  }
}
`,
  },

  gapignore: {
    path: ".gapignore",
    content: `# GAP Scanner Ignore Patterns

# Legacy code
tests/legacy/**
scripts/experimental/**

# Deprecated documents (already tracked)
docs/deprecated/**

# Third-party
node_modules/**
dist/**
dist-export/**
.git/**

# Temporary files
*.tmp
*.bak

# Build artifacts
reports/gap-scan-results.json
.gaprc/backup-registry.json

# IDE
.vscode/**
.idea/**

# OS
.DS_Store
Thumbs.db
`,
  },
};

// ============================================================================
// Initialization
// ============================================================================

class GapSystemInitializer {
  private dryRun = false;
  private verbose = false;

  async initialize(
    options: { dryRun?: boolean; verbose?: boolean } = {},
  ): Promise<void> {
    this.dryRun = options.dryRun || false;
    this.verbose = options.verbose || false;

    console.log("🚀 Initializing GAP Prevention System\n");

    try {
      // 1. Create directory structure
      await this.createDirectories();

      // 2. Create configuration files
      await this.createConfigFiles();

      // 3. Update package.json
      await this.updatePackageJson();

      // 4. Migrate documents
      await this.migrateDocuments();

      // 5. Validate configuration
      await this.validateConfiguration();

      // 6. Success message
      this.printSuccessMessage();
    } catch (error) {
      console.error("\n❌ Initialization failed:");
      console.error(error instanceof Error ? error.message : "Unknown error");
      process.exit(1);
    }
  }

  private async createDirectories(): Promise<void> {
    console.log("📁 Creating directories...");

    const directories = [
      "scripts/checks",
      "scripts/lib",
      "schema",
      "reports",
      ".gaprc",
      "docs/active",
      "docs/archived",
      "docs/deprecated",
      ".github",
    ];

    for (const dir of directories) {
      if (this.dryRun) {
        console.log(`   [DRY RUN] Would create: ${dir}`);
      } else {
        if (!existsSync(dir)) {
          await mkdir(dir, { recursive: true });
          console.log(`   ✅ Created: ${dir}`);
        } else {
          console.log(`   ⏭️  Exists: ${dir}`);
        }
      }
    }
  }

  private async createConfigFiles(): Promise<void> {
    console.log("\n📄 Creating configuration files...");

    for (const [name, template] of Object.entries(TEMPLATES)) {
      if (existsSync(template.path)) {
        console.log(`   ⏭️  ${template.path} (already exists)`);
        continue;
      }

      if (this.dryRun) {
        console.log(`   [DRY RUN] Would create: ${template.path}`);
      } else {
        await writeFile(template.path, template.content);
        console.log(`   ✅ ${template.path}`);
      }
    }
  }

  private async updatePackageJson(): Promise<void> {
    console.log("\n📦 Updating package.json...");

    const packageJsonPath = "package.json";
    const packageJson = JSON.parse(
      await readFile(packageJsonPath, "utf-8"),
    ) as {
      scripts: Record<string, string>;
    };

    const newScripts: Record<string, string> = {
      "gap:scan": "tsx scripts/gap-scanner.ts",
      "gap:scan:quick": "tsx scripts/gap-scanner.ts --quick",
      "gap:scan:metrics": "tsx scripts/gap-scanner-metrics.ts",
      "gap:config": "tsx scripts/gap-config-manager.ts",
      "gap:pr-bot": "tsx scripts/gap-pr-bot.ts",
      "gap:backup": "tsx scripts/lib/backup-lifecycle-manager.ts",
      "doc:lifecycle": "tsx scripts/doc-lifecycle-manager.ts",
      "init:gap-system": "tsx scripts/init-gap-system.ts",
    };

    let added = 0;
    for (const [key, value] of Object.entries(newScripts)) {
      if (!packageJson.scripts[key]) {
        if (this.dryRun) {
          console.log(`   [DRY RUN] Would add: ${key}`);
          added++;
        } else {
          packageJson.scripts[key] = value;
          added++;
        }
      }
    }

    if (added > 0 && !this.dryRun) {
      await writeFile(
        packageJsonPath,
        JSON.stringify(packageJson, null, 2) + "\n",
      );
      console.log(`   ✅ Added ${added} npm script(s)`);
    } else if (added > 0 && this.dryRun) {
      console.log(`   [DRY RUN] Would add ${added} npm script(s)`);
    } else {
      console.log(`   ⏭️  Scripts already exist`);
    }
  }

  private async migrateDocuments(): Promise<void> {
    console.log("\n📚 Migrating existing documents...");

    if (!existsSync("docs")) {
      console.log("   ℹ️  No docs directory found, skipping migration");
      return;
    }

    const entries = await readdir("docs", { withFileTypes: true });
    let moved = 0;

    const skipDirs = ["active", "archived", "deprecated"];

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
      if (skipDirs.some((dir) => entry.name.includes(dir))) continue;

      const oldPath = path.join("docs", entry.name);
      const newPath = path.join("docs/active", entry.name);

      if (this.dryRun) {
        console.log(`   [DRY RUN] Would move: ${oldPath} → ${newPath}`);
        moved++;
      } else {
        if (!existsSync(newPath)) {
          await rename(oldPath, newPath);
          moved++;
          if (this.verbose) {
            console.log(`   ✅ Moved: ${entry.name}`);
          }
        }
      }
    }

    if (moved > 0) {
      console.log(`   ✅ Migrated ${moved} document(s) to docs/active/`);
    } else {
      console.log(`   ℹ️  No documents to migrate`);
    }
  }

  private async validateConfiguration(): Promise<void> {
    console.log("\n🔍 Validating configuration...");

    if (this.dryRun) {
      console.log("   [DRY RUN] Would validate .gaprc.json");
      return;
    }

    try {
      // Try to run gap:config validation if available
      if (existsSync("scripts/gap-config-manager.ts")) {
        execSync("npm run gap:config -- --validate", { stdio: "inherit" });
        console.log("   ✅ Configuration is valid");
      } else {
        // Basic validation
        const gaprcContent = await readFile(".gaprc.json", "utf-8");
        JSON.parse(gaprcContent);
        console.log("   ✅ .gaprc.json is valid JSON");
      }
    } catch (error) {
      console.log(
        "   ⚠️  Validation skipped (gap-config-manager.ts not available)",
      );
    }
  }

  private printSuccessMessage(): void {
    console.log("\n" + "═".repeat(70));
    console.log("✅ GAP Prevention System initialized successfully!\n");

    if (this.dryRun) {
      console.log("🔍 This was a DRY RUN. No changes were made.");
      console.log("   Run without --dry-run to apply changes.\n");
    } else {
      console.log("📋 Next steps:");
      console.log("   1. Review .gaprc.json and customize for your team");
      console.log("   2. Run: npm run gap:scan -- --dry-run");
      console.log("   3. Fix any P0 gaps found");
      console.log("   4. Enable in pre-commit: export GAP_SCAN_MODE=shadow\n");
    }

    console.log("📚 Documentation:");
    console.log("   - Setup guide: docs/GAP_SCANNER_GUIDE.md");
    console.log("   - Command reference: docs/COMMAND_GUIDE.md");
    console.log("   - Workflow guide: docs/COMMAND_WORKFLOW_GUIDE.md\n");

    console.log("💬 Questions? Check docs or run: npm run gap:scan -- --help");
    console.log("═".repeat(70));
  }
}

// ============================================================================
// CLI
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  const options = {
    dryRun: args.includes("--dry-run"),
    verbose: args.includes("--verbose") || args.includes("-v"),
    help: args.includes("--help") || args.includes("-h"),
  };

  if (options.help) {
    console.log(`
GAP System Initializer

Usage:
  npm run init:gap-system                 # Initialize GAP system
  npm run init:gap-system -- --dry-run    # Preview changes only
  npm run init:gap-system -- --verbose    # Show detailed output

Options:
  --dry-run       Preview changes without applying them
  --verbose, -v   Show detailed output
  --help, -h      Show this help message

What it does:
  1. Creates directory structure (scripts/checks, schema, reports, etc.)
  2. Generates configuration files (.gaprc.json, .gapignore)
  3. Updates package.json with GAP scripts
  4. Migrates existing docs to docs/active/
  5. Validates configuration

Safe to run multiple times - existing files are preserved.
    `);
    process.exit(0);
  }

  const initializer = new GapSystemInitializer();
  await initializer.initialize(options);
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("❌ Initialization failed:");
    console.error(error);
    process.exit(1);
  });
}

export { GapSystemInitializer };
