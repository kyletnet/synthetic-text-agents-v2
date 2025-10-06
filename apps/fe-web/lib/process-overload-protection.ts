#!/usr/bin/env node

/**
 * 🛡️ Process Overload Protection System
 *
 * Phase 6: Fail-Fast Governance 핵심 컴포넌트
 * - 백그라운드 프로세스 과다 방지
 * - 자동 프로세스 정리 및 제한
 * - 리소스 사용량 모니터링
 */

import { exec } from "child_process";
import { promisify } from "util";
import { circuitBreakerRegistry } from "./circuit-breaker";
import { backgroundTaskManager } from "./background-task-manager";

const execAsync = promisify(exec);

interface ProcessInfo {
  pid: number;
  command: string;
  cpu: string;
  memory: string;
  startTime: string;
}

interface ProcessStats {
  totalProcesses: number;
  devProcesses: number;
  zombieProcesses: number;
  highCpuProcesses: number;
  highMemoryProcesses: number;
}

export class ProcessOverloadProtection {
  private static instance: ProcessOverloadProtection;
  private maxDevProcesses = 3; // 최대 개발 프로세스 수
  private maxCpuThreshold = 80; // CPU 사용률 임계치 (%)
  private maxMemoryThreshold = 500; // 메모리 사용량 임계치 (MB)
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor() {
    console.log(
      "🛡️ [ProcessProtection] Process Overload Protection initialized",
    );
  }

  static getInstance(): ProcessOverloadProtection {
    if (!ProcessOverloadProtection.instance) {
      ProcessOverloadProtection.instance = new ProcessOverloadProtection();
    }
    return ProcessOverloadProtection.instance;
  }

  /**
   * 🔍 현재 개발 프로세스 감지
   */
  async detectDevProcesses(): Promise<ProcessInfo[]> {
    try {
      const { stdout } = await execAsync(
        `ps aux | grep -E "(next dev|npm.*dev|node.*dev)" | grep -v grep`,
      );
      const lines = stdout
        .trim()
        .split("\n")
        .filter((line) => line.trim());

      return lines.map((line) => {
        const parts = line.trim().split(/\s+/);
        return {
          pid: parseInt(parts[1]),
          command: parts.slice(10).join(" "),
          cpu: parts[2],
          memory: parts[3],
          startTime: parts[8],
        };
      });
    } catch (error) {
      // grep이 결과를 찾지 못하면 에러가 발생할 수 있음
      return [];
    }
  }

  /**
   * 📊 프로세스 통계 수집
   */
  async collectProcessStats(): Promise<ProcessStats> {
    const devProcesses = await this.detectDevProcesses();

    const highCpuProcesses = devProcesses.filter(
      (p) => parseFloat(p.cpu) > this.maxCpuThreshold,
    );
    const highMemoryProcesses = devProcesses.filter(
      (p) => parseFloat(p.memory) > this.maxMemoryThreshold,
    );

    return {
      totalProcesses: devProcesses.length,
      devProcesses: devProcesses.length,
      zombieProcesses: 0, // TODO: 좀비 프로세스 감지 구현
      highCpuProcesses: highCpuProcesses.length,
      highMemoryProcesses: highMemoryProcesses.length,
    };
  }

  /**
   * 🚨 과부하 상태 감지
   */
  async detectOverload(): Promise<{
    isOverloaded: boolean;
    reason: string;
    severity: "low" | "medium" | "high" | "critical";
  }> {
    const stats = await this.collectProcessStats();

    if (stats.devProcesses > this.maxDevProcesses * 3) {
      return {
        isOverloaded: true,
        reason: `Critical process overload: ${stats.devProcesses} dev processes (limit: ${this.maxDevProcesses})`,
        severity: "critical",
      };
    }

    if (stats.devProcesses > this.maxDevProcesses * 2) {
      return {
        isOverloaded: true,
        reason: `High process overload: ${stats.devProcesses} dev processes (limit: ${this.maxDevProcesses})`,
        severity: "high",
      };
    }

    if (stats.devProcesses > this.maxDevProcesses) {
      return {
        isOverloaded: true,
        reason: `Process overload detected: ${stats.devProcesses} dev processes (limit: ${this.maxDevProcesses})`,
        severity: "medium",
      };
    }

    if (stats.highCpuProcesses > 2) {
      return {
        isOverloaded: true,
        reason: `High CPU usage: ${stats.highCpuProcesses} processes above ${this.maxCpuThreshold}%`,
        severity: "medium",
      };
    }

    return {
      isOverloaded: false,
      reason: "System within normal parameters",
      severity: "low",
    };
  }

