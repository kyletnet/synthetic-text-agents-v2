#!/usr/bin/env tsx

/**
 * Core System Hub
 * Central coordinator implementing Core-Hub-Satellite architecture
 * Unifies all scattered system components under a single communication protocol
 */

import { EventEmitter } from "events";
import { join } from "path";

export type ComponentId =
  | 'maintenance-orchestrator'
  | 'unified-dashboard'
  | 'unified-reporter'
  | 'ai-fix-engine'
  | 'design-principle-engine'
  | 'user-communication'
  | 'workflow-prevention'
  | 'auto-integration-guard'
  | 'component-registry'
  | 'architectural-evolution'
  | 'performance-cache'
  | 'approval-system'
  | 'safe-automation-guard';

export type MessageType = 'request' | 'response' | 'event' | 'metric';
export type Priority = 'P0' | 'P1' | 'P2';

export interface UnifiedMessage {
  source: ComponentId;
  target: ComponentId | 'broadcast';
  type: MessageType;
  priority: Priority;
  payload: unknown;
  correlation: string;
  timestamp: Date;
  routingMode?: 'direct' | 'hub' | 'fallback';
}

export interface MessageQueue {
  direct: ComponentMessage[];      // Direct communication (fast)
  hub: HubMediatedMessage[];       // Hub-mediated (coordination needed)
  fallback: EmergencyMessage[];    // Hub failure fallback
}

export interface ComponentMessage {
  id: string;
  message: UnifiedMessage;
  retryCount: number;
  maxRetries: number;
}

export interface HubMediatedMessage extends ComponentMessage {
  coordinationNeeded: boolean;
  mediationReason: string;
}

export interface EmergencyMessage extends ComponentMessage {
  emergencyLevel: 'low' | 'medium' | 'high' | 'critical';
  bypassReason: string;
}

export interface SystemState {
  health: number; // 0-100
  components: Map<ComponentId, ComponentStatus>;
  activeOperations: Map<string, Operation>;
  metrics: SystemMetrics;
}

export interface ComponentStatus {
  id: ComponentId;
  status: 'healthy' | 'degraded' | 'failed' | 'maintenance';
  lastHeartbeat: Date;
  version: string;
  capabilities: string[];
  dependencies: ComponentId[];
}

export interface Operation {
  id: string;
  type: 'maintenance' | 'analysis' | 'optimization' | 'evolution';
  initiator: ComponentId;
  participants: ComponentId[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime: Date;
  metadata: Record<string, unknown>;
}

export interface SystemMetrics {
  operationsPerHour: number;
  averageOperationTime: number;
  errorRate: number;
  componentUtilization: Map<ComponentId, number>;
  memoryUsage: number;
  listenerCount: number;
}

/**
 * Hub Failover Manager - Handles hub failure scenarios and direct mode
 */
class HubFailoverManager {
  private hubHealthy = true;
  private directModeActive = false;
  private lastHubHeartbeat = new Date();
  private directConnections = new Map<ComponentId, Set<ComponentId>>();
  private emergencyQueue: EmergencyMessage[] = [];

  constructor() {
    this.startHubMonitoring();
  }

  detectHubFailure(): boolean {
    const timeSinceLastHeartbeat = Date.now() - this.lastHubHeartbeat.getTime();
    const hubFailed = timeSinceLastHeartbeat > 15000; // 15 seconds threshold

    if (hubFailed && this.hubHealthy) {
      console.log('🚨 Hub failure detected - activating direct mode');
      this.hubHealthy = false;
      this.activateDirectMode();
    } else if (!hubFailed && !this.hubHealthy) {
      console.log('✅ Hub recovered - restoring hub mode');
      this.hubHealthy = true;
      this.restoreHubMode();
    }

    return hubFailed;
  }

  activateDirectMode(): void {
    this.directModeActive = true;
    console.log('🔄 Direct communication mode activated');

    // Process emergency queue in direct mode
    this.processEmergencyQueue();
  }

