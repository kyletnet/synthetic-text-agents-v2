/**
 * 🔄 Process Lifecycle Manager
 *
 * 근본 해결책: 모든 child process 추적 및 cleanup
 * - spawn된 모든 프로세스 PID 추적
 * - 부모 프로세스 종료 시 자식 프로세스 강제 종료
 * - orphan process 방지
 * - 프로세스 트리 전체 cleanup
 */

import { ChildProcess, spawn, exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

interface ManagedProcess {
  pid: number;
  command: string;
  startTime: Date;
  type: "spawn" | "exec" | "fork";
  parentPid: number;
}

export class ProcessLifecycleManager {
  private static instance: ProcessLifecycleManager;
  private managedProcesses = new Map<number, ManagedProcess>();
  private cleanupInProgress = false;

  private constructor() {
    this.setupCleanupHandlers();
    console.log("🔄 [ProcessLifecycle] Manager initialized");
  }

  static getInstance(): ProcessLifecycleManager {
    if (!ProcessLifecycleManager.instance) {
      ProcessLifecycleManager.instance = new ProcessLifecycleManager();
    }
    return ProcessLifecycleManager.instance;
  }

  /**
   * Spawn a managed child process
   */
  spawnManaged(
    command: string,
    args: string[] = [],
    options: any = {},
  ): ChildProcess {
    const child = spawn(command, args, {
      ...options,
      // Ensure process group for cleanup
      detached: false,
    });

    if (child.pid) {
      this.managedProcesses.set(child.pid, {
        pid: child.pid,
        command: `${command} ${args.join(" ")}`,
        startTime: new Date(),
        type: "spawn",
        parentPid: process.pid,
      });

      console.log(
        `🔄 [ProcessLifecycle] Registered process ${child.pid}: ${command}`,
      );

      // Auto-unregister on exit
      child.on("exit", (code, signal) => {
        console.log(
          `🔄 [ProcessLifecycle] Process ${child.pid} exited (code: ${code}, signal: ${signal})`,
        );
        this.managedProcesses.delete(child.pid!);
      });
    }

    return child;
  }

  /**
   * Execute command and track
   */
  async execManaged(
    command: string,
    options: any = {},
  ): Promise<{ stdout: string; stderr: string }> {
    console.log(`🔄 [ProcessLifecycle] Executing: ${command}`);

    try {
      const result = await execAsync(command, options);
      return result;
    } catch (error: any) {
      // Log but don't throw to allow caller to handle
      console.error(
        `❌ [ProcessLifecycle] Command failed: ${command}`,
        error.message,
      );
      throw error;
    }
  }

  /**
   * Kill all managed processes
   */
  async killAllManagedProcesses(): Promise<void> {
    if (this.managedProcesses.size === 0) {
      console.log("🔄 [ProcessLifecycle] No managed processes to kill");
      return;
    }

    console.log(
      `🔄 [ProcessLifecycle] Killing ${this.managedProcesses.size} managed processes...`,
    );

    const killPromises = Array.from(this.managedProcesses.values()).map(
      async (proc) => {
        try {
          console.log(
            `🔄 [ProcessLifecycle] Killing ${proc.pid}: ${proc.command}`,
          );

          // Try graceful SIGTERM first
          process.kill(proc.pid, "SIGTERM");

          // Wait 2 seconds
          await this.sleep(2000);

          // Check if still alive, force SIGKILL
          try {
            process.kill(proc.pid, 0); // Check if exists
            console.log(
              `🔄 [ProcessLifecycle] Process ${proc.pid} still alive, sending SIGKILL`,
            );
            process.kill(proc.pid, "SIGKILL");
          } catch {
            // Already dead
            console.log(`🔄 [ProcessLifecycle] Process ${proc.pid} terminated`);
          }
        } catch (error: any) {
          if (error.code !== "ESRCH") {
            console.error(
              `❌ [ProcessLifecycle] Error killing ${proc.pid}:`,
              error.message,
            );
          }
        }
      },
    );

    await Promise.all(killPromises);
    this.managedProcesses.clear();
    console.log("✅ [ProcessLifecycle] All managed processes killed");
  }

  /**
   * Kill orphan node processes (nuclear option)
   */
  async killOrphanNodeProcesses(): Promise<void> {
    console.log("🔄 [ProcessLifecycle] Searching for orphan node processes...");

    try {
      const { stdout } = await execAsync(
        "ps aux | grep -E \"node|npm|vitest|tsx\" | grep -v grep | awk '{print $2}'",
      );
      const pids = stdout.trim().split("\n").filter(Boolean).map(Number);

      const orphans = pids.filter(
        (pid) => pid !== process.pid && !this.managedProcesses.has(pid),
      );

      if (orphans.length === 0) {
        console.log("✅ [ProcessLifecycle] No orphan processes found");
        return;
      }

      console.log(
        `⚠️ [ProcessLifecycle] Found ${
          orphans.length
        } orphan processes: ${orphans.join(", ")}`,
      );

      for (const pid of orphans) {
        try {
          console.log(`🔄 [ProcessLifecycle] Killing orphan process ${pid}`);
          process.kill(pid, "SIGKILL");
        } catch (error: any) {
          if (error.code !== "ESRCH" && error.code !== "EPERM") {
            console.error(
              `❌ [ProcessLifecycle] Error killing orphan ${pid}:`,
              error.message,
            );
          }
        }
      }

      console.log("✅ [ProcessLifecycle] Orphan cleanup complete");
    } catch (error: any) {
      console.error(
        "❌ [ProcessLifecycle] Orphan detection failed:",
        error.message,
      );
    }
  }

  /**
   * Get all managed process info
   */
  getManagedProcesses(): ManagedProcess[] {
    return Array.from(this.managedProcesses.values());
  }

  /**
   * Setup cleanup handlers
   */
  private setupCleanupHandlers(): void {
    const cleanup = async () => {
      if (this.cleanupInProgress) {
        return; // Prevent double cleanup
      }

      this.cleanupInProgress = true;
      console.log("\n🔄 [ProcessLifecycle] Starting cleanup...");

      await this.killAllManagedProcesses();

      this.cleanupInProgress = false;
    };

    // Handle various exit scenarios
    process.on("exit", () => {
      // Synchronous cleanup only
      console.log("🔄 [ProcessLifecycle] Process exiting");
    });

    process.on("SIGINT", async () => {
      console.log("\n🔄 [ProcessLifecycle] Received SIGINT");
      await cleanup();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      console.log("\n🔄 [ProcessLifecycle] Received SIGTERM");
      await cleanup();
      process.exit(0);
    });

    process.on("uncaughtException", async (error) => {
      console.error("🚨 [ProcessLifecycle] Uncaught exception:", error);
      await cleanup();
      process.exit(1);
    });

    process.on("unhandledRejection", async (reason) => {
      console.error("🚨 [ProcessLifecycle] Unhandled rejection:", reason);
      await cleanup();
      process.exit(1);
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const processLifecycleManager = ProcessLifecycleManager.getInstance();
