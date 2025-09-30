#!/usr/bin/env tsx

/**
 * Performance Cache System
 * 전역 결과 캐싱으로 중복 분석 방지
 */

import {
  existsSync,
  readFileSync,
  writeFileSync,
  statSync,
  mkdirSync,
  unlinkSync,
  readdirSync,
} from "fs";
import { join } from "path";

interface CacheEntry<T> {
  data: T;
  timestamp: string;
  ttl: number; // milliseconds
  fileHash?: string;
}

interface CacheConfig {
  ttl: number;
  checkFileChanges?: boolean;
  filePaths?: string[];
}

class PerformanceCache {
  private cacheDir: string;
  private defaultTtl: number = 5 * 60 * 1000; // 5분

  constructor() {
    this.cacheDir = join(process.cwd(), "reports", ".cache");
    this.ensureCacheDir();
  }

  private ensureCacheDir(): void {
    if (!existsSync(this.cacheDir)) {
      mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  private getCachePath(key: string): string {
    return join(this.cacheDir, `${key}.json`);
  }

  private generateFileHash(filePaths: string[]): string {
    let combined = "";
    for (const filePath of filePaths) {
      try {
        const stats = statSync(filePath);
        combined += `${filePath}:${stats.mtime.getTime()}`;
      } catch (e) {
        combined += `${filePath}:missing`;
      }
    }
    return Buffer.from(combined).toString("base64").substring(0, 32);
  }

  async get<T>(key: string, config?: CacheConfig): Promise<T | null> {
    const cachePath = this.getCachePath(key);

    if (!existsSync(cachePath)) {
      return null;
    }

    try {
      const entry: CacheEntry<T> = JSON.parse(readFileSync(cachePath, "utf8"));
      const now = Date.now();
      const age = now - new Date(entry.timestamp).getTime();
      const ttl = config?.ttl || entry.ttl || this.defaultTtl;

      // TTL 만료 확인
      if (age > ttl) {
        return null;
      }

      // 파일 변경 확인
      if (config?.checkFileChanges && config?.filePaths && entry.fileHash) {
        const currentHash = this.generateFileHash(config.filePaths);
        if (currentHash !== entry.fileHash) {
          return null;
        }
      }

      console.log(`   💾 Cache hit: ${key} (age: ${Math.round(age / 1000)}s)`);
      return entry.data;
    } catch (e) {
      return null;
    }
  }

  async set<T>(key: string, data: T, config?: CacheConfig): Promise<void> {
    const cachePath = this.getCachePath(key);

    const entry: CacheEntry<T> = {
      data,
      timestamp: new Date().toISOString(),
      ttl: config?.ttl || this.defaultTtl,
    };

    if (config?.checkFileChanges && config?.filePaths) {
      entry.fileHash = this.generateFileHash(config.filePaths);
    }

    writeFileSync(cachePath, JSON.stringify(entry, null, 2));
    console.log(`   💾 Cache stored: ${key}`);
  }

  async invalidate(key: string): Promise<void> {
    const cachePath = this.getCachePath(key);
    if (existsSync(cachePath)) {
      unlinkSync(cachePath);
      console.log(`   🗑️ Cache invalidated: ${key}`);
    }
  }

  async clear(): Promise<void> {
    if (existsSync(this.cacheDir)) {
      const files = readdirSync(this.cacheDir);
      for (const file of files) {
        if (file.endsWith(".json")) {
          unlinkSync(join(this.cacheDir, file));
        }
      }
      console.log(`   🗑️ Cache cleared: ${files.length} entries`);
    }
  }

  // 유틸리티 메소드들
  async getCachedOrCompute<T>(
    key: string,
    computeFn: () => Promise<T>,
    config?: CacheConfig,
  ): Promise<T> {
    const cached = await this.get<T>(key, config);
    if (cached !== null) {
      return cached;
    }

    console.log(`   🔄 Computing: ${key}`);
    const result = await computeFn();
    await this.set(key, result, config);
    return result;
  }
}

// 싱글톤 인스턴스
export const perfCache = new PerformanceCache();

export default PerformanceCache;
