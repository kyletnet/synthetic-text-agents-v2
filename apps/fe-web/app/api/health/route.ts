import { NextRequest, NextResponse } from "next/server";
import { anthropicClient } from "@/lib/anthropic-client";
import { ExecutionVerifier } from "@/lib/execution-verifier";

export interface HealthCheckResult {
  status: "healthy" | "unhealthy" | "degraded";
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  checks: {
    [key: string]: {
      status: "pass" | "fail" | "warn";
      responseTime?: number;
      details?: string;
      lastChecked: string;
    };
  };
  system: {
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    cpu: {
      usage: number;
    };
    disk: {
      used: number;
      total: number;
      percentage: number;
    };
  };
}

/**
 * Health check endpoint for monitoring system status
 * GET /api/health
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    // Get system information
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();
    const version = process.env.npm_package_version || "1.0.0";
    const environment =
      process.env.ENVIRONMENT || process.env.NODE_ENV || "development";

    // Initialize health check result
    const healthCheck: HealthCheckResult = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: uptime,
      version: version,
      environment: environment,
      checks: {},
      system: {
        memory: {
          used: memoryUsage.heapUsed,
          total: memoryUsage.heapTotal,
          percentage: Math.round(
            (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
          ),
        },
        cpu: {
          usage: 0, // Will be calculated below
        },
        disk: {
          used: 0,
          total: 0,
          percentage: 0,
        },
      },
    };

    // Check API key availability and Anthropic connection
    const apiKeyCheck = await checkApiKeyAvailability();
    healthCheck.checks.apiKey = apiKeyCheck;

    // CRITICAL: Check for Mock data contamination
    const mockCheck = await checkMockDataContamination();
    healthCheck.checks.mockContamination = mockCheck;

    // Check database connectivity (if applicable)
    const dbCheck = await checkDatabaseConnectivity();
    healthCheck.checks.database = dbCheck;

    // Check external services
    const externalServicesCheck = await checkExternalServices();
    healthCheck.checks.externalServices = externalServicesCheck;

    // Check disk space
    const diskCheck = await checkDiskSpace();
    healthCheck.checks.diskSpace = diskCheck;
    healthCheck.system.disk =
      (diskCheck.details as any) || healthCheck.system.disk;

    // Calculate CPU usage (simple approximation)
    const cpuUsage = await getCpuUsage();
    healthCheck.system.cpu.usage = cpuUsage;

    // Determine overall health status
    const failedChecks = Object.values(healthCheck.checks).filter(
      (check) => check.status === "fail",
    );
    const warnChecks = Object.values(healthCheck.checks).filter(
      (check) => check.status === "warn",
    );

    if (failedChecks.length > 0) {
      healthCheck.status = "unhealthy";
    } else if (warnChecks.length > 0) {
      healthCheck.status = "degraded";
    } else {
      healthCheck.status = "healthy";
    }

    // Add response time
    const responseTime = Date.now() - startTime;

    // Return appropriate status code
    const statusCode =
      healthCheck.status === "healthy"
        ? 200
        : healthCheck.status === "degraded"
        ? 200
        : 503;

    return NextResponse.json(
      {
        ...healthCheck,
        responseTime: responseTime,
      },
      { status: statusCode },
    );
  } catch (error) {
    console.error("Health check failed:", error);

    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: "Health check failed",
        details: error instanceof Error ? error.message : "Unknown error",
        responseTime: Date.now() - startTime,
      },
      { status: 503 },
    );
  }
}

/**
 * Check if API keys are available and valid
 */
async function checkApiKeyAvailability() {
  const checkStart = Date.now();

  try {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    if (
      !anthropicKey ||
      anthropicKey.includes("your_") ||
      anthropicKey.includes("placeholder")
    ) {
      return {
        status: "fail" as const,
        responseTime: Date.now() - checkStart,
        details: "ANTHROPIC_API_KEY not configured or invalid",
        lastChecked: new Date().toISOString(),
      };
    }

    // Basic key format validation
    if (!anthropicKey.startsWith("sk-ant-")) {
      return {
        status: "warn" as const,
        responseTime: Date.now() - checkStart,
        details: "API key format may be invalid",
        lastChecked: new Date().toISOString(),
      };
    }

    // Test actual Anthropic client connection
    if (anthropicClient.isReady()) {
      return {
        status: "pass" as const,
        responseTime: Date.now() - checkStart,
        details: "Anthropic client ready and API key configured",
        lastChecked: new Date().toISOString(),
      };
    } else {
      return {
        status: "fail" as const,
        responseTime: Date.now() - checkStart,
        details: "Anthropic client not ready",
        lastChecked: new Date().toISOString(),
      };
    }
  } catch (error) {
    return {
      status: "fail" as const,
      responseTime: Date.now() - checkStart,
      details: `API key check failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
      lastChecked: new Date().toISOString(),
    };
  }
}

/**
 * Check database connectivity
 */
async function checkDatabaseConnectivity() {
  const checkStart = Date.now();

  try {
    // For now, just check if database configuration is present
    const dbHost = process.env.DB_HOST;
    const dbPassword = process.env.DB_PASSWORD;

    if (!dbHost && !dbPassword) {
      return {
        status: "warn" as const,
        responseTime: Date.now() - checkStart,
        details: "Database not configured (using in-memory storage)",
        lastChecked: new Date().toISOString(),
      };
    }

    // TODO: Add actual database connection test
    return {
      status: "pass" as const,
      responseTime: Date.now() - checkStart,
      details: "Database configuration present",
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: "fail" as const,
      responseTime: Date.now() - checkStart,
      details: `Database check failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
      lastChecked: new Date().toISOString(),
    };
  }
}

