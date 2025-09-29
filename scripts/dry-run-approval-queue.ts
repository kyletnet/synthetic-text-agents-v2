#!/usr/bin/env tsx

/**
 * Dry-Run Auto-Approval Queue System
 * Implements intelligent queuing and auto-approval for low-risk changes
 * Enables "true self-maintain" functionality with safety guarantees
 */

import { AutoFixManager, DryRunResult, AutoFixOperation } from './lib/auto-fix-manager.js';
import { promises as fs } from 'fs';
import path from 'path';
import { execSync } from 'child_process';

interface ApprovalCriteria {
  maxRiskLevel: 'low' | 'medium' | 'high' | 'critical';
  maxFilesChanged: number;
  maxLinesChanged: number;
  maxFileSizeBytes: number;
  requiresApprovalPatterns: string[];
  autoApprovePatterns: string[];
  blacklistPatterns: string[];
}

interface QueuedDryRun {
  id: string;
  operation: AutoFixOperation;
  dryRunResult: DryRunResult;
  queuedAt: Date;
  status: 'pending' | 'auto-approved' | 'manually-approved' | 'rejected' | 'executed' | 'failed';
  approvalReason: string;
  executedAt?: Date;
  executionResult?: string;
  autoApprovalScore: number;
}

interface ApprovalQueue {
  timestamp: Date;
  criteria: ApprovalCriteria;
  queue: QueuedDryRun[];
  stats: {
    totalQueued: number;
    autoApproved: number;
    manuallyApproved: number;
    rejected: number;
    executed: number;
  };
}

class DryRunApprovalQueue {
  private readonly queuePath = './reports/dry-run-approval-queue.json';
  private readonly criteriaPath = './config/approval-criteria.json';
  private manager: AutoFixManager;

  private readonly defaultCriteria: ApprovalCriteria = {
    maxRiskLevel: 'low',
    maxFilesChanged: 3,
    maxLinesChanged: 50,
    maxFileSizeBytes: 10 * 1024, // 10KB
    requiresApprovalPatterns: [
      '.*package\\.json$',
      '.*tsconfig.*\\.json$',
      '.*\\.env.*',
      '.*/config/.*',
      '.*/security/.*'
    ],
    autoApprovePatterns: [
      '.*\\.md$',
      '.*/docs/.*',
      '.*/tests?/.*\\.ts$',
      '.*\\.test\\.ts$',
      '.*\\.spec\\.ts$'
    ],
    blacklistPatterns: [
      '.*\\.env$',
      '.*secrets.*',
      '.*keys?/.*',
      '.*/production/.*',
      '.*/live/.*'
    ]
  };

  constructor() {
    this.manager = new AutoFixManager();
  }

