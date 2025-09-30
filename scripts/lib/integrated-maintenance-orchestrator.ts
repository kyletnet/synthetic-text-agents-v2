#!/usr/bin/env tsx

/**
 * Integrated Maintenance Orchestrator
 * Smart Maintenance Orchestrator integrated with Core System Hub
 * Demonstrates unified component architecture in practice
 */

import { ComponentAdapter, IntegrationConfig } from './component-integration-adapter.js';
import { UnifiedMessage, Operation, ComponentId } from './core-system-hub.js';
import { safeGuard } from './safe-automation-guard.js';
import { approvalSystem } from './interactive-approval-system.js';
import { execSync } from 'child_process';
import { performance } from 'perf_hooks';

interface MaintenanceTask {
  name: string;
  command: string;
  frequency: "daily" | "weekly" | "on-change" | "before-commit";
  priority: "critical" | "high" | "medium" | "low";
  autoRun: boolean;
  description: string;
  dependencies?: ComponentId[];
}

interface MaintenanceRequest {
  tasks: MaintenanceTask[];
  mode: 'quick' | 'full' | 'targeted';
  requestedBy: ComponentId;
  priority: 'P0' | 'P1' | 'P2';
}

export class IntegratedMaintenanceOrchestrator extends ComponentAdapter {
  private availableTasks: MaintenanceTask[] = [
    {
      name: "TypeScript Health Check",
      command: "npm run dev:typecheck",
      frequency: "on-change",
      priority: "high",
      autoRun: false,
      description: "Check TypeScript compilation and type safety",
      dependencies: []
    },
    {
      name: "Lint and Format",
      command: "npm run lint",
      frequency: "before-commit",
      priority: "medium",
      autoRun: true,
      description: "Code style and quality checks",
      dependencies: []
    },
    {
      name: "Security Audit",
      command: "npm run advanced:audit",
      frequency: "daily",
      priority: "high",
      autoRun: false,
      description: "Security vulnerability scanning",
      dependencies: []
    },
    {
      name: "System Health Analysis",
      command: "npm run status",
      frequency: "on-change",
      priority: "medium",
      autoRun: true,
      description: "Overall system health and metrics",
      dependencies: ['unified-dashboard']
    }
  ];

  constructor() {
    const config: IntegrationConfig = {
      componentId: 'maintenance-orchestrator',
      version: '2.0.0',
      capabilities: ['maintenance', 'quality-control', 'automation', 'health-monitoring'],
      dependencies: ['unified-dashboard', 'approval-system', 'safe-automation-guard'],
      healthCheckInterval: 60000, // 1 minute
      enableMetrics: true
    };

    super(config);
    this.setupMaintenanceListeners();
  }

  private setupMaintenanceListeners(): void {
    // Listen for health degradation events
    this.onHealthDegradation = this.onHealthDegradation.bind(this);
  }

  protected async handleMessage(message: UnifiedMessage): Promise<void> {
    switch (message.type) {
      case 'request':
        await this.handleMaintenanceRequest(message);
        break;

      case 'event':
        await this.handleSystemEvent(message);
        break;

      case 'metric':
        await this.handleMetricUpdate(message);
        break;

      default:
        console.log(`🔧 Maintenance orchestrator received: ${message.type} from ${message.source}`);
    }
  }

  protected async executeOperation(operation: Operation): Promise<void> {
    switch (operation.type) {
      case 'maintenance':
        await this.performMaintenance(operation);
        break;

      case 'analysis':
        await this.performAnalysis(operation);
        break;

      case 'optimization':
        await this.performOptimization(operation);
        break;

      default:
        throw new Error(`Unsupported operation type: ${operation.type}`);
    }
  }

  private async handleMaintenanceRequest(message: UnifiedMessage): Promise<void> {
    const request = message.payload as MaintenanceRequest;

    console.log(`🔧 Received maintenance request: ${request.mode} mode from ${message.source}`);

    // Start coordinated maintenance operation
    const operationId = await this.requestOperation('maintenance',
      request.tasks.flatMap(t => t.dependencies || []).concat(['unified-dashboard']),
      {
        mode: request.mode,
        tasks: request.tasks,
        requestedBy: request.requestedBy,
        priority: request.priority
      }
    );

    // Respond with operation ID for tracking
    await this.sendMessage(message.source, 'response', {
      operationId,
      status: 'started',
      estimatedDuration: this.estimateMaintenanceDuration(request.tasks)
    }, message.priority);
  }

