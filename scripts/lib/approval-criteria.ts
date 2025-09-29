/**
 * 승인 기준 정의 - 단일 모드 승인 시스템
 * 사용자 요청에 따라 복잡한 dual-mode 시스템을 제거하고 명확한 기준으로 단순화
 */

export interface ApprovalCriteria {
  changeType: string;
  requiresApproval: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  examples: string[];
  rollbackStrategy?: 'ignore' | 'revert' | 'snapshot_rollback' | 'graceful_abort';
  rollbackDescription?: string;
}

/**
 * 사용자 승인이 필요한 중요한 변경사항 기준
 * - 시스템 아키텍처 변경
 * - 데이터 구조 수정
 * - 외부 API 연동 변경
 * - 보안 관련 수정
 * - 설정 파일 변경
 */
export const CRITICAL_CHANGES: ApprovalCriteria[] = [
  {
    changeType: 'ARCHITECTURE_CHANGE',
    requiresApproval: true,
    riskLevel: 'critical',
    description: '시스템 아키텍처 변경 (디렉토리 구조, 모듈 재구성 등)',
    examples: [
      'src/ 디렉토리 구조 변경',
      '새로운 아키텍처 패턴 도입',
      '모듈 간 의존성 대폭 변경',
      'monorepo 구조 변경'
    ],
    rollbackStrategy: 'snapshot_rollback',
    rollbackDescription: '스냅샷으로 완전 롤백 (파일 시스템 변경이 광범위하므로)'
  },
  {
    changeType: 'DATA_STRUCTURE',
    requiresApproval: true,
    riskLevel: 'critical',
    description: '데이터 구조 및 스키마 변경',
    examples: [
      'database schema 변경',
      '핵심 인터페이스 수정',
      'API 응답 구조 변경',
      '저장 형식 변경'
    ],
    rollbackStrategy: 'graceful_abort',
    rollbackDescription: '데이터 무결성 보호를 위해 전체 세션 안전 중단'
  },
  {
    changeType: 'SECURITY_CONFIG',
    requiresApproval: true,
    riskLevel: 'critical',
    description: '보안 설정 및 권한 관련 변경',
    examples: [
      '인증/인가 로직 변경',
      'API 키 관련 설정',
      '보안 정책 수정',
      'CORS 설정 변경'
    ],
    rollbackStrategy: 'snapshot_rollback',
    rollbackDescription: '보안 설정은 즉시 롤백하여 보안 위험 최소화'
  },
  {
    changeType: 'SYSTEM_CONFIG',
    requiresApproval: true,
    riskLevel: 'high',
    description: '시스템 핵심 설정 파일 변경',
    examples: [
      'package.json scripts 변경',
      'tsconfig.json 변경',
      '.env 파일 변경',
      'CI/CD 파이프라인 수정'
    ],
    rollbackStrategy: 'revert',
    rollbackDescription: '설정 파일을 이전 버전으로 복원'
  },
  {
    changeType: 'EXTERNAL_INTEGRATION',
    requiresApproval: true,
    riskLevel: 'high',
    description: '외부 시스템 연동 변경',
    examples: [
      'API 엔드포인트 변경',
      '외부 서비스 연동 수정',
      '결제 시스템 연동',
      '3rd party 라이브러리 major 버전업'
    ],
    rollbackStrategy: 'graceful_abort',
    rollbackDescription: '외부 의존성 변경은 전체 테스트가 필요하므로 안전 중단'
  }
];

/**
 * 자동 승인 가능한 안전한 변경사항
 * - 코드 스타일 수정 (ESLint, Prettier)
 * - 문서화 업데이트
 * - 로그 메시지 개선
 * - 성능 최적화 (안전한 범위)
 * - 테스트 코드 추가/수정
 */
export const SAFE_AUTO_CHANGES: ApprovalCriteria[] = [
  {
    changeType: 'CODE_STYLE',
    requiresApproval: false,
    riskLevel: 'low',
    description: '코드 스타일 및 포맷팅 수정',
    examples: [
      'ESLint 경고 수정',
      'Prettier 포맷팅',
      '사용하지 않는 변수 제거',
      'import 순서 정리'
    ],
    rollbackStrategy: 'revert',
    rollbackDescription: '코드 스타일 변경은 git revert로 쉽게 복원 가능'
  },
  {
    changeType: 'DOCUMENTATION',
    requiresApproval: false,
    riskLevel: 'low',
    description: '문서 업데이트 및 주석 개선',
    examples: [
      'README.md 업데이트',
      '주석 추가/수정',
      '문서 타임스탬프 업데이트',
      'JSDoc 추가'
    ],
    rollbackStrategy: 'ignore',
    rollbackDescription: '문서 변경은 기능에 영향 없으므로 무시'
  },
  {
    changeType: 'LOGGING',
    requiresApproval: false,
    riskLevel: 'low',
    description: '로그 메시지 개선',
    examples: [
      '로그 메시지 명확화',
      '디버깅 정보 추가',
      '로그 레벨 조정 (비중요)',
      '에러 메시지 개선'
    ],
    rollbackStrategy: 'ignore',
    rollbackDescription: '로깅 변경은 시스템 동작에 영향 없음'
  },
  {
    changeType: 'PERFORMANCE_SAFE',
    requiresApproval: false,
    riskLevel: 'medium',
    description: '안전한 성능 최적화',
    examples: [
      '캐시 최적화',
      '불필요한 계산 제거',
      '메모리 사용량 개선',
      '쿼리 최적화 (안전한 범위)'
    ],
    rollbackStrategy: 'revert',
    rollbackDescription: '성능 변경은 예상치 못한 부작용 가능성'
  },
  {
    changeType: 'TESTING',
    requiresApproval: false,
    riskLevel: 'low',
    description: '테스트 코드 추가/수정',
    examples: [
      '단위 테스트 추가',
      '테스트 케이스 확장',
      'Mock 데이터 개선',
      '테스트 안정성 향상'
    ],
    rollbackStrategy: 'ignore',
    rollbackDescription: '테스트 코드는 운영 코드에 영향 없음'
  }
];

