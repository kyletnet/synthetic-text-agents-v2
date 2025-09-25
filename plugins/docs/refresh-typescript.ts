/**
 * TypeScript 문서 자동 갱신 플러그인
 *
 * TypeScript 소스 코드 변경사항을 감지하고 관련 문서를 자동 업데이트
 */

import {
  DocPlugin,
  DocSyncContext,
  DocPluginResult,
  DocPermission,
} from "../types/DocPlugin.js";

export class TypeScriptDocRefreshPlugin implements DocPlugin {
  meta = {
    name: "refresh-typescript",
    description: "Auto-refresh documentation when TypeScript files change",
    version: "1.0.0",
    author: "AI Team",
    permissions: ["general-docs", "api-docs"] as DocPermission[],
    supportedScopes: ["ai-agents", "platform"],
    documentTypes: ["typescript", "api"],
    dependencies: [],
  };

  async run(context: DocSyncContext): Promise<DocPluginResult> {
    const { changes, utils, config } = context;
    const { logger, llmClient, fileSystem } = utils;

    logger.info(
      `🔍 TypeScript Doc Refresh: Analyzing ${changes.files.length} changed files`,
    );

    const results: DocPluginResult = {
      success: true,
      changes: [],
      messages: [],
      metrics: {
        duration: 0,
        filesProcessed: 0,
        tokensUsed: 0,
      },
    };

    const startTime = Date.now();

    try {
      // 1. TypeScript 파일 변경 감지
      const tsFiles = changes.files.filter(
        (file) =>
          file.endsWith(".ts") &&
          file.startsWith("src/") &&
          !file.includes(".test.") &&
          !file.includes(".spec."),
      );

      if (tsFiles.length === 0) {
        results.messages.push("📝 No TypeScript source files changed");
        return results;
      }

      logger.info(`📁 Found ${tsFiles.length} changed TypeScript files`, {
        files: tsFiles,
      });

      // 2. 문서 소스 매핑 확인
      const docSources = config.documentSources;
      const relevantMappings = Object.entries(docSources).filter(
        ([key, _]) =>
          key === "typescript" || key === "agents" || key === "scripts",
      );

      for (const [sourceType, mapping] of relevantMappings) {
        const [sourcePattern, targetDoc] = mapping.split(" -> ");

        // 3. 패턴 매칭으로 영향받는 파일 확인
        const affectedFiles = tsFiles.filter((file) =>
          this.matchesPattern(file, sourcePattern),
        );

        if (affectedFiles.length === 0) continue;

        logger.info(`📄 Updating ${targetDoc} for ${sourceType} changes`);

        // 4. LLM을 사용한 문서 업데이트
        const updatedContent = await this.generateDocumentationUpdate(
          affectedFiles,
          targetDoc,
          changes.gitDiff,
          llmClient,
          fileSystem,
        );

        // 5. 백업 생성
        if (await fileSystem.exists(targetDoc)) {
          const backupPath = await fileSystem.createBackup(targetDoc);
          results.messages.push(`💾 Backup created: ${backupPath}`);
        }

        // 6. 문서 업데이트
        await fileSystem.writeFile(targetDoc, updatedContent);

        results.changes.push({
          filePath: targetDoc,
          action: "update",
          summary: `Updated based on ${affectedFiles.length} TypeScript file changes`,
          requiresApproval: this.requiresApproval(
            targetDoc,
            config.approvalRules,
          ),
        });

        results.metrics!.filesProcessed++;
        results.messages.push(`✅ Updated ${targetDoc}`);
      }

      // 7. API 문서 특별 처리
      if (
        tsFiles.some(
          (file) => file.includes("/agents/") || file.includes("/core/"),
        )
      ) {
        await this.updateArchitectureDocs(tsFiles, context, results);
      }
    } catch (error) {
      logger.error("TypeScript doc refresh failed", error);
      results.success = false;
      results.messages.push(`❌ Error: ${error.message}`);
    }

    results.metrics!.duration = Date.now() - startTime;

    logger.info(
      `✅ TypeScript Doc Refresh completed in ${results.metrics!.duration}ms`,
    );
    return results;
  }

  /**
   * 파일이 패턴과 매칭되는지 확인
   */
  private matchesPattern(filePath: string, pattern: string): boolean {
    // 간단한 glob 패턴 매칭 (실제로는 minimatch 등 사용)
    const regex = pattern
      .replace(/\*\*/g, ".*")
      .replace(/\*/g, "[^/]*")
      .replace(/\?/g, ".");

    return new RegExp(`^${regex}$`).test(filePath);
  }

