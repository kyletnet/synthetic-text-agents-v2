/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

import * as fs from "fs";
import * as path from "path";

interface BaselineRecord {
  id: string;
  timestamp: string;
  quality_score: number;
  duplication_rate: number;
  qtype_distribution: Record<string, number>;
  entity_coverage_rate: number;
  evidence_presence_rate: number;
  hallucination_rate: number;
  pii_violations: number;
  license_risks: number;
  cost_per_item: number;
  latency_p95: number;
  alert_flags: string[];
  recommendation: string;
  [key: string]: any;
}

export class BaselineExporter {
  /**
   * Convert JSONL to CSV format
   */
  static jsonlToCsv(inputPath: string, outputPath: string): void {
    if (!fs.existsSync(inputPath)) {
      throw new Error(`Input file not found: ${inputPath}`);
    }

    const content = fs.readFileSync(inputPath, "utf-8");
    const lines = content
      .trim()
      .split("\n")
      .filter((line) => line.trim());

    if (lines.length === 0) {
      throw new Error("Input file is empty");
    }

    const records: BaselineRecord[] = [];
    for (const line of lines) {
      try {
        const record = JSON.parse(line);
        records.push(record);
      } catch (e) {
        console.warn(
          `Skipping malformed JSON line: ${line.substring(0, 100)}...`,
        );
      }
    }

    if (records.length === 0) {
      throw new Error("No valid records found in input file");
    }

    // Extract all possible columns
    const allKeys = new Set<string>();
    for (const record of records) {
      Object.keys(record).forEach((key) => allKeys.add(key));
    }

    // Define column order (important fields first)
    const priorityColumns = [
      "id",
      "timestamp",
      "quality_score",
      "recommendation",
      "duplication_rate",
      "entity_coverage_rate",
      "evidence_presence_rate",
      "hallucination_rate",
      "pii_violations",
      "license_risks",
      "cost_per_item",
      "latency_p95",
      "alert_flags",
    ];

    const columns = [
      ...priorityColumns.filter((col) => allKeys.has(col)),
      ...Array.from(allKeys)
        .filter((col) => !priorityColumns.includes(col))
        .sort(),
    ];

    // Generate CSV
    const csvLines: string[] = [];

    // Header
    csvLines.push(columns.map((col) => this.escapeCsvValue(col)).join(","));

    // Data rows
    for (const record of records) {
      const values = columns.map((col) => {
        const value = record[col];
        if (value === undefined || value === null) {
          return "";
        }
        if (typeof value === "object") {
          return this.escapeCsvValue(JSON.stringify(value));
        }
        return this.escapeCsvValue(String(value));
      });
      csvLines.push(values.join(","));
    }

    // Write CSV
    const csvContent = csvLines.join("\n") + "\n";
    fs.writeFileSync(outputPath, csvContent, "utf-8");

    console.log(`Exported ${records.length} records to CSV: ${outputPath}`);
  }

  /**
   * Convert JSONL to structured JSON format
   */
  static jsonlToJson(inputPath: string, outputPath: string): void {
    if (!fs.existsSync(inputPath)) {
      throw new Error(`Input file not found: ${inputPath}`);
    }

    const content = fs.readFileSync(inputPath, "utf-8");
    const lines = content
      .trim()
      .split("\n")
      .filter((line) => line.trim());

    if (lines.length === 0) {
      throw new Error("Input file is empty");
    }

    const records: BaselineRecord[] = [];
    for (const line of lines) {
      try {
        const record = JSON.parse(line);
        records.push(record);
      } catch (e) {
        console.warn(
          `Skipping malformed JSON line: ${line.substring(0, 100)}...`,
        );
      }
    }

    if (records.length === 0) {
      throw new Error("No valid records found in input file");
    }

    // Create structured export with metadata
    const exportData = {
      export_metadata: {
        source_file: inputPath,
        export_timestamp: new Date().toISOString(),
        total_records: records.length,
        format_version: "1.0",
      },
      summary_stats: this.calculateSummaryStats(records),
      records: records,
    };

    // Write JSON
    const jsonContent = JSON.stringify(exportData, null, 2);
    fs.writeFileSync(outputPath, jsonContent, "utf-8");

    console.log(`Exported ${records.length} records to JSON: ${outputPath}`);
  }

