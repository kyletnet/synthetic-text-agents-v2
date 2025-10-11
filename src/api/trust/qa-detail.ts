/**
 * QA Detail API
 *
 * GET /api/trust/qa-detail/:id
 *
 * Response:
 * {
 *   qa: QAPair,
 *   evidence: Evidence[],
 *   violations: Violation[],
 *   history: {
 *     created: string,
 *     modified: string,
 *     feedbackCount: number
 *   }
 * }
 */

import type { QAPair } from '../../application/qa-generator';
import type { EvidenceItem } from '../../core/transparency/evidence-types';

/**
 * Violation detail
 */
export interface ViolationDetail {
  id: string;
  category: string;
  severity: 'error' | 'warning';
  message: string;
  location: 'question' | 'answer';
  suggestion?: string;
}

/**
 * QA Detail Response
 */
export interface QADetailResponse {
  qa: QAPair;
  evidence: EvidenceItem[];
  violations: ViolationDetail[];
  history: {
    created: string;
    modified?: string;
    feedbackCount: number;
  };
  relatedQA: QAPair[];
}

/**
 * QA Detail API
 */
export class QADetailAPI {
  private qaStore: Map<string, QAPair>;
  private evidenceStore: Map<string, EvidenceItem[]>;
  private violationStore: Map<string, ViolationDetail[]>;

  constructor() {
    this.qaStore = new Map();
    this.evidenceStore = new Map();
    this.violationStore = new Map();
  }

  /**
   * Get QA detail by ID
   */
  async getDetail(qaId: string): Promise<QADetailResponse | null> {
    const qa = this.qaStore.get(qaId);

    if (!qa) {
      return null;
    }

    const evidence = this.evidenceStore.get(qaId) || [];
    const violations = this.violationStore.get(qaId) || [];

    // Find related QA (same source chunks)
    const relatedQA: QAPair[] = [];
    for (const [id, otherQA] of this.qaStore) {
      if (id !== qaId && this.hasCommonSources(qa, otherQA)) {
        relatedQA.push(otherQA);
      }
    }

    return {
      qa,
      evidence,
      violations,
      history: {
        created: qa.metadata.generatedAt,
        feedbackCount: 0,
      },
      relatedQA: relatedQA.slice(0, 5), // Limit to 5
    };
  }

  /**
   * Add QA to store
   */
  addQA(
    qa: QAPair,
    evidence: EvidenceItem[],
    violations: ViolationDetail[]
  ): void {
    this.qaStore.set(qa.id, qa);
    this.evidenceStore.set(qa.id, evidence);
    this.violationStore.set(qa.id, violations);
  }

  /**
   * Check if two QA pairs have common source chunks
   */
  private hasCommonSources(qa1: QAPair, qa2: QAPair): boolean {
    return qa1.sourceChunks.some((chunk) => qa2.sourceChunks.includes(chunk));
  }
}
