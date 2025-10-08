#!/usr/bin/env tsx
/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */


/**
 * Design Principle Mapper - 탐지된 이슈를 설계 원칙 위반으로 연결
 * 각 이슈가 "왜" 중요한지 아키텍처 관점에서 설명 제공
 */

interface DesignPrinciple {
  id: string;
  category:
    | "ARCH"
    | "SECURITY"
    | "PERFORMANCE"
    | "MAINTAINABILITY"
    | "RELIABILITY";
  name: string;
  description: string;
  impact: string;
  examples: string[];
}

interface IssueMappingResult {
  principle: DesignPrinciple;
  violationType: "direct" | "indirect" | "potential";
  severity: "critical" | "major" | "minor";
  explanation: string;
  suggestedAction: string;
}

export class DesignPrincipleMapper {
  private principles: DesignPrinciple[] = [
    // Architecture Principles
    {
      id: "ARCH.COMPILATION.01",
      category: "ARCH",
      name: "Compilation Success = Runtime Integrity",
      description: "모든 코드는 컴파일 타임에 오류 없이 빌드되어야 함",
      impact: "컴파일 오류는 런타임 예측불가능성과 직접 연결됨",
      examples: [
        "TypeScript errors",
        "Import/export mismatches",
        "Type inconsistencies",
      ],
    },
    {
      id: "ARCH.INTERFACE.02",
      category: "ARCH",
      name: "Interface Consistency",
      description: "모든 인터페이스와 메서드 시그니처는 일관성을 유지해야 함",
      impact: "인터페이스 불일치는 런타임 오류와 개발자 혼란 야기",
      examples: [
        "Method signature mismatches",
        "API contract violations",
        "Type definition conflicts",
      ],
    },
    {
      id: "ARCH.MODULE.03",
      category: "ARCH",
      name: "Module System Coherence",
      description: "모듈 시스템은 일관된 패턴을 따라야 함 (ESM vs CommonJS)",
      impact: "Node.js 호환성 문제와 모듈 로딩 실패 방지",
      examples: [
        "ESM/CommonJS mixing",
        "Import path inconsistencies",
        "Module resolution failures",
      ],
    },

    // Security Principles
    {
      id: "SEC.VALIDATION.01",
      category: "SECURITY",
      name: "Input Validation First",
      description: "모든 외부 입력은 검증되어야 함",
      impact: "검증되지 않은 입력은 보안 취약점과 시스템 불안정성 야기",
      examples: [
        "Schema validation",
        "Type checking",
        "Configuration validation",
      ],
    },
    {
      id: "SEC.ACCESS.02",
      category: "SECURITY",
      name: "Proper Access Controls",
      description: "적절한 권한 제어와 파일 접근 관리",
      impact: "권한 문제는 보안 위험과 운영 장애 발생",
      examples: ["File permissions", "Directory access", "Resource protection"],
    },

    // Performance Principles
    {
      id: "PERF.EFFICIENCY.01",
      category: "PERFORMANCE",
      name: "Resource Efficiency",
      description: "시스템 리소스는 효율적으로 사용되어야 함",
      impact: "비효율적 리소스 사용은 성능 저하와 확장성 문제 야기",
      examples: ["Memory usage", "CPU optimization", "I/O efficiency"],
    },

    // Maintainability Principles
    {
      id: "MAINT.CLARITY.01",
      category: "MAINTAINABILITY",
      name: "Code Clarity and Documentation",
      description: "코드는 명확하고 잘 문서화되어야 함",
      impact: "불명확한 코드는 유지보수 비용 증가와 버그 발생률 증가",
      examples: [
        "Naming conventions",
        "Documentation completeness",
        "Code readability",
      ],
    },
    {
      id: "MAINT.CONSISTENCY.02",
      category: "MAINTAINABILITY",
      name: "Pattern Consistency",
      description: "코딩 패턴과 아키텍처 구조는 일관성을 유지해야 함",
      impact: "패턴 불일치는 개발자 혼란과 버그 증가 야기",
      examples: [
        "Architectural patterns",
        "Error handling patterns",
        "Logging patterns",
      ],
    },

    // Reliability Principles
    {
      id: "REL.RESILIENCE.01",
      category: "RELIABILITY",
      name: "Failure Resilience",
      description: "시스템은 장애 상황에서도 graceful하게 처리해야 함",
      impact: "복원력 부족은 시스템 전체 장애로 확산될 수 있음",
      examples: [
        "Error boundaries",
        "Circuit breakers",
        "Timeout handling",
        "Retry mechanisms",
      ],
    },
    {
      id: "REL.MONITORING.02",
      category: "RELIABILITY",
      name: "Observability Requirements",
      description: "시스템 상태는 관찰 가능하고 추적 가능해야 함",
      impact: "관찰 불가능한 시스템은 문제 진단과 해결이 어려움",
      examples: [
        "Logging standards",
        "Metrics collection",
        "Tracing capabilities",
      ],
    },
  ];

