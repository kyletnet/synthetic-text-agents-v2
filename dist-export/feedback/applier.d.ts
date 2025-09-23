import type { PatchCard } from "./types";
export declare function conservativeMerge<T extends Record<string, any>>(
  orig: T,
  deltas: Record<string, any>,
): T;
export declare function applyPatchCard<T extends Record<string, any>>(
  obj: T,
  card: PatchCard,
): {
  result: T;
  changed: string[];
};
//# sourceMappingURL=applier.d.ts.map
