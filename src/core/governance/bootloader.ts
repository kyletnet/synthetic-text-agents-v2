/**
 * Governance Bootloader
 *
 * Critical Design Shift (from GPT insight):
 * "Don't let the app import the kernel. Let the kernel load the app."
 *
 * Before (감시자):
 * app.ts → import kernel → kernel validates → app runs
 * (App is the master, kernel is the servant)
 *
 * After (생성자):
 * bootloader → kernel initializes → kernel loads app → app runs
 * (Kernel is the DNA provider, app is the expression)
 *
 * This is the difference between:
 * - Immune System (reacts to threats)
 * - Genetic System (controls creation)
 */

import { initializeGovernanceKernel } from "./kernel.js";

export interface BootloaderOptions {
  strictMode?: boolean;
  enableHotReload?: boolean;
  enableSelfCorrection?: boolean;
  appEntryPoint?: string;
}

/**
 * Governance Bootloader
 * The kernel is now the DNA provider that creates the app
 */
export class GovernanceBootloader {
  private options: Required<BootloaderOptions>;

  constructor(options: BootloaderOptions = {}) {
    this.options = {
      strictMode: options.strictMode ?? true,
      enableHotReload: options.enableHotReload ?? false,
      enableSelfCorrection: options.enableSelfCorrection ?? true,
      appEntryPoint: options.appEntryPoint ?? "./main.js",
    };
  }

  /**
   * Boot sequence
   * Kernel → App (not App → Kernel)
   */
  async boot(): Promise<void> {
    console.log("🧬 [Bootloader] Starting DNA-level boot sequence...\n");

    try {
      // Phase 1: Initialize Governance Kernel (DNA Provider)
      console.log("📐 Phase 1: Initializing Governance Kernel");
      const kernel = await initializeGovernanceKernel({
        strictMode: this.options.strictMode,
      });
      console.log("   ✅ Kernel initialized\n");

      // Phase 2: Enable Hot Reload (if requested)
      if (this.options.enableHotReload) {
        console.log("🔄 Phase 2: Enabling Policy Hot Reload");
        await this.enableHotReload(kernel);
        console.log("   ✅ Hot reload enabled\n");
      }

      // Phase 3: Enable Self-Correction (if requested)
      if (this.options.enableSelfCorrection) {
        console.log("🤖 Phase 3: Enabling Self-Correction Loop");
        await this.enableSelfCorrection(kernel);
        console.log("   ✅ Self-correction enabled\n");
      }

      // Phase 4: Load Application (Kernel loads the app, not vice versa)
      console.log("🚀 Phase 4: Loading Application");
      await this.loadApplication();
      console.log("   ✅ Application loaded\n");

      console.log("✅ [Bootloader] Boot sequence complete - System is alive\n");
    } catch (error) {
      console.error("❌ [Bootloader] Boot sequence failed:", error);
      console.error("\n💡 Governance kernel blocked system startup.");
      console.error("   Fix violations and try again.\n");
      process.exit(1);
    }
  }

  /**
   * Enable hot reload of governance policies
   */
  private async enableHotReload(kernel: any): Promise<void> {
    const { watch } = await import("fs");
    const { join } = await import("path");

    const policyPath = join(process.cwd(), "governance-rules.yaml");

    watch(policyPath, async (eventType) => {
      if (eventType === "change") {
        console.log("\n🔄 [Hot Reload] Policy file changed, reloading...");
        try {
          // Reload policies dynamically
          const { getPolicyInterpreter } = await import(
            "../../infrastructure/governance/policy-interpreter.js"
          );
          const interpreter = getPolicyInterpreter();
          await interpreter.loadPolicies();
          console.log("   ✅ Policies reloaded successfully\n");
        } catch (error) {
          console.error("   ❌ Policy reload failed:", error);
        }
      }
    });
  }

  /**
   * Enable self-correction loop
   */
  private async enableSelfCorrection(kernel: any): Promise<void> {
    // Import self-correction engine
    const { SelfCorrectionEngine } = await import(
      "../../infrastructure/governance/self-correction.js"
    );

    const engine = new SelfCorrectionEngine();
    await engine.initialize();

    // Engine will monitor predictive feedback and auto-adjust policies
  }

  /**
   * Load application
   * The kernel loads the app, not the app importing the kernel
   */
  private async loadApplication(): Promise<void> {
    try {
      // Dynamic import of app entry point
      const app = await import(this.options.appEntryPoint);

      // If app has a start() method, call it
      if (app.start && typeof app.start === "function") {
        await app.start();
      } else if (app.default && typeof app.default === "function") {
        await app.default();
      } else {
        console.warn("   ⚠️  App entry point has no start() or default export");
      }
    } catch (error) {
      console.error("   ❌ Failed to load application:", error);
      throw error;
    }
  }
}

/**
 * Boot with governance
 * This is the new entry point for applications
 */
export async function bootWithGovernance(
  options?: BootloaderOptions,
): Promise<void> {
  const bootloader = new GovernanceBootloader(options);
  await bootloader.boot();
}
