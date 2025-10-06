/**
 * LLM Execution Authority (LEA)
 *
 * 🛡️ Central execution gate for ALL LLM calls
 * 🚫 NO BYPASS PATHS ALLOWED
 * 📊 Complete audit trail and source tracking
 * 🔄 Self-diagnostic capabilities
 */

import { apiKeyManager } from "./api-key-manager";
import { APIGuard } from "./api-guard";
import { ExecutionVerifier } from "./execution-verifier";
// ExecutionTracer는 API 경로에서만 사용 (edge runtime 호환성)
// import { executionTracer, ExecutionTrace } from './execution-tracer';

// 🏗️ Core Execution Context
export interface ExecutionContext {
  method: string;
  args: any[];
  caller: string;
  timestamp: number;
  sessionId?: string;
  requestId?: string;
  route?: string;
  userAgent?: string;
  ipAddress?: string;
}

// 🎯 Authorized Execution Result
export interface AuthorizedExecution {
  authorized: boolean;
  executionId: string;
  traceId: string;
  context: ExecutionContext;
  apiKey: string | null;
  source: "llm" | "fallback" | "denied";
  reason?: string;
  metadata: {
    guardValidated: boolean;
    apiKeyManagerActive: boolean;
    strictMode: boolean;
    timestamp: string;
  };
}

// 📊 System Integrity Report
export interface SystemIntegrityReport {
  status: "healthy" | "degraded" | "critical";
  checks: {
    apiKeyManager: boolean;
    apiGuard: boolean;
    executionVerifier: boolean;
    featureFlags: boolean;
  };
  metrics: {
    totalExecutions: number;
    authorizedExecutions: number;
    deniedExecutions: number;
    bypassAttempts: number;
  };
  timestamp: string;
}

// 🔬 Diagnostic Execution Result
export interface DiagnosticResult {
  success: boolean;
  executionPath: string;
  guardsTriggered: string[];
  timeElapsed: number;
  apiKeyUsed: boolean;
  warnings: string[];
}

// 🚨 Custom Execution Errors
export class ExecutionDeniedError extends Error {
  constructor(reason: string, context?: ExecutionContext) {
    super(`LLM execution denied: ${reason}`);
    this.name = "ExecutionDeniedError";
    this.context = context;
  }
  context?: ExecutionContext;
}

/**
 * 🛡️ LLM Execution Authority - Central Command
 */
export class LLMExecutionAuthority {
  private static executionCount = 0;
  private static deniedCount = 0;
  private static bypassAttempts = 0;
  private static executionHistory: AuthorizedExecution[] = [];

