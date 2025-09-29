#!/usr/bin/env tsx

import {
  EnhancedExporter,
  parseExportArgs,
  validateExportOptions,
  _____ExportOptions,
} from "./export_enhanced.js";

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    showUsage();
    process.exit(0);
  }

  try {
    // Parse command line arguments
    const options = parseExportArgs(args);

    // Validate required options
    const validationErrors = validateExportOptions(options);
    if (validationErrors.length > 0) {
      console.error("❌ Validation errors:");
      for (const error of validationErrors) {
        console.error(`  - ${error}`);
      }
      console.error("");
      showUsage();
      process.exit(1);
    }

    // Initialize exporter
    const exporter = new EnhancedExporter();

    // Run export
    console.log(`🚀 Starting enhanced export...`);
    console.log(`   Source: ${options.source}`);
    console.log(`   Format: ${options.format}`);
    console.log(`   Run ID: ${options.runId}`);
    console.log(
      `   Output: ${options.outputDir}/${options.runId}/${options.source}.${options.format}`,
    );
    console.log(`   Dry run: ${options.dryRun || false}`);
    console.log("");

    const result = await exporter.export(options);

    if (result.success) {
      console.log("✅ Export completed successfully!");
      console.log(`📁 Output: ${result.outputPath}`);
      console.log(`📊 Records: ${result.recordCount}`);

      if (result.version && result.version > 1) {
        console.log(`📝 Version: ${result.version} (file already existed)`);
      }

      if (result.warnings && result.warnings.length > 0) {
        console.log("⚠️  Warnings:");
        for (const warning of result.warnings) {
          console.log(`   - ${warning}`);
        }
      }

      if (result.validationErrors && result.validationErrors.length > 0) {
        console.log("⚠️  Schema validation issues:");
        for (const error of result.validationErrors) {
          console.log(`   - ${error}`);
        }
      }

      // Validate final output
      const validation = await exporter.validateExportResult(result.outputPath);
      if (validation.valid) {
        console.log("✅ Output validation: PASSED");
      } else {
        console.log("⚠️  Output validation issues:");
        for (const error of validation.errors || []) {
          console.log(`   - ${error}`);
        }
      }

      process.exit(0);
    } else {
      console.error("❌ Export failed");
      process.exit(1);
    }
  } catch (error) {
    console.error("💥 Export error:", error);
    process.exit(1);
  }
}

function showUsage() {
  console.log("Enhanced Export CLI - v1.5");
  console.log("");
  console.log("Usage: tsx scripts/lib/export_enhanced_cli.ts [OPTIONS]");
  console.log("");
  console.log("Required options:");
  console.log("  --source <baseline|session>    Source type to export");
  console.log("  --format <csv|json>           Output format");
  console.log("  --run-id <RUN_ID>             Run ID to export");
  console.log("");
  console.log("Optional:");
  console.log(
    "  --output-dir <DIR>            Output directory (default: reports/export)",
  );
  console.log(
    "  --dry-run                     Show what would be done without writing files",
  );
  console.log(
    "  --skip-duplicates             Skip if output file already exists",
  );
  console.log(
    "  --include-links               Include hyperlinks to reports (default: true)",
  );
  console.log("  --help, -h                    Show this help");
  console.log("");
  console.log("Features:");
  console.log("  ✅ RUN_ID namespaced output paths");
  console.log("  ✅ Automatic file versioning (-v2, -v3, etc.)");
  console.log("  ✅ Schema validation with AJV");
  console.log("  ✅ Memory-efficient streaming for large datasets");
  console.log("  ✅ Atomic write operations (tmp + rename)");
  console.log("  ✅ Hyperlinks to source reports");
  console.log("  ✅ Comprehensive validation and error reporting");
  console.log("");
  console.log("Examples:");
  console.log("  tsx scripts/lib/export_enhanced_cli.ts \\");
  console.log("    --source baseline --format csv --run-id 20250918_103000");
  console.log("");
  console.log("  tsx scripts/lib/export_enhanced_cli.ts \\");
  console.log("    --source session --format json --run-id latest --dry-run");
  console.log("");
  console.log("Output structure:");
  console.log("  reports/export/{RUN_ID}/baseline.csv");
  console.log("  reports/export/{RUN_ID}/session.json");
  console.log(
    "  reports/export/{RUN_ID}/baseline-v2.csv  # Versioned if file exists",
  );
}

// Run if this is the main module
if (import.meta.url === new URL(process.argv[1], "file://").href) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
