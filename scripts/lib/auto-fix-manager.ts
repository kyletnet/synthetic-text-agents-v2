#!/usr/bin/env tsx

/**
 * Auto Fix Manager with Rollback Support
 * Implements snapshot-based rollback and dry-run capabilities for system modifications
 */

import { promises as fs } from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { EventEmitter } from "events";
import { createGzip, createGunzip } from "zlib";
import { promisify } from "util";
import { pipeline } from "stream";

export type SnapshotId = string;
export type Priority = 'P0' | 'P1' | 'P2';

export interface FileChange {
  filePath: string;
  oldContent?: string;
  newContent: string;
  changeType: 'create' | 'modify' | 'delete' | 'rename';
  metadata?: Record<string, unknown>;
}

export interface RiskAssessment {
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  impactedFiles: number;
  reversibility: 'full' | 'partial' | 'none';
  dependencies: string[];
  potentialIssues: string[];
  explanation: CognitiveExplanation;
  confidence: number;
  mitigationStrategies: string[];
}

export interface CognitiveExplanation {
  summary: string;
  reasoning: string[];
  userImpact: string;
  technicalDetails: string;
  recommendedAction: string;
  alternativeOptions: string[];
}

export interface DryRunResult {
  changes: FileChange[];
  impact: RiskAssessment;
  previewDiff: string;
  rollbackPlan: string[];
  estimatedDuration: number;
  resourcesRequired: string[];
}

export interface AutoFixOperation {
  id: string;
  name: string;
  description: string;
  priority: Priority;
  targetFiles: string[];
  changes: FileChange[];
  metadata?: Record<string, unknown>;
}

export interface SnapshotManifest {
  id: SnapshotId;
  timestamp: Date;
  operation: string;
  files: {
    path: string;
    backup: string;
    checksum: string;
    originalSize: number;
    compressedSize?: number;
    compressionRatio?: number;
    isCompressed: boolean;
  }[];
  metadata: {
    gitCommit?: string;
    workingDirectory: string;
    systemState?: Record<string, unknown>;
    creator: string;
    environment: Record<string, string>;
    totalSize: number;
    totalCompressedSize: number;
    compressionSavings: number;
    version: string;
    tags: string[];
    description?: string;
  };
}

/**
 * Auto Fix Manager - Handles system modifications with rollback capability
 */
export class CognitiveExplanationSystem {
  static generateExplanation(changes: FileChange[], riskLevel: RiskAssessment['riskLevel'], impactedFiles: number): CognitiveExplanation {
    const explanations = {
      low: {
        summary: "낮은 위험도의 변경사항입니다. 시스템에 최소한의 영향을 미칩니다.",
        reasoning: [
          "변경되는 파일 수가 적습니다",
          "핵심 시스템 파일은 포함되지 않습니다",
          "롤백이 쉽고 안전합니다"
        ],
        userImpact: "사용자에게 거의 영향을 주지 않으며, 기능 개선이나 버그 수정의 효과가 있습니다.",
        recommendedAction: "자동 승인하여 즉시 적용할 수 있습니다."
      },
      medium: {
        summary: "중간 위험도의 변경사항입니다. 주의깊은 검토가 필요합니다.",
        reasoning: [
          "여러 파일이 변경됩니다",
          "일부 중요한 기능에 영향을 줄 수 있습니다",
          "테스트와 검증이 필요합니다"
        ],
        userImpact: "사용자 경험에 일부 영향을 줄 수 있으나, 전체적으로는 개선 효과가 있습니다.",
        recommendedAction: "테스트를 통한 검증 후 승인하는 것을 권장합니다."
      },
      high: {
        summary: "높은 위험도의 변경사항입니다. 신중한 검토와 테스트가 필수입니다.",
        reasoning: [
          "많은 파일이 변경되거나 핵심 시스템이 포함됩니다",
          "시스템 안정성에 영향을 줄 수 있습니다",
          "롤백 계획이 중요합니다"
        ],
        userImpact: "사용자 경험에 상당한 변화가 있을 수 있으며, 일시적인 불편함이 있을 수 있습니다.",
        recommendedAction: "충분한 테스트와 단계적 배포를 통해 신중하게 진행해야 합니다."
      },
      critical: {
        summary: "치명적 위험도의 변경사항입니다. 전문가 검토와 철저한 준비가 필요합니다.",
        reasoning: [
          "핵심 설정 파일이나 보안 관련 파일이 변경됩니다",
          "시스템 전체의 안정성에 영향을 줄 수 있습니다",
          "복구 불가능한 변경사항이 포함될 수 있습니다"
        ],
        userImpact: "시스템 중단이나 데이터 손실의 위험이 있으며, 사용자에게 심각한 영향을 줄 수 있습니다.",
        recommendedAction: "전문가 검토, 백업 확인, 단계별 롤아웃 계획이 필수입니다."
      }
    };

    const base = explanations[riskLevel];

    return {
      summary: base.summary,
      reasoning: base.reasoning,
      userImpact: base.userImpact,
      technicalDetails: this.generateTechnicalDetails(changes, impactedFiles),
      recommendedAction: base.recommendedAction,
      alternativeOptions: this.generateAlternatives(riskLevel, changes)
    };
  }

