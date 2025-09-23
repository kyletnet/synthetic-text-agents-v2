# Vitest 테스트 코드 스니펫 예시

## Contract example (pseudo)

```typescript
describe("contract", () => {
  it("run_result has required keys", () => {
    /* schema assertions */
  });
});
```

## Feature flag example (pseudo)

```typescript
describe("feature-A: searchLite", () => {
  it("on vs off schema equal; latency delta within bound", () => {
    /* assertions */
  });
});
```
