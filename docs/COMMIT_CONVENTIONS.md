# Commit Conventions

## Release Workflow Guard

To prevent accidental releases, our GitHub Release workflow now requires an explicit `[release]` tag in the commit message.

### ✅ Commits that WILL trigger releases:

```bash
fix: resolve critical authentication bug [release]
feat: add new QA generation pipeline [release]
fix!: breaking change to API format [release]
```

### ❌ Commits that will NOT trigger releases:

```bash
fix: prettier formatting issues
chore: update dependencies
refactor: rename variables for clarity
docs: update README
style: fix indentation
test: add unit tests
```

## Semantic Versioning Rules

When `[release]` is present, version bumping follows these rules:

- **MAJOR** (`x.0.0`): `BREAKING CHANGE` or `!:` in commit message
- **MINOR** (`0.x.0`): `feat:` prefix
- **PATCH** (`0.0.x`): `fix:` prefix or manual release

## Manual Release Process

You can also trigger releases manually via GitHub Actions:

1. Go to Actions → Release workflow
2. Click "Run workflow"
3. Select version type (patch/minor/major)
4. Click "Run workflow"

## Best Practices

- Only add `[release]` when you're ready to publish a new version
- Test locally with `npm run ci:quality` before releasing
- Use descriptive commit messages that explain the change impact
- Consider if your change requires user-facing documentation updates

## Examples

```bash
# Bug fix that users should know about
git commit -m "fix: resolve data export corruption issue [release]"

# New feature ready for users
git commit -m "feat: implement smart refactor system [release]"

# Internal improvements (no release needed)
git commit -m "refactor: improve code organization"
git commit -m "chore: update ESLint rules"
git commit -m "fix: resolve prettier formatting issues"
```