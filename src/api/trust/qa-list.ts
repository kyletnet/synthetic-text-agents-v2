/**
 * QA List API
 *
 * GET /api/trust/qa-list
 *
 * Query parameters:
 * - page: number (default: 1)
 * - limit: number (default: 20)
 * - sort: 'score' | 'date' | 'violations' (default: 'date')
 * - filter: 'all' | 'passed' | 'failed' (default: 'all')
 * - domain: string (optional)
 *
 * Response:
 * {
 *   total: number,
 *   page: number,
 *   limit: number,
 *   data: QAPair[]
 * }
 */

import type { QAPair } from '../../application/qa-generator';

/**
 * QA List Query Parameters
 */
export interface QAListQuery {
  page?: number;
  limit?: number;
  sort?: 'score' | 'date' | 'violations';
  filter?: 'all' | 'passed' | 'failed';
  domain?: string;
}

/**
 * QA List Response
 */
export interface QAListResponse {
  total: number;
  page: number;
  limit: number;
  data: QAPair[];
  summary: {
    totalQA: number;
    passed: number;
    failed: number;
    averageScore: number;
  };
}

/**
 * QA List API
 */
export class QAListAPI {
  private qaStore: Map<string, QAPair>;

  constructor() {
    this.qaStore = new Map();
  }

  /**
   * Add QA to store
   */
  addQA(qa: QAPair): void {
    this.qaStore.set(qa.id, qa);
  }

  /**
   * Get QA list with filtering and sorting
   */
  async getList(query: QAListQuery): Promise<QAListResponse> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const sort = query.sort || 'date';
    const filter = query.filter || 'all';

    // Get all QA pairs
    let qaPairs = Array.from(this.qaStore.values());

    // Filter by domain
    if (query.domain) {
      qaPairs = qaPairs.filter((qa) => qa.metadata.domain === query.domain);
    }

    // Filter by status
    if (filter !== 'all') {
      qaPairs = qaPairs.filter((qa) => {
        const passed = qa.metadata.violations === 0;
        return filter === 'passed' ? passed : !passed;
      });
    }

    // Sort
    qaPairs.sort((a, b) => {
      if (sort === 'score') {
        return b.metadata.validationScore - a.metadata.validationScore;
      } else if (sort === 'violations') {
        return a.metadata.violations - b.metadata.violations;
      } else {
        // date
        return new Date(b.metadata.generatedAt).getTime() - new Date(a.metadata.generatedAt).getTime();
      }
    });

    // Paginate
    const total = qaPairs.length;
    const start = (page - 1) * limit;
    const end = start + limit;
    const data = qaPairs.slice(start, end);

    // Calculate summary
    const passed = qaPairs.filter((qa) => qa.metadata.violations === 0).length;
    const failed = qaPairs.length - passed;
    const averageScore =
      qaPairs.reduce((sum, qa) => sum + qa.metadata.validationScore, 0) / qaPairs.length || 0;

    return {
      total,
      page,
      limit,
      data,
      summary: {
        totalQA: qaPairs.length,
        passed,
        failed,
        averageScore: Math.round(averageScore * 10) / 10,
      },
    };
  }

  /**
   * Clear store (for testing)
   */
  clear(): void {
    this.qaStore.clear();
  }
}
