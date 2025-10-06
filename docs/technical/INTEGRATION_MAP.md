# 기술 접근 통합 맵

## 문서 참조 경로

### 1. 거버넌스 단 (Governance)

- **위치**: `governance-rules.json`
- **역할**: 기술 적용 정책 정의
- **참조**: `docs/RFC/2024-10-quality-enhancement-approaches.md`

```json
{
  "qualityEnhancement": {
    "approvedTechniques": [
      {
        "name": "embedding-based-similarity",
        "rfc": "2024-10-quality-enhancement-approaches",
        "status": "approved",
        "featureFlag": "FEATURE_QUALITY_SEMANTIC"
      }
    ],
    "experimentalTechniques": [
      {
        "name": "llm-as-judge",
        "rfc": "2024-10-quality-enhancement-approaches",
        "status": "experimental",
        "requirements": ["budget-approval", "performance-benchmark"]
      }
    ]
  }
}
```

### 2. CI/CD 단

- **위치**: `.github/workflows/quality-enhancement.yml`
- **역할**: 기술 검증 파이프라인
- **참조**: RFC의 "Testing Strategy" 섹션

```yaml
- name: 🔬 Advanced Quality Checks
  if: env.FEATURE_QUALITY_ADVANCED == 'true'
  run: |
    # RFC에 정의된 기술 실행
    npm run quality:advanced
```

### 3. 코드 단

- **위치**: `scripts/quality/checkers/`
- **역할**: 구체적 구현
- **참조**: RFC의 "Implementation Details" 섹션

```typescript
// scripts/quality/checkers/advanced-checker.ts
/**
 * @see docs/RFC/2024-10-quality-enhancement-approaches.md#semantic-similarity
 */
export class SemanticChecker implements QualityChecker {
  // RFC 기반 구현
}
```

### 4. 설계 단

- **위치**: `scripts/quality/models/`
- **역할**: 인터페이스 정의
- **참조**: RFC의 "Architecture" 섹션

```typescript
// scripts/quality/models/advanced-metrics.ts
/**
 * Advanced Quality Metrics
 * @specification docs/RFC/2024-10-quality-enhancement-approaches.md
 */
export interface AdvancedQualityMetric {
  // RFC에 정의된 메트릭 구조
}
```
