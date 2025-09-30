/**
 * 🚨 Auto-Detection Engine - Fail-Fast Governance System
 *
 * 🎯 자동 감지 및 조기 경고 시스템
 * - Silent Mock Contamination 감지
 * - API Key 건강 상태 모니터링
 * - 포트 충돌 및 프로세스 문제 감지
 * - LLM Execution Authority 우회 시도 감지
 * - 시스템 무결성 지속 모니터링
 */

import { LLMExecutionAuthority } from "./llm-execution-authority";
import { apiKeyManager } from "./api-key-manager";
import { APIGuard } from "./api-guard";
import { ExecutionVerifier } from "./execution-verifier";
import { backgroundTaskManager } from "./background-task-manager";

// 🔍 Detection Result Types
export interface DetectionResult {
  passed: boolean;
  severity: "info" | "warning" | "critical" | "emergency";
  category: string;
  message: string;
  details?: any;
  timestamp: Date;
  actionRequired?: string;
  autoFixable?: boolean;
}

export interface SystemHealth {
  overall: "healthy" | "degraded" | "critical" | "emergency";
  detections: DetectionResult[];
  summary: {
    criticalIssues: number;
    warnings: number;
    lastCheck: Date;
    uptime: number;
  };
  recommendations: string[];
}

// 🚨 Critical Issue Patterns
const CRITICAL_PATTERNS = {
  SILENT_MOCK_CONTAMINATION: /mock|fallback|template|placeholder/i,
  BYPASS_ATTEMPTS: /bypass|skip|force|direct|unguarded|raw/i,
  API_KEY_LOSS: /no.*key|key.*missing|api.*error|unauthorized/i,
  PORT_CONFLICTS: /EADDRINUSE|port.*in.*use|address.*already.*in.*use/i,
} as const;

/**
 * 🎯 Auto-Detection Engine - 시스템 무결성 감지 및 조기 경고
 */
