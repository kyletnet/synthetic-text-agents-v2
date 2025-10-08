/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Feedback Adapter - Human-in-the-Loop Integration
 *
 * Purpose:
 * - Convert natural language feedback to policy events
 * - Bridge WebView/CLI user input to Governance Kernel
 * - Implement cooldown to prevent overshooting
 *
 * Phase 2C: Human feedback integration for adaptive learning
 */

import type { Logger } from "../shared/logger.js";

/**
 * User feedback source
 */
export type FeedbackSource = "webview" | "cli" | "api" | "slack" | "email";

/**
 * Feedback intent (auto-detected from natural language)
 */
export type FeedbackIntent =
  | "quality_issue" // "Quality is degrading"
  | "drift_alert" // "Entity coverage dropped"
  | "policy_request" // "Add a rule for..."
  | "threshold_adjust" // "Increase threshold to..."
  | "plugin_toggle" // "Enable/disable plugin"
  | "performance_issue" // "System is slow"
  | "unknown"; // Cannot determine intent

/**
 * User feedback input
 */
export interface UserFeedback {
  id: string;
  source: FeedbackSource;
  rawText: string; // Natural language input
  timestamp: Date;
  userId?: string; // Optional user ID
  sessionId?: string; // Optional session ID
}

/**
 * Parsed feedback with intent
 */
export interface ParsedFeedback {
  id: string;
  intent: FeedbackIntent;
  confidence: number; // 0-1 (intent detection confidence)
  extractedData: Record<string, unknown>; // Intent-specific data
  originalFeedback: UserFeedback;
}

/**
 * Policy event (generated from feedback)
 */
export interface PolicyEvent {
  type: string;
  timestamp: string;
  source: "user_feedback";
  feedbackId: string;
  data: Record<string, unknown>;
  priority: 1 | 2 | 3 | 4 | 5; // 1 = highest
}

/**
 * Feedback processing result
 */
export interface FeedbackResult {
  success: boolean;
  parsedFeedback: ParsedFeedback;
  policyEvents: PolicyEvent[];
  appliedCooldown: boolean; // True if cooldown prevented immediate action
  cooldownRemaining?: number; // Cooldown time remaining (ms)
}

/**
 * Cooldown configuration
 */
export interface CooldownConfig {
  enabled?: boolean; // Default: true
  duration?: number; // Cooldown duration (ms), default: 30000 (30s)
  perIntent?: boolean; // Separate cooldown per intent, default: true
  intentResetWindow?: number; // Intent reset window (ms), default: 300000 (5min)

  // Phase 2C: WebView Event Queue protection
  webviewCooldown?: number; // WebView-specific cooldown (ms), default: 60000 (60s)
  batchSize?: number; // Max events to process per batch, default: 3
}

/**
 * Feedback Adapter - Convert user feedback to policy events
 *
 * Features:
 * - Natural language intent detection
 * - Policy event generation
 * - Cooldown prevention (prevents overshooting)
 * - Multi-source support (WebView, CLI, API, Slack, etc.)
 */
export class FeedbackAdapter {
  private readonly logger: Logger;
  private readonly cooldownConfig: Required<CooldownConfig>;
  private readonly cooldowns: Map<string, number> = new Map(); // Intent → last action timestamp
  private readonly intentHistory: Map<string, number[]> = new Map(); // Intent → timestamps (for reset window)

  constructor(logger: Logger, cooldownConfig: CooldownConfig = {}) {
    this.logger = logger;

    // Merge config with defaults
    this.cooldownConfig = {
      enabled: cooldownConfig.enabled ?? true,
      duration: cooldownConfig.duration ?? 30000, // 30s
      perIntent: cooldownConfig.perIntent ?? true,
      intentResetWindow: cooldownConfig.intentResetWindow ?? 300000, // 5min
      webviewCooldown: cooldownConfig.webviewCooldown ?? 60000, // 60s (Phase 2C)
      batchSize: cooldownConfig.batchSize ?? 3, // 3 events max (Phase 2C)
    };
  }

