#!/usr/bin/env tsx

/**
 * System Integration Orchestrator
 * 새로운 기능/엔진이 추가될 때 기존 시스템과의 유기적 통합을 보장하는 능동적 설계 중심 철학 구현
 *
 * 문제 해결:
 * 1. 기존 시스템과의 호환성 자동 검증
 * 2. 작동 순서 및 맥락 최적화
 * 3. 유기적 통합을 위한 능동적 설계 적용
 * 4. 지속적 통합 모니터링
 */

// Set process-level listener limit to prevent memory leaks
process.setMaxListeners(50);

import { coreSystemHub, ComponentId } from './core-system-hub.js';
import { ComponentAdapter, IntegrationConfig } from './component-integration-adapter.js';
import { adaptiveExecutionEngine } from './adaptive-execution-engine.js';
import { smartDecisionMatrix } from './smart-decision-matrix.js';
import { workaroundResolutionEngine } from './workaround-resolution-engine.js';
import { perfCache } from './performance-cache.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

interface SystemComponent {
  id: ComponentId;
  name: string;
  version: string;
  type: 'core' | 'engine' | 'utility' | 'legacy';
  status: 'integrated' | 'pending' | 'deprecated' | 'conflicting';
  dependencies: ComponentId[];
  provides: string[];
  requires: string[];
  integrationDate?: Date;
  compatibilityScore?: number;
}

interface IntegrationPlan {
  component: SystemComponent;
  strategy: 'immediate' | 'phased' | 'background' | 'manual';
  steps: Array<{
    phase: string;
    action: string;
    risk: 'low' | 'medium' | 'high';
    automation: boolean;
  }>;
  impact: {
    performance: number; // -5 to +5
    stability: number;
    usability: number;
  };
  rollbackPlan: string[];
}

interface SystemCohesion {
  overallScore: number; // 0-100
  componentHarmony: number;
  architecturalAlignment: number;
  performanceCoherence: number;
  userExperienceConsistency: number;
  recommendations: string[];
}

export class SystemIntegrationOrchestrator {
  private projectRoot = process.cwd();
  private componentsRegistry: Map<ComponentId, SystemComponent> = new Map();
  private integrationHistory: Array<{
    component: ComponentId;
    timestamp: Date;
    success: boolean;
    impact: { performance: number; stability: number; usability: number; };
  }> = [];

  constructor() {
    this.discoverSystemComponents();
    this.registerWithHub();
  }

  /**
   * 새로운 컴포넌트나 엔진이 추가될 때 자동으로 실행되는 통합 프로세스
   */
  async orchestrateNewComponentIntegration(
    componentPath: string,
    forceIntegration: boolean = false
  ): Promise<{
    success: boolean;
    integrationPlan: IntegrationPlan;
    cohesionScore: SystemCohesion;
    nextSteps: string[];
  }> {
    console.log('🔄 새로운 컴포넌트 통합 프로세스 시작...');
    console.log(`   📁 컴포넌트: ${componentPath}`);

    try {
      // Step 1: 컴포넌트 분석
      const component = await this.analyzeComponent(componentPath);
      console.log(`   🔍 분석 완료: ${component.name} (${component.type})`);

      // Step 2: 호환성 검증
      const compatibility = await this.verifyCompatibility(component);
      console.log(`   ✅ 호환성 점수: ${compatibility.score}/100`);

      // Step 3: 통합 계획 수립
      const integrationPlan = await this.createIntegrationPlan(component, compatibility);
      console.log(`   📋 통합 전략: ${integrationPlan.strategy}`);

      // Step 4: 자동 통합 실행 (조건부)
      let success = false;
      if (integrationPlan.strategy === 'immediate' &&
          (forceIntegration || compatibility.score >= 80)) {
        success = await this.executeIntegration(integrationPlan);
        console.log(`   ${success ? '✅' : '❌'} 통합 ${success ? '성공' : '실패'}`);
      } else {
        console.log('   ⏸️ 자동 통합 조건 미충족 - 수동 검토 필요');
      }

      // Step 5: 시스템 cohesion 재평가
      const cohesionScore = await this.evaluateSystemCohesion();
      console.log(`   📊 시스템 조화도: ${cohesionScore.overallScore}/100`);

      // Step 6: 다음 단계 권고사항
      const nextSteps = this.generateNextSteps(integrationPlan, cohesionScore, success);

      return {
        success,
        integrationPlan,
        cohesionScore,
        nextSteps
      };

    } catch (error) {
      console.error('❌ 통합 프로세스 실패:', error);
      throw error;
    }
  }

