#!/usr/bin/env tsx

import { readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";

/**
 * ESLint 미사용 변수 일괄 수정 스크립트
 * 주로 catch 블록의 error 매개변수와 같은 미사용 변수들에 _ prefix 추가
 */

interface UnusedVar {
  file: string;
  line: number;
  column: number;
  variable: string;
  ruleType: string;
}

function fixUnusedVars(): number {
  console.log("🔧 미사용 변수 일괄 수정 시작...");

  // ESLint 결과 파싱
  const result = execSync("npm run lint:fix 2>&1 || true", {
    encoding: "utf8",
  });
  console.log("📊 ESLint 결과 분석 중...");

  const unusedVars: UnusedVar[] = [];
  const lines = result.split("\n");

  let currentFile = "";
  for (const line of lines) {
    // 파일 경로 감지
    const fileMatch = line.match(/^\/Users\/.*\.ts$/);
    if (fileMatch) {
      currentFile = fileMatch[0];
      continue;
    }

    // 미사용 변수 경고 감지
    const unusedMatch = line.match(
      /\s*(\d+):(\d+)\s+warning\s+'(.+?)' is (defined but never used|assigned a value but never used)/,
    );
    if (unusedMatch && currentFile) {
      unusedVars.push({
        file: currentFile,
        line: parseInt(unusedMatch[1]),
        column: parseInt(unusedMatch[2]),
        variable: unusedMatch[3],
        ruleType: unusedMatch[4],
      });
    }
  }

  console.log(`📝 발견된 미사용 변수: ${unusedVars.length}개`);

  // 파일별로 그룹화
  const fileGroups = new Map<string, UnusedVar[]>();
  for (const unused of unusedVars) {
    if (!fileGroups.has(unused.file)) {
      fileGroups.set(unused.file, []);
    }
    fileGroups.get(unused.file)!.push(unused);
  }

  let fixedCount = 0;

  for (const [filePath, vars] of fileGroups) {
    try {
      const content = readFileSync(filePath, "utf8");
      const lines = content.split("\n");

      // 라인 번호로 역순 정렬 (뒤에서부터 수정해야 라인 번호가 안 깨짐)
      vars.sort((a, b) => b.line - a.line);

      for (const unused of vars) {
        const lineIndex = unused.line - 1;
        const originalLine = lines[lineIndex];

        // 간단한 패턴 매칭으로 수정
        let newLine = originalLine;

        // catch (error) -> catch (_error)
        if (unused.variable === "error" && originalLine.includes("catch")) {
          newLine = originalLine.replace(
            /catch\s*\(\s*error\s*\)/,
            "catch (_error)",
          );
        }
        // } catch (e) -> } catch (_e)
        else if (unused.variable === "e" && originalLine.includes("catch")) {
          newLine = originalLine.replace(/catch\s*\(\s*e\s*\)/, "catch (_e)");
        }
        // 함수 매개변수나 일반 변수의 경우
        else {
          // const variable = -> const _variable =
          newLine = newLine.replace(
            new RegExp(`\\b${unused.variable}\\b(?=\\s*[=:,)])`, "g"),
            `_${unused.variable}`,
          );
        }

        if (newLine !== originalLine) {
          lines[lineIndex] = newLine;
          fixedCount++;
          console.log(
            `  ✓ ${filePath.split("/").pop()}:${unused.line} - ${unused.variable} -> _${unused.variable}`,
          );
        }
      }

      // 파일 저장
      if (vars.length > 0) {
        writeFileSync(filePath, lines.join("\n"));
      }
    } catch (error) {
      console.log(`  ❌ ${filePath} 수정 실패: ${error}`);
    }
  }

  console.log(`🎉 ${fixedCount}개 미사용 변수 수정 완료!`);
  return fixedCount;
}

// 직접 실행 시
if (import.meta.url === `file://${process.argv[1]}`) {
  fixUnusedVars();
}

export { fixUnusedVars };
