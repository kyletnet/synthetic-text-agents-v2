#!/usr/bin/env tsx

/**
 * Developer Reference Document Tracking System
 * Monitors critical documentation and ensures developers have access to essential guides
 */

import { readFileSync, writeFileSync, existsSync, statSync } from "fs";
import { join } from "path";

interface ReferenceDocument {
  path: string;
  title: string;
  category: "CRITICAL" | "DEVELOPMENT" | "OPERATIONAL" | "REFERENCE";
  priority: 1 | 2 | 3;
  exists: boolean;
  lastModified?: Date;
  ageInDays?: number;
  size?: number;
  status: "CURRENT" | "STALE" | "MISSING" | "OUTDATED";
  accessibility: "IMMEDIATE" | "MODERATE" | "DIFFICULT";
}

interface DocumentationGap {
  category: string;
  missing: string[];
  stale: string[];
  severity: "HIGH" | "MEDIUM" | "LOW";
  impact: string;
  recommendation: string;
}

interface ReferenceReport {
  timestamp: Date;
  overallScore: number;
  totalDocuments: number;
  missingCount: number;
  staleCount: number;
  currentCount: number;
  documents: ReferenceDocument[];
  gaps: DocumentationGap[];
  quickAccess: {
    path: string;
    description: string;
  }[];
  recommendations: string[];
}

class ReferenceTracker {
  private projectRoot: string;
  private essentialDocs: Omit<
    ReferenceDocument,
    | "exists"
    | "status"
    | "lastModified"
    | "ageInDays"
    | "size"
    | "accessibility"
  >[] = [
    // Critical System Documents
    {
      path: "CLAUDE.md",
      title: "System Philosophy & Standards",
      category: "CRITICAL",
      priority: 1,
    },
    {
      path: "README.md",
      title: "Project Overview",
      category: "CRITICAL",
      priority: 1,
    },
    {
      path: "DEVELOPMENT_STANDARDS.md",
      title: "Development Standards",
      category: "CRITICAL",
      priority: 1,
    },
    {
      path: "HANDOFF_NAVIGATION.md",
      title: "Navigation Guide",
      category: "CRITICAL",
      priority: 1,
    },

    // Development Documentation
    {
      path: "docs/TYPESCRIPT_GUIDELINES.md",
      title: "TypeScript Guidelines",
      category: "DEVELOPMENT",
      priority: 1,
    },
    {
      path: "docs/ARCHITECTURE.md",
      title: "System Architecture",
      category: "DEVELOPMENT",
      priority: 2,
    },
    {
      path: "docs/API.md",
      title: "API Documentation",
      category: "DEVELOPMENT",
      priority: 2,
    },
    {
      path: "docs/TESTING.md",
      title: "Testing Guidelines",
      category: "DEVELOPMENT",
      priority: 2,
    },

    // Operational Documentation
    {
      path: "docs/DEPLOYMENT_GUIDE.md",
      title: "Deployment Guide",
      category: "OPERATIONAL",
      priority: 2,
    },
    {
      path: "docs/OPERATIONS.md",
      title: "Operations Guide",
      category: "OPERATIONAL",
      priority: 2,
    },
    {
      path: "docs/SECURITY.md",
      title: "Security Guidelines",
      category: "OPERATIONAL",
      priority: 2,
    },
    {
      path: "docs/MONITORING.md",
      title: "Monitoring & Observability",
      category: "OPERATIONAL",
      priority: 3,
    },

    // Reference Documentation
    {
      path: "docs/CHANGELOG.md",
      title: "Change Log",
      category: "REFERENCE",
      priority: 2,
    },
    {
      path: "docs/TROUBLESHOOTING.md",
      title: "Troubleshooting Guide",
      category: "REFERENCE",
      priority: 2,
    },
    {
      path: "docs/FAQ.md",
      title: "Frequently Asked Questions",
      category: "REFERENCE",
      priority: 3,
    },
    {
      path: "docs/GLOSSARY.md",
      title: "Technical Glossary",
      category: "REFERENCE",
      priority: 3,
    },

    // Auto-Generated Documents
    {
      path: "reports/HANDOFF_ONE.md",
      title: "Developer Handoff Guide",
      category: "CRITICAL",
      priority: 1,
    },
    {
      path: "reports/unified-system-report.json",
      title: "System Health Report",
      category: "DEVELOPMENT",
      priority: 2,
    },
  ];

  constructor() {
    this.projectRoot = process.cwd();
  }

