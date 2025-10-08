#!/usr/bin/env tsx
/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 *
 * Fix Shebang Order - Move shebang to first line
 *
 * Purpose:
 * - Move #!/usr/bin/env shebang to line 1
 * - Keep SPDX header after shebang
 * - Fix TypeScript compilation errors
 *
 * Usage:
 *   npm run shebang:fix
 */

import { readdirSync, readFileSync, writeFileSync, statSync } from "fs";
import { join } from "path";

let fixedCount = 0;

/**
 * Fix shebang order in file
 */
function fixShebangOrder(filePath: string, relativePath: string): boolean {
  try {
    const content = readFileSync(filePath, "utf8");
    const lines = content.split("\n");

    // Find SPDX header block
    let spdxStart = -1;
    let spdxEnd = -1;
    let shebangLine = -1;

    for (let i = 0; i < Math.min(lines.length, 20); i++) {
      const line = lines[i];

      // Find shebang
      if (line.startsWith("#!/usr/bin/env") || line.startsWith("#!")) {
        shebangLine = i;
      }

      // Find SPDX block
      if (line.includes("SPDX-License-Identifier")) {
        // Search backward for /**
        for (let j = i; j >= 0; j--) {
          if (lines[j].trim() === "/**") {
            spdxStart = j;
            break;
          }
        }

        // Search forward for */
        for (let j = i; j < lines.length; j++) {
          if (lines[j].trim() === "*/") {
            spdxEnd = j;
            break;
          }
        }

        break;
      }
    }

    // If shebang exists and is NOT on line 0, and SPDX is before it
    if (shebangLine > 0 && spdxStart >= 0 && spdxStart < shebangLine) {
      console.log(`   🔧 Fixing: ${relativePath}`);

      // Extract parts
      const spdxBlock = lines.slice(spdxStart, spdxEnd + 1);
      const shebang = lines[shebangLine];

      // Remove SPDX block and shebang from original position
      const remaining = lines.filter((_, i) =>
        i < spdxStart || (i > spdxEnd && i !== shebangLine)
      );

      // Reconstruct: shebang + SPDX + rest
      const newLines = [
        shebang,
        ...spdxBlock,
        "",
        ...remaining.slice(0).filter(l => l.trim() !== "")
      ];

      // Write back
      writeFileSync(filePath, newLines.join("\n") + "\n", "utf8");
      fixedCount++;

      return true;
    }

    return false;
  } catch (error) {
    console.error(`   ❌ Error fixing ${relativePath}:`, error);

    return false;
  }
}

/**
 * Scan directory recursively
 */
function scanDirectory(dir: string, baseDir: string = dir) {
  try {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const relativePath = fullPath.replace(baseDir + "/", "");

      // Skip node_modules, .git, etc
      if (entry === "node_modules" || entry === ".git" || entry === "dist") {
        continue;
      }

      try {
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
          scanDirectory(fullPath, baseDir);
        } else if (stat.isFile()) {
          if (fullPath.endsWith(".ts") || fullPath.endsWith(".tsx")) {
            fixShebangOrder(fullPath, relativePath);
          }
        }
      } catch (error) {
        // Skip if permission denied
        continue;
      }
    }
  } catch (error) {
    console.error(`Cannot scan directory: ${dir}`, error);
  }
}

/**
 * Main execution
 */
function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║        Fix Shebang Order - TypeScript Compliance          ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  console.log("🔍 Scanning files for shebang issues...\n");

  const projectRoot = process.cwd();
  const srcDir = join(projectRoot, "src");
  const scriptsDir = join(projectRoot, "scripts");

  scanDirectory(srcDir, srcDir);
  scanDirectory(scriptsDir, scriptsDir);

  console.log("\n" + "=".repeat(60));
  console.log("📊 Summary");
  console.log("=".repeat(60));
  console.log(`Files fixed: ${fixedCount}`);

  if (fixedCount > 0) {
    console.log("\n✅ Shebang order fixed successfully");
    console.log("   Run 'npm run typecheck' to verify\n");
  } else {
    console.log("\n✅ No shebang issues found\n");
  }
}

main();
