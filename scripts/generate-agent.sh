#!/bin/bash

# 표준을 준수하는 새 에이전트 자동 생성 스크립트

set -e

# 인자 파싱
AGENT_NAME=""
DOMAIN=""
CAPABILITIES=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --name)
            AGENT_NAME="$2"
            shift 2
            ;;
        --domain)
            DOMAIN="$2"
            shift 2
            ;;
        --capabilities)
            CAPABILITIES="$2"
            shift 2
            ;;
        --help)
            echo "사용법: $0 --name <AgentName> [--domain <domain>] [--capabilities <cap1,cap2>]"
            echo ""
            echo "예시:"
            echo "  $0 --name DataAnalyst --domain data_analysis --capabilities 'data-processing,visualization'"
            exit 0
            ;;
        *)
            echo "알 수 없는 옵션: $1"
            echo "사용법을 보려면 --help를 사용하세요"
            exit 1
            ;;
    esac
done

# 필수 인자 확인
if [ -z "$AGENT_NAME" ]; then
    echo "❌ 에이전트 이름이 필요합니다. --name 옵션을 사용하세요"
    exit 1
fi

# 기본값 설정
if [ -z "$DOMAIN" ]; then
    DOMAIN=$(echo "$AGENT_NAME" | sed 's/\([A-Z]\)/_\1/g' | sed 's/^_//' | tr '[:upper:]' '[:lower:]')
fi

if [ -z "$CAPABILITIES" ]; then
    CAPABILITIES=$(echo "$AGENT_NAME" | sed 's/\([A-Z]\)/-\1/g' | sed 's/^-//' | tr '[:upper:]' '[:lower:]')
fi

# 파일명 생성 (camelCase)
AGENT_FILENAME=$(echo "$AGENT_NAME" | awk '{print tolower(substr($0,1,1))substr($0,2)}')
AGENT_FILE="src/agents/${AGENT_FILENAME}.ts"
TEST_FILE="tests/${AGENT_FILENAME}.test.ts"

echo "🚀 새 에이전트 생성: $AGENT_NAME"
echo "📁 에이전트 파일: $AGENT_FILE"
echo "🧪 테스트 파일: $TEST_FILE"
echo "🏷️  도메인: $DOMAIN"
echo "⚡ 기능: $CAPABILITIES"
echo ""

# 파일 존재 확인
if [ -f "$AGENT_FILE" ]; then
    echo "❌ 에이전트 파일이 이미 존재합니다: $AGENT_FILE"
    exit 1
fi

if [ -f "$TEST_FILE" ]; then
    echo "❌ 테스트 파일이 이미 존재합니다: $TEST_FILE"
    exit 1
fi

# 에이전트 파일 생성
echo "📝 에이전트 구현 생성 중..."

cat > "$AGENT_FILE" << EOF
import { BaseAgent } from '../core/baseAgent.js';
import { AgentMessage, AgentResult, AgentContext } from '../shared/types.js';
import { Logger } from '../shared/logger.js';

export interface ${AGENT_NAME}Request {
  // TODO: 에이전트별 요청 타입 정의
  input: string;
  options?: {
    // TODO: 옵션 정의
  };
}

export interface ${AGENT_NAME}Response {
  // TODO: 에이전트별 응답 타입 정의
  output: string;
  confidence: number;
  metadata?: Record<string, unknown>;
}

export class ${AGENT_NAME} extends BaseAgent {
  constructor(logger?: Logger) {
    super(
      '$(echo "$AGENT_NAME" | sed 's/\([A-Z]\)/-\1/g' | sed 's/^-//' | tr '[:upper:]' '[:lower:]')',
      '$DOMAIN',
      ['$CAPABILITIES'],
      logger || new Logger()
    );
  }

