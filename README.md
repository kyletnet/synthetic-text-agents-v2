# Meta-Adaptive Expert Orchestration System

AI-powered QA generation using 8-Agent collaboration with P0 hardened launcher.

## Quick Start

**Smoke Test (Free):**

```bash
./run_v3.sh step4_2 --smoke --offline
```

**Production Run:**

```bash
./run_v3.sh step4_2 --full --budget 5.00 --profile prod
```

## Documentation

- **[Operations Guide](docs/OPERATIONS.md)** - Essential operational procedures and troubleshooting
- **[System Map](SYSTEM_MAP.md)** - Architecture overview and component relationships
- **[Claude Code Setup](CLAUDE.md)** - Development environment and coding standards

## Components

- **Unified Launcher:** `run_v3.sh` - P0 hardened execution with offline support
- **API Client:** `tools/anthropic_client.sh` - Single point for all API access
- **Guard System:** `npm run guard:all` - Comprehensive safety and policy enforcement
- **Regression Tests:** `npm run regression:mini` - Automated quality assurance

## Key Features

- 🔒 **Security First:** Single API client, secret masking, git hygiene
- 🚀 **Production Ready:** Budget controls, cost tracking, comprehensive logging
- 🧪 **Testing:** Offline mode, regression suite, schema validation
- 📊 **Observability:** Detailed session reports, metrics collection, history archival

## Development

```bash
# Install dependencies
npm install

# Run all safety guards
npm run guard:all

# Build and test
npm run build && npm run test

# Run regression tests
npm run regression:mini
```

For detailed operations procedures, see **[Operations Guide](docs/OPERATIONS.md)**.
