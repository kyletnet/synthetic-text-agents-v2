import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs";
import { promises as fsPromises } from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { RunRequest, RunResult } from "@/lib/types";

// ===== log cleanup helpers =====
function toInt(v: any, def: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : def;
}

function safeList(dir: string): string[] {
  try {
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
}

function olderThan(filePath: string, days: number): boolean {
  try {
    const stat = fs.statSync(filePath);
    const ageMs = Date.now() - stat.mtimeMs;
    return ageMs > days * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function safeUnlink(fp: string) {
  try {
    fs.unlinkSync(fp);
  } catch {}
}

function cleanupOldFiles(baseDir: string, days: number) {
  const files = safeList(baseDir);
  for (const name of files) {
    const fp = path.join(baseDir, name);
    if (olderThan(fp, days)) safeUnlink(fp);
  }
}

function runBestEffortCleanup() {
  const cwd = process.cwd();
  const runLogsDir = path.join(cwd, "apps", "fe-web", "docs", "RUN_LOGS");
  const decisionsDir = path.join(cwd, "apps", "fe-web", "docs", "DECISIONS");

  const keepDays = toInt(process.env.LOG_RETENTION_DAYS, 7);

  try {
    cleanupOldFiles(runLogsDir, keepDays);
  } catch {}
  try {
    cleanupOldFiles(decisionsDir, keepDays);
  } catch {}
}
// ===== end helpers =====

const RUN_PROVIDER = process.env.RUN_PROVIDER || "MOCK";

// Setup logging directory and path
const logDir = path.join(process.cwd(), "outputs");
const logPath = path.join(logDir, "fe_requests.log");
try {
  fs.mkdirSync(logDir, { recursive: true });
} catch {}

function appendLog(entry: any) {
  try {
    fs.appendFileSync(logPath, JSON.stringify(entry) + "\n", "utf8");
  } catch (e) {}
}

// MOCK provider - return expected_run_result.json or synthesized response
async function mockProvider(request: RunRequest): Promise<RunResult> {
  try {
    // Try to load template
    const templatePath = path.join(
      process.cwd(),
      "../../docs/TEMPLATES/expected_run_result.json",
    );
    const templateContent = await fsPromises.readFile(templatePath, "utf-8");
    const mockResult = JSON.parse(templateContent);

    // Add some suggested tags for testing
    mockResult.suggestedTags = ["hallucination", "too_easy"];

    return mockResult;
  } catch {
    // Fallback synthesized response
    return {
      metrics: {
        passRate: 0.75,
        avgScore: 7.2,
        avgLatency: 1950,
        vetoedPct: 0.25,
      },
      issuesTop3: ["hallucination", "too_easy", "format_issue"],
      samples: [
        {
          id: "sample-001",
          status: "passed",
          score: 8.1,
          latencyMs: 1800,
          issues: [],
        },
        {
          id: "sample-002",
          status: "failed",
          score: 6.5,
          latencyMs: 2100,
          issues: ["hallucination", "unclear"],
        },
        {
          id: "sample-003",
          status: "vetoed",
          score: 5.2,
          latencyMs: 2400,
          issues: ["format_issue", "too_long"],
        },
      ],
      links: {
        runLogPath: "docs/RUN_LOGS/2025-08-30_run-001.md",
        decisionPath: "docs/LEDGER/dec-20250830-001.md",
      },
      suggestedTags: ["hallucination", "too_easy"],
    };
  }
}

// CLI provider - spawn engine process
async function cliProvider(request: RunRequest): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const timeoutMs = Number(process.env.RUN_TIMEOUT_MS ?? 15000);

    // Build payload object
    const payload = {
      inputs: request.inputs || {},
      flags: request.flags || {},
      constraints: request.constraints || {},
      session: request.session || {},
    };

    // Spawn the CLI with absolute node binary
    const feCwd = process.cwd();
    const cliScript = path.resolve(feCwd, "cli", "engine_cli.js");
    const child = spawn(process.execPath, [cliScript], {
      cwd: feCwd,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      if (code === 0) {
        try {
          // Parse stdout as JSON (trim first)
          let result = JSON.parse(stdout.trim());
          resolve(result);
        } catch (parseError) {
          try {
            // Try to extract first balanced {...} block
            const match = stdout.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/);
            if (match) {
              const result = JSON.parse(match[0]);
              resolve(result);
            } else {
              throw new Error("No valid JSON found in CLI output");
            }
          } catch {
            reject(new Error(`Failed to parse CLI output: ${parseError}`));
          }
        }
      } else {
        reject(new Error(`CLI exited with code ${code}: ${stderr}`));
      }
    });

    child.on("error", (error) => {
      reject(new Error(`CLI spawn error: ${error.message}`));
    });

    // Write JSON payload to stdin
    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();

    // Set timeout
    setTimeout(() => {
      child.kill();
      reject(new Error(`CLI timeout after ${timeoutMs}ms`));
    }, timeoutMs);
  });
}

