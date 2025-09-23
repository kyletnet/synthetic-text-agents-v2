import pino from "pino";
import { TraceLog } from "./types.js";
export declare class Logger {
  private pinoLogger;
  private traceFilePath;
  constructor(options?: { level?: pino.Level; runId?: string });
  trace(entry: Omit<TraceLog, "id" | "timestamp">): Promise<void>;
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, error?: unknown): void;
  initialize(): Promise<void>;
}
export declare const createLogger: (options?: {
  level?: pino.Level;
  runId?: string;
}) => Logger;
//# sourceMappingURL=logger.d.ts.map
