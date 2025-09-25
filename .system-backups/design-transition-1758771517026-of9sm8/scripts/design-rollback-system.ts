#!/usr/bin/env node

/**
 * Design Rollback System
 * 설계 기반 전환 후 완전한 롤백 지원
 */

import { existsSync, readFileSync, writeFileSync, cpSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

interface SystemSnapshot {
  timestamp: string;
  snapshot_id: string;
  pre_transition_state: {
    package_json_backup: string;
    scripts_directory_backup: string;
    git_commit_hash: string;
    command_count: number;
    file_count: number;
  };
  transition_log: {
    actions_executed: string[];
    files_modified: string[];
    files_created: string[];
    commands_changed: string[];
  };
  rollback_instructions: string[];
}

class DesignRollbackSystem {
  private projectRoot: string;
  private backupDir: string;

  constructor() {
    this.projectRoot = process.cwd();
    this.backupDir = join(this.projectRoot, '.system-backups');
  }

  async createPreTransitionSnapshot(): Promise<string> {
    console.log('📸 전환 전 시스템 스냅샷 생성 중...');

    const snapshotId = `design-transition-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const snapshotDir = join(this.backupDir, snapshotId);

    // 백업 디렉토리 생성
    if (!existsSync(this.backupDir)) {
      mkdirSync(this.backupDir, { recursive: true });
    }
    mkdirSync(snapshotDir, { recursive: true });

    // Git 커밋 해시 저장
    let gitCommitHash = 'unknown';
    try {
      gitCommitHash = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    } catch (error) {
      console.warn('⚠️ Git 커밋 해시 확인 실패');
    }

    // 중요 파일들 백업
    const criticalFiles = [
      'package.json',
      'scripts/',
      'docs/',
      '.claude/',
      'reports/',
      'tsconfig.json',
      'tsconfig.build.json'
    ];

    for (const file of criticalFiles) {
      const sourcePath = join(this.projectRoot, file);
      const backupPath = join(snapshotDir, file);

      if (existsSync(sourcePath)) {
        try {
          if (file.endsWith('/')) {
            cpSync(sourcePath, backupPath, { recursive: true });
          } else {
            mkdirSync(join(snapshotDir, '..', file.split('/').slice(0, -1).join('/')), { recursive: true });
            cpSync(sourcePath, backupPath);
          }
          console.log(`✅ 백업 완료: ${file}`);
        } catch (error) {
          console.warn(`⚠️ 백업 실패: ${file} - ${error}`);
        }
      }
    }

    // 현재 상태 메타데이터
    const packageJson = JSON.parse(readFileSync(join(this.projectRoot, 'package.json'), 'utf8'));
    const commandCount = Object.keys(packageJson.scripts || {}).length;

    // 스크립트 파일 개수
    let fileCount = 0;
    try {
      const scriptsDir = join(this.projectRoot, 'scripts');
      if (existsSync(scriptsDir)) {
        const files = execSync(`find "${scriptsDir}" -name "*.ts" -o -name "*.js" -o -name "*.sh" | wc -l`, { encoding: 'utf8' });
        fileCount = parseInt(files.trim());
      }
    } catch (error) {
      console.warn('⚠️ 파일 개수 확인 실패');
    }

    const snapshot: SystemSnapshot = {
      timestamp: new Date().toISOString(),
      snapshot_id: snapshotId,
      pre_transition_state: {
        package_json_backup: join(snapshotDir, 'package.json'),
        scripts_directory_backup: join(snapshotDir, 'scripts'),
        git_commit_hash: gitCommitHash,
        command_count: commandCount,
        file_count: fileCount
      },
      transition_log: {
        actions_executed: [],
        files_modified: [],
        files_created: [],
        commands_changed: []
      },
      rollback_instructions: [
        '1. Git reset to pre-transition commit',
        '2. Restore package.json from backup',
        '3. Restore scripts directory from backup',
        '4. Remove any new files created during transition',
        '5. Verify system integrity'
      ]
    };

    // 스냅샷 메타데이터 저장
    const metadataPath = join(snapshotDir, 'snapshot-metadata.json');
    writeFileSync(metadataPath, JSON.stringify(snapshot, null, 2));

    console.log(`✅ 스냅샷 생성 완료: ${snapshotId}`);
    console.log(`📁 백업 위치: ${snapshotDir}`);

    return snapshotId;
  }

  async executeRollback(snapshotId?: string): Promise<void> {
    console.log('🔄 설계 기반 시스템 롤백 실행 중...');

    // 최신 스냅샷 찾기
    if (!snapshotId) {
      const snapshots = execSync(`ls -t ${this.backupDir}`, { encoding: 'utf8' })
        .trim().split('\n').filter(s => s.startsWith('design-transition-'));

      if (snapshots.length === 0) {
        console.error('❌ 롤백할 스냅샷을 찾을 수 없습니다');
        return;
      }

      snapshotId = snapshots[0];
    }

    const snapshotDir = join(this.backupDir, snapshotId);
    const metadataPath = join(snapshotDir, 'snapshot-metadata.json');

    if (!existsSync(metadataPath)) {
      console.error(`❌ 스냅샷 메타데이터를 찾을 수 없습니다: ${snapshotId}`);
      return;
    }

    const snapshot: SystemSnapshot = JSON.parse(readFileSync(metadataPath, 'utf8'));

    console.log(`📸 롤백 대상: ${snapshot.timestamp}`);
    console.log(`🔙 Git 커밋: ${snapshot.pre_transition_state.git_commit_hash}`);

    // Git 리셋 (선택적)
    if (snapshot.pre_transition_state.git_commit_hash !== 'unknown') {
      try {
        console.log('🔄 Git 상태 복원 중...');
        execSync(`git reset --hard ${snapshot.pre_transition_state.git_commit_hash}`, { stdio: 'inherit' });
        console.log('✅ Git 상태 복원 완료');
      } catch (error) {
        console.warn('⚠️ Git 리셋 실패 - 수동으로 복원하세요:', error);
      }
    }

    // package.json 복원
    if (existsSync(snapshot.pre_transition_state.package_json_backup)) {
      cpSync(snapshot.pre_transition_state.package_json_backup, join(this.projectRoot, 'package.json'));
      console.log('✅ package.json 복원 완료');
    }

    // scripts 디렉토리 복원
    if (existsSync(snapshot.pre_transition_state.scripts_directory_backup)) {
      const scriptsDir = join(this.projectRoot, 'scripts');
      if (existsSync(scriptsDir)) {
        rmSync(scriptsDir, { recursive: true, force: true });
      }
      cpSync(snapshot.pre_transition_state.scripts_directory_backup, scriptsDir, { recursive: true });
      console.log('✅ scripts 디렉토리 복원 완료');
    }

    // 시스템 상태 검증
    console.log('🔍 시스템 상태 검증 중...');
    try {
      const packageJson = JSON.parse(readFileSync(join(this.projectRoot, 'package.json'), 'utf8'));
      const currentCommandCount = Object.keys(packageJson.scripts || {}).length;

      console.log(`📊 명령어 개수: ${currentCommandCount} (원본: ${snapshot.pre_transition_state.command_count})`);

      if (currentCommandCount === snapshot.pre_transition_state.command_count) {
        console.log('✅ 시스템 완전 복원 확인');
      } else {
        console.warn('⚠️ 부분 복원 - 수동 검토 필요');
      }
    } catch (error) {
      console.error('❌ 시스템 검증 실패:', error);
    }

    console.log('✅ 롤백 완료');
    console.log('💡 필요시 npm install로 의존성 재설치하세요');
  }

  listSnapshots(): void {
    console.log('📸 사용 가능한 시스템 스냅샷:');

    if (!existsSync(this.backupDir)) {
      console.log('   📁 스냅샷 없음');
      return;
    }

    try {
      const snapshots = execSync(`ls -t ${this.backupDir}`, { encoding: 'utf8' })
        .trim().split('\n').filter(s => s.startsWith('design-transition-'));

      if (snapshots.length === 0) {
        console.log('   📁 전환 스냅샷 없음');
        return;
      }

      snapshots.forEach((snapshot, i) => {
        const metadataPath = join(this.backupDir, snapshot, 'snapshot-metadata.json');
        if (existsSync(metadataPath)) {
          const metadata: SystemSnapshot = JSON.parse(readFileSync(metadataPath, 'utf8'));
          console.log(`   ${i + 1}. ${snapshot}`);
          console.log(`      📅 생성: ${new Date(metadata.timestamp).toLocaleString()}`);
          console.log(`      📊 명령어: ${metadata.pre_transition_state.command_count}개`);
        }
      });
    } catch (error) {
      console.error('❌ 스냅샷 목록 조회 실패:', error);
    }
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const rollbackSystem = new DesignRollbackSystem();
  const command = process.argv[2];

  switch (command) {
    case 'snapshot':
      rollbackSystem.createPreTransitionSnapshot()
        .then(id => console.log(`📸 스냅샷 ID: ${id}`))
        .catch(console.error);
      break;

    case 'rollback':
      const snapshotId = process.argv[3];
      rollbackSystem.executeRollback(snapshotId).catch(console.error);
      break;

    case 'list':
      rollbackSystem.listSnapshots();
      break;

    default:
      console.log('Usage: tsx design-rollback-system.ts <snapshot|rollback [id]|list>');
      process.exit(1);
  }
}

export default DesignRollbackSystem;