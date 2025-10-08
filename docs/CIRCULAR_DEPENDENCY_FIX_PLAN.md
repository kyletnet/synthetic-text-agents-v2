# 순환 의존성 제거 계획

**발견 시간**: 2025-10-07
**심각도**: P0 (15개 순환 의존성)
**상태**: 수정 계획 수립 완료

---

## 발견된 순환 의존성

### 패턴 1: Registry ↔ Agents (14개)

```
baseAgent → registry → (all agents) → baseAgent
```

**근본 원인**: `AgentRegistry`가 모든 agent를 직접 import하여 등록

### 패턴 2: Agent ↔ Service ↔ Strategies (1개)

```
linguisticsEngineer → service → strategies → (back to service)
```

**근본 원인**: LinguisticsEngineer가 Service를 직접 import

---

## 수정 전략

### A. Registry 패턴 → Lazy Loading + Factory

#### Before (문제):

```typescript
// registry.ts
import { CognitiveScientist } from "../agents/cognitiveScientist.js";
import { LinguisticsEngineer } from "../agents/linguisticsEngineer.js";

registry.register("cognitive", new CognitiveScientist());
```

#### After (해결):

```typescript
// registry.ts
class AgentRegistry {
  private factories = new Map<string, () => Promise<BaseAgent>>();

  registerFactory(name: string, factory: () => Promise<BaseAgent>) {
    this.factories.set(name, factory);
  }

  async get(name: string): Promise<BaseAgent> {
    const factory = this.factories.get(name);
    return factory ? await factory() : null;
  }
}

// agents/index.ts (별도 파일)
export function registerAllAgents(registry: AgentRegistry) {
  registry.registerFactory("cognitive", async () => {
    const { CognitiveScientist } = await import("./cognitiveScientist.js");
    return new CognitiveScientist();
  });
}
```

**효과**: Registry는 agent를 알지 못하고, agent도 registry를 직접 알지 못함

---

### B. Agent → Service 순환 제거

#### Before (문제):

```typescript
// agents/linguisticsEngineer.ts
import { LinguisticsEngineerService } from "../application/agents/linguistics-engineer-service.js";

export class LinguisticsEngineer extends BaseAgent {
  private service = new LinguisticsEngineerService();
}
```

#### After (해결):

```typescript
// agents/linguisticsEngineer.ts
export class LinguisticsEngineer extends BaseAgent {
  private service: any; // lazy loaded

  private async getService() {
    if (!this.service) {
      const { LinguisticsEngineerService } = await import(
        "../application/agents/linguistics-engineer-service.js"
      );
      this.service = new LinguisticsEngineerService(this.logger);
    }
    return this.service;
  }

  async process(request: any) {
    const service = await this.getService();
    return service.analyze(request);
  }
}
```

---

## 구현 우선순위

### Phase 1: Registry 순환 제거 (P0)

- [ ] `AgentRegistry`를 Factory 패턴으로 변경
- [ ] `agents/index.ts`에 등록 함수 분리
- [ ] BaseAgent에서 registry import 제거

### Phase 2: Agent ↔ Service 순환 제거 (P0)

- [ ] LinguisticsEngineer에 lazy loading 적용
- [ ] CognitiveScientist에 lazy loading 적용

### Phase 3: 검증 (P0)

- [ ] `npx madge --circular src` → 0개 확인
- [ ] `npx depcruiser --config .dependency-cruiser.cjs src` → error 0개
- [ ] 전체 테스트 실행 → 647/647 통과

---

## 롤백 절차

만약 수정 중 문제 발생 시:

```bash
git stash
npm test  # 이전 상태 복원 확인
```

---

## 완료 기준

- ✅ 순환 의존성 0개
- ✅ 모든 테스트 통과
- ✅ 빌드 성공
- ✅ DDD 경계 검증 통과

---

**참고**: 이 수정은 코드 동작을 변경하지 않고 import 순서만 변경하므로 안전함.
단, Lazy loading으로 인해 초기화 시점이 약간 지연될 수 있음 (무시 가능한 수준).
