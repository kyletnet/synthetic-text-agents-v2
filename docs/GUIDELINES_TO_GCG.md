# Guidelines to Constraint Grammar (GCG) Compilation Guide

**Version**: 1.0
**Status**: Design Specification
**Target**: Phase 2.7 (Genius Lab v1)
**Purpose**: 가이드라인 문서를 기계가 강제 가능한 제약문법으로 자동 변환

---

## Overview

이 문서는 인간이 작성한 가이드라인 문서(Markdown, YAML)를 **GCG (Guideline → Constraint Grammar)**로 컴파일하는 방법을 정의합니다.

**목표**:
- 인간 가독성 유지 (가이드라인 = 단일 진실 원천)
- 기계 강제 가능 (생성 시 제약 자동 적용)
- 버전 관리 및 역호환성 보장

---

## 1. GCG Grammar Schema

### 1.1 Structure

```yaml
version: "1.0.0"         # Semantic versioning
domain: "general"        # Domain identifier
compliance: []           # 규제 태그 (HIPAA, SOX 등)

rules:
  # 숫자/단위 제약
  number_format:
    pattern: "^[0-9,]+$"
    unit_required: true
    allowed_units: ["kg", "lb", "m", "ft"]

  # 톤/억양 제약
  tone:
    allowed: ["formal", "informal", "technical"]
    markers:
      exclamation: false  # ! 금지
      question: true      # ? 허용
      ellipsis: false     # ... 금지

  # 문장 구조 제약
  structure:
    type: "svo"           # Subject-Verb-Object
    max_sentence_length: 25  # 단어 수
    bullet_max: 5         # Bullet point 최대 개수

  # 인용/근거 제약
  citation:
    mandatory: true
    min_sources: 1
    format: "[Source: {title}]"
    per_paragraph: true   # 단락당 최소 1개

  # 금지 패턴
  forbidden:
    ngrams: ["absolutely", "definitely", "always"]
    patterns:
      - "password.*:"     # 패스워드 노출
      - "secret.*="       # 비밀키 노출
      - "\\bDROP\\s+TABLE\\b"  # SQL injection

metadata:
  created_at: "2025-10-09T00:00:00Z"
  author: "system"
  source: "docs/GUIDELINES.md"
```

---

## 2. Compilation Process

### 2.1 Input: Guideline Document (Markdown)

```markdown
# Writing Guidelines

## Number Format
- 숫자는 3자리마다 쉼표 사용: 1,234
- 단위는 반드시 명시: 10 kg, 5 m

## Tone
- 격식체 사용
- 느낌표(!) 사용 금지
- 물음표(?) 사용 가능

## Citation
- 모든 주장은 출처 명시: [Source: Title]
- 단락당 최소 1개 출처

## Forbidden Words
- "항상", "절대", "반드시" 등 과장 표현 금지
```

---

### 2.2 Output: GCG Grammar (YAML)

```yaml
version: "1.0.0"
domain: "general"

rules:
  number_format:
    pattern: "^[0-9,]+$"
    unit_required: true
    allowed_units: ["kg", "m"]

  tone:
    allowed: ["formal"]
    markers:
      exclamation: false
      question: true

  citation:
    mandatory: true
    min_sources: 1
    format: "[Source: {title}]"
    per_paragraph: true

  forbidden:
    ngrams: ["항상", "절대", "반드시"]

metadata:
  source: "docs/GUIDELINES.md"
  created_at: "2025-10-09T00:15:00Z"
```

---

## 3. Compiler Implementation

### 3.1 GCGCompiler Class

