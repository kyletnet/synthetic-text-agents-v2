# P0 Gaps - 즉시 조치 계획

**작성일**: 2025-10-04
**우선순위**: Critical (P0)
**예상 소요 시간**: 8시간 (1일)

---

## 🎯 목표

**Critical Gaps P0 4개 이슈를 즉시 해결하여 시스템 완결성 확보**

---

## 📋 P0 이슈 목록

| #   | 이슈                          | 영향도 | 예상 시간 | 담당      |
| --- | ----------------------------- | ------ | --------- | --------- |
| 1   | Guidelines 디렉토리 미구현    | High   | 2h        | Dev       |
| 2   | Circular Dependency CI 미통합 | High   | 30min     | DevOps    |
| 3   | Quality History 미사용        | Medium | 1h        | Dev       |
| 4   | /radar /inspect 역할 중복     | Medium | 4h        | Architect |

---

## 🔥 Gap #1: Guidelines 디렉토리 미구현

### 현재 상태

- ❌ `guidelines/` 디렉토리 없음
- ❌ `GuidelineManager` 클래스 미구현
- ✅ `docs/GUIDELINE_INTEGRATION.md` 설계 완료

### 즉시 조치

```bash
# 1. 디렉토리 구조 생성 (5분)
mkdir -p guidelines/domain-expertise
mkdir -p guidelines/augmentation
mkdir -p guidelines/quality

# 2. 예시 가이드라인 작성 (30분)
cat > guidelines/augmentation/paraphrasing-rules.md << 'EOF'
# 패러프레이징 규칙

## 금지 사항
- 의미 변경 금지
- 전문 용어 임의 변경 금지
- 예제 코드 보존

## 허용 범위
- 문장 구조 변경 (의미 유지 시)
- 동의어 치환 (컨텍스트 일치 시)
EOF

# 3. GuidelineManager 기본 구현 (1h)
# scripts/lib/guideline-manager.ts
```

### 구현 코드 (기본)

```typescript
// scripts/lib/guideline-manager.ts
import { watch } from "fs";
import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { parse } from "marked";

export class GuidelineManager {
  private guidelines = new Map<string, any>();
  private watcherActive = false;

  constructor(private guidelinesPath: string = "guidelines") {}

  async loadAll(): Promise<void> {
    const files = await this.findMarkdownFiles(this.guidelinesPath);
    for (const file of files) {
      await this.loadGuideline(file);
    }
  }

  async loadGuideline(filePath: string): Promise<void> {
    const content = await readFile(filePath, "utf-8");
    const parsed = await parse(content);
    this.guidelines.set(filePath, {
      path: filePath,
      content,
      parsed,
      loadedAt: Date.now(),
    });
  }

  startWatching(): void {
    if (this.watcherActive) return;

    watch(this.guidelinesPath, { recursive: true }, async (event, filename) => {
      if (filename && filename.endsWith(".md")) {
        console.log(`[GuidelineManager] Detected ${event}: ${filename}`);
        await this.loadGuideline(join(this.guidelinesPath, filename));
      }
    });

    this.watcherActive = true;
  }

  private async findMarkdownFiles(dir: string): Promise<string[]> {
    // Implementation
    return [];
  }

  get(domain: string): any {
    return this.guidelines.get(domain);
  }
}
```

### 검증

```bash
# 1. GuidelineManager 테스트
npx tsx -e "
import { GuidelineManager } from './scripts/lib/guideline-manager.js';
const gm = new GuidelineManager();
await gm.loadAll();
console.log('Loaded guidelines:', gm.guidelines.size);
"

# 2. 파일 존재 확인
ls -la guidelines/
```

### 완료 기준

- [ ] `guidelines/` 디렉토리 존재
- [ ] 최소 2개 예시 가이드라인 파일 존재
- [ ] `GuidelineManager` 클래스 구현
- [ ] Hot Reload 동작 확인

---

## ⚡ Gap #2: Circular Dependency CI 미통합

### 현재 상태

- ✅ `scripts/lib/security-guard.ts` 구현 완료
- ❌ CI/CD에 통합 안 됨
- ❌ PR 시 자동 검사 없음

### 즉시 조치 (30분)

```yaml
# .github/workflows/unified-quality-gate.yml 수정
# architecture-validation job에 추가

- name: 🔍 Circular Dependency Check
  run: |
    echo "Checking for circular dependencies..."
    npx tsx scripts/lib/security-guard.ts
  continue-on-error: false # 실패 시 빌드 중단
```

### 전체 코드