  /**
   * 이슈 카테고리와 내용을 분석하여 해당하는 설계 원칙 찾기
   */
  mapIssueToDesignPrinciple(issue: {
    category: string;
    title: string;
    description: string;
    severity: string;
    impact: string;
  }): IssueMappingResult | null {
    // TypeScript 컴파일 오류
    if (
      issue.category === "TypeScript Compilation" ||
      issue.title.includes("TypeScript")
    ) {
      return {
        principle: this.principles.find((p) => p.id === "ARCH.COMPILATION.01")!,
        violationType: "direct",
        severity: "critical",
        explanation: `TypeScript 컴파일 오류는 코드가 런타임에 예기치 않게 실패할 가능성을 나타냅니다. 이는 아키텍처 무결성의 기본 전제조건을 위반합니다.`,
        suggestedAction:
          "모든 TypeScript 오류를 즉시 수정하여 컴파일 성공을 보장하세요.",
      };
    }

    // 메서드 시그니처 불일치
    if (
      issue.category === "Method Signatures" ||
      issue.title.includes("Method Signature")
    ) {
      return {
        principle: this.principles.find((p) => p.id === "ARCH.INTERFACE.02")!,
        violationType: "direct",
        severity: "major",
        explanation: `메서드 시그니처 불일치는 인터페이스 계약 위반을 의미하며, 런타임에 예상치 못한 오류를 발생시킬 수 있습니다.`,
        suggestedAction:
          "모든 메서드 호출을 최신 인터페이스 정의에 맞춰 수정하세요.",
      };
    }

    // Node.js 호환성 문제
    if (
      issue.category === "Node.js Compatibility" ||
      issue.title.includes("Node.js")
    ) {
      return {
        principle: this.principles.find((p) => p.id === "ARCH.MODULE.03")!,
        violationType: "direct",
        severity: "major",
        explanation: `Node.js 호환성 문제는 모듈 시스템의 일관성 부족을 나타내며, 런타임 환경에서 모듈 로딩 실패를 야기할 수 있습니다.`,
        suggestedAction:
          "ESM과 CommonJS 사용을 일관되게 정리하고, Node.js 표준 패턴을 따르세요.",
      };
    }

    // 스키마 검증
    if (
      issue.category === "Schema Validation" ||
      issue.title.includes("Schema")
    ) {
      return {
        principle: this.principles.find((p) => p.id === "SEC.VALIDATION.01")!,
        violationType: "direct",
        severity: "critical",
        explanation: `스키마 검증 실패는 외부 입력에 대한 검증이 부족함을 의미하며, 보안 취약점과 시스템 불안정을 초래할 수 있습니다.`,
        suggestedAction:
          "모든 외부 입력과 설정에 대해 적절한 스키마 검증을 구현하세요.",
      };
    }

    // 런타임 가드레일
    if (
      issue.category === "Runtime Guardrails" ||
      issue.title.includes("Runtime")
    ) {
      return {
        principle: this.principles.find((p) => p.id === "REL.RESILIENCE.01")!,
        violationType: "direct",
        severity: "critical",
        explanation: `런타임 보호 장치 부족은 시스템이 예외 상황에서 적절히 대처하지 못함을 의미하며, 전체 시스템 장애로 확산될 위험이 있습니다.`,
        suggestedAction:
          "Error boundaries, 타임아웃, 재시도 로직 등 적절한 보호 장치를 구현하세요.",
      };
    }

    // Import/Export 일관성
    if (
      issue.category === "Import/Export Consistency" ||
      issue.title.includes("Import") ||
      issue.title.includes("Export")
    ) {
      return {
        principle: this.principles.find((p) => p.id === "ARCH.MODULE.03")!,
        violationType: "direct",
        severity: "major",
        explanation: `Import/Export 불일치는 모듈 간 의존성 관계가 명확하지 않음을 의미하며, 빌드 실패와 런타임 오류를 야기할 수 있습니다.`,
        suggestedAction:
          "모든 모듈의 import/export 문을 검토하고 일관된 패턴으로 정리하세요.",
      };
    }

    // 명명 규칙
    if (issue.category === "Naming Clarity" || issue.title.includes("Naming")) {
      return {
        principle: this.principles.find((p) => p.id === "MAINT.CLARITY.01")!,
        violationType: "indirect",
        severity: "minor",
        explanation: `명명 규칙 일관성 부족은 코드 가독성을 저해하고, 유지보수 시 개발자 혼란을 야기할 수 있습니다.`,
        suggestedAction:
          "일관된 명명 규칙을 정의하고 프로젝트 전체에 적용하세요.",
      };
    }

    // 리포트 포맷
    if (issue.category === "Report Format" || issue.title.includes("Report")) {
      return {
        principle: this.principles.find((p) => p.id === "REL.MONITORING.02")!,
        violationType: "indirect",
        severity: "minor",
        explanation: `리포트 포맷 불일치는 시스템 관찰 가능성을 저해하며, 문제 진단과 모니터링을 어렵게 만듭니다.`,
        suggestedAction:
          "모든 리포트와 로그에 일관된 포맷을 적용하여 관찰 가능성을 향상시키세요.",
      };
    }

    // 기본적으로 유지보수성 원칙으로 매핑
    return {
      principle: this.principles.find((p) => p.id === "MAINT.CONSISTENCY.02")!,
      violationType: "potential",
      severity: "minor",
      explanation: `이 이슈는 시스템의 일관성과 유지보수성에 영향을 줄 수 있습니다.`,
      suggestedAction: "시스템 전체의 패턴 일관성을 검토하고 개선하세요.",
    };
  }