```typescript
// src/offline/genius-lab/gcg/compiler.ts

import * as yaml from "yaml";
import * as fs from "fs";

interface Grammar {
  version: string;
  domain: string;
  compliance?: string[];
  rules: {
    number_format?: NumberFormatRule;
    tone?: ToneRule;
    structure?: StructureRule;
    citation?: CitationRule;
    forbidden?: ForbiddenRule;
  };
  metadata: {
    source: string;
    created_at: string;
    author: string;
  };
}

class GCGCompiler {
  /**
   * Markdown 가이드라인 → YAML 제약문법 컴파일
   */
  compile(guidelinePath: string): Grammar {
    const markdown = fs.readFileSync(guidelinePath, "utf-8");
    const grammar = this.parseMarkdown(markdown);
    return grammar;
  }

  /**
   * Markdown 파싱 (규칙 추출)
   */
  private parseMarkdown(markdown: string): Grammar {
    const grammar: Grammar = {
      version: "1.0.0",
      domain: "general",
      rules: {},
      metadata: {
        source: "unknown",
        created_at: new Date().toISOString(),
        author: "system"
      }
    };

    // Number Format 규칙 추출
    if (markdown.includes("## Number Format")) {
      const numberSection = this.extractSection(markdown, "## Number Format");
      grammar.rules.number_format = this.parseNumberFormat(numberSection);
    }

    // Tone 규칙 추출
    if (markdown.includes("## Tone")) {
      const toneSection = this.extractSection(markdown, "## Tone");
      grammar.rules.tone = this.parseTone(toneSection);
    }

    // Citation 규칙 추출
    if (markdown.includes("## Citation")) {
      const citationSection = this.extractSection(markdown, "## Citation");
      grammar.rules.citation = this.parseCitation(citationSection);
    }

    // Forbidden 규칙 추출
    if (markdown.includes("## Forbidden")) {
      const forbiddenSection = this.extractSection(markdown, "## Forbidden");
      grammar.rules.forbidden = this.parseForbidden(forbiddenSection);
    }

    return grammar;
  }

  /**
   * Section 추출
   */
  private extractSection(markdown: string, header: string): string {
    const startIdx = markdown.indexOf(header);
    if (startIdx === -1) return "";

    const nextHeaderIdx = markdown.indexOf("\n## ", startIdx + 1);
    if (nextHeaderIdx === -1) {
      return markdown.substring(startIdx);
    }
    return markdown.substring(startIdx, nextHeaderIdx);
  }

  /**
   * Number Format 규칙 파싱
   */
  private parseNumberFormat(section: string): NumberFormatRule {
    const rule: NumberFormatRule = {
      pattern: "^[0-9,]+$",
      unit_required: false,
      allowed_units: []
    };

    // "단위는 반드시" → unit_required = true
    if (section.includes("단위는 반드시") || section.includes("unit required")) {
      rule.unit_required = true;
    }

    // "10 kg, 5 m" → ["kg", "m"]
    const unitMatches = section.match(/\d+\s+(kg|lb|m|ft|g)/g);
    if (unitMatches) {
      const units = unitMatches.map(m => m.split(" ")[1]);
      rule.allowed_units = [...new Set(units)];
    }

    return rule;
  }

  /**
   * Tone 규칙 파싱
   */
  private parseTone(section: string): ToneRule {
    const rule: ToneRule = {
      allowed: [],
      markers: {}
    };

    // "격식체" → "formal"
    if (section.includes("격식체") || section.includes("formal")) {
      rule.allowed.push("formal");
    }
    if (section.includes("반말") || section.includes("informal")) {
      rule.allowed.push("informal");
    }

    // "느낌표(!) 사용 금지"
    if (section.includes("느낌표") && section.includes("금지")) {
      rule.markers.exclamation = false;
    }
    // "물음표(?) 사용 가능"
    if (section.includes("물음표") && section.includes("가능")) {
      rule.markers.question = true;
    }

    return rule;
  }

  /**
   * Citation 규칙 파싱
   */
  private parseCitation(section: string): CitationRule {
    const rule: CitationRule = {
      mandatory: false,
      min_sources: 1,
      format: "[Source: {title}]",
      per_paragraph: false
    };

    // "반드시 출처" → mandatory = true
    if (section.includes("반드시") || section.includes("mandatory")) {
      rule.mandatory = true;
    }

    // "단락당 최소 1개"
    if (section.includes("단락당") || section.includes("per paragraph")) {
      rule.per_paragraph = true;
    }

    // Format 추출: [Source: Title]
    const formatMatch = section.match(/\[Source:\s*\{?(\w+)\}?\]/);
    if (formatMatch) {
      rule.format = formatMatch[0];
    }

    return rule;
  }

  /**
   * Forbidden 규칙 파싱
   */
  private parseForbidden(section: string): ForbiddenRule {
    const rule: ForbiddenRule = {
      ngrams: [],
      patterns: []
    };

    // "항상", "절대" 등 추출
    const forbiddenWords = section.match(/"([^"]+)"/g);
    if (forbiddenWords) {
      rule.ngrams = forbiddenWords.map(w => w.replace(/"/g, ""));
    }

    return rule;
  }

  /**
   * 제약문법 저장
   */
  save(grammar: Grammar, outputPath: string): void {
    const yamlContent = yaml.stringify(grammar);
    fs.writeFileSync(outputPath, yamlContent, "utf-8");
  }

  /**
   * 제약문법 로드
   */
  load(grammarPath: string): Grammar {
    const yamlContent = fs.readFileSync(grammarPath, "utf-8");
    return yaml.parse(yamlContent);
  }
}

// Type Definitions
interface NumberFormatRule {
  pattern: string;
  unit_required: boolean;
  allowed_units: string[];
}

interface ToneRule {
  allowed: string[];
  markers: {
    exclamation?: boolean;
    question?: boolean;
    ellipsis?: boolean;
  };
}

interface StructureRule {
  type: "svo" | "free";
  max_sentence_length: number;
  bullet_max: number;
}

interface CitationRule {
  mandatory: boolean;
  min_sources: number;
  format: string;
  per_paragraph: boolean;
}

interface ForbiddenRule {
  ngrams: string[];
  patterns: string[];
}

export { GCGCompiler, Grammar };
```

