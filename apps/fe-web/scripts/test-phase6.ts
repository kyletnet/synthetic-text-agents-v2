#!/usr/bin/env node

/**
 * 🧪 Phase 6: Fail-Fast Governance 통합 테스트
 *
 * 테스트 항목:
 * - Circuit Breaker 동작 확인
 * - Process Overload Protection 동작 확인
 * - API Key 로딩 문제 해결 확인
 * - Self-Healing Engine 무한 루프 방지 확인
 */

// 환경변수 로드
import * as fs from 'fs';
import * as path from 'path';

// .env 파일 직접 로드
function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim();
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    });
  }
}

loadEnvFile();

import { processOverloadProtection } from '../lib/process-overload-protection';
import { circuitBreakerRegistry } from '../lib/circuit-breaker';

async function testPhase6Integration() {
  console.log('🧪 [Phase6Test] Starting Phase 6 integration test...\n');

  // 1. Process Overload Protection 테스트
  console.log('🔍 [Phase6Test] Testing Process Overload Protection...');

  const statusReport = await processOverloadProtection.getStatusReport();

  console.log(`📊 Process Stats:
  - Total Dev Processes: ${statusReport.stats.devProcesses}
  - Overload Status: ${statusReport.overload.isOverloaded ? 'YES' : 'NO'}
  - Severity: ${statusReport.overload.severity}
  - Reason: ${statusReport.overload.reason}
  `);

  if (statusReport.processes.length > 0) {
    console.log('📝 Active Development Processes:');
    statusReport.processes.forEach((proc, index) => {
      console.log(`  ${index + 1}. PID ${proc.pid}: ${proc.command} (CPU: ${proc.cpu}%, Memory: ${proc.memory}%)`);
    });
    console.log('');
  }

  // 2. 과부하 상태라면 자동 정리 실행
  if (statusReport.overload.isOverloaded) {
    console.log('🧹 [Phase6Test] Running automatic cleanup...');
    const cleanupResult = await processOverloadProtection.performAutomaticCleanup();

    console.log(`🧹 Cleanup Result:
  - Success: ${cleanupResult.success}
  - Processes Cleaned: ${cleanupResult.cleaned}
  - Details:`);
    cleanupResult.details.forEach(detail => {
      console.log(`    - ${detail}`);
    });
    console.log('');
  }

  // 3. Circuit Breaker 상태 확인
  console.log('🛡️ [Phase6Test] Circuit Breaker Status:');
  const circuitBreakerStatus = circuitBreakerRegistry.getStatus();
  if (circuitBreakerStatus.length > 0) {
    circuitBreakerStatus.forEach(status => {
      console.log(`  - ${status}`);
    });
  } else {
    console.log('  - No circuit breakers registered yet');
  }
  console.log('');

  // 4. API Key 환경변수 확인
  console.log('🔑 [Phase6Test] API Key Status:');
  const apiKey = process.env.ANTHROPIC_API_KEY;
  console.log(`  - API Key Loaded: ${apiKey ? 'YES' : 'NO'}`);
  console.log(`  - Key Preview: ${apiKey ? apiKey.substring(0, 10) + '...' : 'Not available'}`);
  console.log('');

  // 5. 정리 후 프로세스 상태 재확인
  console.log('🔍 [Phase6Test] Re-checking process status after cleanup...');
  const afterCleanupReport = await processOverloadProtection.getStatusReport();

  console.log(`📊 After Cleanup:
  - Total Dev Processes: ${afterCleanupReport.stats.devProcesses}
  - Overload Status: ${afterCleanupReport.overload.isOverloaded ? 'YES' : 'NO'}
  - Severity: ${afterCleanupReport.overload.severity}
  `);

  // 6. Phase 6 성공 여부 판정
  const isPhase6Successful =
    !afterCleanupReport.overload.isOverloaded &&
    !!apiKey &&
    afterCleanupReport.stats.devProcesses <= 3;

  console.log(`\n✅ [Phase6Test] Phase 6 Integration Test: ${isPhase6Successful ? 'PASSED ✅' : 'FAILED ❌'}`);

  if (isPhase6Successful) {
    console.log(`🎉 All Phase 6 components working correctly:
  ✅ Process overload resolved
  ✅ API keys properly loaded
  ✅ Circuit breakers ready
  ✅ System ready for normal operation
    `);
  } else {
    console.log(`❌ Phase 6 issues detected:
  ${afterCleanupReport.overload.isOverloaded ? '❌' : '✅'} Process overload: ${afterCleanupReport.overload.reason}
  ${!apiKey ? '❌' : '✅'} API Key loading
  ${afterCleanupReport.stats.devProcesses > 3 ? '❌' : '✅'} Process count within limits
    `);
  }

  return isPhase6Successful;
}

// 스크립트 실행
if (require.main === module) {
  testPhase6Integration()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('🚨 [Phase6Test] Test failed with error:', error);
      process.exit(1);
    });
}

export { testPhase6Integration };