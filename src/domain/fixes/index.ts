/**
 * Fix Commands - Domain Layer
 *
 * Exports all fix command implementations and interfaces
 */

// Base interfaces and types
export type {
  Issue,
  FixResult,
  FileChange,
  ProgressUpdate,
  FixCommand,
  FixCommandOptions,
  ValidationResult,
} from "./fix-command.js";

export { BaseFixCommand } from "./fix-command.js";

// Command implementations
export { TypeScriptFixCommand } from "./typescript-fix.js";
export { ESLintFixCommand } from "./eslint-fix.js";
export { ImportFixCommand } from "./import-fix.js";
export { WorkaroundFixCommand } from "./workaround-fix.js";
export { DocumentationFixCommand } from "./documentation-fix.js";
