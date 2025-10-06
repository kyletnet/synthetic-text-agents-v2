#!/usr/bin/env tsx
/**
 * Explainer System - Natural language explanations for manual approval items
 *
 * Purpose:
 * - Provide context-aware explanations for why each issue needs fixing
 * - Help users/AI understand impact, urgency, and best approach
 * - Bridge the gap between technical diagnostics and actionable decisions
 *
 * Design Philosophy (from GPT feedback):
 * - "Users need to understand WHY, not just WHAT"
 * - "Explain impact in user-facing terms, not just technical terms"
 * - "Provide clear decision criteria for prioritization"
 */

import type { ManualApprovalItem } from "./inspection-schema.js";

export interface Explanation {
  /** Human-readable summary of the issue */
  summary: string;

  /** Why this matters (user impact, business impact, technical debt) */
  why: string;

  /** What happens if we don't fix it */
  consequences: string;

  /** Recommended action with priority level */
  recommendation: {
    action: string;
    priority: "immediate" | "this-week" | "this-month" | "backlog";
    estimatedEffort: string; // e.g., "5 minutes", "1 hour", "1 day"
  };

  /** Additional context for decision-making */
  decisionCriteria?: string[];
}

export class Explainer {
  /**
   * Generate comprehensive explanation for a manual approval item
   */
  static explain(item: ManualApprovalItem): Explanation {
    // Route to specific explainer based on item ID
    const explainerMap: Record<
      string,
      (item: ManualApprovalItem) => Explanation
    > = {
      "typescript-errors": this.explainTypeScriptErrors,
      "eslint-errors": this.explainESLintErrors,
      workarounds: this.explainWorkarounds,
      "component-documentation": this.explainDocumentation,
      "refactor-pending": this.explainRefactoring,
    };

    const explainer = explainerMap[item.id] || this.explainGeneric;
    return explainer(item);
  }

  /**
   * TypeScript Errors Explainer
   */
  private static explainTypeScriptErrors(
    item: ManualApprovalItem,
  ): Explanation {
    const count = item.count || 0;
    const fileList = item.files?.slice(0, 3).join(", ") || "unknown files";

    return {
      summary: `${count} TypeScript type error${
        count > 1 ? "s" : ""
      } blocking build`,

      why: `TypeScript errors prevent the project from compiling, which means:
• Developer workflow is completely blocked
• CI/CD pipeline will fail
• Production builds cannot be created
• Other developers cannot use this code

This is a BLOCKER for all downstream work.`,

      consequences: `If not fixed immediately:
❌ Build pipeline stays broken
❌ No one can run tests or deploy
❌ Technical debt compounds as workarounds accumulate
❌ Team velocity drops to zero`,

      recommendation: {
        action: `Fix all ${count} TypeScript errors in: ${fileList}`,
        priority: "immediate",
        estimatedEffort:
          count < 5 ? "15-30 minutes" : count < 20 ? "1-2 hours" : "4+ hours",
      },

      decisionCriteria: [
        "Is the build currently broken? → Fix NOW",
        "Are these new errors from recent changes? → Revert or fix immediately",
        "Are these legacy errors? → Create isolated fix branch",
      ],
    };
  }

  /**
   * ESLint Errors Explainer
   */
  private static explainESLintErrors(item: ManualApprovalItem): Explanation {
    const count = item.count || 0;
    const isError = item.description.toLowerCase().includes("error");

    return {
      summary: `${count} ESLint ${
        isError ? "errors" : "warnings"
      } need attention`,

      why: isError
        ? `ESLint ERRORS indicate violations of critical coding standards:
• Potential runtime bugs (unused vars, missing returns)
• Security issues (eval usage, XSS risks)
• Performance anti-patterns

These are flagged as errors because they're likely to cause production issues.`
        : `ESLint WARNINGS suggest code quality improvements:
• Readability issues
• Maintenance concerns
• Best practice violations

While not critical, fixing these prevents future technical debt.`,

      consequences: isError
        ? `If not fixed:
⚠️ Potential runtime failures in production
⚠️ Security vulnerabilities may exist
⚠️ Future developers will struggle with unclear code`
        : `If not fixed:
📉 Code quality gradually degrades
📉 Future refactoring becomes harder
📉 New team members face steeper learning curve`,

      recommendation: {
        action: isError
          ? `Fix ${count} ESLint errors immediately`
          : `Review and fix warnings incrementally (batch by file)`,
        priority: isError ? "immediate" : "this-week",
        estimatedEffort: `${Math.ceil(count / 10) * 30} minutes`,
      },

      decisionCriteria: [
        `Are there errors (not warnings)? → Priority: ${
          isError ? "HIGH" : "MEDIUM"
        }`,
        "Does this affect core business logic? → Fix first",
        "Is this in legacy code being phased out? → Defer or suppress",
      ],
    };
  }