```yaml
architecture-validation:
  name: 🏛️ Architecture & Design
  needs: quick-validation
  runs-on: ubuntu-latest
  timeout-minutes: 10

  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: ${{ env.NODE_VERSION }}
        cache: "npm"
    - run: npm ci

    - name: 🏛️ Architecture Invariants
      run: npm run _arch:validate

    - name: 🔍 Circular Dependency Check # NEW!
      run: npx tsx scripts/lib/security-guard.ts

    - name: 🛡️ Quality Protection Check
      # ... existing code
```

### 검증

```bash
# 1. 로컬 테스트
npx tsx scripts/lib/security-guard.ts

# 2. CI/CD 트리거
git add .github/workflows/unified-quality-gate.yml
git commit -m "ci: add circular dependency check"
git push

# 3. Actions 결과 확인
```

### 완료 기준

- [ ] unified-quality-gate.yml 수정 완료
- [ ] 로컬 테스트 성공
- [ ] CI/CD 실행 확인
- [ ] PR 생성 시 자동 검사 동작

---

## 📊 Gap #3: Quality History 미사용

### 현재 상태

- ✅ `scripts/lib/quality-history.ts` 구현 완료
- ❌ 아무 곳에서도 호출 안 됨
- ❌ 데이터 수집 없음

### 즉시 조치 (1h)

```typescript
// scripts/inspection-engine.ts 수정
import { trackQualityMetrics } from './lib/quality-history.js';

async runFullInspection() {
  // ... existing code

  const summary = await this.runDiagnostics();

  // 품질 이력 저장 (NEW!)
  try {
    await trackQualityMetrics({
      timestamp: Date.now(),
      healthScore: summary.healthScore,
      details: {
        typescript: summary.typescript,
        codeStyle: summary.codeStyle,
        tests: summary.tests,
        security: summary.security
      }
    });
  } catch (error) {
    console.warn('Failed to save quality history:', error);
    // Non-blocking
  }

  // ... rest of code
}
```

### Quality History 구현

```typescript
// scripts/lib/quality-history.ts 수정
import { writeFileSync, existsSync, mkdirSync, readFileSync } from "fs";
import { join } from "path";

export interface QualityMetrics {
  timestamp: number;
  healthScore: number;
  details: {
    typescript: string;
    codeStyle: string;
    tests: string;
    security: string;
  };
}

export async function trackQualityMetrics(
  metrics: QualityMetrics,
): Promise<void> {
  const historyDir = "reports/quality-history";
  if (!existsSync(historyDir)) {
    mkdirSync(historyDir, { recursive: true });
  }

  const date = new Date(metrics.timestamp).toISOString().split("T")[0];
  const filePath = join(historyDir, `${date}.json`);

  writeFileSync(filePath, JSON.stringify(metrics, null, 2));
}

export function getQualityTrend(days: number = 7): QualityMetrics[] {
  const historyDir = "reports/quality-history";
  if (!existsSync(historyDir)) return [];

  // Load last N days
  // ...implementation
  return [];
}
```

### 검증

```bash
# 1. 실행
npm run status

# 2. 확인
ls -la reports/quality-history/
cat reports/quality-history/$(date +%Y-%m-%d).json

# 3. 트렌드 확인 (7일간)
node -e "
const { getQualityTrend } = require('./scripts/lib/quality-history.js');
const trend = getQualityTrend(7);
console.log('Quality Trend:', trend);
"
```

### 완료 기준

- [ ] trackQualityMetrics 호출 연결
- [ ] reports/quality-history/ 디렉토리 생성
- [ ] 매일 자동 저장 동작
- [ ] 트렌드 조회 가능

---

## 🎯 Gap #4: /radar /inspect 역할 중복

### 현재 상태

- ⚠️ 기능 70% 중복
- ⚠️ 사용자 혼란 (언제 뭘 써야 하나?)
- ✅ `docs/RADAR_NECESSITY_ANALYSIS.md`에서 통합 권장

### 결정 사항

**옵션 A**: `/radar` 제거, `/inspect --deep`로 통합 (권장)
**옵션 B**: `/radar` 유지, 역할 명확화

### 즉시 조치 - 옵션 A (4h)

```typescript
// scripts/inspection-engine.ts 수정
interface InspectionOptions {
  mode?: 'quick' | 'deep';  // NEW!
}

async runFullInspection(options: InspectionOptions = {}) {
  const mode = options.mode || 'quick';

  // 기본 체크 (항상)
  console.log('⚡ Phase 1: Running Diagnostics...');
  await this.checkTypeScript();
  await this.checkESLint();
  await this.checkTests();

  // 심층 체크 (--deep 플래그 시)
  if (mode === 'deep') {
    console.log('🔍 Deep inspection mode activated...');
    await this.analyzeCoverageGaps();      // from radar
    await this.findDuplicateDeps();        // from radar
    await this.scanUnusedExports();        // from radar
    await this.analyzeFileQualityImpact(); // from radar
  }
}
```

### CLI 인터페이스

