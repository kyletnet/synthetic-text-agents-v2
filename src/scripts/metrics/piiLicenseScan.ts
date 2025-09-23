import { readFileSync } from "fs";

interface PiiLicenseConfig {
  pii_patterns: string[];
  license_keywords: string[];
  alert_thresholds: {
    pii_hits_max: number;
    license_risk_hits_max: number;
  };
}

interface PiiMatch {
  type: "pii" | "license";
  pattern: string;
  match: string;
  context: string;
  location: {
    field: string;
    index: number;
  };
  risk_level: "low" | "medium" | "high";
}

interface PiiLicenseMetrics {
  total_items_scanned: number;
  pii_hits: number;
  license_risk_hits: number;
  total_violations: number;
  matches: PiiMatch[];
  summary: {
    email_addresses: number;
    phone_numbers: number;
    credit_cards: number;
    social_security: number;
    copyright_notices: number;
    license_terms: number;
  };
  alert_triggered: boolean;
}

interface QAItem {
  qa: {
    q: string;
    a: string;
  };
  evidence?: string;
  evidence_text?: string;
  source_text?: string;
  index?: number;
}

/**
 * Enhanced PII patterns with Korean support
 */
const ENHANCED_PII_PATTERNS = [
  // Korean social security number (주민등록번호)
  { pattern: /\b\d{6}-\d{7}\b/g, type: "social_security", risk: "high" },

  // US social security number
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, type: "social_security", risk: "high" },

  // Email addresses
  {
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    type: "email",
    risk: "medium",
  },

  // Credit card numbers
  {
    pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    type: "credit_card",
    risk: "high",
  },

  // Phone numbers (various formats)
  {
    pattern: /\b(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    type: "phone",
    risk: "medium",
  },

  // Korean phone numbers
  { pattern: /\b01[0-9]-\d{4}-\d{4}\b/g, type: "phone", risk: "medium" },

  // IP addresses (could be sensitive)
  {
    pattern: /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g,
    type: "ip_address",
    risk: "low",
  },

  // URLs with personal paths
  {
    pattern: /https?:\/\/[^\s]+\/users\/[^\s]+/g,
    type: "personal_url",
    risk: "medium",
  },
];

/**
 * Enhanced license and copyright keywords
 */
const ENHANCED_LICENSE_KEYWORDS = [
  // Copyright notices
  { keyword: "copyright", risk: "medium" },
  { keyword: "©", risk: "medium" },
  { keyword: "all rights reserved", risk: "high" },
  { keyword: "저작권", risk: "medium" },

  // License terms
  { keyword: "licensed under", risk: "high" },
  { keyword: "proprietary", risk: "high" },
  { keyword: "confidential", risk: "high" },
  { keyword: "trade secret", risk: "high" },
  { keyword: "patent pending", risk: "medium" },

  // Specific licenses
  { keyword: "MIT license", risk: "medium" },
  { keyword: "GPL", risk: "medium" },
  { keyword: "Apache license", risk: "medium" },
  { keyword: "BSD license", risk: "medium" },

  // Korean legal terms
  { keyword: "영업비밀", risk: "high" },
  { keyword: "기밀", risk: "high" },
  { keyword: "라이선스", risk: "medium" },
];

/**
 * Extract context around a match
 */
function extractContext(
  text: string,
  matchIndex: number,
  matchLength: number,
  contextLength: number = 50,
): string {
  const start = Math.max(0, matchIndex - contextLength);
  const end = Math.min(text.length, matchIndex + matchLength + contextLength);

  let context = text.substring(start, end);

  // Add ellipsis if truncated
  if (start > 0) context = "..." + context;
  if (end < text.length) context = context + "...";

  return context.replace(/\s+/g, " ").trim();
}

/**
 * Scan text for PII patterns
 */
function scanForPii(
  text: string,
  fieldName: string,
  itemIndex: number,
): PiiMatch[] {
  const matches: PiiMatch[] = [];

  for (const { pattern, type, risk } of ENHANCED_PII_PATTERNS) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);

    while ((match = regex.exec(text)) !== null) {
      matches.push({
        type: "pii",
        pattern: pattern.source,
        match: match[0],
        context: extractContext(text, match.index, match[0].length),
        location: {
          field: fieldName,
          index: itemIndex,
        },
        risk_level: risk as "low" | "medium" | "high",
      });
    }
  }

  return matches;
}

