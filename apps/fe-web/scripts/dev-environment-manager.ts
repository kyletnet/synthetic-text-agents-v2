#!/usr/bin/env node

/**
 * 🏗️ Development Environment Manager
 *
 * Fundamental solution for port conflicts and process isolation
 * Implements URL-based deployment options and intelligent process management
 */

import { execSync, ChildProcess } from "child_process";
import fs from "fs";
import path from "path";
import net from "net";
import { circuitBreakerRegistry } from "../lib/circuit-breaker";
import { processLifecycleManager } from "../lib/process-lifecycle-manager";

interface DevEnvironmentConfig {
  mode: "local" | "container" | "cloud" | "production";
  port: number;
  forceCleanup: boolean;
  singleInstance: boolean;
  healthCheckInterval: number;
}

interface ProcessInfo {
  pid: number;
  port: number;
  startTime: Date;
  status: "running" | "failed" | "stopped";
}

export class DevelopmentEnvironmentManager {
  private config: DevEnvironmentConfig;
  private lockFile: string;
  private processInfo: ProcessInfo | null = null;

  constructor(config?: Partial<DevEnvironmentConfig>) {
    this.config = {
      mode: "local",
      port: 3000,
      forceCleanup: true,
      singleInstance: true,
      healthCheckInterval: 30000,
      ...config,
    };

    this.lockFile = path.join(process.cwd(), ".dev-environment.lock");
  }

  /**
   * 🚀 Start Development Environment
   */
  async startEnvironment(): Promise<void> {
    console.log("🏗️ [DevEnvManager] Starting development environment...");

    // Step 1: Enforce single instance
    if (this.config.singleInstance) {
      await this.enforceSingleInstance();
    }

    // Step 2: Cleanup existing processes
    if (this.config.forceCleanup) {
      await this.forceCleanupProcesses();
    }

    // Step 3: Prepare environment based on mode
    switch (this.config.mode) {
      case "local":
        await this.startLocalDevelopment();
        break;
      case "container":
        await this.startContainerDevelopment();
        break;
      case "cloud":
        await this.startCloudDevelopment();
        break;
      case "production":
        await this.startProductionMode();
        break;
    }

    // Step 4: Setup monitoring
    this.setupHealthMonitoring();

    console.log(
      "✅ [DevEnvManager] Development environment started successfully",
    );
  }

  /**
   * 🔒 Enforce Single Instance Policy
   */
  private async enforceSingleInstance(): Promise<void> {
    if (fs.existsSync(this.lockFile)) {
      const lockData = JSON.parse(fs.readFileSync(this.lockFile, "utf8"));

      // Check if process is still running
      const isRunning = await this.isProcessRunning(lockData.pid);

      if (isRunning) {
        console.log(
          "🚫 [DevEnvManager] Another dev environment is already running",
        );
        console.log(
          `📊 [DevEnvManager] PID: ${lockData.pid}, Port: ${lockData.port}, Started: ${lockData.startTime}`,
        );

        // Kill existing process
        console.log("🧹 [DevEnvManager] Terminating existing process...");
        await this.killProcess(lockData.pid);
      }

      // Remove stale lock file
      fs.unlinkSync(this.lockFile);
    }
  }

  /**
   * 🧹 Force Cleanup All Development Processes
   */
  private async forceCleanupProcesses(): Promise<void> {
    console.log("🧹 [DevEnvManager] Force cleaning up all dev processes...");

    try {
      // Kill all npm run dev processes
      execSync('pkill -f "npm run dev" || true', { stdio: "inherit" });

      // Kill all Next.js processes
      execSync('pkill -f "next dev" || true', { stdio: "inherit" });

      // Kill processes on common ports
      const commonPorts = [3000, 3001, 3002, 3003, 8080, 8000];
      for (const port of commonPorts) {
        await this.killProcessOnPort(port);
      }

      // Wait for cleanup to complete
      await this.sleep(2000);

      console.log("✅ [DevEnvManager] Process cleanup completed");
    } catch (error) {
      console.warn(
        "⚠️ [DevEnvManager] Some processes may not have been cleaned up:",
        error,
      );
    }
  }

  /**
   * 🏠 Start Local Development Mode
   */
  private async startLocalDevelopment(): Promise<void> {
    console.log("🏠 [DevEnvManager] Starting local development mode...");

    // Find available port
    const availablePort = await this.findAvailablePort(this.config.port);
    this.config.port = availablePort;

    console.log(`🔌 [DevEnvManager] Using port: ${availablePort}`);

    // Clean cache and build artifacts
    await this.cleanBuildArtifacts();

    // Start dev server
    const devProcess = processLifecycleManager.spawnManaged(
      "npm",
      ["run", "dev"],
      {
        stdio: "inherit",
        env: {
          ...process.env,
          PORT: availablePort.toString(),
          NODE_ENV: "development",
        },
      },
    );

    // Create lock file
    this.processInfo = {
      pid: devProcess.pid!,
      port: availablePort,
      startTime: new Date(),
      status: "running",
    };

    fs.writeFileSync(this.lockFile, JSON.stringify(this.processInfo, null, 2));

    console.log(
      `🎯 [DevEnvManager] Local dev server: http://localhost:${availablePort}`,
    );
  }