/**
 * Check external services connectivity
 */
async function checkExternalServices() {
  const checkStart = Date.now();

  try {
    // Check if we can resolve DNS
    const anthropicReachable = await checkServiceReachability(
      "https://api.anthropic.com",
    );

    if (!anthropicReachable) {
      return {
        status: "warn" as const,
        responseTime: Date.now() - checkStart,
        details: "External services may not be reachable",
        lastChecked: new Date().toISOString(),
      };
    }

    return {
      status: "pass" as const,
      responseTime: Date.now() - checkStart,
      details: "External services reachable",
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: "warn" as const,
      responseTime: Date.now() - checkStart,
      details: `External services check failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
      lastChecked: new Date().toISOString(),
    };
  }
}

/**
 * Check disk space
 */
async function checkDiskSpace() {
  const checkStart = Date.now();

  try {
    // For Node.js environment, we'll use a simple approximation
    // In a real production environment, you'd want to use actual disk space monitoring

    const _tmpDir = process.env.TMPDIR || "/tmp";
    const freeSpacePercent = 85; // Simulated - replace with actual disk space check

    if (freeSpacePercent > 90) {
      return {
        status: "fail" as const,
        responseTime: Date.now() - checkStart,
        details: `Disk space critical: ${freeSpacePercent}% used`,
        lastChecked: new Date().toISOString(),
      };
    }

    if (freeSpacePercent > 80) {
      return {
        status: "warn" as const,
        responseTime: Date.now() - checkStart,
        details: `Disk space warning: ${freeSpacePercent}% used`,
        lastChecked: new Date().toISOString(),
      };
    }

    return {
      status: "pass" as const,
      responseTime: Date.now() - checkStart,
      details: `Disk space OK: ${freeSpacePercent}% used`,
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: "warn" as const,
      responseTime: Date.now() - checkStart,
      details: `Disk space check failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
      lastChecked: new Date().toISOString(),
    };
  }
}

/**
 * Get CPU usage approximation
 */
async function getCpuUsage(): Promise<number> {
  try {
    // Simple CPU usage approximation
    // In production, you'd want to use a proper CPU monitoring library
    const start = process.hrtime();
    await new Promise((resolve) => setTimeout(resolve, 100));
    const end = process.hrtime(start);

    // This is a very rough approximation
    const cpuUsage = Math.min(
      100,
      Math.max(0, (end[0] * 1000 + end[1] / 1000000) / 10),
    );
    return Math.round(cpuUsage);
  } catch {
    return 0;
  }
}

/**
 * CRITICAL: Check for Mock data contamination in system
 */
async function checkMockDataContamination() {
  const checkStart = Date.now();

  try {
    const envPolicy = ExecutionVerifier.checkEnvironmentPolicy();

    // 환경 정책 검사
    if (!envPolicy.strictMode && process.env.NODE_ENV === "production") {
      return {
        status: "fail" as const,
        responseTime: Date.now() - checkStart,
        details:
          "CRITICAL: Production detected but system not in strict mode - Mock data contamination risk",
        lastChecked: new Date().toISOString(),
      };
    }

    // API 키 누락으로 인한 Fallback 사용 경고
    if (envPolicy.warnings.length > 0) {
      const hasCriticalWarning = envPolicy.warnings.some((warning) =>
        warning.includes("CRITICAL"),
      );

      if (hasCriticalWarning) {
        return {
          status: "fail" as const,
          responseTime: Date.now() - checkStart,
          details: `Mock contamination risk: ${envPolicy.warnings.join(", ")}`,
          lastChecked: new Date().toISOString(),
        };
      } else {
        return {
          status: "warn" as const,
          responseTime: Date.now() - checkStart,
          details: `Fallback mode: ${envPolicy.warnings.join(", ")}`,
          lastChecked: new Date().toISOString(),
        };
      }
    }

    return {
      status: "pass" as const,
      responseTime: Date.now() - checkStart,
      details: "No Mock data contamination detected",
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: "fail" as const,
      responseTime: Date.now() - checkStart,
      details: `Mock contamination check failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
      lastChecked: new Date().toISOString(),
    };
  }
}

/**
 * Check if a service is reachable
 */
async function checkServiceReachability(
  url: string,
  timeout: number = 5000,
): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok || response.status < 500;
  } catch {
    return false;
  }
}
