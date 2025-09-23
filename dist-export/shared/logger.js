import pino from "pino";
import { writeFile, appendFile } from "fs/promises";
import { TraceLogSchema } from "./types.js";
import { randomUUID } from "crypto";
export class Logger {
    pinoLogger;
    traceFilePath;
    constructor(options = {}) {
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
    async trace(entry) {
        const traceLog = {
            id: randomUUID(),
            timestamp: new Date(),
            ...entry,
        };
        const validatedEntry = TraceLogSchema.parse(traceLog);
        try {
            await appendFile(this.traceFilePath, JSON.stringify(validatedEntry) + "\n");
        }
        catch (error) {
            this.pinoLogger.error({ error, traceLog }, "Failed to write trace log");
        }
        this.pinoLogger[entry.level]({
            agentId: entry.agentId,
            action: entry.action,
            duration: entry.duration,
        }, `Agent ${entry.agentId}: ${entry.action}`);
    }
    debug(message, data) {
        this.pinoLogger.debug({ data }, message);
    }
    info(message, data) {
        this.pinoLogger.info({ data }, message);
    }
    warn(message, data) {
        this.pinoLogger.warn({ data }, message);
    }
    error(message, error) {
        this.pinoLogger.error({ error }, message);
    }
    async initialize() {
        try {
            await writeFile(this.traceFilePath, "");
            this.info("Logger initialized", { traceFilePath: this.traceFilePath });
        }
        catch (error) {
            this.error("Failed to initialize trace log file", error);
            throw error;
        }
    }
}
export const createLogger = (options) => {
    return new Logger(options);
};
//# sourceMappingURL=logger.js.map