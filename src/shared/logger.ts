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
    this.pinoLogger.debug({ data }, message);
  }

  info(message: string, data?: unknown): void {
    this.pinoLogger.info({ data }, message);
  }

  warn(message: string, data?: unknown): void {
    this.pinoLogger.warn({ data }, message);
  }

  error(message: string, error?: unknown): void {
    this.pinoLogger.error({ error }, message);
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
