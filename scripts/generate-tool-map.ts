#!/usr/bin/env tsx

/**
 * Tool Relationship Map Generator
 *
 * Purpose:
 * - Map commands → engines → files → policies
 * - Provide system visibility and understanding
 * - Enable impact analysis for changes
 *
 * Output: reports/governance/tool-map.json
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { glob } from "glob";
import { extractToolMetadata } from "./lib/governance/tool-mode.js";

interface ToolMap {
  generated: string;
  metadata: {
    totalCommands: number;
    totalEngines: number;
    analyzeEngines: number;
    transformEngines: number;
  };
  commands: Record<
    string,
    {
      script: string;
      engine?: string;
      mode?: "analyze" | "transform";
      description?: string;
    }
  >;
  engines: Record<
    string,
    {
      path: string;
      mode: "analyze" | "transform" | "unknown";
      description: string;
      requiresGovernance: boolean;
      usedByCommands: string[];
    }
  >;
  policies: {
    toolModePolicy: {
      analyze: string[];
      transform: string[];
    };
    riskDomains: Array<{
      path: string;
      reason: string;
      severity: string;
    }>;
  };
}

class ToolMapGenerator {
  private projectRoot: string;

  constructor() {
    this.projectRoot = process.cwd();
  }

  async generate(): Promise<void> {
    console.log("🗺️  Generating Tool Relationship Map\n");

    const map: ToolMap = {
      generated: new Date().toISOString(),
      metadata: {
        totalCommands: 0,
        totalEngines: 0,
        analyzeEngines: 0,
        transformEngines: 0,
      },
      commands: {},
      engines: {},
      policies: {
        toolModePolicy: {
          analyze: [],
          transform: [],
        },
        riskDomains: [],
      },
    };

    // 1. Extract commands from package.json
    console.log("📦 Extracting commands from package.json...");
    this.extractCommands(map);

    // 2. Scan all engines
    console.log("🔍 Scanning engines...");
    await this.scanEngines(map);

    // 3. Load governance policies
    console.log("⚖️  Loading governance policies...");
    this.loadPolicies(map);

    // 4. Link commands to engines
    console.log("🔗 Linking commands to engines...");
    this.linkCommandsToEngines(map);

    // 5. Save map
    const outputPath = join(
      this.projectRoot,
      "reports",
      "governance",
      "tool-map.json",
    );
    writeFileSync(outputPath, JSON.stringify(map, null, 2), "utf8");

    console.log(`\n✅ Tool map generated: ${outputPath}`);
    console.log(`\n📊 Summary:`);
    console.log(`   Commands: ${map.metadata.totalCommands}`);
    console.log(`   Engines: ${map.metadata.totalEngines}`);
    console.log(`   - Analyze: ${map.metadata.analyzeEngines}`);
    console.log(`   - Transform: ${map.metadata.transformEngines}`);
  }

  private extractCommands(map: ToolMap): void {
    const packagePath = join(this.projectRoot, "package.json");
    const pkg = JSON.parse(readFileSync(packagePath, "utf8"));

    for (const [name, script] of Object.entries(pkg.scripts || {})) {
      map.commands[name] = {
        script: script as string,
      };
      map.metadata.totalCommands++;
    }
  }

  private async scanEngines(map: ToolMap): Promise<void> {
    const patterns = ["scripts/*-engine.ts", "scripts/**/*-engine.ts"];
    const files: string[] = [];

    for (const pattern of patterns) {
      const matches = glob.sync(pattern, {
        cwd: this.projectRoot,
        ignore: ["**/node_modules/**", "**/dist/**"],
      });
      files.push(...matches);
    }

    for (const file of files) {
      const fullPath = join(this.projectRoot, file);
      const content = readFileSync(fullPath, "utf8");
      const filename = file.split("/").pop() || "";
      const engineName = filename.replace(".ts", "");

      const metadata = extractToolMetadata(filename, content);

      map.engines[engineName] = {
        path: file,
        mode: metadata?.mode || "unknown",
        description: metadata?.description || "No description",
        requiresGovernance: metadata?.requiresGovernance || false,
        usedByCommands: [],
      };

      map.metadata.totalEngines++;
      if (metadata?.mode === "analyze") {
        map.metadata.analyzeEngines++;
        map.policies.toolModePolicy.analyze.push(engineName);
      } else if (metadata?.mode === "transform") {
        map.metadata.transformEngines++;
        map.policies.toolModePolicy.transform.push(engineName);
      }
    }
  }

  private loadPolicies(map: ToolMap): void {
    const rulesPath = join(this.projectRoot, "governance-rules.json");
    if (!existsSync(rulesPath)) return;

    const rules = JSON.parse(readFileSync(rulesPath, "utf8"));

    // Extract risk domains
    if (rules.riskDomains) {
      map.policies.riskDomains = rules.riskDomains.map(
        (d: { path: string; reason: string; severity: string }) => ({
          path: d.path,
          reason: d.reason,
          severity: d.severity,
        }),
      );
    }
  }

  private linkCommandsToEngines(map: ToolMap): void {
    // Link commands to engines based on script content
    for (const [cmdName, cmdData] of Object.entries(map.commands)) {
      const script = cmdData.script;

      // Find engine reference in script
      for (const [engineName, engineData] of Object.entries(map.engines)) {
        if (script.includes(engineName) || script.includes(engineData.path)) {
          cmdData.engine = engineName;
          cmdData.mode =
            engineData.mode !== "unknown" ? engineData.mode : undefined;
          cmdData.description = engineData.description;
          engineData.usedByCommands.push(cmdName);
          break;
        }
      }
    }
  }
}

// Main
const generator = new ToolMapGenerator();
await generator.generate();
