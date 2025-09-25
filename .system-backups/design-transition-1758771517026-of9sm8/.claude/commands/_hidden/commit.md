# /commit

현재 변경사항을 커밋하고 푸시합니다.

## 동작

1. 모든 변경사항을 git에 추가
2. Claude Code 서명과 함께 자동 커밋
3. 원격 저장소에 푸시

## 실행

```bash
git add . && git commit -m "feat: automated commit - 🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>" && git push
```