  /**
   * 🐳 Start Container Development Mode
   */
  private async startContainerDevelopment(): Promise<void> {
    console.log("🐳 [DevEnvManager] Starting container development mode...");

    // Create Dockerfile if it doesn't exist
    const dockerfilePath = path.join(process.cwd(), "Dockerfile.dev");
    if (!fs.existsSync(dockerfilePath)) {
      await this.createDevDockerfile();
    }

    // Build and run container
    const containerName = "synthetic-text-agents-dev";

    try {
      execSync(`docker stop ${containerName} && docker rm ${containerName}`, {
        stdio: "inherit",
      });
    } catch {
      // Container may not exist
    }

    execSync(`docker build -f Dockerfile.dev -t ${containerName} .`, {
      stdio: "inherit",
    });
    execSync(
      `docker run -d --name ${containerName} -p 3000:3000 ${containerName}`,
      { stdio: "inherit" },
    );

    console.log(
      "🎯 [DevEnvManager] Container dev server: http://localhost:3000",
    );
  }

  /**
   * ☁️ Start Cloud Development Mode
   */
  private async startCloudDevelopment(): Promise<void> {
    console.log("☁️ [DevEnvManager] Starting cloud development mode...");

    // Check if Vercel CLI is available
    try {
      execSync("vercel --version", { stdio: "ignore" });
    } catch {
      console.log("📦 [DevEnvManager] Installing Vercel CLI...");
      execSync("npm install -g vercel", { stdio: "inherit" });
    }

    // Deploy to Vercel
    console.log("🚀 [DevEnvManager] Deploying to Vercel...");
    const result = execSync("vercel --prod --confirm", { encoding: "utf8" });
    const deployUrl = result.trim().split("\n").pop();

    console.log(`🎯 [DevEnvManager] Cloud deployment: ${deployUrl}`);

    // Store deployment info
    this.processInfo = {
      pid: process.pid,
      port: 443, // HTTPS
      startTime: new Date(),
      status: "running",
    };

    fs.writeFileSync(
      this.lockFile,
      JSON.stringify(
        {
          ...this.processInfo,
          deploymentUrl: deployUrl,
        },
        null,
        2,
      ),
    );
  }

  /**
   * 🏭 Start Production Mode (for testing)
   */
  private async startProductionMode(): Promise<void> {
    console.log("🏭 [DevEnvManager] Starting production mode for testing...");

    // Build production
    await this.cleanBuildArtifacts();
    execSync("npm run build", { stdio: "inherit" });

    // Find available port
    const availablePort = await this.findAvailablePort(this.config.port);

    // Start production server
    const prodProcess = processLifecycleManager.spawnManaged("npm", ["start"], {
      stdio: "inherit",
      env: {
        ...process.env,
        PORT: availablePort.toString(),
        NODE_ENV: "production",
      },
    });

    this.processInfo = {
      pid: prodProcess.pid!,
      port: availablePort,
      startTime: new Date(),
      status: "running",
    };

    fs.writeFileSync(this.lockFile, JSON.stringify(this.processInfo, null, 2));

    console.log(
      `🎯 [DevEnvManager] Production server: http://localhost:${availablePort}`,
    );
  }

  /**
   * 💚 Setup Health Monitoring
   */
  private setupHealthMonitoring(): void {
    const healthCheck = setInterval(async () => {
      if (this.processInfo) {
        const isHealthy = await this.checkHealth();
        if (!isHealthy) {
          console.error(
            "❌ [DevEnvManager] Health check failed - restarting...",
          );
          clearInterval(healthCheck);

          // Circuit Breaker로 재시작 보호
          try {
            await circuitBreakerRegistry
              .get("dev-env-restart", {
                failureThreshold: 3,
                timeoutWindow: 300000, // 5분 차단
                halfOpenMaxAttempts: 1,
              })
              .execute(async () => {
                await this.restartEnvironment();
              });
          } catch (error) {
            console.error(
              "🛡️ [DevEnvManager] Circuit breaker blocked restart:",
              error instanceof Error ? error.message : "Unknown error",
            );
            console.log(
              "🛑 [DevEnvManager] Too many restart failures - stopping automatic restarts",
            );
            // 더 이상 재시작하지 않고 수동 개입 필요
          }
        }
      }
    }, this.config.healthCheckInterval);

    // Cleanup on exit
    process.on("SIGINT", () => {
      clearInterval(healthCheck);
      this.cleanup();
      process.exit(0);
    });
  }