  /**
   * Process user feedback and generate policy events
   *
   * Algorithm:
   * 1. Parse natural language to detect intent
   * 2. Extract relevant data (thresholds, metrics, etc.)
   * 3. Check cooldown (prevent rapid-fire actions)
   * 4. Generate policy events
   * 5. Return result with cooldown status
   */
  async processFeedback(feedback: UserFeedback): Promise<FeedbackResult> {
    this.logger.info("Processing user feedback", {
      id: feedback.id,
      source: feedback.source,
      text: feedback.rawText,
    });

    // 1. Parse feedback to detect intent
    const parsedFeedback = this.parseIntent(feedback);

    this.logger.info("Feedback intent detected", {
      intent: parsedFeedback.intent,
      confidence: parsedFeedback.confidence,
    });

    // 2. Check cooldown
    const cooldownKey = this.cooldownConfig.perIntent
      ? parsedFeedback.intent
      : "global";

    const { inCooldown, remaining } = this.checkCooldown(cooldownKey);

    if (inCooldown) {
      this.logger.warn("Feedback in cooldown, delaying action", {
        intent: parsedFeedback.intent,
        remaining,
      });

      return {
        success: false,
        parsedFeedback,
        policyEvents: [],
        appliedCooldown: true,
        cooldownRemaining: remaining,
      };
    }

    // 3. Generate policy events
    const policyEvents = this.generatePolicyEvents(parsedFeedback);

    // 4. Update cooldown
    if (this.cooldownConfig.enabled && policyEvents.length > 0) {
      this.setCooldown(cooldownKey);
    }

    this.logger.info("Feedback processed successfully", {
      id: feedback.id,
      intent: parsedFeedback.intent,
      eventsGenerated: policyEvents.length,
    });

    return {
      success: true,
      parsedFeedback,
      policyEvents,
      appliedCooldown: false,
    };
  }

  /**
   * Parse natural language feedback to detect intent
   *
   * Uses keyword matching + pattern recognition.
   * Phase 2C: Can be enhanced with NLP model.
   */
  private parseIntent(feedback: UserFeedback): ParsedFeedback {
    const text = feedback.rawText.toLowerCase();
    let intent: FeedbackIntent = "unknown";
    let confidence = 0.5;
    const extractedData: Record<string, unknown> = {};

    // Intent 1: Quality Issue
    if (
      text.includes("quality") &&
      (text.includes("bad") ||
        text.includes("low") ||
        text.includes("poor") ||
        text.includes("degrading"))
    ) {
      intent = "quality_issue";
      confidence = 0.8;

      // Extract metric if mentioned
      if (text.includes("entity coverage")) {
        extractedData.metric = "entity_coverage";
      } else if (text.includes("evidence")) {
        extractedData.metric = "evidence_alignment";
      }
    }

    // Intent 2: Drift Alert
    else if (
      text.includes("drift") ||
      (text.includes("drop") && text.includes("coverage")) ||
      (text.includes("decrease") && text.includes("metric"))
    ) {
      intent = "drift_alert";
      confidence = 0.85;

      // Extract metric
      if (text.includes("entity")) extractedData.metric = "entity_coverage";
      if (text.includes("evidence")) extractedData.metric = "evidence_alignment";
    }

    // Intent 3: Policy Request
    else if (
      text.includes("add") &&
      (text.includes("rule") ||
        text.includes("policy") ||
        text.includes("check"))
    ) {
      intent = "policy_request";
      confidence = 0.75;

      // Extract policy type
      if (text.includes("threshold")) extractedData.policyType = "threshold";
      if (text.includes("quality")) extractedData.policyType = "quality";
    }

    // Intent 4: Threshold Adjust
    else if (
      text.includes("threshold") &&
      (text.includes("increase") ||
        text.includes("decrease") ||
        text.includes("change"))
    ) {
      intent = "threshold_adjust";
      confidence = 0.8;

      // Extract direction
      if (text.includes("increase")) extractedData.direction = "increase";
      if (text.includes("decrease")) extractedData.direction = "decrease";

      // Extract value (e.g., "to 0.8", "by 10%")
      const valueMatch = text.match(/to\s+([\d.]+)|by\s+([\d.]+)/);
      if (valueMatch) {
        extractedData.value = parseFloat(valueMatch[1] || valueMatch[2]);
      }
    }

    // Intent 5: Plugin Toggle
    else if (
      (text.includes("enable") || text.includes("disable")) &&
      text.includes("plugin")
    ) {
      intent = "plugin_toggle";
      confidence = 0.9;

      // Extract action
      extractedData.action = text.includes("enable") ? "enable" : "disable";

      // Extract plugin name (e.g., "hybrid search", "ragas eval")
      if (text.includes("hybrid")) extractedData.plugin = "hybrid-search";
      if (text.includes("ragas")) extractedData.plugin = "ragas-eval";
    }

    // Intent 6: Performance Issue
    else if (
      text.includes("slow") ||
      text.includes("performance") ||
      text.includes("latency")
    ) {
      intent = "performance_issue";
      confidence = 0.7;
    }

    return {
      id: `feedback-${feedback.id}`,
      intent,
      confidence,
      extractedData,
      originalFeedback: feedback,
    };
  }

