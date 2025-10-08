#!/usr/bin/env tsx
/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */


/**
 * Security Guard
 *
 * Purpose:
 * - Detect race conditions in file operations
 * - Prevent circular dependencies
 * - Monitor concurrent access patterns
 * - Validate file operation safety
 *
 * Design:
 * - Lock-based synchronization for file operations
 * - Dependency graph validation
 * - Concurrent access tracking
 * - Automatic recovery from deadlocks
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

interface FileLock {
  path: string;
  holder: string;
  acquiredAt: number;
  expiresAt: number;
}

interface DependencyEdge {
  from: string;
  to: string;
  type: "import" | "require" | "dynamic";
}

export class SecurityGuard {
  private locks = new Map<string, FileLock>();
  private lockTimeout = 30000; // 30 seconds
  private dependencyGraph: DependencyEdge[] = [];
  private projectRoot: string;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
  }

  /**
   * Acquire exclusive lock on file
   * Prevents race conditions in concurrent file operations
   */
  async acquireLock(
    filePath: string,
    holder: string,
    timeout: number = this.lockTimeout,
  ): Promise<boolean> {
    const normalizedPath = this.normalizePath(filePath);
    const now = Date.now();

    // Check if lock exists
    const existingLock = this.locks.get(normalizedPath);
    if (existingLock) {
      // Check if lock expired
      if (existingLock.expiresAt < now) {
        console.warn(
          `⚠️  Lock expired for ${normalizedPath}, previously held by ${existingLock.holder}`,
        );
        this.locks.delete(normalizedPath);
      } else {
        // Lock still valid
        const remainingMs = existingLock.expiresAt - now;
        console.error(
          `❌ Lock held by ${existingLock.holder} for ${normalizedPath} (expires in ${remainingMs}ms)`,
        );
        return false;
      }
    }

    // Acquire lock
    this.locks.set(normalizedPath, {
      path: normalizedPath,
      holder,
      acquiredAt: now,
      expiresAt: now + timeout,
    });

    return true;
  }

  /**
   * Release lock on file
   */
  releaseLock(filePath: string, holder: string): boolean {
    const normalizedPath = this.normalizePath(filePath);
    const lock = this.locks.get(normalizedPath);

    if (!lock) {
      console.warn(`⚠️  No lock found for ${normalizedPath}`);
      return false;
    }

    if (lock.holder !== holder) {
      console.error(
        `❌ Lock holder mismatch: expected ${holder}, got ${lock.holder}`,
      );
      return false;
    }

    this.locks.delete(normalizedPath);
    return true;
  }

  /**
   * Execute operation with automatic lock management
   */
  async withLock<T>(
    filePath: string,
    holder: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const acquired = await this.acquireLock(filePath, holder);
    if (!acquired) {
      throw new Error(`Failed to acquire lock for ${filePath}`);
    }

    try {
      return await operation();
    } finally {
      this.releaseLock(filePath, holder);
    }
  }

  /**
   * Detect circular dependencies in TypeScript/JavaScript files
   */
  detectCircularDependencies(): {
    cycles: string[][];
    graph: DependencyEdge[];
  } {
    console.log("🔍 Scanning for circular dependencies...");

    // Build dependency graph
    this.buildDependencyGraph();

    // Find cycles using DFS
    const cycles = this.findCycles();

    return {
      cycles,
      graph: this.dependencyGraph,
    };
  }

  /**
   * Build dependency graph from source files
   */
  private buildDependencyGraph(): void {
    this.dependencyGraph = [];

    // Find all TypeScript/JavaScript files
    const files = this.findSourceFiles();

    for (const file of files) {
      try {
        const content = readFileSync(file, "utf-8");
        const deps = this.extractDependencies(content, file);
        this.dependencyGraph.push(...deps);
      } catch (error) {
        console.warn(`⚠️  Failed to analyze ${file}:`, error);
      }
    }
  }

  /**
   * Find all source files
   */
  private findSourceFiles(): string[] {
    try {
      const output = execSync(
        'find src scripts -type f \\( -name "*.ts" -o -name "*.js" \\) ! -path "*/node_modules/*" ! -path "*/dist/*"',
        {
          encoding: "utf-8",
          cwd: this.projectRoot,
        },
      );

      return output.trim().split("\n").filter(Boolean);
    } catch (error) {
      console.warn("⚠️  Failed to find source files:", error);
      return [];
    }
  }

  /**
   * Extract dependencies from file content
   */
  private extractDependencies(
    content: string,
    filePath: string,
  ): DependencyEdge[] {
    const edges: DependencyEdge[] = [];

    // Match import statements
    const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      if (this.isLocalImport(importPath)) {
        edges.push({
          from: filePath,
          to: this.resolveImportPath(filePath, importPath),
          type: "import",
        });
      }
    }

    // Match require statements
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = requireRegex.exec(content)) !== null) {
      const importPath = match[1];
      if (this.isLocalImport(importPath)) {
        edges.push({
          from: filePath,
          to: this.resolveImportPath(filePath, importPath),
          type: "require",
        });
      }
    }

    return edges;
  }

  /**
   * Check if import is local (not node_modules)
   */
  private isLocalImport(importPath: string): boolean {
    return importPath.startsWith(".") || importPath.startsWith("/");
  }

  /**
   * Resolve import path to absolute path
   */
  private resolveImportPath(fromFile: string, importPath: string): string {
    const fromDir = fromFile.split("/").slice(0, -1).join("/");
    let resolved = join(fromDir, importPath);

    // Add .ts extension if missing
    if (!resolved.endsWith(".ts") && !resolved.endsWith(".js")) {
      if (existsSync(resolved + ".ts")) {
        resolved += ".ts";
      } else if (existsSync(resolved + ".js")) {
        resolved += ".js";
      } else if (existsSync(resolved + "/index.ts")) {
        resolved += "/index.ts";
      } else if (existsSync(resolved + "/index.js")) {
        resolved += "/index.js";
      }
    }

    return resolved;
  }

  /**
   * Find cycles in dependency graph using DFS
   */
  private findCycles(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const dfs = (node: string, path: string[]): void => {
      if (recStack.has(node)) {
        // Found cycle
        const cycleStart = path.indexOf(node);
        cycles.push(path.slice(cycleStart));
        return;
      }

      if (visited.has(node)) {
        return;
      }

      visited.add(node);
      recStack.add(node);
      path.push(node);

      // Visit all dependencies
      const deps = this.dependencyGraph.filter((edge) => edge.from === node);
      for (const dep of deps) {
        dfs(dep.to, [...path]);
      }

      recStack.delete(node);
    };

    // Get all unique nodes
    const nodes = new Set<string>();
    for (const edge of this.dependencyGraph) {
      nodes.add(edge.from);
      nodes.add(edge.to);
    }

    // Run DFS from each node
    for (const node of nodes) {
      if (!visited.has(node)) {
        dfs(node, []);
      }
    }

    return cycles;
  }

  /**
   * Normalize file path
   */
  private normalizePath(filePath: string): string {
    return filePath.replace(/\\/g, "/");
  }

  /**
   * Get active locks (for debugging)
   */
  getActiveLocks(): FileLock[] {
    const now = Date.now();
    return Array.from(this.locks.values()).filter(
      (lock) => lock.expiresAt > now,
    );
  }

  /**
   * Clear expired locks
   */
  clearExpiredLocks(): number {
    const now = Date.now();
    let cleared = 0;

    for (const [path, lock] of this.locks.entries()) {
      if (lock.expiresAt < now) {
        this.locks.delete(path);
        cleared++;
      }
    }

    return cleared;
  }

  /**
   * Report security status
   */
  generateSecurityReport(): {
    activeLocks: number;
    circularDependencies: number;
    status: "safe" | "warning" | "critical";
  } {
    const activeLocks = this.getActiveLocks().length;
    const { cycles } = this.detectCircularDependencies();

    let status: "safe" | "warning" | "critical" = "safe";
    if (cycles.length > 0) {
      status = "critical";
    } else if (activeLocks > 10) {
      status = "warning";
    }

    return {
      activeLocks,
      circularDependencies: cycles.length,
      status,
    };
  }
}

