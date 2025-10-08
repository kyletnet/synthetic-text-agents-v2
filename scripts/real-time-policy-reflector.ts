#!/usr/bin/env tsx
/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */


import { watch } from "fs";
import { execSync } from "child_process";
import { existsSync, readFileSync } from "fs";

interface PolicyChangeEvent {
  timestamp: Date;
  filePath: string;
  changeType: "architecture" | "design-principles" | "integration-rules";
  autoApplied: boolean;
  impactedComponents: string[];
}

class RealTimePolicyReflector {
  private watchedFiles = [
    "ARCHITECTURE.md",
    "docs/ARCHITECTURE.md",
    "DESIGN_PRINCIPLES.md",
    ".claude/system-metadata.yaml",
  ];

  private isProcessing = false;

  constructor() {
    console.log("🔄 Real-Time Policy Reflector Starting...");
    this.initializeWatchers();
  }

  private initializeWatchers(): void {
    this.watchedFiles.forEach((filePath) => {
      if (existsSync(filePath)) {
        console.log(`👀 Watching: ${filePath}`);

        watch(filePath, { persistent: true }, (eventType, filename) => {
          if (eventType === "change" && !this.isProcessing) {
            this.handlePolicyChange(filePath);
          }
        });
      }
    });
  }

  private async handlePolicyChange(filePath: string): Promise<void> {
    this.isProcessing = true;

    console.log(`\n🔄 Policy Change Detected: ${filePath}`);
    console.log(`⏰ Timestamp: ${new Date().toISOString()}`);

    try {
      // 1. 변경된 정책 분석
      const changeType = this.determineChangeType(filePath);

      // 2. 영향받는 컴포넌트 식별
      const impactedComponents = await this.identifyImpactedComponents(
        changeType,
      );

      // 3. 자동 정책 반영
      await this.applyPolicyChanges(changeType);

      // 4. 검증 및 보고
      await this.validatePolicyApplication();

      const event: PolicyChangeEvent = {
        timestamp: new Date(),
        filePath,
        changeType,
        autoApplied: true,
        impactedComponents,
      };

      console.log("✅ Policy changes applied successfully");
      console.log(`📊 Impacted components: ${impactedComponents.length}`);

      // 5. 상태 업데이트
      await this.refreshSystemStatus();
    } catch (error) {
      console.error("❌ Failed to apply policy changes:", error);
    } finally {
      this.isProcessing = false;
    }
  }

  private determineChangeType(
    filePath: string,
  ): "architecture" | "design-principles" | "integration-rules" {
    if (filePath.includes("ARCHITECTURE")) return "architecture";
    if (filePath.includes("DESIGN_PRINCIPLES")) return "design-principles";
    return "integration-rules";
  }

  private async identifyImpactedComponents(
    changeType: string,
  ): Promise<string[]> {
    try {
      const result = execSync(
        "npm run registry:search -- --affected-by=" + changeType,
        { encoding: "utf8", stdio: "pipe" },
      );
      return result.split("\n").filter((line) => line.trim().length > 0);
    } catch {
      return [];
    }
  }

  private async applyPolicyChanges(changeType: string): Promise<void> {
    console.log(`🔧 Applying ${changeType} policy changes...`);

    // 설계 원칙 재분석
    execSync("npm run design:analyze", { stdio: "pipe" });

    // 통합 규칙 재적용
    execSync("npm run integration:audit", { stdio: "pipe" });

    // 컴포넌트 레지스트리 재생성
    execSync("npm run registry:generate", { stdio: "pipe" });

    // 자동 진화 실행
    execSync("npm run evolution:evolve", { stdio: "pipe" });

    console.log("✅ All policy systems updated");
  }

  private async validatePolicyApplication(): Promise<void> {
    try {
      execSync("npm run system:design", { stdio: "pipe" });
      console.log("✅ Policy validation passed");
    } catch (error) {
      console.warn("⚠️ Policy validation had warnings:", error);
    }
  }

  private async refreshSystemStatus(): Promise<void> {
    console.log("📊 Refreshing system status...");
    try {
      execSync("npm run status", { stdio: "inherit" });
    } catch (error) {
      console.error("Failed to refresh status:", error);
    }
  }
}

// CLI 실행
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes("start")) {
    new RealTimePolicyReflector();

    // 무한 대기 (프로세스 유지)
    process.on("SIGINT", () => {
      console.log("\n👋 Real-Time Policy Reflector stopped");
      process.exit(0);
    });

    console.log("🎯 Real-Time Policy Reflector is now active");
    console.log(
      "📝 Edit ARCHITECTURE.md or design files to see auto-reflection",
    );
    console.log("Press Ctrl+C to stop");

    // 무한 대기
    setInterval(() => {}, 1000);
  } else {
    console.log("Usage: tsx scripts/real-time-policy-reflector.ts start");
  }
}