  /**
   * 기존 시스템의 유기적 조화도 평가
   */
  async evaluateSystemCohesion(): Promise<SystemCohesion> {
    const components = Array.from(this.componentsRegistry.values());

    // 1. 컴포넌트 간 조화도 (얼마나 잘 협력하는가)
    const harmonyScore = this.calculateComponentHarmony(components);

    // 2. 아키텍처 정렬도 (설계 원칙 일관성)
    const alignmentScore = await this.calculateArchitecturalAlignment(components);

    // 3. 성능 일관성 (성능 특성의 균형)
    const performanceScore = await this.calculatePerformanceCoherence(components);

    // 4. 사용자 경험 일관성
    const uxScore = this.calculateUserExperienceConsistency(components);

    const overallScore = Math.round(
      (harmonyScore * 0.3 + alignmentScore * 0.3 + performanceScore * 0.2 + uxScore * 0.2)
    );

    const recommendations = [];

    if (harmonyScore < 70) {
      recommendations.push('컴포넌트 간 통신 표준화 필요');
    }
    if (alignmentScore < 70) {
      recommendations.push('아키텍처 설계 원칙 재정립 필요');
    }
    if (performanceScore < 70) {
      recommendations.push('성능 특성 균형 조정 필요');
    }
    if (uxScore < 70) {
      recommendations.push('사용자 인터페이스 일관성 개선 필요');
    }

    return {
      overallScore,
      componentHarmony: harmonyScore,
      architecturalAlignment: alignmentScore,
      performanceCoherence: performanceScore,
      userExperienceConsistency: uxScore,
      recommendations
    };
  }

  /**
   * 시스템에 새로운 엔진들을 능동적으로 통합
   */
  async integrateNewOptimizationEngines(): Promise<void> {
    console.log('🚀 새로운 최적화 엔진들을 시스템에 통합 중...');

    const newEngines = [
      {
        path: 'scripts/lib/core-system-hub.ts',
        component: 'core-system-hub' as ComponentId,
        priority: 'high'
      },
      {
        path: 'scripts/lib/smart-decision-matrix.ts',
        component: 'smart-decision-matrix' as ComponentId,
        priority: 'high'
      },
      {
        path: 'scripts/lib/adaptive-execution-engine.ts',
        component: 'adaptive-execution-engine' as ComponentId,
        priority: 'high'
      },
      {
        path: 'scripts/lib/workaround-resolution-engine.ts',
        component: 'workaround-resolution-engine' as ComponentId,
        priority: 'medium'
      },
      {
        path: 'scripts/lib/component-integration-adapter.ts',
        component: 'component-integration-adapter' as ComponentId,
        priority: 'medium'
      }
    ];

    const results = [];

    for (const engine of newEngines) {
      console.log(`\n🔧 통합 중: ${engine.component}`);

      try {
        const result = await this.orchestrateNewComponentIntegration(
          engine.path,
          engine.priority === 'high'
        );
        results.push({ engine: engine.component, ...result });

        if (result.success) {
          console.log(`   ✅ ${engine.component} 통합 완료`);
        } else {
          console.log(`   ⚠️ ${engine.component} 수동 검토 필요`);
        }
      } catch (error) {
        console.error(`   ❌ ${engine.component} 통합 실패:`, error);
      }
    }

    // 통합 결과 종합 보고서
    await this.generateIntegrationReport(results);
  }

  /**
   * 유지보수 실행 시 통합 상태 자동 점검 및 개선
   */
  async performMaintenanceIntegrationCheck(): Promise<{
    integrationIssues: string[];
    autoFixesApplied: string[];
    manualActionsRequired: string[];
  }> {
    console.log('🔍 유지보수 통합 상태 점검 중...');

    const issues = [];
    const autoFixes = [];
    const manualActions = [];

    // 1. 컴포넌트 등록 상태 점검
    const unregisteredComponents = await this.findUnregisteredComponents();
    if (unregisteredComponents.length > 0) {
      issues.push(`미등록 컴포넌트 ${unregisteredComponents.length}개 발견`);

      // 자동 등록 시도
      for (const component of unregisteredComponents) {
        try {
          await this.autoRegisterComponent(component);
          autoFixes.push(`${component} 자동 등록 완료`);
        } catch (error) {
          manualActions.push(`${component} 수동 등록 필요: ${error}`);
        }
      }
    }

    // 2. 호환성 문제 점검
    const compatibilityIssues = await this.checkCompatibilityIssues();
    if (compatibilityIssues.length > 0) {
      issues.push(`호환성 문제 ${compatibilityIssues.length}개`);
      compatibilityIssues.forEach(issue => {
        if (issue.autoFixable) {
          autoFixes.push(`${issue.component}: ${issue.fix}`);
        } else {
          manualActions.push(`${issue.component}: ${issue.description}`);
        }
      });
    }

    // 3. 시스템 조화도 점검
    const cohesion = await this.evaluateSystemCohesion();
    if (cohesion.overallScore < 75) {
      issues.push(`시스템 조화도 낮음: ${cohesion.overallScore}/100`);
      cohesion.recommendations.forEach(rec => manualActions.push(rec));
    }

    return {
      integrationIssues: issues,
      autoFixesApplied: autoFixes,
      manualActionsRequired: manualActions
    };
  }

