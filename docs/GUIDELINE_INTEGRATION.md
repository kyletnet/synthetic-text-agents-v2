# 전문가 가이드라인 통합 가이드

## 📋 개요

신기술 전문가나 데이터 구축 전문가가 시스템에 가이드라인을 제공하는 방법과 시스템 통합 프로세스를 설명합니다.

---

## 🎯 가이드라인 제공 방식 (3가지 레벨)

### Level 1: 빠른 룰 추가 (Quality Policy)

**대상**: 간단한 품질 기준, 보호 파일 지정

**파일**: `quality-policy.json`

**방법**:

```json
{
  "agentProtection": {
    "static": [
      {
        "file": "src/agents/newExpertAgent.ts",
        "reason": "신규 도메인 전문가 - QA 품질 핵심",
        "severity": "critical",
        "autoRefactor": false,
        "requireApproval": true
      }
    ]
  },
  "refactoringCriteria": {
    "fileSize": {
      "warnThreshold": 300,
      "refactorThreshold": 500,
      "exemptIfQualityEssential": true // 품질 필수 파일은 예외
    }
  }
}
```

**적용 시점**: 즉시 (재시작 불필요)

**검증**:

```bash
npm run status  # Quality Protection 섹션에서 확인
```

---

### Level 2: 도메인 가이드라인 (Guidelines Directory)

**대상**: 복잡한 도메인 룰, 데이터 구축 원칙

**파일 구조**:

```
guidelines/
├── augmentation-rules.md        # 데이터 증강 규칙
├── citation-quality.md           # 인용 품질 기준
├── domain-expertise/
│   ├── computer-science.md      # CS 도메인 전문 지식
│   ├── marketing.md             # 마케팅 도메인
│   └── sales.md                 # 영업 도메인
└── qa-generation-principles.md  # QA 생성 원칙
```

**예시**: `guidelines/augmentation-rules.md`

````markdown
# 데이터 증강 규칙

## 1. 패러프레이징 원칙

### 금지 사항

- 의미 변경 금지
- 전문 용어 임의 변경 금지
- 예제 코드는 보존

### 허용 범위

- 문장 구조 변경 (의미 유지 시)
- 동의어 치환 (컨텍스트 일치 시)
- 예시 추가/확장

## 2. 품질 검증

### 필수 체크리스트

- [ ] 원본 의미 100% 보존
- [ ] 전문 용어 정확성
- [ ] 코드 예제 동작 확인
- [ ] 인용 출처 유지

### 자동 검증 기준

```json
{
  "minSemanticSimilarity": 0.85,
  "maxTerminologyDeviation": 0.05,
  "requireSourceCitation": true
}
```
````

## 3. 도메인별 특수 규칙

### Computer Science

- 알고리즘 설명: Big-O 표기 필수
- 코드: 실행 가능해야 함
- 용어: IEEE/ACM 표준 준수

### Marketing

- 데이터: 최신 시장 트렌드 반영 (6개월 이내)
- 메트릭: 구체적 수치 포함
- 사례: 실제 캠페인 기반

## 4. 시스템 적용 방식

이 가이드라인은 다음 컴포넌트에서 자동 로드됩니다:

- `src/augmentation/paraphraser.ts` - 패러프레이징 검증
- `src/agents/qualityAuditor.ts` - 품질 감사 기준
- `scripts/metrics/hallucination_rules.ts` - 환각 탐지

업데이트 후 자동 반영 (재시작 불필요)

````

**시스템 통합**:

1. **자동 로드**: 시스템이 `guidelines/` 디렉토리 모니터링
2. **Hot Reload**: 파일 변경 시 자동 재로드
3. **검증**: Agent가 가이드라인 기반 검증 수행