  private async handleSystemEvent(message: UnifiedMessage): Promise<void> {
    const event = message.payload as { type: string; data: unknown };

    switch (event.type) {
      case 'health:degraded':
        await this.onHealthDegradation(event.data);
        break;

      case 'component:failed':
        await this.onComponentFailure(event.data);
        break;

      case 'error:critical':
        await this.onCriticalError(event.data);
        break;
    }
  }

  private async handleMetricUpdate(message: UnifiedMessage): Promise<void> {
    const metrics = message.payload as { component: ComponentId; metrics: Record<string, number> };

    // Check if intervention is needed based on metrics
    if (metrics.metrics.errorRate > 0.1) { // 10% error rate threshold
      await this.requestOperation('maintenance', [metrics.component], {
        reason: 'High error rate detected',
        priority: 'P1',
        autoApprove: false
      });
    }
  }

  private async performMaintenance(operation: Operation): Promise<void> {
    const { mode, tasks } = operation.metadata;

    console.log(`🔧 Performing ${mode} maintenance with ${Array.isArray(tasks) ? tasks.length : 0} tasks`);

    const results = [];
    const startTime = performance.now();
    const taskArray = (Array.isArray(tasks) ? tasks : []) as MaintenanceTask[];

    for (const task of taskArray) {
      const taskResult = await this.executeMaintenanceTask(task);
      results.push(taskResult);

      // Report progress to interested components
      await this.sendMessage('broadcast', 'event', {
        type: 'maintenance:progress',
        taskCompleted: task.name,
        overallProgress: results.length / taskArray.length,
        currentResult: taskResult
      }, 'P2');
    }

    const duration = performance.now() - startTime;
    const successCount = results.filter(r => r.status === 'success').length;

    // Report final results
    await this.sendMessage(operation.initiator, 'response', {
      operationId: operation.id,
      status: 'completed',
      duration,
      results: {
        totalTasks: taskArray.length,
        successful: successCount,
        failed: taskArray.length - successCount,
        details: results
      }
    }, operation.metadata.priority as 'P0' | 'P1' | 'P2');

    // Update our metrics
    this.reportMetrics({
      maintenanceOperations: 1,
      tasksExecuted: taskArray.length,
      successRate: successCount / taskArray.length,
      maintenanceDuration: duration
    });
  }

  private async performAnalysis(operation: Operation): Promise<void> {
    console.log(`📊 Performing system analysis`);

    // Request data from other components
    await this.sendMessage('unified-dashboard', 'request', {
      type: 'status-report',
      detailed: true
    }, 'P1');

    // Simulate analysis work
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log(`📊 Analysis completed`);
  }

  private async performOptimization(operation: Operation): Promise<void> {
    console.log(`⚡ Performing system optimization`);

    // Request optimization from performance-sensitive components
    const optimizationTargets = ['component-registry', 'performance-cache', 'unified-dashboard'];

    for (const target of optimizationTargets) {
      await this.sendMessage(target as ComponentId, 'request', {
        type: 'optimize',
        priority: operation.metadata.priority
      }, 'P1');
    }

    console.log(`⚡ Optimization requests sent`);
  }