  restoreHubMode(): void {
    this.directModeActive = false;
    console.log('🔄 Hub-mediated mode restored');

    // Flush any remaining direct connections back to hub
    this.directConnections.clear();
  }

  canUseDirectConnection(source: ComponentId, target: ComponentId): boolean {
    if (!this.directModeActive) return false;

    const connections = this.directConnections.get(source);
    return connections?.has(target) || false;
  }

  establishDirectConnection(source: ComponentId, target: ComponentId): void {
    if (!this.directConnections.has(source)) {
      this.directConnections.set(source, new Set());
    }
    this.directConnections.get(source)!.add(target);
    console.log(`🔗 Direct connection established: ${source} → ${target}`);
  }

  queueEmergencyMessage(message: EmergencyMessage): void {
    this.emergencyQueue.push(message);

    // Process immediately if in direct mode
    if (this.directModeActive) {
      this.processEmergencyQueue();
    }
  }

  updateHubHeartbeat(): void {
    this.lastHubHeartbeat = new Date();
  }

  getFailoverStatus(): {
    hubHealthy: boolean;
    directModeActive: boolean;
    directConnections: number;
    emergencyQueueSize: number;
  } {
    return {
      hubHealthy: this.hubHealthy,
      directModeActive: this.directModeActive,
      directConnections: Array.from(this.directConnections.values())
        .reduce((total, connections) => total + connections.size, 0),
      emergencyQueueSize: this.emergencyQueue.length
    };
  }

  private startHubMonitoring(): void {
    setInterval(() => {
      this.detectHubFailure();
    }, 5000); // Check every 5 seconds
  }

  private processEmergencyQueue(): void {
    while (this.emergencyQueue.length > 0) {
      const emergency = this.emergencyQueue.shift()!;
      console.log(`🚨 Processing emergency message: ${emergency.message.source} → ${emergency.message.target}`);

      // Attempt direct delivery
      this.establishDirectConnection(emergency.message.source, emergency.message.target);
    }
  }
}

/**
 * Core Decision Engine - Central intelligence for system orchestration
 */
class CoreDecisionEngine {
  private systemState: SystemState;
  private decisionHistory: Array<{
    timestamp: Date;
    decision: string;
    reasoning: string;
    outcome?: string;
  }> = [];

  constructor(initialState: SystemState) {
    this.systemState = initialState;
  }

  /**
   * Decide optimal execution strategy based on system state
   */
  async decideExecutionStrategy(operation: Operation): Promise<{
    strategy: 'immediate' | 'queued' | 'delegated' | 'distributed';
    participants: ComponentId[];
    priority: Priority;
    reasoning: string;
  }> {
    const healthyComponents = Array.from(this.systemState.components.entries())
      .filter(([_, status]) => status.status === 'healthy')
      .map(([id, _]) => id);

    // P0 operations run immediately regardless of load
    if (operation.metadata.priority === 'P0') {
      return {
        strategy: 'immediate',
        participants: operation.participants.filter(p => healthyComponents.includes(p)),
        priority: 'P0',
        reasoning: 'Critical priority requires immediate execution'
      };
    }

    // High load - queue non-critical operations
    if (this.systemState.metrics.operationsPerHour > 50) {
      return {
        strategy: 'queued',
        participants: operation.participants,
        priority: 'P2',
        reasoning: 'High system load - queueing for later execution'
      };
    }

    // Distribute across healthy components for efficiency
    return {
      strategy: 'distributed',
      participants: healthyComponents.slice(0, Math.min(3, healthyComponents.length)),
      priority: 'P1',
      reasoning: 'Normal load - distributing across available components'
    };
  }

  /**
   * Resolve conflicts between competing operations
   */
  resolveOperationConflicts(operations: Operation[]): Operation[] {
    // Sort by priority and start time
    return operations.sort((a, b) => {
      const priorityWeight = { P0: 3, P1: 2, P2: 1 };
      const aPriority = priorityWeight[a.metadata.priority as Priority] || 1;
      const bPriority = priorityWeight[b.metadata.priority as Priority] || 1;

      if (aPriority !== bPriority) return bPriority - aPriority;
      return a.startTime.getTime() - b.startTime.getTime();
    });
  }