/**
 * Scan text for license and copyright keywords
 */
function scanForLicense(
  text: string,
  fieldName: string,
  itemIndex: number,
): PiiMatch[] {
  const matches: PiiMatch[] = [];
  const textLower = text.toLowerCase();

  for (const { keyword, risk } of ENHANCED_LICENSE_KEYWORDS) {
    const keywordLower = keyword.toLowerCase();
    let searchStart = 0;

    while (true) {
      const matchIndex = textLower.indexOf(keywordLower, searchStart);
      if (matchIndex === -1) break;

      matches.push({
        type: "license",
        pattern: keyword,
        match: text.substring(matchIndex, matchIndex + keyword.length),
        context: extractContext(text, matchIndex, keyword.length),
        location: {
          field: fieldName,
          index: itemIndex,
        },
        risk_level: risk as "low" | "medium" | "high",
      });

      searchStart = matchIndex + keyword.length;
    }
  }

  return matches;
}

/**
 * Scan QA items for PII and license violations
 */
export function scanPiiAndLicense(
  qaItems: QAItem[],
  configPath: string = "baseline_config.json",
): PiiLicenseMetrics {
  // Load configuration
  const configText = readFileSync(configPath, "utf-8");
  const fullConfig = JSON.parse(configText);
  const config: PiiLicenseConfig = fullConfig.pii_license_scan;

  const allMatches: PiiMatch[] = [];
  const summary = {
    email_addresses: 0,
    phone_numbers: 0,
    credit_cards: 0,
    social_security: 0,
    copyright_notices: 0,
    license_terms: 0,
  };

  for (let i = 0; i < qaItems.length; i++) {
    const item = qaItems[i];

    // Scan question
    const questionPiiMatches = scanForPii(item.qa.q, "question", i);
    const questionLicenseMatches = scanForLicense(item.qa.q, "question", i);

    // Scan answer
    const answerPiiMatches = scanForPii(item.qa.a, "answer", i);
    const answerLicenseMatches = scanForLicense(item.qa.a, "answer", i);

    // Scan evidence if available
    let evidencePiiMatches: PiiMatch[] = [];
    let evidenceLicenseMatches: PiiMatch[] = [];

    const evidence = item.evidence || item.evidence_text || item.source_text;
    if (evidence) {
      evidencePiiMatches = scanForPii(evidence, "evidence", i);
      evidenceLicenseMatches = scanForLicense(evidence, "evidence", i);
    }

    // Combine all matches
    const itemMatches = [
      ...questionPiiMatches,
      ...questionLicenseMatches,
      ...answerPiiMatches,
      ...answerLicenseMatches,
      ...evidencePiiMatches,
      ...evidenceLicenseMatches,
    ];

    allMatches.push(...itemMatches);

    // Update summary counts
    for (const match of itemMatches) {
      if (match.type === "pii") {
        if (match.pattern.includes("@")) summary.email_addresses++;
        else if (
          match.pattern.includes("01[0-9]") ||
          match.pattern.includes("\\(\\d{3}\\)")
        )
          summary.phone_numbers++;
        else if (match.pattern.includes("\\d{4}[\\s-]?\\d{4}"))
          summary.credit_cards++;
        else if (
          match.pattern.includes("\\d{6}-\\d{7}") ||
          match.pattern.includes("\\d{3}-\\d{2}-\\d{4}")
        )
          summary.social_security++;
      } else if (match.type === "license") {
        if (
          match.pattern.includes("copyright") ||
          match.pattern.includes("©") ||
          match.pattern.includes("저작권")
        ) {
          summary.copyright_notices++;
        } else {
          summary.license_terms++;
        }
      }
    }
  }

  // Calculate metrics
  const piiHits = allMatches.filter((m) => m.type === "pii").length;
  const licenseRiskHits = allMatches.filter((m) => m.type === "license").length;
  const totalViolations = allMatches.length;

  // Check alert conditions
  const alertTriggered =
    piiHits > config.alert_thresholds.pii_hits_max ||
    licenseRiskHits > config.alert_thresholds.license_risk_hits_max;

  return {
    total_items_scanned: qaItems.length,
    pii_hits: piiHits,
    license_risk_hits: licenseRiskHits,
    total_violations: totalViolations,
    matches: allMatches.slice(0, 20), // Limit for reporting
    summary,
    alert_triggered: alertTriggered,
  };
}

