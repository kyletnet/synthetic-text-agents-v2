import * as fs from 'fs';
import * as path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { Transform } from 'stream';
import { pipeline } from 'stream/promises';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

export interface ExportOptions {
  source: 'baseline' | 'session';
  format: 'csv' | 'json';
  runId: string;
  outputDir?: string;
  dryRun?: boolean;
  skipDuplicates?: boolean;
  includeLinks?: boolean;
}

export interface ExportRecord {
  RUN_ID: string;
  ITEM_ID: string;
  RESULT: 'PASS' | 'WARN' | 'PARTIAL' | 'FAIL';
  COST_USD: number;
  LAT_MS: number;
  WARNINGS: number;
  P0_VIOLATIONS: number;
  P1_VIOLATIONS: number;
  P2_VIOLATIONS: number;
  ACCURACY_SCORE: number;
  EVIDENCE_PRESENCE: number;
  DUPLICATION_RATE: number;
  HALLUCINATION_RISK: 'low' | 'medium' | 'high' | 'none';
  PII_HITS: number;
  LICENSE_HITS: number;
  PROFILE: string;
  TIMESTAMP: string;
  REPORT_LINK?: string;
  SESSION_LINK?: string;
  [key: string]: any;
}

export interface ExportResult {
  success: boolean;
  outputPath: string;
  recordCount: number;
  validationErrors?: string[];
  warnings?: string[];
  version?: number;
}

export class EnhancedExporter {
  private ajv: Ajv;

  constructor() {
    this.ajv = new Ajv();
    addFormats(this.ajv);
  }

