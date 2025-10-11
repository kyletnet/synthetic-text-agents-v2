/**
 * Context-Aware Subtree Retrieval
 *
 * Phase 6 Day 4: 검색 품질 개선의 핵심
 *
 * 목적:
 * - 매칭된 청크 주변의 문맥적 서브트리를 자동으로 첨부
 * - Recall 안정화 (+20-30pp 예상)
 * - Token 증가 <30% 유지
 *
 * 전략:
 * - Section 청크 → 상위 Section 제목 + 하위 문단 첨부
 * - Table 청크 → Table 헤더/캡션 + 전체 행 데이터 첨부
 * - Paragraph 청크 → 주변 ±1 문단 첨부
 */

import type { RankedResult } from './types';

/**
 * Subtree Retrieval 설정
 */
export interface SubtreeRetrieverConfig {
  /** Section 청크에 상위 제목 첨부 여부 (기본: true) */
  enrichSections: boolean;
  /** Table 청크에 헤더/캡션 첨부 여부 (기본: true) */
  enrichTables: boolean;
  /** Paragraph 청크에 주변 문단 첨부 여부 (기본: true) */
  enrichParagraphs: boolean;
  /** 주변 문단 범위 (±N 문단, 기본: 1) */
  paragraphRadius: number;
  /** 최대 Token 증가율 (기본: 0.3 = 30%) */
  maxTokenIncrease: number;
  /** 전체 청크 컬렉션 (문맥 추출용) */
  allChunks?: RankedResult[];
}

/**
 * Context-Aware Subtree Retriever
 */
export class SubtreeRetriever {
  private config: SubtreeRetrieverConfig;

  constructor(config: Partial<SubtreeRetrieverConfig> = {}) {
    this.config = {
      enrichSections: config.enrichSections ?? true,
      enrichTables: config.enrichTables ?? true,
      enrichParagraphs: config.enrichParagraphs ?? true,
      paragraphRadius: config.paragraphRadius ?? 1,
      maxTokenIncrease: config.maxTokenIncrease ?? 0.3,
      allChunks: config.allChunks ?? [],
    };
  }

  /**
   * 매칭된 청크에 서브트리 첨부
   *
   * Phase 6 Day 4: Progressive Token-Budget-Aware Enrichment
   * - Token 예산을 청크별로 분배
   * - 예산 초과 시 점진적으로 enrichment 레벨 감소
   */
  async enrichContext(matchedChunks: RankedResult[]): Promise<RankedResult[]> {
    if (!matchedChunks.length) return matchedChunks;

    const originalTokens = this.estimateTokens(matchedChunks);
    const maxTokens = originalTokens * (1 + this.config.maxTokenIncrease);
    const tokenBudget = maxTokens - originalTokens; // 30% 예산

    const enriched: RankedResult[] = [];
    let usedTokens = originalTokens;

    for (const chunk of matchedChunks) {
      const chunkTokens = this.estimateTokens([chunk]);
      const remainingBudget = maxTokens - usedTokens;

      // 예산이 부족하면 원본 사용
      if (remainingBudget < chunkTokens * 0.1) {
        enriched.push(chunk);
        usedTokens += chunkTokens;
        continue;
      }

      // Progressive Enrichment 시도 (Full → Medium → Minimal)
      const enrichedChunk = await this.tryProgressiveEnrichment(
        chunk,
        remainingBudget
      );

      const enrichedTokens = this.estimateTokens([enrichedChunk]);

      // 예산 내면 사용, 아니면 원본 사용
      if (usedTokens + enrichedTokens <= maxTokens) {
        enriched.push(enrichedChunk);
        usedTokens += enrichedTokens;
      } else {
        enriched.push(chunk);
        usedTokens += chunkTokens;
      }
    }

    const finalTokens = this.estimateTokens(enriched);
    const increaseRate = (finalTokens - originalTokens) / originalTokens;
    const enrichedCount = enriched.filter(c => c.metadata.enriched).length;

    if (increaseRate > 0.01) { // 1% 이상 증가했을 때만 로그
      console.log(
        `[SubtreeRetriever] Token increase: ${(increaseRate * 100).toFixed(1)}% (${enrichedCount}/${enriched.length} chunks enriched)`
      );
    }

    return enriched;
  }

