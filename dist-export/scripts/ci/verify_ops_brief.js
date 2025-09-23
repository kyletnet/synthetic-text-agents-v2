import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
/**
 * Verifies the operations brief exists and has required structure
 */
export class OpsBriefVerifier {
    opsBriefPath;
    requiredHeadings = [
        "1. Terminology Canonical Map",
        "2. Run Modes & Commands",
        "3. Required Artifacts Matrix",
        "4. Paths Index",
        "5. Preflight Gates",
        "6. Update Rules",
    ];
    constructor(rootPath = ".") {
        this.opsBriefPath = path.join(rootPath, "docs", "OPS_BRIEF.md");
    }
    /**
     * Performs comprehensive validation of the ops brief
     */
    verify() {
        const result = {
            exists: false,
            hasRequiredHeadings: false,
            missingHeadings: [],
            hasCurrentCommit: false,
            commitMatch: false,
            currentCommit: undefined,
            documentCommit: undefined,
            warnings: [],
            errors: [],
        };
        // Check if file exists
        if (!fs.existsSync(this.opsBriefPath)) {
            result.errors.push(`Operations brief not found at: ${this.opsBriefPath}`);
            return result;
        }
        result.exists = true;
        // Read file content
        let content;
        try {
            content = fs.readFileSync(this.opsBriefPath, "utf-8");
        }
        catch (error) {
            result.errors.push(`Failed to read operations brief: ${error}`);
            return result;
        }
        // Check required headings
        const { hasAllHeadings, missingHeadings } = this.validateHeadings(content);
        result.hasRequiredHeadings = hasAllHeadings;
        result.missingHeadings = missingHeadings;
        if (!hasAllHeadings) {
            result.errors.push(`Missing required headings: ${missingHeadings.join(", ")}`);
        }
        // Check commit synchronization
        const commitValidation = this.validateCommitSync(content);
        result.hasCurrentCommit = commitValidation.hasCurrentCommit;
        result.commitMatch = commitValidation.commitMatch;
        result.currentCommit = commitValidation.currentCommit;
        result.documentCommit = commitValidation.documentCommit;
        if (!commitValidation.hasCurrentCommit) {
            result.warnings.push('No "Last synced commit" found in document');
        }
        else if (!commitValidation.commitMatch) {
            result.warnings.push(`Commit mismatch: document shows ${commitValidation.documentCommit}, ` +
                `current is ${commitValidation.currentCommit}`);
        }
        // Additional structure validation
        this.validateStructure(content, result);
        return result;
    }
    /**
     * Validates that all required headings are present
     */
    validateHeadings(content) {
        const missingHeadings = [];
        for (const heading of this.requiredHeadings) {
            // Look for heading patterns like "## 1. Terminology Canonical Map"
            const headingRegex = new RegExp(`^#+\\s*${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "m");
            if (!headingRegex.test(content)) {
                missingHeadings.push(heading);
            }
        }
        return {
            hasAllHeadings: missingHeadings.length === 0,
            missingHeadings,
        };
    }
    /**
     * Validates commit synchronization
     */
    validateCommitSync(content) {
        // Extract commit from document
        const commitMatch = content.match(/\*\*Last synced commit:\*\*\s*([a-f0-9]+)/);
        const documentCommit = commitMatch ? commitMatch[1] : undefined;
        if (!documentCommit) {
            return {
                hasCurrentCommit: false,
                commitMatch: false,
                currentCommit: undefined,
                documentCommit: undefined,
            };
        }
        // Get current git commit
        let currentCommit;
        try {
            currentCommit = execSync("git rev-parse HEAD", {
                encoding: "utf-8",
            }).trim();
        }
        catch (error) {
            return {
                hasCurrentCommit: true,
                commitMatch: false,
                documentCommit,
                currentCommit: "unknown",
            };
        }
        return {
            hasCurrentCommit: true,
            commitMatch: documentCommit === currentCommit,
            currentCommit,
            documentCommit,
        };
    }
    /**
     * Additional structure validation
     */
    validateStructure(content, result) {
        // Check for owner information
        if (!content.includes("**Owner:**")) {
            result.warnings.push("No owner information found");
        }
        // Check for last reviewed date
        if (!content.includes("**Last reviewed date:**")) {
            result.warnings.push("No last reviewed date found");
        }
        // Check for terminology enforcement note
        if (!content.includes("Import from `scripts/metrics/taxonomy.ts`")) {
            result.warnings.push("Missing taxonomy enforcement reference");
        }
        // Check for basic command examples
        const hasCommands = content.includes("bash run_v3.sh") || content.includes("npm run");
        if (!hasCommands) {
            result.warnings.push("No command examples found in Run Modes section");
        }
    }
    /**
     * Formats validation results for console output
     */
    formatResults(result) {
        const lines = [];
        lines.push("=== Operations Brief Verification ===");
        lines.push("");
        if (!result.exists) {
            lines.push("❌ FAILED: Operations brief does not exist");
            lines.push("");
            lines.push("Errors:");
            result.errors.forEach((error) => lines.push(`  - ${error}`));
            return lines.join("\n");
        }
        // Overall status
        const hasErrors = result.errors.length > 0;
        const status = hasErrors ? "❌ FAILED" : "✅ PASSED";
        lines.push(`Status: ${status}`);
        lines.push("");
        // Detailed checks
        lines.push("Checks:");
        lines.push(`  File exists: ✅`);
        lines.push(`  Required headings: ${result.hasRequiredHeadings ? "✅" : "❌"}`);
        lines.push(`  Commit sync: ${result.commitMatch ? "✅" : "⚠️"}`);
        lines.push("");
        // Errors
        if (result.errors.length > 0) {
            lines.push("Errors:");
            result.errors.forEach((error) => lines.push(`  - ${error}`));
            lines.push("");
        }
        // Warnings
        if (result.warnings.length > 0) {
            lines.push("Warnings:");
            result.warnings.forEach((warning) => lines.push(`  - ${warning}`));
            lines.push("");
        }
        // Commit info
        if (result.hasCurrentCommit) {
            lines.push("Commit Information:");
            lines.push(`  Document: ${result.documentCommit}`);
            lines.push(`  Current:  ${result.currentCommit}`);
            lines.push(`  Match: ${result.commitMatch ? "Yes" : "No"}`);
        }
        return lines.join("\n");
    }
}
// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
    const verifier = new OpsBriefVerifier();
    const result = verifier.verify();
    console.log(verifier.formatResults(result));
    // Exit with error code if verification failed
    const hasErrors = result.errors.length > 0;
    process.exit(hasErrors ? 1 : 0);
}
//# sourceMappingURL=verify_ops_brief.js.map