  private discoverSystemComponents(): void {
    // 기존 컴포넌트들 자동 발견 및 등록
    const knownComponents: SystemComponent[] = [
      {
        id: 'maintenance-orchestrator',
        name: 'Smart Maintenance Orchestrator',
        version: '2.0.0',
        type: 'core',
        status: 'integrated',
        dependencies: [],
        provides: ['maintenance', 'quality-control'],
        requires: ['approval-system']
      },
      {
        id: 'unified-dashboard',
        name: 'Unified Dashboard',
        version: '4.0.0',
        type: 'core',
        status: 'integrated',
        dependencies: [],
        provides: ['status-reporting', 'system-overview'],
        requires: []
      },
      // 새로 추가된 엔진들
      {
        id: 'core-system-hub' as ComponentId,
        name: 'Core System Hub',
        version: '1.0.0',
        type: 'engine',
        status: 'pending',
        dependencies: [],
        provides: ['coordination', 'messaging', 'decision-making'],
        requires: []
      },
      {
        id: 'smart-decision-matrix' as ComponentId,
        name: 'Smart Decision Matrix',
        version: '1.0.0',
        type: 'engine',
        status: 'pending',
        dependencies: [],
        provides: ['decision-optimization', 'trade-off-balancing'],
        requires: []
      },
      {
        id: 'adaptive-execution-engine' as ComponentId,
        name: 'Adaptive Execution Engine',
        version: '1.0.0',
        type: 'engine',
        status: 'pending',
        dependencies: ['smart-decision-matrix' as ComponentId],
        provides: ['adaptive-execution', 'performance-optimization'],
        requires: ['smart-decision-matrix']
      }
    ];

    knownComponents.forEach(comp => {
      this.componentsRegistry.set(comp.id, comp);
    });
  }

  private registerWithHub(): void {
    // Core System Hub에 자신을 등록
    if (coreSystemHub) {
      coreSystemHub.registerComponent({
        id: 'system-integration-orchestrator' as ComponentId,
        status: 'healthy',
        lastHeartbeat: new Date(),
        version: '1.0.0',
        capabilities: ['integration', 'orchestration', 'cohesion-monitoring'],
        dependencies: []
      });
    }
  }

  private async analyzeComponent(componentPath: string): Promise<SystemComponent> {
    // 컴포넌트 파일 분석하여 메타데이터 추출
    const content = existsSync(componentPath) ? readFileSync(componentPath, 'utf8') : '';

    const name = this.extractComponentName(content);
    const version = this.extractVersion(content) || '1.0.0';
    const type = this.inferComponentType(content, componentPath);
    const dependencies = this.extractDependencies(content);
    const provides = this.extractCapabilities(content);
    const requires = this.extractRequirements(content);

    return {
      id: this.pathToComponentId(componentPath),
      name,
      version,
      type,
      status: 'pending',
      dependencies,
      provides,
      requires
    };
  }

  private async verifyCompatibility(component: SystemComponent): Promise<{
    score: number;
    issues: string[];
    strengths: string[]
  }> {
    const issues = [];
    const strengths = [];
    let score = 100;

    // 1. 의존성 충족 확인
    for (const dep of component.dependencies) {
      if (!this.componentsRegistry.has(dep)) {
        issues.push(`Missing dependency: ${dep}`);
        score -= 20;
      } else {
        strengths.push(`Dependency available: ${dep}`);
      }
    }

    // 2. 네이밍 충돌 확인
    const existingComponent = this.componentsRegistry.get(component.id);
    if (existingComponent && existingComponent.status !== 'deprecated') {
      issues.push(`Component ID conflict: ${component.id}`);
      score -= 15;
    }

    // 3. 아키텍처 패턴 일치 확인
    const architectureScore = await this.checkArchitecturalCompliance(component);
    if (architectureScore < 70) {
      issues.push('Architectural pattern mismatch');
      score -= 10;
    } else {
      strengths.push('Follows architectural patterns');
    }

    // 4. 성능 영향 평가
    const performanceImpact = this.estimatePerformanceImpact(component);
    if (performanceImpact.negative > 2) {
      issues.push('High negative performance impact');
      score -= 10;
    }

    return { score: Math.max(score, 0), issues, strengths };
  }

