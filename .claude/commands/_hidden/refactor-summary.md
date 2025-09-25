# /refactor-summary

Quick status overview of the Smart Refactor System.

## 기능 (Features)

- **📊 Current Status**: Auto-fixed items, pending confirmations, rollback points
- **🎯 Next Action**: Intelligent recommendation for what to do next
- **📈 Progress Tracking**: See completion status across all categories

## 사용법 (Usage)

```bash
/refactor-summary
```

## Actions

```bash
tsx scripts/smart-refactor-auditor.ts summary
```

Shows:

- Auto-fixed items count
- Pending confirmations count
- Available rollback points
- Incomplete session status
- Recommended next action
