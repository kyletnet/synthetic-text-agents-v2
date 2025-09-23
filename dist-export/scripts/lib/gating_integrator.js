/**
 * gating_integrator.ts — Evaluate session reports against success criteria for gating decisions
 */
import { promises as fs } from "fs";
import { ThresholdManager } from "../metrics/thresholdManager.js";
export class GatingIntegrator {
    thresholdManager;
    constructor() {
        this.thresholdManager = new ThresholdManager();
    }
    async evaluateSession(sessionReportPath, criteria) {
        const sessionData = await this.loadSessionReport(sessionReportPath);
        const sessionMetrics = this.extractSessionMetrics(sessionData);
        const violations = [];
        let canProceed = true;
        // Evaluate each criterion
        const evaluations = [
            this.evaluateMinCases(sessionMetrics, criteria),
            this.evaluateCostRequirement(sessionMetrics, criteria),
            this.evaluateWarningLimit(sessionMetrics, criteria),
            this.evaluateResultRequirement(sessionMetrics, criteria),
            this.evaluateThresholdViolations(sessionMetrics, criteria),
        ];
        for (const evaluation of evaluations) {
            if (!evaluation.passed) {
                canProceed = false;
                violations.push(evaluation.reason);
            }
        }
        // Determine overall gate status
        const gateStatus = this.determineGateStatus(sessionMetrics, violations);
        const overallScore = this.calculateOverallScore(sessionMetrics, violations.length);
        const reason = canProceed
            ? "All success criteria met"
            : `Failed criteria: ${violations.join("; ")}`;
        const result = {
            canProceed,
            reason,
            violations,
            criteria,
            sessionMetrics,
            decision: {
                timestamp: new Date().toISOString(),
                profile: sessionData.session_summary.profile,
                gateStatus,
                overallScore,
            },
        };
        await this.logGatingDecision(result);
        return result;
    }
    async loadSessionReport(reportPath) {
        try {
            const content = await fs.readFile(reportPath, "utf8");
            // Try to parse as JSON first
            try {
                return JSON.parse(content);
            }
            catch {
                // If not JSON, try to extract JSON from markdown
                return this.extractJSONFromMarkdown(content);
            }
        }
        catch (error) {
            throw new Error(`Failed to load session report from ${reportPath}: ${error}`);
        }
    }
    extractJSONFromMarkdown(content) {
        // Look for JSON blocks in markdown
        const jsonBlockRegex = /```json\s*\n([\s\S]*?)\n```/g;
        let match;
        while ((match = jsonBlockRegex.exec(content)) !== null) {
            try {
                const parsed = JSON.parse(match[1]);
                if (parsed.session_summary && parsed.baseline_summary) {
                    return parsed;
                }
            }
            catch {
                continue;
            }
        }
        // Fallback: look for structured data patterns
        const sessionData = {
            session_summary: {
                cases_total: this.extractNumericValue(content, /cases[_\s]*total[:\s]*(\d+)/i) ||
                    0,
                cost_usd: this.extractNumericValue(content, /cost[_\s]*usd[:\s]*\$?([0-9.]+)/i) || 0,
                result: this.extractStringValue(content, /result[:\s]*([A-Z]+)/i) ||
                    "UNKNOWN",
                profile: this.extractStringValue(content, /profile[:\s]*(\w+)/i) || "unknown",
                timestamp: new Date().toISOString(),
            },
            baseline_summary: {
                sample_count: this.extractNumericValue(content, /sample[_\s]*count[:\s]*(\d+)/i) ||
                    0,
                quality_score_summary: {
                    overall_score: this.extractNumericValue(content, /overall[_\s]*score[:\s]*([0-9.]+)/i) || 0,
                    total_alerts: this.extractNumericValue(content, /total[_\s]*alerts[:\s]*(\d+)/i) || 0,
                },
            },
        };
        return sessionData;
    }
    extractNumericValue(content, regex) {
        const match = content.match(regex);
        return match ? parseFloat(match[1]) : null;
    }
    extractStringValue(content, regex) {
        const match = content.match(regex);
        return match ? match[1] : null;
    }
    extractSessionMetrics(sessionData) {
        const threshold = sessionData.baseline_summary.threshold_validation;
        return {
            totalCases: sessionData.session_summary.cases_total,
            successfulCases: sessionData.baseline_summary.sample_count,
            totalCost: sessionData.session_summary.cost_usd,
            result: sessionData.session_summary.result,
            warningCount: threshold?.p1_warnings?.length || 0,
            errorCount: threshold?.p0_violations?.length || 0,
            p0Violations: threshold?.p0_violations || [],
            p1Warnings: threshold?.p1_warnings || [],
            p2Issues: threshold?.p2_issues || [],
        };
    }
    evaluateMinCases(metrics, criteria) {
        if (metrics.totalCases < criteria.minCases) {
            return {
                passed: false,
                reason: `Insufficient test cases: ${metrics.totalCases} < ${criteria.minCases} required`,
            };
        }
        return { passed: true, reason: "Minimum cases requirement met" };
    }
    evaluateCostRequirement(metrics, criteria) {
        if (metrics.totalCost <= criteria.requireCostGt) {
            return {
                passed: false,
                reason: `Insufficient cost verification: $${metrics.totalCost} <= $${criteria.requireCostGt} (smoke run may not have executed properly)`,
            };
        }
        return { passed: true, reason: "Cost requirement met" };
    }
    evaluateWarningLimit(metrics, criteria) {
        if (metrics.warningCount > criteria.maxWarn) {
            return {
                passed: false,
                reason: `Too many warnings: ${metrics.warningCount} > ${criteria.maxWarn} allowed`,
            };
        }
        return { passed: true, reason: "Warning limit met" };
    }
    evaluateResultRequirement(metrics, criteria) {
        if (!criteria.enforceResult.includes(metrics.result)) {
            return {
                passed: false,
                reason: `Result '${metrics.result}' not in allowed results: [${criteria.enforceResult.join(", ")}]`,
            };
        }
        return { passed: true, reason: "Result requirement met" };
    }
    evaluateThresholdViolations(metrics, criteria) {
        // P0 violations are always blocking
        if (metrics.p0Violations.length > 0) {
            return {
                passed: false,
                reason: `Critical P0 violations found: ${metrics.p0Violations.join(", ")}`,
            };
        }
        // P1 warnings are considered in the warning count (already checked above)
        // P2 issues are informational and don't block
        return { passed: true, reason: "No blocking threshold violations" };
    }
    determineGateStatus(metrics, violations) {
        if (violations.length === 0) {
            return metrics.warningCount === 0 ? "PASS" : "WARN";
        }
        // Check if any violations are critical
        const hasCriticalViolations = violations.some((v) => v.includes("P0") ||
            v.includes("Insufficient test cases") ||
            v.includes("not in allowed results"));
        if (hasCriticalViolations) {
            return "FAIL";
        }
        return "PARTIAL";
    }
    calculateOverallScore(metrics, violationCount) {
        let score = 1.0;
        // Penalize for violations
        score -= violationCount * 0.1;
        // Penalize for errors and warnings
        score -= metrics.errorCount * 0.2;
        score -= metrics.warningCount * 0.05;
        // Bonus for successful completion
        if (metrics.result === "PASS") {
            score += 0.1;
        }
        return Math.max(0, Math.min(1, score));
    }
    async logGatingDecision(result) {
        const logEntry = {
            timestamp: result.decision.timestamp,
            component: "gating_integrator",
            operation: "evaluate_session",
            gating_result: {
                can_proceed: result.canProceed,
                gate_status: result.decision.gateStatus,
                overall_score: result.decision.overallScore,
                violations_count: result.violations.length,
                violations: result.violations,
                criteria: result.criteria,
                session_metrics: result.sessionMetrics,
            },
            level: result.canProceed ? "info" : "warn",
        };
        console.log(`[GATING] ${JSON.stringify(logEntry)}`);
    }
    // Utility method for CI/CD integration
    async evaluateAndExit(sessionReportPath, criteria) {
        try {
            const result = await this.evaluateSession(sessionReportPath, criteria);
            console.log(`\n[GATING] ${result.canProceed ? "✅ PASS" : "❌ FAIL"}`);
            console.log(`[GATING] Gate Status: ${result.decision.gateStatus}`);
            console.log(`[GATING] Overall Score: ${(result.decision.overallScore * 100).toFixed(1)}%`);
            if (result.violations.length > 0) {
                console.log("[GATING] Violations:");
                for (const violation of result.violations) {
                    console.log(`  - ${violation}`);
                }
            }
            process.exit(result.canProceed ? 0 : 1);
        }
        catch (error) {
            console.error(`[GATING] Fatal error: ${error}`);
            process.exit(1);
        }
    }
}
//# sourceMappingURL=gating_integrator.js.map