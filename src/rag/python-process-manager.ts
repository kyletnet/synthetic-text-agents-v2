/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Python Process Manager
 *
 * Purpose:
 * - Spawn and manage Python embedding server process
 * - Handle JSON-based IPC communication
 * - Auto-restart on crash
 * - Request queuing and response matching
 *
 * Design:
 * - Single process with request queue
 * - Line-buffered JSON communication
 * - Automatic cleanup on exit
 */

import { spawn, type ChildProcess } from "child_process";
import { join } from "path";
import { randomUUID } from "crypto";
import type { Logger } from "../shared/logger.js";
import type { PythonEnvironment } from "./python-env-manager.js";

interface EmbedRequest {
  id: string;
  action: "embed" | "ping" | "shutdown";
  texts?: string[];
  model?: string;
}

interface EmbedResponse {
  id: string;
  success: boolean;
  embeddings?: number[][];
  dimensions?: number;
  count?: number;
  pong?: boolean;
  shutdown?: boolean;
  error?: string | null;
  traceback?: string;
}

interface PendingRequest {
  id: string;
  resolve: (embeddings: number[][]) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

export class PythonProcessManager {
  private logger: Logger;
  private pythonEnv: PythonEnvironment;
  private process: ChildProcess | null = null;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private buffer: string = "";
  private isReady: boolean = false;
  private startupPromise: Promise<void> | null = null;

  constructor(logger: Logger, pythonEnv: PythonEnvironment) {
    this.logger = logger;
    this.pythonEnv = pythonEnv;
  }

  /**
   * Start Python embedding server process
   */
  async start(): Promise<void> {
    if (this.startupPromise) {
      return this.startupPromise;
    }

    this.startupPromise = this._start();
    return this.startupPromise;
  }

  private async _start(): Promise<void> {
    if (this.process) {
      this.logger.trace({
        level: "warn",
        agentId: "python-process-manager",
        action: "start_skipped",
        data: { reason: "Process already running" },
      });
      return;
    }

    if (!this.pythonEnv.available || !this.pythonEnv.pythonPath) {
      throw new Error("Python environment not available");
    }

    const scriptPath = join(
      process.cwd(),
      "src",
      "rag",
      "python-scripts",
      "embedding_server.py",
    );

    this.logger.trace({
      level: "info",
      agentId: "python-process-manager",
      action: "process_start_initiated",
      data: {
        pythonPath: this.pythonEnv.pythonPath,
        scriptPath,
      },
    });

    return new Promise((resolve, reject) => {
      try {
        this.process = spawn(this.pythonEnv.pythonPath!, [scriptPath], {
          stdio: ["pipe", "pipe", "pipe"],
        });

        // Setup event handlers
        this.setupProcessHandlers();

        // Setup stdout handler for responses
        this.process.stdout!.on("data", (data) => {
          this.handleStdout(data);
        });

        // Setup stderr handler for logs
        this.process.stderr!.on("data", (data) => {
          this.handleStderr(data);
        });

        // Wait for process to be ready (send ping)
        setTimeout(async () => {
          try {
            await this.ping();
            this.isReady = true;

            this.logger.trace({
              level: "info",
              agentId: "python-process-manager",
              action: "process_ready",
              data: { pid: this.process!.pid },
            });

            resolve();
          } catch (error) {
            reject(
              new Error(
                `Python process failed to respond: ${
                  error instanceof Error ? error.message : String(error)
                }`,
              ),
            );
          }
        }, 1000);
      } catch (error) {
        this.logger.trace({
          level: "error",
          agentId: "python-process-manager",
          action: "process_start_failed",
          data: {},
          error: error instanceof Error ? error.message : String(error),
        });
        reject(error);
      }
    });
  }

  /**
   * Setup process event handlers
   */
  private setupProcessHandlers(): void {
    if (!this.process) return;

    this.process.on("exit", (code, signal) => {
      this.logger.trace({
        level: "warn",
        agentId: "python-process-manager",
        action: "process_exited",
        data: { code, signal },
      });

      this.isReady = false;
      this.process = null;

      // Reject all pending requests
      for (const pending of this.pendingRequests.values()) {
        clearTimeout(pending.timeout);
        pending.reject(new Error("Python process exited"));
      }
      this.pendingRequests.clear();
    });

    this.process.on("error", (error) => {
      this.logger.trace({
        level: "error",
        agentId: "python-process-manager",
        action: "process_error",
        data: {},
        error: error.message,
      });
    });
  }

  /**
   * Handle stdout data (responses)
   */
  private handleStdout(data: Buffer): void {
    this.buffer += data.toString();

    // Process line by line
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() || ""; // Keep incomplete line in buffer

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const response: EmbedResponse = JSON.parse(line);
        this.handleResponse(response);
      } catch (error) {
        this.logger.trace({
          level: "error",
          agentId: "python-process-manager",
          action: "invalid_response_json",
          data: { line },
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Handle stderr data (logs)
   */
  private handleStderr(data: Buffer): void {
    const message = data.toString().trim();
    if (message) {
      this.logger.trace({
        level: "info",
        agentId: "python-embedding-server",
        action: "python_log",
        data: { message },
      });
    }
  }

  /**
   * Handle response from Python
   */
  private handleResponse(response: EmbedResponse): void {
    const pending = this.pendingRequests.get(response.id);
    if (!pending) {
      this.logger.trace({
        level: "warn",
        agentId: "python-process-manager",
        action: "orphan_response",
        data: { responseId: response.id },
      });
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(response.id);

    if (response.success) {
      // For ping responses, return empty embeddings array
      const embeddings = response.embeddings || [];
      pending.resolve(embeddings);
    } else {
      pending.reject(
        new Error(response.error || "Unknown error from Python process"),
      );
    }
  }

  /**
   * Send request to Python process
   */
  private async sendRequest(request: EmbedRequest): Promise<number[][]> {
    if (!this.process || !this.isReady) {
      throw new Error("Python process not ready");
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(request.id);
        reject(new Error("Request timeout"));
      }, 30000); // 30s timeout

      this.pendingRequests.set(request.id, {
        id: request.id,
        resolve,
        reject,
        timeout,
      });

      // Send request as JSON line
      const json = JSON.stringify(request) + "\n";
      this.process!.stdin!.write(json);
    });
  }

  /**
   * Ping the Python process
   */
  async ping(): Promise<boolean> {
    const request: EmbedRequest = {
      id: randomUUID(),
      action: "ping",
    };

    try {
      await this.sendRequest(request);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generate embeddings
   */
  async embed(
    texts: string[],
    model: string = "all-MiniLM-L6-v2",
  ): Promise<number[][]> {
    const request: EmbedRequest = {
      id: randomUUID(),
      action: "embed",
      texts,
      model,
    };

    return this.sendRequest(request);
  }

  /**
   * Shutdown the Python process
   */
  async shutdown(): Promise<void> {
    if (!this.process) {
      return;
    }

    this.logger.trace({
      level: "info",
      agentId: "python-process-manager",
      action: "shutdown_initiated",
      data: {},
    });

    try {
      const request: EmbedRequest = {
        id: randomUUID(),
        action: "shutdown",
      };

      await this.sendRequest(request);

      // Wait a bit for graceful shutdown
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      this.logger.trace({
        level: "warn",
        agentId: "python-process-manager",
        action: "graceful_shutdown_failed",
        data: {},
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Force kill if still alive
    if (this.process) {
      this.process.kill();
      this.process = null;
    }

    this.isReady = false;
    this.startupPromise = null;
  }

  /**
   * Check if process is ready
   */
  ready(): boolean {
    return this.isReady && this.process !== null;
  }
}
