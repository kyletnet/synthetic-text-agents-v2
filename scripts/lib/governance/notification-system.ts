/**
 * Notification System - Multi-channel alerting
 *
 * Purpose:
 * - Send alerts to multiple channels (Console, File, Slack, GitHub)
 * - Notify on critical events (infinite loops, timeouts, etc.)
 * - Provide operational visibility
 *
 * Design:
 * - Event-type-based channel selection
 * - Configurable via governance-rules.json
 * - Non-blocking notifications
 */

import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  appendFileSync,
} from "fs";
import { join } from "path";
import type {
  GovernanceRulesConfig,
  Severity,
  TimeoutError,
} from "./governance-types.js";

export interface NotificationEvent {
  type: string;
  severity: Severity;
  message: string;
  details: unknown;
  timestamp: string;
}

export class NotificationSystem {
  private projectRoot: string;
  private rules: GovernanceRulesConfig | null = null;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
  }

  /**
   * Notify infinite loop detection
   */
  async notifyInfiniteLoop(details: {
    operationId: string;
    iterations: number;
    duration: number;
  }): Promise<void> {
    const message = `
🚨 Infinite Loop Detected

Operation: ${details.operationId}
Iterations: ${details.iterations}
Duration: ${details.duration.toFixed(2)}s
Timestamp: ${new Date().toISOString()}

Action Required: Investigate and fix loop condition
    `.trim();

    await this.broadcast("infiniteLoop", message, details);
  }

  /**
   * Notify timeout
   */
  async notifyTimeout(error: TimeoutError): Promise<void> {
    const message = `
⏱️  Operation Timeout

Type: ${error.operationType}
Timeout: ${error.timeout}ms
Message: ${error.message}
Timestamp: ${new Date().toISOString()}
    `.trim();

    await this.broadcast("timeout", message, { error });
  }

  /**
   * Notify unexpected change
   */
  async notifyUnexpectedChange(details: {
    path: string;
    reason: string;
    severity: Severity;
  }): Promise<void> {
    const message = `
⚠️  Unexpected File Change

Path: ${details.path}
Reason: ${details.reason}
Severity: ${details.severity.toUpperCase()}
Timestamp: ${new Date().toISOString()}
    `.trim();

    await this.broadcast("unexpectedChange", message, details);
  }

  /**
   * Notify validation failure
   */
  async notifyValidationFailure(details: {
    operation: string;
    errors: string[];
  }): Promise<void> {
    const message = `
❌ Validation Failure

Operation: ${details.operation}
Errors: ${details.errors.length}
Timestamp: ${new Date().toISOString()}

${details.errors.map((e, i) => `${i + 1}. ${e}`).join("\n")}
    `.trim();

    await this.broadcast("validationFailure", message, details);
  }

  /**
   * Broadcast to all configured channels
   */
  private async broadcast(
    eventType: string,
    message: string,
    details: unknown,
  ): Promise<void> {
    const rules = this.loadRules();
    if (!rules.notifications.enabled) return;

    const eventConfig = rules.notifications.eventTypes[eventType];
    if (!eventConfig) {
      console.warn(`⚠️  Unknown event type: ${eventType}`);
      return;
    }

    const event: NotificationEvent = {
      type: eventType,
      severity: eventConfig.severity,
      message,
      details,
      timestamp: new Date().toISOString(),
    };

    // Send to each configured channel
    const promises: Promise<void>[] = [];

    for (const channel of eventConfig.channels) {
      switch (channel) {
        case "console":
          promises.push(this.sendToConsole(event));
          break;
        case "file":
          promises.push(this.sendToFile(event));
          break;
        case "slack":
          promises.push(this.sendToSlack(event));
          break;
        case "github":
          promises.push(this.sendToGitHub(event));
          break;
      }
    }

    // Non-blocking: don't wait for all
    Promise.allSettled(promises).catch((error) => {
      console.error("⚠️  Notification error:", error);
    });
  }

  /**
   * Send to console
   */
  private async sendToConsole(event: NotificationEvent): Promise<void> {
    console.error(`\n${event.message}\n`);
  }

  /**
   * Send to file
   */
  private async sendToFile(event: NotificationEvent): Promise<void> {
    const rules = this.loadRules();
    const alertsDir = join(
      this.projectRoot,
      rules.notifications.config.file?.logPath || "reports/alerts",
    );

    // Ensure directory exists
    if (!existsSync(alertsDir)) {
      mkdirSync(alertsDir, { recursive: true });
    }

    // Write to file
    const filename = `${event.type}-${Date.now()}.json`;
    const filePath = join(alertsDir, filename);

    writeFileSync(filePath, JSON.stringify(event, null, 2), "utf8");

    // Also append to main log
    const logPath = join(alertsDir, "notifications.jsonl");
    appendFileSync(logPath, JSON.stringify(event) + "\n", "utf8");
  }

  /**
   * Send to Slack
   */
  private async sendToSlack(event: NotificationEvent): Promise<void> {
    const rules = this.loadRules();
    const slackConfig = rules.notifications.config.slack;

    if (!slackConfig || !slackConfig.webhookUrl) {
      console.warn("⚠️  Slack webhook not configured");
      return;
    }

    // Replace environment variables
    const webhookUrl = this.resolveEnvVar(slackConfig.webhookUrl);
    if (!webhookUrl || webhookUrl.startsWith("${")) {
      console.warn("⚠️  Slack webhook URL not set in environment");
      return;
    }

    try {
      const payload = {
        channel: slackConfig.channel,
        username: slackConfig.username,
        text: event.message,
        attachments: [
          {
            color: this.getSeverityColor(event.severity),
            fields: [
              {
                title: "Event Type",
                value: event.type,
                short: true,
              },
              {
                title: "Severity",
                value: event.severity.toUpperCase(),
                short: true,
              },
              {
                title: "Timestamp",
                value: event.timestamp,
                short: false,
              },
            ],
          },
        ],
      };

      // Note: Actual HTTP request would go here
      // For now, just log that we would send
      console.log(`📢 Would send to Slack: ${slackConfig.channel}`);
      console.log(`   Webhook: ${webhookUrl.substring(0, 30)}...`);

      // In production:
      // await fetch(webhookUrl, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(payload)
      // });
    } catch (error) {
      console.error("⚠️  Failed to send Slack notification:", error);
    }
  }

  /**
   * Send to GitHub Issues
   */
  private async sendToGitHub(event: NotificationEvent): Promise<void> {
    const rules = this.loadRules();
    const githubConfig = rules.notifications.config.github;

    if (!githubConfig || !githubConfig.token) {
      console.warn("⚠️  GitHub token not configured");
      return;
    }

    // Replace environment variables
    const token = this.resolveEnvVar(githubConfig.token);
    const owner = this.resolveEnvVar(githubConfig.owner);

    if (!token || token.startsWith("${") || !owner || owner.startsWith("${")) {
      console.warn("⚠️  GitHub credentials not set in environment");
      return;
    }

    try {
      const title = `🚨 ${event.type}: ${event.severity.toUpperCase()}`;
      const body = `
${event.message}

---

**Details:**
\`\`\`json
${JSON.stringify(event.details, null, 2)}
\`\`\`

**Timestamp:** ${event.timestamp}

---
*Auto-generated by Governance System*
      `.trim();

      // Note: Actual GitHub API call would go here
      console.log(
        `📢 Would create GitHub issue: ${owner}/${githubConfig.repo}`,
      );
      console.log(`   Title: ${title}`);

      // In production:
      // await fetch(`https://api.github.com/repos/${owner}/${githubConfig.repo}/issues`, {
      //   method: 'POST',
      //   headers: {
      //     'Authorization': `token ${token}`,
      //     'Content-Type': 'application/json'
      //   },
      //   body: JSON.stringify({
      //     title,
      //     body,
      //     labels: githubConfig.labels
      //   })
      // });
    } catch (error) {
      console.error("⚠️  Failed to create GitHub issue:", error);
    }
  }

  /**
   * Resolve environment variable
   */
  private resolveEnvVar(value: string): string {
    const match = value.match(/\$\{([^}]+)\}/);
    if (match) {
      const envVar = match[1];
      return process.env[envVar] || value;
    }
    return value;
  }

  /**
   * Get Slack color for severity
   */
  private getSeverityColor(severity: Severity): string {
    const colors = {
      critical: "danger",
      high: "warning",
      medium: "#FFA500",
      low: "good",
    };
    return colors[severity] || "good";
  }

  /**
   * Load governance rules
   */
  private loadRules(): GovernanceRulesConfig {
    if (this.rules) return this.rules;

    const rulesPath = join(this.projectRoot, "governance-rules.json");
    if (!existsSync(rulesPath)) {
      throw new Error(`governance-rules.json not found at ${rulesPath}`);
    }

    const content = readFileSync(rulesPath, "utf8");
    this.rules = JSON.parse(content) as GovernanceRulesConfig;
    return this.rules;
  }

  /**
   * Test notification system
   */
  async test(): Promise<void> {
    console.log("🧪 Testing notification system...\n");

    await this.broadcast("test", "Test notification from Governance System", {
      test: true,
    });

    console.log("✅ Test notification sent\n");
  }
}

/**
 * Global singleton instance
 */
let globalNotificationSystem: NotificationSystem | null = null;

export function getNotificationSystem(
  projectRoot?: string,
): NotificationSystem {
  if (!globalNotificationSystem) {
    globalNotificationSystem = new NotificationSystem(projectRoot);
  }
  return globalNotificationSystem;
}