**구현 예시**:
```typescript
// src/agents/qualityAuditor.ts
import { readFileSync } from 'fs';
import { parse as parseMarkdown } from 'marked';

export class QualityAuditor extends BaseAgent {
  private guidelines: Map<string, any> = new Map();

  constructor() {
    super();
    this.loadGuidelines();
  }

  private loadGuidelines(): void {
    // guidelines/ 디렉토리에서 모든 .md 파일 로드
    const files = glob.sync('guidelines/**/*.md');
    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      const parsed = this.parseGuideline(content);
      this.guidelines.set(file, parsed);
    }
  }

  async auditQA(qa: QAPair): Promise<AuditResult> {
    // 가이드라인 기반 검증
    const rules = this.guidelines.get('guidelines/augmentation-rules.md');

    // 1. 의미 보존 확인
    if (rules.semanticSimilarity) {
      const similarity = await this.checkSimilarity(qa.original, qa.augmented);
      if (similarity < rules.minSemanticSimilarity) {
        return { pass: false, reason: 'Semantic similarity too low' };
      }
    }

    // 2. 전문 용어 검증
    const terminologyOk = this.checkTerminology(qa, rules.terminologyRules);
    if (!terminologyOk) {
      return { pass: false, reason: 'Terminology violation' };
    }

    return { pass: true };
  }
}
````

---

### Level 3: 플러그인 시스템 (고급)

**대상**: 완전한 커스텀 로직, 외부 시스템 연동

**파일**: `plugins/` 디렉토리

**구조**:

```
plugins/
├── custom-validator/
│   ├── index.ts                 # 플러그인 엔트리포인트
│   ├── validator.ts             # 검증 로직
│   └── config.json              # 플러그인 설정
└── external-knowledge-base/
    ├── index.ts
    ├── api-client.ts
    └── cache.ts
```

**플러그인 등록**: `quality-policy.json`

```json
{
  "plugins": {
    "custom-validator": {
      "enabled": true,
      "priority": 10,
      "config": {
        "apiEndpoint": "https://api.example.com/validate",
        "cacheEnabled": true
      }
    },
    "external-knowledge-base": {
      "enabled": true,
      "priority": 5,
      "config": {
        "sources": ["https://knowledge.company.com/api"]
      }
    }
  }
}
```

**플러그인 인터페이스**:

```typescript
// plugins/custom-validator/index.ts
import { Plugin, PluginContext, ValidationResult } from "@/core/plugin-system";

export default class CustomValidator implements Plugin {
  name = "custom-validator";
  version = "1.0.0";

  async init(context: PluginContext): Promise<void> {
    console.log("Custom validator initialized");
  }

  async validate(data: any, context: PluginContext): Promise<ValidationResult> {
    // 커스텀 검증 로직
    const isValid = await this.checkExternalAPI(data);

    return {
      valid: isValid,
      errors: isValid ? [] : ["Custom validation failed"],
      metadata: {
        checkedBy: this.name,
        timestamp: Date.now(),
      },
    };
  }

  private async checkExternalAPI(data: any): Promise<boolean> {
    // 외부 API 호출 등
    return true;
  }
}
```

**시스템 통합**:

```typescript
// src/core/plugin-loader.ts
export class PluginLoader {
  async loadPlugins(): Promise<Map<string, Plugin>> {
    const policy = getQualityPolicyManager().exportPolicy();
    const plugins = new Map<string, Plugin>();

    for (const [name, config] of Object.entries(policy.plugins || {})) {
      if (!config.enabled) continue;

      try {
        const pluginModule = await import(`../plugins/${name}/index.js`);
        const plugin = new pluginModule.default();
        await plugin.init({ config });
        plugins.set(name, plugin);
      } catch (error) {
        console.error(`Failed to load plugin ${name}:`, error);
      }
    }

    return plugins;
  }
}
```

---

## 🔄 시스템 상호작용 흐름

### 1. 가이드라인 적용 플로우

```
┌─────────────────────────────────────────────────────────────┐
│  전문가가 가이드라인 작성                                      │
│  → guidelines/domain-expertise/new-domain.md                │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  시스템 자동 탐지                                              │
│  → GuidelineManager.watchGuidelines()                        │
│  → 파일 변경 감지 (fs.watch)                                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  가이드라인 파싱 및 검증                                       │
│  → Markdown → JSON 변환                                      │
│  → 스키마 검증                                                │
│  → 충돌 체크 (기존 가이드라인과)                               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Agent 업데이트                                               │
│  → QualityAuditor.reloadGuidelines()                         │
│  → DomainConsultant.updateDomainKnowledge()                  │
│  → 메모리 캐시 갱신                                           │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  실시간 적용                                                  │
│  → 다음 QA 생성부터 새 가이드라인 적용                         │
│  → 재시작 불필요 (Hot Reload)                                 │
└─────────────────────────────────────────────────────────────┘
```

### 2. 검증 및 피드백 루프

```
QA 생성 요청
    ↓