  /**
   * Workarounds (TODO/FIXME) Explainer
   */
  private static explainWorkarounds(item: ManualApprovalItem): Explanation {
    const count = item.count || 0;

    return {
      summary: `${count} workarounds (TODO/FIXME) flagged as tech debt`,

      why: `TODO/FIXME comments are developer IOU notes indicating:
• Incomplete implementations
• Known bugs left for later
• Temporary hacks that need proper solutions

Each TODO represents:
→ A future bug waiting to happen
→ A maintenance burden for the next developer
→ Potential technical debt interest accumulating`,

      consequences: `If left unaddressed:
🔴 Critical FIXMEs may become production incidents
🟡 TODOs create confusion ("is this still needed?")
⚪ Code becomes harder to understand and maintain`,

      recommendation: {
        action: `Audit all ${count} workarounds: Fix critical ones, document/defer others`,
        priority: "this-week",
        estimatedEffort:
          count < 10 ? "1 hour" : count < 50 ? "half day" : "2 days",
      },

      decisionCriteria: [
        "Is this in a critical user-facing path? → Fix NOW",
        "Is this a known bug with user impact? → Escalate to P1",
        "Is this a 'nice to have' optimization? → Create issue, defer",
        "Is this unclear/outdated? → Delete the comment",
      ],
    };
  }

  /**
   * Documentation Explainer
   */
  private static explainDocumentation(item: ManualApprovalItem): Explanation {
    const count = item.count || 0;

    return {
      summary: `${count} components/functions lack documentation`,

      why: `Undocumented code creates friction:
• New developers take 3-5x longer to understand
• Bugs hide in "obviously wrong" code that wasn't obvious
• Refactoring becomes risky without knowing original intent

Documentation is NOT busywork—it's future-proofing.`,

      consequences: `Without docs:
📉 Onboarding time increases linearly with codebase growth
📉 Knowledge lives only in original author's head
📉 Critical components become "scary to touch"`,

      recommendation: {
        action: `Document ${count} items incrementally (focus on public APIs first)`,
        priority: "this-month",
        estimatedEffort: `${count * 5} minutes (5 min/item)`,
      },

      decisionCriteria: [
        "Is this a public API used by other teams? → Document NOW",
        "Is this complex business logic? → Prioritize",
        "Is this internal implementation detail? → Defer",
        "Can we generate docs from types/tests? → Automate",
      ],
    };
  }

  /**
   * Refactoring Explainer
   */
  private static explainRefactoring(item: ManualApprovalItem): Explanation {
    const filesAffected = item.files?.length || 0;

    return {
      summary: `${filesAffected} files exceed complexity/size thresholds`,

      why: `Large, complex files are breeding grounds for bugs:
• Cognitive overload → more mistakes
• Testing becomes harder → lower coverage
• Changes have unpredictable side effects

Industry research shows files >500 lines have 2-3x higher bug rates.`,

      consequences: `Without refactoring:
⚠️ Bug density increases exponentially
⚠️ Development velocity slows (fear of breaking things)
⚠️ Team morale drops (nobody wants to touch "that file")`,

      recommendation: {
        action: `Refactor ${filesAffected} files into smaller, focused modules`,
        priority: filesAffected > 5 ? "this-week" : "this-month",
        estimatedEffort:
          filesAffected < 3
            ? "1 day"
            : filesAffected < 10
            ? "1 week"
            : "2 weeks",
      },

      decisionCriteria: [
        "Is this file causing frequent bugs? → Refactor NOW",
        "Do multiple developers touch this file? → High priority",
        "Is this stable legacy code? → Lower priority",
        "Can we refactor incrementally (no big bang)? → Start this sprint",
      ],
    };
  }

  /**
   * Generic Explainer (fallback)
   */
  private static explainGeneric(item: ManualApprovalItem): Explanation {
    return {
      summary: item.description,

      why: `This issue requires manual review because:
${item.impact}

Automated tools cannot make this decision safely.`,

      consequences: `Impact: ${item.impact}`,

      recommendation: {
        action: item.suggestedAction,
        priority: item.severity === "critical" ? "immediate" : "this-week",
        estimatedEffort: "Unknown - requires assessment",
      },

      decisionCriteria: [
        `Severity: ${item.severity}`,
        "Review impact and decide priority with team",
      ],
    };
  }

  /**
   * Format explanation for console output
   */
  static format(explanation: Explanation): string {
    const { summary, why, consequences, recommendation, decisionCriteria } =
      explanation;

    const priorityIcons = {
      immediate: "🔴 IMMEDIATE",
      "this-week": "🟡 THIS WEEK",
      "this-month": "🟢 THIS MONTH",
      backlog: "⚪ BACKLOG",
    };

    let output = `
📖 EXPLANATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📌 ${summary}

❓ WHY THIS MATTERS:
${why}

⚠️  CONSEQUENCES IF NOT FIXED:
${consequences}

✅ RECOMMENDATION:
   Action: ${recommendation.action}
   Priority: ${priorityIcons[recommendation.priority]}
   Estimated Effort: ${recommendation.estimatedEffort}
`;

    if (decisionCriteria && decisionCriteria.length > 0) {
      output += `\n🎯 DECISION CRITERIA:\n`;
      decisionCriteria.forEach((criterion) => {
        output += `   • ${criterion}\n`;
      });
    }

    output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

    return output;
  }
}