  recordDecision(decision: string, reasoning: string): void {
    this.decisionHistory.push({
      timestamp: new Date(),
      decision,
      reasoning
    });

    // Keep only last 100 decisions to prevent memory bloat
    if (this.decisionHistory.length > 100) {
      this.decisionHistory = this.decisionHistory.slice(-100);
    }
  }
}

/**
 * Core System Hub - Central coordination point for all system components
 */
export class CoreSystemHub extends EventEmitter {
  private decisionEngine: CoreDecisionEngine;
  private failoverManager: HubFailoverManager;
  private messageQueue: MessageQueue = {
    direct: [],
    hub: [],
    fallback: []
  };
  private priorityQueues: Map<Priority, UnifiedMessage[]> = new Map([
    ['P0', []],
    ['P1', []],
    ['P2', []]
  ]);
  private systemState: SystemState;
  private registeredComponents: Map<ComponentId, ComponentStatus> = new Map();
  private operationQueue: Operation[] = [];
  private routingMetrics: {
    totalMessages: number;
    routingModeCount: { direct: number; hub: number; fallback: number };
    routingHistory: Array<{
      timestamp: Date;
      mode: 'direct' | 'hub' | 'fallback';
      reason: string;
      latency: number;
    }>;
    performanceBaseline: { hubLatency: number; directLatency: number };
  };

  constructor() {
    super();
    this.setMaxListeners(100); // Support many components

    this.systemState = {
      health: 100,
      components: new Map(),
      activeOperations: new Map(),
      metrics: {
        operationsPerHour: 0,
        averageOperationTime: 0,
        errorRate: 0,
        componentUtilization: new Map(),
        memoryUsage: 0,
        listenerCount: 0
      }
    };

    this.decisionEngine = new CoreDecisionEngine(this.systemState);
    this.failoverManager = new HubFailoverManager();

    // Initialize routing metrics
    this.routingMetrics = {
      totalMessages: 0,
      routingModeCount: { direct: 0, hub: 0, fallback: 0 },
      routingHistory: [],
      performanceBaseline: { hubLatency: 100, directLatency: 40 }
    };

    this.startHealthMonitoring();
    this.startRoutingMetricsCollection();
  }

  /**
   * Register a component with the hub
   */
  registerComponent(status: ComponentStatus): void {
    console.log(`🔌 Registering component: ${status.id}`);
    this.registeredComponents.set(status.id, status);
    this.systemState.components.set(status.id, status);
    this.emit('component:registered', status);
  }

  /**
   * Send message through the unified communication protocol with intelligent routing
   */
  async sendMessage(message: UnifiedMessage): Promise<void> {
    const startTime = performance.now();

    // Update hub heartbeat
    this.failoverManager.updateHubHeartbeat();

    // Determine routing mode
    const routingMode = this.determineRoutingMode(message);
    message.routingMode = routingMode;

    // Record routing metrics
    this.routingMetrics.totalMessages++;
    this.routingMetrics.routingModeCount[routingMode]++;

    // Route message based on mode
    switch (routingMode) {
      case 'direct':
        await this.routeDirectMessage(message);
        break;
      case 'hub':
        await this.routeHubMessage(message);
        break;
      case 'fallback':
        await this.routeFallbackMessage(message);
        break;
    }

    const endTime = performance.now();
    const latency = endTime - startTime;

    // Record routing history
    this.recordRoutingHistory(routingMode, this.getRoutingReason(routingMode), latency);

    this.emit('message:routed', { message, routingMode, latency });
  }

  /**
   * Determine the optimal routing mode for a message
   */
  private determineRoutingMode(message: UnifiedMessage): 'direct' | 'hub' | 'fallback' {
    const failoverStatus = this.failoverManager.getFailoverStatus();

    // Critical messages use fallback if hub is down
    if (message.priority === 'P0' && !failoverStatus.hubHealthy) {
      return 'fallback';
    }

    // Use direct routing if available and hub load is high
    if (message.target !== 'broadcast' &&
        this.failoverManager.canUseDirectConnection(message.source, message.target as ComponentId) &&
        this.systemState.metrics.operationsPerHour > 40) {
      return 'direct';
    }

    // Hub failure - use fallback for all
    if (!failoverStatus.hubHealthy) {
      return 'fallback';
    }

    // Default to hub-mediated
    return 'hub';
  }

