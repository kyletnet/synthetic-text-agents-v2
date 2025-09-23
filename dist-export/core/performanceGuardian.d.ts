import { AgentResult } from "../shared/types.js";
interface GuardianResult extends AgentResult {
  ok: boolean;
  issues?: string[];
  vetoed?: boolean;
}
export declare class PerformanceGuardian {
  private minQuality;
  private maxLatencyMs;
  evaluate(result: AgentResult): GuardianResult;
}
export {};
//# sourceMappingURL=performanceGuardian.d.ts.map
