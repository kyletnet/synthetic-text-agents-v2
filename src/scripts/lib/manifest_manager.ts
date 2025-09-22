import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { createHash } from 'crypto';
import { glob } from 'glob';

/**
 * Manifest Manager
 * Handles data freeze, checksums, and reproducibility tracking
 * Ensures ±5% reproducibility for baseline runs
 */

export interface FileManifestEntry {
  path: string;
  relative_path: string;
  size_bytes: number;
  checksum_sha256: string;
  last_modified: string;
  content_type: string;
}

export interface DataManifest {
  manifest_id: string;
  created_timestamp: string;
  description: string;
  base_directory: string;
  freeze_enabled: boolean;

  // Input data
  input_files: FileManifestEntry[];
  input_total_size: number;
  input_checksum: string;

  // Gold/reference data
  gold_files: FileManifestEntry[];
  gold_total_size: number;
  gold_checksum: string;

  // Configuration data
  config_files: FileManifestEntry[];
  config_checksum: string;

  // Metadata
  file_count: number;
  total_size_bytes: number;
  manifest_checksum: string;

  // Reproducibility settings
  seed_value: number;
  reproducibility_target_pct: number;
  comparison_window_days: number;
}

export interface ReproducibilityCheck {
  manifest_id: string;
  baseline_run_id: string;
  comparison_run_id: string;
  check_timestamp: string;

  // Metric comparisons
  metrics_comparison: {
    [metric: string]: {
      baseline_value: number;
      comparison_value: number;
      delta_pct: number;
      within_tolerance: boolean;
    };
  };

  // Overall result
  overall_delta_pct: number;
  within_target: boolean;
  target_pct: number;

  // Analysis
  significant_changes: string[];
  recommendations: string[];
}

