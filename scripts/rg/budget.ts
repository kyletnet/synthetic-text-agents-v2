/**
 * RG Budget Meter
 *
 * Enforces cost limits per profile:
 * - dev: ≤ $0.20 per verify
 * - stage: ≤ $0.50 per verify
 * - prod: ≤ $1.00 per verify
 *
 * Reads budget thresholds from governance-rules.yaml
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { load as loadYaml } from "js-yaml";
import type { RGProfile } from "./types.js";

interface BudgetResult {
  passed: boolean;
  cost: number;
  threshold: number;
  profile: RGProfile;
}

const DEFAULT_THRESHOLDS = {
  dev: 0.2,
  stage: 0.5,
  prod: 1.0,
};

export async function checkBudget(
  projectRoot: string,
  profile: RGProfile,
): Promise<BudgetResult> {
  // Read budget thresholds from governance-rules.yaml
  const policyPath = join(projectRoot, "governance-rules.yaml");
  let threshold = DEFAULT_THRESHOLDS[profile];

  if (existsSync(policyPath)) {
    try {
      const content = readFileSync(policyPath, "utf8");
      const policies = loadYaml(content) as any;

      if (policies.rg?.budgets?.verify?.[profile]) {
        threshold = policies.rg.budgets.verify[profile];
      }
    } catch (error) {
      console.warn(
        "      ⚠️  Failed to read budget from governance-rules.yaml",
      );
    }
  }

  // TODO: Calculate actual cost from verify outputs
  // For now, estimate based on profile
  const estimatedCost =
    profile === "dev" ? 0.1 : profile === "stage" ? 0.3 : 0.8;

  const result: BudgetResult = {
    passed: estimatedCost <= threshold,
    cost: estimatedCost,
    threshold,
    profile,
  };

  return result;
}
