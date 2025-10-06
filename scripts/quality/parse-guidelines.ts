#!/usr/bin/env node
/**
 * Guideline Parser CLI
 *
 * 가이드라인을 파싱하고 캐시를 생성합니다.
 *
 * Usage:
 *   npm run quality:parse-guidelines
 *   npm run quality:parse-guidelines -- --force
 */

import {
  getActiveGuideline,
  GuidelineParser,
} from "./parsers/guideline-parser.js";
import { readFileSync } from "fs";
import { join } from "path";

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");

  console.log("🔍 Guideline Parser v1.0.0");
  console.log("════════════════════════════════════════════════════════════\n");

  try {
    const projectRoot = process.cwd();

    // versions.json 읽기
    const versionsPath = join(projectRoot, "docs/guidelines/versions.json");
    const versions = JSON.parse(readFileSync(versionsPath, "utf-8"));
    const activeVersion = versions.active;

    console.log(`📋 Active Version: ${activeVersion}`);
    console.log(`📁 Source: docs/guidelines/qa-generation-guidelines.md\n`);

    const parser = new GuidelineParser(projectRoot);

    // 강제 파싱 또는 캐시 확인
    if (force) {
      console.log("⚡ Force parsing enabled (--force)\n");
    } else {
      const isValid = await parser.isCacheValid(activeVersion);
      if (isValid) {
        console.log("✅ Cache is valid. Use --force to reparse.\n");
        const cached = await parser.loadFromCache(activeVersion);
        if (cached) {
          displaySummary(cached);
          process.exit(0);
        }
      }
    }

    // 파싱 실행
    console.log("🔄 Parsing guideline...\n");
    const parsed = await getActiveGuideline(projectRoot);

    // 결과 출력
    displaySummary(parsed);

    console.log(
      "\n════════════════════════════════════════════════════════════",
    );
    console.log("✅ PARSING COMPLETE");
    console.log("════════════════════════════════════════════════════════════");
  } catch (error) {
    console.error(
      "\n❌ Error:",
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  }
}

function displaySummary(parsed: any) {
  console.log("📊 Parsing Summary");
  console.log("────────────────────────────────────────────────────────────");
  console.log(`   Version: ${parsed.version}`);
  console.log(`   Generated: ${new Date(parsed.generatedAt).toLocaleString()}`);
  console.log(`   Hash: ${parsed.sourceHash.substring(0, 16)}...`);
  console.log();

  console.log("📋 Question Types");
  console.log("────────────────────────────────────────────────────────────");
  parsed.questionTypes.forEach((type: any, idx: number) => {
    console.log(`   ${idx + 1}. ${type.name} (난이도: ${type.difficulty})`);
    console.log(`      Patterns: ${type.patterns.length}`);
    console.log(`      Examples: ${type.examples.length}`);
  });
  console.log();

  console.log("🔢 Number Format Rules");
  console.log("────────────────────────────────────────────────────────────");
  parsed.numberFormatRules.forEach((rule: any) => {
    console.log(`   ${rule.type}: ${rule.format}`);
    console.log(`      Examples: ${rule.examples.join(", ")}`);
  });
  console.log();

  console.log("🚫 Prohibited Patterns");
  console.log("────────────────────────────────────────────────────────────");
  console.log(`   Total: ${parsed.prohibitedPatterns.length} patterns`);
  parsed.prohibitedPatterns.slice(0, 5).forEach((pattern: string) => {
    console.log(`   • ${pattern}`);
  });
  if (parsed.prohibitedPatterns.length > 5) {
    console.log(`   ... and ${parsed.prohibitedPatterns.length - 5} more`);
  }
  console.log();

  console.log("📐 Answer Structure Rules");
  console.log("────────────────────────────────────────────────────────────");
  parsed.answerStructureRules.forEach((rule: any) => {
    console.log(`   Pattern ${rule.pattern}: ${rule.description}`);
  });
  console.log();

  console.log("📈 Metadata");
  console.log("────────────────────────────────────────────────────────────");
  console.log(`   Total Question Types: ${parsed.metadata.totalQuestionTypes}`);
  console.log(`   Total Rules: ${parsed.metadata.totalRules}`);
}

main();
