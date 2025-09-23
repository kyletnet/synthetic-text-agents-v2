import { Logger } from "../shared/logger.js";
import { appendJSONL } from "../shared/jsonl.js";
export class ABTestManager {
  variants = new Map();
  activeTests = new Map(); // testId -> variantIds
  logger;
  orchestrator;
  constructor(orchestrator) {
    this.orchestrator = orchestrator;
    this.logger = new Logger();
    this.initializeDefaultVariants();
  }
  initializeDefaultVariants() {
    // Variant A: Conservative approach (fewer agents)
    this.variants.set("conservative", {
      id: "conservative",
      name: "Conservative Approach",
      description: "최소한의 에이전트로 빠른 처리",
      agentSelection: (_complexity, _domain) => {
        const agents = ["qa-generator", "quality-auditor"];
        if (_complexity >= 7) agents.push("prompt-architect");
        if (_domain && _domain !== "general") agents.push("domain-consultant");
        return agents;
      },
      enabled: true,
    });
    // Variant B: Balanced approach (current default)
    this.variants.set("balanced", {
      id: "balanced",
      name: "Balanced Approach",
      description: "복잡도에 따른 균형잡힌 에이전트 선택",
      agentSelection: (_complexity, _domain) => {
        const agents = ["meta-controller", "quality-auditor"];
        if (_complexity >= 6) agents.push("prompt-architect", "qa-generator");
        if (_complexity >= 8)
          agents.push("psychology-specialist", "linguistics-engineer");
        if (_domain && _domain !== "general") agents.push("domain-consultant");
        if (_complexity >= 9) agents.push("cognitive-scientist");
        return agents;
      },
      enabled: true,
    });
    // Variant C: Comprehensive approach (maximum agents)
    this.variants.set("comprehensive", {
      id: "comprehensive",
      name: "Comprehensive Approach",
      description: "모든 전문가 에이전트 동원하여 최고 품질",
      agentSelection: (_complexity, _domain) => {
        return [
          "meta-controller",
          "prompt-architect",
          "qa-generator",
          "quality-auditor",
          "psychology-specialist",
          "linguistics-engineer",
          "domain-consultant",
          "cognitive-scientist",
        ];
      },
      enabled: true,
    });
    // Variant D: Specialist focused
    this.variants.set("specialist", {
      id: "specialist",
      name: "Specialist Focused",
      description: "도메인과 언어학 전문가 중심",
      agentSelection: (_complexity, _domain) => {
        const agents = [
          "qa-generator",
          "quality-auditor",
          "linguistics-engineer",
        ];
        if (_domain && _domain !== "general") {
          agents.push("domain-consultant", "cognitive-scientist");
        }
        if (_complexity >= 8) agents.push("psychology-specialist");
        return agents;
      },
      enabled: true,
    });
  }
  /**
   * A/B 테스트 시작
   */
  async startTest(testId, variantIds, sampleSize = 100) {
    // Validate variants exist
    for (const variantId of variantIds) {
      if (!this.variants.has(variantId)) {
        throw new Error(`Variant ${variantId} does not exist`);
      }
    }
    this.activeTests.set(testId, variantIds);
    await this.logger.trace({
      level: "info",
      agentId: "ab-test-manager",
      action: "test_started",
      data: { testId, variantIds, sampleSize },
    });
    // Initialize test results file
    appendJSONL(`reports/ab_tests/${testId}_results.jsonl`, {
      testId,
      action: "test_initialized",
      variantIds,
      sampleSize,
      timestamp: new Date().toISOString(),
    });
  }
  /**
   * 특정 variant로 요청 처리 및 결과 기록
   */
  async processRequestWithVariant(variantId, request, testId) {
    const variant = this.variants.get(variantId);
    if (!variant?.enabled) {
      throw new Error(`Variant ${variantId} not found or disabled`);
    }
    const startTime = Date.now();
    try {
      // Temporarily override agent selection logic
      const originalSelectAgents = this.orchestrator.selectAgents;
      this.orchestrator.selectAgents = variant.agentSelection;
      const response = await this.orchestrator.processRequest(request);
      const processingTime = Date.now() - startTime;
      // Calculate quality metrics
      const metrics = this.calculateMetrics(response);
      // Estimate cost (rough approximation)
      const estimatedCost = this.estimateCost(response);
      // Record test result
      const testResult = {
        variantId,
        testId: testId || "manual",
        timestamp: new Date().toISOString(),
        request,
        response,
        metrics,
        processingTime,
        cost: estimatedCost,
      };
      if (testId) {
        appendJSONL(`reports/ab_tests/${testId}_results.jsonl`, testResult);
      }
      // Restore original agent selection
      this.orchestrator.selectAgents = originalSelectAgents;
      await this.logger.trace({
        level: "info",
        agentId: "ab-test-manager",
        action: "variant_processed",
        data: {
          variantId,
          testId,
          processingTime,
          qualityScore: metrics.qualityScore,
        },
      });
      return { response, metrics };
    } catch (error) {
      await this.logger.trace({
        level: "error",
        agentId: "ab-test-manager",
        action: "variant_failed",
        data: { variantId, testId, error: String(error) },
      });
      throw error;
    }
  }
  /**
   * A/B 테스트 자동 실행
   */
  async runAutomatedTest(testId, testRequests, variantIds) {
    const variants =
      variantIds ||
      Array.from(this.activeTests.get(testId) || this.variants.keys());
    await this.logger.trace({
      level: "info",
      agentId: "ab-test-manager",
      action: "automated_test_started",
      data: { testId, requestCount: testRequests.length, variants },
    });
    for (const request of testRequests) {
      for (const variantId of variants) {
        try {
          await this.processRequestWithVariant(variantId, request, testId);
          // Add small delay to avoid overwhelming the system
          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (error) {
          await this.logger.trace({
            level: "error",
            agentId: "ab-test-manager",
            action: "automated_test_request_failed",
            data: {
              testId,
              variantId,
              request: request.topic,
              error: String(error),
            },
          });
        }
      }
    }
    await this.logger.trace({
      level: "info",
      agentId: "ab-test-manager",
      action: "automated_test_completed",
      data: { testId },
    });
  }
  /**
   * 테스트 결과 분석
   */
  async analyzeTestResults(testId) {
    // This would read from the JSONL file and calculate statistics
    // For now, we'll return a simplified version
    const variants = {};
    const activeVariants = this.activeTests.get(testId) || [];
    for (const variantId of activeVariants) {
      variants[variantId] = {
        variantId,
        sampleSize: 0,
        averageProcessingTime: 0,
        averageQualityScore: 0,
        averageConfidence: 0,
        totalCost: 0,
        successRate: 0,
      };
    }
    const summary = {
      testId,
      totalRequests: 0,
      bestVariant: activeVariants[0] || "balanced",
      significantDifference: false,
      recommendedAction: "Continue testing",
    };
    return { variants, summary };
  }
  calculateMetrics(response) {
    const questions = response.questions || [];
    const averageConfidence =
      questions.length > 0
        ? questions.reduce((sum, q) => sum + (q.confidence || 0), 0) /
          questions.length
        : 0;
    // Simple quality scoring based on available data
    const qualityScore =
      response.metadata?.qualityScore || averageConfidence * 10; // Convert 0-1 to 0-10 scale
    // Calculate diversity (unique question types)
    const uniqueStarters = new Set(
      questions.map((q) => (q.question || "").split(" ").slice(0, 2).join(" ")),
    ).size;
    const diversityScore =
      questions.length > 0 ? (uniqueStarters / questions.length) * 10 : 0;
    // Coherence score (based on answer length and structure)
    const averageAnswerLength =
      questions.length > 0
        ? questions.reduce((sum, q) => sum + (q.answer || "").length, 0) /
          questions.length
        : 0;
    const coherenceScore = Math.min(10, averageAnswerLength / 50); // Normalize to 0-10
    // Agent collaboration score (based on agents used)
    const agentsUsed = response.metadata?.agentsUsed?.length || 1;
    const agentCollaborationScore = Math.min(10, agentsUsed * 1.5);
    return {
      averageConfidence,
      qualityScore,
      diversityScore,
      coherenceScore,
      agentCollaborationScore,
    };
  }
  estimateCost(response) {
    // Simple cost estimation based on processing time and agents used
    const baseRate = 0.001; // $0.001 per processing second
    const processingTime = response.metadata?.processTime || 1000;
    const agentCount = response.metadata?.agentsUsed?.length || 1;
    return (processingTime / 1000) * baseRate * agentCount;
  }
  /**
   * Get available variants
   */
  getVariants() {
    return Array.from(this.variants.values());
  }
  /**
   * Get active tests
   */
  getActiveTests() {
    return Object.fromEntries(this.activeTests);
  }
}
//# sourceMappingURL=abTestManager.js.map
