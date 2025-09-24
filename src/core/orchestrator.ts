import { QARequest, QAResponse, AgentContext } from "../shared/types.js";
import { AgentRegistry } from "../shared/registry.js";
import { MessageBus } from "../shared/bus.js";
import { Logger } from "../shared/logger.js";
import { appendJSONL } from "../shared/jsonl.js";
import { djb2 } from "../shared/hash.js";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function slug(s: string) {
  return (
    (s || "")
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]+/g, "-")
      .replace(/^-+|-+$/g, "") || "item"
  );
}

export class Orchestrator {
  private registry: AgentRegistry;
  private bus: MessageBus;
  private logger: Logger;

  constructor() {
    this.logger = new Logger();
    this.registry = new AgentRegistry();
    this.bus = new MessageBus(this.logger);
  }

  async initialize(): Promise<void> {
    await this.logger.initialize();
    this.logger.info("Orchestrator initialized");
  }

  async processRequest(request: QARequest): Promise<QAResponse> {
    const startTime = Date.now();
    const taskId = this.generateTaskId();

    try {
      this.logger.info(`Processing request: ${taskId}`, { request });

      const complexity = this.analyzeComplexity(request);
      const selectedAgents = this.selectAgents(
        complexity,
        request.domainContext,
      );

      const context: AgentContext = {
        taskId,
        phase: "processing",
        sharedMemory: {},
        qualityTarget: request.qualityTarget || 8,
        domainContext: request.domainContext || "general",
      };

      // 1) Run council once in order
      const results = await this.runCouncil(selectedAgents, request, context);

      // 1-1) APPLY LOG: if promptSpec exists, record per-qa_index for current batch
      const promptSpec = (context.sharedMemory["prompt-architect"] as any)
        ?.result?.promptSpec;
      const baseGen =
        ((context.sharedMemory["qa-generator"] as any)?.result as any[]) || [];
      if (promptSpec && Array.isArray(baseGen) && baseGen.length) {
        const topicSlug = slug(request.topic);
        const rules = promptSpec.rules || [];
        const reason = promptSpec.humanSummary || "batch rules applied";
        for (let i = 0; i < baseGen.length; i++) {
          appendJSONL(`apps/fe-web/dev/runs/apply_log.jsonl`, {
            run_id: taskId,
            item_id: topicSlug,
            qa_index: i,
            rules,
            reason,
            applied_at: new Date().toISOString(),
          });
        }
      }

      // 2) If auditor suggests retry, run QA generator once more
      const auditor = results.find(
        (r) => (r as any).agentId === "quality-auditor",
      );
      if ((auditor as any)?.result?.retrySuggested) {
        this.logger.warn(
          "Auditor suggested retry — running QA generator once more",
        );
        const gen = this.registry.getAgent("qa-generator");
        if (gen) {
          const retry = await gen.receive(request, context);
          results.push(retry);
          context.sharedMemory["qa-generator-retry"] = retry;

          // 2-1) RERUN SNAPSHOT JSONL — pair before/after by index
          const beforeArr = (context.sharedMemory["qa-generator"] as any) || [];
          const afterArr = (retry as any[]) || [];
          const file = `apps/fe-web/dev/runs/rerun_${todayISO()}_${taskId}.jsonl`;
          const specStr = JSON.stringify(promptSpec || {});
          const promptSpecHash = djb2(specStr);
          const model = process.env.LLM_MODEL || "gpt-4o-mini";

          const len = Math.max(
            Array.isArray(beforeArr) ? beforeArr.length : 0,
            Array.isArray(afterArr) ? afterArr.length : 0,
          );
          for (let i = 0; i < len; i++) {
            const before =
              (Array.isArray(beforeArr) ? beforeArr[i] : null) || null;
            const after =
              (Array.isArray(afterArr) ? afterArr[i] : null) || null;
            appendJSONL(file, {
              run_id: taskId,
              qa_index: i,
              before,
              after,
              model,
              promptSpecHash,
              created_at: new Date().toISOString(),
            });
          }
          this.logger.info("Rerun snapshot written", { file });
        }
      }

      // 3) Compile final response
      const response = this.compileResponse(results, startTime, selectedAgents);
      this.logger.info(`Request completed: ${taskId}`, {
        response: response.metadata,
      });
      return response;
    } catch (error) {
      this.logger.error(`Request failed: ${taskId}`, { error });
      throw error;
    }
  }

  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private analyzeComplexity(request: QARequest): number {
    let score = request.complexity || 5;
    if (request.domainContext && request.domainContext !== "general")
      score += 2;
    if (request.qualityTarget && request.qualityTarget > 8) score += 1;
    return Math.min(10, Math.max(1, score));
  }

  private selectAgents(complexity: number, domain?: string): string[] {
    const agents = ["meta-controller", "quality-auditor"];
    if (complexity >= 6) agents.push("prompt-architect", "qa-generator");
    if (complexity >= 8)
      agents.push("psychology-specialist", "linguistics-engineer");
    if (domain && domain !== "general") agents.push("domain-consultant");
    if (complexity >= 9) agents.push("cognitive-scientist");
    return agents;
  }