  async trackReferences(): Promise<ReferenceReport> {
    console.log("📚 Tracking developer reference documents...");

    const documents: ReferenceDocument[] = [];

    for (const docSpec of this.essentialDocs) {
      const fullPath = join(this.projectRoot, docSpec.path);
      const exists = existsSync(fullPath);

      let lastModified: Date | undefined;
      let ageInDays: number | undefined;
      let size: number | undefined;

      if (exists) {
        try {
          const stats = statSync(fullPath);
          lastModified = stats.mtime;
          ageInDays =
            (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
          size = stats.size;
        } catch (error) {
          // Continue with defaults
        }
      }

      const status = this.determineStatus(exists, ageInDays);
      const accessibility = this.determineAccessibility(docSpec.path, exists);

      documents.push({
        ...docSpec,
        exists,
        lastModified,
        ageInDays: ageInDays ? Math.round(ageInDays) : undefined,
        size,
        status,
        accessibility,
      });
    }

    const gaps = this.analyzeGaps(documents);
    const quickAccess = this.generateQuickAccess(documents);
    const recommendations = this.generateRecommendations(documents, gaps);

    const missingCount = documents.filter((d) => !d.exists).length;
    const staleCount = documents.filter(
      (d) => d.status === "STALE" || d.status === "OUTDATED",
    ).length;
    const currentCount = documents.filter((d) => d.status === "CURRENT").length;
    const overallScore = this.calculateOverallScore(documents);

    return {
      timestamp: new Date(),
      overallScore,
      totalDocuments: documents.length,
      missingCount,
      staleCount,
      currentCount,
      documents,
      gaps,
      quickAccess,
      recommendations,
    };
  }

  private determineStatus(
    exists: boolean,
    ageInDays?: number,
  ): ReferenceDocument["status"] {
    if (!exists) return "MISSING";
    if (ageInDays === undefined) return "CURRENT";

    if (ageInDays > 180) return "OUTDATED";
    if (ageInDays > 90) return "STALE";
    return "CURRENT";
  }

  private determineAccessibility(
    path: string,
    exists: boolean,
  ): ReferenceDocument["accessibility"] {
    if (!exists) return "DIFFICULT";

    // Root level files are immediately accessible
    if (!path.includes("/")) return "IMMEDIATE";

    // docs/ folder is standard and accessible
    if (path.startsWith("docs/")) return "IMMEDIATE";

    // reports/ folder requires some navigation
    if (path.startsWith("reports/")) return "MODERATE";

    return "MODERATE";
  }

  private analyzeGaps(documents: ReferenceDocument[]): DocumentationGap[] {
    const gaps: DocumentationGap[] = [];
    const categories = [
      "CRITICAL",
      "DEVELOPMENT",
      "OPERATIONAL",
      "REFERENCE",
    ] as const;

    for (const category of categories) {
      const categoryDocs = documents.filter((d) => d.category === category);
      const missing = categoryDocs.filter((d) => !d.exists).map((d) => d.title);
      const stale = categoryDocs
        .filter((d) => d.status === "STALE" || d.status === "OUTDATED")
        .map((d) => d.title);

      if (missing.length > 0 || stale.length > 0) {
        const severity = this.calculateGapSeverity(
          category,
          missing.length,
          stale.length,
        );
        const impact = this.getGapImpact(
          category,
          missing.length,
          stale.length,
        );
        const recommendation = this.getGapRecommendation(
          category,
          missing,
          stale,
        );

        gaps.push({
          category,
          missing,
          stale,
          severity,
          impact,
          recommendation,
        });
      }
    }

    return gaps;
  }

  private calculateGapSeverity(
    category: string,
    missingCount: number,
    staleCount: number,
  ): DocumentationGap["severity"] {
    if (category === "CRITICAL" && missingCount > 0) return "HIGH";
    if (category === "DEVELOPMENT" && missingCount > 1) return "HIGH";
    if (missingCount > 2 || staleCount > 3) return "MEDIUM";
    return "LOW";
  }

  private getGapImpact(
    category: string,
    missingCount: number,
    staleCount: number,
  ): string {
    if (category === "CRITICAL") {
      return "Developer onboarding and system understanding severely impacted";
    }
    if (category === "DEVELOPMENT" && missingCount > 0) {
      return "Development velocity and code quality may suffer";
    }
    if (category === "OPERATIONAL" && missingCount > 1) {
      return "Deployment and maintenance processes at risk";
    }
    if (staleCount > missingCount) {
      return "Outdated information may mislead developers";
    }
    return "Minor impact on developer experience";
  }

  private getGapRecommendation(
    category: string,
    missing: string[],
    stale: string[],
  ): string {
    if (missing.length > stale.length) {
      return `Create missing ${category.toLowerCase()} documentation immediately`;
    }
    if (stale.length > 2) {
      return `Schedule documentation refresh for ${category.toLowerCase()} guides`;
    }
    return `Review and update ${category.toLowerCase()} documentation as needed`;
  }

  private generateQuickAccess(
    documents: ReferenceDocument[],
  ): { path: string; description: string }[] {
    return documents
      .filter((d) => d.exists && d.priority === 1)
      .sort((a, b) => a.path.localeCompare(b.path))
      .map((d) => ({
        path: d.path,
        description: d.title,
      }))
      .slice(0, 8); // Top 8 most important
  }

  private generateRecommendations(
    documents: ReferenceDocument[],
    gaps: DocumentationGap[],
  ): string[] {
    const recommendations = [];

    const criticalMissing = documents.filter(
      (d) => d.category === "CRITICAL" && !d.exists,
    );
    if (criticalMissing.length > 0) {
      recommendations.push(
        `🚨 Create ${criticalMissing.length} missing CRITICAL documents immediately`,
      );
    }

    const highPriorityStale = documents.filter(
      (d) =>
        d.priority === 1 && (d.status === "STALE" || d.status === "OUTDATED"),
    );
    if (highPriorityStale.length > 0) {
      recommendations.push(
        `📅 Update ${highPriorityStale.length} stale high-priority documents`,
      );
    }

    const totalMissing = documents.filter((d) => !d.exists).length;
    if (totalMissing > 5) {
      recommendations.push(
        "📝 High documentation deficit - prioritize document creation",
      );
    } else if (totalMissing > 2) {
      recommendations.push(
        "📋 Moderate documentation gaps - address in next sprint",
      );
    }

    const inaccessibleDocs = documents.filter(
      (d) => d.accessibility === "DIFFICULT",
    ).length;
    if (inaccessibleDocs > 3) {
      recommendations.push(
        "🔍 Some documents are hard to find - improve organization",
      );
    }

    const overallScore = this.calculateOverallScore(documents);
    if (overallScore < 60) {
      recommendations.push("📚 Documentation needs significant improvement");
    } else if (overallScore < 80) {
      recommendations.push("📖 Documentation is adequate but could be better");
    } else {
      recommendations.push("✅ Documentation is in good shape");
    }

    return recommendations;
  }

  private calculateOverallScore(documents: ReferenceDocument[]): number {
    let score = 0;
    let maxScore = 0;

    for (const doc of documents) {
      const weight = doc.priority === 1 ? 3 : doc.priority === 2 ? 2 : 1;
      maxScore += weight * 100;

      if (doc.exists) {
        if (doc.status === "CURRENT") {
          score += weight * 100;
        } else if (doc.status === "STALE") {
          score += weight * 70;
        } else if (doc.status === "OUTDATED") {
          score += weight * 40;
        }
      }
      // Missing documents contribute 0 points
    }

    return maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  }

  generateReferenceSummary(report: ReferenceReport): string {
    return `
## 📚 Developer Reference Documentation

### 📊 Documentation Health
- **Overall Score**: ${report.overallScore}/100
- **Total Documents**: ${report.totalDocuments}
- **Current**: ${report.currentCount} ✅
- **Missing**: ${report.missingCount} ❌
- **Stale**: ${report.staleCount} ⚠️

### 🎯 Quick Access (Essential Docs)
${report.quickAccess.map((qa) => `- **${qa.path}** - ${qa.description}`).join("\n")}

${
  report.gaps.length > 0
    ? `
### ⚠️ Documentation Gaps
${report.gaps
  .map(
    (gap) => `
#### ${gap.category} (${gap.severity})
- **Missing**: ${gap.missing.length > 0 ? gap.missing.join(", ") : "None"}
- **Stale**: ${gap.stale.length > 0 ? gap.stale.join(", ") : "None"}
- **Impact**: ${gap.impact}
- **Action**: ${gap.recommendation}
`,
  )
  .join("")}`
    : "✅ No significant documentation gaps detected"
}

### 🔍 Status by Category
${["CRITICAL", "DEVELOPMENT", "OPERATIONAL", "REFERENCE"]
  .map((category) => {
    const categoryDocs = report.documents.filter(
      (d) => d.category === category,
    );
    const current = categoryDocs.filter((d) => d.status === "CURRENT").length;
    const total = categoryDocs.length;
    return `- **${category}**: ${current}/${total} current`;
  })
  .join("\n")}

### 🎯 Recommendations
${report.recommendations.map((rec) => `- ${rec}`).join("\n")}

### 🔧 Quick Actions
- \`npm run docs:audit:full\` - Comprehensive documentation audit
- \`npm run status\` - Generate HANDOFF_ONE.md if missing
- Review and create missing critical documents
`;
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const tracker = new ReferenceTracker();
  tracker
    .trackReferences()
    .then((report) => {
      console.log(tracker.generateReferenceSummary(report));
    })
    .catch(console.error);
}

export default ReferenceTracker;