  /**
   * Route message directly between components
   */
  private async routeDirectMessage(message: UnifiedMessage): Promise<void> {
    const componentMessage: ComponentMessage = {
      id: `direct_${message.correlation}`,
      message,
      retryCount: 0,
      maxRetries: 2
    };

    this.messageQueue.direct.push(componentMessage);
    await this.processDirectQueue();
  }

  /**
   * Route message through hub with coordination
   */
  private async routeHubMessage(message: UnifiedMessage): Promise<void> {
    const hubMessage: HubMediatedMessage = {
      id: `hub_${message.correlation}`,
      message,
      retryCount: 0,
      maxRetries: 3,
      coordinationNeeded: message.target === 'broadcast' || message.type === 'request',
      mediationReason: message.target === 'broadcast' ? 'broadcast_coordination' : 'request_mediation'
    };

    this.messageQueue.hub.push(hubMessage);

    // Also add to priority queue for legacy processing
    const queue = this.priorityQueues.get(message.priority) || [];
    queue.push(message);
    this.priorityQueues.set(message.priority, queue);

    await this.processHubQueue();
  }

  /**
   * Route message via fallback mechanisms
   */
  private async routeFallbackMessage(message: UnifiedMessage): Promise<void> {
    const emergencyMessage: EmergencyMessage = {
      id: `emergency_${message.correlation}`,
      message,
      retryCount: 0,
      maxRetries: 5,
      emergencyLevel: message.priority === 'P0' ? 'critical' :
                     message.priority === 'P1' ? 'high' : 'medium',
      bypassReason: 'hub_failure_bypass'
    };

    this.messageQueue.fallback.push(emergencyMessage);
    this.failoverManager.queueEmergencyMessage(emergencyMessage);
    await this.processFallbackQueue();
  }

  /**
   * Start a coordinated operation across multiple components
   */
  async startOperation(operation: Operation): Promise<string> {
    const strategy = await this.decisionEngine.decideExecutionStrategy(operation);

    operation.participants = strategy.participants;
    operation.metadata.strategy = strategy.strategy;
    operation.metadata.reasoning = strategy.reasoning;

    this.operationQueue.push(operation);
    this.systemState.activeOperations.set(operation.id, operation);

    console.log(`🚀 Starting operation: ${operation.type} with ${strategy.strategy} strategy`);
    console.log(`   📋 Participants: ${strategy.participants.join(', ')}`);
    console.log(`   🤔 Reasoning: ${strategy.reasoning}`);

    this.emit('operation:started', operation);

    // Execute based on strategy
    switch (strategy.strategy) {
      case 'immediate':
        await this.executeImmediate(operation);
        break;
      case 'distributed':
        await this.executeDistributed(operation);
        break;
      case 'queued':
        this.emit('operation:queued', operation);
        break;
      case 'delegated':
        await this.executeDelegated(operation);
        break;
    }

    return operation.id;
  }

  /**
   * Get system health and status overview
   */
  getSystemStatus(): {
    health: number;
    componentsHealthy: number;
    componentsTotal: number;
    activeOperations: number;
    queuedMessages: number;
    memoryUsage: number;
    failover: {
      hubHealthy: boolean;
      directModeActive: boolean;
      directConnections: number;
      emergencyQueueSize: number;
    };
    messageQueues: {
      direct: number;
      hub: number;
      fallback: number;
      priority: number;
    };
  } {
    const healthy = Array.from(this.systemState.components.values())
      .filter(c => c.status === 'healthy').length;

    const legacyQueuedMessages = Array.from(this.priorityQueues.values())
      .reduce((total, queue) => total + queue.length, 0);

    const failoverStatus = this.failoverManager.getFailoverStatus();

    return {
      health: this.systemState.health,
      componentsHealthy: healthy,
      componentsTotal: this.systemState.components.size,
      activeOperations: this.systemState.activeOperations.size,
      queuedMessages: legacyQueuedMessages,
      memoryUsage: this.systemState.metrics.memoryUsage,
      failover: failoverStatus,
      messageQueues: {
        direct: this.messageQueue.direct.length,
        hub: this.messageQueue.hub.length,
        fallback: this.messageQueue.fallback.length,
        priority: legacyQueuedMessages
      }
    };
  }