┌─────────────────────────────────────────────┐
│ 1. Meta-Controller: 요청 분석                │
│    - 도메인 식별 (CS? Marketing? Sales?)    │
│    - 복잡도 평가                             │
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│ 2. DomainConsultant: 가이드라인 로드         │
│    - guidelines/domain-expertise/{domain}.md│
│    - 도메인별 특수 규칙 적용                 │
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│ 3. QAGenerator: 가이드라인 기반 생성         │
│    - 전문 용어 사용                          │
│    - 예시 형식 준수                          │
│    - 인용 출처 포함                          │
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│ 4. QualityAuditor: 다층 검증                │
│    Level 1: 형식 검증                        │
│    Level 2: 도메인 정확성 (가이드라인 기반)  │
│    Level 3: 실용성 검증                      │
│    Level 4: 혁신성 평가                      │
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│ 5. 품질 점수 산출                            │
│    - 가이드라인 준수율: 95%                  │
│    - 전체 품질 점수: 9.2/10                  │
└─────────────────────────────────────────────┘
    ↓
품질 점수 < 목표(9.5)?
    ↓ Yes
┌─────────────────────────────────────────────┐
│ 6. 자동 개선 루프                            │
│    - 가이드라인 위반 항목 식별               │
│    - 재생성 또는 수정                        │
│    - 재검증                                  │
└─────────────────────────────────────────────┘
    ↓ No
최종 QA 출력
```

### 3. 가이드라인 업데이트 영향 범위

```
guidelines/augmentation-rules.md 수정
    ↓
┌─────────────────────────────────────────────┐
│ 영향받는 컴포넌트 (자동 감지)                │
├─────────────────────────────────────────────┤
│ ✓ src/augmentation/paraphraser.ts           │
│ ✓ src/agents/qualityAuditor.ts              │
│ ✓ scripts/metrics/hallucination_rules.ts    │
│ ✓ src/agents/linguisticsEngineer.ts         │
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│ Hot Reload 트리거                            │
│ → GuidelineManager.notifyUpdate()           │
│ → 각 Agent에 업데이트 알림                   │
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│ 기존 프로세스 영향 없음                       │
│ - 실행 중인 작업은 완료까지 진행              │
│ - 새 작업부터 업데이트 적용                   │
└─────────────────────────────────────────────┘
```

---

## 📊 실전 예제

### 예제 1: 신규 도메인 전문가 추가 (의료 분야)

**Step 1**: 가이드라인 작성

```bash
# guidelines/domain-expertise/medical.md 생성
```

````markdown
# 의료 도메인 QA 생성 가이드라인

## 전문 용어 사용 원칙

### 필수 준수 사항

- 의학 용어: 대한의학회 표준 용어 사용
- 약물명: 일반명(Generic Name) 우선, 상품명 병기
- 진단명: ICD-10 코드 기준

### 금지 사항

- 진단 단정 표현 금지 (예: "당신은 ~병입니다" ❌)
- 약물 추천 금지
- 의료 행위 권유 금지

## QA 구조

### 질문 유형

1. 증상 설명 요청
2. 질병 정보 요청
3. 치료법 일반 정보
4. 예방 방법

### 답변 구조

1. 개요 (1-2문장)
2. 상세 설명
3. 주의사항 **필수**
4. 참고자료 (학술지 출처)

## 예시

**Good Example:**

```json
{
  "question": "당뇨병의 주요 증상은 무엇인가요?",
  "answer": "당뇨병(Diabetes Mellitus)의 주요 증상은...\n\n**주의**: 증상이 있다면 반드시 의료 전문가와 상담하세요.\n\n참고: American Diabetes Association (2023)",
  "metadata": {
    "domain": "medical",
    "icd10": "E11",
    "verified": true
  }
}
```
````

## 검증 체크리스트

- [ ] 용어 정확성 (의학 표준 용어)
- [ ] 주의사항 포함
- [ ] 학술 출처 명시
- [ ] 진단/처방 표현 없음

````

**Step 2**: Quality Policy 업데이트
```json
// quality-policy.json
{
  "guidelines": {
    "medical": {
      "enabled": true,
      "strictMode": true,
      "requiredFields": ["icd10", "verified"],
      "validators": [
        "terminology-check",
        "disclaimer-check",
        "citation-check"
      ]
    }
  }
}
````

**Step 3**: 시스템 자동 적용

