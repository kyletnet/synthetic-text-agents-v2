# Slash Commands Reference

## Essential Commands

### `/sync` - Complete System Update
```bash
bash scripts/slash-commands.sh sync
```
- Updates all documentation
- Cleans old files
- Validates system health
- Commits and pushes changes

### `/status` - System Health Check
```bash
bash scripts/slash-commands.sh status
```
- Checks documentation freshness
- Validates all configurations
- Reports system status

### `/ship` - Full Deployment Pipeline
```bash
bash scripts/slash-commands.sh ship
```
- Complete CI/CD pipeline
- Documentation sync
- Quality validation
- Deployment preparation

### `/clean` - Cleanup Old Files
```bash
bash scripts/slash-commands.sh clean
```
- Removes old documentation
- Cleans log files
- Removes temporary files

## Auto-Generated Commands
- `/docs`: sync:Full documentation sync
- `/docs`: status:Check documentation freshness
- `/system`: map:Generate system architecture map
- `/ci`: strict:Complete CI validation
- `/ship`: Full deployment pipeline
- `/build`: Build TypeScript project
- `/test`: Run test suite
- `/lint`: fix:Fix linting issues
- `/typecheck`: TypeScript validation
