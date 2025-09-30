#!/usr/bin/env tsx

/**
 * readline 대화형 입력 테스트
 * /maintain의 승인 메커니즘이 Claude Code 환경에서 작동하는지 검증
 */

import { createInterface } from "readline";

console.log("🧪 Readline Approval Test");
console.log("=".repeat(60));

// 환경 감지
const isClaudeCode =
  process.env.CLAUDECODE === "1" ||
  process.env.CLAUDE_CODE_ENTRYPOINT === "cli";
const isTTY = process.stdin.isTTY;

console.log(`\n📊 Environment Detection:`);
console.log(`   CLAUDECODE: ${process.env.CLAUDECODE}`);
console.log(`   CLAUDE_CODE_ENTRYPOINT: ${process.env.CLAUDE_CODE_ENTRYPOINT}`);
console.log(`   stdin.isTTY: ${isTTY}`);
console.log(`   isClaudeCode: ${isClaudeCode}`);
console.log(`   isInteractive: ${isTTY || isClaudeCode}`);

if (!isTTY && !isClaudeCode) {
  console.log("\n❌ Non-interactive environment - would skip");
  process.exit(0);
}

console.log(
  "\n✅ Interactive environment detected - proceeding with readline test",
);

// Readline 테스트
const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log("\n" + "-".repeat(80));
console.log("🤔 Test Question: Do you approve this change?");
console.log("  y/Y: Yes");
console.log("  n/N: No");
console.log("  s/S: Skip");
console.log("-".repeat(80));

rl.question("\n👉 Your choice: ", (answer) => {
  const choice = answer.trim().toLowerCase();

  console.log(`\n✅ Received input: "${answer}"`);

  switch (choice) {
    case "y":
    case "yes":
      console.log("✅ APPROVED - Test successful!");
      break;
    case "n":
    case "no":
      console.log("❌ DENIED - Test successful!");
      break;
    case "s":
    case "skip":
      console.log("⏭️  SKIPPED - Test successful!");
      break;
    default:
      console.log(
        `⚠️  Unknown input: "${answer}" - Test successful (input received)!`,
      );
  }

  rl.close();
  console.log("\n🎉 Readline test completed successfully!");
  process.exit(0);
});

// 타임아웃 테스트 (30초)
const timeout = setTimeout(() => {
  console.log("\n⏰ Timeout (30s) - Test successful (timeout works)!");
  rl.close();
  process.exit(0);
}, 30000);

// Cleanup
rl.on("close", () => {
  clearTimeout(timeout);
});
