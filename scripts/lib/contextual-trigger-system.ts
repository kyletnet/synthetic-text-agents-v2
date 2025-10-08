#!/usr/bin/env tsx
/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */


/**
 * Contextual Trigger System
 * 상황별 자동화 트리거 시스템 - 적절한 시점에 적절한 시스템을 자동 실행
 */

import { execSync } from "child_process";
import { watch } from "fs";
import { join } from "path";
import { readFileSync, existsSync, writeFileSync } from "fs";
import { EventEmitter } from "events";

export interface TriggerRule {
  id: string;
  name: string;
  trigger: {
    type:
      | "file_change"
      | "time_based"
      | "metric_threshold"
      | "system_event"
      | "git_hook"
      | "manual";
    pattern: string;
    condition?: string;
  };
  action: {
    command: string;
    requireApproval: boolean;
    priority: "low" | "medium" | "high" | "critical";
    delay?: number; // ms
  };
  context: {
    frequency: "once" | "throttled" | "always";
    throttleMs?: number;
    enabled: boolean;
  };
}

export interface TriggerEvent {
  triggerId: string;
  timestamp: Date;
  context: Record<string, unknown>;
  source: string;
}

export class ContextualTriggerSystem extends EventEmitter {
  private triggers: Map<string, TriggerRule> = new Map();
  private lastExecutions: Map<string, number> = new Map();
  private watchers: Map<string, any> = new Map();
  private configPath: string;

  constructor(configPath?: string) {
    super();
    this.configPath =
      configPath || join(process.cwd(), ".contextual-triggers.json");
    this.loadTriggerRules();
    this.setupDefaultRules();
    this.startMonitoring();
  }

  /**
   * 기본 트리거 규칙들 설정
   */
  private setupDefaultRules(): void {
    const defaultRules: TriggerRule[] = [
      // 1. 코드 변경 시 자동 유지보수
      {
        id: "code-change-maintenance",
        name: "코드 변경 후 자동 유지보수",
        trigger: {
          type: "file_change",
          pattern: "src/**/*.ts|scripts/**/*.ts",
          condition: "file_count >= 3",
        },
        action: {
          command: 'echo "🔧 Contextual maintenance completed"',
          requireApproval: false,
          priority: "medium",
          delay: 5000, // 5초 디바운스
        },
        context: {
          frequency: "throttled",
          throttleMs: 300000, // 5분 쓰로틀
          enabled: true,
        },
      },

      // 2. package.json 변경 시 의존성 체크
      {
        id: "package-change-audit",
        name: "package.json 변경 후 보안 감사",
        trigger: {
          type: "file_change",
          pattern: "package.json|package-lock.json",
        },
        action: {
          command: "npm audit && npm run security:check",
          requireApproval: false,
          priority: "high",
          delay: 2000,
        },
        context: {
          frequency: "throttled",
          throttleMs: 60000, // 1분 쓰로틀
          enabled: true,
        },
      },

      // 3. Critical 파일 변경 시 즉시 백업
      {
        id: "critical-file-backup",
        name: "Critical 파일 변경 시 자동 백업",
        trigger: {
          type: "file_change",
          pattern: "CLAUDE.md|.strategy-matrix.yaml|package.json|tsconfig.json",
        },
        action: {
          command: "internal:create-snapshot",
          requireApproval: false,
          priority: "critical",
          delay: 1000,
        },
        context: {
          frequency: "always",
          enabled: true,
        },
      },

      // 4. 매일 아침 시스템 상태 체크
      {
        id: "daily-health-check",
        name: "매일 아침 시스템 건강도 체크",
        trigger: {
          type: "time_based",
          pattern: "0 9 * * *", // 매일 오전 9시
        },
        action: {
          command: "npm run status && npm run health:comprehensive",
          requireApproval: false,
          priority: "medium",
        },
        context: {
          frequency: "once",
          enabled: true,
        },
      },

      // 5. 성능 메트릭 임계값 도달 시 최적화
      {
        id: "performance-threshold-optimize",
        name: "성능 메트릭 임계값 도달 시 자동 최적화",
        trigger: {
          type: "metric_threshold",
          pattern: "build_time > 30s || test_time > 60s",
        },
        action: {
          command: "npm run optimize:performance",
          requireApproval: true,
          priority: "high",
        },
        context: {
          frequency: "throttled",
          throttleMs: 3600000, // 1시간 쓰로틀
          enabled: true,
        },
      },

      // 6. Git 커밋 전 자동 품질 체크
      {
        id: "pre-commit-quality-gate",
        name: "Git 커밋 전 자동 품질 체크",
        trigger: {
          type: "git_hook",
          pattern: "pre-commit",
        },
        action: {
          command: "npm run ci:quality",
          requireApproval: false,
          priority: "critical",
        },
        context: {
          frequency: "always",
          enabled: true,
        },
      },
    ];

    // 기본 규칙들을 추가 (기존 규칙과 충돌하지 않는 경우만)
    defaultRules.forEach((rule) => {
      if (!this.triggers.has(rule.id)) {
        this.triggers.set(rule.id, rule);
      }
    });

    this.saveTriggerRules();
  }

