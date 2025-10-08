# Backup System Migration Guide

## Overview

The backup system has been refactored from a monolithic 1004-line class into a clean architecture using the Strategy pattern. This guide explains the new architecture and how to migrate existing code.

## Architecture Changes

### Old Structure

```
src/shared/backupSystem.ts (1004 lines)
  - BackupSystem class (all-in-one)
```

### New Structure

```
src/
  domain/backup/                    # Domain Layer
    - backup-types.ts               # Core type definitions
    - backup-strategy.ts            # Strategy interface
    - backup-strategies/
      - base-backup-strategy.ts     # Base strategy class
      - file-backup.ts              # File backup strategy
      - directory-backup.ts         # Directory backup strategy
      - incremental-backup.ts       # Incremental backup strategy
    - index.ts                      # Domain exports

  application/backup/               # Application Layer
    - backup-manager.ts             # Backup orchestration
    - restore-manager.ts            # Restore orchestration
    - index.ts                      # Application exports

  infrastructure/backup/            # Infrastructure Layer
    - file-operations.ts            # File system operations
    - index.ts                      # Infrastructure exports

tests/unit/backup/                  # Tests
  - backup-strategies.test.ts       # Strategy tests
  - backup-manager.test.ts          # Manager tests
```

## Key Design Patterns

### 1. Strategy Pattern

Different backup types (file, directory, incremental) are now separate strategy classes implementing a common interface.

```typescript
interface BackupStrategy {
  getName(): string;
  backup(...): Promise<BackupResult>;
  restore(...): Promise<RestoreResult>;
  validate(...): Promise<boolean>;
  collectFiles(...): Promise<string[]>;
}
```

### 2. Separation of Concerns

**Domain Layer**: Business logic and strategies

- Defines what backup strategies exist
- Implements backup/restore algorithms
- No knowledge of infrastructure details

**Application Layer**: Orchestration and coordination

- Manages multiple backup jobs
- Coordinates strategy selection
- Handles events and status

**Infrastructure Layer**: Technical implementation

- File system operations
- Compression/decompression
- Checksum calculation

## Migration Steps

### Step 1: Update Imports

**Before:**

```typescript
import { BackupSystem, BackupConfig } from "../shared/backupSystem";
```

**After:**

```typescript
import { BackupManager, RestoreManager } from "../application/backup";
import type { BackupConfig, BackupJobConfig } from "../application/backup";
```

### Step 2: Update Configuration

**Before:**

```typescript
const config: BackupConfig = {
  enabled: true,
  strategies: [
    {
      name: "daily-backup",
      type: "full",
      source: { type: "filesystem", paths: ["/data"] },
      destination: { type: "local", location: "/backups" },
      enabled: true,
      priority: 1,
      maxRetryAttempts: 3,
    },
  ],
  retention: { daily: 7, weekly: 4, monthly: 12, yearly: 1 },
  compression: { enabled: true, algorithm: "gzip", level: 6 },
  encryption: { enabled: false, algorithm: "aes-256-gcm", keyId: "" },
  verification: {
    enabled: true,
    checksumAlgorithm: "sha256",
    testRestore: false,
  },
  scheduling: {
    full: "0 0 * * *",
    incremental: "0 */6 * * *",
    differential: "0 12 * * *",
  },
};

const backupSystem = new BackupSystem(config);
```

**After:**

```typescript
// Global config
const config: BackupConfig = {
  enabled: true,
  compression: { enabled: true, algorithm: "gzip", level: 6 },
  encryption: { enabled: false, algorithm: "aes-256-gcm", keyId: "" },
  verification: {
    enabled: true,
    checksumAlgorithm: "sha256",
    testRestore: false,
  },
};

const backupManager = new BackupManager(config);

// Job-specific config
const jobConfig: BackupJobConfig = {
  name: "daily-backup",
  type: "directory", // 'file' | 'directory' | 'incremental'
  sources: ["/data"],
  destination: "/backups",
  enabled: true,
  filters: {
    include: ["*.json", "*.txt"],
    exclude: ["**/node_modules/**", "**/.git/**"],
  },
};
```

### Step 3: Update Backup Creation

**Before:**

```typescript
const backupId = await backupSystem.createBackup("daily-backup", false);
```

**After:**

```typescript
const result = await backupManager.createBackup(jobConfig);
const backupId = result.backupId;

// Access detailed results
console.log(`Backup completed: ${result.metadata.files.length} files`);
console.log(`Duration: ${result.duration}ms`);
```

### Step 4: Update Restore Operations

**Before:**

```typescript
const result = await backupSystem.restore({
  backupId: "backup_123",
  targetPath: "/restore",
  overwrite: true,
  preservePermissions: true,
  dryRun: false,
});
```

**After:**

```typescript
const restoreManager = new RestoreManager(config);
const backup = backupManager.getBackup(backupId);

const result = await restoreManager.restore(backup, {
  backupId: backup.id,
  targetPath: "/restore",
  overwrite: true,
  preservePermissions: true,
  dryRun: false,
});
```

