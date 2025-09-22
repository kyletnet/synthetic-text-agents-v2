import { describe, it, expect } from 'vitest';
import { DomainConsultant } from '../src/agents/domainConsultant';
import { Logger } from '../src/shared/logger';

describe('DomainConsultant', () => {
  it('should create instance correctly', () => {
    const logger = new Logger();
    const agent = new DomainConsultant(logger);
    expect(agent).toBeDefined();
    expect(agent.id).toBe('domain-consultant');
  });

  it('should have domain consultation capabilities', () => {
    const logger = new Logger();
    const agent = new DomainConsultant(logger);
    expect(agent.tags).toContain('domain-expertise');
  });

  it('should have correct specialization', () => {
    const logger = new Logger();
    const agent = new DomainConsultant(logger);
    expect(agent.specialization).toBe('domain_expertise_professional_knowledge');
  });
});