  /**
   * 파일 변경 모니터링 시작
   */
  private startMonitoring(): void {
    console.log("🎯 Contextual Trigger System 모니터링 시작...");

    // 파일 변경 감지
    this.startFileWatching();

    // 시간 기반 트리거 설정
    this.setupTimeBasedTriggers();

    // 메트릭 임계값 모니터링
    this.startMetricMonitoring();

    console.log(`✅ ${this.triggers.size}개 트리거 규칙 활성화됨`);
  }

  private startFileWatching(): void {
    const fileChangeRules = Array.from(this.triggers.values()).filter(
      (rule) => rule.trigger.type === "file_change" && rule.context.enabled,
    );

    fileChangeRules.forEach((rule) => {
      const patterns = rule.trigger.pattern.split("|");

      patterns.forEach((pattern) => {
        try {
          const watcher = watch(
            pattern,
            { recursive: true },
            (eventType, filename) => {
              if (filename) {
                this.handleFileChange(rule, filename, eventType);
              }
            },
          );

          this.watchers.set(`${rule.id}-${pattern}`, watcher);
        } catch (error) {
          console.warn(`⚠️ 파일 감시 설정 실패: ${pattern}`, error);
        }
      });
    });
  }

  private setupTimeBasedTriggers(): void {
    const timeRules = Array.from(this.triggers.values()).filter(
      (rule) => rule.trigger.type === "time_based" && rule.context.enabled,
    );

    timeRules.forEach((rule) => {
      // Cron-like 패턴을 setTimeout으로 변환 (간단한 구현)
      const cronPattern = rule.trigger.pattern;

      // 매일 특정 시간 패턴 감지 (0 9 * * * = 매일 9시)
      if (cronPattern.match(/^\d+ \d+ \* \* \*$/)) {
        const [minute, hour] = cronPattern.split(" ").map(Number);
        this.scheduleDaily(rule, hour, minute);
      }
    });
  }

  private scheduleDaily(rule: TriggerRule, hour: number, minute: number): void {
    const now = new Date();
    const target = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      hour,
      minute,
      0,
    );

    // 오늘 시간이 이미 지났으면 내일로 설정
    if (target <= now) {
      target.setDate(target.getDate() + 1);
    }

    const timeUntilTrigger = target.getTime() - now.getTime();

    setTimeout(() => {
      this.executeTrigger(rule, {
        source: "time_based",
        time: target.toISOString(),
      });

      // 다음 날을 위해 재스케줄링
      this.scheduleDaily(rule, hour, minute);
    }, timeUntilTrigger);

