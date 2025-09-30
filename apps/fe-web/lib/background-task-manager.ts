/**
 * 🔄 Background Task Manager - 중앙 집중식 백그라운드 작업 관리
 *
 * Phase 6 근본 개선: 프로세스 누수 방지
 * - 모든 setInterval/setTimeout을 중앙 등록
 * - 중복 방지 및 안전한 cleanup 보장
 * - HMR 재시작 시 자동 정리
 */

interface TaskConfig {
  id: string;
  type: "interval" | "timeout";
  handler: () => Promise<void> | void;
  delay: number;
  startTime: Date;
  executionCount: number;
  lastError?: string;
  enabled: boolean;
}

interface TaskStats {
  totalTasks: number;
  activeTasks: number;
  disabledTasks: number;
  totalExecutions: number;
  failedExecutions: number;
}

/**
 * 🎯 Background Task Manager - 싱글톤
 */
export class BackgroundTaskManager {
  private static instance: BackgroundTaskManager;
  private tasks = new Map<string, NodeJS.Timeout>();
  private taskConfigs = new Map<string, TaskConfig>();
  private globalEnabled = true;
  private maxConcurrentTasks = 10;

  private constructor() {
    // HMR cleanup 설정
    if (
      typeof window === "undefined" &&
      process.env.NODE_ENV === "development"
    ) {
      // @ts-ignore - Next.js HMR API
      if (module.hot) {
        // @ts-ignore
        module.hot.dispose(() => {
          console.log("🔄 [BackgroundTaskManager] HMR cleanup triggered");
          this.cleanup();
        });
      }
    }

    // 프로세스 종료 시 cleanup
    if (typeof process !== "undefined") {
      const cleanupHandler = () => {
        console.log("🔄 [BackgroundTaskManager] Process exit cleanup");
        this.cleanup();
      };

      process.on("exit", cleanupHandler);
      process.on("SIGINT", cleanupHandler);
      process.on("SIGTERM", cleanupHandler);
      process.on("uncaughtException", (error) => {
        console.error("🚨 [BackgroundTaskManager] Uncaught exception:", error);
        this.cleanup();
      });
    }

    console.log("🔄 [BackgroundTaskManager] Initialized");
  }

  static getInstance(): BackgroundTaskManager {
    if (!BackgroundTaskManager.instance) {
      BackgroundTaskManager.instance = new BackgroundTaskManager();
    }
    return BackgroundTaskManager.instance;
  }

  /**
   * 🎯 Interval 작업 등록
   */
  registerInterval(
    id: string,
    handler: () => Promise<void> | void,
    intervalMs: number,
    options?: { enabled?: boolean; replace?: boolean },
  ): boolean {
    // 중복 방지
    if (this.tasks.has(id)) {
      if (options?.replace) {
        console.log(
          `🔄 [BackgroundTaskManager] Replacing existing task: ${id}`,
        );
        this.unregister(id);
      } else {
        console.warn(`⚠️ [BackgroundTaskManager] Task already exists: ${id}`);
        return false;
      }
    }

    // 최대 작업 수 체크
    if (this.tasks.size >= this.maxConcurrentTasks) {
      console.error(
        `🚨 [BackgroundTaskManager] Max concurrent tasks reached (${this.maxConcurrentTasks})`,
      );
      return false;
    }

    // 글로벌 비활성화 체크
    if (!this.globalEnabled) {
      console.log(
        `⏸️ [BackgroundTaskManager] Global disabled - task ${id} not started`,
      );
      return false;
    }

    const enabled = options?.enabled !== false;

    // Task config 저장
    const config: TaskConfig = {
      id,
      type: "interval",
      handler,
      delay: intervalMs,
      startTime: new Date(),
      executionCount: 0,
      enabled,
    };

    this.taskConfigs.set(id, config);

    if (!enabled) {
      console.log(
        `⏸️ [BackgroundTaskManager] Task ${id} registered but disabled`,
      );
      return true;
    }

    // Wrapper로 에러 처리 및 통계 수집
    const wrappedHandler = async () => {
      if (!this.globalEnabled || !config.enabled) {
        return;
      }

      try {
        config.executionCount++;
        await handler();
      } catch (error) {
        config.lastError =
          error instanceof Error ? error.message : "Unknown error";
        console.error(`🚨 [BackgroundTaskManager] Task ${id} failed:`, error);
      }
    };

    // setInterval 등록
    const handle = setInterval(wrappedHandler, intervalMs);
    this.tasks.set(id, handle);

    console.log(
      `✅ [BackgroundTaskManager] Interval registered: ${id} (${intervalMs}ms)`,
    );
    return true;
  }

