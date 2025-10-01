import pino from "pino";
import { writeFile, appendFile } from "fs/promises";
import { TraceLog, TraceLogSchema } from "./types.js";
import { randomUUID } from "crypto";

export class Logger {
  private pinoLogger: pino.Logger;
  private traceFilePath: string;

  constructor(options: { level?: pino.Level; runId?: string } = {}) {
    const runId = options.runId || randomUUID();
    this.traceFilePath = `logs/${runId}.jsonl`;

    this.pinoLogger = pino({
      level: options.level || "info",
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          ignore: "pid,hostname",
          translateTime: "SYS:standard",
        },
      },
    });
  }

  async trace(entry: Omit<TraceLog, "id" | "timestamp">): Promise<void> {
    const traceLog: TraceLog = {
      id: randomUUID(),
      timestamp: new Date(),
      ...entry,
    };

    const validatedEntry = TraceLogSchema.parse(traceLog);

    try {
      await appendFile(
        this.traceFilePath,
        JSON.stringify(validatedEntry) + "\n",
      );
    } catch (error) {
      this.pinoLogger.error({ error, traceLog }, "Failed to write trace log");
    }

    this.pinoLogger[entry.level](
      {
        agentId: entry.agentId,
        action: entry.action,
        duration: entry.duration,
      },
      `Agent ${entry.agentId}: ${entry.action}`,
    );
  }

  debug(message: string, data?: unknown): void {
    const sanitized = data ? this.sanitize(data) : data;
    this.pinoLogger.debug({ data: sanitized }, message);
  }

  info(message: string, data?: unknown): void {
    const sanitized = data ? this.sanitize(data) : data;
    this.pinoLogger.info({ data: sanitized }, message);
  }

  warn(message: string, data?: unknown): void {
    const sanitized = data ? this.sanitize(data) : data;
    this.pinoLogger.warn({ data: sanitized }, message);
  }

  error(message: string, error?: unknown): void {
    const sanitized = error ? this.sanitize(error) : error;
    this.pinoLogger.error({ error: sanitized }, message);
  }

  /**
   * Mask PII (Personally Identifiable Information) in log data
   * Masks: email addresses, API keys, phone numbers, credit cards
   */
  private maskPII(data: unknown): unknown {
    if (typeof data === "string") {
      return this.maskPIIString(data);
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.maskPII(item));
    }

    if (data && typeof data === "object") {
      const masked: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data)) {
        // Mask known sensitive keys
        if (/api[_-]?key|password|token|secret|auth/i.test(key)) {
          masked[key] = "***REDACTED***";
        } else {
          masked[key] = this.maskPII(value);
        }
      }
      return masked;
    }

    return data;
  }

  /**
   * Mask PII patterns in string
   */
  private maskPIIString(str: string): string {
    return (
      str
        // Email addresses
        .replace(
          /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
          "***EMAIL***",
        )
        // API keys (various formats)
        .replace(/\b(sk-[a-zA-Z0-9]{48})\b/g, "***API_KEY***")
        .replace(/\b([A-Za-z0-9_-]{32,})\b/g, (match) => {
          // Only mask if it looks like a token (all caps/numbers, no spaces)
          return /^[A-Z0-9_-]+$/.test(match) && match.length > 20
            ? "***TOKEN***"
            : match;
        })
        // Phone numbers (US format)
        .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, "***PHONE***")
        // Credit card numbers
        .replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, "***CARD***")
        // SSN
        .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "***SSN***")
    );
  }

  /**
   * Sanitize data before logging (mask PII)
   */
  private sanitize<T>(data: T): T {
    return this.maskPII(data) as T;
  }

  /**
   * Redact PII from data (alias for maskPII for backward compatibility)
   */
  public redactPII<T>(data: T): T {
    return this.maskPII(data) as T;
  }

  /**
   * Sanitize PII from data (public method for external use)
   */
  public sanitizePII<T>(data: T): T {
    return this.maskPII(data) as T;
  }

  async initialize(): Promise<void> {
    try {
      await writeFile(this.traceFilePath, "");
      this.info("Logger initialized", { traceFilePath: this.traceFilePath });
    } catch (error) {
      this.error("Failed to initialize trace log file", error);
      throw error;
    }
  }
}

export const createLogger = (options?: {
  level?: pino.Level;
  runId?: string;
}) => {
  return new Logger(options);
};
