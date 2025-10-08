/**
 * Linguistics Prompt Templates
 *
 * Centralized prompt templates for Linguistics Engineer operations.
 * All prompts are externalized here per CLAUDE.md standards.
 */

export interface PromptTemplate {
  id: string;
  name: string;
  template: string;
  variables: string[];
}

/**
 * Model-specific instruction templates
 */
export const MODEL_INSTRUCTION_TEMPLATES = {
  claude: {
    excellent: `You are optimizing prompts for Claude, which has excellent instruction following.
Use detailed hierarchical structure with:
- Role definition and context
- Task specification with quality criteria
- Domain expertise requirements
- Output format and structure
- Quality validation guidelines
- Inline example demonstrations

Use imperative voice, numbered lists, explicit quality thresholds, and clear delimiters.`,

    good: `You are optimizing prompts for Claude with good instruction following.
Use structured format with examples:
- Clear role and task definition
- Specific requirements and constraints
- Domain context and expertise level
- Output format specification
- Quality examples

Use clear, direct language with examples to clarify expectations.`,
  },

  gpt: {
    excellent: `You are optimizing prompts for GPT-4, which has excellent instruction following.
Use detailed hierarchical structure with meta-instructions and explicit quality monitoring.
Include conditional branching and multi-level instruction hierarchy.`,

    good: `You are optimizing prompts for GPT with good instruction following.
Use structured format with clear examples after each section.
Repeat key requirements in different sections for clarity.`,
  },

  gemini: {
    good: `You are optimizing prompts for Gemini with moderate instruction following.
Use simple, direct instructions with:
- Clear task definition
- Basic requirements
- Simple examples before instructions
- Repeated important points`,

    moderate: `You are optimizing prompts for Gemini.
Keep instructions simple and direct. Minimize complex terminology.
Provide clear examples and repeat important points.`,
  },

  generic: {
    moderate: `You are optimizing prompts for a generic LLM.
Use simple, direct language:
- Task definition
- Basic requirements
- Output format
- Simple examples

Minimize jargon and provide clear examples.`,
  },
};

/**
 * Domain-specific terminology templates
 */
export const DOMAIN_TERMINOLOGY_TEMPLATES = {
  customer_service: {
    introduction: `This is a customer service domain task requiring specific terminology:
- Use terms like "customer satisfaction", "service level agreement", "escalation"
- Technical concepts: CRM integration, omnichannel support, first call resolution
- Industry jargon: churn rate, NPS, CSAT, FCR, AHT`,

    guidelines: `Terminology guidelines for customer service:
- Refer to external parties as "customers" or "clients"
- Use "issue" or "concern" rather than "problem"
- Prefer "resolution" over "fix"`,
  },

  sales: {
    introduction: `This is a sales domain task requiring specific terminology:
- Use terms like "pipeline", "lead qualification", "conversion", "prospect"
- Technical concepts: sales funnel optimization, lead scoring, account-based selling
- Industry jargon: MQL, SQL, CAC, LTV, ARR`,

    guidelines: `Terminology guidelines for sales:
- Refer to potential customers as "prospects" or "leads"
- Use "closing" or "finalizing" for completed deals
- Handle objections professionally as "concerns" or "considerations"`,
  },

  marketing: {
    introduction: `This is a marketing domain task requiring specific terminology:
- Use terms like "brand awareness", "target audience", "campaign performance"
- Technical concepts: attribution modeling, marketing automation, personalization
- Industry jargon: CTR, CPC, ROAS, LTV, CAC`,

    guidelines: `Terminology guidelines for marketing:
- Refer to groups as "target audience" or "segment"
- Use "campaign" or "initiative" for marketing programs
- Measure success with "conversion rate" and "engagement"`,
  },
};

/**
 * Quality level prompt enhancements
 */
export const QUALITY_ENHANCEMENT_TEMPLATES = {
  high_quality: `QUALITY REQUIREMENTS (9/10+):
- Every sentence must add clear, unique value
- Eliminate all redundant or filler language
- Include innovation and uniqueness requirements
- Specify expert-level depth expectations
- Provide exact methodologies and step-by-step procedures
- Address potential misinterpretations proactively`,

  standard_quality: `QUALITY REQUIREMENTS (7-8/10):
- Maintain professional language and clear structure
- Ensure completeness and domain accuracy
- Provide actionable guidance
- Use consistent terminology`,

  basic_quality: `QUALITY REQUIREMENTS (5-6/10):
- Clear and understandable language
- Complete responses to questions
- Appropriate formatting`,
};

/**
 * Complexity level adjustments
 */