// ENGINE_HTTP provider - placeholder stub
async function httpProvider(request: RunRequest): Promise<RunResult> {
  // This is a placeholder for future HTTP backend
  const result = await mockProvider(request);
  result.links = {
    ...result.links,
    runLogPath: "TODO: HTTP backend not implemented",
    decisionPath: "TODO: HTTP backend not implemented",
  };
  return result;
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  const provider = process.env.RUN_PROVIDER || "MOCK";

  appendLog({
    ts: new Date().toISOString(),
    event: "run_start",
    provider,
  });

  try {
    const request: RunRequest = await req.json();

    let result: RunResult;

    switch (RUN_PROVIDER) {
      case "CLI":
        try {
          result = await cliProvider(request);
        } catch (e) {
          console.error("CLI provider failed:", e);
          // Fallback to MOCK response with CLI_FALLBACK note
          result = await mockProvider(request);
          result.providerNote = "CLI_FALLBACK";
        }
        break;
      case "ENGINE_HTTP":
        result = await httpProvider(request);
        break;
      case "MOCK":
      default:
        result = await mockProvider(request);
        break;
    }

    // Log successful request
    const latencyMs = Date.now() - startedAt;
    appendLog({
      ts: new Date().toISOString(),
      event: "run_ok",
      provider,
      latencyMs,
      metrics: result?.metrics,
    });

    // Write Markdown run log file
    try {
      const now = new Date();
      const yyyy = String(now.getFullYear());
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const dd = String(now.getDate()).padStart(2, "0");
      const epoch = String(now.getTime());

      const outDir = path.join(
        process.cwd(),
        "apps",
        "fe-web",
        "docs",
        "RUN_LOGS",
      );
      try {
        fs.mkdirSync(outDir, { recursive: true });
      } catch (_) {}

      // Safely extract a few fields
      const providerName = provider;
      const passRate = result?.metrics?.passRate ?? null;
      const avgScore = result?.metrics?.avgScore ?? null;
      const vetoedPct = result?.metrics?.vetoedPct ?? null;
      const samplesCount = Array.isArray(result?.samples)
        ? result.samples.length
        : 0;

      const guidelines =
        typeof request?.inputs?.guidelines === "string"
          ? request.inputs.guidelines.slice(0, 120).replace(/\n/g, " ")
          : "";

      const guardianPreset = request?.session?.guardianProfileId ?? null;

      const fname = `${yyyy}-${mm}-${dd}_run-${epoch}.md`;
      const fpath = path.join(outDir, fname);

      const md = [
        `# Run Log — ${yyyy}-${mm}-${dd} ${now.toISOString()}`,
        "",
        `- provider: \`${providerName}\``,
        latencyMs != null ? `- latencyMs: \`${latencyMs}\`` : null,
        guardianPreset ? `- guardian: \`${guardianPreset}\`` : null,
        guidelines ? `- guidelines: ${JSON.stringify(guidelines)}` : null,
        "",
        "## Metrics",
        "```json",
        JSON.stringify(result?.metrics ?? {}, null, 2),
        "```",
        "",
        `Samples: \`${samplesCount}\``,
        "",
      ]
        .filter(Boolean)
        .join("\n");

      console.log("[fe-web] writing run log to:", fpath);
      try {
        fs.writeFileSync(fpath, md, "utf-8");
      } catch (_) {}
    } catch (_) {
      // no-op
    }

    // --- Begin: improvement note (Top-K + Summoning Plan) ---
    try {
      const k = Number(process.env.IMPROVEMENT_TOPK ?? "3");
      const enablePlan =
        String(process.env.IMPROVEMENT_ENABLE_PLAN ?? "true") === "true";

      const samples = Array.isArray(result?.samples) ? result.samples : [];
      const failed = samples.filter(
        (s: any) => s?.status && String(s.status).toLowerCase() !== "passed",
      );

      if (failed.length > 0) {
        // sort: worst first (lowest score), then highest latency, then id
        failed.sort((a: any, b: any) => {
          const sa = Number(a?.score ?? Infinity),
            sb = Number(b?.score ?? Infinity);
          if (sa !== sb) return sa - sb;
          const la = Number(a?.latencyMs ?? 0),
            lb = Number(b?.latencyMs ?? 0);
          if (la !== lb) return lb - la;
          return String(a?.id ?? "").localeCompare(String(b?.id ?? ""));
        });

        const topK = failed.slice(0, Math.max(1, k)).map((s: any) => ({
          id: s?.id,
          status: s?.status,
          score: s?.score,
          latencyMs: s?.latencyMs,
          issues: Array.isArray(s?.issues) ? s.issues : [],
        }));

        // Summoning plan (optional)
        const issueToExpert = (issue: string) => {
          const t = String(issue || "").toLowerCase();
          if (t.includes("halluc"))
            return {
              expert: "FactChecker",
              actions: ["verify sources", "add citations", "re-answer"],
            };
          if (t.includes("format"))
            return {
              expert: "Formatter",
              actions: ["apply schema", "fix formatting", "validate output"],
            };
          if (t.includes("easy"))
            return {
              expert: "DifficultyTuner",
              actions: ["raise constraints", "increase complexity"],
            };
          if (t.includes("unclear"))
            return {
              expert: "Clarifier",
              actions: ["tighten wording", "add examples"],
            };
          if (t.includes("long"))
            return {
              expert: "Conciseness",
              actions: ["compress", "bulletize", "limit length"],
            };
          return {
            expert: "GeneralReviewer",
            actions: ["review", "patch", "retest"],
          };
        };

        const plan = enablePlan
          ? topK.map((s: any) => {
              const issues = Array.isArray(s.issues) ? s.issues : [];
              const mappings = issues.length
                ? issues.map((iss: string) => issueToExpert(iss))
                : [issueToExpert("general")];
              return {
                sampleId: s.id,
                issues: issues,
                modules: mappings.map((m: any) => m.expert),
                actions: Array.from(
                  new Set(mappings.flatMap((m: any) => m.actions)),
                ),
              };
            })
          : [];

        // Build markdown
        const now = new Date();
        const yyyy = String(now.getFullYear());
        const mm = String(now.getMonth() + 1).padStart(2, "0");
        const dd = String(now.getDate()).padStart(2, "0");

        const decisionsDir = path.join(
          process.cwd(),
          "apps",
          "fe-web",
          "docs",
          "DECISIONS",
        );
        fs.mkdirSync(decisionsDir, { recursive: true });

        const fpath = path.join(
          decisionsDir,
          `improvement_${yyyy}-${mm}-${dd}.md`,
        );

        const hdr = `# Improvement Plan — ${yyyy}-${mm}-${dd} ${now.toISOString()}\n`;
        const sec1 = [
          `## Top-${topK.length} Failed (K=${k})`,
          "```json",
          JSON.stringify(
            { runTs: now.toISOString(), topKFailed: topK },
            null,
            2,
          ),
          "```",
          "",
        ].join("\n");

        const sec2 = enablePlan
          ? [
              "## Agent Summoning Plan",
              "```json",
              JSON.stringify({ plan }, null, 2),
              "```",
              "",
            ].join("\n")
          : "";

        const body = [hdr, sec1, sec2, "---", ""].join("\n");

        // Append (daily file accumulates multiple runs)
        fs.appendFileSync(fpath, body, "utf-8");
        // Optional visibility in server logs:
        console.log("[fe-web] wrote improvement note:", fpath);
      }
    } catch (_e) {
      // swallow to avoid impacting API response
    }
    // --- End: improvement note ---

    try {
      runBestEffortCleanup();
    } catch {}

    return NextResponse.json(result);
  } catch (error) {
    // Log failed request
    appendLog({
      ts: new Date().toISOString(),
      event: "run_err",
      provider,
      latencyMs: Date.now() - startedAt,
      error: String(error),
    });

    console.error("Run API error:", error);

    // Don't crash the FE - return status 200 with fallback response
    const fallbackResult = await mockProvider({} as RunRequest);
    fallbackResult.providerNote = "CLI_FALLBACK";

    return NextResponse.json(fallbackResult);
  }
}