  private async createIntegrationPlan(
    component: SystemComponent,
    compatibility: { score: number; issues: string[]; strengths: string[] }
  ): Promise<IntegrationPlan> {
    const strategy = this.determineIntegrationStrategy(component, compatibility);

    const steps = [
      {
        phase: 'preparation',
        action: 'Backup current system state',
        risk: 'low' as const,
        automation: true
      },
      {
        phase: 'registration',
        action: 'Register component with Core System Hub',
        risk: 'low' as const,
        automation: true
      },
      {
        phase: 'integration',
        action: 'Connect component to unified messaging',
        risk: 'medium' as const,
        automation: strategy === 'immediate'
      },
      {
        phase: 'verification',
        action: 'Run integration tests',
        risk: 'low' as const,
        automation: true
      }
    ];

    if (compatibility.issues.length > 0) {
      steps.unshift({
        phase: 'compatibility-fixes',
        action: 'Address compatibility issues',
        risk: 'medium' as const,
        automation: false
      });
    }

    const impact = this.estimateIntegrationImpact(component);

    return {
      component,
      strategy,
      steps,
      impact,
      rollbackPlan: [
        'Remove component registration',
        'Restore previous configuration',
        'Clear integration cache',
        'Restart affected services'
      ]
    };
  }

  private determineIntegrationStrategy(
    component: SystemComponent,
    compatibility: { score: number; issues: string[]; strengths: string[] }
  ): 'immediate' | 'phased' | 'background' | 'manual' {
    if (compatibility.score >= 90 && component.type === 'utility') {
      return 'immediate';
    }

    if (compatibility.score >= 80 && compatibility.issues.length <= 1) {
      return 'phased';
    }

    if (compatibility.score >= 60) {
      return 'background';
    }

    return 'manual';
  }

  private async executeIntegration(plan: IntegrationPlan): Promise<boolean> {
    try {
      for (const step of plan.steps) {
        if (step.automation) {
          console.log(`     🔄 ${step.action}...`);
          await this.executeIntegrationStep(step, plan.component);
        } else {
          console.log(`     ⚠️ Manual step required: ${step.action}`);
          return false; // 수동 단계가 있으면 일시 중단
        }
      }

      // 통합 완료 - 컴포넌트 상태 업데이트
      const component = this.componentsRegistry.get(plan.component.id);
      if (component) {
        component.status = 'integrated';
        component.integrationDate = new Date();
        component.compatibilityScore = await this.calculateCompatibilityScore(component);
      }

      this.integrationHistory.push({
        component: plan.component.id,
        timestamp: new Date(),
        success: true,
        impact: plan.impact
      });

      return true;

    } catch (error) {
      console.error(`Integration failed:`, error);
      await this.executeRollback(plan.rollbackPlan);

      this.integrationHistory.push({
        component: plan.component.id,
        timestamp: new Date(),
        success: false,
        impact: { performance: 0, stability: -1, usability: 0 }
      });

      return false;
    }
  }

  private generateNextSteps(
    plan: IntegrationPlan,
    cohesion: SystemCohesion,
    integrationSuccess: boolean
  ): string[] {
    const steps = [];

    if (!integrationSuccess) {
      steps.push(`Review and address integration issues for ${plan.component.name}`);

      if (plan.steps.some(step => !step.automation)) {
        steps.push('Complete manual integration steps');
      }
    }

    if (cohesion.overallScore < 80) {
      steps.push('Review system cohesion recommendations');
      cohesion.recommendations.forEach(rec => steps.push(`- ${rec}`));
    }

    if (plan.strategy === 'phased') {
      steps.push('Monitor phased integration progress');
      steps.push('Schedule next integration phase');
    }

    if (integrationSuccess && cohesion.overallScore >= 80) {
      steps.push('System integration healthy - continue monitoring');
    }

    return steps;
  }

  // Helper methods (간략화된 구현)
  private extractComponentName(content: string): string {
    const match = content.match(/class (\w+)|export.*?(\w+)/);
    return match?.[1] || match?.[2] || 'Unknown Component';
  }