/**
 * Generate PII and license scan report
 */
export function generatePiiLicenseReport(metrics: PiiLicenseMetrics): string {
  const lines: string[] = [];

  lines.push("## PII and License Scanning");
  lines.push("");

  // Summary metrics
  lines.push("### Scan Summary");
  lines.push(`- **Items Scanned**: ${metrics.total_items_scanned}`);
  lines.push(`- **PII Violations**: ${metrics.pii_hits}`);
  lines.push(`- **License Risk Items**: ${metrics.license_risk_hits}`);
  lines.push(`- **Total Violations**: ${metrics.total_violations}`);
  lines.push(
    `- **Alert Status**: ${metrics.alert_triggered ? "🚨 VIOLATIONS DETECTED" : "✅ CLEAN"}`,
  );
  lines.push("");

  // Detailed breakdown
  lines.push("### Violation Breakdown");
  lines.push("| Category | Count |");
  lines.push("|----------|-------|");
  lines.push(`| Email Addresses | ${metrics.summary.email_addresses} |`);
  lines.push(`| Phone Numbers | ${metrics.summary.phone_numbers} |`);
  lines.push(`| Credit Cards | ${metrics.summary.credit_cards} |`);
  lines.push(`| Social Security | ${metrics.summary.social_security} |`);
  lines.push(`| Copyright Notices | ${metrics.summary.copyright_notices} |`);
  lines.push(`| License Terms | ${metrics.summary.license_terms} |`);
  lines.push("");

  // Show specific violations if any
  if (metrics.matches.length > 0) {
    lines.push("### Detected Violations");
    lines.push("| Type | Risk | Match | Context | Location |");
    lines.push("|------|------|-------|---------|----------|");

    for (const match of metrics.matches.slice(0, 10)) {
      const riskIcon =
        match.risk_level === "high"
          ? "🔴"
          : match.risk_level === "medium"
            ? "🟡"
            : "🟢";
      const maskedMatch = match.type === "pii" ? "***REDACTED***" : match.match;
      const location = `${match.location.field}[${match.location.index}]`;

      lines.push(
        `| ${match.type.toUpperCase()} | ${riskIcon} ${match.risk_level} | ${maskedMatch} | ${match.context.substring(0, 50)}... | ${location} |`,
      );
    }
    lines.push("");
  }

  // Recommendations
  if (metrics.alert_triggered) {
    lines.push("### Recommendations");
    if (metrics.pii_hits > 0) {
      lines.push(
        "- 🚨 **Immediate Action Required**: Remove or mask all PII before deployment",
      );
      lines.push("- 📋 Review data sources for PII contamination");
    }
    if (metrics.license_risk_hits > 0) {
      lines.push("- ⚠️ Review license terms and copyright notices");
      lines.push("- 📄 Ensure compliance with intellectual property rights");
    }
    lines.push("- 🔄 Re-scan after cleanup to verify compliance");
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * CLI entry point for testing
 */
if (import.meta.url === new URL(process.argv[1], "file://").href) {
  // Test with sample data including potential violations
  const sampleQA: QAItem[] = [
    {
      qa: {
        q: "연락처를 알려주세요",
        a: "제 이메일은 test@example.com이고 전화번호는 010-1234-5678입니다.",
      },
      evidence: "개인정보보호를 위해 연락처는 공개하지 않습니다.",
      index: 0,
    },
    {
      qa: {
        q: "저작권은 무엇인가요?",
        a: "저작권은 창작물을 보호하는 권리입니다. © 2024 All rights reserved.",
      },
      evidence: "저작권법에 따라 창작물은 보호받습니다.",
      index: 1,
    },
    {
      qa: {
        q: "물의 상태는 무엇인가요?",
        a: "물은 고체, 액체, 기체 상태로 존재합니다.",
      },
      evidence: "물은 세 가지 상태로 존재할 수 있습니다.",
      index: 2,
    },
  ];

  try {
    const metrics = scanPiiAndLicense(sampleQA);
    console.log("PII and License Scan Metrics:");
    console.log(JSON.stringify(metrics, null, 2));
    console.log("\nReport:");
    console.log(generatePiiLicenseReport(metrics));
  } catch (error) {
    console.error("Error scanning for PII and license violations:", error);
  }
}
