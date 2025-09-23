#!/usr/bin/env tsx
/**
 * Script to automatically fix common ESLint issues
 * Focuses on systematic fixes for unused variables and imports
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { glob } from 'glob';

const execAsync = promisify(exec);

interface ESLintMessage {
  ruleId: string;
  severity: number;
  message: string;
  line: number;
  column: number;
  nodeType: string;
  messageId?: string;
  endLine?: number;
  endColumn?: number;
}

interface ESLintResult {
  filePath: string;
  messages: ESLintMessage[];
  errorCount: number;
  warningCount: number;
  fixableErrorCount: number;
  fixableWarningCount: number;
}

async function runESLintJSON(): Promise<ESLintResult[]> {
  try {
    const { stdout } = await execAsync('npx eslint src/**/*.ts --format json');
    return JSON.parse(stdout);
  } catch (error: any) {
    // ESLint returns non-zero exit code for warnings, but still outputs JSON
    if (error.stdout) {
      try {
        return JSON.parse(error.stdout);
      } catch {
        console.error('Failed to parse ESLint output:', error.stdout);
        return [];
      }
    }
    console.error('ESLint failed:', error.message);
    return [];
  }
}

function fixUnusedVariables(filePath: string, content: string): string {
  let fixed = content;

  // Fix unused function parameters by adding underscore
  // Match function parameters that should be prefixed with _
  const patterns = [
    // Function parameters
    /(\w+)\s*:\s*[^,)]+(?=\s*[,)])/g,
    // Arrow function parameters
    /(\w+)\s*:\s*[^,)=]+(?=\s*[,)=])/g,
  ];

  // This is a simplified approach - in a real implementation,
  // we'd need to parse the AST to accurately identify unused parameters

  return fixed;
}

function addUnderscoreToUnusedVars(filePath: string): void {
  if (!existsSync(filePath)) return;

  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  // Simple regex-based approach for common unused parameter patterns
  // This is not perfect but handles most cases
  let modified = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Match function parameters that are reported as unused
    // Look for patterns like: functionName(param: Type, ...
    const paramPattern = /(\w+)\s*:\s*([^,)]+)(?=\s*[,)])/g;
    const matches = Array.from(line.matchAll(paramPattern));

    for (const match of matches) {
      const paramName = match[1];
      if (!paramName.startsWith('_')) {
        // Only add underscore if this param appears to be unused
        // This is a heuristic - check if the parameter name doesn't appear elsewhere in the function
        const functionBlock = lines.slice(Math.max(0, i - 5), Math.min(lines.length, i + 20)).join('\n');
        const usagePattern = new RegExp(`\\b${paramName}\\b`, 'g');
        const usageCount = (functionBlock.match(usagePattern) || []).length;

        // If parameter only appears once (in the parameter list), it's likely unused
        if (usageCount <= 1) {
          line = line.replace(match[0], `_${paramName}: ${match[2]}`);
          modified = true;
        }
      }
    }

    lines[i] = line;
  }

  if (modified) {
    writeFileSync(filePath, lines.join('\n'));
    console.log(`✅ Fixed unused parameters in ${filePath}`);
  }
}

function removeUnusedImports(filePath: string): void {
  if (!existsSync(filePath)) return;

  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  let modified = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match import statements
    const importMatch = line.match(/^import\s*{\s*([^}]+)\s*}\s*from\s*['"]([^'"]+)['"];?/);
    if (importMatch) {
      const importedItems = importMatch[1].split(',').map(item => item.trim());
      const modulePath = importMatch[2];
      const restOfFile = lines.slice(i + 1).join('\n');

      // Filter out unused imports
      const usedItems = importedItems.filter(item => {
        const itemName = item.replace(/\s+as\s+\w+$/, '').trim();
        const usagePattern = new RegExp(`\\b${itemName}\\b`);
        return usagePattern.test(restOfFile);
      });

      if (usedItems.length !== importedItems.length) {
        if (usedItems.length === 0) {
          // Remove entire import line
          lines[i] = '';
        } else {
          // Update import with only used items
          lines[i] = `import { ${usedItems.join(', ')} } from '${modulePath}';`;
        }
        modified = true;
      }
    }
  }

  if (modified) {
    // Remove empty lines at the beginning (from removed imports)
    while (lines.length > 0 && lines[0].trim() === '') {
      lines.shift();
    }

    writeFileSync(filePath, lines.join('\n'));
    console.log(`✅ Removed unused imports from ${filePath}`);
  }
}

async function fixAllFiles(): Promise<void> {
  console.log('🔍 Finding TypeScript files...');
  const files = await glob('src/**/*.ts');

  console.log(`📝 Processing ${files.length} files...`);

  for (const file of files) {
    console.log(`Processing ${file}...`);
    addUnderscoreToUnusedVars(file);
    removeUnusedImports(file);
  }

  console.log('✅ Finished processing all files');
}

async function main(): Promise<void> {
  console.log('🚀 Starting ESLint issue fix...');

  try {
    console.log('1. Running ESLint to identify issues...');
    const results = await runESLintJSON();

    const totalWarnings = results.reduce((sum, result) => sum + result.warningCount, 0);
    const totalErrors = results.reduce((sum, result) => sum + result.errorCount, 0);

    console.log(`📊 Found ${totalErrors} errors and ${totalWarnings} warnings`);

    console.log('2. Fixing common issues...');
    await fixAllFiles();

    console.log('3. Running auto-fix...');
    try {
      await execAsync('npm run lint:fix');
      console.log('✅ Auto-fix completed');
    } catch (error) {
      console.log('⚠️ Auto-fix completed with some remaining issues');
    }

    console.log('4. Checking final state...');
    const finalResults = await runESLintJSON();
    const finalWarnings = finalResults.reduce((sum, result) => sum + result.warningCount, 0);
    const finalErrors = finalResults.reduce((sum, result) => sum + result.errorCount, 0);

    console.log(`📊 Final state: ${finalErrors} errors and ${finalWarnings} warnings`);
    console.log(`🎉 Reduced warnings by ${totalWarnings - finalWarnings}`);

  } catch (error) {
    console.error('❌ Error during fix process:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}