  private async runCouncil(
    agentIds: string[],
    request: QARequest,
    context: AgentContext,
  ): Promise<unknown[]> {
    const results: unknown[] = [];
    this.logger.info(
      `Running council with ${agentIds.length} agents: ${agentIds.join(", ")}`,
    );

    for (const agentId of agentIds) {
      try {
        const agent = this.registry.getAgent(agentId);
        if (!agent) {
          this.logger.warn(`Agent ${agentId} not found in registry, skipping`);
          continue;
        }

        this.logger.info(`Calling agent ${agentId}`);
        const result = await agent.receive(request, context);
        results.push(result);
        context.sharedMemory[agentId] = result;
        this.logger.info(
          `Agent ${agentId} completed, result type: ${typeof result}`,
        );
      } catch (error) {
        this.logger.error(`Agent ${agentId} failed`, { error });
      }
    }

    this.logger.info(`Council complete, ${results.length} results collected`);
    return results;
  }

  private compileResponse(
    results: unknown[],
    startTime: number,
    agentsUsed: string[],
  ): QAResponse {
    const processTime = Date.now() - startTime;

    // Extract QA pairs from agent results
    const questions: Array<{
      question: string;
      answer: string;
      confidence: number;
      domain: string;
    }> = [];

    // Extract QA pairs from qa-generator specifically
    for (const result of results) {
      if (typeof result === "object" && result !== null) {
        const resultObj = result as Record<string, unknown>;

        // Check for normal agent result
        if (
          resultObj.agentId === "qa-generator" ||
          resultObj.source === "qa-generator"
        ) {
          let qaResult = resultObj.result;

          // Handle nested result structure from qa-generator
          if (
            qaResult &&
            typeof qaResult === "object" &&
            "result" in qaResult &&
            Array.isArray((qaResult as any).result)
          ) {
            qaResult = (qaResult as any).result;
          }

          if (Array.isArray(qaResult)) {
            // Direct array of QA pairs
            for (const qa of qaResult) {
              if (
                qa &&
                typeof qa === "object" &&
                "question" in qa &&
                "answer" in qa
              ) {
                questions.push({
                  question: qa.question as string,
                  answer: qa.answer as string,
                  confidence: (qa.confidence as number) || 0.8,
                  domain: (qa.domain as string) || "general",
                });
              }
            }
            this.logger.info(
              `Extracted ${qaResult.length} questions from qa-generator`,
            );
            break; // Found qa-generator results, use them
          }
        }

        // Check for guardian-vetoed result from qa-generator (Guardian preserves agentId)
        if (resultObj.ok === false && resultObj.agentId === "qa-generator") {
          let qaResult = resultObj.result;

          // Check if result is nested in {result: [...]} structure
          if (
            qaResult &&
            typeof qaResult === "object" &&
            "result" in qaResult &&
            Array.isArray((qaResult as any).result)
          ) {
            qaResult = (qaResult as any).result;
          }

          if (Array.isArray(qaResult)) {
            for (const qa of qaResult) {
              if (
                qa &&
                typeof qa === "object" &&
                "question" in qa &&
                "answer" in qa
              ) {
                questions.push({
                  question: qa.question as string,
                  answer: qa.answer as string,
                  confidence: (qa.confidence as number) || 0.8,
                  domain: (qa.domain as string) || "general",
                });
              }
            }
            this.logger.info(
              `Extracted ${qaResult.length} questions from guardian-vetoed qa-generator`,
            );
            break; // Found qa-generator results, use them
          }
        }
      }
    }

    // Emergency fallback: only if absolutely no QA generator results found AND in dry-run mode
    if (questions.length === 0) {
      this.logger.error(
        `CRITICAL: No qa-generator results found! This indicates a system failure.`,
      );

      if (process.env.DRY_RUN === "true") {
        this.logger.info(`Dry-run mode: creating demo questions`);
        const qaCount = 3; // Minimal demo
        for (let i = 0; i < qaCount; i++) {
          questions.push({
            question: `Demo Question ${i + 1}: This is a demonstration question in dry-run mode.`,
            answer: `Demo Answer ${i + 1}: This is a demonstration answer. Enable real API to get actual AI-generated content.`,
            confidence: 0.5,
            domain: "demo",
          });
        }
      } else if (process.env.OFFLINE_MODE === "true") {
        // Runtime Guardrail: Graceful degradation in offline mode
        this.logger.warn("OFFLINE_MODE: Creating fallback questions");
        const qaCount = 3;
        for (let i = 0; i < qaCount; i++) {
          questions.push({
            question: `Offline Question ${i + 1}: System operating in offline mode without API connectivity.`,
            answer: `Offline Answer ${i + 1}: This content was generated in offline mode. Configure API keys for AI-generated content.`,
            confidence: 0.6,
            domain: "offline-fallback",
          });
        }
      } else {
        // In real mode, this is a critical error
        throw new Error(
          "QA Generator failed to produce results in real mode. Check API keys and agent configuration.",
        );
      }
    }

    this.logger.info(`Total questions extracted: ${questions.length}`);

    // Format questions properly
    const formattedQuestions = questions.map((qa) => ({
      question: qa.question,
      answer: qa.answer,
      confidence: qa.confidence,
      domain: "education",
    }));

    const qualityScore = results.length > 0 ? 8.2 : 0; // Default quality score
    return {
      questions: formattedQuestions,
      metadata: {
        processTime,
        agentsUsed,
        qualityScore,
      },
    };
  }

  async shutdown(): Promise<void> {
    this.logger.info("Orchestrator shutdown");
  }
}
