/**
 * GCG (Guideline → Constraint Grammar) Compiler
 *
 * Converts human-readable guideline documents (Markdown) into
 * machine-enforceable constraint grammars (YAML).
 *
 * Purpose:
 * - Maintain human readability (guideline = single source of truth)
 * - Enable machine enforcement (constraints automatically applied)
 * - Ensure versioning and backward compatibility
 *
 * @see docs/GUIDELINES_TO_GCG.md
 */

import * as fs from 'fs';
import * as yaml from 'yaml';

/**
 * Grammar Structure
 */
export interface Grammar {
  version: string;
  domain: string;
  compliance?: string[];
  rules: {
    number_format?: NumberFormatRule;
    tone?: ToneRule;
    structure?: StructureRule;
    citation?: CitationRule;
    forbidden?: ForbiddenRule;
    question_types?: QuestionTypeRule;
    answer_format?: AnswerFormatRule;
  };
  metadata: {
    source: string;
    created_at: string;
    author: string;
  };
}

/**
 * Number Format Rule
 */
export interface NumberFormatRule {
  pattern: string;
  unit_required: boolean;
  allowed_units: string[];
  format: 'arabic' | 'korean' | 'mixed'; // 아라비아 숫자/한글/혼합
}

/**
 * Tone Rule
 */
export interface ToneRule {
  allowed: string[];
  markers: {
    exclamation?: boolean; // !
    question?: boolean; // ?
    ellipsis?: boolean; // ...
  };
  formality: 'formal' | 'informal' | 'mixed';
}

/**
 * Structure Rule
 */
export interface StructureRule {
  type: 'svo' | 'free';
  max_sentence_length: number;
  bullet_max: number;
  min_sentences: number;
  max_sentences: number;
}

/**
 * Citation Rule
 */
export interface CitationRule {
  mandatory: boolean;
  min_sources: number;
  format: string;
  per_paragraph: boolean;
}

/**
 * Forbidden Rule
 */
export interface ForbiddenRule {
  ngrams: string[];
  patterns: string[];
}

/**
 * Question Type Rule
 */
export interface QuestionTypeRule {
  allowed_types: string[];
  difficulty_levels: string[];
  forbidden_patterns: string[];
}

/**
 * Answer Format Rule
 */
export interface AnswerFormatRule {
  min_length: number;
  max_length: number;
  structure: string; // 'direct-first' | 'condition-result' | etc
  required_elements: string[];
}

/**
 * GCG Compiler
 *
 * Parses Markdown guidelines and generates YAML constraint grammar.
 */
export class GCGCompiler {
  /**
   * Compile Markdown guideline → YAML grammar
   */
  compile(guidelinePath: string): Grammar {
    const markdown = fs.readFileSync(guidelinePath, 'utf-8');
    const grammar = this.parseMarkdown(markdown, guidelinePath);
    return grammar;
  }

  /**
   * Parse Markdown and extract rules
   */
  private parseMarkdown(markdown: string, source: string): Grammar {
    const grammar: Grammar = {
      version: '1.0.0',
      domain: 'general',
      rules: {},
      metadata: {
        source,
        created_at: new Date().toISOString(),
        author: 'system',
      },
    };

    // Extract domain from filename or content
    grammar.domain = this.extractDomain(source, markdown);

    // Parse Number Format rules
    if (markdown.includes('숫자 표현') || markdown.includes('Number')) {
      grammar.rules.number_format = this.parseNumberFormat(markdown);
    }

    // Parse Tone rules
    if (markdown.includes('톤') || markdown.includes('Tone') || markdown.includes('문체')) {
      grammar.rules.tone = this.parseTone(markdown);
    }

    // Parse Structure rules
    if (markdown.includes('답변 구조') || markdown.includes('Answer') || markdown.includes('Structure')) {
      grammar.rules.structure = this.parseStructure(markdown);
    }

    // Parse Citation rules
    if (markdown.includes('출처') || markdown.includes('인용') || markdown.includes('Citation')) {
      grammar.rules.citation = this.parseCitation(markdown);
    }

    // Parse Forbidden rules
    if (markdown.includes('금지') || markdown.includes('Forbidden') || markdown.includes('권장하지 않는')) {
      grammar.rules.forbidden = this.parseForbidden(markdown);
    }

    // Parse Question Type rules
    if (markdown.includes('질문 유형') || markdown.includes('Question')) {
      grammar.rules.question_types = this.parseQuestionTypes(markdown);
    }

    // Parse Answer Format rules
    if (markdown.includes('답변 방식') || markdown.includes('답변 생성')) {
      grammar.rules.answer_format = this.parseAnswerFormat(markdown);
    }

    return grammar;
  }