/**
 * 변경사항 분석하여 승인 필요 여부 판단
 */
export class ApprovalCriteriaAnalyzer {
  /**
   * 변경 내용을 분석하여 승인 필요 여부 결정
   */
  analyzeChange(changeDescription: string, filePaths: string[] = []): {
    requiresApproval: boolean;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    matchedCriteria: ApprovalCriteria | null;
    reason: string;
  } {
    const description = changeDescription.toLowerCase();

    // 중요 변경사항 체크
    for (const criteria of CRITICAL_CHANGES) {
      if (this.matchesCriteria(description, filePaths, criteria)) {
        return {
          requiresApproval: true,
          riskLevel: criteria.riskLevel,
          matchedCriteria: criteria,
          reason: `중요 변경사항 감지: ${criteria.description}`
        };
      }
    }

    // 안전한 자동 승인 변경사항 체크
    for (const criteria of SAFE_AUTO_CHANGES) {
      if (this.matchesCriteria(description, filePaths, criteria)) {
        return {
          requiresApproval: false,
          riskLevel: criteria.riskLevel,
          matchedCriteria: criteria,
          reason: `안전한 자동 승인: ${criteria.description}`
        };
      }
    }

    // 기본값: 확실하지 않으면 승인 요청 (안전한 방향)
    return {
      requiresApproval: true,
      riskLevel: 'medium',
      matchedCriteria: null,
      reason: '분류되지 않은 변경사항 - 안전을 위해 승인 요청'
    };
  }

  /**
   * 변경사항이 특정 기준과 매칭되는지 확인
   */
  private matchesCriteria(
    description: string,
    filePaths: string[],
    criteria: ApprovalCriteria
  ): boolean {
    // 설명 키워드 매칭
    const keywords = this.getKeywordsForCriteria(criteria.changeType);
    const descriptionMatches = keywords.some(keyword =>
      description.includes(keyword.toLowerCase())
    );

    // 파일 경로 매칭
    const pathMatches = this.getPathPatternsForCriteria(criteria.changeType)
      .some(pattern => filePaths.some(path => path.includes(pattern)));

    return descriptionMatches || pathMatches;
  }

  /**
   * 변경 타입별 키워드 정의
   */
  private getKeywordsForCriteria(changeType: string): string[] {
    const keywordMap: Record<string, string[]> = {
      'ARCHITECTURE_CHANGE': ['아키텍처', 'architecture', '구조 변경', 'refactor', '리팩토링'],
      'DATA_STRUCTURE': ['스키마', 'schema', '인터페이스', 'interface', 'type', '데이터 구조'],
      'SECURITY_CONFIG': ['보안', 'security', '인증', 'auth', '권한', '토큰', 'token'],
      'SYSTEM_CONFIG': ['설정', 'config', 'package.json', 'tsconfig', '.env'],
      'EXTERNAL_INTEGRATION': ['api', 'endpoint', '외부', 'external', '연동', 'integration'],
      'CODE_STYLE': ['eslint', 'prettier', '포맷', 'format', '스타일', 'style'],
      'DOCUMENTATION': ['문서', 'doc', 'readme', '주석', 'comment'],
      'LOGGING': ['로그', 'log', '디버그', 'debug', 'console'],
      'PERFORMANCE_SAFE': ['성능', 'performance', '최적화', 'optimize', '캐시', 'cache'],
      'TESTING': ['테스트', 'test', 'spec', '단위', 'unit', 'mock']
    };

    return keywordMap[changeType] || [];
  }

  /**
   * 변경 타입별 파일 경로 패턴
   */
  private getPathPatternsForCriteria(changeType: string): string[] {
    const pathMap: Record<string, string[]> = {
      'ARCHITECTURE_CHANGE': ['src/', 'lib/', 'modules/', 'components/'],
      'DATA_STRUCTURE': ['.ts', '.interface.ts', '.type.ts', 'schema'],
      'SECURITY_CONFIG': ['.env', 'auth', 'security', 'token'],
      'SYSTEM_CONFIG': ['package.json', 'tsconfig.json', '.env', 'webpack', 'rollup'],
      'EXTERNAL_INTEGRATION': ['api/', 'services/', 'clients/', 'integrations/'],
      'CODE_STYLE': ['.ts', '.js', '.tsx', '.jsx'],
      'DOCUMENTATION': ['.md', 'docs/', 'README'],
      'LOGGING': ['log', 'debug', 'console'],
      'PERFORMANCE_SAFE': ['cache', 'optimize', 'performance'],
      'TESTING': ['test', 'spec', '__tests__', '.test.', '.spec.']
    };

    return pathMap[changeType] || [];
  }
}

export const approvalAnalyzer = new ApprovalCriteriaAnalyzer();