export const COMPLEXITY_TEMPLATES = {
  high_complexity: `COMPLEXITY HANDLING (8-10):
- Break down complex concepts into digestible components
- Use progressive disclosure for layered understanding
- Include advanced reasoning guidelines
- Address edge case handling explicitly
- Provide context for relationships between complex concepts`,

  medium_complexity: `COMPLEXITY HANDLING (5-7):
- Use clear structure with logical progression
- Provide examples for key concepts
- Balance technical accuracy with accessibility`,

  low_complexity: `COMPLEXITY HANDLING (1-4):
- Use simple, direct language without jargon
- Include explanations for all technical terms
- Provide concrete, easy-to-understand examples
- Use plain language alternatives`,
};

/**
 * Output format templates
 */
export const OUTPUT_FORMAT_TEMPLATES = {
  "qa-pairs": `OUTPUT FORMAT:
Format each Q&A pair as:
Q: [Question text]
A: [Answer text]

VALIDATION:
- Each line must contain exactly one Q: and one A: section
- Questions must end with appropriate punctuation
- Answers must be complete sentences or paragraphs`,

  structured: `OUTPUT FORMAT:
Provide output as JSON structure:
{
  "question": "Question text",
  "answer": "Answer text",
  "metadata": {
    "complexity": number,
    "domain": "string"
  }
}

VALIDATION:
- Valid JSON syntax required
- All required fields must be present
- Verify data types match specifications`,

  conversational: `OUTPUT FORMAT:
Use natural dialogue patterns with:
- Conversational tone and transitions
- Appropriate conversational markers
- Balance of formality and accessibility
- Empathetic and engaging language`,
};

/**
 * Token optimization templates
 */
export const TOKEN_OPTIMIZATION_TEMPLATES = {
  aggressive: `TOKEN OPTIMIZATION (High priority):
- Consolidate similar instructions into single statements
- Use abbreviations for frequently repeated terms
- Remove redundant examples and explanations
- Simplify language and reduce technical terminology
- Combine related sections to reduce overall length`,

  moderate: `TOKEN OPTIMIZATION (Moderate priority):
- Remove unnecessary words while maintaining clarity
- Use concise language where possible
- Eliminate redundant explanations`,

  minimal: `TOKEN OPTIMIZATION (Low priority):
- Maintain clarity and completeness as primary goals
- Token efficiency is secondary to quality`,
};

/**
 * Helper function to build complete prompt from templates
 */
export function buildLinguisticsPrompt(config: {
  targetLLM: string;
  instructionLevel: string;
  domain?: string;
  qualityLevel?: string;
  complexityLevel?: string;
  outputFormat?: string;
  tokenOptimization?: string;
}): string {
  const sections: string[] = [];

  // Add model instructions
  const modelTemplates =
    MODEL_INSTRUCTION_TEMPLATES[
      config.targetLLM as keyof typeof MODEL_INSTRUCTION_TEMPLATES
    ];
  if (modelTemplates) {
    const instruction =
      modelTemplates[config.instructionLevel as keyof typeof modelTemplates];
    if (instruction) {
      sections.push(instruction);
    }
  }

  // Add domain terminology
  if (config.domain) {
    const domainTemplate =
      DOMAIN_TERMINOLOGY_TEMPLATES[
        config.domain as keyof typeof DOMAIN_TERMINOLOGY_TEMPLATES
      ];
    if (domainTemplate) {
      sections.push(domainTemplate.introduction);
      sections.push(domainTemplate.guidelines);
    }
  }

  // Add quality requirements
  if (config.qualityLevel) {
    const qualityTemplate =
      QUALITY_ENHANCEMENT_TEMPLATES[
        config.qualityLevel as keyof typeof QUALITY_ENHANCEMENT_TEMPLATES
      ];
    if (qualityTemplate) {
      sections.push(qualityTemplate);
    }
  }

  // Add complexity handling
  if (config.complexityLevel) {
    const complexityTemplate =
      COMPLEXITY_TEMPLATES[
        config.complexityLevel as keyof typeof COMPLEXITY_TEMPLATES
      ];
    if (complexityTemplate) {
      sections.push(complexityTemplate);
    }
  }

  // Add output format
  if (config.outputFormat) {
    const formatTemplate =
      OUTPUT_FORMAT_TEMPLATES[
        config.outputFormat as keyof typeof OUTPUT_FORMAT_TEMPLATES
      ];
    if (formatTemplate) {
      sections.push(formatTemplate);
    }
  }

  // Add token optimization
  if (config.tokenOptimization) {
    const tokenTemplate =
      TOKEN_OPTIMIZATION_TEMPLATES[
        config.tokenOptimization as keyof typeof TOKEN_OPTIMIZATION_TEMPLATES
      ];
    if (tokenTemplate) {
      sections.push(tokenTemplate);
    }
  }

  return sections.join("\n\n");
}
