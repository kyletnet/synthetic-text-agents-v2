import * as fs from "fs";
import * as path from "path";
import { createReadStream, createWriteStream } from "fs";
import { Transform } from "stream";
import { pipeline } from "stream/promises";
import Ajv from "ajv";
import addFormats from "ajv-formats";
export class EnhancedExporter {
  ajv;
  constructor() {
    this.ajv = new Ajv();
    addFormats(this.ajv);
  }
  /**
   * Main export function with all enhanced features
   */
  async export(options) {
    const result = {
      success: false,
      outputPath: "",
      recordCount: 0,
      warnings: [],
    };
    try {
      // 1. Validate input source
      const inputPath = this.resolveInputPath(options.source, options.runId);
      if (!fs.existsSync(inputPath)) {
        throw new Error(`Input file not found: ${inputPath}`);
      }
      // 2. Setup output path with RUN_ID namespace
      const outputPath = this.setupOutputPath(options);
      result.outputPath = outputPath;
      // 3. Check for duplicates and versioning
      if (options.skipDuplicates && fs.existsSync(outputPath)) {
        result.warnings?.push(
          `Output file already exists, skipping: ${outputPath}`,
        );
        return { ...result, success: true, recordCount: 0 };
      }
      const finalOutputPath = this.handleVersioning(outputPath);
      result.outputPath = finalOutputPath;
      if (finalOutputPath !== outputPath) {
        result.version = this.extractVersionNumber(finalOutputPath);
        result.warnings?.push(`Created versioned file: ${finalOutputPath}`);
      }
      // 4. Dry run check
      if (options.dryRun) {
        result.warnings?.push("Dry run mode - no files written");
        return { ...result, success: true, recordCount: 0 };
      }
      // 5. Schema validation
      const schemaValidation = await this.validateSchema(
        inputPath,
        options.source,
      );
      if (!schemaValidation.valid) {
        result.validationErrors = schemaValidation.errors ?? [];
        result.warnings?.push(
          "Schema validation failed, proceeding with warnings",
        );
      }
      // 6. Stream processing with temporary file + atomic rename
      const recordCount = await this.streamProcess(
        inputPath,
        finalOutputPath,
        options,
      );
      result.recordCount = recordCount;
      result.success = true;
      return result;
    } catch (error) {
      throw new Error(`Export failed: ${error}`);
    }
  }
  /**
   * Resolve input file path based on source type
   */
  resolveInputPath(source, runId) {
    const basePath = "reports";
    if (source === "baseline") {
      // Try RUN_ID specific path first, fallback to latest
      const specificPath = path.join(
        basePath,
        "history",
        runId,
        "baseline_report.jsonl",
      );
      if (fs.existsSync(specificPath)) {
        return specificPath;
      }
      return path.join(basePath, "baseline_report.jsonl");
    } else {
      // Session report
      const specificPath = path.join(
        basePath,
        "history",
        runId,
        "session_report.md",
      );
      if (fs.existsSync(specificPath)) {
        return specificPath;
      }
      return path.join(basePath, "session_report.md");
    }
  }
  /**
   * Setup output path with RUN_ID namespace
   */
  setupOutputPath(options) {
    const baseDir = options.outputDir || "reports/export";
    const runDir = path.join(baseDir, options.runId);
    // Ensure directory exists
    if (!fs.existsSync(runDir)) {
      fs.mkdirSync(runDir, { recursive: true });
    }
    const filename = `${options.source}.${options.format}`;
    return path.join(runDir, filename);
  }
  /**
   * Handle file versioning to prevent overwrites
   */
  handleVersioning(outputPath) {
    if (!fs.existsSync(outputPath)) {
      return outputPath;
    }
    const { dir, name, ext } = path.parse(outputPath);
    let version = 2;
    let versionedPath;
    do {
      versionedPath = path.join(dir, `${name}-v${version}${ext}`);
      version++;
    } while (fs.existsSync(versionedPath));
    return versionedPath;
  }
  /**
   * Extract version number from versioned filename
   */
  extractVersionNumber(filepath) {
    const match = filepath.match(/-v(\d+)\./);
    return match ? parseInt(match[1], 10) : 1;
  }
  /**
   * Validate input against schema
   */
  async validateSchema(inputPath, source) {
    try {
      const schemaPath = path.join("schema", `${source}_export.schema.json`);
      if (!fs.existsSync(schemaPath)) {
        // Fallback to main schema
        const fallbackPath = path.join(
          "schema",
          `${source}_report.schema.json`,
        );
        if (!fs.existsSync(fallbackPath)) {
          return { valid: false, errors: [`Schema not found: ${schemaPath}`] };
        }
      }
      const schemaContent = fs.readFileSync(schemaPath, "utf-8");
      const schema = JSON.parse(schemaContent);
      const validate = this.ajv.compile(schema);
      // Sample validation (first 3 records)
      const content = fs.readFileSync(inputPath, "utf-8");
      const lines = content
        .trim()
        .split("\n")
        .filter((line) => line.trim());
      let validCount = 0;
      const errors = [];
      for (let i = 0; i < Math.min(3, lines.length); i++) {
        try {
          const record = JSON.parse(lines[i]);
          if (validate(record)) {
            validCount++;
          } else {
            errors.push(
              `Line ${i + 1}: ${validate.errors?.map((e) => e.message).join(", ")}`,
            );
          }
        } catch (e) {
          errors.push(`Line ${i + 1}: Invalid JSON`);
        }
      }
      const errs = errors ?? [];
      return {
        valid: validCount > 0,
        ...(errs.length ? { errors: errs } : {}),
      };
    } catch (error) {
      return { valid: false, errors: [`Schema validation error: ${error}`] };
    }
  }
  /**
   * Stream processing with memory efficiency
   */
  async streamProcess(inputPath, outputPath, options) {
    const tempPath = `${outputPath}.tmp`;
    let recordCount = 0;
    try {
      const exporter = this;
      const transformStream = new Transform({
        objectMode: false,
        transform(chunk, encoding, callback) {
          try {
            const lines = chunk
              .toString()
              .split("\n")
              .filter((line) => line.trim());
            let output = "";
            for (const line of lines) {
              if (line.trim()) {
                const record = JSON.parse(line);
                const exportRecord = exporter.transformRecord(record, options);
                recordCount++;
                if (options.format === "csv") {
                  const csvLine = exporter.recordToCsv(
                    exportRecord,
                    recordCount === 1,
                  );
                  output += csvLine;
                } else {
                  output += JSON.stringify(exportRecord) + "\n";
                }
              }
            }
            callback(null, output);
          } catch (error) {
            callback(error);
          }
        },
      });
      // Setup pipeline
      await pipeline(
        createReadStream(inputPath, { highWaterMark: 64 * 1024 }), // 64KB chunks
        transformStream,
        createWriteStream(tempPath),
      );
      // Atomic rename
      fs.renameSync(tempPath, outputPath);
      return recordCount;
    } catch (error) {
      // Cleanup temp file on error
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
      throw error;
    }
  }
  /**
   * Transform source record to export format
   */
  transformRecord(sourceRecord, options) {
    const record = {
      RUN_ID: options.runId,
      ITEM_ID: sourceRecord.item_index
        ? `${options.runId}_${sourceRecord.item_index}`
        : `${options.runId}_${Date.now()}`,
      RESULT: this.determineResult(sourceRecord),
      COST_USD: sourceRecord.cost_usd || 0,
      LAT_MS: sourceRecord.latency_ms || 0,
      WARNINGS: sourceRecord.alert_flags?.length || 0,
      P0_VIOLATIONS: this.countP0Violations(sourceRecord),
      P1_VIOLATIONS: this.countP1Violations(sourceRecord),
      P2_VIOLATIONS: this.countP2Violations(sourceRecord),
      ACCURACY_SCORE:
        sourceRecord.quality_score || sourceRecord.overall_quality_score || 0,
      EVIDENCE_PRESENCE: sourceRecord.evidence_quality?.has_evidence ? 1 : 0,
      DUPLICATION_RATE:
        sourceRecord.duplication?.max_similarity ||
        sourceRecord.duplication?.rate ||
        0,
      HALLUCINATION_RISK: sourceRecord.hallucination?.risk_level || "none",
      PII_HITS: sourceRecord.pii_license?.pii_violations || 0,
      LICENSE_HITS: sourceRecord.pii_license?.license_violations || 0,
      PROFILE: "dev", // Will be overridden
      TIMESTAMP: sourceRecord.timestamp || new Date().toISOString(),
    };
    // Add hyperlinks if requested
    if (options.includeLinks) {
      record.REPORT_LINK = `../reports/${options.source}_report.md#${options.runId}`;
      record.SESSION_LINK = `../reports/session_report.md#${options.runId}`;
    }
    return record;
  }
  determineResult(record) {
    const alerts = record.alert_flags || [];
    if (alerts.includes("pii_license")) return "FAIL";
    if (alerts.length > 2) return "PARTIAL";
    if (alerts.length > 0) return "WARN";
    return "PASS";
  }
  countP0Violations(record) {
    const flags = record.alert_flags || [];
    return flags.filter((flag) => flag === "pii_license").length;
  }
  countP1Violations(record) {
    const flags = record.alert_flags || [];
    return flags.filter((flag) => ["hallucination"].includes(flag)).length;
  }
  countP2Violations(record) {
    const flags = record.alert_flags || [];
    return flags.filter((flag) =>
      ["duplication", "missing_evidence", "low_quality"].includes(flag),
    ).length;
  }
  /**
   * Convert record to CSV format
   */
  recordToCsv(record, includeHeader) {
    const values = Object.values(record).map((val) => {
      if (val === null || val === undefined) return "";
      if (
        typeof val === "string" &&
        (val.includes(",") || val.includes('"') || val.includes("\n"))
      ) {
        return '"' + val.replace(/"/g, '""') + '"';
      }
      return String(val);
    });
    let result = "";
    if (includeHeader) {
      const headers = Object.keys(record).map((key) =>
        key.includes(",") ? `"${key}"` : key,
      );
      result += headers.join(",") + "\n";
    }
    result += values.join(",") + "\n";
    return result;
  }
  /**
   * Validate export result against schema
   */
  async validateExportResult(outputPath) {
    try {
      if (!fs.existsSync(outputPath)) {
        return { valid: false, errors: ["Output file does not exist"] };
      }
      const content = fs.readFileSync(outputPath, "utf-8");
      if (content.trim().length === 0) {
        return { valid: false, errors: ["Output file is empty"] };
      }
      // Basic validation
      if (outputPath.endsWith(".csv")) {
        const lines = content.trim().split("\n");
        if (lines.length < 2) {
          return {
            valid: false,
            errors: ["CSV must have at least header + 1 data row"],
          };
        }
      } else if (outputPath.endsWith(".json")) {
        // Validate each JSON line
        const lines = content
          .trim()
          .split("\n")
          .filter((line) => line.trim());
        for (let i = 0; i < Math.min(3, lines.length); i++) {
          try {
            JSON.parse(lines[i]);
          } catch {
            return { valid: false, errors: [`Invalid JSON at line ${i + 1}`] };
          }
        }
      }
      return { valid: true };
    } catch (error) {
      return { valid: false, errors: [`Validation error: ${error}`] };
    }
  }
}
// CLI helper functions
export function parseExportArgs(args) {
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    const value = args[i + 1];
    switch (key) {
      case "--source":
        if (value === "baseline" || value === "session") {
          options.source = value;
        }
        break;
      case "--format":
        if (value === "csv" || value === "json") {
          options.format = value;
        }
        break;
      case "--run-id":
        options.runId = value;
        break;
      case "--output-dir":
        options.outputDir = value;
        break;
      case "--dry-run":
        options.dryRun = value === "true";
        i--; // No value for boolean flag
        break;
      case "--skip-duplicates":
        options.skipDuplicates = value === "true";
        i--; // No value for boolean flag
        break;
      case "--include-links":
        options.includeLinks = value === "true";
        i--; // No value for boolean flag
        break;
    }
  }
  return options;
}
export function validateExportOptions(options) {
  const errors = [];
  if (!options.source) errors.push("--source is required (baseline|session)");
  if (!options.format) errors.push("--format is required (csv|json)");
  if (!options.runId) errors.push("--run-id is required");
  return errors;
}
//# sourceMappingURL=export_enhanced.js.map