### Step 5: Update Status Checks

**Before:**

```typescript
const status = backupSystem.getSystemStatus();
```

**After:**

```typescript
const status = backupManager.getStatus();
```

### Step 6: Update Event Listeners

**Before:**

```typescript
backupSystem.on("backup:completed", (data) => {
  console.log("Backup completed:", data.backupId);
});
```

**After:**

```typescript
backupManager.on("backup:completed", (data) => {
  console.log("Backup completed:", data.backupId);
});

restoreManager.on("restore:completed", (data) => {
  console.log("Restore completed:", data.backupId);
});
```

## New Features

### 1. Strategy-Based Backup Types

```typescript
// File backup (non-recursive)
const fileJob: BackupJobConfig = {
  name: "config-files",
  type: "file",
  sources: ["/etc/config"],
  destination: "/backups",
  enabled: true,
};

// Directory backup (recursive)
const dirJob: BackupJobConfig = {
  name: "data-backup",
  type: "directory",
  sources: ["/data"],
  destination: "/backups",
  enabled: true,
};

// Incremental backup
const incJob: BackupJobConfig = {
  name: "incremental-backup",
  type: "incremental",
  sources: ["/data"],
  destination: "/backups",
  enabled: true,
};
```

### 2. Advanced Filtering

```typescript
const jobConfig: BackupJobConfig = {
  name: "filtered-backup",
  type: "directory",
  sources: ["/project"],
  destination: "/backups",
  enabled: true,
  filters: {
    include: ["*.ts", "*.js", "*.json"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.git/**",
      "**/coverage/**",
    ],
  },
};
```

### 3. Validation

```typescript
const restoreManager = new RestoreManager(config);
const backup = backupManager.getBackup(backupId);

const isValid = await restoreManager.validateBackup(backup);
if (isValid) {
  console.log("Backup is valid");
} else {
  console.log("Backup validation failed");
}
```

## Backward Compatibility

The old `BackupSystem` class in `src/shared/backupSystem.ts` remains functional but is now considered **legacy**. It should be replaced with the new architecture in all new code.

### Temporary Coexistence

Both systems can coexist during migration:

```typescript
// Legacy code (still works)
import { BackupSystem } from "../shared/backupSystem";

// New code (recommended)
import { BackupManager } from "../application/backup";
```

## Benefits of New Architecture

1. **Modularity**: Each backup type is a separate, testable class
2. **Extensibility**: Add new backup strategies without modifying existing code
3. **Testability**: Unit tests are simpler and more focused
4. **Maintainability**: Clear separation of concerns
5. **Type Safety**: Better TypeScript types and interfaces
6. **Performance**: Strategies can be optimized independently

## Testing

### Running Tests

```bash
# Run all backup tests
npm test -- backup

# Run specific test file
npm test -- tests/unit/backup/backup-strategies.test.ts
npm test -- tests/unit/backup/backup-manager.test.ts
```

### Writing New Tests

```typescript
import { describe, it, expect } from "vitest";
import { FileBackupStrategy } from "../../../src/domain/backup";

describe("Custom Backup Test", () => {
  it("should perform backup", async () => {
    const strategy = new FileBackupStrategy();
    const result = await strategy.backup(["/test"], "/backup", config);

    expect(result.success).toBe(true);
  });
});
```

## Common Migration Issues

### Issue 1: Strategy Type Mismatch

**Problem**: Old code uses `'full' | 'incremental' | 'differential'` as strategy types.

**Solution**: Map to new strategy types:

- `'full'` → `'file'` or `'directory'` (depending on recursive needs)
- `'incremental'` → `'incremental'`
- `'differential'` → `'incremental'` (both use same strategy)

### Issue 2: Missing Parent Backup

**Problem**: Incremental backup can't find parent backup.

**Solution**: Ensure parent backup metadata is stored:

```typescript
const strategy = new IncrementalBackupStrategy();
const parentBackup = backupManager.getBackup(parentBackupId);
if (parentBackup) {
  strategy.setParentBackup(parentBackupId, parentBackup);
}
```

### Issue 3: Configuration Differences

**Problem**: Old config structure doesn't match new structure.

**Solution**: Split configuration into global config and job-specific config as shown in Step 2.

## Rollback Plan

If you need to rollback to the old system:

1. Keep the old `backupSystem.ts` file
2. Revert imports to use `BackupSystem`
3. Use old configuration structure
4. The old system remains fully functional

## Support

For questions or issues during migration:

1. Check the test files for examples
2. Review the TypeScript types for available options
3. Consult the inline documentation in source files

## Next Steps

1. ✅ Review this migration guide
2. ✅ Update imports in one file at a time
3. ✅ Test each migration step
4. ✅ Run full test suite
5. ✅ Monitor for any issues
6. ✅ Once stable, deprecate old `BackupSystem`

## Summary

The new backup system provides a clean, maintainable architecture while preserving all existing functionality. Migration is straightforward and can be done incrementally without disrupting existing systems.