  /**
   * Main export function with all enhanced features
   */
  async export(options: ExportOptions): Promise<ExportResult> {
    const result: ExportResult = {
      success: false,
      outputPath: '',
      recordCount: 0,
      warnings: []
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
        result.warnings?.push(`Output file already exists, skipping: ${outputPath}`);
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
        result.warnings?.push('Dry run mode - no files written');
        return { ...result, success: true, recordCount: 0 };
      }

      // 5. Schema validation
      const schemaValidation = await this.validateSchema(inputPath, options.source);
      if (!schemaValidation.valid) {
        result.validationErrors = schemaValidation.errors ?? [];
        result.warnings?.push('Schema validation failed, proceeding with warnings');
      }

      // 6. Stream processing with temporary file + atomic rename
      const recordCount = await this.streamProcess(inputPath, finalOutputPath, options);
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
  private resolveInputPath(source: 'baseline' | 'session', runId: string): string {
    const basePath = 'reports';

    if (source === 'baseline') {
      // Try RUN_ID specific path first, fallback to latest
      const specificPath = path.join(basePath, 'history', runId, 'baseline_report.jsonl');
      if (fs.existsSync(specificPath)) {
        return specificPath;
      }
      return path.join(basePath, 'baseline_report.jsonl');
    } else {
      // Session report
      const specificPath = path.join(basePath, 'history', runId, 'session_report.md');
      if (fs.existsSync(specificPath)) {
        return specificPath;
      }
      return path.join(basePath, 'session_report.md');
    }
  }

  /**
   * Setup output path with RUN_ID namespace
   */
  private setupOutputPath(options: ExportOptions): string {
    const baseDir = options.outputDir || 'reports/export';
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
  private handleVersioning(outputPath: string): string {
    if (!fs.existsSync(outputPath)) {
      return outputPath;
    }

    const { dir, name, ext } = path.parse(outputPath);
    let version = 2;
    let versionedPath: string;

    do {
      versionedPath = path.join(dir, `${name}-v${version}${ext}`);
      version++;
    } while (fs.existsSync(versionedPath));

    return versionedPath;
  }

  /**
   * Extract version number from versioned filename
   */
  private extractVersionNumber(filepath: string): number {
    const match = filepath.match(/-v(\d+)\./);
    return match ? parseInt(match[1], 10) : 1;
  }

  /**
   * Validate input against schema
   */
  private async validateSchema(inputPath: string, source: string): Promise<{ valid: boolean; errors?: string[] }> {
    try {
      const schemaPath = path.join('schema', `${source}_export.schema.json`);

      if (!fs.existsSync(schemaPath)) {
        // Fallback to main schema
        const fallbackPath = path.join('schema', `${source}_report.schema.json`);
        if (!fs.existsSync(fallbackPath)) {
          return { valid: false, errors: [`Schema not found: ${schemaPath}`] };
        }
      }

      const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
      const schema = JSON.parse(schemaContent);
      const validate = this.ajv.compile(schema);

      // Sample validation (first 3 records)
      const content = fs.readFileSync(inputPath, 'utf-8');
      const lines = content.trim().split('\n').filter(line => line.trim());

      let validCount = 0;
      const errors: string[] = [];

      for (let i = 0; i < Math.min(3, lines.length); i++) {
        try {
          const record = JSON.parse(lines[i]);
          if (validate(record)) {
            validCount++;
          } else {
            errors.push(`Line ${i + 1}: ${validate.errors?.map(e => e.message).join(', ')}`);
          }
        } catch (e) {
          errors.push(`Line ${i + 1}: Invalid JSON`);
        }
      }

      const errs = errors ?? [];
      return {
        valid: validCount > 0,
        ...(errs.length ? { errors: errs } : {})
      };

    } catch (error) {
      return { valid: false, errors: [`Schema validation error: ${error}`] };
    }
  }

  /**
   * Stream processing with memory efficiency
   */
  private async streamProcess(inputPath: string, outputPath: string, options: ExportOptions): Promise<number> {
    const tempPath = `${outputPath}.tmp`;
    let recordCount = 0;

    try {
      const exporter = this;
    const transformStream = new Transform({
        objectMode: false,
        transform(chunk: Buffer, encoding: BufferEncoding, callback: (error?: Error | null, data?: any) => void) {
          try {
            const lines = chunk.toString().split('\n').filter(line => line.trim());
            let output = '';

            for (const line of lines) {
              if (line.trim()) {
                const record = JSON.parse(line);
                const exportRecord = exporter.transformRecord(record, options);
                recordCount++;

                if (options.format === 'csv') {
                  const csvLine = exporter.recordToCsv(exportRecord, recordCount === 1);
                  output += csvLine;
                } else {
                  output += JSON.stringify(exportRecord) + '\n';
                }
              }
            }
            callback(null, output);
          } catch (error) {
            callback(error as Error);
          }
        }
      });

      // Setup pipeline
      await pipeline(
        createReadStream(inputPath, { highWaterMark: 64 * 1024 }), // 64KB chunks
        transformStream,
        createWriteStream(tempPath)
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
  private transformRecord(sourceRecord: any, options: ExportOptions): ExportRecord {
    const record: ExportRecord = {
      RUN_ID: options.runId,
      ITEM_ID: sourceRecord.item_index ? `${options.runId}_${sourceRecord.item_index}` : `${options.runId}_${Date.now()}`,
      RESULT: this.determineResult(sourceRecord),
      COST_USD: sourceRecord.cost_usd || 0,
      LAT_MS: sourceRecord.latency_ms || 0,
      WARNINGS: sourceRecord.alert_flags?.length || 0,
      P0_VIOLATIONS: this.countP0Violations(sourceRecord),
      P1_VIOLATIONS: this.countP1Violations(sourceRecord),
      P2_VIOLATIONS: this.countP2Violations(sourceRecord),
      ACCURACY_SCORE: sourceRecord.quality_score || sourceRecord.overall_quality_score || 0,
      EVIDENCE_PRESENCE: sourceRecord.evidence_quality?.has_evidence ? 1 : 0,
      DUPLICATION_RATE: sourceRecord.duplication?.max_similarity || sourceRecord.duplication?.rate || 0,
      HALLUCINATION_RISK: sourceRecord.hallucination?.risk_level || 'none',
      PII_HITS: sourceRecord.pii_license?.pii_violations || 0,
      LICENSE_HITS: sourceRecord.pii_license?.license_violations || 0,
      PROFILE: 'dev', // Will be overridden
      TIMESTAMP: sourceRecord.timestamp || new Date().toISOString()
    };

    // Add hyperlinks if requested
    if (options.includeLinks) {
      record.REPORT_LINK = `../reports/${options.source}_report.md#${options.runId}`;
      record.SESSION_LINK = `../reports/session_report.md#${options.runId}`;
    }

    return record;
  }

  private determineResult(record: any): 'PASS' | 'WARN' | 'PARTIAL' | 'FAIL' {
    const alerts = record.alert_flags || [];
    if (alerts.includes('pii_license')) return 'FAIL';
    if (alerts.length > 2) return 'PARTIAL';
    if (alerts.length > 0) return 'WARN';
    return 'PASS';
  }

  private countP0Violations(record: any): number {
    const flags = record.alert_flags || [];
    return flags.filter((flag: string) => flag === 'pii_license').length;
  }

  private countP1Violations(record: any): number {
    const flags = record.alert_flags || [];
    return flags.filter((flag: string) => ['hallucination'].includes(flag)).length;
  }

  private countP2Violations(record: any): number {
    const flags = record.alert_flags || [];
    return flags.filter((flag: string) =>
      ['duplication', 'missing_evidence', 'low_quality'].includes(flag)
    ).length;
  }

  /**
   * Convert record to CSV format
   */
  private recordToCsv(record: ExportRecord, includeHeader: boolean): string {
    const values = Object.values(record).map(val => {
      if (val === null || val === undefined) return '';
      if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
        return '"' + val.replace(/"/g, '""') + '"';
      }
      return String(val);
    });

    let result = '';
    if (includeHeader) {
      const headers = Object.keys(record).map(key =>
        key.includes(',') ? `"${key}"` : key
      );
      result += headers.join(',') + '\n';
    }

    result += values.join(',') + '\n';
    return result;
  }

  /**
   * Validate export result against schema
   */
  async validateExportResult(outputPath: string): Promise<{ valid: boolean; errors?: string[] }> {
    try {
      if (!fs.existsSync(outputPath)) {
        return { valid: false, errors: ['Output file does not exist'] };
      }

      const content = fs.readFileSync(outputPath, 'utf-8');
      if (content.trim().length === 0) {
        return { valid: false, errors: ['Output file is empty'] };
      }

      // Basic validation
      if (outputPath.endsWith('.csv')) {
        const lines = content.trim().split('\n');
        if (lines.length < 2) {
          return { valid: false, errors: ['CSV must have at least header + 1 data row'] };
        }
      } else if (outputPath.endsWith('.json')) {
        // Validate each JSON line
        const lines = content.trim().split('\n').filter(line => line.trim());
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
export function parseExportArgs(args: string[]): ExportOptions {
  const options: Partial<ExportOptions> = {};

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    const value = args[i + 1];

    switch (key) {
      case '--source':
        if (value === 'baseline' || value === 'session') {
          options.source = value;
        }
        break;
      case '--format':
        if (value === 'csv' || value === 'json') {
          options.format = value;
        }
        break;
      case '--run-id':
        options.runId = value;
        break;
      case '--output-dir':
        options.outputDir = value;
        break;
      case '--dry-run':
        options.dryRun = value === 'true';
        i--; // No value for boolean flag
        break;
      case '--skip-duplicates':
        options.skipDuplicates = value === 'true';
        i--; // No value for boolean flag
        break;
      case '--include-links':
        options.includeLinks = value === 'true';
        i--; // No value for boolean flag
        break;
    }
  }

  return options as ExportOptions;
}

export function validateExportOptions(options: Partial<ExportOptions>): string[] {
  const errors: string[] = [];

  if (!options.source) errors.push('--source is required (baseline|session)');
  if (!options.format) errors.push('--format is required (csv|json)');
  if (!options.runId) errors.push('--run-id is required');

  return errors;
}