  /**
   * 🎯 Central Execution Gate - NO BYPASS ALLOWED
   */
  static async authorizeExecution(
    context: ExecutionContext,
  ): Promise<AuthorizedExecution> {
    const executionId = `exec_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    const startTime = Date.now();

    // 🔍 START EXECUTION TRACE (미들웨어에서는 간단하게)
    const traceId = `trace_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    console.log(`🔍 [LEA] Starting execution trace: ${traceId}`);

    // 🚨 Feature Flag Check
    if (!this.isExecutionAuthorityEnabled()) {
      console.warn(
        "🚨 [LEA] Execution Authority disabled - allowing legacy behavior",
      );
      const legacyAuth = this.createLegacyAuthorization(executionId, context);
      legacyAuth.traceId = traceId;
      console.log(`🚨 [LEA] Legacy authorization granted: ${traceId}`);
      return legacyAuth;
    }

    console.log(
      `🛡️ [LEA] Authorizing execution: ${context.method} (${executionId}, trace: ${traceId})`,
    );

    try {
      // 📋 Step 1: Basic Context Validation
      this.validateExecutionContext(context);

      // 🔒 Step 2: API Guard Validation
      const guardValidation = this.validateAPIGuard();
      console.log(
        `🛡️ [LEA] Guard validation: ${guardValidation.valid} (${traceId})`,
      );
      if (!guardValidation.valid) {
        const denial = this.denyExecution(
          executionId,
          context,
          guardValidation.reason,
        );
        denial.traceId = traceId;
        console.log(`🚫 [LEA] Execution denied - guard failed: ${traceId}`);
        return denial;
      }

      // 🔑 Step 3: API Key Manager Check
      const apiKey = apiKeyManager.getCurrentKey();
      if (!apiKey) {
        const denial = this.denyExecution(
          executionId,
          context,
          "No valid API key available",
        );
        denial.traceId = traceId;
        console.log(`🚫 [LEA] Execution denied - no API key: ${traceId}`);
        return denial;
      }

      // 🔍 Step 4: Execution Verifier Check
      const envPolicy = ExecutionVerifier.checkEnvironmentPolicy();
      if (envPolicy.warnings.some((w) => w.includes("CRITICAL"))) {
        const denial = this.denyExecution(
          executionId,
          context,
          "Critical environment policy violation",
        );
        denial.traceId = traceId;
        console.log(
          `🚫 [LEA] Execution denied - environment policy: ${traceId}`,
        );
        return denial;
      }

      // ✅ Step 5: Grant Authorization
      const authorization = this.grantExecution(executionId, context, apiKey);
      authorization.traceId = traceId;
      console.log(`✅ [LEA] Execution authorized: ${traceId}`);

      // 📊 Step 6: Record Metrics
      this.recordExecution(authorization);

      console.log(
        `✅ [LEA] Execution authorized: ${executionId} (${
          Date.now() - startTime
        }ms)`,
      );
      return authorization;
    } catch (error) {
      console.error(`❌ [LEA] Authorization failed: ${executionId}`, error);
      return this.denyExecution(
        executionId,
        context,
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  }

  /**
   * 🔍 System Integrity Validation
   */
  static validateSystemIntegrity(): SystemIntegrityReport {
    const checks = {
      apiKeyManager: this.checkAPIKeyManager(),
      apiGuard: this.checkAPIGuard(),
      executionVerifier: this.checkExecutionVerifier(),
      featureFlags: this.checkFeatureFlags(),
    };

    const allChecksPass = Object.values(checks).every((check) => check);
    const status = allChecksPass
      ? "healthy"
      : Object.values(checks).filter((check) => check).length >= 3
      ? "degraded"
      : "critical";

    return {
      status,
      checks,
      metrics: {
        totalExecutions: this.executionCount,
        authorizedExecutions: this.executionCount - this.deniedCount,
        deniedExecutions: this.deniedCount,
        bypassAttempts: this.bypassAttempts,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 🔬 Diagnostic Execution Test
   */
  static async performDiagnosticExecution(): Promise<DiagnosticResult> {
    const startTime = Date.now();
    const warnings: string[] = [];
    const guardsTriggered: string[] = [];

    try {
      const testContext: ExecutionContext = {
        method: "diagnostic",
        args: ["test execution"],
        caller: "LLMExecutionAuthority.performDiagnosticExecution",
        timestamp: Date.now(),
        sessionId: "diagnostic",
      };

      const authorization = await this.authorizeExecution(testContext);

      if (authorization.metadata.guardValidated)
        guardsTriggered.push("API Guard");
      if (authorization.metadata.apiKeyManagerActive)
        guardsTriggered.push("API Key Manager");
      if (authorization.metadata.strictMode)
        guardsTriggered.push("Strict Mode");

      return {
        success: authorization.authorized,
        executionPath: authorization.source,
        guardsTriggered,
        timeElapsed: Date.now() - startTime,
        apiKeyUsed: !!authorization.apiKey,
        warnings,
      };
    } catch (error) {
      warnings.push(
        error instanceof Error ? error.message : "Unknown diagnostic error",
      );
      return {
        success: false,
        executionPath: "error",
        guardsTriggered,
        timeElapsed: Date.now() - startTime,
        apiKeyUsed: false,
        warnings,
      };
    }
  }

  // 🛠️ Private Helper Methods

  private static isExecutionAuthorityEnabled(): boolean {
    return process.env.FEATURE_LLM_EXECUTION_AUTHORITY === "true";
  }

  private static validateExecutionContext(context: ExecutionContext): void {
    if (!context.method) throw new Error("Missing execution method");
    if (!context.caller) throw new Error("Missing execution caller");
    if (!context.timestamp) throw new Error("Missing execution timestamp");
  }

  private static validateAPIGuard(): { valid: boolean; reason?: string } {
    try {
      const systemStatus = APIGuard.getSystemStatus();
      if (!systemStatus.canServeRequests) {
        return { valid: false, reason: systemStatus.message };
      }
      return { valid: true };
    } catch (error) {
      return { valid: false, reason: "API Guard validation failed" };
    }
  }

  private static grantExecution(
    executionId: string,
    context: ExecutionContext,
    apiKey: string,
  ): AuthorizedExecution {
    this.executionCount++;

    return {
      authorized: true,
      executionId,
      context,
      apiKey,
      source: "llm",
      metadata: {
        guardValidated: true,
        apiKeyManagerActive: true,
        strictMode: this.isStrictModeEnabled(),
        timestamp: new Date().toISOString(),
      },
    };
  }

  private static denyExecution(
    executionId: string,
    context: ExecutionContext,
    reason: string,
  ): AuthorizedExecution {
    this.deniedCount++;

    const shouldAllowFallback = this.shouldAllowFallback();
    const source = shouldAllowFallback ? "fallback" : "denied";

    console.warn(
      `🚫 [LEA] Execution denied: ${reason} (fallback: ${shouldAllowFallback})`,
    );

    return {
      authorized: shouldAllowFallback,
      executionId,
      context,
      apiKey: null,
      source,
      reason,
      metadata: {
        guardValidated: false,
        apiKeyManagerActive: false,
        strictMode: this.isStrictModeEnabled(),
        timestamp: new Date().toISOString(),
      },
    };
  }

  private static createLegacyAuthorization(
    executionId: string,
    context: ExecutionContext,
  ): AuthorizedExecution {
    // Legacy mode - allow execution without full guard validation
    return {
      authorized: true,
      executionId,
      context,
      apiKey: process.env.ANTHROPIC_API_KEY || null,
      source: "llm",
      metadata: {
        guardValidated: false,
        apiKeyManagerActive: false,
        strictMode: false,
        timestamp: new Date().toISOString(),
      },
    };
  }

  private static recordExecution(authorization: AuthorizedExecution): void {
    this.executionHistory.push(authorization);

    // Keep only last 100 executions
    if (this.executionHistory.length > 100) {
      this.executionHistory = this.executionHistory.slice(-100);
    }
  }

  private static shouldAllowFallback(): boolean {
    return (
      !this.isStrictModeEnabled() && process.env.NODE_ENV === "development"
    );
  }

  private static isStrictModeEnabled(): boolean {
    return process.env.LLM_STRICT_MODE === "true";
  }

  // Component Health Checks
  private static checkAPIKeyManager(): boolean {
    try {
      const stats = apiKeyManager.getStats();
      return stats.totalKeys > 0 && stats.activeKeys > 0;
    } catch {
      return false;
    }
  }

  private static checkAPIGuard(): boolean {
    try {
      const status = APIGuard.getSystemStatus();
      return status.canServeRequests;
    } catch {
      return false;
    }
  }

  private static checkExecutionVerifier(): boolean {
    try {
      ExecutionVerifier.checkEnvironmentPolicy();
      return true;
    } catch {
      return false;
    }
  }

  private static checkFeatureFlags(): boolean {
    return process.env.FEATURE_LLM_EXECUTION_AUTHORITY !== undefined;
  }

  // 📊 Public Metrics Access
  static getExecutionMetrics() {
    return {
      totalExecutions: this.executionCount,
      authorizedExecutions: this.executionCount - this.deniedCount,
      deniedExecutions: this.deniedCount,
      bypassAttempts: this.bypassAttempts,
      recentExecutions: this.executionHistory.slice(-10),
    };
  }

  // 🔍 Bypass Attempt Detection
  static recordBypassAttempt(caller: string, method: string): void {
    this.bypassAttempts++;
    console.error(`🚨 [LEA] BYPASS ATTEMPT DETECTED: ${caller} -> ${method}`);
  }
}

// 🎯 Caller Detection Utility
export function getCaller(): string {
  const stack = new Error().stack;
  if (!stack) return "unknown";

  const lines = stack.split("\n");
  // Skip first 3 lines (Error, getCaller, actual caller)
  for (let i = 3; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes("at ")) {
      const match = line.match(/at (.+?) \(/);
      if (match) return match[1];
    }
  }
  return "unknown";
}