export class ManifestManager {
  private manifestDir: string;
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || process.cwd();
    this.manifestDir = join(this.baseDir, 'reports', 'manifests');
    this.ensureDirectoryExists();
  }

  private ensureDirectoryExists(): void {
    if (!existsSync(this.manifestDir)) {
      mkdirSync(this.manifestDir, { recursive: true });
    }
  }

  /**
   * Create a new data manifest with freeze capability
   */
  async createManifest(
    description: string,
    inputPatterns: string[],
    goldPatterns: string[] = [],
    configPatterns: string[] = [],
    freezeEnabled: boolean = true,
    seedValue?: number
  ): Promise<DataManifest> {
    const manifestId = this.generateManifestId();
    const seed = seedValue ?? this.generateSeed();

    console.log(`📋 Creating manifest ${manifestId}...`);

    // Collect file entries for each category
    const inputFiles = await this.collectFiles(inputPatterns, 'input');
    const goldFiles = await this.collectFiles(goldPatterns, 'gold');
    const configFiles = await this.collectFiles(configPatterns, 'config');

    // Calculate checksums
    const inputChecksum = this.calculateGroupChecksum(inputFiles);
    const goldChecksum = this.calculateGroupChecksum(goldFiles);
    const configChecksum = this.calculateGroupChecksum(configFiles);

    const allFiles = [...inputFiles, ...goldFiles, ...configFiles];
    const totalSize = allFiles.reduce((sum, f) => sum + f.size_bytes, 0);

    const manifest: DataManifest = {
      manifest_id: manifestId,
      created_timestamp: new Date().toISOString(),
      description,
      base_directory: this.baseDir,
      freeze_enabled: freezeEnabled,

      input_files: inputFiles,
      input_total_size: inputFiles.reduce((sum, f) => sum + f.size_bytes, 0),
      input_checksum: inputChecksum,

      gold_files: goldFiles,
      gold_total_size: goldFiles.reduce((sum, f) => sum + f.size_bytes, 0),
      gold_checksum: goldChecksum,

      config_files: configFiles,
      config_checksum: configChecksum,

      file_count: allFiles.length,
      total_size_bytes: totalSize,
      manifest_checksum: '', // Will be calculated after manifest is complete

      seed_value: seed,
      reproducibility_target_pct: 5.0, // ±5% target
      comparison_window_days: 7
    };

    // Calculate manifest checksum
    manifest.manifest_checksum = this.calculateManifestChecksum(manifest);

    // Save manifest
    this.saveManifest(manifest);

    console.log(`✅ Manifest created: ${inputFiles.length} input files, ${goldFiles.length} gold files, ${configFiles.length} config files`);
    console.log(`📊 Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`🔒 Freeze enabled: ${freezeEnabled}`);
    console.log(`🎲 Seed: ${seed}`);

    return manifest;
  }

  /**
   * Load existing manifest
   */
  loadManifest(manifestId: string): DataManifest | null {
    const manifestPath = join(this.manifestDir, `${manifestId}.json`);

    try {
      if (existsSync(manifestPath)) {
        const content = readFileSync(manifestPath, 'utf-8');
        return JSON.parse(content) as DataManifest;
      }
    } catch (error) {
      console.error(`Failed to load manifest ${manifestId}:`, error);
    }

    return null;
  }

  /**
   * Validate manifest integrity
   */
  async validateManifest(manifestId: string): Promise<{
    valid: boolean;
    issues: string[];
    missing_files: string[];
    modified_files: string[];
  }> {
    const manifest = this.loadManifest(manifestId);
    if (!manifest) {
      return {
        valid: false,
        issues: [`Manifest ${manifestId} not found`],
        missing_files: [],
        modified_files: []
      };
    }

    const issues: string[] = [];
    const missingFiles: string[] = [];
    const modifiedFiles: string[] = [];

    // Check all files in manifest
    const allFiles = [...manifest.input_files, ...manifest.gold_files, ...manifest.config_files];

    for (const fileEntry of allFiles) {
      const fullPath = join(this.baseDir, fileEntry.relative_path);

      // Check if file exists
      if (!existsSync(fullPath)) {
        missingFiles.push(fileEntry.relative_path);
        continue;
      }

      // Check if file was modified
      const currentStats = statSync(fullPath);
      const currentChecksum = await this.calculateFileChecksum(fullPath);

      if (currentChecksum !== fileEntry.checksum_sha256) {
        modifiedFiles.push(fileEntry.relative_path);
        issues.push(`File modified: ${fileEntry.relative_path}`);
      }

      if (currentStats.size !== fileEntry.size_bytes) {
        issues.push(`File size changed: ${fileEntry.relative_path} (${fileEntry.size_bytes} → ${currentStats.size} bytes)`);
      }
    }

    // Check manifest checksum
    const currentManifestChecksum = this.calculateManifestChecksum(manifest);
    if (currentManifestChecksum !== manifest.manifest_checksum) {
      issues.push('Manifest checksum mismatch - manifest may have been tampered with');
    }

    const valid = issues.length === 0 && missingFiles.length === 0 && modifiedFiles.length === 0;

    return {
      valid,
      issues,
      missing_files: missingFiles,
      modified_files: modifiedFiles
    };
  }

  /**
   * Get the latest manifest for a pattern
   */
  getLatestManifest(descriptionPattern?: string): DataManifest | null {
    try {
      const manifestFiles = require('fs').readdirSync(this.manifestDir)
        .filter((file: string) => file.endsWith('.json'))
        .map((file: string) => {
          const path = join(this.manifestDir, file);
          const stats = statSync(path);
          return { file, path, created: stats.ctime };
        })
        .sort((a: { created: Date }, b: { created: Date }) => b.created.getTime() - a.created.getTime());

      for (const { path } of manifestFiles) {
        try {
          const content = readFileSync(path, 'utf-8');
          const manifest = JSON.parse(content) as DataManifest;

          if (!descriptionPattern || manifest.description.includes(descriptionPattern)) {
            return manifest;
          }
        } catch (error) {
          console.warn(`Failed to parse manifest ${path}:`, error);
        }
      }
    } catch (error) {
      console.error('Failed to get latest manifest:', error);
    }

    return null;
  }

  /**
   * Check reproducibility between two runs
   */
  checkReproducibility(
    manifestId: string,
    baselineMetrics: any,
    comparisonMetrics: any,
    baselineRunId: string,
    comparisonRunId: string
  ): ReproducibilityCheck {
    const manifest = this.loadManifest(manifestId);
    const targetPct = manifest?.reproducibility_target_pct || 5.0;

    const keyMetrics = [
      'duplication_rate',
      'evidence_presence_rate',
      'cost_per_item',
      'latency_p95',
      'quality_score',
      'coverage_rate'
    ];

    const metricsComparison: any = {};
    const deltas: number[] = [];

    for (const metric of keyMetrics) {
      const baselineValue = this.extractMetricValue(baselineMetrics, metric);
      const comparisonValue = this.extractMetricValue(comparisonMetrics, metric);

      if (baselineValue !== null && comparisonValue !== null && baselineValue !== 0) {
        const deltaPct = Math.abs((comparisonValue - baselineValue) / baselineValue * 100);
        const withinTolerance = deltaPct <= targetPct;

        metricsComparison[metric] = {
          baseline_value: baselineValue,
          comparison_value: comparisonValue,
          delta_pct: deltaPct,
          within_tolerance: withinTolerance
        };

        deltas.push(deltaPct);
      }
    }

    // Calculate overall delta (RMS of individual deltas)
    const overallDelta = deltas.length > 0
      ? Math.sqrt(deltas.reduce((sum, d) => sum + d * d, 0) / deltas.length)
      : 0;

    const withinTarget = overallDelta <= targetPct;

    // Generate analysis
    const significantChanges: string[] = [];
    const recommendations: string[] = [];

    for (const [metric, comparison] of Object.entries(metricsComparison)) {
      const comp = comparison as any;
      if (!comp.within_tolerance) {
        significantChanges.push(
          `${metric}: ${comp.delta_pct.toFixed(1)}% change (${comp.baseline_value.toFixed(3)} → ${comp.comparison_value.toFixed(3)})`
        );
      }
    }

    if (!withinTarget) {
      recommendations.push('Review input data consistency');
      recommendations.push('Check random seed consistency');
      recommendations.push('Verify environment configuration');

      if (significantChanges.some(change => change.includes('cost_per_item'))) {
        recommendations.push('Check model pricing changes');
      }

      if (significantChanges.some(change => change.includes('latency'))) {
        recommendations.push('Check system performance and load');
      }
    }

    const check: ReproducibilityCheck = {
      manifest_id: manifestId,
      baseline_run_id: baselineRunId,
      comparison_run_id: comparisonRunId,
      check_timestamp: new Date().toISOString(),
      metrics_comparison: metricsComparison,
      overall_delta_pct: overallDelta,
      within_target: withinTarget,
      target_pct: targetPct,
      significant_changes: significantChanges,
      recommendations
    };

    // Save reproducibility check
    this.saveReproducibilityCheck(check);

    return check;
  }

  /**
   * Collect files matching patterns
   */
  private async collectFiles(patterns: string[], category: string): Promise<FileManifestEntry[]> {
    const files: FileManifestEntry[] = [];

    for (const pattern of patterns) {
      try {
        const matches = await glob(pattern, { cwd: this.baseDir });

        for (const match of matches) {
          const fullPath = join(this.baseDir, match);
          const stats = statSync(fullPath);

          if (stats.isFile()) {
            const checksum = await this.calculateFileChecksum(fullPath);

            files.push({
              path: fullPath,
              relative_path: match,
              size_bytes: stats.size,
              checksum_sha256: checksum,
              last_modified: stats.mtime.toISOString(),
              content_type: this.getContentType(match)
            });
          }
        }
      } catch (error) {
        console.warn(`Failed to collect files for pattern ${pattern}:`, error);
      }
    }

    console.log(`📁 Collected ${files.length} ${category} files`);
    return files;
  }

  /**
   * Calculate file checksum
   */
  private async calculateFileChecksum(filePath: string): Promise<string> {
    try {
      const content = readFileSync(filePath);
      return createHash('sha256').update(content).digest('hex');
    } catch (error) {
      console.error(`Failed to calculate checksum for ${filePath}:`, error);
      return '';
    }
  }

  /**
   * Calculate group checksum from file entries
   */
  private calculateGroupChecksum(files: FileManifestEntry[]): string {
    const sortedChecksums = files
      .map(f => f.checksum_sha256)
      .sort()
      .join('');

    return createHash('sha256').update(sortedChecksums).digest('hex');
  }

  /**
   * Calculate manifest checksum
   */
  private calculateManifestChecksum(manifest: DataManifest): string {
    // Create a copy without the checksum field to avoid circular dependency
    const manifestCopy = { ...manifest };
    delete (manifestCopy as any).manifest_checksum;

    const manifestJson = JSON.stringify(manifestCopy, Object.keys(manifestCopy).sort());
    return createHash('sha256').update(manifestJson).digest('hex');
  }

  /**
   * Generate unique manifest ID
   */
  private generateManifestId(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const random = Math.random().toString(36).substring(2, 8);
    return `manifest_${timestamp}_${random}`;
  }

  /**
   * Generate random seed
   */
  private generateSeed(): number {
    return Math.floor(Math.random() * 1000000);
  }

  /**
   * Get content type based on file extension
   */
  private getContentType(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();

    const contentTypes: { [key: string]: string } = {
      'json': 'application/json',
      'jsonl': 'application/x-jsonlines',
      'md': 'text/markdown',
      'txt': 'text/plain',
      'csv': 'text/csv',
      'yaml': 'application/x-yaml',
      'yml': 'application/x-yaml',
      'js': 'application/javascript',
      'ts': 'application/typescript'
    };

    return contentTypes[ext || ''] || 'application/octet-stream';
  }

  /**
   * Extract metric value from metrics object
   */
  private extractMetricValue(metrics: any, metricName: string): number | null {
    try {
      // Handle nested metric structures
      const paths = [
        metricName,
        `${metricName}.rate`,
        `${metricName}.value`,
        `${metricName}_rate`,
        `${metricName}_value`,
        `overall.${metricName}`,
        `summary.${metricName}`
      ];

      for (const path of paths) {
        const value = this.getNestedValue(metrics, path);
        if (typeof value === 'number' && !isNaN(value)) {
          return value;
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Save manifest to file
   */
  private saveManifest(manifest: DataManifest): void {
    const manifestPath = join(this.manifestDir, `${manifest.manifest_id}.json`);

    try {
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      console.log(`💾 Manifest saved: ${manifestPath}`);
    } catch (error) {
      console.error(`Failed to save manifest ${manifest.manifest_id}:`, error);
      throw error;
    }
  }

  /**
   * Save reproducibility check
   */
  private saveReproducibilityCheck(check: ReproducibilityCheck): void {
    const checksDir = join(this.manifestDir, 'reproducibility_checks');
    if (!existsSync(checksDir)) {
      mkdirSync(checksDir, { recursive: true });
    }

    const checkPath = join(checksDir, `${check.manifest_id}_${check.comparison_run_id}.json`);

    try {
      writeFileSync(checkPath, JSON.stringify(check, null, 2));
      console.log(`📊 Reproducibility check saved: ${checkPath}`);
    } catch (error) {
      console.error('Failed to save reproducibility check:', error);
    }
  }

  /**
   * List all manifests
   */
  listManifests(): { id: string; description: string; created: string; file_count: number }[] {
    try {
      const manifestFiles = require('fs').readdirSync(this.manifestDir)
        .filter((file: string) => file.endsWith('.json'));

      const manifests = [];

      for (const file of manifestFiles) {
        try {
          const content = readFileSync(join(this.manifestDir, file), 'utf-8');
          const manifest = JSON.parse(content) as DataManifest;

          manifests.push({
            id: manifest.manifest_id,
            description: manifest.description,
            created: manifest.created_timestamp,
            file_count: manifest.file_count
          });
        } catch (error) {
          console.warn(`Failed to parse manifest ${file}:`, error);
        }
      }

      return manifests.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
    } catch (error) {
      console.error('Failed to list manifests:', error);
      return [];
    }
  }
}

/**
 * Factory function to create manifest manager
 */
export function createManifestManager(baseDir?: string): ManifestManager {
  return new ManifestManager(baseDir);
}

/**
 * Default patterns for different environments
 */
export const DEFAULT_PATTERNS = {
  input: [
    'scripts/entrypoints.jsonl',
    'apps/fe-web/dev/runs/*.json',
    'src/**/*.ts',
    'src/**/*.js'
  ],
  gold: [
    'tests/regression/*.json',
    'tests/regression/*.jsonl',
    'reports/baseline_*.jsonl'
  ],
  config: [
    'baseline_config.json',
    'package.json',
    'tsconfig.json',
    '.env*',
    'schema/*.json'
  ]
};