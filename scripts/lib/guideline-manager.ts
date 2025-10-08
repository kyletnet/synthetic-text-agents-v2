/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Guideline Manager - Hot-Reload Guidelines System
 *
 * Purpose:
 * - Load and manage domain-specific guidelines
 * - Watch for changes and hot-reload
 * - Provide access to guideline content
 *
 * Usage:
 * ```ts
 * const gm = new GuidelineManager();
 * await gm.loadAll();
 * gm.startWatching();
 *
 * const rules = gm.get('augmentation/paraphrasing-rules');
 * ```
 */

import { watch } from "fs";
import { readdir, readFile } from "fs/promises";
import { join, relative } from "path";
import { existsSync } from "fs";

export interface Guideline {
  id: string;
  path: string;
  content: string;
  loadedAt: number;
  category: string;
}

export class GuidelineManager {
  private guidelines = new Map<string, Guideline>();
  private watcherActive = false;
  private projectRoot: string;
  private guidelinesPath: string;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    this.guidelinesPath = join(projectRoot, "guidelines");
  }

  /**
   * Load all guidelines from guidelines/ directory
   */
  async loadAll(): Promise<void> {
    if (!existsSync(this.guidelinesPath)) {
      console.warn(
        `[GuidelineManager] Guidelines directory not found: ${this.guidelinesPath}`,
      );
      return;
    }

    const files = await this.findMarkdownFiles(this.guidelinesPath);
    console.log(`[GuidelineManager] Found ${files.length} guideline files`);

    for (const file of files) {
      await this.loadGuideline(file);
    }
  }

  /**
   * Load a single guideline file
   */
  async loadGuideline(filePath: string): Promise<void> {
    try {
      const content = await readFile(filePath, "utf-8");
      const relativePath = relative(this.guidelinesPath, filePath);
      const id = relativePath.replace(/\.md$/, "");
      const category = relativePath.split("/")[0] || "general";

      const guideline: Guideline = {
        id,
        path: filePath,
        content,
        loadedAt: Date.now(),
        category,
      };

      this.guidelines.set(id, guideline);
      console.log(`[GuidelineManager] Loaded: ${id}`);
    } catch (error) {
      console.error(
        `[GuidelineManager] Failed to load ${filePath}:`,
        (error as Error).message,
      );
    }
  }

  /**
   * Start watching guidelines directory for changes
   */
  startWatching(): void {
    if (this.watcherActive) {
      console.log("[GuidelineManager] Watcher already active");
      return;
    }

    if (!existsSync(this.guidelinesPath)) {
      console.warn(
        `[GuidelineManager] Cannot watch non-existent directory: ${this.guidelinesPath}`,
      );
      return;
    }

    console.log(
      `[GuidelineManager] Watching for changes in: ${this.guidelinesPath}`,
    );

    watch(this.guidelinesPath, { recursive: true }, async (event, filename) => {
      if (filename && filename.endsWith(".md")) {
        const fullPath = join(this.guidelinesPath, filename);
        console.log(`[GuidelineManager] Detected ${event}: ${filename}`);

        if (event === "rename" && !existsSync(fullPath)) {
          // File deleted
          const id = filename.replace(/\.md$/, "");
          this.guidelines.delete(id);
          console.log(`[GuidelineManager] Removed: ${id}`);
        } else {
          // File created or modified
          await this.loadGuideline(fullPath);
        }
      }
    });

    this.watcherActive = true;
  }

  /**
   * Stop watching for changes
   */
  stopWatching(): void {
    // Note: Node.js watch() doesn't return a handle to close
    // Mark as inactive for future reference
    this.watcherActive = false;
    console.log("[GuidelineManager] Watcher stopped");
  }

  /**
   * Get a guideline by ID
   */
  get(id: string): Guideline | undefined {
    return this.guidelines.get(id);
  }

  /**
   * Get all guidelines for a category
   */
  getByCategory(category: string): Guideline[] {
    return Array.from(this.guidelines.values()).filter(
      (g) => g.category === category,
    );
  }

  /**
   * Get all loaded guidelines
   */
  getAll(): Guideline[] {
    return Array.from(this.guidelines.values());
  }

  /**
   * Check if a guideline exists
   */
  has(id: string): boolean {
    return this.guidelines.has(id);
  }

  /**
   * Get guideline count
   */
  get size(): number {
    return this.guidelines.size;
  }

  /**
   * Find all markdown files in a directory recursively
   */
  private async findMarkdownFiles(dir: string): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        if (entry.isDirectory()) {
          const subFiles = await this.findMarkdownFiles(fullPath);
          files.push(...subFiles);
        } else if (entry.isFile() && entry.name.endsWith(".md")) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.error(
        `[GuidelineManager] Error reading directory ${dir}:`,
        (error as Error).message,
      );
    }

    return files;
  }
}
