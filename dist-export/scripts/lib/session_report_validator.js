/**
 * session_report_validator.ts — Validate session reports against JSON schemas
 */
import { promises as fs } from "fs";
import Ajv from "ajv";
import addFormats from "ajv-formats";
export class SessionReportValidator {
    ajv;
    constructor() {
        this.ajv = new Ajv({
            allErrors: true,
            verbose: true,
            strict: false,
        });
        addFormats(this.ajv);
    }
    async validateReport(reportPath, schemaPath) {
        try {
            // Load schema
            const schemaContent = await fs.readFile(schemaPath, "utf8");
            const schema = JSON.parse(schemaContent);
            // Load and parse report data
            const reportContent = await fs.readFile(reportPath, "utf8");
            const reportData = await this.parseReportData(reportContent);
            // Compile schema validator
            const validate = this.ajv.compile(schema);
            // Validate
            const valid = validate(reportData);
            const errors = [];
            const warnings = [];
            if (!valid && validate.errors) {
                for (const error of validate.errors) {
                    const errorMsg = this.formatValidationError(error);
                    // Classify as error or warning based on severity
                    if (this.isWarningLevel(error)) {
                        warnings.push(errorMsg);
                    }
                    else {
                        errors.push(errorMsg);
                    }
                }
            }
            return {
                valid: valid && errors.length === 0,
                errors,
                warnings,
                schema,
                data: reportData,
            };
        }
        catch (error) {
            return {
                valid: false,
                errors: [`Validation failed: ${error}`],
                warnings: [],
            };
        }
    }
    async parseReportData(content) {
        // Try parsing as JSON first
        try {
            return JSON.parse(content);
        }
        catch {
            // If not JSON, extract from markdown
            return this.extractDataFromMarkdown(content);
        }
    }
    extractDataFromMarkdown(content) {
        // Look for JSON code blocks
        const jsonBlockRegex = /```json\s*\n([\s\S]*?)\n```/g;
        let match;
        while ((match = jsonBlockRegex.exec(content)) !== null) {
            try {
                const parsed = JSON.parse(match[1]);
                if (parsed.session_summary || parsed.baseline_summary) {
                    return parsed;
                }
            }
            catch {
                continue;
            }
        }
        // Fallback: construct from structured markdown patterns
        return this.extractFromMarkdownPatterns(content);
    }
    extractFromMarkdownPatterns(content) {
        const data = {};
        // Extract session summary
        data.session_summary = {
            session_id: this.extractValue(content, /session[_\s]*id[:\s]*([^\n\r]+)/i) ||
                "unknown",
            run_id: this.extractValue(content, /run[_\s]*id[:\s]*([^\n\r]+)/i) || "unknown",
            target: this.extractValue(content, /target[:\s]*([^\n\r]+)/i) || "unknown",
            profile: this.extractValue(content, /profile[:\s]*(\w+)/i) || "dev",
            mode: this.extractValue(content, /mode[:\s]*(\w+)/i) || "smoke",
            result: this.extractValue(content, /result[:\s]*([A-Z]+)/i) || "UNKNOWN",
            timestamp: this.extractValue(content, /timestamp[:\s]*([^\n\r]+)/i) ||
                new Date().toISOString(),
            cases_total: this.extractNumber(content, /cases[_\s]*total[:\s]*(\d+)/i) || 0,
            cost_usd: this.extractNumber(content, /cost[_\s]*usd[:\s]*\$?([0-9.]+)/i) || 0,
            duration_ms: this.extractNumber(content, /duration[_\s]*ms[:\s]*(\d+)/i) || 0,
        };
        // Extract baseline summary
        data.baseline_summary = {
            baseline_report_path: this.extractValue(content, /baseline[_\s]*report[_\s]*path[:\s]*([^\n\r]+)/i) || "",
            baseline_report_hash: this.extractValue(content, /baseline[_\s]*report[_\s]*hash[:\s]*([a-f0-9]+)/i) || "",
            sample_count: this.extractNumber(content, /sample[_\s]*count[:\s]*(\d+)/i) || 0,
            quality_score_summary: {
                overall_score: this.extractNumber(content, /overall[_\s]*score[:\s]*([0-9.]+)/i) ||
                    0,
                recommendation_level: this.extractValue(content, /recommendation[_\s]*level[:\s]*(\w+)/i) ||
                    "red",
                total_alerts: this.extractNumber(content, /total[_\s]*alerts[:\s]*(\d+)/i) || 0,
                metric_scores: {
                    duplication_rate: this.extractNumber(content, /duplication[_\s]*rate[:\s]*([0-9.]+)/i) || 0,
                    evidence_presence_rate: this.extractNumber(content, /evidence[_\s]*presence[_\s]*rate[:\s]*([0-9.]+)/i) || 0,
                    hallucination_rate: this.extractNumber(content, /hallucination[_\s]*rate[:\s]*([0-9.]+)/i) || 0,
                    pii_violations: this.extractNumber(content, /pii[_\s]*violations[:\s]*(\d+)/i) || 0,
                    coverage_score: this.extractNumber(content, /coverage[_\s]*score[:\s]*([0-9.]+)/i) || 0,
                },
            },
        };
        // Extract threshold validation if present
        const p0Violations = this.extractArray(content, /p0[_\s]*violations?[:\s]*\[([^\]]*)\]/i);
        const p1Warnings = this.extractArray(content, /p1[_\s]*warnings?[:\s]*\[([^\]]*)\]/i);
        const p2Issues = this.extractArray(content, /p2[_\s]*issues?[:\s]*\[([^\]]*)\]/i);
        if (p0Violations.length > 0 ||
            p1Warnings.length > 0 ||
            p2Issues.length > 0) {
            data.baseline_summary.threshold_validation = {
                enabled: true,
                gate_status: this.extractValue(content, /gate[_\s]*status[:\s]*([A-Z]+)/i) ||
                    "UNKNOWN",
                can_proceed: this.extractValue(content, /can[_\s]*proceed[:\s]*(true|false)/i) ===
                    "true",
                p0_violations: p0Violations,
                p1_warnings: p1Warnings,
                p2_issues: p2Issues,
            };
        }
        return data;
    }
    extractValue(content, regex) {
        const match = content.match(regex);
        return match ? match[1].trim() : null;
    }
    extractNumber(content, regex) {
        const match = content.match(regex);
        return match ? parseFloat(match[1]) : null;
    }
    extractArray(content, regex) {
        const match = content.match(regex);
        if (!match)
            return [];
        try {
            // Try to parse as JSON array
            return JSON.parse(`[${match[1]}]`);
        }
        catch {
            // Fallback: split by commas and clean up
            return match[1]
                .split(",")
                .map((item) => item.trim().replace(/^["']|["']$/g, ""))
                .filter((item) => item.length > 0);
        }
    }
    formatValidationError(error) {
        const path = error.instancePath || error.schemaPath || "root";
        const message = error.message || "validation failed";
        if (error.data !== undefined) {
            return `${path}: ${message} (got: ${JSON.stringify(error.data)})`;
        }
        return `${path}: ${message}`;
    }
    isWarningLevel(error) {
        // Classify certain validation errors as warnings rather than errors
        const warningKeywords = ["additionalProperties", "format", "pattern"];
        return warningKeywords.some((keyword) => error.keyword === keyword || error.message?.includes(keyword));
    }
    async validateWithBuiltinSchema(reportPath, schemaType) {
        // Use built-in schemas
        const schemaPath = `schema/${schemaType}.schema.json`;
        return this.validateReport(reportPath, schemaPath);
    }
    async validateBatch(reportPaths, schemaPath) {
        const results = [];
        for (const reportPath of reportPaths) {
            try {
                const result = await this.validateReport(reportPath, schemaPath);
                results.push({ path: reportPath, result });
            }
            catch (error) {
                results.push({
                    path: reportPath,
                    result: {
                        valid: false,
                        errors: [`Failed to validate ${reportPath}: ${error}`],
                        warnings: [],
                    },
                });
            }
        }
        return results;
    }
    generateValidationSummary(results) {
        const summary = {
            total: results.length,
            valid: 0,
            invalid: 0,
            warnings: 0,
            details: [],
        };
        for (const { path, result } of results) {
            const detail = {
                path,
                status: result.valid ? "valid" : "invalid",
                errorCount: result.errors.length,
                warningCount: result.warnings.length,
            };
            if (result.valid) {
                summary.valid++;
                if (result.warnings.length > 0) {
                    detail.status = "warnings";
                    summary.warnings++;
                }
            }
            else {
                summary.invalid++;
            }
            summary.details.push(detail);
        }
        return summary;
    }
}
//# sourceMappingURL=session_report_validator.js.map