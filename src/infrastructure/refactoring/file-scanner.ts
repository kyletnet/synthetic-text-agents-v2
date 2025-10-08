/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * File Scanner - Infrastructure Layer
 * Responsible for file system operations and content reading
 */

import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { glob } from "glob";

export interface FileContent {
  path: string;
  content: string;
  stats: {
    size: number;
    modified: Date;
  };
}

export interface ScanResult {
  files: string[];
  contents: Map<string, string>;
  errors: Array<{ file: string; error: string }>;
}

export interface ScanOptions {
  rootDir: string;
  patterns: string[];
  ignorePatterns?: string[];
  maxFileSize?: number; // in bytes
  encoding?: BufferEncoding;
}

/**
 * Scans files matching glob patterns
 */
export function scanFiles(options: ScanOptions): ScanResult {
  const {
    rootDir,
    patterns,
    ignorePatterns = ["node_modules/**", ".git/**", "dist/**", "build/**"],
    maxFileSize = 1024 * 1024, // 1MB default
    encoding = "utf-8",
  } = options;

  const files: string[] = [];
  const contents = new Map<string, string>();
  const errors: Array<{ file: string; error: string }> = [];

  for (const pattern of patterns) {
    try {
      const matches = glob.sync(pattern, {
        cwd: rootDir,
        ignore: ignorePatterns,
        absolute: false,
      });

      for (const file of matches) {
        const fullPath = join(rootDir, file);

        // Check file size
        try {
          const stats = statSync(fullPath);
          if (stats.size > maxFileSize) {
            errors.push({
              file,
              error: `File too large: ${stats.size} bytes (max: ${maxFileSize})`,
            });
            continue;
          }

          // Read content
          const content = readFileSync(fullPath, encoding);
          files.push(file);
          contents.set(file, content);
        } catch (error) {
          errors.push({
            file,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    } catch (error) {
      errors.push({
        file: pattern,
        error: `Pattern scan failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }
  }

  return { files, contents, errors };
}

/**
 * Finds slash command files
 */
export function findSlashCommands(rootDir: string): string[] {
  return glob.sync(".claude/commands/*.md", { cwd: rootDir });
}

/**
 * Finds CLI script files
 */
export function findCLIScripts(rootDir: string): string[] {
  return glob.sync("src/cli/**/*.ts", { cwd: rootDir });
}

/**
 * Finds API route files
 */
export function findAPIRoutes(rootDir: string): string[] {
  return glob.sync("apps/**/api/**/*.ts", { cwd: rootDir });
}

/**
 * Finds TypeScript source files
 */
export function findTypeScriptFiles(rootDir: string): string[] {
  return glob.sync("src/**/*.ts", {
    cwd: rootDir,
    ignore: ["**/*.test.ts", "**/*.spec.ts"],
  });
}

/**
 * Finds agent implementation files
 */
export function findAgentFiles(rootDir: string): string[] {
  return glob.sync("src/agents/**/*.ts", { cwd: rootDir });
}

/**
 * Finds type definition files
 */
export function findTypeFiles(rootDir: string): string[] {
  return glob.sync("src/**/*types*.ts", { cwd: rootDir });
}

/**
 * Finds report files
 */
export function findReportFiles(rootDir: string): string[] {
  return glob.sync("reports/**/*.jsonl", { cwd: rootDir });
}

/**
 * Finds maintenance script files
 */
export function findMaintenanceFiles(rootDir: string): string[] {
  return glob.sync("scripts/*maintenance*.ts", { cwd: rootDir });
}

/**
 * Finds approval-related files
 */
export function findApprovalFiles(rootDir: string): string[] {
  return glob.sync("scripts/**/*approval*.ts", { cwd: rootDir });
}

/**
 * Finds orchestrator files
 */
export function findOrchestratorFiles(rootDir: string): string[] {
  return glob.sync("scripts/**/*orchestrator*.ts", { cwd: rootDir });
}

/**
 * Finds self-healing related files
 */
export function findHealingFiles(rootDir: string): string[] {
  return glob.sync("apps/**/lib/*healing*.ts", { cwd: rootDir });
}

/**
 * Finds CI/CD workflow files
 */
export function findCIFiles(rootDir: string): string[] {
  return glob.sync(".github/workflows/**/*.yml", { cwd: rootDir });
}

/**
 * Safely reads a file, returns null on error
 */
export function safeReadFile(
  filePath: string,
  rootDir: string,
  encoding: BufferEncoding = "utf-8",
): string | null {
  try {
    const fullPath = filePath.startsWith("/")
      ? filePath
      : join(rootDir, filePath);
    return readFileSync(fullPath, encoding);
  } catch {
    return null;
  }
}

/**
 * Checks if file exists
 */
export function fileExists(filePath: string, rootDir: string): boolean {
  const fullPath = filePath.startsWith("/")
    ? filePath
    : join(rootDir, filePath);
  return existsSync(fullPath);
}

/**
 * Reads multiple files and returns a map of path -> content
 */
export function readFiles(
  files: string[],
  rootDir: string,
  encoding: BufferEncoding = "utf-8",
): Map<string, string> {
  const contents = new Map<string, string>();

  for (const file of files) {
    const content = safeReadFile(file, rootDir, encoding);
    if (content !== null) {
      contents.set(file, content);
    }
  }

  return contents;
}

/**
 * Reads JSON file safely
 */
export function readJSONFile<T = unknown>(
  filePath: string,
  rootDir: string,
): T | null {
  const content = safeReadFile(filePath, rootDir);
  if (!content) return null;

  try {
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

/**
 * Scans directory recursively
 */
export function scanDirectory(
  dirPath: string,
  options: {
    rootDir: string;
    extensions?: string[];
    maxDepth?: number;
    ignorePatterns?: string[];
  },
): string[] {
  const {
    rootDir,
    extensions = [".ts", ".js"],
    maxDepth = 10,
    ignorePatterns = [],
  } = options;
  const fullPath = dirPath.startsWith("/") ? dirPath : join(rootDir, dirPath);

  if (!existsSync(fullPath)) return [];

  const results: string[] = [];

  function scan(currentPath: string, depth: number) {
    if (depth > maxDepth) return;

    try {
      const entries = readdirSync(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const entryPath = join(currentPath, entry.name);
        const relativePath = entryPath.replace(rootDir + "/", "");

        // Check ignore patterns
        if (ignorePatterns.some((pattern) => relativePath.includes(pattern))) {
          continue;
        }

        if (entry.isDirectory()) {
          scan(entryPath, depth + 1);
        } else if (entry.isFile()) {
          const hasValidExtension = extensions.some((ext) =>
            entry.name.endsWith(ext),
          );
          if (hasValidExtension) {
            results.push(relativePath);
          }
        }
      }
    } catch (error) {
      // Silently skip directories we can't read
    }
  }

  scan(fullPath, 0);
  return results;
}

/**
 * Gets file statistics
 */
export function getFileStats(
  filePath: string,
  rootDir: string,
): { size: number; modified: Date } | null {
  const fullPath = filePath.startsWith("/")
    ? filePath
    : join(rootDir, filePath);

  try {
    const stats = statSync(fullPath);
    return {
      size: stats.size,
      modified: stats.mtime,
    };
  } catch {
    return null;
  }
}

/**
 * Batch file reader with parallel processing
 */
export function batchReadFiles(
  files: string[],
  rootDir: string,
  options: {
    batchSize?: number;
    encoding?: BufferEncoding;
    onProgress?: (current: number, total: number) => void;
  } = {},
): Map<string, string> {
  const { batchSize = 100, encoding = "utf-8", onProgress } = options;
  const contents = new Map<string, string>();

  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);

    for (const file of batch) {
      const content = safeReadFile(file, rootDir, encoding);
      if (content !== null) {
        contents.set(file, content);
      }
    }

    if (onProgress) {
      onProgress(Math.min(i + batchSize, files.length), files.length);
    }
  }

  return contents;
}

/**
 * Creates a file content cache
 */
export class FileContentCache {
  private cache = new Map<string, { content: string; mtime: number }>();
  private rootDir: string;

  constructor(rootDir: string) {
    this.rootDir = rootDir;
  }

  get(filePath: string): string | null {
    const cached = this.cache.get(filePath);
    if (!cached) return null;

    // Check if file was modified
    const stats = getFileStats(filePath, this.rootDir);
    if (!stats || stats.modified.getTime() !== cached.mtime) {
      this.cache.delete(filePath);
      return null;
    }

    return cached.content;
  }

  set(filePath: string, content: string): void {
    const stats = getFileStats(filePath, this.rootDir);
    if (stats) {
      this.cache.set(filePath, {
        content,
        mtime: stats.modified.getTime(),
      });
    }
  }

  getOrRead(filePath: string): string | null {
    const cached = this.get(filePath);
    if (cached !== null) return cached;

    const content = safeReadFile(filePath, this.rootDir);
    if (content !== null) {
      this.set(filePath, content);
    }
    return content;
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

/**
 * Finds files by pattern with caching
 */
export class FilePatternScanner {
  private patternCache = new Map<
    string,
    { files: string[]; timestamp: number }
  >();
  private rootDir: string;
  private cacheTTL: number;

  constructor(rootDir: string, cacheTTL = 5000) {
    this.rootDir = rootDir;
    this.cacheTTL = cacheTTL;
  }

  scan(pattern: string, ignorePatterns: string[] = []): string[] {
    const cacheKey = `${pattern}:${ignorePatterns.join(",")}`;
    const cached = this.patternCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.files;
    }

    const files = glob.sync(pattern, {
      cwd: this.rootDir,
      ignore: ignorePatterns,
    });

    this.patternCache.set(cacheKey, {
      files,
      timestamp: Date.now(),
    });

    return files;
  }

  clearCache(): void {
    this.patternCache.clear();
  }
}
