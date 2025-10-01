/**
 * Engine Governance Template
 *
 * Purpose:
 * - Standard template for adding governance to any engine
 * - Minimal invasive integration pattern
 * - Consistent error handling and logging
 *
 * Usage:
 * 1. Import GovernanceRunner and this template
 * 2. Wrap main execution logic with executeWithGovernance()
 * 3. Choose appropriate OperationType
 */

import { GovernanceRunner } from "./governance-runner.js";
import type { OperationType } from "./governance-types.js";

/**
 * Standard governance integration pattern for engines
 *
 * @example
 * ```ts
 * class MyEngine {
 *   private governance: GovernanceRunner;
 *
 *   constructor() {
 *     this.governance = new GovernanceRunner();
 *   }
 *
 *   async run(): Promise<void> {
 *     await this.governance.executeWithGovernance(
 *       async () => {
 *         // Your engine logic here
 *         await this.doWork();
 *       },
 *       {
 *         name: "my-engine",
 *         type: "system-command", // or "validation" for quick checks
 *         description: "My engine description",
 *         skipSnapshot: true,  // true for read-only operations
 *         skipVerification: true, // true for non-critical operations
 *       }
 *     );
 *   }
 * }
 * ```
 */
export class EngineGovernanceTemplate {
  /**
   * Determine operation type based on engine characteristics
   */
  static determineOperationType(engineType: string): OperationType {
    // Analysis/Read-only engines → validation (2min timeout)
    if (
      engineType.includes("analyze") ||
      engineType.includes("report") ||
      engineType.includes("status")
    ) {
      return "validation";
    }

    // User-interactive engines → user-input (no timeout)
    if (
      engineType.includes("interactive") ||
      engineType.includes("approval") ||
      engineType.includes("fix")
    ) {
      return "user-input";
    }

    // Default: system-command (10min timeout)
    return "system-command";
  }

  /**
   * Determine if snapshots needed
   */
  static needsSnapshots(engineType: string): boolean {
    // Read-only operations don't need snapshots
    const readOnlyPatterns = [
      "analyze",
      "report",
      "status",
      "check",
      "validate",
      "verify",
    ];

    return !readOnlyPatterns.some((pattern) =>
      engineType.toLowerCase().includes(pattern),
    );
  }

  /**
   * Determine if verification needed
   */
  static needsVerification(engineType: string): boolean {
    // Critical operations need verification
    const criticalPatterns = [
      "maintain",
      "fix",
      "deploy",
      "ship",
      "build",
      "migrate",
    ];

    return criticalPatterns.some((pattern) =>
      engineType.toLowerCase().includes(pattern),
    );
  }

  /**
   * Create governance context for an engine
   */
  static createContext(engineName: string, description?: string) {
    const type = this.determineOperationType(engineName);
    const skipSnapshot = !this.needsSnapshots(engineName);
    const skipVerification = !this.needsVerification(engineName);

    return {
      name: engineName,
      type,
      description: description || `${engineName} engine operation`,
      skipSnapshot,
      skipVerification,
    };
  }
}

/**
 * Quick integration helper for existing engines
 *
 * @example
 * ```ts
 * import { wrapWithGovernance } from "./lib/governance/engine-governance-template.js";
 *
 * class MyEngine {
 *   async run(): Promise<void> {
 *     await wrapWithGovernance("my-engine", async () => {
 *       // Your existing logic here
 *     });
 *   }
 * }
 * ```
 */
export async function wrapWithGovernance<T>(
  engineName: string,
  operation: () => Promise<T>,
  description?: string,
): Promise<T> {
  const governance = new GovernanceRunner();
  const context = EngineGovernanceTemplate.createContext(
    engineName,
    description,
  );

  return await governance.executeWithGovernance(operation, context);
}