// Export singleton instance
let instance: SecurityGuard | null = null;

export function getSecurityGuard(projectRoot?: string): SecurityGuard {
  if (!instance) {
    instance = new SecurityGuard(projectRoot);
  }
  return instance;
}

// CLI mode
if (import.meta.url === `file://${process.argv[1]}`) {
  const guard = new SecurityGuard();

  console.log("🛡️ Security Guard Report");
  console.log("═".repeat(60));

  // Check circular dependencies
  const { cycles, graph } = guard.detectCircularDependencies();

  if (cycles.length > 0) {
    console.log(`\n❌ Found ${cycles.length} circular dependencies:`);
    for (const cycle of cycles) {
      console.log(`\n  Cycle:`);
      for (const file of cycle) {
        console.log(`    → ${file}`);
      }
    }
    process.exit(1);
  } else {
    console.log("\n✅ No circular dependencies found");
    console.log(`   Analyzed ${graph.length} dependencies`);
  }

  // Check active locks
  const activeLocks = guard.getActiveLocks();
  if (activeLocks.length > 0) {
    console.log(`\n⚠️  ${activeLocks.length} active locks:`);
    for (const lock of activeLocks) {
      console.log(`   ${lock.path} (held by ${lock.holder})`);
    }
  }

  // Generate report
  const report = guard.generateSecurityReport();
  console.log("\n📊 Security Status:", report.status.toUpperCase());
  console.log("═".repeat(60));
}