---

## 4. Validation Engine

### 4.1 GCGValidator Class

```typescript
// src/offline/genius-lab/gcg/validator.ts

interface ValidationResult {
  passed: boolean;
  violations: Violation[];
}

interface Violation {
  rule: string;
  message: string;
  location?: { line: number; column: number };
}

class GCGValidator {
  /**
   * 텍스트가 제약문법을 준수하는지 검증
   */
  validate(text: string, grammar: Grammar): ValidationResult {
    const violations: Violation[] = [];

    // Number format 검증
    if (grammar.rules.number_format) {
      violations.push(...this.validateNumberFormat(text, grammar.rules.number_format));
    }

    // Tone 검증
    if (grammar.rules.tone) {
      violations.push(...this.validateTone(text, grammar.rules.tone));
    }

    // Citation 검증
    if (grammar.rules.citation) {
      violations.push(...this.validateCitation(text, grammar.rules.citation));
    }

    // Forbidden 검증
    if (grammar.rules.forbidden) {
      violations.push(...this.validateForbidden(text, grammar.rules.forbidden));
    }

    return {
      passed: violations.length === 0,
      violations
    };
  }

  private validateNumberFormat(text: string, rule: NumberFormatRule): Violation[] {
    const violations: Violation[] = [];

    // 단위 누락 검증
    if (rule.unit_required) {
      const numberMatches = text.match(/\b\d+\b/g) || [];
      for (const num of numberMatches) {
        const unitAfter = text.substring(text.indexOf(num) + num.length, text.indexOf(num) + num.length + 10);
        const hasUnit = rule.allowed_units.some(unit => unitAfter.includes(unit));
        if (!hasUnit) {
          violations.push({
            rule: "number_format.unit_required",
            message: `Number "${num}" missing required unit`
          });
        }
      }
    }

    return violations;
  }

  private validateTone(text: string, rule: ToneRule): Violation[] {
    const violations: Violation[] = [];

    // 느낌표 금지
    if (rule.markers.exclamation === false && text.includes("!")) {
      violations.push({
        rule: "tone.markers.exclamation",
        message: "Exclamation mark (!) is forbidden"
      });
    }

    return violations;
  }

  private validateCitation(text: string, rule: CitationRule): Violation[] {
    const violations: Violation[] = [];

    if (rule.mandatory) {
      // 최소 출처 수 검증
      const citations = text.match(/\[Source:[^\]]+\]/g) || [];
      if (citations.length < rule.min_sources) {
        violations.push({
          rule: "citation.min_sources",
          message: `Minimum ${rule.min_sources} citations required, found ${citations.length}`
        });
      }

      // 단락당 출처 검증
      if (rule.per_paragraph) {
        const paragraphs = text.split("\n\n");
        for (let i = 0; i < paragraphs.length; i++) {
          const paraCitations = paragraphs[i].match(/\[Source:[^\]]+\]/g) || [];
          if (paraCitations.length === 0) {
            violations.push({
              rule: "citation.per_paragraph",
              message: `Paragraph ${i + 1} missing required citation`
            });
          }
        }
      }
    }

    return violations;
  }

  private validateForbidden(text: string, rule: ForbiddenRule): Violation[] {
    const violations: Violation[] = [];

    // Forbidden n-grams
    for (const ngram of rule.ngrams) {
      if (text.includes(ngram)) {
        violations.push({
          rule: "forbidden.ngrams",
          message: `Forbidden word/phrase: "${ngram}"`
        });
      }
    }

    // Forbidden patterns
    for (const pattern of rule.patterns) {
      const regex = new RegExp(pattern, "gi");
      if (regex.test(text)) {
        violations.push({
          rule: "forbidden.patterns",
          message: `Forbidden pattern: ${pattern}`
        });
      }
    }

    return violations;
  }
}

export { GCGValidator, ValidationResult, Violation };
```

