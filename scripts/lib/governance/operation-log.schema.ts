/**
 * Operation Log Schema - Audit Trail for All Governance Operations
 *
 * Purpose:
 * - Complete audit trail of all governance operations
 * - Forensic analysis capability
 * - Compliance and debugging
 *
 * Design:
 * - JSONL format for streaming and efficient appending
 * - Structured logging with consistent schema
 * - Snapshot references for state correlation
 * - Performance metrics tracking
 */

export interface OperationLog {
  /** Unique operation identifier (UUID) */
  id: string;

  /** ISO 8601 timestamp */
  timestamp: string;

  /** Operation name (e.g., "inspect", "maintain", "fix") */
  operation: string;

  /** Operation phase */
  phase: "preflight" | "execution" | "verification" | "cleanup";

  /** Operation status */
  status: "started" | "success" | "failure" | "warning" | "skipped";

  /** Duration in milliseconds (null if not completed) */
  duration: number | null;

  /** Operation details (flexible structure) */
  details: OperationDetails;

  /** Snapshot references */
  snapshots?: {
    before?: string; // Snapshot ID
    after?: string; // Snapshot ID
  };

  /** Error information (if failed) */
  error?: {
    message: string;
    stack?: string;
    code?: string;
    type?: string;
  };

  /** Performance metrics */
  metrics?: PerformanceMetrics;

  /** User context */
  user?: {
    id?: string;
    name?: string;
    role?: string;
  };

  /** Environment context */
  environment: {
    node: string;
    npm?: string;
    platform: string;
    cwd: string;
    gitBranch: string;
    gitCommit: string;
  };

  /** Tags for categorization and filtering */
  tags?: string[];
}

export interface OperationDetails {
  /** Operation-specific data */
  [key: string]: unknown;

  /** Common fields */
  command?: string;
  args?: string[];
  exitCode?: number;
  stdout?: string;
  stderr?: string;

  /** Governance-specific */
  rulesEnforced?: string[];
  rulesPassed?: string[];
  rulesFailed?: string[];
  bypassAttempts?: number;

  /** Self-validation */
  validationAttempts?: number;
  validationPassed?: boolean;
  autoFixesApplied?: string[];

  /** Loop detection */
  loopDetected?: boolean;
  loopIterations?: number;
  loopRatePerSecond?: number;

  /** Timeout */
  timeoutOccurred?: boolean;
  timeoutType?: string;
  timeoutDuration?: number;
}

export interface PerformanceMetrics {
  /** CPU time in milliseconds */
  cpuTime?: number;

  /** Memory usage in bytes */
  memoryUsage?: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };

  /** File I/O operations */
  fileOperations?: {
    reads: number;
    writes: number;
    totalBytes: number;
  };

  /** Network operations */
  networkOperations?: {
    requests: number;
    bytesReceived: number;
    bytesSent: number;
  };

  /** Custom metrics */
  custom?: Record<string, number>;
}

/**
 * Log query result
 */
export interface LogQueryResult {
  logs: OperationLog[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Log query filters
 */
export interface LogQueryFilters {
  /** Filter by operation name */
  operation?: string | string[];

  /** Filter by status */
  status?: OperationLog["status"] | OperationLog["status"][];

  /** Filter by phase */
  phase?: OperationLog["phase"] | OperationLog["phase"][];

  /** Filter by date range */
  dateRange?: {
    from: string;
    to: string;
  };

  /** Filter by tags */
  tags?: string[];

  /** Filter by error presence */
  hasError?: boolean;

  /** Filter by snapshot presence */
  hasSnapshot?: boolean;

  /** Pagination */
  page?: number;
  pageSize?: number;

  /** Sorting */
  sortBy?: "timestamp" | "duration" | "operation";
  sortOrder?: "asc" | "desc";
}

/**
 * Log aggregation result
 */
export interface LogAggregation {
  /** Aggregation by operation */
  byOperation: Record<string, {
    count: number;
    successRate: number;
    avgDuration: number;
    failureReasons: Record<string, number>;
  }>;

  /** Aggregation by status */
  byStatus: Record<string, number>;

  /** Aggregation by phase */
  byPhase: Record<string, number>;

  /** Time series (hourly buckets) */
  timeSeries: Array<{
    timestamp: string;
    count: number;
    successCount: number;
    failureCount: number;
  }>;

  /** Top errors */
  topErrors: Array<{
    message: string;
    count: number;
    lastOccurrence: string;
  }>;
}

/**
 * Log rotation policy
 */
export interface LogRotationPolicy {
  /** Max size in MB before rotation */
  maxSizeMB: number;

  /** Max number of files to keep */
  maxFiles: number;

  /** Compression enabled */
  compress?: boolean;

  /** Archive path */
  archivePath?: string;
}