  /**
   * Process direct message queue - fastest route
   */
  private async processDirectQueue(): Promise<void> {
    while (this.messageQueue.direct.length > 0) {
      const componentMessage = this.messageQueue.direct.shift()!;

      try {
        await this.deliverDirectMessage(componentMessage);
      } catch (error) {
        componentMessage.retryCount++;
        if (componentMessage.retryCount < componentMessage.maxRetries) {
          this.messageQueue.direct.push(componentMessage); // Retry
        } else {
          console.error(`❌ Direct message failed after ${componentMessage.maxRetries} attempts:`, error);
          // Fallback to hub routing
          await this.routeHubMessage(componentMessage.message);
        }
      }
    }
  }

  /**
   * Process hub-mediated message queue
   */
  private async processHubQueue(): Promise<void> {
    while (this.messageQueue.hub.length > 0) {
      const hubMessage = this.messageQueue.hub.shift()!;

      try {
        await this.deliverHubMessage(hubMessage);
      } catch (error) {
        hubMessage.retryCount++;
        if (hubMessage.retryCount < hubMessage.maxRetries) {
          this.messageQueue.hub.push(hubMessage); // Retry
        } else {
          console.error(`❌ Hub message failed after ${hubMessage.maxRetries} attempts:`, error);
        }
      }
    }
  }

  /**
   * Process fallback emergency queue
   */
  private async processFallbackQueue(): Promise<void> {
    while (this.messageQueue.fallback.length > 0) {
      const emergencyMessage = this.messageQueue.fallback.shift()!;

      try {
        await this.deliverEmergencyMessage(emergencyMessage);
      } catch (error) {
        emergencyMessage.retryCount++;
        if (emergencyMessage.retryCount < emergencyMessage.maxRetries) {
          this.messageQueue.fallback.push(emergencyMessage); // Retry
        } else {
          console.error(`❌ Emergency message failed after ${emergencyMessage.maxRetries} attempts:`, error);
        }
      }
    }
  }

  /**
   * Legacy message queue processing for backward compatibility
   */
  private async processMessageQueue(): Promise<void> {
    // Process in priority order: P0 -> P1 -> P2
    for (const priority of ['P0', 'P1', 'P2'] as Priority[]) {
      const queue = this.priorityQueues.get(priority) || [];

      while (queue.length > 0) {
        const message = queue.shift()!;
        await this.deliverMessage(message);
      }
    }
  }

  /**
   * Deliver direct message between components
   */
  private async deliverDirectMessage(componentMessage: ComponentMessage): Promise<void> {
    const { message } = componentMessage;

    console.log(`⚡ Direct: ${message.source} → ${message.target} (${message.type})`);

    if (message.target === 'broadcast') {
      this.emit('message:broadcast:direct', message);
    } else {
      this.emit(`message:${message.target}:direct`, message);
      // Establish direct connection for future messages
      this.failoverManager.establishDirectConnection(message.source, message.target as ComponentId);
    }
  }

  /**
   * Deliver hub-mediated message with coordination
   */
  private async deliverHubMessage(hubMessage: HubMediatedMessage): Promise<void> {
    const { message } = hubMessage;

    console.log(`🔄 Hub-mediated: ${message.source} → ${message.target} (${message.type}) - ${hubMessage.mediationReason}`);

    if (hubMessage.coordinationNeeded) {
      // Add coordination metadata
      message.payload = {
        ...message.payload as object,
        _coordination: {
          mediatedBy: 'hub',
          reason: hubMessage.mediationReason,
          timestamp: new Date()
        }
      };
    }

    // Use legacy delivery for hub messages
    await this.deliverMessage(message);
  }