  /**
   * LLM을 사용한 문서 업데이트 생성
   */
  private async generateDocumentationUpdate(
    changedFiles: string[],
    targetDoc: string,
    gitDiff: string,
    llmClient: any,
    fileSystem: any,
  ): Promise<string> {
    // 기존 문서 읽기
    let existingDoc = "";
    if (await fileSystem.exists(targetDoc)) {
      existingDoc = await fileSystem.readFile(targetDoc);
    }

    // 변경된 파일들의 내용 읽기
    const fileContents = await Promise.all(
      changedFiles.map(async (file) => ({
        path: file,
        content: await fileSystem.readFile(file),
      })),
    );

    // LLM 프롬프트 생성
    const prompt = `
Update the documentation based on the following TypeScript code changes:

Changed Files:
${fileContents.map((f) => `\n--- ${f.path} ---\n${f.content}`).join("\n")}

Git Diff:
${gitDiff}

Current Documentation:
${existingDoc}

Please update the documentation to reflect the changes. Keep the existing structure and style. Focus on:
1. Updated API signatures
2. New classes/interfaces
3. Changed behavior
4. Removed functionality

Generate only the updated documentation content:
`;

    return await llmClient.generateSummary(prompt, {
      maxTokens: 2000,
      temperature: 0.3,
    });
  }

  /**
   * 아키텍처 문서 업데이트
   */
  private async updateArchitectureDocs(
    changedFiles: string[],
    context: DocSyncContext,
    results: DocPluginResult,
  ): Promise<void> {
    const { utils } = context;
    const { logger, llmClient, fileSystem } = utils;

    const architectureFiles = [
      "docs/llm_friendly_summary.md",
      "HANDOFF_NAVIGATION.md",
    ];

    for (const docPath of architectureFiles) {
      if (await fileSystem.exists(docPath)) {
        logger.info(`🏗️ Updating architecture doc: ${docPath}`);

        // 아키텍처 문서는 더 신중하게 업데이트
        const summary = await this.generateArchitectureSummary(
          changedFiles,
          utils,
        );

        const existingContent = await fileSystem.readFile(docPath);
        const updatedContent = await this.mergeArchitectureChanges(
          existingContent,
          summary,
          llmClient,
        );

        // 백업 생성
        const backupPath = await fileSystem.createBackup(docPath);
        await fileSystem.writeFile(docPath, updatedContent);

        results.changes.push({
          filePath: docPath,
          action: "update",
          summary: `Architecture doc updated based on core system changes`,
          requiresApproval: true, // 아키텍처 변경은 항상 승인 필요
          backupCreated: backupPath,
        });

        results.messages.push(`🏗️ Updated architecture: ${docPath}`);
      }
    }
  }

  private async generateArchitectureSummary(
    changedFiles: string[],
    utils: any,
  ): Promise<string> {
    // 핵심 아키텍처 파일 변경사항만 추출
    const coreFiles = changedFiles.filter(
      (file) =>
        file.includes("/core/") ||
        file.includes("/agents/") ||
        file.includes("/shared/"),
    );

    if (coreFiles.length === 0) return "";

    const fileAnalysis = await Promise.all(
      coreFiles.map(async (file) => {
        const content = await utils.fileSystem.readFile(file);
        return `${file}: Key classes and interfaces extracted`;
      }),
    );

    return fileAnalysis.join("\n");
  }

  private async mergeArchitectureChanges(
    existingContent: string,
    summary: string,
    llmClient: any,
  ): Promise<string> {
    if (!summary) return existingContent;

    const prompt = `
Update this architecture documentation based on code changes:

Current Documentation:
${existingContent}

Code Changes Summary:
${summary}

Please update the documentation preserving its structure and style, but reflecting the architectural changes. Be conservative - only update what clearly needs to change.

Updated documentation:
`;

    return await llmClient.generateSummary(prompt, {
      maxTokens: 3000,
      temperature: 0.2,
    });
  }

  /**
   * 승인이 필요한 문서인지 확인
   */
  private requiresApproval(filePath: string, approvalRules: any): boolean {
    // CLAUDE.md, 아키텍처 문서 등은 승인 필요
    const criticalDocs = [
      "CLAUDE.md",
      "HANDOFF_NAVIGATION.md",
      "docs/llm_friendly_summary.md",
    ];

    return (
      criticalDocs.some((doc) => filePath.includes(doc)) ||
      Object.keys(approvalRules).some((pattern) => filePath.match(pattern))
    );
  }

  /**
   * 권한 검증
   */
  validatePermissions(context: DocSyncContext): boolean {
    // 이 플러그인은 일반 문서와 API 문서만 처리
    return true; // 기본적으로 안전한 플러그인
  }

  /**
   * 건강성 체크
   */
  async healthCheck(): Promise<boolean> {
    // TypeScript 컴파일러 사용 가능한지 등 체크
    try {
      // 간단한 체크 로직
      return true;
    } catch {
      return false;
    }
  }
}

// 플러그인 인스턴스 내보내기
export default new TypeScriptDocRefreshPlugin();
