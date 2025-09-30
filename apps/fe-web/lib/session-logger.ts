// 세션 로깅 시스템
export interface AugmentationSession {
  sessionId: string;
  timestamp: string;
  inputMode: "manual" | "document" | "both";
  inputText: string;
  inputLength: number;
  detectedType: string;
  confidence: number;
  documentsUsed: string[];
  totalVariants: number;
  overallScore: number;
  processingTime: number;
  metadata: {
    ragUsed: boolean;
    ragSessionId?: string; // RAG 업로드 세션과 연결
    inputType?: string; // mixed/document/gold
    contextChunks?: number;
    bestVariantScore?: number;
  };
}

// 세션을 localStorage에 저장 (향후 서버 저장으로 확장 가능)
export class SessionLogger {
  private static readonly STORAGE_KEY = "smart-augment-sessions";
  private static readonly MAX_SESSIONS = 50; // 최대 50개 세션 유지

  static logSession(session: AugmentationSession): void {
    try {
      const sessions = this.getSessions();
      sessions.unshift(session); // 최신 순으로 정렬

      // 최대 개수 제한
      if (sessions.length > this.MAX_SESSIONS) {
        sessions.splice(this.MAX_SESSIONS);
      }

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(sessions));
      console.log(`📝 Session logged: ${session.sessionId}`);
    } catch (error) {
      console.error("Failed to log session:", error);
    }
  }

  static getSessions(): AugmentationSession[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error("Failed to retrieve sessions:", error);
      return [];
    }
  }

  static getRecentSessions(count: number = 10): AugmentationSession[] {
    return this.getSessions().slice(0, count);
  }

  static getSessionsByDateRange(
    startDate: Date,
    endDate: Date,
  ): AugmentationSession[] {
    const sessions = this.getSessions();
    return sessions.filter((session) => {
      const sessionDate = new Date(session.timestamp);
      return sessionDate >= startDate && sessionDate <= endDate;
    });
  }

  static getQualityStats(): {
    averageScore: number;
    totalSessions: number;
    topPerformingType: string;
    recentTrend: "improving" | "declining" | "stable";
  } {
    const sessions = this.getSessions();
    if (sessions.length === 0) {
      return {
        averageScore: 0,
        totalSessions: 0,
        topPerformingType: "unknown",
        recentTrend: "stable",
      };
    }

    const averageScore =
      sessions.reduce((sum, s) => sum + s.overallScore, 0) / sessions.length;

    // 가장 성능이 좋은 타입 찾기
    const typeScores: Record<string, number[]> = {};
    sessions.forEach((session) => {
      if (!typeScores[session.detectedType]) {
        typeScores[session.detectedType] = [];
      }
      typeScores[session.detectedType].push(session.overallScore);
    });

    const typeAverages = Object.entries(typeScores).map(([type, scores]) => ({
      type,
      average: scores.reduce((sum, score) => sum + score, 0) / scores.length,
    }));

    const topPerformingType =
      typeAverages.length > 0
        ? typeAverages.sort((a, b) => b.average - a.average)[0].type
        : "unknown";

    // 최근 트렌드 계산 (최근 5개 vs 이전 5개)
    let recentTrend: "improving" | "declining" | "stable" = "stable";
    if (sessions.length >= 10) {
      const recent5 =
        sessions.slice(0, 5).reduce((sum, s) => sum + s.overallScore, 0) / 5;
      const previous5 =
        sessions.slice(5, 10).reduce((sum, s) => sum + s.overallScore, 0) / 5;
      const diff = recent5 - previous5;

      if (diff > 0.05) recentTrend = "improving";
      else if (diff < -0.05) recentTrend = "declining";
      else recentTrend = "stable";
    }

    return {
      averageScore: Math.round(averageScore * 100) / 100,
      totalSessions: sessions.length,
      topPerformingType,
      recentTrend,
    };
  }

  static clearSessions(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    console.log("📝 All sessions cleared");
  }
}