---

## 5. Usage Examples

### 5.1 Compile Guideline

```typescript
import { GCGCompiler } from "./gcg/compiler";

const compiler = new GCGCompiler();

// Markdown 가이드라인 → YAML 제약문법
const grammar = compiler.compile("docs/GUIDELINES.md");

// 저장
compiler.save(grammar, "src/offline/genius-lab/gcg/grammar.yml");

console.log("Grammar compiled successfully!");
```

---

### 5.2 Validate Text

```typescript
import { GCGValidator } from "./gcg/validator";
import { GCGCompiler } from "./gcg/compiler";

const compiler = new GCGCompiler();
const validator = new GCGValidator();

// 제약문법 로드
const grammar = compiler.load("src/offline/genius-lab/gcg/grammar.yml");

// 텍스트 검증
const text = `
10 kg의 물체가 있습니다.
이것은 매우 무겁습니다!
`;

const result = validator.validate(text, grammar);

if (!result.passed) {
  console.error("Validation failed:");
  result.violations.forEach(v => {
    console.error(`- [${v.rule}] ${v.message}`);
  });
}
// Output:
// - [tone.markers.exclamation] Exclamation mark (!) is forbidden
```

---

## 6. Version Management

### 6.1 Semantic Versioning

```yaml
version: "1.2.3"
# 1: Major (breaking changes)
# 2: Minor (new rules, backward compatible)
# 3: Patch (bug fixes)
```

### 6.2 Backward Compatibility Check

```typescript
class GCGCompiler {
  /**
   * 두 버전 간 역호환성 검증
   */
  ensureBackwardCompatibility(v1: Grammar, v2: Grammar): boolean {
    // Rule 제거 불가
    for (const key of Object.keys(v1.rules)) {
      if (!(key in v2.rules)) {
        console.error(`Rule "${key}" was removed`);
        return false;
      }
    }

    // Major version 변경 시 breaking change 허용
    const [major1] = v1.version.split(".");
    const [major2] = v2.version.split(".");
    if (major1 !== major2) {
      console.warn("Major version change - breaking changes allowed");
      return true;
    }

    return true;
  }
}
```

---

## 7. Integration with Runtime

### 7.1 Apply GCG in L3 Planner

