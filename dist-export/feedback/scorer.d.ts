import type { RunLog, PatchCard } from "./types";
export declare function scorePatch(run: RunLog, base: any): number;
export declare function applyGate(
  score: number,
  risk?: "low" | "medium" | "high",
): boolean;
export declare function toPatchCard(
  id: string,
  applies: boolean,
  base: any,
  score: number,
  why: string[],
): PatchCard;
//# sourceMappingURL=scorer.d.ts.map
