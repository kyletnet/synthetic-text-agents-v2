#!/usr/bin/env tsx

/**
 * 승인 대기 큐 시스템
 * 타임아웃된 승인 요청을 저장하고 나중에 처리할 수 있게 함
 */

import { writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";

export interface PendingApprovalItem {
  id: string;
  title: string;
  description: string;
  command?: string;
  impact: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  priority: 'low' | 'medium' | 'high' | 'critical';
  createdAt: Date;
  timeoutAt: Date;
  attempts: number;
  source: string;
}

export class ApprovalQueue {
  private queueFile: string;

  constructor(projectRoot: string = process.cwd()) {
    this.queueFile = join(projectRoot, 'reports', 'approval-queue.json');
  }

  /**
   * 대기 큐에 항목 추가
   */
  addToQueue(item: Omit<PendingApprovalItem, 'id' | 'createdAt' | 'attempts'>): void {
    const queue = this.loadQueue();

    const newItem: PendingApprovalItem = {
      ...item,
      id: this.generateId(),
      createdAt: new Date(),
      attempts: 1
    };

    // 중복 체크 (같은 title + command)
    const existingIndex = queue.findIndex(q =>
      q.title === item.title && q.command === item.command
    );

    if (existingIndex >= 0) {
      // 기존 항목이 있으면 시도 횟수만 증가
      queue[existingIndex].attempts += 1;
      queue[existingIndex].timeoutAt = item.timeoutAt;
      console.log(`📋 기존 승인 요청 업데이트: ${item.title} (${queue[existingIndex].attempts}회 시도)`);
    } else {
      // 새 항목 추가
      queue.push(newItem);
      console.log(`📋 승인 대기 큐에 추가: ${item.title}`);
    }

    this.saveQueue(queue);
  }

  /**
   * 대기 큐 조회
   */
  getPendingItems(): PendingApprovalItem[] {
    return this.loadQueue();
  }

  /**
   * 우선순위별로 정렬된 대기 큐
   */
  getPendingItemsSorted(): PendingApprovalItem[] {
    const queue = this.loadQueue();

    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };

    return queue.sort((a, b) => {
      // 1차: 우선순위로 정렬
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;

      // 2차: 시도 횟수로 정렬 (많이 시도된 것 우선)
      const attemptDiff = b.attempts - a.attempts;
      if (attemptDiff !== 0) return attemptDiff;

      // 3차: 생성 시간으로 정렬 (오래된 것 우선)
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }

  /**
   * 특정 항목 제거
   */
  removeItem(id: string): boolean {
    const queue = this.loadQueue();
    const initialLength = queue.length;

    const filteredQueue = queue.filter(item => item.id !== id);

    if (filteredQueue.length < initialLength) {
      this.saveQueue(filteredQueue);
      return true;
    }

    return false;
  }

  /**
   * 큐 초기화
   */
  clearQueue(): void {
    this.saveQueue([]);
    console.log('📋 승인 대기 큐를 초기화했습니다.');
  }

  /**
   * 큐 통계
   */
  getQueueStats(): {
    total: number;
    byPriority: Record<string, number>;
    byRisk: Record<string, number>;
    oldestItem?: Date;
    mostAttempted?: number;
  } {
    const queue = this.loadQueue();

    const stats = {
      total: queue.length,
      byPriority: { critical: 0, high: 0, medium: 0, low: 0 },
      byRisk: { critical: 0, high: 0, medium: 0, low: 0 },
      oldestItem: queue.length > 0 ? new Date(Math.min(...queue.map(q => new Date(q.createdAt).getTime()))) : undefined,
      mostAttempted: queue.length > 0 ? Math.max(...queue.map(q => q.attempts)) : 0
    };

    queue.forEach(item => {
      stats.byPriority[item.priority]++;
      stats.byRisk[item.riskLevel]++;
    });

    return stats;
  }

  /**
   * 큐 파일 로드
   */
  private loadQueue(): PendingApprovalItem[] {
    if (!existsSync(this.queueFile)) {
      return [];
    }

    try {
      const content = readFileSync(this.queueFile, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.log(`⚠️ 승인 큐 파일 읽기 실패: ${error}`);
      return [];
    }
  }

  /**
   * 큐 파일 저장
   */
  private saveQueue(queue: PendingApprovalItem[]): void {
    try {
      writeFileSync(this.queueFile, JSON.stringify(queue, null, 2));
    } catch (error) {
      console.log(`⚠️ 승인 큐 파일 저장 실패: ${error}`);
    }
  }

  /**
   * 고유 ID 생성
   */
  private generateId(): string {
    return `approval_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  }
}

export const approvalQueue = new ApprovalQueue();