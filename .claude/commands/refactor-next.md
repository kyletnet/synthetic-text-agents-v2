# /refactor-next

Shows the next recommended action for the Smart Refactor System.

## 기능 (Features)

- **🎯 Smart Recommendations**: Context-aware next step suggestions
- **⏰ Time-based Logic**: Considers time since last audit
- **🔄 Session Awareness**: Prioritizes incomplete sessions

## 사용법 (Usage)

```bash
/refactor-next
```

## Actions

```bash
tsx scripts/smart-refactor-auditor.ts summary | grep "Next action"
```

Possible recommendations:
- Resume incomplete confirmation session
- Review pending confirmations
- Run new audit (if >24h since last)
- No action needed