  /**
   * Calculate summary statistics for the dataset
   */
  private static calculateSummaryStats(records: BaselineRecord[]): any {
    if (records.length === 0) {
      return {};
    }

    const numericFields = [
      "quality_score",
      "duplication_rate",
      "entity_coverage_rate",
      "evidence_presence_rate",
      "hallucination_rate",
      "cost_per_item",
      "latency_p95",
    ];

    const stats: any = {
      total_records: records.length,
    };

    for (const field of numericFields) {
      const values = records
        .map((r) => r[field])
        .filter((v) => typeof v === "number" && !isNaN(v));

      if (values.length > 0) {
        values.sort((a, b) => a - b);

        stats[field] = {
          count: values.length,
          min: values[0],
          max: values[values.length - 1],
          mean: values.reduce((sum, v) => sum + v, 0) / values.length,
          median: values[Math.floor(values.length / 2)],
          p95: values[Math.floor(values.length * 0.95)],
        };
      }
    }

    // Alert flag analysis
    const allAlerts = records.flatMap((r) => r.alert_flags || []);
    const alertCounts: Record<string, number> = {};
    for (const alert of allAlerts) {
      alertCounts[alert] = (alertCounts[alert] || 0) + 1;
    }

    stats.alert_analysis = {
      total_alerts: allAlerts.length,
      unique_alert_types: Object.keys(alertCounts).length,
      top_alerts: Object.entries(alertCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([alert, count]) => ({ alert, count })),
    };

    // Recommendation distribution
    const recommendations: Record<string, number> = {};
    for (const record of records) {
      const rec = record.recommendation || "unknown";
      recommendations[rec] = (recommendations[rec] || 0) + 1;
    }

    stats.recommendation_distribution = recommendations;

    return stats;
  }

  /**
   * Escape CSV values (handle quotes, commas, newlines)
   */
  private static escapeCsvValue(value: string): string {
    if (
      value.includes(",") ||
      value.includes('"') ||
      value.includes("\n") ||
      value.includes("\r")
    ) {
      return '"' + value.replace(/"/g, '""') + '"';
    }
    return value;
  }

  /**
   * Validate input file format
   */
  static validateInputFile(inputPath: string): void {
    if (!fs.existsSync(inputPath)) {
      throw new Error(`Input file not found: ${inputPath}`);
    }

    const content = fs.readFileSync(inputPath, "utf-8");
    const lines = content
      .trim()
      .split("\n")
      .filter((line) => line.trim());

    if (lines.length === 0) {
      throw new Error("Input file is empty");
    }

    // Validate first few lines are proper JSON
    let validCount = 0;
    for (let i = 0; i < Math.min(3, lines.length); i++) {
      try {
        JSON.parse(lines[i]);
        validCount++;
      } catch (e) {
        // Allow some malformed lines
      }
    }

    if (validCount === 0) {
      throw new Error("Input file does not contain valid JSON lines");
    }

    console.log(
      `Input validation passed: ${validCount}/${Math.min(
        3,
        lines.length,
      )} sample lines are valid JSON`,
    );
  }
}

// CLI interface
if (typeof require !== "undefined" && require.main === module) {
  const args = process.argv.slice(2);

  if (args.length < 6) {
    console.error(
      "Usage: node export_cli.js --in <input.jsonl> --out <output> --format <csv|json>",
    );
    console.error("");
    console.error("Examples:");
    console.error(
      "  node export_cli.js --in reports/baseline_report.jsonl --out reports/export/baseline.csv --format csv",
    );
    console.error(
      "  node export_cli.js --in reports/baseline_report.jsonl --out reports/export/baseline.json --format json",
    );
    process.exit(1);
  }

  let inputPath = "";
  let outputPath = "";
  let format = "";

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    const value = args[i + 1];

    if (key === "--in") inputPath = value;
    else if (key === "--out") outputPath = value;
    else if (key === "--format") format = value;
  }

  if (!inputPath || !outputPath || !format) {
    console.error("Missing required arguments: --in, --out, --format");
    process.exit(1);
  }

  if (!["csv", "json"].includes(format)) {
    console.error('Format must be "csv" or "json"');
    process.exit(1);
  }

  try {
    // Validate input
    BaselineExporter.validateInputFile(inputPath);

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Perform export
    if (format === "csv") {
      BaselineExporter.jsonlToCsv(inputPath, outputPath);
    } else if (format === "json") {
      BaselineExporter.jsonlToJson(inputPath, outputPath);
    }

    console.log("Export completed successfully");
  } catch (error) {
    console.error("Export failed:", error);
    process.exit(1);
  }
}
