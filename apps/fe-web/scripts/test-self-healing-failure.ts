#!/usr/bin/env ts-node

/**
 * 🧪 Self-Healing Engine 실패 시나리오 통합 테스트
 *
 * 검증 사항:
 * 1. API key 없을 때 10번 실패 후 Dormant Mode 진입
 * 2. Circuit Breaker PERMANENT_OPEN 상태 전환
 * 3. Background Task 정리 및 중복 방지
 * 4. Exponential Backoff 동작
 * 5. 수동 복구 후 정상 동작
 */

import { selfHealingEngine } from "../lib/self-healing-engine";
import { circuitBreakerRegistry } from "../lib/circuit-breaker";
import { backgroundTaskManager } from "../lib/background-task-manager";
import { apiKeyManager } from "../lib/api-key-manager";

interface TestResult {
  testName: string;
  passed: boolean;
  duration: number;
  details: string;
  error?: string;
}

class SelfHealingTestSuite {
  private results: TestResult[] = [];
  private originalApiKey: string | undefined;

  /**
   * 🎯 Test Suite 실행
   */
  async run(): Promise<void> {
    console.log("🧪 ========================================");
    console.log("🧪 Self-Healing Engine 통합 테스트 시작");
    console.log("🧪 ========================================\n");

    // 원본 API Key 백업
    this.originalApiKey = process.env.ANTHROPIC_API_KEY;

    try {
      await this.test1_InitialState();
      await this.test2_APIKeyRemoval();
      await this.test3_ConsecutiveFailures();
      await this.test4_DormantModeEntry();
      await this.test5_CircuitBreakerPermanentOpen();
      await this.test6_BackgroundTaskManagement();
      await this.test7_ManualRecovery();
      await this.test8_ExponentialBackoff();
    } catch (error) {
      console.error("❌ Test suite failed:", error);
    } finally {
      // API Key 복원
      if (this.originalApiKey) {
        process.env.ANTHROPIC_API_KEY = this.originalApiKey;
      }

      this.printSummary();
    }
  }

