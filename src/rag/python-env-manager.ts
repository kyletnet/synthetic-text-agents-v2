/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Python Environment Manager
 *
 * Purpose:
 * - Detect Python installation
 * - Manage virtual environment
 * - Install and verify dependencies
 * - Provide Python executable path
 *
 * Design:
 * - Automatic setup on first use
 * - Graceful fallback if Python unavailable
 * - Cache detection results
 */

import { execSync, exec } from "child_process";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import type { Logger } from "../shared/logger.js";

export interface PythonEnvironment {
  available: boolean;
  pythonPath: string | null;
  version: string | null;
  venvPath: string | null;
  dependenciesInstalled: boolean;
}

export class PythonEnvironmentManager {
  private logger: Logger;
  private projectRoot: string;
  private venvDir: string;
  private cachedEnv: PythonEnvironment | null = null;

  constructor(logger: Logger, projectRoot: string = process.cwd()) {
    this.logger = logger;
    this.projectRoot = projectRoot;
    this.venvDir = join(projectRoot, ".venv-embeddings");
  }

  /**
   * Get Python environment (detect or use cached)
   */
  async getEnvironment(): Promise<PythonEnvironment> {
    if (this.cachedEnv) {
      return this.cachedEnv;
    }

    this.cachedEnv = await this.detectEnvironment();
    return this.cachedEnv;
  }

  /**
   * Setup complete Python environment
   *
   * Steps:
   * 1. Detect Python
   * 2. Create virtual environment
   * 3. Install dependencies
   */
  async setup(): Promise<PythonEnvironment> {
    const start = Date.now();

    this.logger.trace({
      level: "info",
      agentId: "python-env-manager",
      action: "setup_started",
      data: { venvDir: this.venvDir },
    });

    try {
      // Step 1: Detect Python
      const pythonPath = this.detectPython();
      if (!pythonPath) {
        this.logger.trace({
          level: "warn",
          agentId: "python-env-manager",
          action: "setup_failed",
          data: { reason: "Python not found" },
          duration: Date.now() - start,
        });

        return {
          available: false,
          pythonPath: null,
          version: null,
          venvPath: null,
          dependenciesInstalled: false,
        };
      }

      const version = this.getPythonVersion(pythonPath);
      this.logger.trace({
        level: "info",
        agentId: "python-env-manager",
        action: "python_detected",
        data: { pythonPath, version },
      });

      // Step 2: Create virtual environment
      const venvPath = await this.createVirtualEnv(pythonPath);

      // Step 3: Install dependencies
      const dependenciesInstalled = await this.installDependencies(venvPath);

      const env: PythonEnvironment = {
        available: true,
        pythonPath: venvPath,
        version,
        venvPath,
        dependenciesInstalled,
      };

      this.cachedEnv = env;

      this.logger.trace({
        level: "info",
        agentId: "python-env-manager",
        action: "setup_completed",
        data: {
          pythonPath: venvPath,
          version,
          dependenciesInstalled,
        },
        duration: Date.now() - start,
      });

      return env;
    } catch (error) {
      this.logger.trace({
        level: "error",
        agentId: "python-env-manager",
        action: "setup_failed",
        data: {},
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - start,
      });

      return {
        available: false,
        pythonPath: null,
        version: null,
        venvPath: null,
        dependenciesInstalled: false,
      };
    }
  }

  /**
   * Detect Python installation
   */
  private detectEnvironment(): Promise<PythonEnvironment> {
    const pythonPath = this.detectPython();

    if (!pythonPath) {
      return Promise.resolve({
        available: false,
        pythonPath: null,
        version: null,
        venvPath: null,
        dependenciesInstalled: false,
      });
    }

    const version = this.getPythonVersion(pythonPath);
    const venvPath = this.getVenvPythonPath();
    const dependenciesInstalled = this.checkDependencies(
      venvPath || pythonPath,
    );

    return Promise.resolve({
      available: true,
      pythonPath: venvPath || pythonPath,
      version,
      venvPath,
      dependenciesInstalled,
    });
  }