```bash
# 변경 감지 로그
[GuidelineManager] Detected new guideline: medical.md
[GuidelineManager] Parsing and validating...
[GuidelineManager] ✓ Schema valid
[GuidelineManager] ✓ No conflicts
[GuidelineManager] Notifying agents...
[DomainConsultant] Loaded medical domain knowledge
[QualityAuditor] Updated validation rules
[GuidelineManager] ✓ Ready to use

# 즉시 사용 가능
```

**Step 4**: 사용 예시

```bash
# QA 생성 요청
curl -X POST http://localhost:3000/api/generate \
  -d '{
    "topic": "diabetes symptoms",
    "domain": "medical",
    "count": 5
  }'

# 시스템이 자동으로:
# 1. guidelines/domain-expertise/medical.md 로드
# 2. 의학 용어 표준 준수
# 3. 주의사항 자동 추가
# 4. ICD-10 코드 검증
# 5. 학술 출처 요구
```

---

### 예제 2: 기존 가이드라인 개선

**변경 전**:

```markdown
# guidelines/augmentation-rules.md

## 패러프레이징 원칙

- 의미 변경 금지
```

**변경 후**:

````markdown
# guidelines/augmentation-rules.md

## 패러프레이징 원칙

### 정량적 기준 (NEW!)

- 의미 유사도: ≥ 0.90 (Cosine Similarity)
- 핵심 키워드 보존율: ≥ 95%
- BLEU Score: ≥ 0.80

### 자동 검증 활성화

```json
{
  "enableAutomaticValidation": true,
  "thresholds": {
    "semanticSimilarity": 0.9,
    "keywordPreservation": 0.95,
    "bleuScore": 0.8
  },
  "onViolation": "reject"
}
```
````

```

**시스템 반응**:
```

[GuidelineManager] Change detected: augmentation-rules.md
[GuidelineManager] Parsing quantitative criteria...
[Paraphraser] Updating validation thresholds

- Semantic similarity: 0.85 → 0.90 (stricter)
- Keyword preservation: enabled
- BLEU score: enabled
  [Paraphraser] ✓ Thresholds updated
  [QualityAuditor] Validation rules synchronized

# 다음 패러프레이징부터 새 기준 적용

````

---

## 🔍 가이드라인 버전 관리

### Git 기반 추적
```bash
# 가이드라인 변경 이력
git log guidelines/augmentation-rules.md

# 특정 버전으로 롤백
git checkout <commit-hash> guidelines/augmentation-rules.md

# 시스템이 자동 감지 후 재로드
````

### 품질 영향 분석

```bash
# 가이드라인 변경 전/후 품질 비교
npm run guideline:impact-analysis

# 출력 예시:
# Guideline: augmentation-rules.md
# Changed: 2025-10-05
#
# Quality Impact:
#   Before: Avg quality score 8.7/10
#   After:  Avg quality score 9.2/10 (+0.5)
#   Improvement: 5.7%
#
# Affected QA pairs: 1,234
# Recommended: Accept change ✓
```

---

## ⚡ 성능 최적화

### 가이드라인 캐싱

```typescript
// GuidelineManager 내부
class GuidelineCache {
  private cache = new Map<string, ParsedGuideline>();
  private ttl = 3600000; // 1 hour

  get(path: string): ParsedGuideline | null {
    const cached = this.cache.get(path);
    if (!cached) return null;

    if (Date.now() - cached.loadedAt > this.ttl) {
      this.cache.delete(path);
      return null;
    }

    return cached;
  }
}
```

### Lazy Loading

```typescript
// 필요할 때만 로드
class DomainConsultant {
  async getGuideline(domain: string): Promise<Guideline> {
    if (!this.guidelines.has(domain)) {
      await this.loadGuideline(domain);
    }
    return this.guidelines.get(domain);
  }
}
```

---

## 📚 요약

| 레벨 | 파일                  | 용도          | 복잡도 | Hot Reload |
| ---- | --------------------- | ------------- | ------ | ---------- |
| 1    | `quality-policy.json` | 간단한 룰     | ⭐     | ✓          |
| 2    | `guidelines/*.md`     | 도메인 가이드 | ⭐⭐   | ✓          |
| 3    | `plugins/*/index.ts`  | 커스텀 로직   | ⭐⭐⭐ | ✓          |

**추천 워크플로우**:

1. Level 1로 빠른 프로토타입
2. Level 2로 상세 가이드라인 작성
3. 필요시 Level 3로 고급 기능 확장