  /**
   * Test 1: 초기 상태 확인
   */
  private async test1_InitialState(): Promise<void> {
    const startTime = Date.now();
    const testName = "Test 1: Initial State Verification";

    try {
      console.log(`\n🔵 ${testName}`);

      const stats = selfHealingEngine.getHealingStats();
      const dormantStatus = selfHealingEngine.getDormantStatus();
      const breakerStatus = circuitBreakerRegistry.getStatus();

      // 검증
      const checks = [
        { name: "Not in dormant mode", passed: !stats.isDormant },
        {
          name: "No consecutive failures",
          passed: stats.consecutiveFailures === 0,
        },
        {
          name: "Circuit breakers healthy",
          passed: breakerStatus.every((s) => !s.includes("OPEN")),
        },
      ];

      const allPassed = checks.every((c) => c.passed);

      checks.forEach((check) => {
        console.log(`  ${check.passed ? "✅" : "❌"} ${check.name}`);
      });

      this.results.push({
        testName,
        passed: allPassed,
        duration: Date.now() - startTime,
        details: `System in ${
          allPassed ? "healthy" : "unhealthy"
        } initial state`,
      });

      console.log(allPassed ? "✅ PASSED" : "❌ FAILED");
    } catch (error) {
      this.results.push({
        testName,
        passed: false,
        duration: Date.now() - startTime,
        details: "Exception during test",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      console.log("❌ FAILED");
    }
  }

  /**
   * Test 2: API Key 제거 시뮬레이션
   */
  private async test2_APIKeyRemoval(): Promise<void> {
    const startTime = Date.now();
    const testName = "Test 2: API Key Removal Simulation";

    try {
      console.log(`\n🔵 ${testName}`);

      // API Key 제거
      delete process.env.ANTHROPIC_API_KEY;
      console.log("  📝 Removed ANTHROPIC_API_KEY");

      // API Key Manager 상태 확인
      const keyStats = apiKeyManager.getStats();

      const passed = keyStats.activeKeys === 0;

      console.log(
        `  ${passed ? "✅" : "❌"} API keys removed (active: ${
          keyStats.activeKeys
        })`,
      );

      this.results.push({
        testName,
        passed,
        duration: Date.now() - startTime,
        details: `Active keys: ${keyStats.activeKeys}`,
      });

      console.log(passed ? "✅ PASSED" : "❌ FAILED");
    } catch (error) {
      this.results.push({
        testName,
        passed: false,
        duration: Date.now() - startTime,
        details: "Exception during test",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      console.log("❌ FAILED");
    }
  }

  /**
   * Test 3: 연속 실패 시뮬레이션
   */
  private async test3_ConsecutiveFailures(): Promise<void> {
    const startTime = Date.now();
    const testName = "Test 3: Consecutive Failures Simulation";

    try {
      console.log(`\n🔵 ${testName}`);
      console.log(
        "  📝 Triggering 5 healing attempts (will fail due to no API key)...",
      );

      for (let i = 0; i < 5; i++) {
        try {
          await selfHealingEngine.manualHeal();
        } catch (error) {
          // 실패 예상됨
        }
        console.log(`  📝 Attempt ${i + 1}/5 completed`);

        // Backoff 시간 대기 (짧게)
        await this.sleep(100);
      }

      const stats = selfHealingEngine.getHealingStats();
      const passed = stats.consecutiveFailures >= 5;

      console.log(
        `  ${passed ? "✅" : "❌"} Consecutive failures: ${
          stats.consecutiveFailures
        }`,
      );

      this.results.push({
        testName,
        passed,
        duration: Date.now() - startTime,
        details: `Consecutive failures: ${stats.consecutiveFailures}/5`,
      });

      console.log(passed ? "✅ PASSED" : "❌ FAILED");
    } catch (error) {
      this.results.push({
        testName,
        passed: false,
        duration: Date.now() - startTime,
        details: "Exception during test",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      console.log("❌ FAILED");
    }
  }

  /**
   * Test 4: Dormant Mode 진입 확인
   */
  private async test4_DormantModeEntry(): Promise<void> {
    const startTime = Date.now();
    const testName = "Test 4: Dormant Mode Entry";

    try {
      console.log(`\n🔵 ${testName}`);
      console.log(
        "  📝 Triggering 5 more healing attempts to reach 10 failures...",
      );

      for (let i = 0; i < 5; i++) {
        try {
          await selfHealingEngine.manualHeal();
        } catch (error) {
          // 실패 예상됨
        }
        console.log(`  📝 Attempt ${i + 6}/10 completed`);
        await this.sleep(100);
      }

      const stats = selfHealingEngine.getHealingStats();
      const dormantStatus = selfHealingEngine.getDormantStatus();

      const passed = stats.isDormant && dormantStatus !== null;

      console.log(
        `  ${passed ? "✅" : "❌"} Dormant Mode: ${
          stats.isDormant ? "ACTIVE" : "INACTIVE"
        }`,
      );
      if (dormantStatus) {
        console.log(`  📝 Reason: ${dormantStatus.reason}`);
      }

      this.results.push({
        testName,
        passed,
        duration: Date.now() - startTime,
        details: `Dormant: ${stats.isDormant}, Failures: ${stats.consecutiveFailures}`,
      });

      console.log(passed ? "✅ PASSED" : "❌ FAILED");
    } catch (error) {
      this.results.push({
        testName,
        passed: false,
        duration: Date.now() - startTime,
        details: "Exception during test",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      console.log("❌ FAILED");
    }
  }

  /**
   * Test 5: Circuit Breaker PERMANENT_OPEN 확인
   */
  private async test5_CircuitBreakerPermanentOpen(): Promise<void> {
    const startTime = Date.now();
    const testName = "Test 5: Circuit Breaker PERMANENT_OPEN";

    try {
      console.log(`\n🔵 ${testName}`);

      const allBreakers = circuitBreakerRegistry.getAll();
      const healingBreaker = allBreakers.find((b) =>
        b.getStatus().includes("self-healing-main"),
      );

      if (!healingBreaker) {
        throw new Error("self-healing-main circuit breaker not found");
      }

      const state = healingBreaker.getState();
      const isPermanentOpen = healingBreaker.isPermanentlyOpen();

      console.log(
        `  ${isPermanentOpen ? "✅" : "❌"} Circuit breaker state: ${
          state.state
        }`,
      );
      if (state.permanentOpenReason) {
        console.log(`  📝 Reason: ${state.permanentOpenReason}`);
      }

      this.results.push({
        testName,
        passed: isPermanentOpen,
        duration: Date.now() - startTime,
        details: `State: ${state.state}, Failures: ${state.failureCount}`,
      });

      console.log(isPermanentOpen ? "✅ PASSED" : "❌ FAILED");
    } catch (error) {
      this.results.push({
        testName,
        passed: false,
        duration: Date.now() - startTime,
        details: "Exception during test",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      console.log("❌ FAILED");
    }
  }

  /**
   * Test 6: Background Task 관리 확인
   */
  private async test6_BackgroundTaskManagement(): Promise<void> {
    const startTime = Date.now();
    const testName = "Test 6: Background Task Management";

    try {
      console.log(`\n🔵 ${testName}`);

      const taskStats = backgroundTaskManager.getStats();
      const taskList = backgroundTaskManager.listTasks();

      console.log(`  📝 Total tasks: ${taskStats.totalTasks}`);
      console.log(`  📝 Active tasks: ${taskStats.activeTasks}`);
      console.log(`  📝 Disabled tasks: ${taskStats.disabledTasks}`);

      // 중복 task 체크
      const taskIds = taskList.map((t) => t.id);
      const uniqueIds = new Set(taskIds);
      const noDuplicates = taskIds.length === uniqueIds.size;

      // 최대 작업 수 체크
      const underLimit = taskStats.totalTasks <= 10;

      const passed = noDuplicates && underLimit;

      console.log(`  ${noDuplicates ? "✅" : "❌"} No duplicate tasks`);
      console.log(
        `  ${underLimit ? "✅" : "❌"} Under task limit (${
          taskStats.totalTasks
        }/10)`,
      );

      this.results.push({
        testName,
        passed,
        duration: Date.now() - startTime,
        details: `Tasks: ${taskStats.totalTasks}, Duplicates: ${!noDuplicates}`,
      });

      console.log(passed ? "✅ PASSED" : "❌ FAILED");
    } catch (error) {
      this.results.push({
        testName,
        passed: false,
        duration: Date.now() - startTime,
        details: "Exception during test",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      console.log("❌ FAILED");
    }
  }

  /**
   * Test 7: 수동 복구 검증
   */
  private async test7_ManualRecovery(): Promise<void> {
    const startTime = Date.now();
    const testName = "Test 7: Manual Recovery";

    try {
      console.log(`\n🔵 ${testName}`);

      // API Key 복원
      if (this.originalApiKey) {
        process.env.ANTHROPIC_API_KEY = this.originalApiKey;
        console.log("  📝 Restored ANTHROPIC_API_KEY");
      }

      // Dormant Mode에서 복구
      const resumed = selfHealingEngine.resumeFromDormant("Test recovery");
      console.log(`  ${resumed ? "✅" : "❌"} Resume from dormant: ${resumed}`);

      // 상태 확인
      const stats = selfHealingEngine.getHealingStats();
      const dormantStatus = selfHealingEngine.getDormantStatus();

      const passed = resumed && !stats.isDormant && dormantStatus === null;

      console.log(`  ${!stats.isDormant ? "✅" : "❌"} Dormant mode cleared`);
      console.log(
        `  ${stats.consecutiveFailures === 0 ? "✅" : "❌"} Failures reset: ${
          stats.consecutiveFailures
        }`,
      );

      this.results.push({
        testName,
        passed,
        duration: Date.now() - startTime,
        details: `Resumed: ${resumed}, Dormant: ${stats.isDormant}`,
      });

      console.log(passed ? "✅ PASSED" : "❌ FAILED");
    } catch (error) {
      this.results.push({
        testName,
        passed: false,
        duration: Date.now() - startTime,
        details: "Exception during test",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      console.log("❌ FAILED");
    }
  }

  /**
   * Test 8: Exponential Backoff 검증
   */
  private async test8_ExponentialBackoff(): Promise<void> {
    const startTime = Date.now();
    const testName = "Test 8: Exponential Backoff";

    try {
      console.log(`\n🔵 ${testName}`);

      const stats = selfHealingEngine.getHealingStats();
      const currentBackoff = stats.backoffDelay;

      console.log(`  📝 Current backoff delay: ${currentBackoff}ms`);

      // Backoff이 base 값으로 리셋되었는지 확인 (복구 후)
      const isReasonable = currentBackoff >= 5000 && currentBackoff <= 10000;

      console.log(
        `  ${
          isReasonable ? "✅" : "❌"
        } Backoff delay reasonable after recovery`,
      );

      this.results.push({
        testName,
        passed: isReasonable,
        duration: Date.now() - startTime,
        details: `Backoff: ${currentBackoff}ms`,
      });

      console.log(isReasonable ? "✅ PASSED" : "❌ FAILED");
    } catch (error) {
      this.results.push({
        testName,
        passed: false,
        duration: Date.now() - startTime,
        details: "Exception during test",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      console.log("❌ FAILED");
    }
  }

  /**
   * 🎯 테스트 결과 요약 출력
   */
  private printSummary(): void {
    console.log("\n\n🧪 ========================================");
    console.log("🧪 테스트 결과 요약");
    console.log("🧪 ========================================\n");

    const totalTests = this.results.length;
    const passedTests = this.results.filter((r) => r.passed).length;
    const failedTests = totalTests - passedTests;
    const successRate =
      totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;

    this.results.forEach((result, index) => {
      const status = result.passed ? "✅ PASS" : "❌ FAIL";
      console.log(`${index + 1}. ${status} - ${result.testName}`);
      console.log(`   Duration: ${result.duration}ms`);
      console.log(`   Details: ${result.details}`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
      console.log("");
    });

    console.log("========================================");
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${failedTests}`);
    console.log(`Success Rate: ${successRate}%`);
    console.log("========================================\n");

    if (failedTests === 0) {
      console.log("🎉 All tests passed!");
      process.exit(0);
    } else {
      console.log("❌ Some tests failed");
      process.exit(1);
    }
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Run tests
const testSuite = new SelfHealingTestSuite();
testSuite.run().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