  /**
   * Deliver emergency message via fallback
   */
  private async deliverEmergencyMessage(emergencyMessage: EmergencyMessage): Promise<void> {
    const { message } = emergencyMessage;

    console.log(`🚨 Emergency (${emergencyMessage.emergencyLevel}): ${message.source} → ${message.target} - ${emergencyMessage.bypassReason}`);

    // Add emergency metadata
    message.payload = {
      ...message.payload as object,
      _emergency: {
        level: emergencyMessage.emergencyLevel,
        reason: emergencyMessage.bypassReason,
        retryCount: emergencyMessage.retryCount,
        timestamp: new Date()
      }
    };

    if (message.target === 'broadcast') {
      this.emit('message:broadcast:emergency', message);
    } else {
      this.emit(`message:${message.target}:emergency`, message);
      // Force direct connection for emergency
      this.failoverManager.establishDirectConnection(message.source, message.target as ComponentId);
    }
  }

  /**
   * Legacy message delivery for backward compatibility
   */
  private async deliverMessage(message: UnifiedMessage): Promise<void> {
    if (message.target === 'broadcast') {
      this.emit('message:broadcast', message);
      console.log(`📢 Broadcasting ${message.type} from ${message.source}`);
    } else {
      this.emit(`message:${message.target}`, message);
      console.log(`📤 Message: ${message.source} → ${message.target} (${message.type})`);
    }
  }

  private async executeImmediate(operation: Operation): Promise<void> {
    operation.status = 'running';
    for (const participant of operation.participants) {
      this.emit(`operation:execute:${participant}`, operation);
    }
  }

  private async executeDistributed(operation: Operation): Promise<void> {
    operation.status = 'running';
    // Split work across participants
    const workChunks = this.splitWorkload(operation);

    for (let i = 0; i < operation.participants.length; i++) {
      const participant = operation.participants[i];
      const chunk = workChunks[i];

      this.emit(`operation:execute:${participant}`, {
        ...operation,
        metadata: { ...operation.metadata, workChunk: chunk }
      });
    }
  }

  private async executeDelegated(operation: Operation): Promise<void> {
    // Find best component for the job based on capabilities
    const bestComponent = operation.participants.find(p => {
      const component = this.systemState.components.get(p);
      return component?.capabilities.includes(operation.type);
    }) || operation.participants[0];

    operation.status = 'running';
    this.emit(`operation:execute:${bestComponent}`, operation);
  }

  private splitWorkload(operation: Operation): unknown[] {
    // Simple workload splitting - can be enhanced based on operation type
    const participantCount = operation.participants.length;
    return Array(participantCount).fill(operation.metadata).map((metadata, index) => ({
      ...metadata,
      partition: index + 1,
      totalPartitions: participantCount
    }));
  }

  private startHealthMonitoring(): void {
    setInterval(() => {
      this.updateSystemHealth();
    }, 30000); // Every 30 seconds
  }

  private updateSystemHealth(): void {
    const now = new Date();
    let totalHealth = 0;
    let healthyCount = 0;

    for (const [componentId, status] of this.systemState.components.entries()) {
      const timeSinceHeartbeat = now.getTime() - status.lastHeartbeat.getTime();

      if (timeSinceHeartbeat > 120000) { // 2 minutes
        status.status = 'failed';
      } else if (timeSinceHeartbeat > 60000) { // 1 minute
        status.status = 'degraded';
      } else {
        status.status = 'healthy';
        healthyCount++;
      }

      totalHealth += status.status === 'healthy' ? 100 :
                     status.status === 'degraded' ? 50 : 0;
    }

    this.systemState.health = this.systemState.components.size > 0
      ? Math.round(totalHealth / this.systemState.components.size)
      : 100;

    // Update memory metrics
    this.systemState.metrics.memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024; // MB
    this.systemState.metrics.listenerCount = this.listenerCount('message:broadcast');

    this.emit('health:updated', this.systemState.health);
  }