  private async executeMaintenanceTask(task: MaintenanceTask): Promise<{
    name: string;
    status: 'success' | 'failed' | 'skipped';
    duration: number;
    output?: string;
    error?: string;
  }> {
    const startTime = performance.now();

    try {
      // Check safety constraints
      const safetyCheck = await safeGuard.canExecuteAutomation(task.command);
      if (!safetyCheck.allowed) {
        return {
          name: task.name,
          status: 'skipped',
          duration: performance.now() - startTime,
          error: safetyCheck.reason
        };
      }

      // Get approval for high-risk tasks
      const riskLevel = this.assessTaskRisk(task);
      if (!task.autoRun || riskLevel === 'high') {
        const approved = await this.requestApproval(task, riskLevel);
        if (!approved) {
          return {
            name: task.name,
            status: 'skipped',
            duration: performance.now() - startTime,
            error: 'User approval denied'
          };
        }
      }

      // Execute the task
      console.log(`  ⚙️ Executing: ${task.name}`);
      const output = execSync(task.command, {
        encoding: 'utf8',
        timeout: 300000, // 5 minutes max
        stdio: 'pipe'
      });

      await safeGuard.recordAttempt(task.command, true, performance.now() - startTime);

      return {
        name: task.name,
        status: 'success',
        duration: performance.now() - startTime,
        output: output.trim()
      };

    } catch (error) {
      const duration = performance.now() - startTime;
      await safeGuard.recordAttempt(task.command, false, duration,
        error instanceof Error ? error.message : String(error));

      return {
        name: task.name,
        status: 'failed',
        duration,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private assessTaskRisk(task: MaintenanceTask): 'low' | 'medium' | 'high' {
    if (task.command.includes('lint:fix') || task.command.includes('system:evolve')) {
      return 'high';
    }
    if (task.command.includes('audit') || task.command.includes('typecheck')) {
      return 'medium';
    }
    return 'low';
  }

  private async requestApproval(task: MaintenanceTask, riskLevel: string): Promise<boolean> {
    // In integrated mode, broadcast approval request so UI components can handle it
    await this.sendMessage('broadcast', 'event', {
      type: 'approval:request',
      task: task.name,
      command: task.command,
      riskLevel,
      component: 'maintenance-orchestrator'
    }, 'P1');

    // For now, use the existing approval system
    // In future, this could be handled by a dedicated approval UI component
    const result = await approvalSystem.requestApproval({
      title: task.name,
      description: task.description,
      command: task.command,
      riskLevel: riskLevel as 'low' | 'medium' | 'high',
      impact: this.getTaskImpact(task)
    });

    return result.approved;
  }

  private getTaskImpact(task: MaintenanceTask): string {
    switch (task.priority) {
      case 'critical': return 'System-wide impact, may affect stability';
      case 'high': return 'Significant impact on code quality or security';
      case 'medium': return 'Moderate impact on development workflow';
      case 'low': return 'Minor cleanup or optimization';
      default: return 'Impact assessment needed';
    }
  }

  private estimateMaintenanceDuration(tasks: MaintenanceTask[]): number {
    // Simple estimation based on task complexity
    return tasks.reduce((total, task) => {
      const baseTime = task.command.includes('typecheck') ? 30 :
                      task.command.includes('audit') ? 45 :
                      task.command.includes('lint') ? 15 : 10;
      return total + baseTime;
    }, 0);
  }

  private async onHealthDegradation(data: unknown): Promise<void> {
    console.log('🚨 System health degradation detected - initiating maintenance');

    await this.requestOperation('maintenance', ['unified-dashboard'], {
      reason: 'Health degradation detected',
      priority: 'P1',
      autoApprove: true,
      tasks: this.availableTasks.filter(t => t.priority === 'high')
    });
  }

  private async onComponentFailure(data: unknown): Promise<void> {
    console.log('🆘 Component failure detected - emergency maintenance');

    await this.requestOperation('maintenance', [], {
      reason: 'Component failure recovery',
      priority: 'P0',
      autoApprove: true,
      tasks: this.availableTasks.filter(t => t.priority === 'critical')
    });
  }

  private async onCriticalError(data: unknown): Promise<void> {
    console.log('💥 Critical error detected - full system maintenance');

    await this.requestOperation('maintenance', ['unified-dashboard', 'component-registry'], {
      reason: 'Critical error recovery',
      priority: 'P0',
      autoApprove: false, // Critical errors need human oversight
      tasks: this.availableTasks
    });
  }

  /**
   * Public API for external maintenance requests
   */
  async performQuickMaintenance(): Promise<string> {
    return await this.requestOperation('maintenance', [], {
      mode: 'quick',
      tasks: this.availableTasks.filter(t => t.autoRun && t.priority !== 'critical'),
      requestedBy: 'maintenance-orchestrator',
      priority: 'P2'
    });
  }

  async performFullMaintenance(): Promise<string> {
    return await this.requestOperation('maintenance', ['unified-dashboard', 'component-registry'], {
      mode: 'full',
      tasks: this.availableTasks,
      requestedBy: 'maintenance-orchestrator',
      priority: 'P1'
    });
  }
}

// Create and export the integrated instance
export const integratedMaintenanceOrchestrator = new IntegratedMaintenanceOrchestrator();
export default IntegratedMaintenanceOrchestrator;