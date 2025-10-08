/**
 * Code Analyzer - Domain Layer
 * Responsible for AST analysis and code structure parsing
 */

export interface CodeMetrics {
  lineCount: number;
  functionCount: number;
  classCount: number;
  interfaceCount: number;
  importCount: number;
  exportCount: number;
  complexity: number;
}

export interface ImportInfo {
  name: string;
  path: string;
  isDefault: boolean;
  isTypeOnly: boolean;
  line: number;
}

export interface ExportInfo {
  name: string;
  type: "interface" | "type" | "class" | "function" | "const";
  line: number;
}

export interface InterfaceInfo {
  name: string;
  content: string;
  fields: string[];
  startLine: number;
  endLine: number;
}

export interface MethodSignature {
  name: string;
  parameters: string[];
  returnType: string | null;
  file: string;
  line: number;
}

export interface GuardrailInfo {
  hasErrorBoundary: boolean;
  hasCircuitBreaker: boolean;
  hasFallback: boolean;
  hasTimeout: boolean;
  hasRetry: boolean;
  hasValidation: boolean;
  score: number;
}

/**
 * Analyzes code metrics from file content
 */
export function analyzeCodeMetrics(content: string): CodeMetrics {
  const lines = content.split("\n");
  const lineCount = lines.length;

  const functionCount =
    (content.match(/function\s+\w+/g) || []).length +
    (content.match(/const\s+\w+\s*=\s*(?:async\s+)?\(/g) || []).length;

  const classCount = (content.match(/class\s+\w+/g) || []).length;

  const interfaceCount = (content.match(/interface\s+\w+/g) || []).length;

  const importCount = content
    .split("\n")
    .filter((line) => line.trim().startsWith("import")).length;

  const exportCount = (
    content.match(/export\s+(interface|type|class|function|const)/g) || []
  ).length;

  // Simple cyclomatic complexity approximation
  const complexity =
    (content.match(/if\s*\(/g) || []).length +
    (content.match(/else\s+if\s*\(/g) || []).length +
    (content.match(/for\s*\(/g) || []).length +
    (content.match(/while\s*\(/g) || []).length +
    (content.match(/case\s+/g) || []).length +
    (content.match(/\?\s*[^:]+:/g) || []).length;

  return {
    lineCount,
    functionCount,
    classCount,
    interfaceCount,
    importCount,
    exportCount,
    complexity,
  };
}

/**
 * Extracts import information from file content
 */
export function extractImports(content: string): ImportInfo[] {
  const imports: ImportInfo[] = [];
  const lines = content.split("\n");

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("import")) return;

    // Check if this is a type-only import
    const isTypeOnly = /import\s+type\s+/.test(line);

    // Named imports: import { foo, bar } from "path" OR import type { foo } from "path"
    const namedMatch = line.match(
      /import\s+(?:type\s+)?{\s*([^}]+)\s*}\s*from\s+['"](.+?)['"]/,
    );
    if (namedMatch) {
      const names = namedMatch[1].split(",").map((n) => n.trim());
      const path = namedMatch[2];

      names.forEach((name) => {
        const cleanName = name.replace(/\s+as\s+\w+/, "").trim();
        imports.push({
          name: cleanName,
          path,
          isDefault: false,
          isTypeOnly,
          line: index + 1,
        });
      });
      return; // Prevent double matching
    }

    // Default import: import foo from "path" OR import type foo from "path"
    const defaultMatch = line.match(
      /import\s+(?:type\s+)?(\w+)\s+from\s+['"](.+?)['"]/,
    );
    if (defaultMatch) {
      imports.push({
        name: defaultMatch[1],
        path: defaultMatch[2],
        isDefault: true,
        isTypeOnly,
        line: index + 1,
      });
    }
  });

  return imports;
}

/**
 * Extracts export information from file content
 */
export function extractExports(content: string): ExportInfo[] {
  const exports: ExportInfo[] = [];
  const lines = content.split("\n");

  lines.forEach((line, index) => {
    const match = line.match(
      /export\s+(interface|type|class|function|const)\s+(\w+)/,
    );
    if (match) {
      exports.push({
        name: match[2],
        type: match[1] as ExportInfo["type"],
        line: index + 1,
      });
    }
  });

  return exports;
}

/**
 * Extracts interface content including all fields
 */
export function extractInterface(
  content: string,
  interfaceName: string,
): InterfaceInfo | null {
  const interfaceStart = content.indexOf(`interface ${interfaceName}`);
  if (interfaceStart === -1) return null;

  // Find line number
  const beforeInterface = content.substring(0, interfaceStart);
  const startLine = beforeInterface.split("\n").length;

  // Find opening brace
  let braceCount = 0;
  let index = content.indexOf("{", interfaceStart);
  const contentStart = index;

  // Find closing brace
  while (index < content.length) {
    if (content[index] === "{") braceCount++;
    if (content[index] === "}") braceCount--;
    if (braceCount === 0) break;
    index++;
  }

  const interfaceContent = content.substring(contentStart, index + 1);
  const endLine = startLine + interfaceContent.split("\n").length - 1;

  // Extract fields
  const fields: string[] = [];
  const fieldMatches = interfaceContent.matchAll(/(\w+)\s*[?:]?\s*:/g);
  for (const match of fieldMatches) {
    fields.push(match[1]);
  }

  return {
    name: interfaceName,
    content: interfaceContent,
    fields,
    startLine,
    endLine,
  };
}

/**
 * Extracts all interfaces from content
 */
export function extractAllInterfaces(content: string): InterfaceInfo[] {
  const interfaces: InterfaceInfo[] = [];
  const interfaceMatches = content.matchAll(/interface\s+(\w+)/g);

  for (const match of interfaceMatches) {
    const interfaceName = match[1];
    const info = extractInterface(content, interfaceName);
    if (info) {
      interfaces.push(info);
    }
  }

  return interfaces;
}

/**
 * Detects method signatures in content
 */
export function extractMethodSignatures(
  content: string,
  filePath: string,
): MethodSignature[] {
  const signatures: MethodSignature[] = [];
  const lines = content.split("\n");

  lines.forEach((line, index) => {
    // Function declarations
    const funcMatch = line.match(
      /(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)(?:\s*:\s*([^{]+))?/,
    );
    if (funcMatch) {
      signatures.push({
        name: funcMatch[1],
        parameters: funcMatch[2]
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean),
        returnType: funcMatch[3]?.trim() || null,
        file: filePath,
        line: index + 1,
      });
    }

    // Method declarations
    const methodMatch = line.match(
      /(?:public|private|protected)?\s*(?:async\s+)?(\w+)\s*\(([^)]*)\)(?:\s*:\s*([^{]+))?/,
    );
    if (methodMatch && !line.includes("function")) {
      signatures.push({
        name: methodMatch[1],
        parameters: methodMatch[2]
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean),
        returnType: methodMatch[3]?.trim() || null,
        file: filePath,
        line: index + 1,
      });
    }
  });

  return signatures;
}

/**
 * Analyzes runtime guardrail coverage
 */
export function analyzeGuardrails(content: string): GuardrailInfo {
  const hasErrorBoundary = content.includes("try") && content.includes("catch");
  const hasCircuitBreaker =
    content.includes("CircuitBreaker") || content.includes("circuitBreaker");
  const hasFallback =
    content.includes("fallback") ||
    content.includes("defaultValue") ||
    content.includes("|| ");
  const hasTimeout =
    content.includes("timeout") ||
    content.includes("setTimeout") ||
    content.includes("AbortController");
  const hasRetry = content.includes("retry") || content.includes("attempt");
  const hasValidation =
    content.includes("validate") ||
    content.includes("assert") ||
    content.includes("schema");

  const score = [
    hasErrorBoundary,
    hasCircuitBreaker,
    hasFallback,
    hasTimeout,
    hasRetry,
    hasValidation,
  ].filter(Boolean).length;

  return {
    hasErrorBoundary,
    hasCircuitBreaker,
    hasFallback,
    hasTimeout,
    hasRetry,
    hasValidation,
    score,
  };
}

/**
 * Detects circular import patterns
 */
export function detectCircularImports(
  fileImports: Map<string, ImportInfo[]>,
  fileContent: Map<string, string>,
): Array<{ file1: string; file2: string }> {
  const circular: Array<{ file1: string; file2: string }> = [];

  for (const [file, imports] of fileImports) {
    for (const imp of imports) {
      if (!imp.path.startsWith("./") && !imp.path.startsWith("../")) continue;

      const targetFile = resolveImportPath(file, imp.path);
      const targetContent = fileContent.get(targetFile);

      if (targetContent) {
        const fileName = file.split("/").pop()?.replace(".ts", "");
        if (fileName) {
          const reverseImportPattern = new RegExp(
            `from\\s+['"].*${fileName}.*['"]`,
          );
          if (reverseImportPattern.test(targetContent)) {
            circular.push({ file1: file, file2: targetFile });
          }
        }
      }
    }
  }

  return circular;
}

/**
 * Resolves relative import paths
 */
function resolveImportPath(currentFile: string, importPath: string): string {
  const currentDir = currentFile.substring(0, currentFile.lastIndexOf("/"));
  if (importPath.startsWith("./")) {
    return `${currentDir}/${importPath.substring(2)}.ts`;
  } else if (importPath.startsWith("../")) {
    return `${currentDir}/${importPath}.ts`;
  }
  return importPath;
}

/**
 * Detects unused imports in content
 */
export function detectUnusedImports(
  content: string,
  imports: ImportInfo[],
): Array<{ import: string; unused: string }> {
  const unused: Array<{ import: string; unused: string }> = [];

  for (const imp of imports) {
    const usagePattern = new RegExp(`\\b${imp.name}\\b`, "g");
    const matches = content.match(usagePattern) || [];

    // If the import only appears once (in the import statement itself)
    if (matches.length <= 1) {
      unused.push({
        import: `import { ${imp.name} } from "${imp.path}"`,
        unused: imp.name,
      });
    }
  }

  return unused;
}

/**
 * Checks if a file is critical (agents, core, API)
 */
export function isCriticalFile(filePath: string): boolean {
  return (
    filePath.includes("agents/") ||
    filePath.includes("core/") ||
    filePath.includes("api/") ||
    filePath.includes("orchestrator")
  );
}

/**
 * Detects ambiguous naming patterns
 */
export function detectAmbiguousNaming(filePath: string): boolean {
  const filename = filePath.split("/").pop() || "";
  const ambiguousPatterns = [
    /Agent\w*Runner/,
    /Agent\w*Coordinator/,
    /\w*Manager\w*/,
    /\w*Handler\w*/,
    /\w*Helper\w*/,
    /\w*Util\w*/,
  ];

  return ambiguousPatterns.some((pattern) => pattern.test(filename));
}
