/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Terminology Validation Strategy
 *
 * Handles terminology framework development including:
 * - Domain vocabulary building
 * - Usage guidelines creation
 * - Consistency rules establishment
 */

import { BaseLinguisticsStrategy } from "./base-strategy.js";
import type {
  LinguisticsAnalysisRequest,
  TerminologyFramework,
} from "../linguistics-types.js";

export class TerminologyValidationStrategy extends BaseLinguisticsStrategy {
  constructor() {
    super("terminology-validation");
  }

  async execute(
    request: LinguisticsAnalysisRequest,
  ): Promise<TerminologyFramework> {
    const domainVocabulary = await this.buildDomainVocabulary(
      request.domain,
      request.terminologyRequirements,
    );
    const usageGuidelines = await this.createUsageGuidelines(
      request,
      domainVocabulary,
    );
    const consistencyRules = await this.establishConsistencyRules(
      domainVocabulary,
    );

    return {
      domainVocabulary,
      usageGuidelines,
      consistencyRules,
    };
  }

  private async buildDomainVocabulary(
    domain: string,
    terminologyRequirements?: string[],
  ) {
    const vocabularyMaps: Record<string, any> = {
      customer_service: {
        coreTerms: [
          "customer satisfaction",
          "service level agreement",
          "escalation",
          "resolution",
          "support ticket",
        ],
        technicalConcepts: [
          "CRM integration",
          "omnichannel support",
          "first call resolution",
          "customer journey mapping",
        ],
        industryJargon: ["churn rate", "NPS", "CSAT", "FCR", "AHT"],
        alternativeExpressions: {
          customer: ["client", "user", "consumer"],
          issue: ["problem", "concern", "challenge"],
          resolution: ["solution", "fix", "remedy"],
        },
      },
      sales: {
        coreTerms: [
          "pipeline",
          "lead qualification",
          "conversion",
          "prospect",
          "closing",
        ],
        technicalConcepts: [
          "sales funnel optimization",
          "lead scoring",
          "account-based selling",
          "objection handling",
        ],
        industryJargon: ["MQL", "SQL", "CAC", "LTV", "ARR"],
        alternativeExpressions: {
          prospect: ["potential customer", "lead", "opportunity"],
          close: ["finalize", "complete", "secure"],
          objection: ["concern", "resistance", "hesitation"],
        },
      },
      marketing: {
        coreTerms: [
          "brand awareness",
          "target audience",
          "campaign performance",
          "conversion rate",
          "engagement",
        ],
        technicalConcepts: [
          "attribution modeling",
          "marketing automation",
          "personalization",
          "segmentation",
        ],
        industryJargon: ["CTR", "CPC", "ROAS", "LTV", "CAC"],
        alternativeExpressions: {
          audience: ["target market", "demographic", "segment"],
          campaign: ["initiative", "program", "promotion"],
          conversion: ["acquisition", "success", "completion"],
        },
      },
    };

    const baseVocabulary = vocabularyMaps[domain] || {
      coreTerms: [
        "strategy",
        "implementation",
        "optimization",
        "analysis",
        "performance",
      ],
      technicalConcepts: [
        "methodology",
        "framework",
        "best practices",
        "process improvement",
      ],
      industryJargon: ["KPI", "ROI", "SOP", "QA"],
      alternativeExpressions: {
        strategy: ["approach", "plan", "method"],
        implementation: ["execution", "deployment", "rollout"],
        optimization: ["improvement", "enhancement", "refinement"],
      },
    };

    if (terminologyRequirements && terminologyRequirements.length > 0) {
      baseVocabulary.coreTerms.push(...terminologyRequirements);
    }

    return baseVocabulary;
  }

  private async createUsageGuidelines(
    request: LinguisticsAnalysisRequest,
    domainVocabulary: any,
  ) {
    const appropriateContexts: Record<string, string> = {};
    const avoidancePatterns: string[] = [];
    const clarificationNeeds: string[] = [];

    for (const term of domainVocabulary.coreTerms) {
      if (term.includes("customer") || term.includes("client")) {
        appropriateContexts[term] =
          "Use when referring to external parties receiving services";
      } else if (term.includes("process") || term.includes("strategy")) {
        appropriateContexts[term] =
          "Use when describing systematic approaches or methodologies";
      }
    }

    if (request.qualityTarget >= 8) {
      avoidancePatterns.push(
        'Avoid vague qualifiers like "might", "could", "possibly"',
      );
      avoidancePatterns.push(
        'Minimize use of generic terms like "things", "stuff", "issues"',
      );
      avoidancePatterns.push(
        "Avoid unnecessary technical jargon without explanation",
      );
    }

    if (request.complexityLevel >= 7) {
      clarificationNeeds.push("Define technical acronyms on first use");
      clarificationNeeds.push(
        "Provide context for industry-specific terminology",
      );
      clarificationNeeds.push("Explain relationships between complex concepts");
    } else {
      clarificationNeeds.push(
        "Use plain language alternatives for technical terms",
      );
      clarificationNeeds.push(
        "Include brief explanations for specialized concepts",
      );
    }

    return {
      appropriateContexts,
      avoidancePatterns,
      clarificationNeeds,
    };
  }

  private async establishConsistencyRules(domainVocabulary: any) {
    const preferredTerms: Record<string, string> = {};
    const synonymHandling: string[] = [];
    const definitionRequirements: string[] = [];

    for (const [primary, alternatives] of Object.entries(
      domainVocabulary.alternativeExpressions,
    )) {
      preferredTerms[primary] = primary;
      for (const alt of alternatives as string[]) {
        preferredTerms[alt] = primary;
      }
    }

    synonymHandling.push(
      "Use primary terminology consistently within each response",
    );
    synonymHandling.push(
      "Introduce alternatives only when clarification is needed",
    );
    synonymHandling.push("Maintain term consistency across related Q&A pairs");

    definitionRequirements.push(
      "Define technical terms on first use in each response",
    );
    definitionRequirements.push(
      "Provide context for industry-specific acronyms",
    );
    definitionRequirements.push(
      "Maintain consistent definitions across all responses",
    );

    return {
      preferredTerms,
      synonymHandling,
      definitionRequirements,
    };
  }
}
