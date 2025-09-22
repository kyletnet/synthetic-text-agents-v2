# P1 Operations Guide
## Incident Response & Monitoring

### Overview
This guide provides comprehensive operational procedures for the P1 Enhanced System including incident response, monitoring, troubleshooting, and maintenance procedures.

## System Architecture Overview

### Core Components
- **Launcher (run_v3.sh)**: Main orchestration layer with atomic outputs and state management
- **State Machine**: QUEUED → RUNNING → SUCCESS|FAIL|SKIPPED transitions
- **Dead Letter Queue (DLQ)**: Failed run retry management system
- **Runtime Guards**: Concurrency, QPS, budget limits, and emergency killswitch
- **Session Reports**: 45+ field comprehensive reporting with CI metadata
- **Regression Testing**: 25-case test suite with baseline freeze functionality
- **CI Gates**: 8 comprehensive checks for security and compliance

### File System Layout
```
├── run_v3.sh                    # Main launcher
├── scripts/
│   ├── dlq_manager.sh           # DLQ management
│   ├── validate_toolchain.sh    # Version compliance
│   └── scan_secrets.sh          # Security scanning
├── tools/
│   ├── runtime_guard.sh         # Resource protection
│   └── run_regression.mjs       # Regression testing
├── tmp/run_${RUN_ID}/           # Atomic workspaces
├── DLQ/                         # Dead letter queue storage
├── outputs/                     # Final atomic outputs
└── reports/                     # Session reports and history
```

## Monitoring & Alerting

### Key Metrics to Monitor

#### System Health Metrics
- **Concurrency**: Current/Max active runs (default: 3)
- **Daily Budget**: Spent/Available USD (default: $50/day)
- **QPS Rate**: Requests per second (default: 2/sec max)
- **DLQ Size**: Number of failed runs awaiting retry
- **Disk Space**: tmp/ and outputs/ directory usage

#### Performance Metrics
- **Session Duration**: End-to-end execution time
- **Success Rate**: PASS vs FAIL ratio
- **Retry Rate**: DLQ retry success percentage
- **Regression Results**: Pass/fail rate and score trends

#### Security Metrics
- **Secret Scan Results**: Git repository security status
- **Dependency Vulnerabilities**: npm audit high-severity count
- **Toolchain Compliance**: Version mismatch warnings

### Monitoring Commands
```bash
# System health check
npm run guard:all

# Real-time session monitoring
tail -f reports/session_report.md

# DLQ status check
bash scripts/dlq_manager.sh status

# Runtime guard status
bash tools/runtime_guard.sh status

# Regression test results
node tools/run_regression.mjs --extended --offline
```

### Alerting Thresholds

#### Critical Alerts (Immediate Response Required)
- **Killswitch Activated**: Emergency shutdown triggered
- **Budget Exceeded**: Daily spending limit reached
- **DLQ Overflow**: >10 failed runs in queue
- **Security Violation**: Secrets detected in repository
- **Disk Space**: <1GB free in temp directories

#### Warning Alerts (Monitor Closely)
- **High Concurrency**: >2 concurrent runs
- **QPS Throttling**: Rate limiting active
- **Toolchain Drift**: Version mismatches detected
- **Regression Degradation**: Test scores declining

## Incident Response Procedures

### Severity Levels

#### P0 - Critical (Response: <15 minutes)
- System completely down
- Security breach detected
- Data corruption/loss
- Budget runaway (>$100/day)

#### P1 - High (Response: <1 hour)
- Major feature unavailable
- High error rates (>50% failures)
- DLQ backlog growing rapidly
- Performance severely degraded

#### P2 - Medium (Response: <4 hours)
- Minor feature issues
- Moderate error rates (10-50% failures)
- Toolchain version warnings
- Slow performance

#### P3 - Low (Response: <24 hours)
- Documentation issues
- Non-critical warnings
- Cosmetic problems

### Emergency Procedures

#### Killswitch Activation
```bash
# Immediate system shutdown
echo "true" > tools/runtime_guard_killswitch.flag

# Verify all runs stopped
bash tools/runtime_guard.sh status

# Check for running processes
ps aux | grep run_v3.sh
```

#### Budget Runaway Protection
```bash
# Check current spending
bash tools/runtime_guard.sh status

# Force budget limit
export DAILY_BUDGET_USD=0.01
./run_v3.sh step4_2 --smoke --offline

# Reset daily budget (next day)
rm -f tools/runtime_guard_daily_budget.txt
```

#### DLQ Emergency Drain
```bash
# Stop all retries
mv DLQ DLQ_quarantine_$(date +%Y%m%d_%H%M%S)

# Clear retry queue
mkdir -p DLQ/ready DLQ/processing DLQ/permanent_failures

# Restart normal operations
bash scripts/dlq_manager.sh status
```

### Troubleshooting Guide

#### Common Issues

##### Issue: "info: command not found"
**Symptoms**: Launcher fails with missing info function
**Solution**:
```bash
# Check if info function is defined in run_v3.sh
grep "info()" run_v3.sh

# If missing, add to logging functions:
echo 'info() { printf "\033[34m[INFO]\033[0m %s\n" "$*"; }' >> run_v3.sh
```

##### Issue: Atomic workspace conflicts
**Symptoms**: Multiple runs failing with workspace errors
**Solution**:
```bash
# Clean orphaned workspaces
find tmp/ -name "run_*" -type d -mtime +1 -exec rm -rf {} \;

# Check for stuck state files
find tmp/ -name "*.state" -exec cat {} \; | sort | uniq -c
```

