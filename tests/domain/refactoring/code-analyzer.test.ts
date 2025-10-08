/**
 * Unit tests for code-analyzer.ts
 */

import { describe, it, expect } from "vitest";
import * as CodeAnalyzer from "../../../src/domain/refactoring/code-analyzer.js";

describe("CodeAnalyzer", () => {
  describe("analyzeCodeMetrics", () => {
    it("should count lines correctly", () => {
      const content = `line 1
line 2
line 3`;
      const metrics = CodeAnalyzer.analyzeCodeMetrics(content);
      expect(metrics.lineCount).toBe(3);
    });

    it("should count functions", () => {
      const content = `
function test1() {}
const test2 = () => {};
async function test3() {}
const test4 = async () => {};
`;
      const metrics = CodeAnalyzer.analyzeCodeMetrics(content);
      expect(metrics.functionCount).toBeGreaterThanOrEqual(3);
    });

    it("should count classes and interfaces", () => {
      const content = `
class MyClass {}
interface MyInterface {}
interface AnotherInterface {}
`;
      const metrics = CodeAnalyzer.analyzeCodeMetrics(content);
      expect(metrics.classCount).toBe(1);
      expect(metrics.interfaceCount).toBe(2);
    });

    it("should count imports and exports", () => {
      const content = `
import { something } from './module';
import another from './another';
export interface MyInterface {}
export class MyClass {}
export const myConst = 1;
`;
      const metrics = CodeAnalyzer.analyzeCodeMetrics(content);
      expect(metrics.importCount).toBe(2);
      expect(metrics.exportCount).toBe(3);
    });

    it("should calculate complexity", () => {
      const content = `
function complex() {
  if (condition) {
    for (let i = 0; i < 10; i++) {
      if (anotherCondition) {
        while (true) {
          break;
        }
      }
    }
  }
}
`;
      const metrics = CodeAnalyzer.analyzeCodeMetrics(content);
      expect(metrics.complexity).toBeGreaterThan(0);
    });
  });

  describe("extractImports", () => {
    it("should extract named imports", () => {
      const content = `import { foo, bar } from './module';`;
      const imports = CodeAnalyzer.extractImports(content);
      expect(imports).toHaveLength(2);
      expect(imports[0].name).toBe("foo");
      expect(imports[1].name).toBe("bar");
      expect(imports[0].path).toBe("./module");
    });

    it("should extract default imports", () => {
      const content = `import MyModule from './module';`;
      const imports = CodeAnalyzer.extractImports(content);
      expect(imports).toHaveLength(1);
      expect(imports[0].name).toBe("MyModule");
      expect(imports[0].isDefault).toBe(true);
    });

    it("should detect type-only imports", () => {
      const content = `import type { MyType } from './types';`;
      const imports = CodeAnalyzer.extractImports(content);
      expect(imports[0].isTypeOnly).toBe(true);
    });

    it("should handle imports with aliases", () => {
      const content = `import { foo as bar } from './module';`;
      const imports = CodeAnalyzer.extractImports(content);
      expect(imports[0].name).toBe("foo");
    });
  });

  describe("extractExports", () => {
    it("should extract all export types", () => {
      const content = `
export interface MyInterface {}
export type MyType = string;
export class MyClass {}
export function myFunction() {}
export const myConst = 1;
`;
      const exports = CodeAnalyzer.extractExports(content);
      expect(exports).toHaveLength(5);
      expect(exports[0].type).toBe("interface");
      expect(exports[1].type).toBe("type");
      expect(exports[2].type).toBe("class");
      expect(exports[3].type).toBe("function");
      expect(exports[4].type).toBe("const");
    });
  });

  describe("extractInterface", () => {
    it("should extract interface with fields", () => {
      const content = `
export interface MyInterface {
  id: string;
  name: string;
  age?: number;
}
`;
      const iface = CodeAnalyzer.extractInterface(content, "MyInterface");
      expect(iface).not.toBeNull();
      expect(iface?.fields).toContain("id");
      expect(iface?.fields).toContain("name");
      expect(iface?.fields).toContain("age");
    });

    it("should return null for non-existent interface", () => {
      const content = `interface OtherInterface {}`;
      const iface = CodeAnalyzer.extractInterface(content, "NonExistent");
      expect(iface).toBeNull();
    });

    it("should handle nested interfaces", () => {
      const content = `
interface MyInterface {
  nested: {
    field: string;
  };
  regular: number;
}
`;
      const iface = CodeAnalyzer.extractInterface(content, "MyInterface");
      expect(iface?.fields).toContain("nested");
      expect(iface?.fields).toContain("regular");
    });
  });

  describe("extractMethodSignatures", () => {
    it("should extract function declarations", () => {
      const content = `
function myFunction(param1: string, param2: number): boolean {
  return true;
}
`;
      const signatures = CodeAnalyzer.extractMethodSignatures(
        content,
        "test.ts",
      );
      expect(signatures).toHaveLength(1);
      expect(signatures[0].name).toBe("myFunction");
      expect(signatures[0].parameters).toHaveLength(2);
      expect(signatures[0].returnType).toContain("boolean");
    });

    it("should extract async functions", () => {
      const content = `async function asyncFunc(): Promise<void> {}`;
      const signatures = CodeAnalyzer.extractMethodSignatures(
        content,
        "test.ts",
      );
      expect(signatures[0].name).toBe("asyncFunc");
    });
  });

  describe("analyzeGuardrails", () => {
    it("should detect error boundaries", () => {
      const content = `
try {
  doSomething();
} catch (error) {
  handleError(error);
}
`;
      const guardrails = CodeAnalyzer.analyzeGuardrails(content);
      expect(guardrails.hasErrorBoundary).toBe(true);
      expect(guardrails.score).toBeGreaterThan(0);
    });

    it("should detect circuit breakers", () => {
      const content = `const breaker = new CircuitBreaker();`;
      const guardrails = CodeAnalyzer.analyzeGuardrails(content);
      expect(guardrails.hasCircuitBreaker).toBe(true);
    });

    it("should detect fallbacks", () => {
      const content = `const value = getValue() || defaultValue;`;
      const guardrails = CodeAnalyzer.analyzeGuardrails(content);
      expect(guardrails.hasFallback).toBe(true);
    });

    it("should detect timeouts", () => {
      const content = `setTimeout(() => {}, 1000);`;
      const guardrails = CodeAnalyzer.analyzeGuardrails(content);
      expect(guardrails.hasTimeout).toBe(true);
    });

    it("should detect retry logic", () => {
      const content = `await retry(() => fetchData(), 3);`;
      const guardrails = CodeAnalyzer.analyzeGuardrails(content);
      expect(guardrails.hasRetry).toBe(true);
    });

    it("should detect validation", () => {
      const content = `validate(input);`;
      const guardrails = CodeAnalyzer.analyzeGuardrails(content);
      expect(guardrails.hasValidation).toBe(true);
    });

    it("should calculate score correctly", () => {
      const content = `
try {
  validate(input);
  const result = getValue() || defaultValue;
  await retry(() => fetch());
} catch (error) {
  console.error(error);
}
`;
      const guardrails = CodeAnalyzer.analyzeGuardrails(content);
      expect(guardrails.score).toBeGreaterThanOrEqual(3);
    });
  });

  describe("detectUnusedImports", () => {
    it("should detect unused imports", () => {
      const content = `
import { used, unused } from './module';
const x = used;
`;
      const imports = CodeAnalyzer.extractImports(content);
      const unused = CodeAnalyzer.detectUnusedImports(content, imports);
      expect(unused.some((u) => u.unused === "unused")).toBe(true);
    });

    it("should not flag used imports", () => {
      const content = `
import { used } from './module';
const x = used;
`;
      const imports = CodeAnalyzer.extractImports(content);
      const unused = CodeAnalyzer.detectUnusedImports(content, imports);
      expect(unused).toHaveLength(0);
    });
  });

  describe("isCriticalFile", () => {
    it("should identify agent files as critical", () => {
      expect(CodeAnalyzer.isCriticalFile("src/agents/test.ts")).toBe(true);
    });

    it("should identify core files as critical", () => {
      expect(CodeAnalyzer.isCriticalFile("src/core/orchestrator.ts")).toBe(
        true,
      );
    });

    it("should identify API files as critical", () => {
      expect(CodeAnalyzer.isCriticalFile("apps/api/routes.ts")).toBe(true);
    });

    it("should not identify utility files as critical", () => {
      expect(CodeAnalyzer.isCriticalFile("src/utils/helper.ts")).toBe(false);
    });
  });

  describe("detectAmbiguousNaming", () => {
    it("should detect ambiguous naming patterns", () => {
      expect(CodeAnalyzer.detectAmbiguousNaming("src/AgentRunner.ts")).toBe(
        true,
      );
      expect(CodeAnalyzer.detectAmbiguousNaming("src/DataManager.ts")).toBe(
        true,
      );
      expect(CodeAnalyzer.detectAmbiguousNaming("src/StringHelper.ts")).toBe(
        true,
      );
      expect(CodeAnalyzer.detectAmbiguousNaming("src/ApiHandler.ts")).toBe(
        true,
      );
    });

    it("should not flag clear naming", () => {
      expect(CodeAnalyzer.detectAmbiguousNaming("src/UserRepository.ts")).toBe(
        false,
      );
      expect(CodeAnalyzer.detectAmbiguousNaming("src/OrderProcessor.ts")).toBe(
        false,
      );
    });
  });
});
