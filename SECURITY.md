# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security vulnerability in this project, please report it privately.

### How to Report

1. **Email**: Send details to security@[project-domain].com
2. **GitHub**: Use GitHub's private vulnerability reporting feature
3. **Response Time**: We will respond within 48 hours

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if available)

## Security Measures

### API Key Management

- Never commit API keys to version control
- Use environment variables for all secrets
- Rotate API keys regularly
- Use least-privilege access principles

### Dependencies

- Automated security scanning via Dependabot
- Regular dependency updates
- Security audit on every CI run

### Code Security

- No hardcoded secrets or credentials
- Input validation and sanitization
- Secure logging (no sensitive data in logs)
- Rate limiting for API endpoints

## Security Best Practices for Contributors

1. **Environment Variables**: Use `.env.example` as template, never commit `.env`
2. **Secrets in CI**: Use GitHub Secrets for CI/CD pipelines
3. **Dependency Updates**: Keep dependencies up to date
4. **Code Review**: All changes require security review for sensitive areas

## Vulnerability Disclosure Process

1. **Report received** - Acknowledged within 48 hours
2. **Initial assessment** - Severity evaluated within 7 days
3. **Fix development** - Patch developed and tested
4. **Coordinated disclosure** - Public advisory after fix deployment
5. **Post-mortem** - Process improvement review

## Security Contacts

- Security Team: security@[project-domain].com
- Project Maintainer: [maintainer-email]
- Emergency Contact: [emergency-contact]
