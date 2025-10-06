/**
 * Guideline Parser
 *
 * MD 가이드라인을 파싱하여 규칙셋 JSON으로 변환
 *
 * Phase: Phase 1 (Rule-based Compliance)
 * Version: 1.0.0
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import crypto from "crypto";

// ============================================================================
// Types
// ============================================================================

export interface ParsedGuideline {
  version: string;
  generatedAt: string;
  sourceFile: string;
  sourceHash: string;
  questionTypes: QuestionType[];
  numberFormatRules: NumberFormatRule[];
  prohibitedPatterns: string[];
  answerStructureRules: AnswerStructureRule[];
  metadata: {
    totalQuestionTypes: number;
    totalRules: number;
  };
}

export interface QuestionType {
  id: string;
  name: string;
  difficulty: "하" | "중" | "중상" | "상";
  description: string;
  patterns: string[];
  examples: QuestionExample[];
}

export interface QuestionExample {
  question: string;
  answer: string;
}

export interface NumberFormatRule {
  type: "period" | "amount" | "percentage";
  format: string;
  examples: string[];
  counterExamples: string[];
}

export interface AnswerStructureRule {
  pattern: string;
  description: string;
  example: string;
}

// ============================================================================
// Parser
// ============================================================================

export class GuidelineParser {
  private projectRoot: string;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
  }

  /**
   * 가이드라인 파일 파싱
   */
  async parse(version: string): Promise<ParsedGuideline> {
    const guidelinePath = join(
      this.projectRoot,
      "docs/guidelines/qa-generation-guidelines.md",
    );

    if (!existsSync(guidelinePath)) {
      throw new Error(`Guideline file not found: ${guidelinePath}`);
    }

    const content = readFileSync(guidelinePath, "utf-8");
    const sourceHash = this.calculateHash(content);

    // Parse sections
    const questionTypes = this.parseQuestionTypes(content);
    const numberFormatRules = this.parseNumberFormatRules(content);
    const prohibitedPatterns = this.parseProhibitedPatterns(content);
    const answerStructureRules = this.parseAnswerStructureRules(content);

    const parsed: ParsedGuideline = {
      version,
      generatedAt: new Date().toISOString(),
      sourceFile: "qa-generation-guidelines.md",
      sourceHash,
      questionTypes,
      numberFormatRules,
      prohibitedPatterns,
      answerStructureRules,
      metadata: {
        totalQuestionTypes: questionTypes.length,
        totalRules:
          numberFormatRules.length +
          prohibitedPatterns.length +
          answerStructureRules.length,
      },
    };

    return parsed;
  }

  /**
   * 파싱 결과를 캐시에 저장
   */
  async saveToCache(parsed: ParsedGuideline): Promise<void> {
    const cachePath = join(
      this.projectRoot,
      `docs/guidelines/cache/rules.v${parsed.version}.json`,
    );
    const hashPath = join(
      this.projectRoot,
      `docs/guidelines/cache/hash.v${parsed.version}.txt`,
    );

    writeFileSync(cachePath, JSON.stringify(parsed, null, 2));
    writeFileSync(hashPath, parsed.sourceHash);

    console.log(`✅ Cache saved: ${cachePath}`);
    console.log(`   Hash: ${parsed.sourceHash.substring(0, 12)}...`);
  }

  /**
   * 캐시에서 로드
   */
  async loadFromCache(version: string): Promise<ParsedGuideline | null> {
    const cachePath = join(
      this.projectRoot,
      `docs/guidelines/cache/rules.v${version}.json`,
    );

    if (!existsSync(cachePath)) {
      return null;
    }

    const content = readFileSync(cachePath, "utf-8");
    return JSON.parse(content) as ParsedGuideline;
  }

  /**
   * 캐시 유효성 검증
   */
  async isCacheValid(version: string): Promise<boolean> {
    const cachePath = join(
      this.projectRoot,
      `docs/guidelines/cache/rules.v${version}.json`,
    );
    const hashPath = join(
      this.projectRoot,
      `docs/guidelines/cache/hash.v${version}.txt`,
    );

    if (!existsSync(cachePath) || !existsSync(hashPath)) {
      return false;
    }

    const guidelinePath = join(
      this.projectRoot,
      "docs/guidelines/qa-generation-guidelines.md",
    );
    const currentContent = readFileSync(guidelinePath, "utf-8");
    const currentHash = this.calculateHash(currentContent);

    const cachedHash = readFileSync(hashPath, "utf-8").trim();

    return currentHash === cachedHash;
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private calculateHash(content: string): string {
    return crypto.createHash("sha256").update(content).digest("hex");
  }

  private parseQuestionTypes(content: string): QuestionType[] {
    const types: QuestionType[] = [];

    // 질문 유형 섹션 추출 (정규식 사용)
    const typeMatches = content.matchAll(
      /###\s+(\d+)[.\s]+(.+?)\s+\(난이도:\s+(.+?)\)/g,
    );

    for (const match of typeMatches) {
      const id = match[1];
      const name = match[2].trim();
      const difficulty = match[3].trim() as "하" | "중" | "중상" | "상";

      // 해당 섹션의 텍스트 추출
      const sectionStart = match.index!;
      const nextSectionMatch = content.indexOf("###", sectionStart + 1);
      const sectionEnd =
        nextSectionMatch !== -1 ? nextSectionMatch : content.length;
      const sectionText = content.substring(sectionStart, sectionEnd);

      // 특징 추출
      const featuresMatch = sectionText.match(/\*\*특징\*\*\n\n([\s\S]+?)\n\n/);
      const description = featuresMatch
        ? featuresMatch[1]
            .split("\n")
            .map((line) => line.replace(/^-\s+/, "").trim())
            .filter((line) => line)
            .join("; ")
        : "";

      // 질문 패턴 추출
      const patternsMatch = sectionText.match(
        /\*\*질문 패턴\*\*\n\n([\s\S]+?)\n\n/,
      );
      const patterns = patternsMatch
        ? patternsMatch[1]
            .split("\n")
            .map((line) => line.replace(/^-\s+/, "").replace(/`/g, "").trim())
            .filter((line) => line)
        : [];

      // 예시 추출
      const examplesMatch = sectionText.match(
        /\*\*예시\*\*\n\n([\s\S]+?)(\n\n###|\n\n---|\n\n##|$)/,
      );
      const examples: QuestionExample[] = [];

      if (examplesMatch) {
        const exampleText = examplesMatch[1];
        const qaMatches = exampleText.matchAll(
          /-\s+Q:\s+(.+?)\n-\s+A:\s+(.+?)(?=\n-\s+Q:|\n\n|$)/gs,
        );

        for (const qaMatch of qaMatches) {
          examples.push({
            question: qaMatch[1].trim(),
            answer: qaMatch[2].trim(),
          });
        }
      }

      types.push({
        id,
        name,
        difficulty,
        description,
        patterns,
        examples,
      });
    }

    return types;
  }

  private parseNumberFormatRules(content: string): NumberFormatRule[] {
    const rules: NumberFormatRule[] = [];

    // 숫자 표현 원칙 섹션 찾기
    const numberSectionMatch = content.match(
      /###\s+\d+\.\s+숫자 표현 원칙([\s\S]+?)(?=\n\n##|\n\n###|$)/,
    );

    if (!numberSectionMatch) {
      return rules;
    }

    const numberSection = numberSectionMatch[1];

    // 일수/기간
    const periodMatch = numberSection.match(
      /\*\*일수\/기간\*\*:\s+(.+?)\n\n-\s+✅\s+"(.+?)"\n-\s+❌\s+"(.+?)"/,
    );
    if (periodMatch) {
      rules.push({
        type: "period",
        format: periodMatch[1].trim(),
        examples: periodMatch[2].split('", "'),
        counterExamples: periodMatch[3].split('", "'),
      });
    }

    // 금액
    const amountMatch = numberSection.match(
      /\*\*금액\*\*:\s+(.+?)\n\n-\s+✅\s+"(.+?)"\n-\s+❌\s+"(.+?)"/,
    );
    if (amountMatch) {
      rules.push({
        type: "amount",
        format: amountMatch[1].trim(),
        examples: amountMatch[2].split('", "'),
        counterExamples: amountMatch[3].split('", "'),
      });
    }

    // 비율
    const percentageMatch = numberSection.match(
      /\*\*비율\*\*:\s+(.+?)\n\n-\s+✅\s+"(.+?)"\n-\s+❌\s+"(.+?)"/,
    );
    if (percentageMatch) {
      rules.push({
        type: "percentage",
        format: percentageMatch[1].trim(),
        examples: percentageMatch[2].split('", "'),
        counterExamples: percentageMatch[3].split('", "'),
      });
    }

    return rules;
  }

  private parseProhibitedPatterns(content: string): string[] {
    const patterns: string[] = [];

    // 권장하지 않는 질문 유형 섹션
    const prohibitedMatch = content.match(
      /##\s+권장하지 않는 질문 유형([\s\S]+?)(?=\n\n##|$)/,
    );

    if (!prohibitedMatch) {
      return patterns;
    }

    const prohibitedSection = prohibitedMatch[1];

    // ❌로 시작하는 패턴 추출
    const patternMatches = prohibitedSection.matchAll(/❌\s+"(.+?)"/g);

    for (const match of patternMatches) {
      patterns.push(match[1]);
    }

    return patterns;
  }

  private parseAnswerStructureRules(content: string): AnswerStructureRule[] {
    const rules: AnswerStructureRule[] = [];

    // 기본 답변 구조 섹션
    const answerSectionMatch = content.match(
      /###\s+\d+\.\s+기본 답변 구조([\s\S]+?)(?=\n\n##|$)/,
    );

    if (!answerSectionMatch) {
      return rules;
    }

    const answerSection = answerSectionMatch[1];

    // 패턴 A, B 추출
    const patternMatches = answerSection.matchAll(
      /\*\*패턴\s+([A-Z]):\s+(.+?)\*\*\n\n`(.+?)`\n\n\*\*예시\*\*\n\n-\s+(.+?)(?=\n\n\*\*패턴|$)/gs,
    );

    for (const match of patternMatches) {
      rules.push({
        pattern: match[1],
        description: match[2].trim() + " - " + match[3].trim(),
        example: match[4].trim(),
      });
    }

    return rules;
  }
}

// ============================================================================
// Exports
// ============================================================================

export async function parseGuideline(
  version: string,
  projectRoot: string = process.cwd(),
): Promise<ParsedGuideline> {
  const parser = new GuidelineParser(projectRoot);
  return await parser.parse(version);
}

export async function getActiveGuideline(
  projectRoot: string = process.cwd(),
): Promise<ParsedGuideline> {
  const versionsPath = join(projectRoot, "docs/guidelines/versions.json");

  if (!existsSync(versionsPath)) {
    throw new Error("versions.json not found");
  }

  const versions = JSON.parse(readFileSync(versionsPath, "utf-8"));
  const activeVersion = versions.active;

  const parser = new GuidelineParser(projectRoot);

  // 캐시 확인
  const isCacheValid = await parser.isCacheValid(activeVersion);

  if (isCacheValid) {
    const cached = await parser.loadFromCache(activeVersion);
    if (cached) {
      console.log(`📦 Using cached guideline v${activeVersion}`);
      return cached;
    }
  }

  // 파싱 및 캐시 저장
  console.log(`🔄 Parsing guideline v${activeVersion}...`);
  const parsed = await parser.parse(activeVersion);
  await parser.saveToCache(parsed);

  return parsed;
}