  private static generateTechnicalDetails(changes: FileChange[], impactedFiles: number): string {
    const fileTypes = changes.reduce((acc, change) => {
      const ext = change.filePath.split('.').pop() || 'unknown';
      acc[ext] = (acc[ext] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const typesSummary = Object.entries(fileTypes)
      .map(([type, count]) => `${type}: ${count}개`)
      .join(', ');

    return `총 ${impactedFiles}개 파일 변경 (${typesSummary}). ` +
           `변경 유형: ${changes.map(c => c.changeType).join(', ')}.`;
  }

  private static generateAlternatives(riskLevel: RiskAssessment['riskLevel'], changes: FileChange[]): string[] {
    const alternatives = [
      "단계별 적용: 변경사항을 여러 단계로 나누어 순차적으로 적용",
      "테스트 환경에서 먼저 검증 후 프로덕션 적용",
      "롤백 계획 수립 후 진행"
    ];

    if (riskLevel === 'critical') {
      alternatives.push(
        "전문가 코드 리뷰 후 수동 적용",
        "시스템 백업 생성 후 점검 시간에 적용"
      );
    }

    return alternatives;
  }

  static generateMitigationStrategies(riskLevel: RiskAssessment['riskLevel'], changes: FileChange[]): string[] {
    const strategies = ["변경 전 시스템 스냅샷 생성", "자동 테스트 실행"];

    if (riskLevel === 'high' || riskLevel === 'critical') {
      strategies.push(
        "수동 테스트 및 검증",
        "단계별 롤아웃 계획",
        "모니터링 시스템 강화"
      );
    }

    if (riskLevel === 'critical') {
      strategies.push(
        "전문가 승인 필수",
        "장애 대응 팀 대기",
        "즉시 롤백 준비"
      );
    }

    return strategies;
  }
}

export class AutoFixManager extends EventEmitter {
  private snapshotsDir: string;
  private backupsDir: string;
  private manifestPath: string;
  private snapshots: Map<SnapshotId, SnapshotManifest> = new Map();

  constructor(baseDir = '/tmp/claude') {
    super();
    this.setMaxListeners(50);

    this.snapshotsDir = path.join(baseDir, 'auto-fix-snapshots');
    this.backupsDir = path.join(baseDir, 'file-backups');
    this.manifestPath = path.join(this.snapshotsDir, 'manifest.json');

    this.initializeDirectories();
    this.loadSnapshots();
  }

  /**
   * Compression utilities for snapshot optimization
   */
  private readonly pipelineAsync = promisify(pipeline);

  private async compressFile(inputPath: string, outputPath: string): Promise<{ originalSize: number; compressedSize: number; compressionRatio: number }> {
    const stats = await fs.stat(inputPath);
    const originalSize = stats.size;

    const readStream = await fs.open(inputPath, 'r');
    const writeStream = await fs.open(outputPath, 'w');

    try {
      await this.pipelineAsync(
        readStream.createReadStream(),
        createGzip({ level: 6 }),
        writeStream.createWriteStream()
      );

      const compressedStats = await fs.stat(outputPath);
      const compressedSize = compressedStats.size;
      const compressionRatio = (1 - compressedSize / originalSize) * 100;

      return { originalSize, compressedSize, compressionRatio };
    } finally {
      await readStream.close();
      await writeStream.close();
    }
  }

  private async decompressFile(inputPath: string, outputPath: string): Promise<void> {
    const readStream = await fs.open(inputPath, 'r');
    const writeStream = await fs.open(outputPath, 'w');

    try {
      await this.pipelineAsync(
        readStream.createReadStream(),
        createGunzip(),
        writeStream.createWriteStream()
      );
    } finally {
      await readStream.close();
      await writeStream.close();
    }
  }

  private async calculateChecksum(filePath: string): Promise<string> {
    const crypto = await import('crypto');
    const hash = crypto.createHash('sha256');
    const content = await fs.readFile(filePath);
    hash.update(content);
    return hash.digest('hex');
  }

  private async collectSystemEnvironment(): Promise<Record<string, string>> {
    const env: Record<string, string> = {
      nodeVersion: process.version,
      platform: process.platform,
      architecture: process.arch,
      workingDirectory: process.cwd(),
      timestamp: new Date().toISOString()
    };

    // Add git information if available
    try {
      env.gitBranch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
      env.gitCommit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
      env.gitStatus = execSync('git status --porcelain', { encoding: 'utf8' }).trim() || 'clean';
    } catch {
      // Git not available
    }

    // Add package.json info if available
    try {
      const packageJson = JSON.parse(await fs.readFile('./package.json', 'utf8'));
      env.projectName = packageJson.name || 'unknown';
      env.projectVersion = packageJson.version || '0.0.0';
    } catch {
      // package.json not available
    }

    return env;
  }

  private async backupFileWithCompression(snapshotId: SnapshotId, filePath: string, compress = true): Promise<{
    path: string;
    backup: string;
    checksum: string;
    originalSize: number;
    compressedSize?: number;
    compressionRatio?: number;
    isCompressed: boolean;
  }> {
    const backupName = `${snapshotId}_${path.basename(filePath)}_${Date.now()}`;
    const tempBackupPath = path.join(this.backupsDir, backupName);

    // Copy file to temp location first
    await fs.copyFile(filePath, tempBackupPath);

    // Calculate checksum of original
    const checksum = await this.calculateChecksum(filePath);
    const stats = await fs.stat(filePath);
    const originalSize = stats.size;

    if (compress && originalSize > 1024) { // Only compress files > 1KB
      const compressedBackupPath = `${tempBackupPath}.gz`;

      try {
        const compressionResult = await this.compressFile(tempBackupPath, compressedBackupPath);

        // Remove uncompressed temp file
        await fs.unlink(tempBackupPath);

        return {
          path: filePath,
          backup: path.basename(compressedBackupPath),
          checksum,
          originalSize,
          compressedSize: compressionResult.compressedSize,
          compressionRatio: compressionResult.compressionRatio,
          isCompressed: true
        };
      } catch (error) {
        console.warn(`⚠️  Compression failed for ${filePath}, storing uncompressed:`, error);
        // Fall back to uncompressed
      }
    }

    // Store uncompressed
    return {
      path: filePath,
      backup: path.basename(tempBackupPath),
      checksum,
      originalSize,
      isCompressed: false
    };
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  /**
   * Create a snapshot before executing operations
   */
  async createSnapshot(operation: string, targetFiles?: string[], options: {
    compress?: boolean;
    description?: string;
    tags?: string[];
  } = {}): Promise<SnapshotId> {
    const { compress = true, description, tags = [] } = options;
    const snapshotId = `snapshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log(`📸 Creating enhanced snapshot: ${snapshotId}`);
    console.log(`🔧 Operation: ${operation}`);
    console.log(`📝 Description: ${description || 'No description provided'}`);
    console.log(`🗜️  Compression: ${compress ? 'Enabled' : 'Disabled'}`);

    // Collect comprehensive environment information
    const environment = await this.collectSystemEnvironment();

    // Determine files to backup
    const filesToBackup = targetFiles || await this.getModifiedFiles();
    console.log(`📋 Files to backup: ${filesToBackup.length}`);

    const backupPromises: Promise<{
      path: string;
      backup: string;
      checksum: string;
      originalSize: number;
      compressedSize?: number;
      compressionRatio?: number;
      isCompressed: boolean;
    }>[] = [];

    for (const filePath of filesToBackup) {
      if (await this.fileExists(filePath)) {
        backupPromises.push(this.backupFileWithCompression(snapshotId, filePath, compress));
      }
    }

    const backedUpFiles = await Promise.all(backupPromises);

    // Calculate total sizes and compression savings
    const totalSize = backedUpFiles.reduce((sum, file) => sum + file.originalSize, 0);
    const totalCompressedSize = backedUpFiles.reduce((sum, file) =>
      sum + (file.compressedSize || file.originalSize), 0);
    const compressionSavings = totalSize > 0 ? ((totalSize - totalCompressedSize) / totalSize) * 100 : 0;

    const manifest: SnapshotManifest = {
      id: snapshotId,
      timestamp: new Date(),
      operation,
      files: backedUpFiles,
      metadata: {
        gitCommit: environment.gitCommit,
        workingDirectory: environment.workingDirectory,
        systemState: await this.captureSystemState(),
        creator: `auto-fix-manager-v${environment.projectVersion || '1.0.0'}`,
        environment,
        totalSize,
        totalCompressedSize,
        compressionSavings,
        version: '2.0.0',
        tags: [...tags, operation.toLowerCase().replace(/[^a-z0-9]/g, '-')],
        description
      }
    };

    this.snapshots.set(snapshotId, manifest);
    await this.saveSnapshots();

    console.log(`✅ Snapshot created successfully`);
    console.log(`💾 Total size: ${this.formatBytes(totalSize)}`);
    if (compress) {
      console.log(`🗜️  Compressed size: ${this.formatBytes(totalCompressedSize)}`);
      console.log(`💰 Space saved: ${compressionSavings.toFixed(1)}%`);
    }

    this.emit('snapshot:created', { snapshotId, manifest });
    return snapshotId;
  }

  /**
   * Execute operation with automatic rollback capability
   */
  async executeWithRollback(operation: AutoFixOperation): Promise<{
    success: boolean;
    snapshotId: SnapshotId;
    error?: Error;
    results?: unknown;
  }> {
    const snapshotId = await this.createSnapshot(operation.name, operation.targetFiles);

    try {
      console.log(`🚀 Executing operation: ${operation.name} (${operation.id})`);
      this.emit('operation:started', { operation, snapshotId });

      const results = await this.executeOperation(operation);

      console.log(`✅ Operation completed successfully: ${operation.name}`);
      this.emit('operation:completed', { operation, snapshotId, results });

      return { success: true, snapshotId, results };

    } catch (error) {
      console.error(`❌ Operation failed: ${operation.name}`, error);
      console.log(`🔄 Auto-rolling back to snapshot: ${snapshotId}`);

      try {
        await this.rollback(snapshotId);
        console.log(`✅ Rollback completed for operation: ${operation.name}`);
      } catch (rollbackError) {
        console.error(`💥 Rollback failed for snapshot: ${snapshotId}`, rollbackError);
        this.emit('rollback:failed', { snapshotId, rollbackError });
      }

      this.emit('operation:failed', { operation, snapshotId, error });
      return { success: false, snapshotId, error: error as Error };
    }
  }

  /**
   * Perform dry run analysis of operation
   */
  async dryRun(operation: AutoFixOperation): Promise<DryRunResult> {
    console.log(`🔍 Dry run analysis: ${operation.name}`);
    console.log(`📝 Description: ${operation.description}`);
    console.log(`⚡ Priority: ${operation.priority}\n`);

    const changes = await this.analyzeChanges(operation);
    const impact = await this.assessRisk(changes);
    const previewDiff = await this.generatePreviewDiff(changes);
    const rollbackPlan = await this.generateRollbackPlan(operation);

    const dryRunResult: DryRunResult = {
      changes,
      impact,
      previewDiff,
      rollbackPlan,
      estimatedDuration: this.estimateDuration(operation),
      resourcesRequired: this.getResourceRequirements(operation)
    };

    // Display enhanced dry-run results
    await this.displayDryRunResults(dryRunResult, operation);

    this.emit('dry-run:completed', { operation, result: dryRunResult });
    return dryRunResult;
  }

  /**
   * Display formatted dry-run results with enhanced diff preview
   */
  private async displayDryRunResults(result: DryRunResult, operation: AutoFixOperation): Promise<void> {
    // Show summary
    const summary = await this.generatePreviewSummary(result.changes);
    console.log(summary);

    // Show risk assessment
    console.log(`\n⚠️  **Risk Assessment**:`);
    console.log(`   Level: ${result.impact.riskLevel.toUpperCase()}`);
    console.log(`   Reversibility: ${result.impact.reversibility}`);
    console.log(`   Files impacted: ${result.impact.impactedFiles}`);

    if (result.impact.potentialIssues.length > 0) {
      console.log(`   Issues:`);
      result.impact.potentialIssues.forEach(issue =>
        console.log(`   - ${issue}`)
      );
    }

    if (result.impact.dependencies.length > 0) {
      console.log(`   Dependencies: ${result.impact.dependencies.join(', ')}`);
    }

    // Show resource requirements
    console.log(`\n📋 **Resource Requirements**:`);
    console.log(`   Duration: ~${result.estimatedDuration} seconds`);
    if (result.resourcesRequired.length > 0) {
      console.log(`   Resources: ${result.resourcesRequired.join(', ')}`);
    }

    // Show rollback plan
    console.log(`\n🔄 **Rollback Plan**:`);
    result.rollbackPlan.forEach((step, index) =>
      console.log(`   ${index + 1}. ${step}`)
    );

    // Show diff preview (truncated for readability)
    console.log(`\n🔍 **Diff Preview** (first 50 lines):`);
    console.log('─'.repeat(60));

    const diffLines = result.previewDiff.split('\n');
    const maxLines = Math.min(50, diffLines.length);

    for (let i = 0; i < maxLines; i++) {
      const line = diffLines[i];
      // Colorize diff output (for terminals that support it)
      if (line.startsWith('+')) {
        console.log(`\x1b[32m${line}\x1b[0m`); // Green for additions
      } else if (line.startsWith('-')) {
        console.log(`\x1b[31m${line}\x1b[0m`); // Red for deletions
      } else if (line.startsWith('@@')) {
        console.log(`\x1b[36m${line}\x1b[0m`); // Cyan for hunk headers
      } else if (line.startsWith('---') || line.startsWith('+++')) {
        console.log(`\x1b[1m${line}\x1b[0m`); // Bold for file headers
      } else {
        console.log(line); // Normal for context
      }
    }

    if (diffLines.length > maxLines) {
      console.log(`\x1b[33m... (${diffLines.length - maxLines} more lines)\x1b[0m`);
    }

    console.log('─'.repeat(60));

    // Action recommendations
    console.log(`\n💡 **Recommendations**:`);
    if (result.impact.riskLevel === 'critical') {
      console.log(`   ⚠️  CRITICAL RISK: Review changes carefully before proceeding`);
      console.log(`   📸 Ensure snapshot is created before execution`);
      console.log(`   🧪 Consider testing in isolated environment first`);
    } else if (result.impact.riskLevel === 'high') {
      console.log(`   ⚡ HIGH RISK: Recommended to create snapshot before execution`);
      console.log(`   🔍 Review impacted files for unintended changes`);
    } else if (result.impact.riskLevel === 'medium') {
      console.log(`   📋 MEDIUM RISK: Standard precautions recommended`);
      console.log(`   💾 Snapshot creation suggested`);
    } else {
      console.log(`   ✅ LOW RISK: Safe to proceed with normal precautions`);
    }

    // Next steps
    console.log(`\n⚡ **Next Steps**:`);
    console.log(`   To proceed: Execute the operation with proper safeguards`);
    console.log(`   To modify: Adjust operation parameters and re-run dry-run`);
    console.log(`   To export: Save detailed diff to file for review\n`);
  }

  /**
   * Export dry-run results to file for detailed review
   */
  async exportDryRun(operation: AutoFixOperation, result: DryRunResult, exportPath?: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = exportPath || `./dry-run-${operation.id}-${timestamp}.diff`;

    let content = `# Dry Run Analysis: ${operation.name}\n`;
    content += `Generated: ${new Date().toISOString()}\n`;
    content += `Operation ID: ${operation.id}\n`;
    content += `Priority: ${operation.priority}\n`;
    content += `Description: ${operation.description}\n\n`;

    // Add summary
    content += await this.generatePreviewSummary(result.changes);
    content += '\n\n';

    // Add full diff
    content += '# Complete Diff Preview\n';
    content += '═'.repeat(80) + '\n';
    content += result.previewDiff;

    await fs.writeFile(filename, content, 'utf8');
    console.log(`📄 Dry-run details exported to: ${filename}`);

    return filename;
  }

  /**
   * Rollback to a specific snapshot
   */
  async rollback(snapshotId: SnapshotId): Promise<boolean> {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) {
      throw new Error(`Snapshot not found: ${snapshotId}`);
    }

    console.log(`🔄 Rolling back to snapshot: ${snapshotId} (${snapshot.operation})`);
    this.emit('rollback:started', { snapshotId, snapshot });

    try {
      // Restore files from backup
      for (const fileInfo of snapshot.files) {
        const backupPath = path.join(this.backupsDir, fileInfo.backup);

        if (await this.fileExists(backupPath)) {
          if (fileInfo.isCompressed) {
            // Decompress file before restoring
            console.log(`🗜️  Decompressing and restoring: ${fileInfo.path}`);
            await this.decompressFile(backupPath, fileInfo.path);

            // Verify checksum if available
            if (fileInfo.checksum) {
              const restoredChecksum = await this.calculateChecksum(fileInfo.path);
              if (restoredChecksum === fileInfo.checksum) {
                console.log(`✅ Checksum verified: ${fileInfo.path}`);
              } else {
                console.warn(`⚠️ Checksum mismatch for ${fileInfo.path} (expected: ${fileInfo.checksum}, got: ${restoredChecksum})`);
              }
            }
          } else {
            // Direct copy for uncompressed files
            await fs.copyFile(backupPath, fileInfo.path);
          }

          const sizeInfo = fileInfo.compressionRatio
            ? ` (saved ${fileInfo.compressionRatio.toFixed(1)}% space)`
            : '';
          console.log(`📂 Restored: ${fileInfo.path}${sizeInfo}`);
        } else {
          console.warn(`⚠️ Backup not found: ${backupPath}`);
        }
      }

      // Restore git state if available
      if (snapshot.metadata.gitCommit) {
        try {
          execSync(`git checkout ${snapshot.metadata.gitCommit} -- .`, {
            stdio: 'pipe',
            encoding: 'utf8'
          });
          console.log(`📝 Git state restored to: ${snapshot.metadata.gitCommit}`);
        } catch (gitError) {
          console.warn(`⚠️ Could not restore git state:`, gitError);
        }
      }

      this.emit('rollback:completed', { snapshotId, snapshot });
      console.log(`✅ Rollback completed: ${snapshotId}`);
      return true;

    } catch (error) {
      console.error(`❌ Rollback failed: ${snapshotId}`, error);
      this.emit('rollback:failed', { snapshotId, snapshot, error });
      throw error;
    }
  }

  /**
   * List available snapshots
   */
  getSnapshots(): SnapshotManifest[] {
    return Array.from(this.snapshots.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Display detailed snapshot information with enhanced metadata
   */
  async displaySnapshotInfo(snapshotId?: SnapshotId): Promise<void> {
    const snapshots = snapshotId
      ? [this.snapshots.get(snapshotId)].filter(Boolean) as SnapshotManifest[]
      : this.getSnapshots();

    if (snapshots.length === 0) {
      console.log('📭 No snapshots found');
      return;
    }

    console.log(`📸 **Snapshot Information** (${snapshots.length} snapshot${snapshots.length > 1 ? 's' : ''})`);
    console.log('═'.repeat(80));

    for (const snapshot of snapshots) {
      console.log(`\n🆔 **ID**: ${snapshot.id}`);
      console.log(`📅 **Created**: ${snapshot.timestamp.toLocaleString()}`);
      console.log(`⚙️  **Operation**: ${snapshot.operation}`);

      if (snapshot.metadata.description) {
        console.log(`📝 **Description**: ${snapshot.metadata.description}`);
      }

      // File information
      console.log(`📁 **Files**: ${snapshot.files.length}`);
      const compressedFiles = snapshot.files.filter(f => f.isCompressed).length;
      if (compressedFiles > 0) {
        console.log(`🗜️  **Compressed**: ${compressedFiles}/${snapshot.files.length}`);
      }

      // Size information
      console.log(`💾 **Total Size**: ${this.formatBytes(snapshot.metadata.totalSize)}`);
      if (snapshot.metadata.compressionSavings > 0) {
        console.log(`💰 **Compressed Size**: ${this.formatBytes(snapshot.metadata.totalCompressedSize)}`);
        console.log(`📉 **Space Saved**: ${snapshot.metadata.compressionSavings.toFixed(1)}%`);
      }

      // Environment info
      console.log(`🌍 **Environment**: ${snapshot.metadata.environment.platform} (${snapshot.metadata.environment.architecture})`);
      console.log(`📦 **Project**: ${snapshot.metadata.environment.projectName || 'unknown'} v${snapshot.metadata.environment.projectVersion || '0.0.0'}`);

      if (snapshot.metadata.gitCommit) {
        console.log(`🔀 **Git**: ${snapshot.metadata.gitCommit.substring(0, 8)} (${snapshot.metadata.environment.gitBranch || 'unknown branch'})`);
        if (snapshot.metadata.environment.gitStatus && snapshot.metadata.environment.gitStatus !== 'clean') {
          console.log(`⚠️  **Git Status**: Modified files present`);
        }
      }

      // Tags
      if (snapshot.metadata.tags && snapshot.metadata.tags.length > 0) {
        console.log(`🏷️  **Tags**: ${snapshot.metadata.tags.join(', ')}`);
      }

      // File details (if single snapshot)
      if (snapshots.length === 1 && snapshot.files.length > 0) {
        console.log(`\n📋 **File Details**:`);
        snapshot.files.forEach((file, index) => {
          const compressionInfo = file.isCompressed
            ? ` (${file.compressionRatio?.toFixed(1)}% saved)`
            : '';
          const size = file.isCompressed && file.compressedSize
            ? `${this.formatBytes(file.compressedSize)} → ${this.formatBytes(file.originalSize)}`
            : this.formatBytes(file.originalSize);

          console.log(`   ${index + 1}. ${file.path}`);
          console.log(`      Size: ${size}${compressionInfo}`);
          console.log(`      Checksum: ${file.checksum.substring(0, 16)}...`);
        });
      }

      if (snapshots.length > 1) {
        console.log('─'.repeat(60));
      }
    }

    console.log('\n💻 **Commands**:');
    console.log('   manager.displaySnapshotInfo(id)     # Show specific snapshot');
    console.log('   manager.rollback(id)                # Rollback to snapshot');
    console.log('   manager.deleteSnapshot(id)          # Delete snapshot');
    console.log('   manager.cleanupSnapshots(hours)     # Clean old snapshots');
  }

  /**
   * Clean up old snapshots
   */
  async cleanupSnapshots(retentionHours = 168): Promise<void> { // 7 days default
    const cutoffTime = new Date(Date.now() - (retentionHours * 60 * 60 * 1000));
    const snapshotsToDelete = Array.from(this.snapshots.values())
      .filter(s => s.timestamp < cutoffTime);

    console.log(`🧹 Cleaning up ${snapshotsToDelete.length} old snapshots`);

    for (const snapshot of snapshotsToDelete) {
      await this.deleteSnapshot(snapshot.id);
    }
  }

  /**
   * Delete a specific snapshot and its backups
   */
  async deleteSnapshot(snapshotId: SnapshotId): Promise<void> {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) return;

    // Delete backup files
    for (const fileInfo of snapshot.files) {
      const backupPath = path.join(this.backupsDir, fileInfo.backup);
      try {
        await fs.unlink(backupPath);
      } catch {
        // Backup file already deleted
      }
    }

    this.snapshots.delete(snapshotId);
    await this.saveSnapshots();

    console.log(`🗑️ Deleted snapshot: ${snapshotId}`);
    this.emit('snapshot:deleted', { snapshotId });
  }

  private async initializeDirectories(): Promise<void> {
    await fs.mkdir(this.snapshotsDir, { recursive: true });
    await fs.mkdir(this.backupsDir, { recursive: true });
  }

  private async loadSnapshots(): Promise<void> {
    try {
      if (await this.fileExists(this.manifestPath)) {
        const manifestData = await fs.readFile(this.manifestPath, 'utf8');
        const snapshots = JSON.parse(manifestData);

        for (const snapshot of snapshots) {
          this.snapshots.set(snapshot.id, {
            ...snapshot,
            timestamp: new Date(snapshot.timestamp)
          });
        }

        console.log(`📋 Loaded ${this.snapshots.size} snapshots from manifest`);
      }
    } catch (error) {
      console.warn(`⚠️ Could not load snapshot manifest:`, error);
    }
  }

  private async saveSnapshots(): Promise<void> {
    const snapshotsArray = Array.from(this.snapshots.values());
    await fs.writeFile(this.manifestPath, JSON.stringify(snapshotsArray, null, 2));
  }

  private async backupFile(snapshotId: SnapshotId, filePath: string): Promise<{
    path: string;
    backup: string;
    checksum: string;
  }> {
    const content = await fs.readFile(filePath, 'utf8');
    const checksum = await this.calculateChecksum(filePath);
    const backupFileName = `${snapshotId}_${path.basename(filePath)}_${checksum.substring(0, 8)}`;
    const backupPath = path.join(this.backupsDir, backupFileName);

    await fs.writeFile(backupPath, content);

    return {
      path: filePath,
      backup: backupFileName,
      checksum
    };
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async getModifiedFiles(): Promise<string[]> {
    try {
      const gitOutput = execSync('git diff --name-only HEAD', { encoding: 'utf8' });
      return gitOutput.split('\n').filter(f => f.trim());
    } catch {
      // If git is not available, return empty array
      return [];
    }
  }

  private async captureSystemState(): Promise<Record<string, unknown>> {
    return {
      nodeVersion: process.version,
      workingDirectory: process.cwd(),
      environmentVariables: Object.keys(process.env).length,
      memoryUsage: process.memoryUsage(),
      timestamp: new Date().toISOString()
    };
  }

  private async executeOperation(operation: AutoFixOperation): Promise<unknown> {
    // Apply file changes
    for (const change of operation.changes) {
      switch (change.changeType) {
        case 'create':
          await fs.writeFile(change.filePath, change.newContent);
          break;
        case 'modify':
          await fs.writeFile(change.filePath, change.newContent);
          break;
        case 'delete':
          await fs.unlink(change.filePath);
          break;
        // rename case would need additional logic
      }
    }

    return { appliedChanges: operation.changes.length };
  }

  private async analyzeChanges(operation: AutoFixOperation): Promise<FileChange[]> {
    // In a real implementation, this would analyze what changes would be made
    return operation.changes;
  }

  private async assessRisk(changes: FileChange[]): Promise<RiskAssessment> {
    const impactedFiles = changes.length;
    const hasDeleteOperations = changes.some(c => c.changeType === 'delete');
    const hasCriticalFiles = changes.some(c =>
      c.filePath.includes('package.json') ||
      c.filePath.includes('tsconfig.json') ||
      c.filePath.includes('.env')
    );

    let riskLevel: RiskAssessment['riskLevel'] = 'low';
    if (hasCriticalFiles) riskLevel = 'critical';
    else if (hasDeleteOperations || impactedFiles > 10) riskLevel = 'high';
    else if (impactedFiles > 3) riskLevel = 'medium';

    const explanation = CognitiveExplanationSystem.generateExplanation(changes, riskLevel, impactedFiles);
    const mitigationStrategies = CognitiveExplanationSystem.generateMitigationStrategies(riskLevel, changes);

    return {
      riskLevel,
      impactedFiles,
      reversibility: hasDeleteOperations ? 'partial' : 'full',
      dependencies: [], // Would analyze actual dependencies
      potentialIssues: hasCriticalFiles ? ['Configuration file changes detected'] : [],
      explanation,
      confidence: this.calculateConfidenceScore(changes, riskLevel),
      mitigationStrategies
    };
  }

  private calculateConfidenceScore(changes: FileChange[], riskLevel: RiskAssessment['riskLevel']): number {
    let baseScore = 0.8; // Base confidence score

    // Adjust based on risk level
    switch (riskLevel) {
      case 'low': baseScore = 0.95; break;
      case 'medium': baseScore = 0.8; break;
      case 'high': baseScore = 0.6; break;
      case 'critical': baseScore = 0.4; break;
    }

    // Adjust based on change complexity
    const complexChanges = changes.filter(c =>
      c.changeType === 'delete' ||
      c.filePath.includes('config') ||
      c.filePath.includes('.env')
    ).length;

    const complexityPenalty = Math.min(complexChanges * 0.1, 0.3);

    return Math.max(0.1, baseScore - complexityPenalty);
  }

  private async generatePreviewDiff(changes: FileChange[]): Promise<string> {
    let diff = '';

    for (const change of changes) {
      diff += this.generateFileHeader(change);
      diff += await this.generateUnifiedDiff(change);
      diff += '\n';
    }

    return diff.trim();
  }

  private generateFileHeader(change: FileChange): string {
    const timestamp = new Date().toISOString();
    let header = '';

    switch (change.changeType) {
      case 'create':
        header += `--- /dev/null\t${timestamp}\n`;
        header += `+++ ${change.filePath}\t${timestamp}\n`;
        break;
      case 'delete':
        header += `--- ${change.filePath}\t${timestamp}\n`;
        header += `+++ /dev/null\t${timestamp}\n`;
        break;
      case 'modify':
        header += `--- ${change.filePath}\t${timestamp}\n`;
        header += `+++ ${change.filePath}\t${timestamp}\n`;
        break;
      case 'rename':
        // For rename, assume oldContent path is in metadata
        const oldPath = change.metadata?.oldPath || `${change.filePath}.old`;
        header += `--- ${oldPath}\t${timestamp}\n`;
        header += `+++ ${change.filePath}\t${timestamp}\n`;
        break;
    }

    return header;
  }

  private async generateUnifiedDiff(change: FileChange): Promise<string> {
    if (change.changeType === 'create') {
      return this.generateCreateDiff(change);
    } else if (change.changeType === 'delete') {
      return this.generateDeleteDiff(change);
    } else {
      return this.generateModifyDiff(change);
    }
  }

  private generateCreateDiff(change: FileChange): string {
    const lines = change.newContent.split('\n');
    let diff = `@@ -0,0 +1,${lines.length} @@\n`;

    for (const line of lines) {
      diff += `+${line}\n`;
    }

    return diff;
  }

  private generateDeleteDiff(change: FileChange): string {
    const lines = change.oldContent?.split('\n') || [''];
    let diff = `@@ -1,${lines.length} +0,0 @@\n`;

    for (const line of lines) {
      diff += `-${line}\n`;
    }

    return diff;
  }

  private generateModifyDiff(change: FileChange): string {
    const oldLines = change.oldContent?.split('\n') || [''];
    const newLines = change.newContent.split('\n');

    // Simple line-by-line diff implementation
    const diffLines: Array<{type: 'context' | 'add' | 'remove', content: string}> = [];
    const maxLines = Math.max(oldLines.length, newLines.length);

    for (let i = 0; i < maxLines; i++) {
      const oldLine = oldLines[i];
      const newLine = newLines[i];

      if (oldLine === newLine) {
        // Context line (unchanged)
        if (oldLine !== undefined) {
          diffLines.push({ type: 'context', content: oldLine });
        }
      } else {
        // Line changed
        if (oldLine !== undefined) {
          diffLines.push({ type: 'remove', content: oldLine });
        }
        if (newLine !== undefined) {
          diffLines.push({ type: 'add', content: newLine });
        }
      }
    }

    // Generate unified diff with context
    let diff = this.generateDiffHeader(diffLines, oldLines.length, newLines.length);

    // Add context around changes (3 lines before/after by default)
    const contextLines = 3;
    const processedLines = this.addContext(diffLines, contextLines);

    for (const line of processedLines) {
      switch (line.type) {
        case 'context':
          diff += ` ${line.content}\n`;
          break;
        case 'add':
          diff += `+${line.content}\n`;
          break;
        case 'remove':
          diff += `-${line.content}\n`;
          break;
      }
    }

    return diff;
  }

  private generateDiffHeader(diffLines: Array<{type: string, content: string}>, oldLength: number, newLength: number): string {
    // Count changes for hunk header
    const removeCount = diffLines.filter(l => l.type === 'remove').length;
    const addCount = diffLines.filter(l => l.type === 'add').length;
    const contextCount = diffLines.filter(l => l.type === 'context').length;

    const oldStart = 1;
    const newStart = 1;
    const oldHunkLength = removeCount + contextCount;
    const newHunkLength = addCount + contextCount;

    return `@@ -${oldStart},${oldHunkLength} +${newStart},${newHunkLength} @@\n`;
  }

  private addContext(diffLines: Array<{type: string, content: string}>, contextLines: number): Array<{type: string, content: string}> {
    // For simplicity, return all lines - in practice, would add intelligent context windowing
    return diffLines;
  }

  private async generatePreviewSummary(changes: FileChange[]): Promise<string> {
    let summary = '\n📋 **Dry Run Summary**:\n';
    summary += '═'.repeat(50) + '\n';

    const stats = {
      created: changes.filter(c => c.changeType === 'create').length,
      modified: changes.filter(c => c.changeType === 'modify').length,
      deleted: changes.filter(c => c.changeType === 'delete').length,
      renamed: changes.filter(c => c.changeType === 'rename').length
    };

    summary += `📁 Files affected: ${changes.length}\n`;
    if (stats.created > 0) summary += `➕ Created: ${stats.created}\n`;
    if (stats.modified > 0) summary += `📝 Modified: ${stats.modified}\n`;
    if (stats.deleted > 0) summary += `❌ Deleted: ${stats.deleted}\n`;
    if (stats.renamed > 0) summary += `🔄 Renamed: ${stats.renamed}\n`;

    summary += '\n🔍 **File Changes**:\n';
    summary += '─'.repeat(40) + '\n';

    for (const change of changes) {
      const emoji = {
        create: '➕',
        modify: '📝',
        delete: '❌',
        rename: '🔄'
      }[change.changeType];

      const oldLines = change.oldContent?.split('\n').length || 0;
      const newLines = change.newContent.split('\n').length;
      const lineDiff = newLines - oldLines;
      const lineDiffStr = lineDiff > 0 ? `+${lineDiff}` : lineDiff < 0 ? `${lineDiff}` : '±0';

      summary += `${emoji} ${change.filePath} (${lineDiffStr} lines)\n`;

      if (change.changeType === 'modify' && Math.abs(lineDiff) > 10) {
        summary += `   ⚠️  Significant change: ${Math.abs(lineDiff)} lines\n`;
      }
    }

    return summary;
  }

  private async generateRollbackPlan(operation: AutoFixOperation): Promise<string[]> {
    return [
      `1. Create snapshot: ${operation.name}`,
      `2. Apply ${operation.changes.length} file changes`,
      `3. Verify system integrity`,
      `4. If failed: restore from snapshot`,
      `5. Clean up temporary files`
    ];
  }

  private estimateDuration(operation: AutoFixOperation): number {
    // Estimate in seconds based on operation complexity
    const baseTime = 30; // 30 seconds base
    const fileTime = operation.changes.length * 5; // 5 seconds per file
    return baseTime + fileTime;
  }

  private getResourceRequirements(operation: AutoFixOperation): string[] {
    return [
      'Disk space for backups',
      'File system write permissions',
      'Git repository (optional)',
      `Estimated ${Math.ceil(operation.changes.length * 1024 / 1024)} MB storage`
    ];
  }
}

// Global instance for easy access
export const autoFixManager = new AutoFixManager();
export default AutoFixManager;