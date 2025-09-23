---
name: sync
description: 프로젝트 변경사항을 git에 동기화합니다
run: ./sync
shell: true
---

# Sync Project

프로젝트의 모든 변경사항을 git 저장소에 동기화합니다.

## Actions
1. Stage all changes (git add .)
2. Commit with automatic message
3. Push to remote repository
4. Display completion message

```bash
git add . && git commit -m "sync: update with latest changes - 🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>" && git push && echo "✅ 프로젝트 동기화 완료"
```