##### Issue: DLQ retry loops
**Symptoms**: Same run failing repeatedly
**Solution**:
```bash
# Inspect specific DLQ entry
bash scripts/dlq_manager.sh inspect <run_id>

# Move to permanent failures
bash scripts/dlq_manager.sh mark_permanent <run_id>

# Clear retry count
rm -f DLQ/ready/<run_id>/retry_count
```

##### Issue: Regression test failures
**Symptoms**: Baseline violations in CI
**Solution**:
```bash
# Check current vs baseline metrics
node tools/run_regression.mjs --extended --verbose

# Update baseline if intentional change
node tools/run_regression.mjs --extended --freeze

# Investigate specific failures
cat reports/regression_summary.md
```

#### Log Analysis

##### Session Logs Location
- **Current Session**: `reports/session_report.md`
- **Historical Sessions**: `reports/history/*/session_report.md`
- **Detailed Logs**: `RUN_LOGS/session_*.log`

##### Key Log Patterns
```bash
# Find failed runs
grep "RESULT: FAIL" reports/history/*/session_report.md

# Track state transitions
grep "State transition" RUN_LOGS/session_*.log

# Security violations
grep "SECURITY VIOLATION" RUN_LOGS/session_*.log

# Budget tracking
grep "Daily budget" RUN_LOGS/session_*.log
```

## Maintenance Procedures

### Daily Maintenance

#### Automated Health Checks
```bash
# Run comprehensive validation
npm run guard:all

# Verify regression baseline
npm run regression:mini

# Clean temporary files
npm run hygiene:clean
```

#### Manual Monitoring Tasks
1. Review session reports for errors
2. Check DLQ status and clear successful retries
3. Monitor disk usage in tmp/ and outputs/
4. Verify no secrets in git repository

### Weekly Maintenance

#### Regression Baseline Updates
```bash
# Review regression trends
node tools/run_regression.mjs --extended --verbose

# Update baseline if performance improved
node tools/run_regression.mjs --extended --freeze

# Archive old baselines
cp tests/regression/baseline_metrics.json \
   tests/regression/baselines/$(date +%Y%m%d).json
```

#### Security Audit
```bash
# Full dependency audit
npm audit

# Fix vulnerabilities
npm audit fix

# Verify toolchain compliance
scripts/validate_toolchain.sh validate
```

### Monthly Maintenance

#### Performance Review
1. Analyze session report trends
2. Review DLQ retry patterns
3. Optimize runtime guard thresholds
4. Update operational procedures

#### Capacity Planning
1. Review concurrency utilization
2. Analyze budget consumption patterns
3. Plan for scaling requirements
4. Update alerting thresholds

## Configuration Management

### Environment Variables

#### Required Variables
```bash
# API Configuration
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_API_KEYS=key1,key2,key3  # For rotation

# Runtime Limits
DAILY_BUDGET_USD=50.00
CONCURRENCY_LIMIT=3
QPS_LIMIT=2.0
```

#### Optional Variables
```bash
# CI/CD Integration
CI_BUILD_ID=12345
CI_PROVIDER=github
CI_BRANCH=main
CI_PR_NUMBER=42

# Feature Flags
OFFLINE_MODE=true
REGRESSION_MODE=true
DEBUG_MODE=false
```

### File-based Configuration

#### Toolchain Version Pins
- **.nvmrc**: Node.js version (18.18.0)
- **.python-version**: Python version (3.9.18)
- **package-lock.json**: npm dependencies

#### Runtime Guard Limits
- **tools/runtime_guard_config.json**: Configurable thresholds
- **tools/runtime_guard_killswitch.flag**: Emergency shutdown

#### DLQ Configuration
- **DLQ/config.json**: Retry limits and backoff settings
- **DLQ/*/retry_count**: Per-run retry tracking

## Disaster Recovery

### Backup Procedures

#### Critical Data to Backup
1. **Configuration Files**: .env, .nvmrc, package.json
2. **Outputs Directory**: All atomic outputs
3. **DLQ State**: Failed run recovery data
4. **Session History**: reports/history/
5. **Regression Baselines**: tests/regression/baseline_metrics.json

#### Backup Commands
```bash
# Create full backup
tar -czf backup_$(date +%Y%m%d_%H%M%S).tar.gz \
    .env* .nvmrc package*.json \
    outputs/ DLQ/ reports/history/ \
    tests/regression/baseline_metrics.json

# Upload to secure storage (example)
# aws s3 cp backup_*.tar.gz s3://company-backups/p1-system/
```

### Recovery Procedures

#### System Restoration
1. **Stop all running processes**
2. **Restore configuration files**
3. **Restore outputs and state**
4. **Validate system integrity**
5. **Resume normal operations**

#### Data Recovery Commands
```bash
# Restore from backup
tar -xzf backup_YYYYMMDD_HHMMSS.tar.gz

# Verify restoration
npm run guard:all

# Test basic functionality
./run_v3.sh step4_2 --smoke --offline
```

## Contact Information

### Escalation Matrix

#### On-Call Engineer (24/7)
- **Primary**: [Primary Engineer Contact]
- **Secondary**: [Secondary Engineer Contact]

#### Subject Matter Experts
- **System Architecture**: [Architect Contact]
- **Security**: [Security Team Contact]
- **Infrastructure**: [DevOps Team Contact]

#### External Vendors
- **Anthropic API Support**: [Support Contact]
- **Cloud Provider**: [Cloud Support Contact]

### Communication Channels

#### Incident Response
- **Critical Issues**: #incident-response
- **Status Updates**: #system-status
- **Post-Mortems**: #post-mortem-reviews

#### Operational Updates
- **Daily Standup**: #daily-ops
- **Weekly Reviews**: #weekly-ops-review
- **Monthly Planning**: #monthly-ops-planning

---

*This operations guide should be reviewed and updated monthly to reflect system changes and lessons learned from incidents.*