#!/usr/bin/env node
/**
 * Development Session Report Generator
 * 매 개발 세션마다 현재 상태를 요약하여 다른 LLM/개발자에게 전달하는 리포트 생성
 */

import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';

class DevSessionReportGenerator {
    constructor() {
        this.timestamp = new Date().toISOString();
        this.sessionId = this.generateSessionId();
    }

    generateSessionId() {
        const date = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '_');
        return `dev_session_${date}`;
    }

    // Git 상태 분석
    getGitStatus() {
        try {
            const status = execSync('git status --porcelain', { encoding: 'utf-8' });
            const changes = status.trim().split('\n').filter(line => line.trim());

            const staged = changes.filter(line => line.startsWith('M ') || line.startsWith('A ')).length;
            const unstaged = changes.filter(line => line.startsWith(' M') || line.startsWith(' D')).length;
            const untracked = changes.filter(line => line.startsWith('??')).length;

            return {
                total_changes: changes.length,
                staged_files: staged,
                unstaged_files: unstaged,
                untracked_files: untracked,
                clean: changes.length === 0
            };
        } catch (error) {
            return { error: error.message };
        }
    }

    // 최근 커밋 정보
    getRecentCommits() {
        try {
            const commits = execSync('git log --oneline -5', { encoding: 'utf-8' })
                .trim().split('\n');
            return commits.map(commit => {
                const [hash, ...messageParts] = commit.split(' ');
                return { hash: hash.slice(0, 7), message: messageParts.join(' ') };
            });
        } catch (error) {
            return [];
        }
    }

    // 프로젝트 상태 분석
    getProjectHealth() {
        const health = {
            typescript: false,
            tests: false,
            build: false,
            linting: false,
            dependencies: false
        };

        try {
            // TypeScript 검사
            execSync('npm run typecheck', { stdio: 'pipe' });
            health.typescript = true;
        } catch {}

        try {
            // 빌드 상태
            execSync('npm run build', { stdio: 'pipe' });
            health.build = true;
        } catch {}

        try {
            // 린트 상태
            execSync('npm run lint', { stdio: 'pipe' });
            health.linting = true;
        } catch {}

        // 의존성 확인
        health.dependencies = fs.existsSync('node_modules') && fs.existsSync('package-lock.json');

        return health;
    }

    // 개발 진행 상황 파악
    getDevProgress() {
        const progress = {
            recent_files_modified: [],
            new_features: [],
            bug_fixes: [],
            refactoring: []
        };

        try {
            // 최근 24시간 내 수정된 파일
            const recentFiles = execSync(
                'find . -name "*.ts" -o -name "*.js" -o -name "*.tsx" -o -name "*.jsx" | xargs ls -lt | head -10',
                { encoding: 'utf-8' }
            ).trim().split('\n').map(line => {
                const parts = line.split(/\s+/);
                return parts[parts.length - 1]; // 파일 경로
            });

            progress.recent_files_modified = recentFiles.slice(0, 5);

            // 커밋 메시지에서 패턴 분석
            const recentCommits = this.getRecentCommits();
            recentCommits.forEach(commit => {
                const msg = commit.message.toLowerCase();
                if (msg.includes('feat:') || msg.includes('add')) {
                    progress.new_features.push(commit.message);
                } else if (msg.includes('fix:') || msg.includes('bug')) {
                    progress.bug_fixes.push(commit.message);
                } else if (msg.includes('refactor:') || msg.includes('cleanup')) {
                    progress.refactoring.push(commit.message);
                }
            });

        } catch (error) {
            progress.error = error.message;
        }

        return progress;
    }

    // 현재 이슈/할일 분석
    getCurrentIssues() {
        const issues = {
            todo_comments: [],
            fixme_comments: [],
            eslint_warnings: 0,
            typescript_errors: 0,
            test_failures: 0
        };

        try {
            // TODO/FIXME 주석 찾기
            const todoGrep = execSync(
                'grep -r "TODO\\|FIXME\\|XXX" --include="*.ts" --include="*.js" . | head -10',
                { encoding: 'utf-8' }
            ).trim().split('\n').filter(line => line.trim());

            issues.todo_comments = todoGrep.slice(0, 5);

        } catch {}

        try {
            // ESLint 경고 수 확인
            const eslintOutput = execSync('npm run lint', { encoding: 'utf-8', stdio: 'pipe' });
            const warningMatches = eslintOutput.match(/(\d+) warnings?/);
            if (warningMatches) {
                issues.eslint_warnings = parseInt(warningMatches[1]);
            }
        } catch {}

        return issues;
    }

    // 웹뷰 상태
    getWebViewStatus() {
        const webViewStatus = {
            port: 3001,
            running: false,
            last_report_time: null,
            baseline_status: null
        };

        try {
            // 포트 3001 확인
            execSync('lsof -i :3001', { stdio: 'pipe' });
            webViewStatus.running = true;
        } catch {}

        // 최근 베이스라인 리포트 확인
        if (fs.existsSync('reports/baseline_report.md')) {
            const stats = fs.statSync('reports/baseline_report.md');
            webViewStatus.last_report_time = stats.mtime.toISOString();

            // 베이스라인 상태 간단 분석
            const content = fs.readFileSync('reports/baseline_report.md', 'utf-8');
            const qualityMatch = content.match(/Quality Score[:\s]*(\d+\.?\d*)%/);
            if (qualityMatch) {
                webViewStatus.baseline_status = `${qualityMatch[1]}%`;
            }
        }

        return webViewStatus;
    }

    // 메인 리포트 생성
    generateReport() {
        const gitStatus = this.getGitStatus();
        const recentCommits = this.getRecentCommits();
        const projectHealth = this.getProjectHealth();
        const devProgress = this.getDevProgress();
        const currentIssues = this.getCurrentIssues();
        const webViewStatus = this.getWebViewStatus();

        const report = `# 🔄 개발 세션 리포트

## 📋 세션 개요
- **세션 ID**: \`${this.sessionId}\`
- **타임스탬프**: \`${this.timestamp}\`
- **Git 상태**: ${gitStatus.clean ? '✅ Clean' : `⚠️ ${gitStatus.total_changes}개 변경사항`}
- **웹뷰**: ${webViewStatus.running ? '🟢 실행중' : '🔴 정지됨'} (포트 ${webViewStatus.port})

## 🎯 현재 작업 상황

### Git 변경사항
\`\`\`
스테이징된 파일: ${gitStatus.staged_files || 0}개
미스테이징 파일: ${gitStatus.unstaged_files || 0}개
새 파일: ${gitStatus.untracked_files || 0}개
\`\`\`

### 최근 커밋 (최근 5개)
${recentCommits.map(commit => `- \`${commit.hash}\` ${commit.message}`).join('\n')}

