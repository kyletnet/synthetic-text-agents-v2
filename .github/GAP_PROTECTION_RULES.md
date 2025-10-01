# GAP System Protection Rules

## 🔒 Branch Protection Requirements

To ensure the GAP Prevention System cannot be bypassed, configure these GitHub branch protection rules:

### Main Branch Protection

**Settings → Branches → Branch protection rules → Add rule**

#### Rule: `main`

**Required settings:**

- ✅ **Require a pull request before merging**
  - Require approvals: **2**
  - Dismiss stale pull request approvals when new commits are pushed: **enabled**
  - Require review from Code Owners: **enabled**

- ✅ **Require status checks to pass before merging**
  - Require branches to be up to date before merging: **enabled**
  - Required checks:
    - `GAP Scanner`
    - `Dependency Version Check`
    - `.gaprc.json Protection Check`
    - `GAP Override Detection`

- ✅ **Require conversation resolution before merging**
  - **enabled**

- ✅ **Require linear history**
  - **enabled** (prevents merge commits)

- ✅ **Do not allow bypassing the above settings**
  - **enabled** (prevents admin bypass)

- ✅ **Restrict who can push to matching branches**
  - Include administrators: **disabled**
  - Allowed teams: `@gap-admin` only

---

## 👥 Required Teams

Create these GitHub teams with appropriate permissions:

### @gap-admin

- **Purpose**: System configuration owners
- **Members**: 1-2 senior engineers
- **Permissions**:
  - Can approve `.gaprc.json` changes
  - Can modify GAP system scripts
  - Can bypass GAP scanner (emergency only)

### @gap-maintainers

- **Purpose**: GAP system maintainers
- **Members**: 3-5 engineers
- **Permissions**:
  - Can review GAP scripts
  - Can update documentation
  - Cannot modify `.gaprc.json` alone

### @security-team

- **Purpose**: Security reviewers
- **Members**: Security engineers
- **Permissions**:
  - Must review pre-commit hook changes
  - Must review dependency updates
  - Can flag security issues

### @devops-team

- **Purpose**: CI/CD pipeline owners
- **Members**: DevOps engineers
- **Permissions**:
  - Can modify CI workflows
  - Can update GitHub Actions
  - Can configure secrets

### @docs-team

- **Purpose**: Documentation maintainers
- **Members**: Technical writers + engineers
- **Permissions**:
  - Can update GAP documentation
  - Can improve onboarding materials

---

## 🚨 Emergency Override Procedures

### When GAP Scanner Blocks Production Fix

1. **Create emergency bypass PR**:

   ```bash
   git checkout -b emergency/bypass-gap-scanner
   ```

2. **Document the reason**:
   - Create `docs/emergency/YYYY-MM-DD-reason.md`
   - Explain:
     - What broke
     - Why GAP scanner blocks it
     - Why override is necessary
     - Rollback plan

3. **Get approval**:
   - Required: 2x `@gap-admin` approval
   - Required: 1x `@security-team` approval

4. **Bypass options**:

   **Option A: Disable specific check**:

   ```bash
   npm run gap:config -- disable <check-id>
   git add .gaprc.json
   git commit -m "emergency: Disable <check-id> for production fix"
   ```

   **Option B: Use disabled mode** (last resort):

   ```bash
   # In .github/workflows/gap-prevention.yml
   GAP_SCAN_MODE: disabled  # Temporarily
   ```

5. **After emergency**:
   - Re-enable check within 24 hours
   - Fix root cause
   - Update `.gaprc.json` to prevent recurrence

---

## 📝 .gaprc.json Change Process

### Standard Process (Non-Emergency)

1. **Create proposal PR**:

   ```bash
   git checkout -b config/update-gap-check
   ```

2. **Make changes**:

   ```bash
   # Create backup first
   npm run gap:backup -- create "Before config update" --emergency

   # Modify .gaprc.json
   vim .gaprc.json

   # Validate
   npm run gap:config -- validate
   ```

3. **Document changes**:
   - Add comment in `.gaprc.json` explaining why
   - Update `docs/GAP_SCANNER_GUIDE.md` if needed