  /**
   * Progressive Enrichment with Token Budget
   *
   * Fallback Levels:
   * - Level 3 (Full): Section + Parent + Children (또는 Table + Surrounding)
   * - Level 2 (Medium): Section/Table만 (Parent나 Caption만)
   * - Level 1 (Minimal): 원본 그대로
   */
  private async tryProgressiveEnrichment(
    chunk: RankedResult,
    tokenBudget: number
  ): Promise<RankedResult> {
    const originalTokens = this.estimateTokens([chunk]);

    // Level 3: Full Enrichment 시도
    let enrichedChunk: RankedResult;

    if (this.config.enrichSections && this.isSection(chunk)) {
      enrichedChunk = await this.enrichSectionProgressive(chunk, 'full');
    } else if (this.config.enrichTables && this.isTable(chunk)) {
      enrichedChunk = await this.enrichTableProgressive(chunk, 'full');
    } else if (this.config.enrichParagraphs && this.isParagraph(chunk)) {
      enrichedChunk = await this.enrichParagraphProgressive(chunk, 'full');
    } else {
      return chunk;
    }

    let enrichedTokens = this.estimateTokens([enrichedChunk]);
    let increase = enrichedTokens - originalTokens;

    // Full enrichment가 예산 내면 반환
    if (increase <= tokenBudget) {
      return enrichedChunk;
    }

    // Level 2: Medium Enrichment 시도
    if (this.isSection(chunk)) {
      enrichedChunk = await this.enrichSectionProgressive(chunk, 'medium');
    } else if (this.isTable(chunk)) {
      enrichedChunk = await this.enrichTableProgressive(chunk, 'medium');
    } else if (this.isParagraph(chunk)) {
      enrichedChunk = await this.enrichParagraphProgressive(chunk, 'medium');
    }

    enrichedTokens = this.estimateTokens([enrichedChunk]);
    increase = enrichedTokens - originalTokens;

    // Medium enrichment가 예산 내면 반환
    if (increase <= tokenBudget) {
      return enrichedChunk;
    }

    // Level 1: 원본 반환
    return chunk;
  }

  /**
   * Section 청크 enrichment (Progressive)
   *
   * Level:
   * - full: Parent Section + Child Paragraphs (최대 2개)
   * - medium: Parent Section만 또는 Child Paragraphs 1개
   */
  private async enrichSectionProgressive(
    chunk: RankedResult,
    level: 'full' | 'medium'
  ): Promise<RankedResult> {
    const { sectionTitle, sectionLevel, page } = chunk.metadata;

    // 상위 Section 찾기
    const parentSection = this.findParentSection(chunk);

    // 같은 Section 내 하위 문단 찾기
    const childParagraphs = this.findChildParagraphs(chunk);

    // Content 확장
    let enrichedContent = chunk.content;

    if (level === 'full') {
      // Full: Parent + Children (최대 2개)
      if (parentSection) {
        enrichedContent = `${parentSection.content}\n\n${enrichedContent}`;
      }

      if (childParagraphs.length > 0) {
        const childContent = childParagraphs
          .map(p => p.content)
          .slice(0, 2) // 최대 2개 문단
          .join('\n\n');
        enrichedContent = `${enrichedContent}\n\n${childContent}`;
      }
    } else if (level === 'medium') {
      // Medium: Parent만 또는 Children 1개
      if (parentSection) {
        enrichedContent = `${parentSection.content}\n\n${enrichedContent}`;
      } else if (childParagraphs.length > 0) {
        enrichedContent = `${enrichedContent}\n\n${childParagraphs[0].content}`;
      }
    }

    return {
      ...chunk,
      content: enrichedContent,
      metadata: {
        ...chunk.metadata,
        enriched: true,
        enrichmentType: 'section',
        enrichmentLevel: level,
        parentSection: parentSection?.metadata.sectionTitle,
        childCount: childParagraphs.length,
      },
    };
  }

  /**
   * Section 청크 enrichment (Legacy - 호환성)
   */
  private async enrichSection(chunk: RankedResult): Promise<RankedResult> {
    return this.enrichSectionProgressive(chunk, 'full');
  }

  /**
   * Table 청크 enrichment (Progressive)
   *
   * Level:
   * - full: Caption + Before + After
   * - medium: Caption만 또는 Before/After 중 하나
   */
  private async enrichTableProgressive(
    chunk: RankedResult,
    level: 'full' | 'medium'
  ): Promise<RankedResult> {
    const tableInfo = chunk.metadata.tableInfo as { caption?: string | null; rows?: number; cols?: number } | undefined;

    // Table 전후 문단 찾기 (설명)
    const surroundingParagraphs = this.findSurroundingParagraphs(chunk, 1);

    // Content 확장
    let enrichedContent = chunk.content;

    if (level === 'full') {
      // Full: Caption + Before + After
      if (tableInfo?.caption) {
        enrichedContent = `**Table Caption:** ${tableInfo.caption}\n\n${enrichedContent}`;
      }

      if (surroundingParagraphs.before) {
        enrichedContent = `${surroundingParagraphs.before.content}\n\n${enrichedContent}`;
      }
      if (surroundingParagraphs.after) {
        enrichedContent = `${enrichedContent}\n\n${surroundingParagraphs.after.content}`;
      }
    } else if (level === 'medium') {
      // Medium: Caption만 또는 Before만
      if (tableInfo?.caption) {
        enrichedContent = `**Table Caption:** ${tableInfo.caption}\n\n${enrichedContent}`;
      } else if (surroundingParagraphs.before) {
        enrichedContent = `${surroundingParagraphs.before.content}\n\n${enrichedContent}`;
      }
    }

    return {
      ...chunk,
      content: enrichedContent,
      metadata: {
        ...chunk.metadata,
        enriched: true,
        enrichmentType: 'table',
        enrichmentLevel: level,
        hasSurroundingContext: !!(surroundingParagraphs.before || surroundingParagraphs.after),
      },
    };
  }

