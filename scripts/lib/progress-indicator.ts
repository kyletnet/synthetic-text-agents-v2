#!/usr/bin/env tsx

/**
 * 실시간 진행률 표시 및 상태 업데이트 시스템
 */
export class ProgressIndicator {
  private totalSteps: number;
  private currentStep: number = 0;
  private stepName: string = '';
  private startTime: number;
  private intervalId: NodeJS.Timeout | null = null;
  private spinnerIndex: number = 0;
  private readonly spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private readonly progressBarWidth = 20;

  constructor(totalSteps: number) {
    this.totalSteps = totalSteps;
    this.startTime = Date.now();
  }

  /**
   * 새로운 단계 시작
   */
  startStep(stepName: string, stepNumber?: number): void {
    if (stepNumber) {
      this.currentStep = stepNumber;
    } else {
      this.currentStep++;
    }
    this.stepName = stepName;

    // 이전 스피너 정리
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    // 진행률 표시
    this.updateProgress();

    // 스피너 시작
    this.startSpinner();
  }

  /**
   * 현재 단계 완료
   */
  completeStep(message?: string): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // 완료된 단계 표시
    const percent = Math.round((this.currentStep / this.totalSteps) * 100);
    const progressBar = this.generateProgressBar(percent);
    const elapsed = Math.round((Date.now() - this.startTime) / 1000);

    process.stdout.write(`\\r✅ [${progressBar}] ${percent}% | ${this.stepName} | ${elapsed}s\\n`);

    if (message) {
      console.log(`   ${message}`);
    }
  }

  /**
   * 에러로 단계 실패
   */
  failStep(errorMessage: string): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    const percent = Math.round((this.currentStep / this.totalSteps) * 100);
    const progressBar = this.generateProgressBar(percent);
    const elapsed = Math.round((Date.now() - this.startTime) / 1000);

    process.stdout.write(`\\r❌ [${progressBar}] ${percent}% | ${this.stepName} | ${elapsed}s\\n`);
    console.log(`   ${errorMessage}`);
  }

  /**
   * 전체 완료
   */
  complete(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    const elapsed = Math.round((Date.now() - this.startTime) / 1000);
    const progressBar = '█'.repeat(this.progressBarWidth);

    process.stdout.write(`\\r🎉 [${progressBar}] 100% | 모든 작업 완료! | ${elapsed}s\\n`);
  }

  /**
   * 스피너 애니메이션 시작
   */
  private startSpinner(): void {
    this.intervalId = setInterval(() => {
      this.updateProgress();
      this.spinnerIndex = (this.spinnerIndex + 1) % this.spinnerFrames.length;
    }, 100); // 100ms마다 업데이트
  }

  /**
   * 진행률 업데이트
   */
  private updateProgress(): void {
    const percent = Math.round((this.currentStep / this.totalSteps) * 100);
    const progressBar = this.generateProgressBar(percent);
    const spinner = this.spinnerFrames[this.spinnerIndex];
    const elapsed = Math.round((Date.now() - this.startTime) / 1000);

    process.stdout.write(`\\r${spinner} [${progressBar}] ${percent}% | ${this.stepName} | ${elapsed}s`);
  }

  /**
   * 프로그레스 바 생성
   */
  private generateProgressBar(percent: number): string {
    const filled = Math.round((percent / 100) * this.progressBarWidth);
    const empty = this.progressBarWidth - filled;

    return '█'.repeat(filled) + '░'.repeat(empty);
  }

  /**
   * 서브 작업 진행률 표시 (기존 진행률 유지하면서)
   */
  updateSubTask(subTaskName: string): void {
    if (this.intervalId) {
      const percent = Math.round((this.currentStep / this.totalSteps) * 100);
      const progressBar = this.generateProgressBar(percent);
      const spinner = this.spinnerFrames[this.spinnerIndex];
      const elapsed = Math.round((Date.now() - this.startTime) / 1000);

      process.stdout.write(`\\r${spinner} [${progressBar}] ${percent}% | ${this.stepName} → ${subTaskName} | ${elapsed}s`);
    }
  }
}

/**
 * 간단한 스피너 (단일 작업용)
 */
export class SimpleSpinner {
  private intervalId: NodeJS.Timeout | null = null;
  private spinnerIndex: number = 0;
  private readonly spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private message: string;

  constructor(message: string) {
    this.message = message;
  }

  start(): void {
    this.intervalId = setInterval(() => {
      const spinner = this.spinnerFrames[this.spinnerIndex];
      process.stdout.write(`\\r${spinner} ${this.message}`);
      this.spinnerIndex = (this.spinnerIndex + 1) % this.spinnerFrames.length;
    }, 100);
  }

  stop(finalMessage: string): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    process.stdout.write(`\\r${finalMessage}\\n`);
  }

  update(newMessage: string): void {
    this.message = newMessage;
  }
}