  /**
   * 🧹 자동 프로세스 정리
   */
  async performAutomaticCleanup(): Promise<{
    success: boolean;
    cleaned: number;
    details: string[];
  }> {
    const cleanupDetails: string[] = [];
    let cleanedCount = 0;

    try {
      console.log(
        "🧹 [ProcessProtection] Starting automatic process cleanup...",
      );

      // Circuit Breaker 적용으로 정리 작업 보호
      const result = await circuitBreakerRegistry
        .get("process-cleanup", {
          failureThreshold: 2,
          timeoutWindow: 30000,
          halfOpenMaxAttempts: 1,
        })
        .execute(async () => {
          // 1. 오래된 dev 프로세스 정리
          const devProcesses = await this.detectDevProcesses();

          if (devProcesses.length > this.maxDevProcesses) {
            // 가장 오래된 프로세스들부터 정리
            const processesToKill = devProcesses
              .sort((a, b) => a.startTime.localeCompare(b.startTime))
              .slice(0, devProcesses.length - this.maxDevProcesses);

            for (const process of processesToKill) {
              try {
                await execAsync(`kill -TERM ${process.pid}`);
                cleanupDetails.push(
                  `Terminated process ${process.pid}: ${process.command}`,
                );
                cleanedCount++;

                // 1초 대기 후 강제 종료 확인
                await new Promise((resolve) => setTimeout(resolve, 1000));

                try {
                  await execAsync(`kill -0 ${process.pid}`);
                  // 프로세스가 여전히 살아있다면 강제 종료
                  await execAsync(`kill -KILL ${process.pid}`);
                  cleanupDetails.push(
                    `Force killed stubborn process ${process.pid}`,
                  );
                } catch {
                  // 프로세스가 정상적으로 종료됨
                }
              } catch (error) {
                cleanupDetails.push(
                  `Failed to kill process ${process.pid}: ${
                    error instanceof Error ? error.message : "Unknown error"
                  }`,
                );
              }
            }
          }

          // 2. 좀비 프로세스 정리
          try {
            await execAsync(
              `ps aux | awk '$8 ~ /^Z/ { print $2 }' | xargs -r kill -KILL`,
            );
            cleanupDetails.push("Cleaned up zombie processes");
          } catch {
            // 좀비 프로세스가 없거나 정리 실패
          }

          // 3. .next 캐시 정리 (포트 충돌 해결용)
          try {
            await execAsync("rm -rf .next");
            cleanupDetails.push("Cleared Next.js cache");
          } catch {
            // 캐시 정리 실패
          }

          return { cleanedCount, details: cleanupDetails };
        });

      console.log(
        `🧹 [ProcessProtection] Cleanup completed: ${result.cleanedCount} processes cleaned`,
      );

      return {
        success: true,
        cleaned: result.cleanedCount,
        details: result.details,
      };
    } catch (error) {
      console.error("🚨 [ProcessProtection] Cleanup failed:", error);
      return {
        success: false,
        cleaned: cleanedCount,
        details: [
          ...cleanupDetails,
          `Cleanup failed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        ],
      };
    }
  }

  /**
   * 🔄 실시간 모니터링 시작 (BackgroundTaskManager 사용)
   */
  startMonitoring(intervalMs: number = 60000): void {
    // Feature Flag 체크
    const monitoringEnabled =
      process.env.FEATURE_PROCESS_MONITORING_ENABLED !== "false";

    if (!monitoringEnabled) {
      console.log(
        "⏸️ [ProcessProtection] Process monitoring disabled by feature flag",
      );
      return;
    }

    console.log(
      `🔄 [ProcessProtection] Starting process monitoring (every ${
        intervalMs / 1000
      }s)`,
    );

    backgroundTaskManager.registerInterval(
      "process-overload-monitoring",
      async () => {
        const overloadStatus = await this.detectOverload();

        if (overloadStatus.isOverloaded) {
          console.log(
            `🚨 [ProcessProtection] ${overloadStatus.severity.toUpperCase()}: ${
              overloadStatus.reason
            }`,
          );

          if (
            overloadStatus.severity === "critical" ||
            overloadStatus.severity === "high"
          ) {
            console.log(
              "🧹 [ProcessProtection] Triggering automatic cleanup...",
            );
            await this.performAutomaticCleanup();
          }
        }
      },
      intervalMs,
      { enabled: true, replace: true },
    );
  }

  /**
   * ⏹️ 모니터링 중지 (BackgroundTaskManager 사용)
   */
  stopMonitoring(): void {
    backgroundTaskManager.unregister("process-overload-monitoring");
    console.log("⏹️ [ProcessProtection] Process monitoring stopped");
  }

  /**
   * 📊 현재 상태 보고
   */
  async getStatusReport(): Promise<{
    stats: ProcessStats;
    overload: Awaited<ReturnType<ProcessOverloadProtection["detectOverload"]>>;
    processes: ProcessInfo[];
  }> {
    const [stats, overload, processes] = await Promise.all([
      this.collectProcessStats(),
      this.detectOverload(),
      this.detectDevProcesses(),
    ]);

    return { stats, overload, processes };
  }
}

// 싱글톤 인스턴스 내보내기
export const processOverloadProtection =
  ProcessOverloadProtection.getInstance();