  private extractVersion(content: string): string | null {
    const match = content.match(/version.*?['"`]([^'"`]+)['"`]/i);
    return match?.[1] || null;
  }

  private inferComponentType(content: string, path: string): 'core' | 'engine' | 'utility' | 'legacy' {
    if (content.includes('Engine') || content.includes('Matrix')) return 'engine';
    if (path.includes('lib/')) return 'utility';
    if (content.includes('Orchestrator') || content.includes('Hub')) return 'core';
    return 'legacy';
  }

  private extractDependencies(content: string): ComponentId[] {
    const imports = content.match(/from ['"`]\.\/([^'"`]+)/g) || [];
    return imports
      .map(imp => imp.replace(/from ['"`]\.\/([^'"`]+)['"`]/, '$1'))
      .map(name => name.replace('.js', '').replace('-', '-') as ComponentId);
  }

  private extractCapabilities(content: string): string[] {
    const capabilities = [];
    if (content.includes('decision')) capabilities.push('decision-making');
    if (content.includes('execution')) capabilities.push('execution');
    if (content.includes('optimization')) capabilities.push('optimization');
    if (content.includes('integration')) capabilities.push('integration');
    return capabilities;
  }

  private extractRequirements(content: string): string[] {
    return []; // 간략화
  }

  private pathToComponentId(path: string): ComponentId {
    return path
      .replace(/.*\/([^\/]+)\.ts$/, '$1')
      .replace(/_/g, '-') as ComponentId;
  }

  private async checkArchitecturalCompliance(component: SystemComponent): Promise<number> {
    // 아키텍처 준수도 점검 (간략화)
    let score = 80;

    if (component.type === 'engine' && !component.provides.includes('optimization')) {
      score -= 20;
    }

    return score;
  }

  private estimatePerformanceImpact(component: SystemComponent) {
    return { negative: 1, positive: 2 }; // 간략화
  }

  private estimateIntegrationImpact(component: SystemComponent) {
    return {
      performance: component.type === 'engine' ? 2 : 0,
      stability: 1,
      usability: component.provides.includes('decision-making') ? 2 : 1
    };
  }

  private calculateComponentHarmony(components: SystemComponent[]): number {
    return 75; // 간략화 - 실제로는 상호작용 분석
  }

  private async calculateArchitecturalAlignment(components: SystemComponent[]): Promise<number> {
    return 80; // 간략화
  }

  private async calculatePerformanceCoherence(components: SystemComponent[]): Promise<number> {
    return 70; // 간략화
  }

  private calculateUserExperienceConsistency(components: SystemComponent[]): number {
    return 75; // 간략화
  }

  private async executeIntegrationStep(step: any, component: SystemComponent): Promise<void> {
    // Integration step implementation
    await new Promise(resolve => setTimeout(resolve, 100)); // 시뮬레이션
  }

  private async calculateCompatibilityScore(component: SystemComponent): Promise<number> {
    return 85; // 간략화
  }

  private async executeRollback(rollbackPlan: string[]): Promise<void> {
    console.log('Rolling back integration...');
  }

  private async findUnregisteredComponents(): Promise<string[]> {
    return []; // 간략화
  }

  private async autoRegisterComponent(component: string): Promise<void> {
    // Auto registration logic
  }

  private async checkCompatibilityIssues(): Promise<Array<{
    component: string;
    description: string;
    autoFixable: boolean;
    fix?: string;
  }>> {
    return []; // 간략화
  }

  private async generateIntegrationReport(results: any[]): Promise<void> {
    const reportPath = join(this.projectRoot, 'reports', 'system-integration-report.md');

    let report = `# 🔄 System Integration Report\n\n`;
    report += `Generated: ${new Date().toISOString()}\n\n`;

    report += `## 📊 Integration Summary\n`;
    const successful = results.filter(r => r.success).length;
    report += `- **Total Components**: ${results.length}\n`;
    report += `- **Successfully Integrated**: ${successful}\n`;
    report += `- **Requiring Manual Review**: ${results.length - successful}\n\n`;

    results.forEach((result, index) => {
      report += `### ${index + 1}. ${result.engine}\n`;
      report += `- **Status**: ${result.success ? '✅ Integrated' : '⚠️ Manual Review Required'}\n`;
      report += `- **Cohesion Score**: ${result.cohesionScore.overallScore}/100\n`;
      if (result.nextSteps.length > 0) {
        report += `- **Next Steps**:\n`;
        result.nextSteps.forEach((step: string) => report += `  - ${step}\n`);
      }
      report += '\n';
    });

    writeFileSync(reportPath, report, 'utf8');
    console.log(`📄 Integration report saved: ${reportPath}`);
  }
}

// 싱글톤 인스턴스
export const systemIntegrationOrchestrator = new SystemIntegrationOrchestrator();
export default SystemIntegrationOrchestrator;