#!/usr/bin/env tsx
/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Cache Checker - Verify inspection cache freshness
 *
 * Purpose:
 * - Check if inspection-results.json exists and is fresh
 * - Exit 0 if cache is valid (< 30 min old)
 * - Exit 1 if cache is stale or missing
 *
 * Usage:
 *   npm run status:check-cache
 *   (Used by /ship to avoid redundant /inspect runs)
 */

import { InspectionCache } from "./lib/inspection-cache.js";

const cache = new InspectionCache(process.cwd());
const validation = cache.validateCache();

if (validation.valid) {
  const age = cache.getCacheAge();
  console.log(`✅ Cache is fresh (${age})`);
  process.exit(0);
} else {
  console.log(`❌ Cache is stale or missing`);
  process.exit(1);
}