  /**
   * 이슈에 설계 원칙 정보 첨부
   */
  enhanceIssueWithDesignPrinciple(issue: any): any {
    const mapping = this.mapIssueToDesignPrinciple(issue);

    if (!mapping) {
      return issue;
    }

    return {
      ...issue,
      designPrinciple: {
        id: mapping.principle.id,
        name: mapping.principle.name,
        category: mapping.principle.category,
        violationType: mapping.violationType,
        explanation: mapping.explanation,
        suggestedAction: mapping.suggestedAction,
        architecturalImpact: mapping.principle.impact,
      },
    };
  }

  /**
   * 여러 이슈에 대해 일괄 설계 원칙 매핑
   */
  enhanceIssuesWithDesignPrinciples(issues: any[]): any[] {
    return issues.map((issue) => this.enhanceIssueWithDesignPrinciple(issue));
  }

  /**
   * 설계 원칙 위반 요약 생성
   */
  generateViolationSummary(enhancedIssues: any[]): string {
    const violationsByPrinciple: Record<string, any[]> = {};

    enhancedIssues.forEach((issue) => {
      if (issue.designPrinciple) {
        const principleId = issue.designPrinciple.id;
        if (!violationsByPrinciple[principleId]) {
          violationsByPrinciple[principleId] = [];
        }
        violationsByPrinciple[principleId].push(issue);
      }
    });

    let summary = "\n🏗️ Design Principle Violations Summary:\n";
    summary += "═".repeat(60) + "\n";

    Object.entries(violationsByPrinciple).forEach(
      ([principleId, violations]) => {
        const principle = violations[0].designPrinciple;
        const criticalCount = violations.filter(
          (v) => v.severity === "P0",
        ).length;
        const majorCount = violations.filter((v) => v.severity === "P1").length;

        summary += `\n🎯 ${principle.name} (${principleId})\n`;
        summary += `   Category: ${principle.category}\n`;
        summary += `   Violations: ${violations.length} (🚨 ${criticalCount} critical, ⚠️ ${majorCount} major)\n`;
        summary += `   Impact: ${principle.architecturalImpact}\n`;

        if (violations.length <= 3) {
          violations.forEach((violation) => {
            summary += `   • ${violation.title}\n`;
          });
        } else {
          summary += `   • ${violations[0].title}\n`;
          summary += `   • ... and ${violations.length - 1} more\n`;
        }
      },
    );

    return summary;
  }

  /**
   * 모든 설계 원칙 목록 조회
   */
  getAllPrinciples(): DesignPrinciple[] {
    return this.principles;
  }

  /**
   * 특정 카테고리의 설계 원칙 조회
   */
  getPrinciplesByCategory(
    category: DesignPrinciple["category"],
  ): DesignPrinciple[] {
    return this.principles.filter((p) => p.category === category);
  }
}

export default DesignPrincipleMapper;