  /**
   * Get detailed routing status and metrics
   */
  getRoutingStatus(): {
    currentMode: 'direct' | 'hub' | 'fallback';
    failover: {
      hubHealthy: boolean;
      directModeActive: boolean;
      directConnections: number;
      emergencyQueueSize: number;
    };
    metrics: {
      totalMessages: number;
      modeDistribution: { direct: number; hub: number; fallback: number };
      modePercentages: { direct: string; hub: string; fallback: string };
      recentLatency: number;
      averageLatency: { direct: number; hub: number; fallback: number };
    };
    performance: {
      hubLatency: number;
      directLatency: number;
      performanceImprovement: string;
      recommendedMode: 'direct' | 'hub' | 'fallback';
    };
    recentActivity: Array<{
      timestamp: string;
      mode: string;
      reason: string;
      latency: number;
    }>;
  } {
    const failoverStatus = this.failoverManager.getFailoverStatus();
    const total = this.routingMetrics.totalMessages || 1; // Avoid division by zero

    // Calculate current mode based on recent activity
    const recentHistory = this.routingMetrics.routingHistory.slice(-10);
    const currentMode = recentHistory.length > 0
      ? recentHistory[recentHistory.length - 1].mode
      : 'hub';

    // Calculate average latencies by mode
    const latencyByMode = { direct: [], hub: [], fallback: [] } as any;
    this.routingMetrics.routingHistory.forEach(entry => {
      latencyByMode[entry.mode].push(entry.latency);
    });

    const avgLatency = {
      direct: latencyByMode.direct.length > 0
        ? latencyByMode.direct.reduce((a: number, b: number) => a + b, 0) / latencyByMode.direct.length
        : this.routingMetrics.performanceBaseline.directLatency,
      hub: latencyByMode.hub.length > 0
        ? latencyByMode.hub.reduce((a: number, b: number) => a + b, 0) / latencyByMode.hub.length
        : this.routingMetrics.performanceBaseline.hubLatency,
      fallback: latencyByMode.fallback.length > 0
        ? latencyByMode.fallback.reduce((a: number, b: number) => a + b, 0) / latencyByMode.fallback.length
        : this.routingMetrics.performanceBaseline.hubLatency * 1.2
    };

    // Calculate performance improvement
    const hubLatency = avgLatency.hub;
    const directLatency = avgLatency.direct;
    const improvementPercent = hubLatency > 0
      ? ((hubLatency - directLatency) / hubLatency * 100).toFixed(1)
      : '0.0';

    return {
      currentMode,
      failover: failoverStatus,
      metrics: {
        totalMessages: this.routingMetrics.totalMessages,
        modeDistribution: this.routingMetrics.routingModeCount,
        modePercentages: {
          direct: ((this.routingMetrics.routingModeCount.direct / total) * 100).toFixed(1) + '%',
          hub: ((this.routingMetrics.routingModeCount.hub / total) * 100).toFixed(1) + '%',
          fallback: ((this.routingMetrics.routingModeCount.fallback / total) * 100).toFixed(1) + '%'
        },
        recentLatency: recentHistory.length > 0 ? recentHistory[recentHistory.length - 1].latency : 0,
        averageLatency: avgLatency
      },
      performance: {
        hubLatency: avgLatency.hub,
        directLatency: avgLatency.direct,
        performanceImprovement: `${improvementPercent}% faster with direct routing`,
        recommendedMode: this.recommendOptimalMode()
      },
      recentActivity: recentHistory.slice(-5).map(entry => ({
        timestamp: entry.timestamp.toISOString(),
        mode: entry.mode,
        reason: entry.reason,
        latency: Math.round(entry.latency * 100) / 100
      }))
    };
  }

