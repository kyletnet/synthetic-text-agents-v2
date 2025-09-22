# Security Hardening & Secret Management

## Overview

This document provides comprehensive security procedures for the synthetic-text-agents repository, including secret management, key rotation, git history cleanup, and emergency response procedures.

## 🚨 Emergency: Secret Found

**IMMEDIATE ACTIONS** (complete within 5 minutes):

1. **STOP** - Do not commit or push any changes
2. **Clean repository**: Run `npm run hygiene:clean` to quarantine backup files
3. **Verify security**: Run `npm run guard:git` to check for secrets
4. **Rotate credentials**: Immediately revoke and re-issue any exposed API keys
5. **Create snapshot**: Run `npm run snapshot:commit` (after guards pass)
6. **Push safely**: `git push && git push --tags`
7. **Notify team**: Alert security team and project maintainers

### Quick Hygiene Workflow Checklist

```bash
# 1. Clean backup files and check security
npm run hygiene:clean && npm run guard:git

# 2. If guards pass, create safe snapshot
npm run snapshot:commit

# 3. Push to trigger CI validation
git push && git push --tags
```

**EMERGENCY CONTACTS**:
- Security Team: [Add your security contact information]
- Project Lead: [Add project lead contact]

## Secret Detection & Prevention

### Automated Scanning

The repository includes multiple layers of secret detection:

- **Pre-commit hooks**: Block commits containing secrets (`.git/hooks/pre-commit`)
- **CI/CD gates**: Required secret scanning in all pull requests
- **Manual scanning**: `scripts/scan_secrets.sh` for comprehensive checks

### Detected Patterns

Our scanners detect:
- Anthropic API keys: `sk-ant-*`, `sk-ant-api03-*`
- OpenAI API keys: `sk-*`, `sk-proj-*`
- Generic API tokens and secrets
- Authorization headers and embedded credentials

## Key Rotation Procedure

When API keys are compromised or need rotation:

### 1. Immediate Revocation
```bash
# Log into provider console and revoke old key immediately
# Anthropic: https://console.anthropic.com/
# OpenAI: https://platform.openai.com/api-keys
```

### 2. Issue New Credentials
```bash
# Generate new API key from provider console
# Save securely in password manager
```

### 3. Update Environment
```bash
# Update .env file with new key (never commit .env)
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
sed -i.bak 's/ANTHROPIC_API_KEY=.*/ANTHROPIC_API_KEY=NEW_KEY_HERE/' .env

# Verify .env is in .gitignore
grep -q "\.env" .gitignore || echo ".env" >> .gitignore
```

### 4. Test & Validate
```bash
# Run smoke tests with new credentials
npm run smoke

# Verify secret scanner passes
scripts/scan_secrets.sh
```

### 5. Secure Cleanup
```bash
# Securely delete backup files
rm -P .env.backup.* # macOS
# or: shred -vfz-3 .env.backup.* # Linux

# Clean quarantine directory
rm -P .backup_quarantine/* # Review first!
```

## Git History Scrubbing

**⚠️ WARNING**: History scrubbing rewrites git history and requires coordination with all team members.

### Using BFG Repo-Cleaner (Recommended)

```bash
# 1. Create a fresh clone
git clone --mirror https://github.com/yourorg/repo.git repo-cleanup.git
cd repo-cleanup.git

# 2. Download BFG Repo-Cleaner
# From: https://rtyley.github.io/bfg-repo-cleaner/
wget https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar

# 3. Create replacement file for secrets
cat > secrets.txt << 'EOF'
sk-ant-api03-****REMOVED****
sk-****REMOVED****
ANTHROPIC_API_KEY=****REMOVED****
EOF

# 4. Clean history
java -jar bfg-1.14.0.jar --replace-text secrets.txt

# 5. Cleanup and push
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force
```

### Using git filter-repo (Alternative)