  /**
   * ${AGENT_NAME} 핵심 처리 로직
   */
  protected async handle(content: unknown, context?: AgentContext): Promise<${AGENT_NAME}Response> {
    const request = content as ${AGENT_NAME}Request;

    try {
      // TODO: 에이전트별 비즈니스 로직 구현
      const result = await this.process${AGENT_NAME}(request, context);

      return {
        output: result,
        confidence: 0.85, // TODO: 실제 신뢰도 계산
        metadata: {
          processedAt: new Date().toISOString(),
          agentId: this.id
        }
      };
    } catch (error) {
      this.logger.error(\`${AGENT_NAME} processing failed\`, { error, request });
      throw error;
    }
  }

  /**
   * ${AGENT_NAME} 전용 처리 메서드
   */
  private async process${AGENT_NAME}(
    request: ${AGENT_NAME}Request,
    context?: AgentContext
  ): Promise<string> {
    // TODO: 실제 처리 로직 구현
    this.logger.info(\`Processing ${AGENT_NAME} request\`, {
      inputLength: request.input.length,
      context: context?.taskId
    });

    // 예시 구현 - 실제 로직으로 교체 필요
    return \`Processed: \${request.input}\`;
  }

  /**
   * ${AGENT_NAME} 성능 메트릭 수집
   */
  public getPerformanceMetrics(): Record<string, number> {
    return {
      ...super.getPerformanceMetrics(),
      // TODO: 에이전트별 특화 메트릭 추가
      processingAccuracy: 0.85,
      averageResponseTime: 1200
    };
  }
}
EOF

echo "✅ 에이전트 구현 생성 완료"

# 테스트 파일 생성
echo "🧪 테스트 파일 생성 중..."

cat > "$TEST_FILE" << EOF
import { describe, it, expect } from 'vitest';
import { ${AGENT_NAME} } from '../src/agents/$(basename "$AGENT_FILE" .ts)';
import { Logger } from '../src/shared/logger';

describe('${AGENT_NAME}', () => {
  it('should create instance correctly', () => {
    const logger = new Logger();
    const agent = new ${AGENT_NAME}(logger);
    expect(agent).toBeDefined();
    expect(agent.id).toBe('$(echo "$AGENT_NAME" | sed 's/\([A-Z]\)/-\1/g' | sed 's/^-//' | tr '[:upper:]' '[:lower:]')');
  });

  it('should have correct specialization', () => {
    const logger = new Logger();
    const agent = new ${AGENT_NAME}(logger);
    expect(agent.specialization).toBe('$DOMAIN');
  });

  it('should have required capabilities', () => {
    const logger = new Logger();
    const agent = new ${AGENT_NAME}(logger);
    expect(agent.tags).toContain('$CAPABILITIES');
  });

  it('should process requests correctly', async () => {
    const logger = new Logger();
    const agent = new ${AGENT_NAME}(logger);

    const message = {
      id: 'test-1',
      sender: 'test',
      receiver: '$(echo "$AGENT_NAME" | sed 's/\([A-Z]\)/-\1/g' | sed 's/^-//' | tr '[:upper:]' '[:lower:]')',
      type: 'request' as const,
      content: {
        input: 'test input',
        options: {}
      },
      timestamp: new Date(),
      priority: 3 as const
    };

    const result = await agent.processMessage(message);
    expect(result).toBeDefined();
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data).toBeDefined();
      expect(typeof result.data).toBe('object');
    }
  });

  it('should collect performance metrics', () => {
    const logger = new Logger();
    const agent = new ${AGENT_NAME}(logger);

    const metrics = agent.getPerformanceMetrics();
    expect(metrics).toBeDefined();
    expect(typeof metrics.processingAccuracy).toBe('number');
    expect(typeof metrics.averageResponseTime).toBe('number');
  });
});
EOF

echo "✅ 테스트 파일 생성 완료"

# 생성된 파일 검증
echo "🔍 생성된 파일 검증 중..."

# TypeScript 컴파일 테스트
if npx tsc --noEmit "$AGENT_FILE" 2>/dev/null; then
    echo "✅ TypeScript 컴파일 검증 통과"
else
    echo "⚠️  TypeScript 컴파일 경고 (TODO 구현 필요)"
fi

# 테스트 실행
echo "🧪 테스트 실행 중..."
if npm run test "$TEST_FILE" --silent; then
    echo "✅ 테스트 통과"
else
    echo "⚠️  테스트 실패 (TODO 구현 완료 후 재테스트 필요)"
fi

echo ""
echo "🎉 ${AGENT_NAME} 에이전트 생성 완료!"
echo ""
echo "📝 다음 단계:"
echo "  1. $AGENT_FILE 에서 TODO 항목들을 구현하세요"
echo "  2. $TEST_FILE 에서 추가 테스트케이스를 작성하세요"
echo "  3. 구현 완료 후 테스트 실행: npm run test $TEST_FILE"
echo "  4. 전체 품질 검사: npm run ci:quality"
echo ""
echo "📚 참고 문서:"
echo "  - docs/DEVELOPMENT_STANDARDS.md"
echo "  - 기존 에이전트 구현 예시: src/agents/qaGenerator.ts"
echo ""
echo "✨ 즐거운 개발 되세요!"
EOF

echo "✅ 에이전트 생성 도구 완성"