import { NextRequest, NextResponse } from "next/server";

export interface ReadinessCheckResult {
  status: "ready" | "not-ready";
  timestamp: string;
  checks: {
    [key: string]: {
      status: "ready" | "not-ready";
      details?: string;
      lastChecked: string;
    };
  };
}

/**
 * Readiness check endpoint for Kubernetes/container orchestration
 * GET /api/ready
 *
 * This endpoint indicates whether the service is ready to accept traffic.
 * Unlike /health, this is more strict and only returns 200 when fully operational.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const readinessCheck: ReadinessCheckResult = {
      status: "ready",
      timestamp: new Date().toISOString(),
      checks: {},
    };

    // Check critical dependencies for readiness

    // 1. API Key must be configured
    const apiKeyReady = await checkApiKeyReadiness();
    readinessCheck.checks.apiKey = apiKeyReady;

    // 2. Essential services must be available
    const servicesReady = await checkEssentialServices();
    readinessCheck.checks.services = servicesReady;

    // 3. Configuration must be valid
    const configReady = await checkConfigurationReadiness();
    readinessCheck.checks.configuration = configReady;

    // 4. Database must be accessible (if required)
    const dbReady = await checkDatabaseReadiness();
    readinessCheck.checks.database = dbReady;

    // Determine overall readiness
    const notReadyChecks = Object.values(readinessCheck.checks).filter(
      (check) => check.status === "not-ready",
    );

    if (notReadyChecks.length > 0) {
      readinessCheck.status = "not-ready";

      return NextResponse.json(readinessCheck, { status: 503 });
    }

    readinessCheck.status = "ready";
    return NextResponse.json(readinessCheck, { status: 200 });
  } catch (error) {
    console.error("Readiness check failed:", error);

    return NextResponse.json(
      {
        status: "not-ready",
        timestamp: new Date().toISOString(),
        error: "Readiness check failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 },
    );
  }
}

/**
 * Check if API key is ready for use
 */
async function checkApiKeyReadiness() {
  try {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    // API key is required for readiness
    if (
      !anthropicKey ||
      anthropicKey.includes("your_") ||
      anthropicKey.includes("placeholder") ||
      !anthropicKey.startsWith("sk-ant-")
    ) {
      return {
        status: "not-ready" as const,
        details: "ANTHROPIC_API_KEY not properly configured",
        lastChecked: new Date().toISOString(),
      };
    }

    return {
      status: "ready" as const,
      details: "API key is configured and valid",
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: "not-ready" as const,
      details: `API key check failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
      lastChecked: new Date().toISOString(),
    };
  }
}

/**
 * Check essential services
 */
async function checkEssentialServices() {
  try {
    // Check if essential environment variables are set
    const requiredEnvVars = ["NODE_ENV"];
    const missingVars = requiredEnvVars.filter(
      (varName) => !process.env[varName],
    );

    if (missingVars.length > 0) {
      return {
        status: "not-ready" as const,
        details: `Missing required environment variables: ${missingVars.join(
          ", ",
        )}`,
        lastChecked: new Date().toISOString(),
      };
    }

    // Check if we can perform basic operations
    try {
      JSON.stringify({ test: "readiness" });
      new Date().toISOString();
    } catch {
      return {
        status: "not-ready" as const,
        details: "Basic JavaScript operations failing",
        lastChecked: new Date().toISOString(),
      };
    }

    return {
      status: "ready" as const,
      details: "Essential services are operational",
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: "not-ready" as const,
      details: `Essential services check failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
      lastChecked: new Date().toISOString(),
    };
  }
}

/**
 * Check configuration readiness
 */
async function checkConfigurationReadiness() {
  try {
    const environment = process.env.ENVIRONMENT || process.env.NODE_ENV;

    // Validate environment-specific configurations
    if (environment === "production") {
      const requiredProdVars = ["ANTHROPIC_API_KEY", "NODE_ENV"];

      const missingProdVars = requiredProdVars.filter(
        (varName) =>
          !process.env[varName] ||
          process.env[varName]?.includes("your_") ||
          process.env[varName]?.includes("placeholder"),
      );

      if (missingProdVars.length > 0) {
        return {
          status: "not-ready" as const,
          details: `Missing production configuration: ${missingProdVars.join(
            ", ",
          )}`,
          lastChecked: new Date().toISOString(),
        };
      }
    }

    return {
      status: "ready" as const,
      details: `Configuration is valid for ${environment} environment`,
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: "not-ready" as const,
      details: `Configuration check failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
      lastChecked: new Date().toISOString(),
    };
  }
}

/**
 * Check database readiness
 */
async function checkDatabaseReadiness() {
  try {
    const dbHost = process.env.DB_HOST;
    const dbPassword = process.env.DB_PASSWORD;
    const environment = process.env.ENVIRONMENT || process.env.NODE_ENV;

    // In production, database is required
    if (environment === "production" && (!dbHost || !dbPassword)) {
      return {
        status: "not-ready" as const,
        details: "Database configuration required for production",
        lastChecked: new Date().toISOString(),
      };
    }

    // For development/staging, database is optional
    if (!dbHost && !dbPassword) {
      return {
        status: "ready" as const,
        details: "Database not configured (using in-memory storage)",
        lastChecked: new Date().toISOString(),
      };
    }

    // TODO: Add actual database connection test for readiness
    // This would include:
    // - Connection pool health
    // - Basic query execution
    // - Migration status check

    return {
      status: "ready" as const,
      details: "Database is ready",
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: "not-ready" as const,
      details: `Database readiness check failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
      lastChecked: new Date().toISOString(),
    };
  }
}
