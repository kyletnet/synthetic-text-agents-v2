import { QARequest, QAResponse } from "../shared/types.js";
export declare class Orchestrator {
  private registry;
  private bus;
  private logger;
  constructor();
  initialize(): Promise<void>;
  processRequest(request: QARequest): Promise<QAResponse>;
  private generateTaskId;
  private analyzeComplexity;
  private selectAgents;
  private runCouncil;
  private compileResponse;
  shutdown(): Promise<void>;
}
//# sourceMappingURL=orchestrator.d.ts.map
