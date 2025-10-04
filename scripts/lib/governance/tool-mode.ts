/**
 * Tool Mode Type System
 *
 * Purpose: Structural classification of tools by their operational impact
 *
 * Design Philosophy:
 * - 'analyze': Read-only operations (reports, scans, validation)
 * - 'transform': Write operations (fixes, refactors, builds)
 *
 * Governance Integration:
 * - Governance applies to 'transform' tools only
 * - 'analyze' tools are exempt by design, not by exception list
 */

export type ToolMode = "analyze" | "transform";

/**
 * Tool metadata for governance enforcement
 */
export interface ToolMetadata {
  /** Tool identifier (filename without extension) */
  name: string;

  /** Operational mode */
  mode: ToolMode;

  /** Description of tool's purpose */
  description: string;

  /** Whether tool requires governance */
  requiresGovernance: boolean;
}

/**
 * Tool mode configuration comment marker
 *
 * Usage: Add this comment to the top of any *-engine.ts file:
 *
 * // @tool-mode: analyze
 * // @tool-description: System health analysis
 *
 * OR
 *
 * // @tool-mode: transform
 * // @tool-description: Code formatting and fixes
 */
export const TOOL_MODE_MARKER = "@tool-mode:";
export const TOOL_DESCRIPTION_MARKER = "@tool-description:";

/**
 * Extract tool metadata from file content
 */
export function extractToolMetadata(
  filename: string,
  content: string,
): ToolMetadata | null {
  const modeMatch = content.match(
    new RegExp(`${TOOL_MODE_MARKER}\\s*(analyze|transform)`, "i"),
  );
  const descMatch = content.match(
    new RegExp(`${TOOL_DESCRIPTION_MARKER}\\s*(.+)`, "i"),
  );

  if (!modeMatch) {
    return null; // No mode declaration
  }

  const mode = modeMatch[1].toLowerCase() as ToolMode;
  const description = descMatch?.[1]?.trim() || "No description";

  return {
    name: filename.replace(/\.ts$/, ""),
    mode,
    description,
    requiresGovernance: mode === "transform",
  };
}

/**
 * Validate tool mode declaration
 */
export function validateToolMode(metadata: ToolMetadata | null): {
  valid: boolean;
  reason?: string;
} {
  if (!metadata) {
    return {
      valid: false,
      reason: "Missing @tool-mode declaration",
    };
  }

  if (!["analyze", "transform"].includes(metadata.mode)) {
    return {
      valid: false,
      reason: `Invalid mode: ${metadata.mode} (must be 'analyze' or 'transform')`,
    };
  }

  return { valid: true };
}

/**
 * Check if tool requires governance based on mode
 */
export function requiresGovernance(mode: ToolMode): boolean {
  return mode === "transform";
}
