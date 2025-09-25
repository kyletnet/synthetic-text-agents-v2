# /ship

Enhanced production deployment process with automated versioning and releases.

## 기능 (Features)

1. **Quality Gates**: TypeScript, linting, tests
2. **Semantic Versioning**: Automatic version bumping
3. **Changelog**: Auto-generated from commit messages
4. **Git Operations**: Tags and pushes
5. **GitHub Release**: Automated release creation
6. **Legacy Support**: Full observability and export process

## 사용법 (Usage)

```bash
# Default patch version bump
npm run ship

# Specific version bump levels
npm run ship minor
npm run ship major

# Legacy ship process only
npm run ship:legacy
```

## 요구사항 (Requirements)

- GitHub CLI (`gh`) for release creation (optional)
- Clean git working directory
- Push access to remote repository

## 프로세스 (Process)

1. ✅ Run quality gates (typecheck, lint, test)
2. 📦 Bump package version (semantic versioning)
3. 📝 Update CHANGELOG.md with recent commits
4. 🏷️ Create and push git tag
5. 🚀 Create GitHub release
6. 🎯 Run additional ship steps (observability, export)