  /**
   * Detect Python executable
   *
   * Tries: python3, python, py
   */
  private detectPython(): string | null {
    const candidates = ["python3", "python", "py"];

    for (const cmd of candidates) {
      try {
        execSync(`${cmd} --version`, { stdio: "pipe" });
        return cmd;
      } catch {
        // Try next candidate
      }
    }

    return null;
  }

  /**
   * Get Python version
   */
  private getPythonVersion(pythonPath: string): string | null {
    try {
      const output = execSync(`${pythonPath} --version`, {
        encoding: "utf8",
        stdio: "pipe",
      });
      return output.trim();
    } catch {
      return null;
    }
  }

  /**
   * Create virtual environment
   */
  private async createVirtualEnv(pythonPath: string): Promise<string> {
    // Check if venv already exists
    const venvPython = this.getVenvPythonPath();
    if (venvPython && existsSync(venvPython)) {
      this.logger.trace({
        level: "info",
        agentId: "python-env-manager",
        action: "venv_exists",
        data: { venvPath: this.venvDir },
      });
      return venvPython;
    }

    this.logger.trace({
      level: "info",
      agentId: "python-env-manager",
      action: "venv_creation_started",
      data: { venvPath: this.venvDir },
    });

    return new Promise((resolve, reject) => {
      exec(`${pythonPath} -m venv ${this.venvDir}`, (error, stdout, stderr) => {
        if (error) {
          this.logger.trace({
            level: "error",
            agentId: "python-env-manager",
            action: "venv_creation_failed",
            data: { stderr },
            error: error.message,
          });
          reject(error);
          return;
        }

        const venvPython = this.getVenvPythonPath();
        if (!venvPython) {
          reject(new Error("Virtual environment creation failed"));
          return;
        }

        this.logger.trace({
          level: "info",
          agentId: "python-env-manager",
          action: "venv_created",
          data: { venvPath: this.venvDir },
        });

        resolve(venvPython);
      });
    });
  }

  /**
   * Install Python dependencies
   */
  private async installDependencies(pythonPath: string): Promise<boolean> {
    // Check if already installed
    if (this.checkDependencies(pythonPath)) {
      this.logger.trace({
        level: "info",
        agentId: "python-env-manager",
        action: "dependencies_already_installed",
        data: {},
      });
      return true;
    }

    this.logger.trace({
      level: "info",
      agentId: "python-env-manager",
      action: "dependency_installation_started",
      data: { packages: ["sentence-transformers"] },
    });

    return new Promise((resolve) => {
      // Install sentence-transformers (includes torch)
      const pipPath = this.getPipPath();
      if (!pipPath) {
        this.logger.trace({
          level: "error",
          agentId: "python-env-manager",
          action: "pip_not_found",
          data: {},
        });
        resolve(false);
        return;
      }

      exec(
        `${pipPath} install sentence-transformers`,
        { timeout: 300000 }, // 5 minutes timeout
        (error, stdout, stderr) => {
          if (error) {
            this.logger.trace({
              level: "error",
              agentId: "python-env-manager",
              action: "dependency_installation_failed",
              data: { stderr },
              error: error.message,
            });
            resolve(false);
            return;
          }

          this.logger.trace({
            level: "info",
            agentId: "python-env-manager",
            action: "dependencies_installed",
            data: {},
          });

          resolve(true);
        },
      );
    });
  }

  /**
   * Check if dependencies are installed
   */
  private checkDependencies(pythonPath: string): boolean {
    try {
      execSync(`${pythonPath} -c "import sentence_transformers"`, {
        stdio: "pipe",
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get virtual environment Python path
   */
  private getVenvPythonPath(): string | null {
    const isWindows = process.platform === "win32";
    const pythonPath = isWindows
      ? join(this.venvDir, "Scripts", "python.exe")
      : join(this.venvDir, "bin", "python");

    return existsSync(pythonPath) ? pythonPath : null;
  }

  /**
   * Get pip path from virtual environment
   */
  private getPipPath(): string | null {
    const isWindows = process.platform === "win32";
    const pipPath = isWindows
      ? join(this.venvDir, "Scripts", "pip.exe")
      : join(this.venvDir, "bin", "pip");

    return existsSync(pipPath) ? pipPath : null;
  }

  /**
   * Reset cached environment (for testing)
   */
  resetCache(): void {
    this.cachedEnv = null;
  }
}
