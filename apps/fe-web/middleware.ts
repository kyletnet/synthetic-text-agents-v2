/**
 * Next.js Middleware - Universal API Route Protection
 *
 * 🛡️ Intercepts ALL /api/* requests
 * 🚫 Validates LLM Execution Authority before proceeding
 * 📊 Enforces execution transparency
 * 🔄 Seamless integration with existing API routes
 */

import { NextRequest, NextResponse } from "next/server";
import { LLMExecutionAuthority } from "@/lib/llm-execution-authority";

// 🎯 Routes that require LLM execution protection
const LLM_PROTECTED_ROUTES = [
  "/api/augment",
  "/api/smart-augment",
  "/api/run/qa",
  "/api/rag/generate-qa",
  "/api/run",
  "/api/session",
  "/api/expert-feedback",
];

// 🔓 Routes excluded from LLM protection (read-only or system routes)
const EXCLUDED_ROUTES = [
  "/api/health",
  "/api/status",
  "/api/ready",
  "/api/docs",
  "/api/maintain",
  "/api/dashboard",
  "/api/baseline",
  "/api/results",
  "/api/upload",
  "/api/rag/documents",
  "/api/rag/search",
  "/api/rag/stats",
];

/**
 * 🛡️ Main Middleware Function
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // 🎯 Only process API routes
  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // 🚨 Feature flag check
  if (!isMiddlewareEnabled()) {
    console.log(`🚨 [Middleware] Protection disabled for: ${pathname}`);
    return NextResponse.next();
  }

  // 🔍 Check if route requires LLM protection
  const requiresLLMProtection = LLM_PROTECTED_ROUTES.some((route) =>
    pathname.startsWith(route),
  );
  const isExcluded = EXCLUDED_ROUTES.some((route) =>
    pathname.startsWith(route),
  );

  if (!requiresLLMProtection || isExcluded) {
    // 📝 Log non-protected routes for monitoring
    console.log(
      `📝 [Middleware] Pass-through: ${pathname} (${
        isExcluded ? "excluded" : "not LLM-related"
      })`,
    );
    return NextResponse.next();
  }

  // 🛡️ Apply LLM Execution Authority validation
  console.log(`🛡️ [Middleware] Validating LLM execution for: ${pathname}`);

  try {
    // 🔒 Validate system integrity
    const integrityReport = LLMExecutionAuthority.validateSystemIntegrity();

    if (integrityReport.status === "critical") {
      return createExecutionDeniedResponse(
        "System integrity critical - LLM execution denied",
        {
          pathname,
          integrityStatus: integrityReport.status,
          failedChecks: Object.entries(integrityReport.checks)
            .filter(([_, passed]) => !passed)
            .map(([check]) => check),
        },
      );
    }

    // 🔍 Perform diagnostic execution check
    const diagnostic = await LLMExecutionAuthority.performDiagnosticExecution();

    if (!diagnostic.success) {
      return createExecutionDeniedResponse("LLM execution diagnostic failed", {
        pathname,
        diagnosticWarnings: diagnostic.warnings,
        executionPath: diagnostic.executionPath,
      });
    }

    // ✅ Add execution metadata to request headers
    const response = NextResponse.next();
    response.headers.set("X-LLM-Execution-Validated", "true");
    response.headers.set("X-LLM-Execution-Id", generateExecutionId());
    response.headers.set("X-LLM-System-Status", integrityReport.status);

    console.log(`✅ [Middleware] LLM execution validated for: ${pathname}`);
    return response;
  } catch (error) {
    console.error(`❌ [Middleware] Validation failed for: ${pathname}`, error);

    // 🔄 Handle validation errors based on strict mode
    if (isStrictModeEnabled()) {
      return createExecutionDeniedResponse(
        "LLM execution validation failed in strict mode",
        {
          pathname,
          error: error instanceof Error ? error.message : "Unknown error",
          strictMode: true,
        },
      );
    }

    // 📝 Log but allow in non-strict mode
    console.warn(
      `⚠️ [Middleware] Allowing request in non-strict mode: ${pathname}`,
    );
    const response = NextResponse.next();
    response.headers.set("X-LLM-Execution-Validated", "false");
    response.headers.set(
      "X-LLM-Execution-Warning",
      "Validation failed but allowed in non-strict mode",
    );
    return response;
  }
}

/**
 * 🚫 Create Execution Denied Response
 */
function createExecutionDeniedResponse(
  reason: string,
  details: any,
): NextResponse {
  const response = {
    error: "LLM_EXECUTION_DENIED",
    message: "🚫 LLM execution blocked by system protection",
    reason,
    details,
    timestamp: new Date().toISOString(),
    support: {
      documentation: "https://docs.example.com/llm-execution-protection",
      actions: [
        "Verify API keys are configured and valid",
        "Check system status at /api/status",
        "Contact support if issue persists",
      ],
    },
  };

  console.error(`🚫 [Middleware] Execution denied: ${reason}`, details);

  return NextResponse.json(response, {
    status: 503,
    headers: {
      "X-LLM-Execution-Denied": "true",
      "X-LLM-Denial-Reason": reason,
      "Content-Type": "application/json",
    },
  });
}

/**
 * 🛠️ Helper Functions
 */
function isMiddlewareEnabled(): boolean {
  return process.env.FEATURE_LLM_EXECUTION_AUTHORITY !== "false";
}

function isStrictModeEnabled(): boolean {
  return process.env.LLM_STRICT_MODE === "true";
}

function generateExecutionId(): string {
  return `exec_mid_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 🎯 Middleware Configuration
 */
export const config = {
  matcher: [
    /*
     * Match all API routes EXCEPT:
     * - Static files (_next/static)
     * - Image optimization (_next/image)
     * - Favicon
     */
    "/api/:path*",
  ],
};

console.log("🛡️ [Middleware] Universal LLM execution protection loaded");
console.log(`🛡️ [Middleware] Protected routes: ${LLM_PROTECTED_ROUTES.length}`);
console.log(`🔓 [Middleware] Excluded routes: ${EXCLUDED_ROUTES.length}`);
console.log(
  `🚨 [Middleware] Strict mode: ${
    isStrictModeEnabled() ? "ENABLED" : "DISABLED"
  }`,
);