  /**
   * Generate policy events from parsed feedback
   */
  private generatePolicyEvents(parsed: ParsedFeedback): PolicyEvent[] {
    const events: PolicyEvent[] = [];

    switch (parsed.intent) {
      case "quality_issue": {
        // Trigger quality check
        events.push({
          type: "user_quality_issue_reported",
          timestamp: new Date().toISOString(),
          source: "user_feedback",
          feedbackId: parsed.id,
          data: {
            metric: parsed.extractedData.metric || "overall",
            severity: "medium",
          },
          priority: 3,
        });

        // Trigger feedback loop
        events.push({
          type: "trigger_feedback_loop",
          timestamp: new Date().toISOString(),
          source: "user_feedback",
          feedbackId: parsed.id,
          data: {
            reason: "user_quality_issue",
          },
          priority: 3,
        });
        break;
      }

      case "drift_alert": {
        // Trigger drift detection
        events.push({
          type: "user_drift_alert",
          timestamp: new Date().toISOString(),
          source: "user_feedback",
          feedbackId: parsed.id,
          data: {
            metric: parsed.extractedData.metric || "unknown",
            userReported: true,
          },
          priority: 2,
        });
        break;
      }

      case "policy_request": {
        // Create external policy evaluation request
        events.push({
          type: "external_policy_requested",
          timestamp: new Date().toISOString(),
          source: "user_feedback",
          feedbackId: parsed.id,
          data: {
            policyType: parsed.extractedData.policyType || "custom",
            requestedBy: "user",
          },
          priority: 4,
        });
        break;
      }

      case "threshold_adjust": {
        // Adjust threshold
        events.push({
          type: "threshold_adjustment_requested",
          timestamp: new Date().toISOString(),
          source: "user_feedback",
          feedbackId: parsed.id,
          data: {
            direction: parsed.extractedData.direction,
            value: parsed.extractedData.value,
            manualOverride: true,
          },
          priority: 3,
        });
        break;
      }

      case "plugin_toggle": {
        // Toggle plugin
        events.push({
          type: "plugin_toggle_requested",
          timestamp: new Date().toISOString(),
          source: "user_feedback",
          feedbackId: parsed.id,
          data: {
            action: parsed.extractedData.action,
            plugin: parsed.extractedData.plugin,
          },
          priority: 3,
        });
        break;
      }

      case "performance_issue": {
        // Performance alert
        events.push({
          type: "user_performance_issue_reported",
          timestamp: new Date().toISOString(),
          source: "user_feedback",
          feedbackId: parsed.id,
          data: {
            severity: "medium",
          },
          priority: 3,
        });
        break;
      }

      case "unknown": {
        // Log unknown intent for analysis
        events.push({
          type: "unknown_feedback_intent",
          timestamp: new Date().toISOString(),
          source: "user_feedback",
          feedbackId: parsed.id,
          data: {
            rawText: parsed.originalFeedback.rawText,
            needsManualReview: true,
          },
          priority: 5,
        });
        break;
      }
    }

    return events;
  }