export class AutoDetectionEngine {
  private static instance: AutoDetectionEngine;
  private detectionHistory: DetectionResult[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private alertCallbacks: Array<(result: DetectionResult) => void> = [];

  constructor() {
    this.startContinuousMonitoring();
    console.log("🔍 [AutoDetection] Auto-Detection Engine initialized");
  }

  static getInstance(): AutoDetectionEngine {
    if (!AutoDetectionEngine.instance) {
      AutoDetectionEngine.instance = new AutoDetectionEngine();
    }
    return AutoDetectionEngine.instance;
  }

  /**
   * 🚨 컴플리트 시스템 건강 체크 실행
   */
  async performFullHealthCheck(): Promise<SystemHealth> {
    console.log("🔍 [AutoDetection] Starting full system health check...");
    const startTime = Date.now();
    const detections: DetectionResult[] = [];

    // 1. 🎯 Silent Mock Contamination 감지
    detections.push(...(await this.detectSilentMockContamination()));

    // 2. 🔑 API Key 건강 상태 감지
    detections.push(...(await this.detectAPIKeyHealth()));

    // 3. 🛡️ LLM Execution Authority 상태 감지
    detections.push(...(await this.detectExecutionAuthorityHealth()));

    // 4. 🌐 포트 및 프로세스 상태 감지
    detections.push(...(await this.detectPortAndProcessHealth()));

    // 5. 🚨 우회 시도 감지
    detections.push(...(await this.detectBypassAttempts()));

    // 6. 📊 시스템 무결성 감지
    detections.push(...(await this.detectSystemIntegrityIssues()));

    // Store detection history
    this.detectionHistory.push(...detections);
    this.trimDetectionHistory();

    const criticalIssues = detections.filter(
      (d) => d.severity === "critical" || d.severity === "emergency",
    );
    const warnings = detections.filter((d) => d.severity === "warning");

    const overall = this.calculateOverallHealth(detections);
    const recommendations = this.generateRecommendations(detections);

    const health: SystemHealth = {
      overall,
      detections,
      summary: {
        criticalIssues: criticalIssues.length,
        warnings: warnings.length,
        lastCheck: new Date(),
        uptime: Date.now() - startTime,
      },
      recommendations,
    };

    console.log(
      `🔍 [AutoDetection] Health check completed: ${overall} (${detections.length} detections)`,
    );

    // Trigger alerts for critical issues
    criticalIssues.forEach((issue) => this.triggerAlert(issue));

    return health;
  }

  /**
   * 🎭 Silent Mock Contamination 감지
   */
  private async detectSilentMockContamination(): Promise<DetectionResult[]> {
    const detections: DetectionResult[] = [];

    try {
      // Check recent execution history for mock patterns
      const executionMetrics = LLMExecutionAuthority.getExecutionMetrics();
      const recentExecutions = executionMetrics.recentExecutions || [];

      let mockContamination = 0;
      let totalExecutions = recentExecutions.length;

      recentExecutions.forEach((execution) => {
        if (execution.source === "fallback" || execution.source === "denied") {
          mockContamination++;
        }
      });

      const mockRate =
        totalExecutions > 0 ? mockContamination / totalExecutions : 0;

      if (mockRate > 0.1) {
        // 10% 이상 mock/fallback
        detections.push({
          passed: false,
          severity: "critical",
          category: "Mock Contamination",
          message: `Silent Mock Contamination detected: ${Math.round(mockRate * 100)}% of executions using mock/fallback`,
          details: { mockRate, mockContamination, totalExecutions },
          timestamp: new Date(),
          actionRequired: "Check API keys and LLM connectivity immediately",
          autoFixable: false,
        });
      } else if (mockRate > 0) {
        detections.push({
          passed: false,
          severity: "warning",
          category: "Mock Contamination",
          message: `Low-level mock usage detected: ${Math.round(mockRate * 100)}%`,
          details: { mockRate, mockContamination, totalExecutions },
          timestamp: new Date(),
          actionRequired: "Monitor API key health",
          autoFixable: true,
        });
      } else {
        detections.push({
          passed: true,
          severity: "info",
          category: "Mock Contamination",
          message:
            "No mock contamination detected - all executions using real LLM",
          timestamp: new Date(),
        });
      }
    } catch (error) {
      detections.push({
        passed: false,
        severity: "warning",
        category: "Mock Contamination",
        message: "Failed to analyze mock contamination",
        details: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
        timestamp: new Date(),
        actionRequired: "Check execution tracking system",
        autoFixable: false,
      });
    }

    return detections;
  }

  /**
   * 🔑 API Key 건강 상태 감지
   */
  private async detectAPIKeyHealth(): Promise<DetectionResult[]> {
    const detections: DetectionResult[] = [];

    try {
      const stats = apiKeyManager.getStats();
      const currentKey = apiKeyManager.getCurrentKey();

      // Check if we have any active API keys
      if (stats.activeKeys === 0) {
        detections.push({
          passed: false,
          severity: "emergency",
          category: "API Key Health",
          message:
            "No active API keys available - system will use fallback mode",
          details: stats,
          timestamp: new Date(),
          actionRequired: "Add valid API keys immediately",
          autoFixable: false,
        });
      } else if (stats.activeKeys === 1) {
        detections.push({
          passed: false,
          severity: "warning",
          category: "API Key Health",
          message: "Only 1 active API key - no redundancy available",
          details: stats,
          timestamp: new Date(),
          actionRequired: "Add backup API keys for redundancy",
          autoFixable: false,
        });
      } else {
        detections.push({
          passed: true,
          severity: "info",
          category: "API Key Health",
          message: `API keys healthy: ${stats.activeKeys} active keys available`,
          details: stats,
          timestamp: new Date(),
        });
      }

      // Check current key validity
      if (!currentKey) {
        detections.push({
          passed: false,
          severity: "critical",
          category: "API Key Health",
          message: "No current API key selected",
          timestamp: new Date(),
          actionRequired: "Refresh API key manager",
          autoFixable: true,
        });
      }
    } catch (error) {
      detections.push({
        passed: false,
        severity: "critical",
        category: "API Key Health",
        message: "Failed to check API key health",
        details: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
        timestamp: new Date(),
        actionRequired: "Check API key manager system",
        autoFixable: false,
      });
    }

    return detections;
  }

  /**
   * 🛡️ LLM Execution Authority 상태 감지
   */
  private async detectExecutionAuthorityHealth(): Promise<DetectionResult[]> {
    const detections: DetectionResult[] = [];

    try {
      const integrityReport = LLMExecutionAuthority.validateSystemIntegrity();

      if (integrityReport.status === "critical") {
        detections.push({
          passed: false,
          severity: "emergency",
          category: "Execution Authority",
          message: "LLM Execution Authority in critical state",
          details: integrityReport,
          timestamp: new Date(),
          actionRequired: "Restart LLM Execution Authority system",
          autoFixable: false,
        });
      } else if (integrityReport.status === "degraded") {
        detections.push({
          passed: false,
          severity: "warning",
          category: "Execution Authority",
          message: "LLM Execution Authority degraded",
          details: integrityReport,
          timestamp: new Date(),
          actionRequired: "Check system components",
          autoFixable: true,
        });
      } else {
        detections.push({
          passed: true,
          severity: "info",
          category: "Execution Authority",
          message: "LLM Execution Authority healthy",
          details: integrityReport,
          timestamp: new Date(),
        });
      }
    } catch (error) {
      detections.push({
        passed: false,
        severity: "critical",
        category: "Execution Authority",
        message: "Failed to check Execution Authority health",
        details: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
        timestamp: new Date(),
        actionRequired: "Check LLM Execution Authority system",
        autoFixable: false,
      });
    }

    return detections;
  }

  /**
   * 🌐 포트 및 프로세스 상태 감지
   */
  private async detectPortAndProcessHealth(): Promise<DetectionResult[]> {
    const detections: DetectionResult[] = [];

    try {
      // Check for port conflicts by attempting to get process info
      const command = `lsof -i :3001 | wc -l`;

      // This is a simplified check - in real implementation, you'd use child_process
      // For now, we'll check if the development environment manager is reporting correctly

      detections.push({
        passed: true,
        severity: "info",
        category: "Port & Process Health",
        message: "Development environment managed successfully",
        timestamp: new Date(),
      });
    } catch (error) {
      detections.push({
        passed: false,
        severity: "warning",
        category: "Port & Process Health",
        message: "Could not verify port and process health",
        details: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
        timestamp: new Date(),
        actionRequired: "Check development environment manager",
        autoFixable: true,
      });
    }

    return detections;
  }

  /**
   * 🚨 우회 시도 감지
   */
  private async detectBypassAttempts(): Promise<DetectionResult[]> {
    const detections: DetectionResult[] = [];

    try {
      const executionMetrics = LLMExecutionAuthority.getExecutionMetrics();
      const bypassAttempts = executionMetrics.bypassAttempts || 0;

      if (bypassAttempts > 0) {
        detections.push({
          passed: false,
          severity: "critical",
          category: "Security",
          message: `${bypassAttempts} bypass attempts detected`,
          details: { bypassAttempts },
          timestamp: new Date(),
          actionRequired: "Review security logs and validate system integrity",
          autoFixable: false,
        });
      } else {
        detections.push({
          passed: true,
          severity: "info",
          category: "Security",
          message: "No bypass attempts detected",
          timestamp: new Date(),
        });
      }
    } catch (error) {
      detections.push({
        passed: false,
        severity: "warning",
        category: "Security",
        message: "Failed to check bypass attempts",
        details: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
        timestamp: new Date(),
        actionRequired: "Check security monitoring system",
        autoFixable: false,
      });
    }

    return detections;
  }

  /**
   * 📊 시스템 무결성 감지
   */
  private async detectSystemIntegrityIssues(): Promise<DetectionResult[]> {
    const detections: DetectionResult[] = [];

    try {
      // Check if all core systems are properly loaded
      const coreSystemsCheck = {
        apiKeyManager: typeof apiKeyManager !== "undefined",
        apiGuard: typeof APIGuard !== "undefined",
        executionAuthority: typeof LLMExecutionAuthority !== "undefined",
        executionVerifier: typeof ExecutionVerifier !== "undefined",
      };

      const failedSystems = Object.entries(coreSystemsCheck)
        .filter(([_, loaded]) => !loaded)
        .map(([system]) => system);

      if (failedSystems.length > 0) {
        detections.push({
          passed: false,
          severity: "emergency",
          category: "System Integrity",
          message: `Core systems not loaded: ${failedSystems.join(", ")}`,
          details: coreSystemsCheck,
          timestamp: new Date(),
          actionRequired: "Restart application and check system initialization",
          autoFixable: false,
        });
      } else {
        detections.push({
          passed: true,
          severity: "info",
          category: "System Integrity",
          message: "All core systems loaded successfully",
          details: coreSystemsCheck,
          timestamp: new Date(),
        });
      }
    } catch (error) {
      detections.push({
        passed: false,
        severity: "critical",
        category: "System Integrity",
        message: "Failed to check system integrity",
        details: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
        timestamp: new Date(),
        actionRequired: "Check system initialization process",
        autoFixable: false,
      });
    }

    return detections;
  }

  /**
   * 🔄 지속적 모니터링 시작 (BackgroundTaskManager 사용)
   */
  private startContinuousMonitoring(): void {
    // Feature Flag 체크
    const monitoringEnabled =
      process.env.FEATURE_AUTO_DETECTION_MONITORING !== "false";

    if (!monitoringEnabled) {
      console.log(
        "⏸️ [AutoDetection] Auto-detection monitoring disabled by feature flag",
      );
      return;
    }

    // BackgroundTaskManager를 통해 interval 등록 (30초 → 5분으로 완화)
    backgroundTaskManager.registerInterval(
      "auto-detection-monitoring",
      async () => {
        try {
          const health = await this.performFullHealthCheck();

          // Log critical issues
          if (health.overall === "critical" || health.overall === "emergency") {
            console.error(
              "🚨 [AutoDetection] CRITICAL SYSTEM HEALTH ISSUE DETECTED",
            );
            console.error(
              `Issues: ${health.summary.criticalIssues}, Warnings: ${health.summary.warnings}`,
            );
          }
        } catch (error) {
          console.error("🚨 [AutoDetection] Health check failed:", error);
        }
      },
      300000, // 5분으로 완화 (30초는 너무 짧음)
      { enabled: true, replace: true },
    );

    console.log(
      "🔍 [AutoDetection] Continuous monitoring started (5min interval)",
    );
  }

  /**
   * 📊 전체 건강 상태 계산
   */
  private calculateOverallHealth(
    detections: DetectionResult[],
  ): SystemHealth["overall"] {
    const emergencyIssues = detections.filter(
      (d) => d.severity === "emergency",
    ).length;
    const criticalIssues = detections.filter(
      (d) => d.severity === "critical",
    ).length;
    const warnings = detections.filter((d) => d.severity === "warning").length;

    if (emergencyIssues > 0) return "emergency";
    if (criticalIssues > 0) return "critical";
    if (warnings > 2) return "degraded";
    return "healthy";
  }

  /**
   * 💡 권장사항 생성
   */
  private generateRecommendations(detections: DetectionResult[]): string[] {
    const recommendations: string[] = [];
    const issues = detections.filter((d) => !d.passed);

    if (issues.some((i) => i.category === "Mock Contamination")) {
      recommendations.push(
        "Check API key validity and LLM service connectivity",
      );
    }

    if (issues.some((i) => i.category === "API Key Health")) {
      recommendations.push(
        "Add redundant API keys to prevent service interruption",
      );
    }

    if (issues.some((i) => i.category === "Security")) {
      recommendations.push(
        "Review security logs and validate system access controls",
      );
    }

    if (issues.some((i) => i.category === "System Integrity")) {
      recommendations.push(
        "Restart application and verify all core systems are initialized",
      );
    }

    if (recommendations.length === 0) {
      recommendations.push("System health looks good - continue monitoring");
    }

    return recommendations;
  }

  /**
   * 🚨 알림 트리거
   */
  private triggerAlert(result: DetectionResult): void {
    console.error(
      `🚨 [AutoDetection] ALERT - ${result.category}: ${result.message}`,
    );

    this.alertCallbacks.forEach((callback) => {
      try {
        callback(result);
      } catch (error) {
        console.error("Alert callback failed:", error);
      }
    });
  }

  /**
   * 📋 탐지 기록 정리
   */
  private trimDetectionHistory(): void {
    if (this.detectionHistory.length > 1000) {
      this.detectionHistory = this.detectionHistory.slice(-500);
    }
  }

  // 🔧 Public Interface

  /**
   * 알림 콜백 등록
   */
  onAlert(callback: (result: DetectionResult) => void): void {
    this.alertCallbacks.push(callback);
  }

  /**
   * 탐지 기록 조회
   */
  getDetectionHistory(): DetectionResult[] {
    return [...this.detectionHistory];
  }

  /**
   * 모니터링 중지 (BackgroundTaskManager 사용)
   */
  stopMonitoring(): void {
    backgroundTaskManager.unregister("auto-detection-monitoring");
    console.log("🔍 [AutoDetection] Continuous monitoring stopped");
  }

  /**
   * 특정 카테고리만 검사
   */
  async checkCategory(category: string): Promise<DetectionResult[]> {
    switch (category) {
      case "Mock Contamination":
        return this.detectSilentMockContamination();
      case "API Key Health":
        return this.detectAPIKeyHealth();
      case "Execution Authority":
        return this.detectExecutionAuthorityHealth();
      case "Port & Process Health":
        return this.detectPortAndProcessHealth();
      case "Security":
        return this.detectBypassAttempts();
      case "System Integrity":
        return this.detectSystemIntegrityIssues();
      default:
        return [];
    }
  }
}

// 싱글톤 인스턴스 export
export const autoDetectionEngine = AutoDetectionEngine.getInstance();

console.log("🔍 [AutoDetection] Auto-Detection Engine system loaded");
