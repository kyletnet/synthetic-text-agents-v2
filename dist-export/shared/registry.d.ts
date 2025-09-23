import { BaseAgent } from "../core/baseAgent.js";
export { BaseAgent };
export declare class AgentRegistry {
  private agents;
  constructor();
  register(agent: BaseAgent): void;
  getAgent(id: string): BaseAgent | undefined;
}
//# sourceMappingURL=registry.d.ts.map