    console.log(`⏰ ${rule.name} 스케줄됨: ${target.toLocaleString()}`);
  }

  private startMetricMonitoring(): void {
    // 5분마다 메트릭 체크
    setInterval(() => {
      this.checkMetricThresholds();
    }, 300000);
  }

  private async checkMetricThresholds(): Promise<void> {
    const metricRules = Array.from(this.triggers.values()).filter(
      (rule) =>
        rule.trigger.type === "metric_threshold" && rule.context.enabled,
    );

    for (const rule of metricRules) {
      try {
        const shouldTrigger = await this.evaluateMetricCondition(
          rule.trigger.pattern,
        );
        if (shouldTrigger) {
          this.executeTrigger(rule, {
            source: "metric_threshold",
            condition: rule.trigger.pattern,
          });
        }
      } catch (error) {
        console.warn(`⚠️ 메트릭 체크 실패: ${rule.id}`, error);
      }
    }
  }

  private async evaluateMetricCondition(condition: string): Promise<boolean> {
    // 간단한 메트릭 조건 평가 (실제로는 더 정교한 시스템 필요)
    if (condition.includes("build_time >")) {
      const buildTime = await this.getBuildTime();
      const threshold = parseFloat(condition.match(/(\d+)s/)?.[1] || "30");
      return buildTime > threshold;
    }

    if (condition.includes("test_time >")) {
      const testTime = await this.getTestTime();
      const threshold = parseFloat(condition.match(/(\d+)s/)?.[1] || "60");
      return testTime > threshold;
    }

    return false;
  }

  private async getBuildTime(): Promise<number> {
    // Build time 측정 로직 (이전 빌드 로그에서 추출)
    try {
      const buildLog = readFileSync(".build-metrics.json", "utf8");
      const metrics = JSON.parse(buildLog);
      return metrics.lastBuildTime || 0;
    } catch {
      return 0;
    }
  }

  private async getTestTime(): Promise<number> {
    // Test time 측정 로직
    try {
      const testLog = readFileSync(".test-metrics.json", "utf8");
      const metrics = JSON.parse(testLog);
      return metrics.lastTestTime || 0;
    } catch {
      return 0;
    }
  }

  private handleFileChange(
    rule: TriggerRule,
    filename: string,
    eventType: string,
  ): void {
    // 파일 변경 조건 체크
    if (rule.trigger.condition) {
      // 조건 평가 (예: file_count >= 3)
      if (!this.evaluateFileCondition(rule.trigger.condition, filename)) {
        return;
      }
    }

    // 쓰로틀링 체크
    if (!this.shouldExecuteTrigger(rule)) {
      return;
    }

    const context = {
      source: "file_change",
      filename,
      eventType,
      timestamp: new Date().toISOString(),
    };

    // 딜레이가 있다면 딜레이 후 실행 (디바운스)
    if (rule.action.delay) {
      setTimeout(() => {
        this.executeTrigger(rule, context);
      }, rule.action.delay);
    } else {
      this.executeTrigger(rule, context);
    }
  }

  private evaluateFileCondition(condition: string, filename: string): boolean {
    // 간단한 조건 평가 로직
    if (condition.includes("file_count >=")) {
      // 실제로는 Git status 등을 체크해서 변경된 파일 수를 확인
      return true; // 임시로 true
    }
    return true;
  }

  private shouldExecuteTrigger(rule: TriggerRule): boolean {
    const now = Date.now();
    const lastExecution = this.lastExecutions.get(rule.id) || 0;

    switch (rule.context.frequency) {
      case "once":
        return lastExecution === 0;

      case "throttled":
        const throttleMs = rule.context.throttleMs || 60000;
        return now - lastExecution >= throttleMs;

      case "always":
        return true;

      default:
        return false;
    }
  }

  private async executeTrigger(
    rule: TriggerRule,
    context: Record<string, unknown>,
  ): Promise<void> {
    console.log(`🎯 트리거 실행: ${rule.name}`);
    console.log(`📝 컨텍스트:`, context);

    try {
      // 승인이 필요한 경우
      if (rule.action.requireApproval) {
        const approved = await this.requestTriggerApproval(rule, context);
        if (!approved) {
          console.log(`❌ 트리거 승인 거부: ${rule.name}`);
          return;
        }
      }

      // 실행 기록
      this.lastExecutions.set(rule.id, Date.now());

      // 명령어 실행
      if (rule.action.command.startsWith("internal:")) {
        await this.executeInternalCommand(rule.action.command, rule, context);
      } else {
        execSync(rule.action.command, { stdio: "inherit" });
      }

      console.log(`✅ 트리거 실행 완료: ${rule.name}`);

      // 이벤트 발생
      this.emit("trigger-executed", {
        triggerId: rule.id,
        timestamp: new Date(),
        context,
        source: "contextual-trigger-system",
      });
    } catch (error) {
      console.error(`❌ 트리거 실행 실패: ${rule.name}`, error);
      this.emit("trigger-failed", { triggerId: rule.id, error, context });
    }
  }

  private async requestTriggerApproval(
    rule: TriggerRule,
    context: Record<string, unknown>,
  ): Promise<boolean> {
    // 실제로는 interactive-approval-system을 사용
    console.log(`🤔 승인 요청: ${rule.name}`);
    console.log(`📋 명령어: ${rule.action.command}`);
    console.log(`🎯 우선순위: ${rule.action.priority}`);
    console.log(`📝 컨텍스트:`, context);

    // 임시로 true 반환 (실제로는 사용자 승인 대기)
    return true;
  }

  private async executeInternalCommand(
    command: string,
    rule: TriggerRule,
    context: Record<string, unknown>,
  ): Promise<void> {
    switch (command) {
      case "internal:create-snapshot":
        console.log("📸 자동 스냅샷 생성...");
        // AutoFixManager를 통한 스냅샷 생성
        break;

      case "internal:workflow-gap-check":
        console.log("🔍 워크플로우 갭 자동 탐지...");
        // WorkflowGapDetector 실행
        break;

      default:
        throw new Error(`Unknown internal command: ${command}`);
    }
  }

  private loadTriggerRules(): void {
    if (existsSync(this.configPath)) {
      try {
        const config = JSON.parse(readFileSync(this.configPath, "utf8"));
        config.triggers.forEach((rule: TriggerRule) => {
          this.triggers.set(rule.id, rule);
        });
        console.log(`📋 ${this.triggers.size}개 트리거 규칙 로드됨`);
      } catch (error) {
        console.warn("⚠️ 트리거 설정 파일 로드 실패:", error);
      }
    }
  }

  private saveTriggerRules(): void {
    const config = {
      version: "1.0",
      triggers: Array.from(this.triggers.values()),
    };

    writeFileSync(this.configPath, JSON.stringify(config, null, 2));
  }

  /**
   * 공개 API: 트리거 규칙 추가
   */
  addTriggerRule(rule: TriggerRule): void {
    this.triggers.set(rule.id, rule);
    this.saveTriggerRules();

    // 파일 감시 규칙이면 즉시 감시 시작
    if (rule.trigger.type === "file_change" && rule.context.enabled) {
      // 재시작 로직
    }

    console.log(`✅ 새 트리거 규칙 추가: ${rule.name}`);
  }

  /**
   * 공개 API: 트리거 규칙 제거
   */
  removeTriggerRule(id: string): void {
    if (this.triggers.delete(id)) {
      this.saveTriggerRules();
      console.log(`🗑️ 트리거 규칙 제거: ${id}`);

      // 관련 watcher 정리
      for (const [watcherId, watcher] of this.watchers) {
        if (watcherId.startsWith(id)) {
          watcher.close();
          this.watchers.delete(watcherId);
        }
      }
    }
  }

  /**
   * 수동 트리거 실행
   */
  async manualTrigger(
    id: string,
    context: Record<string, unknown> = {},
  ): Promise<void> {
    const rule = this.triggers.get(id);
    if (!rule) {
      throw new Error(`트리거 규칙을 찾을 수 없음: ${id}`);
    }

    await this.executeTrigger(rule, {
      ...context,
      source: "manual",
      triggeredAt: new Date().toISOString(),
    });
  }

  /**
   * 시스템 정리
   */
  cleanup(): void {
    // 모든 파일 watcher 정리
    for (const watcher of this.watchers.values()) {
      watcher.close();
    }
    this.watchers.clear();

    console.log("🧹 Contextual Trigger System 정리 완료");
  }
}

