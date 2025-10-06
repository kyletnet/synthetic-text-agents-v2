#!/usr/bin/env tsx
/**
 * LLM Signal Injector - RAG/LLM 최적화 문서 구조 시그널링
 * GPT 제안: LLM ingestion 최적화를 위한 internal markdown tags
 */

import { promises as fs } from "fs";
import { join, dirname } from "path";
import { glob } from "glob";

interface LLMSignal {
  type: "ENTITY" | "SECTION" | "API" | "CONCEPT" | "EXAMPLE" | "CONFIG";
  identifier: string;
  metadata?: Record<string, any>;
}

interface SignalRule {
  pattern: string;
  signals: LLMSignal[];
  placement: "top" | "before-heading" | "after-heading";
}

const SIGNAL_RULES: SignalRule[] = [
  // Agent 문서 시그널링
  {
    pattern: "docs/**/*agent*.md",
    signals: [
      { type: "ENTITY", identifier: "Agent-{filename}" },
      { type: "CONCEPT", identifier: "Agent-Architecture" },
    ],
    placement: "top",
  },

  // API 문서 시그널링
  {
    pattern: "docs/**/API*.md",
    signals: [
      { type: "API", identifier: "REST-Endpoints" },
      { type: "SECTION", identifier: "API-Reference" },
    ],
    placement: "top",
  },

  // 설정 문서 시그널링
  {
    pattern: "docs/**/*{config,CONFIG}*.md",
    signals: [
      { type: "CONFIG", identifier: "System-Configuration" },
      { type: "EXAMPLE", identifier: "Config-Examples" },
    ],
    placement: "before-heading",
  },

  // 시스템 아키텍처 문서
  {
    pattern: "docs/**/SYSTEM*.md",
    signals: [
      { type: "CONCEPT", identifier: "System-Architecture" },
      { type: "ENTITY", identifier: "Core-Components" },
    ],
    placement: "top",
  },
];