  async queueDryRun(operation: AutoFixOperation): Promise<string> {
    console.log(`📋 Queuing dry-run for operation: ${operation.name}`);

    // Perform dry-run analysis
    const dryRunResult = await this.manager.dryRun(operation);

    // Calculate auto-approval score
    const approvalScore = await this.calculateApprovalScore(operation, dryRunResult);

    // Load current queue
    const queue = await this.loadQueue();
    const criteria = await this.loadCriteria();

    // Create queued item
    const queuedItem: QueuedDryRun = {
      id: `dry-run-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      operation,
      dryRunResult,
      queuedAt: new Date(),
      status: 'pending',
      approvalReason: '',
      autoApprovalScore: approvalScore
    };

    // Evaluate for auto-approval
    const approvalResult = await this.evaluateForAutoApproval(queuedItem, criteria);
    queuedItem.status = approvalResult.status;
    queuedItem.approvalReason = approvalResult.reason;

    // Add to queue
    queue.queue.push(queuedItem);
    queue.stats.totalQueued++;

    if (queuedItem.status === 'auto-approved') {
      queue.stats.autoApproved++;
      console.log(`🤖 Auto-approved: ${queuedItem.approvalReason}`);
    } else if (queuedItem.status === 'rejected') {
      queue.stats.rejected++;
      console.log(`❌ Auto-rejected: ${queuedItem.approvalReason}`);
    } else {
      console.log(`👤 Manual approval required: ${queuedItem.approvalReason}`);
    }

    await this.saveQueue(queue);

    console.log(`✅ Queued with ID: ${queuedItem.id}`);
    return queuedItem.id;
  }

  private async calculateApprovalScore(operation: AutoFixOperation, dryRunResult: DryRunResult): Promise<number> {
    let score = 100; // Start with perfect score

    // Risk level penalty
    const riskPenalties = { low: 0, medium: -20, high: -40, critical: -80 };
    score += riskPenalties[dryRunResult.impact.riskLevel];

    // File count penalty
    if (dryRunResult.changes.length > 5) score -= 15;
    if (dryRunResult.changes.length > 10) score -= 25;

    // Line changes penalty (estimate from diff)
    const estimatedLines = dryRunResult.previewDiff.split('\n').filter(line =>
      line.startsWith('+') || line.startsWith('-')
    ).length;

    if (estimatedLines > 20) score -= 10;
    if (estimatedLines > 50) score -= 20;
    if (estimatedLines > 100) score -= 30;

    // File type analysis
    const criticalFileTypes = ['.env', 'package.json', 'tsconfig', '.key', '.cert'];
    const hasCriticalFiles = dryRunResult.changes.some(change =>
      criticalFileTypes.some(type => change.filePath.includes(type))
    );
    if (hasCriticalFiles) score -= 30;

    // Documentation files bonus
    const docFileTypes = ['.md', '/docs/', '/README'];
    const hasDocFiles = dryRunResult.changes.some(change =>
      docFileTypes.some(type => change.filePath.includes(type))
    );
    if (hasDocFiles && !hasCriticalFiles) score += 10;

    // Test files bonus
    const testFileTypes = ['.test.', '.spec.', '/tests/', '/test/'];
    const hasTestFiles = dryRunResult.changes.some(change =>
      testFileTypes.some(type => change.filePath.includes(type))
    );
    if (hasTestFiles) score += 15;

    // Reversibility bonus
    if (dryRunResult.impact.reversibility === 'full') score += 10;
    if (dryRunResult.impact.reversibility === 'none') score -= 25;

    return Math.max(0, Math.min(100, score));
  }

  private async evaluateForAutoApproval(item: QueuedDryRun, criteria: ApprovalCriteria): Promise<{
    status: QueuedDryRun['status'];
    reason: string;
  }> {
    const { operation, dryRunResult, autoApprovalScore } = item;

    // Check blacklist patterns first
    for (const pattern of criteria.blacklistPatterns) {
      const regex = new RegExp(pattern, 'i');
      if (dryRunResult.changes.some(change => regex.test(change.filePath))) {
        return {
          status: 'rejected',
          reason: `Contains blacklisted file pattern: ${pattern}`
        };
      }
    }

    // Check risk level
    const riskLevels = { low: 0, medium: 1, high: 2, critical: 3 };
    if (riskLevels[dryRunResult.impact.riskLevel] > riskLevels[criteria.maxRiskLevel]) {
      return {
        status: 'pending',
        reason: `Risk level ${dryRunResult.impact.riskLevel} exceeds threshold ${criteria.maxRiskLevel}`
      };
    }

    // Check file count
    if (dryRunResult.changes.length > criteria.maxFilesChanged) {
      return {
        status: 'pending',
        reason: `Too many files changed: ${dryRunResult.changes.length} > ${criteria.maxFilesChanged}`
      };
    }

    // Check for files requiring manual approval
    for (const pattern of criteria.requiresApprovalPatterns) {
      const regex = new RegExp(pattern, 'i');
      if (dryRunResult.changes.some(change => regex.test(change.filePath))) {
        return {
          status: 'pending',
          reason: `Contains files requiring manual approval: ${pattern}`
        };
      }
    }

    // Check if all files match auto-approve patterns
    const allFilesAutoApprovable = dryRunResult.changes.every(change =>
      criteria.autoApprovePatterns.some(pattern => {
        const regex = new RegExp(pattern, 'i');
        return regex.test(change.filePath);
      })
    );

    // Auto-approval decision
    if (autoApprovalScore >= 80 && allFilesAutoApprovable) {
      return {
        status: 'auto-approved',
        reason: `High safety score (${autoApprovalScore}) and only safe file types`
      };
    } else if (autoApprovalScore >= 70 && dryRunResult.impact.riskLevel === 'low') {
      return {
        status: 'auto-approved',
        reason: `Good safety score (${autoApprovalScore}) with low risk`
      };
    } else {
      return {
        status: 'pending',
        reason: `Safety score too low (${autoApprovalScore}) or mixed file types`
      };
    }
  }

  async executeAutoApprovedItems(): Promise<void> {
    console.log('🤖 **Executing Auto-Approved Items**');
    console.log('═'.repeat(50));

    const queue = await this.loadQueue();
    const autoApproved = queue.queue.filter(item => item.status === 'auto-approved');

    if (autoApproved.length === 0) {
      console.log('✅ No auto-approved items to execute');
      return;
    }

    console.log(`🎯 Found ${autoApproved.length} auto-approved items`);

    for (const item of autoApproved) {
      console.log(`\n⚡ Executing: ${item.operation.name}`);
      console.log(`   Approval reason: ${item.approvalReason}`);
      console.log(`   Safety score: ${item.autoApprovalScore}`);

      try {
        // Create snapshot before execution
        const snapshotId = await this.manager.createSnapshot(
          `auto-execute-${item.operation.name}`,
          item.operation.targetFiles,
          {
            description: `Auto-execution of queued operation: ${item.operation.name}`,
            tags: ['auto-approved', 'queue-execution']
          }
        );

        console.log(`   📸 Snapshot created: ${snapshotId}`);

        // Execute the operation
        const result = await this.manager.executeWithRollback(item.operation);

        item.status = 'executed';
        item.executedAt = new Date();
        item.executionResult = `✅ Success with snapshot ${snapshotId}`;

        queue.stats.executed++;

        console.log(`   ✅ Executed successfully`);

      } catch (error: any) {
        item.status = 'failed';
        item.executedAt = new Date();
        item.executionResult = `❌ Failed: ${error.message}`;

        console.log(`   ❌ Execution failed: ${error.message}`);
      }
    }

    await this.saveQueue(queue);
    console.log(`\n📊 Execution completed. Updated queue with ${autoApproved.length} processed items.`);
  }

  async displayQueueStatus(): Promise<void> {
    const queue = await this.loadQueue();

    console.log('📋 **Dry-Run Approval Queue Status**');
    console.log('═'.repeat(60));
    console.log(`Last updated: ${new Date(queue.timestamp).toLocaleString()}`);
    console.log(`Total items: ${queue.queue.length}`);

    console.log('\n📊 **Statistics**:');
    console.log(`   Total queued: ${queue.stats.totalQueued}`);
    console.log(`   🤖 Auto-approved: ${queue.stats.autoApproved}`);
    console.log(`   👤 Manually approved: ${queue.stats.manuallyApproved}`);
    console.log(`   ❌ Rejected: ${queue.stats.rejected}`);
    console.log(`   ✅ Executed: ${queue.stats.executed}`);

    // Active items
    const activeItems = queue.queue.filter(item =>
      ['pending', 'auto-approved', 'manually-approved'].includes(item.status)
    );

    if (activeItems.length > 0) {
      console.log(`\n⏳ **Active Queue** (${activeItems.length} items):`);

      activeItems.forEach((item, index) => {
        const statusEmoji = {
          'pending': '⏳',
          'auto-approved': '🤖',
          'manually-approved': '👤'
        }[item.status] || '❓';

        const ageHours = (Date.now() - new Date(item.queuedAt).getTime()) / (1000 * 60 * 60);

        console.log(`   ${index + 1}. ${statusEmoji} **${item.operation.name}**`);
        console.log(`      ID: ${item.id}`);
        console.log(`      Status: ${item.status}`);
        console.log(`      Safety score: ${item.autoApprovalScore}`);
        console.log(`      Age: ${ageHours.toFixed(1)}h`);
        console.log(`      Files: ${item.dryRunResult.changes.length}`);
        console.log(`      Risk: ${item.dryRunResult.impact.riskLevel}`);
        console.log(`      Reason: ${item.approvalReason}`);
      });
    }

    console.log('\n💻 **Commands**:');
    console.log('   npm run queue:execute              # Execute auto-approved items');
    console.log('   npm run queue:approve <id>         # Manually approve item');
    console.log('   npm run queue:reject <id>          # Reject item');
    console.log('   npm run queue:clear                # Clear completed items');
  }

  private async loadQueue(): Promise<ApprovalQueue> {
    try {
      const content = await fs.readFile(this.queuePath, 'utf8');
      return JSON.parse(content);
    } catch {
      return {
        timestamp: new Date(),
        criteria: await this.loadCriteria(),
        queue: [],
        stats: {
          totalQueued: 0,
          autoApproved: 0,
          manuallyApproved: 0,
          rejected: 0,
          executed: 0
        }
      };
    }
  }

  private async saveQueue(queue: ApprovalQueue): Promise<void> {
    queue.timestamp = new Date();
    await fs.mkdir(path.dirname(this.queuePath), { recursive: true });
    await fs.writeFile(this.queuePath, JSON.stringify(queue, null, 2));
  }

  private async loadCriteria(): Promise<ApprovalCriteria> {
    try {
      const content = await fs.readFile(this.criteriaPath, 'utf8');
      return { ...this.defaultCriteria, ...JSON.parse(content) };
    } catch {
      await this.saveCriteria(this.defaultCriteria);
      return this.defaultCriteria;
    }
  }

  private async saveCriteria(criteria: ApprovalCriteria): Promise<void> {
    await fs.mkdir(path.dirname(this.criteriaPath), { recursive: true });
    await fs.writeFile(this.criteriaPath, JSON.stringify(criteria, null, 2));
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const queue = new DryRunApprovalQueue();

  const command = args[0] || 'status';

  try {
    switch (command) {
      case 'status':
        await queue.displayQueueStatus();
        break;

      case 'execute':
        await queue.executeAutoApprovedItems();
        break;

      case 'demo':
        console.log('🎮 **Demo Mode**: Creating sample queued operations...');

        // Create demo operations
        const demoOperations = [
          {
            id: 'demo-docs-update',
            name: 'Update documentation',
            description: 'Update README and docs',
            priority: 'P2' as const,
            targetFiles: ['README.md', 'docs/API.md'],
            changes: [
              {
                filePath: 'README.md',
                changeType: 'modify' as const,
                newContent: '# Updated README\nNew content...',
                oldContent: '# Old README\nOld content...'
              }
            ]
          },
          {
            id: 'demo-config-change',
            name: 'Update package.json',
            description: 'Add new script to package.json',
            priority: 'P1' as const,
            targetFiles: ['package.json'],
            changes: [
              {
                filePath: 'package.json',
                changeType: 'modify' as const,
                newContent: '{"scripts": {"new": "echo hello"}}',
                oldContent: '{"scripts": {}}'
              }
            ]
          }
        ];

        for (const op of demoOperations) {
          const queueId = await queue.queueDryRun(op);
          console.log(`✅ Demo operation queued: ${queueId}`);
        }
        break;

      default:
        console.log('Usage:');
        console.log('  npm run queue:status    # Show queue status');
        console.log('  npm run queue:execute   # Execute auto-approved items');
        console.log('  npm run queue:demo      # Create demo queue items');
    }
  } catch (error) {
    console.error('❌ Queue system error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { DryRunApprovalQueue };
export default DryRunApprovalQueue;