```bash
# 1. Install git-filter-repo
# pip install git-filter-repo

# 2. Remove specific file patterns
git filter-repo --path-glob '*.bak' --invert-paths
git filter-repo --path-glob '*.backup' --invert-paths

# 3. Replace secret patterns
git filter-repo --replace-text <(echo 'sk-ant-api03-==>sk-ant-****REMOVED****')

# 4. Force push (coordinate with team!)
git push --force-with-lease
```

### Post-History Cleanup

After history scrubbing:

1. **Notify all team members** to re-clone the repository
2. **Update protected branch rules** if force-push was required
3. **Invalidate CI/CD caches** and rebuild systems
4. **Run comprehensive security scan** to verify cleanup

## .gitignore Security Policy

### Required Patterns

The `.gitignore` file MUST include these patterns:

```gitignore
# Secrets & Environment
.env
.env.*
*.env
*.env.*
.keys/
*.key
*.keys
credentials.*
secret.*
secrets.*

# Backup files (often contain secrets)
*~
*.bak
*.backup
*.old
*.orig
*.backup.*
*_backup.*

# Reports & Cache (may contain sensitive data)
reports/history/*
RUN_LOGS/*
exports/*
.backup_quarantine/
```

### Quarantine Flow

When sensitive files are detected:

1. **Automatic quarantine**: `scripts/git_hygiene.sh` moves files to `.backup_quarantine/`
2. **Manual review**: Examine quarantined files for sensitive data
3. **Secure deletion**: Use `rm -P` (macOS) or `shred` (Linux) for permanent removal
4. **Update .gitignore**: Add patterns to prevent future tracking

## CI/CD Security Gates

### Required Gates

All pull requests must pass:

1. **Environment Guard**: API usage and environment loading compliance
2. **Secret Scanner**: Comprehensive secret detection across all files
3. **Git Hygiene**: Working tree cleanliness and backup file detection
4. **Schema Validation**: Input/output data structure compliance

### Security Failure Response

When CI security gates fail:

```bash
# 1. Review failure details
cat .github/workflows/ci-required-gates.yml

# 2. Run local checks
npm run guard:all

# 3. Fix issues found
scripts/git_hygiene.sh        # Clean backup files
scripts/scan_secrets.sh       # Verify no secrets
npm run guard:git             # Re-run git checks

# 4. Re-run CI after fixes
git add . && git commit -m "fix: resolve security violations"
```

## Security Monitoring

### Daily Checks

```bash
# Run comprehensive security scan
npm run guard:all

# Check for new backup files
find . -name "*.bak" -o -name "*.backup" -o -name "*~" | head -10

# Verify .env files not tracked
git ls-files | grep "\.env"
```

### Weekly Review

- Review `.backup_quarantine/` contents
- Update secret scanning patterns
- Check for new credential types in use
- Validate backup and recovery procedures

## Incident Response

### Security Incident Levels

**Level 1 - Secret Detected in Working Tree**
- Run automated cleanup scripts
- Rotate affected credentials
- Document in security log

**Level 2 - Secret Committed to Repository**
- Immediate credential rotation
- History scrubbing evaluation
- Team notification required

**Level 3 - Secret Pushed to Remote**
- Emergency credential revocation
- Mandatory history scrubbing
- Security team escalation
- Post-incident review required

### Documentation Requirements

For all security incidents:

1. **Incident timeline**: When discovered, actions taken, resolution time
2. **Impact assessment**: Which credentials, data, or systems affected
3. **Root cause analysis**: How the secret was introduced
4. **Prevention measures**: Process or tool improvements implemented

## Security Tools Reference

### Scripts Location
- `scripts/scan_secrets.sh` - Comprehensive secret detection
- `scripts/git_hygiene.sh` - Backup file quarantine
- `.git/hooks/pre-commit` - Commit-time secret blocking

### Package.json Commands
```bash
npm run guard:git           # Run secret scanner
npm run guard:all          # Comprehensive security checks
npm run smoke              # Offline functionality test
```

### CI/CD Integration
- `.github/workflows/ci-required-gates.yml` - Required security gates
- All PRs must pass secret scanning and git hygiene checks

---

*Last updated: 2024-09-16*
*Security contact: [Your security team contact]*