```bash
# package.json
{
  "scripts": {
    "status": "tsx scripts/inspection-engine.ts",
    "status:deep": "tsx scripts/inspection-engine.ts --deep",
    "/inspect": "tsx scripts/inspection-engine.ts",
    "/inspect --deep": "tsx scripts/inspection-engine.ts --deep",

    // DEPRECATED (maintain for backward compatibility)
    "radar": "echo 'DEPRECATED: Use npm run status:deep instead' && tsx scripts/inspection-engine.ts --deep"
  }
}
```

### 문서 업데이트

```markdown
# docs/SLASH_COMMAND_WORKFLOW.md 수정

## 1️⃣ /inspect - 시스템 진단

### 빠른 모드 (기본)

\`\`\`bash
npm run status # 1-2분
\`\`\`

### 심층 모드 (주 1회)

\`\`\`bash
npm run status:deep # 5-10분
\`\`\`

심층 모드 추가 체크:

- 테스트 커버리지 갭
- 중복 의존성
- Unused exports
- 거대 파일 품질 영향 분석
```

### 마이그레이션 가이드

```markdown
# Migration from /radar to /inspect --deep

**Old**:
\`\`\`bash
/radar → /refactor
\`\`\`

**New**:
\`\`\`bash
/inspect --deep → /refactor
\`\`\`

**Deprecated** (v1.1.0에서 제거 예정):
\`\`\`bash
/radar # Warning: Use /inspect --deep instead
\`\`\`
```

### 검증

```bash
# 1. 빠른 모드
npm run status
# → 1-2분 소요 확인

# 2. 심층 모드
npm run status:deep
# → 5-10분 소요, radar 기능 포함 확인

# 3. Deprecated 경고
npm run radar
# → 경고 메시지 출력 확인
```

### 완료 기준

- [ ] inspection-engine.ts에 `--deep` 모드 구현
- [ ] radar 기능 통합 (커버리지, 중복 의존성 등)
- [ ] package.json 스크립트 업데이트
- [ ] 문서 업데이트 (SLASH_COMMAND_WORKFLOW.md)
- [ ] Deprecation 경고 추가

---

## 📅 실행 일정

### Day 1 (8시간)

**오전 (4h)**:

- 09:00-10:00 | Gap #2: Circular Dependency CI 통합 (30min) ✅
- 10:00-11:30 | Gap #1: Guidelines 디렉토리 구현 (1.5h)
- 11:30-12:00 | Gap #3: Quality History 연결 (30min)
- 12:00-13:00 | 점심

**오후 (4h)**:

- 13:00-17:00 | Gap #4: /radar /inspect 통합 (4h)
  - 13:00-15:00 | 코드 통합
  - 15:00-16:00 | 테스트 및 검증
  - 16:00-17:00 | 문서 업데이트

**저녁**:

- 17:00-17:30 | 전체 검증 (`npm run guard`)
- 17:30-18:00 | 커밋 및 PR 생성

---

## ✅ 최종 검증 체크리스트

### 기능 검증

- [ ] Guidelines 디렉토리 생성 및 Hot Reload 동작
- [ ] Circular Dependency CI/CD 자동 검사
- [ ] Quality History 매일 자동 저장
- [ ] /inspect --deep 실행 성공

### 통합 검증

```bash
# 1. 전체 시스템 체크
npm run guard

# 2. 통합 테스트
npx tsx scripts/test-quality-integration.ts

# 3. CI/CD 트리거
git push && gh pr create
```

### 문서 검증

- [ ] SLASH_COMMAND_WORKFLOW.md 업데이트
- [ ] GUIDELINE_INTEGRATION.md 검증
- [ ] OPERATIONS_QUICKSTART.md 반영
- [ ] CRITICAL_GAPS_ANALYSIS.md 완료 표시

---

## 📊 성공 지표

### 기술적 지표

- ✅ 22/22 통합 테스트 통과
- ✅ CI/CD 100% 성공
- ✅ Health Score 90+ 유지
- ✅ Zero P0 gaps

### 운영 지표

- ✅ 문서와 실제 시스템 100% 일치
- ✅ 모든 약속된 기능 구현 완료
- ✅ 제품화 준비 완료

---

## 🚀 다음 단계 (P0 완료 후)

### 즉시 (1주일)

1. **제품화 방향 결정**

   - Web Console?
   - Agent Platform?
   - Plugin Sandbox?

2. **P1 이슈 착수**
   - Test Coverage 80% 목표
   - Error Handling 전면 개선
   - Observability 구축

### 중기 (1개월)

3. **Dynamic Quality Protection**
4. **Plugin System 구현**
5. **Rollback 메커니즘**

---

**작성**: System Architect
**승인**: Quality Governance Team
**시작일**: 2025-10-05 (내일부터)
