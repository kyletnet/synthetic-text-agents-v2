import type { RunLog, PatchCard } from "./types";
import { matchContext } from "./selectors";

// Simple, conservative score: start from 0.5, penalize good metrics, reward issues
export function scorePatch(run: RunLog, base: any): number {
  let s = 0.5;
  if ((run.audit_score ?? 10) >= 9.2) s -= 0.2;
  if ((run.p95 ?? 1.5) <= 2.0) s -= 0.1;
  const hasIssues = JSON.stringify(run.issues || []).length > 2;
  if (hasIssues) s += 0.2;
  if (base?.selectors && !matchContext(run, base.selectors)) s = 0.0;
  return Math.max(0, Math.min(1, s));
}

export function applyGate(
  score: number,
  risk: "low" | "medium" | "high" = "low",
): boolean {
  const th = risk === "high" ? 0.2 : risk === "medium" ? 0.35 : 0.5;
  return score >= th;
}

export function toPatchCard(
  id: string,
  applies: boolean,
  base: any,
  score: number,
  why: string[],
): PatchCard {
  return {
    id,
    applies,
    selectors: base?.selectors,
    score,
    deltas: base?.deltas || {},
    evidence: why,
  };
}