  /**
   * Extract domain from source or content
   */
  private extractDomain(source: string, markdown: string): string {
    // Check content first (more accurate)
    if (markdown.includes('휴가') || markdown.includes('휴직') || markdown.includes('연차') || markdown.includes('경조사')) return 'hr';
    if (markdown.includes('의료') || markdown.includes('medical') || markdown.includes('진료') || markdown.includes('치료')) return 'medical';
    if (markdown.includes('금융') || markdown.includes('finance') || markdown.includes('투자') || markdown.includes('대출')) return 'finance';
    if (markdown.includes('법률') || markdown.includes('legal') || markdown.includes('계약') || markdown.includes('소송')) return 'legal';

    // Check filename
    if (source.includes('hr') || source.includes('인사') || source.includes('휴가')) return 'hr';
    if (source.includes('medical') || source.includes('의료')) return 'medical';
    if (source.includes('finance') || source.includes('금융')) return 'finance';
    if (source.includes('legal') || source.includes('법률')) return 'legal';

    return 'general';
  }

  /**
   * Parse Number Format rules
   */
  private parseNumberFormat(markdown: string): NumberFormatRule {
    const rule: NumberFormatRule = {
      pattern: '^[0-9,]+$',
      unit_required: false,
      allowed_units: [],
      format: 'arabic',
    };

    // Check unit requirement
    if (markdown.includes('한글 단위') || markdown.includes('단위를') || markdown.includes('+ "')) {
      rule.unit_required = true;
    }

    // Extract allowed units
    const unitMatches = markdown.match(/["'](\d+)(일|원|년|개월|퍼센트|세|명|회|번)["']/g);
    if (unitMatches) {
      const units = unitMatches.map((m) => {
        const match = m.match(/(일|원|년|개월|퍼센트|세|명|회|번)/);
        return match ? match[1] : '';
      }).filter((u) => u);
      rule.allowed_units = [...new Set(units)];
    }

    // Determine format (아라비아 숫자 + 한글)
    if (markdown.includes('아라비아 숫자') && markdown.includes('한글')) {
      rule.format = 'mixed';
    }

    return rule;
  }

  /**
   * Parse Tone rules
   */
  private parseTone(markdown: string): ToneRule {
    const rule: ToneRule = {
      allowed: [],
      markers: {},
      formality: 'formal',
    };

    // Determine formality
    if (markdown.includes('격식체') || markdown.includes('formal')) {
      rule.formality = 'formal';
      rule.allowed.push('formal');
    }
    if (markdown.includes('비격식') || markdown.includes('informal')) {
      rule.formality = 'informal';
      rule.allowed.push('informal');
    }

    // Check markers (느낌표 금지 등)
    if (markdown.includes('느낌표') || markdown.includes('exclamation')) {
      // 금지 여부 확인
      rule.markers.exclamation = !markdown.match(/느낌표.*금지|exclamation.*forbidden/i);
    }

    if (markdown.includes('물음표') || markdown.includes('question')) {
      rule.markers.question = !!markdown.match(/물음표.*가능|question.*allowed/i);
    }

    return rule;
  }

  /**
   * Parse Structure rules
   */
  private parseStructure(markdown: string): StructureRule {
    const rule: StructureRule = {
      type: 'svo',
      max_sentence_length: 100,
      bullet_max: 5,
      min_sentences: 1,
      max_sentences: 5,
    };

    // Extract sentence count limits
    const sentenceMatch = markdown.match(/(\d+)[~\-](\d+)\s*문장/);
    if (sentenceMatch) {
      rule.min_sentences = parseInt(sentenceMatch[1]);
      rule.max_sentences = parseInt(sentenceMatch[2]);
    }

    return rule;
  }

  /**
   * Parse Citation rules
   */
  private parseCitation(markdown: string): CitationRule {
    const rule: CitationRule = {
      mandatory: false,
      min_sources: 1,
      format: '[Source: {title}]',
      per_paragraph: false,
    };

    // Check if citation is mandatory
    if (markdown.includes('반드시') || markdown.includes('필수') || markdown.includes('mandatory')) {
      rule.mandatory = true;
    }

    // Check per-paragraph requirement
    if (markdown.includes('단락당') || markdown.includes('per paragraph')) {
      rule.per_paragraph = true;
    }

    return rule;
  }

  /**
   * Parse Forbidden rules
   */
  private parseForbidden(markdown: string): ForbiddenRule {
    const rule: ForbiddenRule = {
      ngrams: [],
      patterns: [],
    };

    // Extract forbidden words/phrases
    // Look for patterns like: ❌ "word" or "금지" or "forbidden"
    const forbiddenMatches = markdown.match(/❌\s*["']([^"']+)["']|금지[:\s]+["']([^"']+)["']/g);
    if (forbiddenMatches) {
      const words = forbiddenMatches.map((m) => {
        const match = m.match(/["']([^"']+)["']/);
        return match ? match[1] : '';
      }).filter((w) => w);
      rule.ngrams = [...new Set(words)];
    }

    // Extract forbidden patterns from sections
    const forbiddenSection = this.extractSection(markdown, '권장하지 않는');
    if (forbiddenSection) {
      const patterns = forbiddenSection.match(/❌\s*["']([^"']+)["']/g);
      if (patterns) {
        const patternList = patterns.map((p) => {
          const match = p.match(/["']([^"']+)["']/);
          return match ? match[1] : '';
        }).filter((p) => p);
        rule.patterns.push(...patternList);
      }
    }

    return rule;
  }

  /**
   * Parse Question Type rules
   */
  private parseQuestionTypes(markdown: string): QuestionTypeRule {
    const rule: QuestionTypeRule = {
      allowed_types: [],
      difficulty_levels: [],
      forbidden_patterns: [],
    };

    // Extract question types (1. 기본 정보 확인형, 2. 조건부, etc.)
    const typeMatches = markdown.match(/###?\s*\d+[\.\)]\s*([^\n]+형)/g);
    if (typeMatches) {
      rule.allowed_types = typeMatches.map((m) => {
        const match = m.match(/###?\s*\d+[\.\)]\s*([^\n]+)/);
        return match ? match[1].trim() : '';
      }).filter((t) => t);
    }

    // Extract difficulty levels
    if (markdown.includes('난이도')) {
      const difficultyMatches = markdown.match(/난이도[:\s]+([하중상])/g);
      if (difficultyMatches) {
        rule.difficulty_levels = [...new Set(difficultyMatches.map((m) => {
          const match = m.match(/난이도[:\s]+([하중상])/);
          return match ? match[1] : '';
        }))];
      }
    }

    return rule;
  }

  /**
   * Parse Answer Format rules
   */
  private parseAnswerFormat(markdown: string): AnswerFormatRule {
    const rule: AnswerFormatRule = {
      min_length: 50,
      max_length: 500,
      structure: 'direct-first',
      required_elements: [],
    };

    // Extract sentence count requirements
    const sentenceMatch = markdown.match(/(\d+)[~\-](\d+)\s*문장/);
    if (sentenceMatch) {
      rule.min_length = parseInt(sentenceMatch[1]) * 30; // ~30 chars per sentence
      rule.max_length = parseInt(sentenceMatch[2]) * 100;
    }

    // Determine structure pattern
    if (markdown.includes('핵심 답변') && markdown.includes('보충')) {
      rule.structure = 'direct-first';
    } else if (markdown.includes('조건') && markdown.includes('결과')) {
      rule.structure = 'condition-result';
    }

    return rule;
  }

  /**
   * Extract section from markdown
   */
  private extractSection(markdown: string, header: string): string {
    const startIdx = markdown.indexOf(header);
    if (startIdx === -1) return '';

    const nextHeaderIdx = markdown.indexOf('\n## ', startIdx + 1);
    if (nextHeaderIdx === -1) {
      return markdown.substring(startIdx);
    }
    return markdown.substring(startIdx, nextHeaderIdx);
  }

  /**
   * Save grammar to YAML file
   */
  save(grammar: Grammar, outputPath: string): void {
    const yamlContent = yaml.stringify(grammar);
    const dir = require('path').dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outputPath, yamlContent, 'utf-8');
  }

  /**
   * Load grammar from YAML file
   */
  load(grammarPath: string): Grammar {
    const yamlContent = fs.readFileSync(grammarPath, 'utf-8');
    return yaml.parse(yamlContent);
  }

  /**
   * Validate grammar structure
   */
  validate(grammar: Grammar): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!grammar.version) {
      errors.push('Missing version');
    }

    if (!grammar.domain) {
      errors.push('Missing domain');
    }

    if (!grammar.rules || Object.keys(grammar.rules).length === 0) {
      errors.push('No rules defined');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