  /**
   * 🎯 Timeout 작업 등록
   */
  registerTimeout(
    id: string,
    handler: () => Promise<void> | void,
    delayMs: number,
  ): boolean {
    if (this.tasks.has(id)) {
      console.warn(`⚠️ [BackgroundTaskManager] Task already exists: ${id}`);
      return false;
    }

    if (!this.globalEnabled) {
      console.log(
        `⏸️ [BackgroundTaskManager] Global disabled - task ${id} not started`,
      );
      return false;
    }

    const config: TaskConfig = {
      id,
      type: "timeout",
      handler,
      delay: delayMs,
      startTime: new Date(),
      executionCount: 0,
      enabled: true,
    };

    this.taskConfigs.set(id, config);

    const wrappedHandler = async () => {
      try {
        config.executionCount++;
        await handler();
      } catch (error) {
        config.lastError =
          error instanceof Error ? error.message : "Unknown error";
        console.error(`🚨 [BackgroundTaskManager] Task ${id} failed:`, error);
      } finally {
        // Timeout은 한 번 실행 후 자동 정리
        this.tasks.delete(id);
        this.taskConfigs.delete(id);
      }
    };

    const handle = setTimeout(wrappedHandler, delayMs);
    this.tasks.set(id, handle);

    console.log(
      `✅ [BackgroundTaskManager] Timeout registered: ${id} (${delayMs}ms)`,
    );
    return true;
  }

  /**
   * 🗑️ 특정 작업 해제
   */
  unregister(id: string): boolean {
    const handle = this.tasks.get(id);
    const config = this.taskConfigs.get(id);

    if (!handle || !config) {
      return false;
    }

    if (config.type === "interval") {
      clearInterval(handle);
    } else {
      clearTimeout(handle);
    }

    this.tasks.delete(id);
    this.taskConfigs.delete(id);

    console.log(`🗑️ [BackgroundTaskManager] Task unregistered: ${id}`);
    return true;
  }

  /**
   * 🧹 모든 작업 정리
   */
  cleanup(): void {
    console.log(
      `🧹 [BackgroundTaskManager] Cleaning up ${this.tasks.size} tasks...`,
    );

    const taskEntries = Array.from(this.tasks.entries());
    for (const [id, handle] of taskEntries) {
      const config = this.taskConfigs.get(id);

      if (config?.type === "interval") {
        clearInterval(handle);
      } else {
        clearTimeout(handle);
      }
    }

    this.tasks.clear();
    this.taskConfigs.clear();

    console.log("✅ [BackgroundTaskManager] Cleanup completed");
  }

  /**
   * ⏸️ 전역 일시정지
   */
  pauseAll(): void {
    this.globalEnabled = false;
    console.log("⏸️ [BackgroundTaskManager] All tasks paused");
  }

  /**
   * ▶️ 전역 재개
   */
  resumeAll(): void {
    this.globalEnabled = true;
    console.log("▶️ [BackgroundTaskManager] All tasks resumed");
  }

  /**
   * ⏸️ 특정 작업 일시정지
   */
  pauseTask(id: string): boolean {
    const config = this.taskConfigs.get(id);
    if (!config) {
      return false;
    }

    config.enabled = false;
    console.log(`⏸️ [BackgroundTaskManager] Task paused: ${id}`);
    return true;
  }

  /**
   * ▶️ 특정 작업 재개
   */
  resumeTask(id: string): boolean {
    const config = this.taskConfigs.get(id);
    if (!config) {
      return false;
    }

    config.enabled = true;
    console.log(`▶️ [BackgroundTaskManager] Task resumed: ${id}`);
    return true;
  }

  /**
   * 🔍 패턴 매칭으로 작업 취소 (e.g., "healing-alert-*")
   */
  cancelTasksByPattern(pattern: string): number {
    let canceledCount = 0;
    const regex = new RegExp(pattern.replace("*", ".*"));

    // Convert to array to avoid iterator issues
    const taskEntries = Array.from(this.tasks.entries());

    for (const [id, timeout] of taskEntries) {
      if (regex.test(id)) {
        clearTimeout(timeout);
        this.tasks.delete(id);
        this.taskConfigs.delete(id);
        canceledCount++;
      }
    }

    if (canceledCount > 0) {
      console.log(
        `🗑️ [BackgroundTaskManager] Canceled ${canceledCount} tasks matching pattern: ${pattern}`,
      );
    }

    return canceledCount;
  }

  /**
   * 📊 통계 조회
   */
  getStats(): TaskStats {
    const configs = Array.from(this.taskConfigs.values());

    return {
      totalTasks: this.tasks.size,
      activeTasks: configs.filter((c) => c.enabled).length,
      disabledTasks: configs.filter((c) => !c.enabled).length,
      totalExecutions: configs.reduce((sum, c) => sum + c.executionCount, 0),
      failedExecutions: configs.filter((c) => c.lastError).length,
    };
  }

  /**
   * 🔍 작업 목록 조회
   */
  listTasks(): Array<{
    id: string;
    type: string;
    delay: number;
    executionCount: number;
    enabled: boolean;
    uptime: number;
    lastError?: string;
  }> {
    return Array.from(this.taskConfigs.values()).map((config) => ({
      id: config.id,
      type: config.type,
      delay: config.delay,
      executionCount: config.executionCount,
      enabled: config.enabled,
      uptime: Date.now() - config.startTime.getTime(),
      lastError: config.lastError,
    }));
  }

  /**
   * 🚨 비상 정지 (모든 작업 강제 중단)
   */
  emergencyShutdown(): void {
    console.error("🚨 [BackgroundTaskManager] EMERGENCY SHUTDOWN");
    this.pauseAll();
    this.cleanup();
  }
}

// 싱글톤 인스턴스 export
export const backgroundTaskManager = BackgroundTaskManager.getInstance();

console.log("🔄 [BackgroundTaskManager] Module loaded");