  /**
   * Check if intent is in cooldown
   */
  private checkCooldown(key: string): { inCooldown: boolean; remaining: number } {
    if (!this.cooldownConfig.enabled) {
      return { inCooldown: false, remaining: 0 };
    }

    const lastAction = this.cooldowns.get(key);

    if (!lastAction) {
      return { inCooldown: false, remaining: 0 };
    }

    const elapsed = Date.now() - lastAction;
    const remaining = this.cooldownConfig.duration - elapsed;

    if (remaining > 0) {
      return { inCooldown: true, remaining };
    }

    return { inCooldown: false, remaining: 0 };
  }

  /**
   * Set cooldown for intent
   *
   * Phase 2C: Also updates intent history for reset window tracking.
   */
  private setCooldown(key: string): void {
    const now = Date.now();
    this.cooldowns.set(key, now);

    // Update intent history
    this.updateIntentHistory(key, now);

    this.logger.info("Cooldown set", {
      key,
      duration: this.cooldownConfig.duration,
    });
  }

  /**
   * Update intent history (Phase 2C: Intent Reset Window)
   *
   * Tracks intent occurrences within reset window (5min).
   * If same intent repeats too often, it may indicate bias accumulation.
   */
  private updateIntentHistory(intent: string, timestamp: number): void {
    const history = this.intentHistory.get(intent) || [];

    // Add current timestamp
    history.push(timestamp);

    // Remove timestamps outside reset window (older than 5min)
    const cutoff = timestamp - this.cooldownConfig.intentResetWindow;
    const filtered = history.filter((ts) => ts >= cutoff);

    this.intentHistory.set(intent, filtered);

    // Check for bias accumulation (>5 occurrences in 5min)
    if (filtered.length > 5) {
      this.logger.warn("Intent bias accumulation detected", {
        intent,
        occurrences: filtered.length,
        window: this.cooldownConfig.intentResetWindow,
        recommendation: "Consider averaging or resetting intent confidence",
      });
    }
  }

  /**
   * Get intent frequency within reset window
   */
  getIntentFrequency(intent: string): number {
    const history = this.intentHistory.get(intent) || [];
    const now = Date.now();
    const cutoff = now - this.cooldownConfig.intentResetWindow;

    return history.filter((ts) => ts >= cutoff).length;
  }

  /**
   * Reset intent history (for testing or manual override)
   */
  resetIntentHistory(intent?: string): void {
    if (intent) {
      this.intentHistory.delete(intent);
      this.logger.info("Intent history reset", { intent });
    } else {
      this.intentHistory.clear();
      this.logger.info("All intent history reset");
    }
  }

  /**
   * Clear all cooldowns (for testing or manual override)
   */
  clearCooldowns(): void {
    this.cooldowns.clear();
    this.logger.info("All cooldowns cleared");
  }

  /**
   * Get cooldown status for all intents
   */
  getCooldownStatus(): Map<string, { lastAction: number; remaining: number }> {
    const status = new Map<string, { lastAction: number; remaining: number }>();

    for (const [key, lastAction] of this.cooldowns.entries()) {
      const elapsed = Date.now() - lastAction;
      const remaining = Math.max(0, this.cooldownConfig.duration - elapsed);

      status.set(key, { lastAction, remaining });
    }

    return status;
  }

  /**
   * Get configuration
   */
  getConfig(): Required<CooldownConfig> {
    return { ...this.cooldownConfig };
  }
}

/**
 * Create default feedback adapter
 */
export function createFeedbackAdapter(logger: Logger): FeedbackAdapter {
  return new FeedbackAdapter(logger, {
    enabled: true,
    duration: 30000, // 30s cooldown
    perIntent: true, // Separate cooldown per intent
  });
}