### 개발 진행상황
**최근 수정 파일 (Top 5):**
${devProgress.recent_files_modified.map(file => `- ${file}`).join('\n') || '없음'}

**새 기능:** ${devProgress.new_features.length}개
**버그 수정:** ${devProgress.bug_fixes.length}개
**리팩터링:** ${devProgress.refactoring.length}개

## 🏗️ 프로젝트 상태

### 빌드 상태
- **TypeScript**: ${projectHealth.typescript ? '✅ 통과' : '❌ 에러'}
- **빌드**: ${projectHealth.build ? '✅ 성공' : '❌ 실패'}
- **린팅**: ${projectHealth.linting ? '✅ 깨끗함' : '⚠️ 경고 있음'}
- **의존성**: ${projectHealth.dependencies ? '✅ 정상' : '❌ 누락'}

### 현재 이슈
- **TODO 주석**: ${currentIssues.todo_comments.length}개
- **ESLint 경고**: ${currentIssues.eslint_warnings}개
- **TypeScript 에러**: ${currentIssues.typescript_errors}개

${currentIssues.todo_comments.length > 0 ? `
**주요 TODO:**
${currentIssues.todo_comments.slice(0, 3).map(todo => `- ${todo}`).join('\n')}
` : ''}

## 📊 베이스라인 상태
${webViewStatus.baseline_status ?
`- **최근 품질 점수**: ${webViewStatus.baseline_status}
- **마지막 리포트**: ${new Date(webViewStatus.last_report_time).toLocaleString('ko-KR')}` :
'- 베이스라인 리포트 없음'}

## 🔧 권장 다음 단계

${gitStatus.total_changes > 10 ? '1. **커밋 정리**: 변경사항이 많습니다. 논리적으로 나누어 커밋하세요.' : ''}
${!projectHealth.typescript ? '2. **TypeScript 수정**: 타입 에러를 해결하세요.' : ''}
${!projectHealth.build ? '3. **빌드 수정**: 빌드 에러를 해결하세요.' : ''}
${currentIssues.eslint_warnings > 5 ? '4. **린팅 정리**: ESLint 경고가 많습니다.' : ''}
${!webViewStatus.running ? '5. **웹뷰 실행**: \`npm run dev:cli\`로 웹뷰를 시작하세요.' : ''}

## 📝 다른 개발자/LLM을 위한 컨텍스트

**이 세션에서 작업 중인 내용:**
${devProgress.new_features.concat(devProgress.bug_fixes, devProgress.refactoring).slice(0, 3).join(', ') || '일반적인 개발 작업'}

**현재 프로젝트 상태:** ${projectHealth.typescript && projectHealth.build ? '안정적' : '개선 필요'}

**즉시 필요한 작업:**
${!projectHealth.typescript ? '- TypeScript 에러 수정' : ''}
${!projectHealth.build ? '- 빌드 에러 수정' : ''}
${gitStatus.total_changes > 0 ? '- 변경사항 정리 및 커밋' : ''}

---
*리포트 생성 시각: ${this.timestamp}*
*자동 생성됨 - 매 개발 세션마다 업데이트*
`;

        return report;
    }

    // 리포트 저장
    writeReport() {
        const reportContent = this.generateReport();
        const reportPath = 'reports/dev_session_report.md';

        // reports 디렉터리 확인
        if (!fs.existsSync('reports')) {
            fs.mkdirSync('reports', { recursive: true });
        }

        // 원자적 쓰기 (tmp -> rename)
        const tmpPath = `${reportPath}.tmp`;
        fs.writeFileSync(tmpPath, reportContent, 'utf-8');
        fs.renameSync(tmpPath, reportPath);

        console.log(`✅ 개발 세션 리포트 생성완료: ${reportPath}`);
        console.log(`🔗 세션 ID: ${this.sessionId}`);

        return reportPath;
    }
}

// CLI 실행
if (import.meta.url === `file://${process.argv[1]}`) {
    try {
        const generator = new DevSessionReportGenerator();
        generator.writeReport();
    } catch (error) {
        console.error('❌ 리포트 생성 실패:', error.message);
        process.exit(1);
    }
}

export { DevSessionReportGenerator };