```typescript
// src/runtime/l3-planner/apply-gcg.ts

import { GCGValidator } from "../../offline/genius-lab/gcg/validator";
import { Grammar } from "../../offline/genius-lab/gcg/compiler";

class ApplyGCG {
  private validator: GCGValidator;
  private grammar: Grammar;

  constructor(grammarPath: string) {
    const compiler = new GCGCompiler();
    this.grammar = compiler.load(grammarPath);
    this.validator = new GCGValidator();
  }

  /**
   * 생성된 텍스트에 제약문법 적용
   *
   * - 검증 실패 시: 수정 시도 또는 재생성
   */
  async apply(text: string): Promise<string> {
    const result = this.validator.validate(text, this.grammar);

    if (result.passed) {
      return text; // Pass-through
    }

    // 자동 수정 시도
    let corrected = text;
    for (const violation of result.violations) {
      corrected = await this.autoCorrect(corrected, violation);
    }

    // 재검증
    const recheck = this.validator.validate(corrected, this.grammar);
    if (recheck.passed) {
      return corrected;
    }

    // 수정 실패 → 재생성
    throw new Error(`GCG validation failed: ${recheck.violations.length} violations`);
  }

  /**
   * 자동 수정
   */
  private async autoCorrect(text: string, violation: Violation): Promise<string> {
    if (violation.rule === "tone.markers.exclamation") {
      return text.replace(/!/g, ".");
    }

    if (violation.rule.startsWith("forbidden.ngrams")) {
      const forbidden = violation.message.match(/"([^"]+)"/)?.[1];
      if (forbidden) {
        return text.replace(new RegExp(forbidden, "gi"), "[REDACTED]");
      }
    }

    return text; // No auto-correct available
  }
}

export { ApplyGCG };
```

---

## 8. Best Practices

### 8.1 Guideline Writing Tips

1. **명확한 섹션 구조**: `## Number Format`, `## Tone` 등 명확한 헤더 사용
2. **예시 포함**: "10 kg"처럼 구체적 예시로 규칙 설명
3. **키워드 일관성**: "반드시", "금지", "필수" 등 키워드 일관되게 사용
4. **버전 명시**: 가이드라인 문서 상단에 버전 기록

### 8.2 Compiler Testing

```typescript
// tests/gcg/compiler.test.ts
import { describe, it, expect } from "vitest";
import { GCGCompiler } from "../../src/offline/genius-lab/gcg/compiler";

describe("GCGCompiler", () => {
  it("should parse number format rules", () => {
    const markdown = `
## Number Format
- 단위는 반드시 명시: 10 kg
    `;

    const compiler = new GCGCompiler();
    const grammar = compiler["parseMarkdown"](markdown);

    expect(grammar.rules.number_format?.unit_required).toBe(true);
    expect(grammar.rules.number_format?.allowed_units).toContain("kg");
  });

  it("should parse forbidden words", () => {
    const markdown = `
## Forbidden
- "항상", "절대" 금지
    `;

    const compiler = new GCGCompiler();
    const grammar = compiler["parseMarkdown"](markdown);

    expect(grammar.rules.forbidden?.ngrams).toContain("항상");
    expect(grammar.rules.forbidden?.ngrams).toContain("절대");
  });
});
```

---

## 9. Roadmap

### Phase 2.7 (Genius Lab v1)
- [ ] GCGCompiler 구현
- [ ] GCGValidator 구현
- [ ] 5개 규칙 지원 (number, tone, structure, citation, forbidden)
- [ ] 버전 관리 시스템

### Phase 2.8
- [ ] 자동 수정 엔진 고도화
- [ ] 다국어 지원 (한글/영어)

### Phase 2.9
- [ ] 규제 팩 통합 (HIPAA/SOX → GCG)
- [ ] Domain-specific 규칙 추가

---

## 10. References

- RFC 2025-16: v4 Hardening + Operator Registry
- `docs/ARCHITECTURE_MULTI_TENANT.md`: Policy DSL
- `src/offline/genius-lab/gcg/`: 구현 위치

---

**Status**: ✅ Design Complete
**Next Step**: Phase 2.7 구현
**Last Updated**: 2025-10-09 00:25 KST
