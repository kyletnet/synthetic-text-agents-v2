#!/usr/bin/env tsx
/**
 * Command Optimizer - 중복/불필요한 명령어 정리 및 통합
 */

import { promises as fs } from 'fs';
import { join } from 'path';

interface CommandAnalysis {
  name: string;
  command: string;
  category: 'core' | 'duplicate' | 'deprecated' | 'specialized' | 'unknown';
  usage: 'daily' | 'weekly' | 'rare' | 'never';
  recommendation: 'keep' | 'merge' | 'deprecate' | 'remove';
  mergeWith?: string;
  reason: string;
}

class CommandOptimizer {
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  async analyzeCommands(): Promise<void> {
    console.log('🎛️ Analyzing npm scripts for optimization...');

    const packageJson = JSON.parse(
      await fs.readFile(join(this.projectRoot, 'package.json'), 'utf-8')
    );

    const scripts = packageJson.scripts || {};
    const analysis: CommandAnalysis[] = [];

    for (const [name, command] of Object.entries(scripts)) {
      analysis.push(this.categorizeCommand(name, command as string));
    }

    await this.generateOptimizationReport(analysis);
    await this.generateCleanPackageJson(analysis, packageJson);
  }

  private categorizeCommand(name: string, command: string): CommandAnalysis {
    // 핵심 명령어들
    const coreCommands = [
      'build', 'dev', 'test', 'lint', 'typecheck',
      'ci:quality', 'ci:strict', 'refactor:audit', 'docs:audit',
      'docs:gate', 'ship', 'ts:check'
    ];

    // 중복 명령어 매핑
    const duplicates: Record<string, string> = {
      'demo': 'dev',
      'start:cli': 'dev',
      'dev:demo': 'dev',
      'docs:coverage': 'docs:audit',
      'docs:freshness': 'docs:audit',
      'baseline:tsnode': 'dev',
      'build:export': 'build'
    };

    // Deprecated 명령어들
    const deprecated = [
      'replit:start', 'replit:install', 'safe:show', 'safe:dryrun',
      'eval:mini', 'demo:cit', 'route:seed'
    ];

    let category: CommandAnalysis['category'] = 'unknown';
    let usage: CommandAnalysis['usage'] = 'rare';
    let recommendation: CommandAnalysis['recommendation'] = 'keep';
    let mergeWith: string | undefined;
    let reason = '';

    if (coreCommands.includes(name)) {
      category = 'core';
      usage = name.includes('ci:') || ['build', 'dev', 'test'].includes(name) ? 'daily' : 'weekly';
      reason = 'Essential command for development workflow';
    } else if (duplicates[name]) {
      category = 'duplicate';
      usage = 'never';
      recommendation = 'merge';
      mergeWith = duplicates[name];
      reason = `Duplicate of ${duplicates[name]}`;
    } else if (deprecated.includes(name)) {
      category = 'deprecated';
      usage = 'never';
      recommendation = 'remove';
      reason = 'Legacy command no longer needed';
    } else if (name.includes('refactor:') || name.includes('docs:') || name.includes('verify:')) {
      category = 'specialized';
      usage = 'weekly';
      reason = 'Specialized workflow command';
    } else if (name.includes(':') && (name.includes('baseline') || name.includes('report'))) {
      category = 'specialized';
      usage = 'rare';
      reason = 'Advanced/debugging command';
    }

    return {
      name,
      command,
      category,
      usage,
      recommendation,
      mergeWith,
      reason
    };
  }