class LLMSignalInjector {
  private projectRoot: string;
  private backupDir: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.backupDir = join(projectRoot, ".doc-signals-backup");
  }

  async injectAllSignals(): Promise<void> {
    console.log("🧩 Injecting LLM optimization signals into documents...");

    await this.createBackupDir();

    for (const rule of SIGNAL_RULES) {
      await this.processRule(rule);
    }

    console.log("✅ LLM signal injection completed");
    await this.generateSignalIndex();
  }

  private async processRule(rule: SignalRule): Promise<void> {
    const files = await glob(rule.pattern, { cwd: this.projectRoot });

    console.log(
      `📝 Processing ${files.length} files for pattern: ${rule.pattern}`,
    );

    for (const filePath of files) {
      await this.injectSignals(filePath, rule);
    }
  }

  private async injectSignals(
    filePath: string,
    rule: SignalRule,
  ): Promise<void> {
    const fullPath = join(this.projectRoot, filePath);

    try {
      const originalContent = await fs.readFile(fullPath, "utf-8");

      // 이미 시그널이 있는지 확인
      if (this.hasExistingSignals(originalContent)) {
        console.log(`⏭️  Skipping ${filePath} (already has signals)`);
        return;
      }

      // 백업 생성
      await this.createBackup(filePath, originalContent);

      // 시그널 생성 및 삽입
      const signals = this.generateSignals(filePath, rule.signals);
      const newContent = this.insertSignals(
        originalContent,
        signals,
        rule.placement,
      );

      // 파일 업데이트
      await fs.writeFile(fullPath, newContent);
      console.log(`✅ Injected signals into ${filePath}`);
    } catch (error) {
      console.error(`❌ Failed to process ${filePath}:`, error);
    }
  }

  private generateSignals(
    filePath: string,
    templateSignals: LLMSignal[],
  ): string[] {
    const filename = filePath.split("/").pop()?.replace(".md", "") || "unknown";
    const signals: string[] = [];

    for (const template of templateSignals) {
      const identifier = template.identifier.replace("{filename}", filename);

      let signalContent = `<!-- DOC:${template.type}:${identifier}`;

      if (template.metadata) {
        const metadata = Object.entries(template.metadata)
          .map(([key, value]) => `${key}="${value}"`)
          .join(" ");
        signalContent += ` ${metadata}`;
      }

      signalContent += " -->";
      signals.push(signalContent);
    }

    // 추가 메타데이터 시그널
    signals.push(`<!-- DOC:GENERATED:${new Date().toISOString()} -->`);
    signals.push(`<!-- DOC:SOURCE:${filePath} -->`);

    return signals;
  }

  private insertSignals(
    content: string,
    signals: string[],
    placement: string,
  ): string {
    const signalBlock = signals.join("\n") + "\n";

    switch (placement) {
      case "top":
        return signalBlock + "\\n" + content;

      case "before-heading":
        // 첫 번째 헤딩 앞에 삽입
        const headingMatch = content.match(/^#{1,6} /m);
        if (headingMatch && headingMatch.index !== undefined) {
          return (
            content.slice(0, headingMatch.index) +
            signalBlock +
            "\n" +
            content.slice(headingMatch.index)
          );
        }
        // 헤딩이 없으면 맨 위에 삽입
        return signalBlock + "\\n" + content;

      case "after-heading":
        // 첫 번째 헤딩 다음 줄에 삽입
        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].match(/^#{1,6} /)) {
            lines.splice(i + 1, 0, "", ...signals, "");
            break;
          }
        }
        return lines.join("\n");

      default:
        return signalBlock + "\\n" + content;
    }
  }

  private hasExistingSignals(content: string): boolean {
    return content.includes("<!-- DOC:");
  }

  private async createBackupDir(): Promise<void> {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
    } catch (error) {
      // 디렉토리가 이미 존재하는 경우 무시
    }
  }

  private async createBackup(filePath: string, content: string): Promise<void> {
    const backupPath = join(this.backupDir, filePath.replace(/\//g, "_"));
    await fs.mkdir(dirname(backupPath), { recursive: true });
    await fs.writeFile(backupPath, content);
  }

  private async generateSignalIndex(): Promise<void> {
    console.log("📊 Generating LLM signal index...");

    const docFiles = await glob("docs/**/*.md", { cwd: this.projectRoot });
    const signalIndex: Record<string, any[]> = {};

    for (const docFile of docFiles) {
      const content = await fs.readFile(
        join(this.projectRoot, docFile),
        "utf-8",
      );
      const signals = this.extractSignalsFromContent(content);

      if (signals.length > 0) {
        signalIndex[docFile] = signals;
      }
    }

    // 인덱스 저장
    const indexPath = join(this.projectRoot, "docs/.llm-signals-index.json");
    await fs.writeFile(
      indexPath,
      JSON.stringify(
        {
          generated: new Date().toISOString(),
          totalDocs: docFiles.length,
          signaledDocs: Object.keys(signalIndex).length,
          signals: signalIndex,
        },
        null,
        2,
      ),
    );

    console.log(
      `📋 Signal index saved: ${Object.keys(signalIndex).length}/${
        docFiles.length
      } docs with signals`,
    );
  }

  private extractSignalsFromContent(content: string): any[] {
    const signalRegex = /<!-- DOC:(\\w+):(\\S+)(?:\\s+([^-]+))? -->/g;
    const signals = [];
    let match;

    while ((match = signalRegex.exec(content)) !== null) {
      const [, type, identifier, metadata] = match;
      signals.push({
        type,
        identifier,
        metadata: metadata?.trim() || null,
      });
    }

    return signals;
  }

  // 시그널 제거 (롤백용)
  async removeAllSignals(): Promise<void> {
    console.log("🧹 Removing all LLM signals from documents...");

    const docFiles = await glob("docs/**/*.md", { cwd: this.projectRoot });

    for (const docFile of docFiles) {
      const fullPath = join(this.projectRoot, docFile);
      const content = await fs.readFile(fullPath, "utf-8");

      if (this.hasExistingSignals(content)) {
        const cleanContent = content
          .replace(/<!-- DOC:[^>]+-->/g, "")
          .replace(/\\n\\n\\n+/g, "\\n\\n");
        await fs.writeFile(fullPath, cleanContent);
        console.log(`🧹 Cleaned signals from ${docFile}`);
      }
    }
  }

  // 시그널 검증
  async validateSignals(): Promise<void> {
    console.log("🔍 Validating LLM signals...");

    const docFiles = await glob("docs/**/*.md", { cwd: this.projectRoot });
    const issues = [];

    for (const docFile of docFiles) {
      const content = await fs.readFile(
        join(this.projectRoot, docFile),
        "utf-8",
      );
      const signals = this.extractSignalsFromContent(content);

      // 중복 체크
      const identifiers = signals.map((s) => s.identifier);
      const duplicates = identifiers.filter(
        (id, index) => identifiers.indexOf(id) !== index,
      );

      if (duplicates.length > 0) {
        issues.push(
          `${docFile}: Duplicate signal identifiers: ${duplicates.join(", ")}`,
        );
      }

      // 필수 시그널 체크
      if (
        docFile.includes("agent") &&
        !signals.some((s) => s.type === "ENTITY")
      ) {
        issues.push(`${docFile}: Missing ENTITY signal for agent document`);
      }
    }

    if (issues.length > 0) {
      console.log("⚠️  Signal validation issues:");
      issues.forEach((issue) => console.log(`   - ${issue}`));
    } else {
      console.log("✅ All signals are valid");
    }
  }
}

// CLI 실행
async function main() {
  const projectRoot = process.cwd();
  const injector = new LLMSignalInjector(projectRoot);

  const command = process.argv[2];

  switch (command) {
    case "inject":
    case undefined:
      await injector.injectAllSignals();
      break;
    case "remove":
      await injector.removeAllSignals();
      break;
    case "validate":
      await injector.validateSignals();
      break;
    default:
      console.log(`
Usage: tsx scripts/docs/llm-signal-injector.ts [command]

Commands:
  inject    - Inject LLM optimization signals into documents
  remove    - Remove all signals (cleanup)
  validate  - Check signal integrity

Examples:
  npm run docs:signals:inject
  npm run docs:signals:remove
  npm run docs:signals:validate
      `);
  }
}

if (require.main === module) {
  main().catch(console.error);
}
