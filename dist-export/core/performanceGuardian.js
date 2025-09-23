export class PerformanceGuardian {
  minQuality = 5.0; // Lower threshold for real AI - quality 5+ is acceptable
  maxLatencyMs = 30000; // 30 seconds - realistic for AI API calls
  evaluate(result) {
    const issues = [];
    let ok = true;
    let vetoed = false;
    // Check quality score from performance metrics
    if (result.performance.qualityScore < this.minQuality) {
      ok = false;
      vetoed = true;
      issues.push(
        `qualityScore ${result.performance.qualityScore} < ${this.minQuality}`,
      );
    }
    // Check response time
    if (result.performance.duration > this.maxLatencyMs) {
      ok = false;
      vetoed = true;
      issues.push(
        `duration ${result.performance.duration}ms > ${this.maxLatencyMs}ms`,
      );
    }
    const guardianResult = {
      ...result,
      ok,
      vetoed,
      reasoning:
        result.reasoning +
        (vetoed
          ? " | Guardian vetoed result."
          : " | Guardian approved result."),
      ...(issues.length > 0 && { issues }),
    };
    return guardianResult;
  }
}
//# sourceMappingURL=performanceGuardian.js.map