  private async generateOptimizationReport(analysis: CommandAnalysis[]): Promise<void> {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: analysis.length,
        core: analysis.filter(a => a.category === 'core').length,
        duplicates: analysis.filter(a => a.category === 'duplicate').length,
        deprecated: analysis.filter(a => a.category === 'deprecated').length,
        canRemove: analysis.filter(a => a.recommendation === 'remove').length,
        canMerge: analysis.filter(a => a.recommendation === 'merge').length
      },
      recommendations: {
        keep: analysis.filter(a => a.recommendation === 'keep'),
        merge: analysis.filter(a => a.recommendation === 'merge'),
        remove: analysis.filter(a => a.recommendation === 'remove'),
        deprecate: analysis.filter(a => a.recommendation === 'deprecate')
      },
      analysis
    };

    await fs.writeFile(
      join(this.projectRoot, 'reports/command-optimization.json'),
      JSON.stringify(report, null, 2)
    );

    console.log('\\n🎛️ Command Optimization Report');
    console.log('===============================');
    console.log(`📊 Total commands: ${report.summary.total}`);
    console.log(`✅ Core commands: ${report.summary.core}`);
    console.log(`🔄 Duplicates: ${report.summary.duplicates}`);
    console.log(`❌ Deprecated: ${report.summary.deprecated}`);
    console.log(`🗑️  Can remove: ${report.summary.canRemove}`);
    console.log(`🔀 Can merge: ${report.summary.canMerge}`);

    if (report.recommendations.remove.length > 0) {
      console.log('\\n❌ Recommended for removal:');
      report.recommendations.remove.forEach(cmd => {
        console.log(`   - ${cmd.name}: ${cmd.reason}`);
      });
    }

    if (report.recommendations.merge.length > 0) {
      console.log('\\n🔀 Recommended for merging:');
      report.recommendations.merge.forEach(cmd => {
        console.log(`   - ${cmd.name} → ${cmd.mergeWith}: ${cmd.reason}`);
      });
    }

    console.log('\\n💡 Optimization potential:');
    const reduction = report.summary.canRemove + report.summary.canMerge;
    const newTotal = report.summary.total - reduction;
    console.log(`   Current: ${report.summary.total} commands`);
    console.log(`   After optimization: ${newTotal} commands (-${reduction})`);
    console.log(`   Reduction: ${((reduction / report.summary.total) * 100).toFixed(1)}%`);
  }

  private async generateCleanPackageJson(analysis: CommandAnalysis[], originalPackageJson: any): Promise<void> {
    const cleanScripts: Record<string, string> = {};

    // Core commands 유지
    const keepCommands = analysis.filter(a =>
      a.recommendation === 'keep' || a.category === 'core'
    );

    for (const cmd of keepCommands) {
      cleanScripts[cmd.name] = cmd.command;
    }

    // Merge 대상들을 alias로 처리
    const mergeCommands = analysis.filter(a => a.recommendation === 'merge');
    for (const cmd of mergeCommands) {
      if (cmd.mergeWith && cleanScripts[cmd.mergeWith]) {
        // Alias로 유지 (주석과 함께)
        cleanScripts[`${cmd.name}:deprecated`] = `echo "⚠️  ${cmd.name} is deprecated. Use '${cmd.mergeWith}' instead." && npm run ${cmd.mergeWith}`;
      }
    }

    const cleanPackageJson = {
      ...originalPackageJson,
      scripts: {
        // 핵심 명령어들을 카테고리별로 정렬
        ...this.groupScripts(cleanScripts, 'Core Development', [
          'build', 'dev', 'test', 'typecheck', 'lint', 'lint:fix'
        ]),

        ...this.groupScripts(cleanScripts, 'Quality & CI', [
          'ci:quality', 'ci:strict', 'refactor:audit', 'refactor:summary', 'ts:check'
        ]),

        ...this.groupScripts(cleanScripts, 'Documentation', [
          'docs:audit', 'docs:gate', 'docs:lint', 'docs:refresh', 'docs:signals:inject'
        ]),

        ...this.groupScripts(cleanScripts, 'Deployment', [
          'ship', 'ship:fast', 'guard:all', 'verify:obs'
        ]),

        // 나머지 specialized commands
        ...Object.fromEntries(
          Object.entries(cleanScripts).filter(([name]) =>
            !['build', 'dev', 'test', 'typecheck', 'lint', 'lint:fix',
              'ci:quality', 'ci:strict', 'refactor:audit', 'refactor:summary', 'ts:check',
              'docs:audit', 'docs:gate', 'docs:lint', 'docs:refresh', 'docs:signals:inject',
              'ship', 'ship:fast', 'guard:all', 'verify:obs'].includes(name)
          )
        )
      }
    };

    await fs.writeFile(
      join(this.projectRoot, 'package.clean.json'),
      JSON.stringify(cleanPackageJson, null, 2)
    );

    console.log('\\n📦 Generated optimized package.json → package.clean.json');
    console.log('   Review and replace package.json if satisfied');
  }

  private groupScripts(scripts: Record<string, string>, category: string, commandNames: string[]): Record<string, string> {
    const grouped: Record<string, string> = {};

    // 카테고리 주석 추가
    if (commandNames.some(name => scripts[name])) {
      grouped[`// === ${category} ===`] = `echo "${category} commands"`;
    }

    for (const name of commandNames) {
      if (scripts[name]) {
        grouped[name] = scripts[name];
      }
    }

    return grouped;
  }
}

// CLI 실행
async function main() {
  const projectRoot = process.cwd();
  const optimizer = new CommandOptimizer(projectRoot);
  await optimizer.analyzeCommands();
}

// ES module main check
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}