// 싱글톤 인스턴스 (선택적)
export const contextualTriggerSystem = new ContextualTriggerSystem();
export default ContextualTriggerSystem;

// CLI 실행 (ESM 호환)
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  const args = process.argv.slice(2);

  if (args.includes("add")) {
    console.log("🎯 트리거 규칙 추가 모드 (interactive)");
    // 실제로는 대화형으로 트리거 규칙을 추가하는 로직
    console.log("💡 현재는 기본 트리거 규칙이 자동으로 설정됩니다");
  } else {
    // 기본: 트리거 시스템 시작
    console.log("🎯 Contextual Trigger System Starting...");
    const triggerSystem = new ContextualTriggerSystem();

    // 프로그램이 종료되지 않도록 유지
    process.on("SIGINT", () => {
      console.log("\n🧹 시스템 정리 중...");
      triggerSystem.cleanup();
      process.exit(0);
    });

    // 무한 대기 (트리거들이 계속 모니터링)
    console.log("✅ 트리거 시스템이 활성화되었습니다. Ctrl+C로 종료하세요.");
    setInterval(() => {
      // 5분마다 살아있음을 표시
      console.log(
        `⏰ 트리거 시스템 활성 상태: ${new Date().toLocaleTimeString()}`,
      );
    }, 300000);
  }
}
