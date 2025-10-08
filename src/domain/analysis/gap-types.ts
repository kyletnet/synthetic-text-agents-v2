/**
 * Domain Types for Gap Analysis
 *
 * Core type definitions for the gap detection system.
 * These types are framework-agnostic and represent pure business logic.
 */

// ============================================================================
// Core Types
// ============================================================================

export type GapSeverity = "P0" | "P1" | "P2";
export type GapCategory = "docs" | "governance" | "security" | "testing";
export type ScanMode = "disabled" | "shadow" | "enforce";

// ============================================================================
// Configuration Types
// ============================================================================

export interface GapCheckConfig {
  readonly id: string;
  readonly name: string;
  readonly enabled: boolean;
  readonly severity: GapSeverity;
  readonly category: GapCategory;
  readonly config?: Record<string, unknown>;
  readonly autoFixable: boolean;
  readonly autoFix?: {
    strategy: string;
    requiresApproval?: boolean;
  };
}

export interface GapScanSettings {
  readonly mode: ScanMode;
  readonly failOn: readonly GapSeverity[];
  readonly autoFix: {
    enabled: boolean;
    maxSeverity: GapSeverity;
  };
  readonly timeout: number;
  readonly reportPath: string;
}

export interface TeamConfig {
  readonly members?: readonly string[];
  readonly mode: ScanMode;
  readonly failOn: readonly GapSeverity[];
}

export interface GapConfiguration {
  readonly version: string;
  readonly globalSettings: GapScanSettings;
  readonly checks: readonly GapCheckConfig[];
  readonly teams: Record<string, TeamConfig>;
  readonly metrics: {
    enabled: boolean;
    collectInterval: string;
  };
}

// ============================================================================
// Gap Detection Types
// ============================================================================

export interface GapDetectionContext {
  readonly checkId: string;
  readonly severity: GapSeverity;
  readonly category: GapCategory;
  readonly config?: Record<string, unknown>;
  readonly autoFixable: boolean;
}

export interface GapFix {
  readonly strategy: string;
  readonly requiresApproval: boolean;
  execute: () => Promise<void>;
}

export interface Gap {
  readonly id: string;
  readonly checkId: string;
  readonly severity: GapSeverity;
  readonly category: GapCategory;
  readonly title: string;
  readonly description: string;
  readonly autoFixable: boolean;
  readonly details?: Record<string, unknown>;
  readonly fix?: GapFix;
}

// ============================================================================
// Scan Result Types
// ============================================================================

export interface GapSummary {
  readonly P0: number;
  readonly P1: number;
  readonly P2: number;
  readonly total: number;
}

export interface GapScanReport {
  readonly timestamp: Date;
  readonly mode: ScanMode;
  readonly totalChecks: number;
  readonly enabledChecks: number;
  readonly gaps: readonly Gap[];
  readonly summary: GapSummary;
  readonly executionTime: number;
}

// ============================================================================
// Check Detector Interface
// ============================================================================

export interface GapCheckDetector {
  readonly checkId: string;
  detect(context: GapDetectionContext): Promise<readonly Gap[]>;
}

// ============================================================================
// Configuration Override Types
// ============================================================================

export interface ConfigurationOverride {
  readonly user: string;
  readonly originalMode: ScanMode;
  readonly overrideMode: ScanMode;
  readonly timestamp: Date;
  readonly ci: boolean;
}