  /**
   * Table 청크 enrichment (Legacy - 호환성)
   */
  private async enrichTable(chunk: RankedResult): Promise<RankedResult> {
    return this.enrichTableProgressive(chunk, 'full');
  }

  /**
   * Paragraph 청크 enrichment (Progressive)
   *
   * Level:
   * - full: Before + After (±1)
   * - medium: Before 또는 After 중 하나
   */
  private async enrichParagraphProgressive(
    chunk: RankedResult,
    level: 'full' | 'medium'
  ): Promise<RankedResult> {
    const surrounding = this.findSurroundingParagraphs(
      chunk,
      this.config.paragraphRadius
    );

    // Content 확장
    let enrichedContent = chunk.content;

    if (level === 'full') {
      // Full: Before + After
      if (surrounding.before) {
        enrichedContent = `${surrounding.before.content}\n\n${enrichedContent}`;
      }
      if (surrounding.after) {
        enrichedContent = `${enrichedContent}\n\n${surrounding.after.content}`;
      }
    } else if (level === 'medium') {
      // Medium: Before만 또는 After만
      if (surrounding.before) {
        enrichedContent = `${surrounding.before.content}\n\n${enrichedContent}`;
      } else if (surrounding.after) {
        enrichedContent = `${enrichedContent}\n\n${surrounding.after.content}`;
      }
    }

    return {
      ...chunk,
      content: enrichedContent,
      metadata: {
        ...chunk.metadata,
        enriched: true,
        enrichmentType: 'paragraph',
        enrichmentLevel: level,
        hasSurroundingContext: !!(surrounding.before || surrounding.after),
      },
    };
  }

  /**
   * Paragraph 청크 enrichment (Legacy - 호환성)
   */
  private async enrichParagraph(chunk: RankedResult): Promise<RankedResult> {
    return this.enrichParagraphProgressive(chunk, 'full');
  }

  /**
   * 상위 Section 찾기
   */
  private findParentSection(chunk: RankedResult): RankedResult | null {
    const { sectionLevel, page } = chunk.metadata;
    if (!sectionLevel || sectionLevel === 1) return null;

    const allChunks = this.config.allChunks || [];
    const samePage = allChunks.filter(c => c.metadata.page === page);

    // 같은 페이지에서 상위 레벨 Section 찾기
    for (const candidate of samePage) {
      if (
        candidate.metadata.sectionLevel &&
        candidate.metadata.sectionLevel < sectionLevel &&
        candidate.id !== chunk.id
      ) {
        return candidate;
      }
    }

    return null;
  }

  /**
   * 같은 Section 내 하위 문단 찾기
   */
  private findChildParagraphs(chunk: RankedResult): RankedResult[] {
    const { sectionTitle, page } = chunk.metadata;
    if (!sectionTitle) return [];

    const allChunks = this.config.allChunks || [];
    const children = allChunks.filter(c => {
      return (
        c.metadata.page === page &&
        c.metadata.sectionTitle === sectionTitle &&
        !this.isSection(c) && // Section 제외
        c.id !== chunk.id
      );
    });

    return children.slice(0, 2); // 최대 2개
  }

  /**
   * 주변 문단 찾기
   */
  private findSurroundingParagraphs(
    chunk: RankedResult,
    radius: number
  ): { before: RankedResult | null; after: RankedResult | null } {
    const { page } = chunk.metadata;
    const allChunks = this.config.allChunks || [];
    const samePage = allChunks.filter(c => c.metadata.page === page);

    const currentIndex = samePage.findIndex(c => c.id === chunk.id);
    if (currentIndex === -1) {
      return { before: null, after: null };
    }

    const before = currentIndex > 0 ? samePage[currentIndex - radius] : null;
    const after =
      currentIndex < samePage.length - 1 ? samePage[currentIndex + radius] : null;

    return { before, after };
  }

  /**
   * 타입 체크
   */
  private isSection(chunk: RankedResult): boolean {
    return (
      chunk.metadata.sectionLevel !== undefined &&
      chunk.metadata.sectionTitle !== undefined
    );
  }

  private isTable(chunk: RankedResult): boolean {
    return chunk.metadata.tableInfo !== undefined;
  }

  private isParagraph(chunk: RankedResult): boolean {
    return !this.isSection(chunk) && !this.isTable(chunk);
  }

  /**
   * Token 추정 (간단한 휴리스틱)
   */
  private estimateTokens(chunks: RankedResult[]): number {
    const totalChars = chunks.reduce((sum, c) => sum + c.content.length, 0);
    return Math.ceil(totalChars / 4); // 1 token ≈ 4 chars (한글 기준)
  }

  /**
   * 전체 청크 컬렉션 설정 (필수)
   */
  setAllChunks(chunks: RankedResult[]): void {
    this.config.allChunks = chunks;
  }
}

/**
 * SubtreeRetriever 생성 헬퍼
 */
export function createSubtreeRetriever(
  config?: Partial<SubtreeRetrieverConfig>
): SubtreeRetriever {
  return new SubtreeRetriever(config);
}
