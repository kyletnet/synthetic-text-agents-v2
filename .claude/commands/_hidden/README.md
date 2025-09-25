# Hidden Slash Commands

These commands have been moved to the hidden directory to simplify the interface for non-developers.

## Commands Moved Here

- `commit.md` - Manual commit command (replaced by automated /sync)
- `dev.md` - Developer-specific command
- `doc-audit.md` - Advanced documentation auditing
- `doc-gate.md` - CI/CD documentation gating
- `llm-signals.md` - LLM optimization signal management
- `refactor-confirm.md` - Refactoring confirmation (integrated into /refactor-audit)
- `refactor-next.md` - Next action recommendations (integrated into /refactor-audit)
- `refactor-summary.md` - Refactoring summary (integrated into /refactor-audit)
- `ship.md` - Deployment pipeline (advanced feature)
- `sync` - Legacy sync file

## Core Commands (Visible)

Only these 4 commands remain visible for non-developers:

1. **`/fix`** - AI-powered automatic TypeScript error fixing
2. **`/status`** - Smart system health dashboard with AI insights
3. **`/sync`** - Complete system sync, commit, and push
4. **`/refactor-audit`** - Smart refactoring analysis and recommendations

## Accessing Hidden Commands

Developers can still access hidden commands by:

1. **Direct execution**: Run the underlying npm scripts directly
2. **Manual access**: Access files in this `_hidden` directory
3. **Restore visibility**: Move commands back to parent directory if needed

## Philosophy

This reduction from 13+ commands to 4 core commands follows the user's requirement for "3-4 core commands for non-developers" while maintaining all functionality through automation and integration.

All hidden command functionality is either:
- Automated (runs automatically in background)
- Integrated (merged into core commands)
- Available via npm scripts for developers

This creates a clean, user-friendly interface without losing any capabilities.