4. **Get approvals**:
   - Required: 2x `@gap-admin`
   - Required: Team notification in PR description

5. **Test in shadow mode**:

   ```bash
   GAP_SCAN_MODE=shadow npm run gap:scan
   ```

6. **Merge and announce**:
   - Post in `#gap-scanner` Slack channel
   - Update team wiki

---

## 🔍 Audit Trail Requirements

### All .gaprc.json changes must include:

1. **Backup verification**:

   ```bash
   npm run gap:backup -- list
   # Verify backup exists before change
   ```

2. **Change justification**:
   - In PR description
   - In commit message
   - In `.gaprc.json` comment

3. **Impact assessment**:
   - Which checks affected
   - Which teams affected
   - Rollback plan

4. **Approval records**:
   - GitHub PR approvals
   - Slack thread link
   - Meeting notes (if applicable)

---

## 🚫 Prohibited Actions

### Without @gap-admin approval:

❌ Modifying `.gaprc.json` directly on `main`
❌ Using `GAP_SCAN_MODE=disabled` in CI
❌ Removing checks without replacement
❌ Changing severity levels (P0/P1/P2) arbitrarily
❌ Bypassing pre-commit hooks with `--no-verify`

### Without security review:

❌ Modifying pre-commit hook logic
❌ Updating ESLint/TypeScript/Prettier versions
❌ Adding new GAP override mechanisms

---

## 📊 Monitoring & Alerts

### Weekly Reviews

`@gap-admin` should review:

1. **GAP Scanner metrics**:

   ```bash
   npm run gap:scan:metrics -- --report=weekly
   ```

2. **Override usage**:
   - Check for `--no-verify` usage
   - Review disabled mode usage
   - Audit bypass PRs

3. **System health**:
   - False positive rate
   - Check effectiveness
   - Team feedback

### Monthly Audits

1. **Backup registry**:

   ```bash
   npm run gap:backup -- list
   npm run gap:backup -- cleanup
   ```

2. **Team compliance**:
   - Review enforcement metrics
   - Check documentation updates
   - Assess training needs

---

## 🔄 Version Control

### .gaprc.json versioning:

- **Major change** (1.x.0 → 2.0.0): New checks added/removed
- **Minor change** (1.0.x → 1.1.0): Severity or config updates
- **Patch change** (1.0.0 → 1.0.1): Minor tweaks, exemptions

### Changelog requirement:

Every `.gaprc.json` change must update:

- `docs/GAP_SCANNER_GUIDE.md` (if user-facing)
- `.gaprc.json` version field
- Git commit message with `[GAP CONFIG]` prefix

---

## 🛡️ Security Considerations

### Secrets Management

Never commit to `.gaprc.json`:

- API keys
- Webhook URLs with tokens
- Email addresses (use teams instead)
- Slack webhook secrets

Use GitHub Secrets instead:

```yaml
# .github/workflows/gap-prevention.yml
env:
  SLACK_WEBHOOK: ${{ secrets.GAP_SLACK_WEBHOOK }}
```

### Access Control

1. **Principle of least privilege**:
   - Only `@gap-admin` can approve config changes
   - Only `@devops-team` can modify CI

2. **Audit logging**:
   - All changes tracked in Git
   - All overrides logged to Slack
   - All bypasses require documentation

---

## 📞 Support & Escalation

### Tier 1: Self-Service

- Read `docs/GAP_SCANNER_GUIDE.md`
- Check FAQ in onboarding template
- Run `npm run gap:scan -- --help`

### Tier 2: Team Support

- Ask in `#gap-scanner` Slack channel
- Tag `@gap-maintainers`

### Tier 3: Admin Escalation

- Tag `@gap-admin` in PR
- For emergencies: Direct message + on-call

### Tier 4: Emergency

- Use emergency override procedure
- Notify `@gap-admin` + `@security-team`
- Document in incident report

---

**Last Updated**: 2025-10-01
**Maintained by**: @gap-admin
**Review Cycle**: Monthly
