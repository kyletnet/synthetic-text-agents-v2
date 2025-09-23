import { BaseAgent } from "../core/baseAgent.js";
import { AgentContext } from "../shared/types.js";
export declare class QAGenerator extends BaseAgent {
  constructor();
  protected handle(content: unknown, context?: AgentContext): Promise<unknown>;
  private extractQAFromText;
  private mock;
}
//# sourceMappingURL=qaGenerator.d.ts.map