  /**
   * 🔄 Restart Environment
   */
  private async restartEnvironment(): Promise<void> {
    console.log("🔄 [DevEnvManager] Restarting development environment...");
    await this.cleanup();
    await this.startEnvironment();
  }

  /**
   * 💚 Check Health
   */
  private async checkHealth(): Promise<boolean> {
    if (!this.processInfo) return false;

    if (this.config.mode === "cloud") {
      // For cloud mode, just return true (Vercel handles health)
      return true;
    }

    return await this.isPortOpen(this.processInfo.port);
  }

  /**
   * 🧹 Cleanup
   */
  private async cleanup(): Promise<void> {
    if (this.processInfo) {
      await this.killProcess(this.processInfo.pid);
    }

    if (fs.existsSync(this.lockFile)) {
      fs.unlinkSync(this.lockFile);
    }
  }

  /**
   * 🔍 Utility Methods
   */
  private async findAvailablePort(startPort: number): Promise<number> {
    for (let port = startPort; port < startPort + 100; port++) {
      if (await this.isPortAvailable(port)) {
        return port;
      }
    }
    throw new Error("No available ports found");
  }

  private async isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.listen(port, () => {
        server.close(() => resolve(true));
      });
      server.on("error", () => resolve(false));
    });
  }

  private async isPortOpen(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(1000);
      socket.on("connect", () => {
        socket.destroy();
        resolve(true);
      });
      socket.on("timeout", () => {
        socket.destroy();
        resolve(false);
      });
      socket.on("error", () => resolve(false));
      socket.connect(port, "localhost");
    });
  }

  private async killProcessOnPort(port: number): Promise<void> {
    try {
      const cmd =
        process.platform === "win32"
          ? `netstat -ano | findstr :${port}`
          : `lsof -ti:${port}`;

      const result = execSync(cmd, { encoding: "utf8" });
      const pids = result.trim().split("\n").filter(Boolean);

      for (const pid of pids) {
        await this.killProcess(parseInt(pid));
      }
    } catch {
      // Port may not be in use
    }
  }

  private async killProcess(pid: number): Promise<void> {
    try {
      process.kill(pid, "SIGTERM");
      await this.sleep(1000);
      process.kill(pid, "SIGKILL");
    } catch {
      // Process may already be dead
    }
  }

  private async isProcessRunning(pid: number): Promise<boolean> {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  private async cleanBuildArtifacts(): Promise<void> {
    const pathsToClean = [".next", "node_modules/.cache", "dist"];
    for (const cleanPath of pathsToClean) {
      try {
        execSync(`rm -rf ${cleanPath}`, { stdio: "inherit" });
      } catch {
        // Path may not exist
      }
    }
  }

  private async createDevDockerfile(): Promise<void> {
    const dockerfile = `
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
    `.trim();

    fs.writeFileSync("Dockerfile.dev", dockerfile);
    console.log("🐳 [DevEnvManager] Created Dockerfile.dev");
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 📊 Get Environment Status
   */
  getStatus(): any {
    if (fs.existsSync(this.lockFile)) {
      const lockData = JSON.parse(fs.readFileSync(this.lockFile, "utf8"));
      return {
        running: true,
        ...lockData,
        uptime: Date.now() - new Date(lockData.startTime).getTime(),
      };
    }
    return { running: false };
  }
}

// CLI Interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const mode = (args[0] as DevEnvironmentConfig["mode"]) || "local";

  const manager = new DevelopmentEnvironmentManager({ mode });

  switch (args[0]) {
    case "start":
      manager.startEnvironment();
      break;
    case "status":
      console.log(JSON.stringify(manager.getStatus(), null, 2));
      break;
    case "local":
    case "container":
    case "cloud":
    case "production":
      manager.startEnvironment();
      break;
    default:
      console.log(`
🏗️ Development Environment Manager

Usage:
  npm run dev:env [mode]

Modes:
  local      - Traditional local development (default)
  container  - Docker-based isolated development
  cloud      - Deploy to Vercel for testing
  production - Production build for testing

Commands:
  start      - Start environment with auto-detection
  status     - Show current environment status

Examples:
  npm run dev:env local      # Start local with port management
  npm run dev:env container  # Start in Docker container
  npm run dev:env cloud      # Deploy to Vercel
  npm run dev:env production # Test production build
      `);
  }
}

console.log("🏗️ [DevEnvManager] Development Environment Manager loaded");
