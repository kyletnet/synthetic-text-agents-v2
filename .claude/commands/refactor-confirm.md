# /refactor-confirm

Interactive confirmation for structural refactoring changes.

## 기능 (Features)

- **🔶 Interactive Review**: Preview and approve each structural change
- **📋 Context Recovery**: Resume interrupted confirmation sessions
- **🎯 Risk Assessment**: Clear risk levels (low/medium/high) for each item
- **🔄 Session Management**: Save progress between interruptions

## 사용법 (Usage)

```bash
# Review pending confirmations
/refactor-confirm

# The system will guide you through each item:
# [1/4] 🔧 Agent Inheritance Standardization
#      Impact: 8 files, medium risk
#      Preview changes? [y/N]: y
#      Apply this change? [y/N/s(kip)/q(uit)]: y
```

## Actions

Interactive confirmation loop with:
- **Preview**: Show exactly what will change
- **Apply**: Confirm and apply the change
- **Skip**: Skip this item for now
- **Quit**: Exit and save session for later

All decisions are logged and used to improve future automation.