  /**
   * Get performance comparison report
   */
  getPerformanceReport(): {
    latencyReduction: string;
    throughputImprovement: string;
    failoverCount: number;
    avgRecoveryTime: number;
    recommendation: string;
  } {
    const status = this.getRoutingStatus();
    const hubLatency = status.performance.hubLatency;
    const directLatency = status.performance.directLatency;

    const latencyReduction = hubLatency > directLatency
      ? `${((hubLatency - directLatency) / hubLatency * 100).toFixed(1)}%`
      : '0%';

    const failoverEvents = this.routingMetrics.routingHistory
      .filter(entry => entry.mode === 'fallback').length;

    return {
      latencyReduction,
      throughputImprovement: `${(this.routingMetrics.routingModeCount.direct / this.routingMetrics.totalMessages * 100).toFixed(1)}% direct routing`,
      failoverCount: failoverEvents,
      avgRecoveryTime: 18.4, // Placeholder - would calculate from actual failover recovery times
      recommendation: this.generatePerformanceRecommendation()
    };
  }

  /**
   * Export routing metrics to JSON file
   */
  async exportRoutingMetrics(): Promise<void> {
    const metrics = {
      timestamp: new Date().toISOString(),
      status: this.getRoutingStatus(),
      performance: this.getPerformanceReport(),
      fullHistory: this.routingMetrics.routingHistory.slice(-100) // Last 100 entries
    };

    try {
      const filePath = join(process.cwd(), 'reports', 'hub-routing-metrics.json');
      await import('fs').then(fs =>
        fs.writeFileSync(filePath, JSON.stringify(metrics, null, 2))
      );
      console.log(`📊 Routing metrics exported to: ${filePath}`);
    } catch (error) {
      console.error('❌ Failed to export routing metrics:', error);
    }
  }

  private recordRoutingHistory(mode: 'direct' | 'hub' | 'fallback', reason: string, latency: number): void {
    this.routingMetrics.routingHistory.push({
      timestamp: new Date(),
      mode,
      reason,
      latency
    });

    // Keep only last 500 entries to prevent memory bloat
    if (this.routingMetrics.routingHistory.length > 500) {
      this.routingMetrics.routingHistory = this.routingMetrics.routingHistory.slice(-500);
    }
  }

  private getRoutingReason(mode: 'direct' | 'hub' | 'fallback'): string {
    const failoverStatus = this.failoverManager.getFailoverStatus();

    switch (mode) {
      case 'direct':
        return failoverStatus.directModeActive
          ? 'Hub failure - direct mode active'
          : 'High load - direct routing optimization';
      case 'fallback':
        return 'Hub failure detected - emergency routing';
      case 'hub':
      default:
        return 'Normal hub-mediated routing';
    }
  }

  private recommendOptimalMode(): 'direct' | 'hub' | 'fallback' {
    const systemLoad = this.systemState.metrics.operationsPerHour;
    const hubHealthy = this.failoverManager.getFailoverStatus().hubHealthy;

    if (!hubHealthy) return 'fallback';
    if (systemLoad > 50) return 'direct';
    return 'hub';
  }

  private generatePerformanceRecommendation(): string {
    const status = this.getRoutingStatus();
    const directPercent = parseFloat(status.metrics.modePercentages.direct);
    const hubHealthy = status.failover.hubHealthy;

    if (!hubHealthy) {
      return 'Hub failover active - investigate hub health issues';
    }

    if (directPercent > 50) {
      return 'High direct routing usage - system is automatically optimizing for performance';
    }

    if (directPercent < 20 && this.systemState.metrics.operationsPerHour > 30) {
      return 'Consider enabling more direct routing to improve performance';
    }

    return 'Routing performance is optimal for current load';
  }

  private startRoutingMetricsCollection(): void {
    // Export metrics every 5 minutes
    setInterval(() => {
      this.exportRoutingMetrics().catch(console.error);
    }, 5 * 60 * 1000);

    // Clean up old history every hour
    setInterval(() => {
      if (this.routingMetrics.routingHistory.length > 1000) {
        this.routingMetrics.routingHistory = this.routingMetrics.routingHistory.slice(-500);
        console.log('🧹 Cleaned up old routing history entries');
      }
    }, 60 * 60 * 1000);
  }
}

// Singleton instance for global coordination
export const coreSystemHub = new CoreSystemHub();
export default CoreSystemHub;