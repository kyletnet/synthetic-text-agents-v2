/**
 * RG Rolling Stats & Flake Quarantine
 *
 * Responsibilities:
 * 1. Maintain rolling window of last 10 runs
 * 2. Enforce stability gate: ≥9/10 must pass
 * 3. Detect flakes (≥3 failures in 24h) → quarantine
 *
 * Storage: reports/rg/history.jsonl (append-only)
 * Quarantine: reports/rg/quarantine.json
 */

import { existsSync, readFileSync, appendFileSync, writeFileSync } from "fs";
import { join } from "path";
import type { RGRunRecord } from "./types.js";

interface RollingStatsResult {
  passed: boolean;
  stats: {
    last10PassCount: number;
    last10WarnCount: number;
    last10FailCount: number;
    consecutiveWarns: number;
  };
  quarantined: string[];
}

export async function checkRollingStats(
  projectRoot: string,
): Promise<RollingStatsResult> {
  const historyPath = join(projectRoot, "reports/rg/history.jsonl");
  const quarantinePath = join(projectRoot, "reports/rg/quarantine.json");

  const result: RollingStatsResult = {
    passed: true,
    stats: {
      last10PassCount: 0,
      last10WarnCount: 0,
      last10FailCount: 0,
      consecutiveWarns: 0,
    },
    quarantined: [],
  };

  // Read history
  if (!existsSync(historyPath)) {
    // First run - no history yet
    return result;
  }

  const content = readFileSync(historyPath, "utf8");
  const lines = content.trim().split("\n").filter(Boolean);
  const records: RGRunRecord[] = lines.map((line) => JSON.parse(line));

  // Get last 10 runs
  const last10 = records.slice(-10);

  result.stats.last10PassCount = last10.filter((r) => r.pass && !r.warn).length;
  result.stats.last10WarnCount = last10.filter((r) => r.warn).length;
  result.stats.last10FailCount = last10.filter((r) => !r.pass).length;

  // Check stability gate: ≥9/10 must pass
  if (last10.length >= 10) {
    const passOrWarn =
      result.stats.last10PassCount + result.stats.last10WarnCount;
    if (passOrWarn < 9) {
      result.passed = false;
    }
  }

  // Check consecutive warnings
  let consecutiveWarns = 0;
  for (let i = records.length - 1; i >= 0; i--) {
    if (records[i].warn) {
      consecutiveWarns++;
    } else {
      break;
    }
  }
  result.stats.consecutiveWarns = consecutiveWarns;

  // Max 2 consecutive warns allowed
  if (consecutiveWarns > 2) {
    result.passed = false;
  }

  // Check for quarantined tests
  if (existsSync(quarantinePath)) {
    const quarantine = JSON.parse(readFileSync(quarantinePath, "utf8"));
    result.quarantined = quarantine.signatures || [];
  }

  return result;
}

export async function recordRun(
  projectRoot: string,
  record: RGRunRecord,
): Promise<void> {
  const historyPath = join(projectRoot, "reports/rg/history.jsonl");
  appendFileSync(historyPath, JSON.stringify(record) + "\n");
}

export async function detectFlakes(projectRoot: string): Promise<string[]> {
  const historyPath = join(projectRoot, "reports/rg/history.jsonl");

  if (!existsSync(historyPath)) {
    return [];
  }

  const content = readFileSync(historyPath, "utf8");
  const lines = content.trim().split("\n").filter(Boolean);
  const records: RGRunRecord[] = lines.map((line) => JSON.parse(line));

  // Get records from last 24 hours
  const now = Date.now();
  const last24h = records.filter((r) => {
    const ts = new Date(r.ts).getTime();
    return now - ts < 24 * 60 * 60 * 1000;
  });

  // Count failures
  const failures = last24h.filter((r) => !r.pass && !r.warn);

  // If ≥3 failures in 24h, consider it a flake
  if (failures.length >= 3) {
    return ["autonomy_loop"]; // Signature of flaky test
  }

  return [];
}

export async function quarantineFlake(
  projectRoot: string,
  signature: string,
): Promise<void> {
  const quarantinePath = join(projectRoot, "reports/rg/quarantine.json");

  let quarantine: { signatures: string[]; ts: string } = {
    signatures: [],
    ts: new Date().toISOString(),
  };

  if (existsSync(quarantinePath)) {
    quarantine = JSON.parse(readFileSync(quarantinePath, "utf8"));
  }

  if (!quarantine.signatures.includes(signature)) {
    quarantine.signatures.push(signature);
    quarantine.ts = new Date().toISOString();
    writeFileSync(quarantinePath, JSON.stringify(quarantine, null, 2));
  }
}
