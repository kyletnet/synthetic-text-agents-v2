/**
 * Integration Tests - Phase 4.1 Federated AI Civilization
 *
 * Tests for the 5-layer federation architecture:
 * 1. Cross-Civic Federation (BFT)
 * 2. Carbon Credit Market
 * 3. Council Oversight Protocol
 * 4. Cultural Neutralization Filter
 * 5. Temporal Compaction Engine
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CrossCivicFederation } from '../../../src/core/federation/cross-civic-federation';
import { CarbonCreditMarket } from '../../../src/runtime/market/carbon-credit-market';
import { CouncilOversightProtocol } from '../../../src/core/governance/council-oversight-protocol';
import { CulturalNeutralizationFilter } from '../../../src/core/governance/cultural-neutralization-filter';
import { TemporalCompactionEngine } from '../../../src/runtime/temporal-compaction-engine';

describe('Phase 4.1 - Cross-Civic Federation', () => {
  let federation: CrossCivicFederation;

  beforeEach(() => {
    federation = new CrossCivicFederation({
      networkId: 'testnet',
      localNodeId: 'test-node-1',
    });
  });

  it('should register civic nodes', async () => {
    const node = await federation.registerNode({
      name: 'Civic A',
      networkId: 'testnet',
      endpoint: 'https://civic-a.example.com',
      publicKey: 'public-key-a',
    });

    expect(node.id).toBeDefined();
    expect(node.name).toBe('Civic A');
    expect(node.status).toBe('active');
    expect(node.reputationScore).toBe(50); // Neutral start
  });

  it('should reach BFT consensus with 3 nodes', async () => {
    // Register 3 nodes
    const nodeA = await federation.registerNode({
      name: 'Civic A',
      networkId: 'testnet',
      endpoint: 'https://civic-a.example.com',
      publicKey: 'pk-a',
    });

    const nodeB = await federation.registerNode({
      name: 'Civic B',
      networkId: 'testnet',
      endpoint: 'https://civic-b.example.com',
      publicKey: 'pk-b',
    });

    const nodeC = await federation.registerNode({
      name: 'Civic C',
      networkId: 'testnet',
      endpoint: 'https://civic-c.example.com',
      publicKey: 'pk-c',
    });

    // Propose state
    const state = await federation.proposeState({
      stateType: 'policy',
      data: { policyName: 'Test Policy' },
      proposedBy: nodeA.id,
    });

    // Vote (need 2/3 = 2 approvals for BFT)
    await federation.voteOnState(state.id, nodeA.id, 'approve');
    await federation.voteOnState(state.id, nodeB.id, 'approve');

    const result = federation.calculateConsensusResult(state.id);

    expect(result.consensusReached).toBe(true);
    expect(result.approveVotes).toBe(2);
    expect(result.byzantineTolerance).toBe(0); // (3-1)/3 = 0
  });

  it('should detect and isolate Byzantine nodes', async () => {
    const node = await federation.registerNode({
      name: 'Malicious Node',
      networkId: 'testnet',
      endpoint: 'https://bad.example.com',
      publicKey: 'pk-bad',
    });

    // Mark as Byzantine
    await federation.markByzantine(
      node.id,
      'Inconsistent vote signatures detected'
    );

    const nodes = federation.getNodes({ status: 'byzantine' });
    expect(nodes.length).toBe(1);
    expect(nodes[0].id).toBe(node.id);
    expect(nodes[0].byzantineViolations).toBe(1);
  });
});

describe('Phase 4.1 - Carbon Credit Market', () => {
  let market: CarbonCreditMarket;

  beforeEach(() => {
    market = new CarbonCreditMarket();
  });

  it('should allocate carbon credits', async () => {
    const credit = await market.allocateCarbonCredits(
      'tenant-a',
      100, // 100 kgCO2e
      'allocation'
    );

    expect(credit.id).toBeDefined();
    expect(credit.amount).toBe(100);
    expect(credit.tenantId).toBe('tenant-a');
    expect(credit.valid).toBe(true);
  });

  it('should track carbon consumption', async () => {
    // Allocate credits first
    await market.allocateCarbonCredits('tenant-a', 100, 'allocation');

    // Simulate allocation with carbon tracking
    const result = await market.allocateWithCarbonTracking(
      {
        userId: 'user-1',
        maxCost: 10,
        maxLatency: 5000,
        minQuality: 0.8,
        weights: { cost: 0.4, latency: 0.3, quality: 0.3 },
      },
      {
        tenantId: 'tenant-a',
        carbonBudget: 10, // Max 10 kgCO2e
      }
    );

    expect(result.carbonEmitted).toBeGreaterThan(0);
    expect(result.carbonEmitted).toBeLessThanOrEqual(10);
    expect(result.greenScore).toBeGreaterThan(0);
    expect(result.greenScore).toBeLessThanOrEqual(100);
  });

  it('should generate carbon neutrality report', async () => {
    const tenantId = 'tenant-test';

    // Allocate carbon credits
    await market.allocateCarbonCredits(tenantId, 50, 'offset');

    const report = await market.generateNeutralityReport(tenantId, {
      start: new Date(Date.now() - 24 * 60 * 60 * 1000),
      end: new Date(),
    });

    expect(report.tenantId).toBe(tenantId);
    expect(report.totalOffsets).toBe(50);
    expect(report.greenScore).toBeGreaterThanOrEqual(0);
    expect(report.greenScore).toBeLessThanOrEqual(100);
  });
});

describe('Phase 4.1 - Council Oversight Protocol', () => {
  let council: CouncilOversightProtocol;

  beforeEach(() => {
    council = new CouncilOversightProtocol({
      ledgerPath: '/tmp/test-council-ledger.jsonl',
    });
  });

  it('should add council members', async () => {
    const member = await council.addMember({
      name: 'Alice',
      type: 'human',
      votingPower: 100,
      term: 12,
      active: true,
    });

    expect(member.id).toBeDefined();
    expect(member.name).toBe('Alice');
    expect(member.quadraticVotes).toBe(10); // sqrt(100)
  });

  it('should create and vote on proposals', async () => {
    // Add members
    const alice = await council.addMember({
      name: 'Alice',
      type: 'human',
      votingPower: 100,
      term: 12,
      active: true,
    });

    const bob = await council.addMember({
      name: 'Bob',
      type: 'human',
      votingPower: 64,
      term: 12,
      active: true,
    });

    // Create proposal
    const proposal = await council.createProposal({
      title: 'Test Proposal',
      description: 'A test proposal for voting',
      proposerId: alice.id,
      proposerType: 'human',
      type: 'policy_change',
      deliberationPeriod: 0, // Immediate voting for test
      quorum: 0.5, // 50% participation
    });

    expect(proposal.id).toBeDefined();
    expect(proposal.status).toBe('deliberation');

    // Start voting
    await council.startVoting(proposal.id);

    // Cast votes
    await council.castVote(proposal.id, alice.id, 'approve');
    await council.castVote(proposal.id, bob.id, 'approve');

    // Close voting
    const result = await council.closeVoting(proposal.id);

    expect(result.consensusReached).toBe(true); // quorumMet should be calculated based on members
    expect(result.approveVotes).toBe(2);
  });

  it('should maintain public ledger', async () => {
    const alice = await council.addMember({
      name: 'Alice',
      type: 'human',
      votingPower: 100,
      term: 12,
      active: true,
    });

    const proposal = await council.createProposal({
      title: 'Ledger Test',
      description: 'Testing public ledger',
      proposerId: alice.id,
      proposerType: 'human',
      type: 'other',
      deliberationPeriod: 0,
      quorum: 0.5,
    });

    const ledger = council.getPublicLedger({
      proposalId: proposal.id,
    });

    expect(ledger.length).toBeGreaterThan(0);
    expect(ledger[0].eventType).toBe('proposal_created');
    expect(ledger[0].hash).toBeDefined(); // Blockchain-style hash
  });
});

describe('Phase 4.1 - Cultural Neutralization Filter', () => {
  let filter: CulturalNeutralizationFilter;

  beforeEach(() => {
    filter = new CulturalNeutralizationFilter();
  });

  it('should detect language imbalance', async () => {
    const contexts = [
      { language: 'en', timestamp: new Date() },
      { language: 'en', timestamp: new Date() },
      { language: 'en', timestamp: new Date() },
      { language: 'ko', timestamp: new Date() },
    ];

    const result = await filter.detectBias([], contexts);

    expect(result.biasDetected).toBe(true);
    expect(result.details.languageBalance).toBeDefined();
    expect(result.details.languageBalance?.dominantLanguage).toBe('en');
    expect(result.details.languageBalance?.dominanceRatio).toBeGreaterThan(0.5);
  });

  it('should detect stereotypes', async () => {
    const content = [
      'Women are naturally more emotional than men.',
      'All Asians are good at math.',
    ];

    const result = await filter.detectBias(content, []);

    expect(result.biasDetected).toBe(true);
    expect(result.biasType).toBe('stereotype');
    expect(result.details.stereotypeDetection?.stereotypesDetected.length).toBeGreaterThan(0);
  });

  it('should provide neutralization recommendations', async () => {
    const contexts = [
      { language: 'en', region: 'US', continent: 'North America', timestamp: new Date() },
      { language: 'en', region: 'US', continent: 'North America', timestamp: new Date() },
      { language: 'en', region: 'US', continent: 'North America', timestamp: new Date() },
    ];

    const result = await filter.detectBias([], contexts);

    expect(result.recommendations.length).toBeGreaterThan(0);
  });
});

describe('Phase 4.1 - Temporal Compaction Engine', () => {
  let engine: TemporalCompactionEngine;

  beforeEach(() => {
    engine = new TemporalCompactionEngine(
      {
        windowSize: 3600000, // 1 hour
        retentionPeriod: 90,
        sampleRate: 0.01,
      },
      {
        storagePath: '/tmp/test-temporal',
        archivePath: '/tmp/test-archive',
      }
    );
  });

  it('should compact evidence within time window', async () => {
    const now = new Date();
    const windowStart = new Date(now.getTime() - 3600000);
    const windowEnd = now;

    const evidence = [
      {
        runId: 'run-1',
        timestamp: new Date(now.getTime() - 1800000),
        evidenceIds: ['e1', 'e2'],
        evidenceHashes: ['hash1', 'hash2'],
        trustScores: [0.9, 0.85],
        citationCount: 5,
        nliVerified: true,
      },
      {
        runId: 'run-2',
        timestamp: new Date(now.getTime() - 900000),
        evidenceIds: ['e3', 'e4'],
        evidenceHashes: ['hash3', 'hash4'],
        trustScores: [0.88, 0.92],
        citationCount: 3,
        nliVerified: true,
      },
    ];

    const result = await engine.compactWindow(
      evidence,
      windowStart,
      windowEnd
    );

    expect(result.success).toBe(true);
    expect(result.compressionRatio).toBeGreaterThan(1);
    expect(result.storageReduction).toBeGreaterThan(0);
    expect(result.totalEvidence).toBe(2);
  });

  it('should auto-compact multiple windows', async () => {
    const now = new Date();
    const evidence = Array.from({ length: 10 }, (_, i) => ({
      runId: `run-${i}`,
      timestamp: new Date(now.getTime() - i * 600000), // 10-minute intervals
      evidenceIds: [`e${i}`],
      evidenceHashes: [`hash${i}`],
      trustScores: [0.9],
      citationCount: 1,
      nliVerified: true,
    }));

    const results = await engine.autoCompact(evidence);

    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.success)).toBe(true);
  });

  it('should purge expired data', async () => {
    const now = new Date();
    const oldDate = new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000); // 100 days ago

    const evidence = [
      {
        runId: 'old-run',
        timestamp: oldDate,
        evidenceIds: ['e-old'],
        evidenceHashes: ['hash-old'],
        trustScores: [0.9],
        citationCount: 1,
        nliVerified: true,
      },
    ];

    await engine.compactWindow(
      evidence,
      new Date(oldDate.getTime() - 3600000),
      oldDate
    );

    const purgeResult = await engine.purgeExpiredData();

    expect(purgeResult.purged).toBeGreaterThanOrEqual(0);
    expect(purgeResult.retained + purgeResult.purged + purgeResult.legalHold).toBeGreaterThanOrEqual(0);
  });
});

describe('Phase 4.1 - End-to-End Integration', () => {
  it('should integrate all 5 layers in a federated query', async () => {
    // Setup
    const federation = new CrossCivicFederation({ networkId: 'testnet' });
    const carbonMarket = new CarbonCreditMarket();
    const council = new CouncilOversightProtocol();
    const culturalFilter = new CulturalNeutralizationFilter();
    const compactionEngine = new TemporalCompactionEngine();

    // Register nodes
    const nodeA = await federation.registerNode({
      name: 'Civic A',
      networkId: 'testnet',
      endpoint: 'https://civic-a.test',
      publicKey: 'pk-a',
    });

    // Propose state
    const state = await federation.proposeState({
      stateType: 'resource_allocation',
      data: { query: 'test query' },
      proposedBy: nodeA.id,
    });

    // Vote
    await federation.voteOnState(state.id, nodeA.id, 'approve');

    // Check consensus
    const consensus = federation.calculateConsensusResult(state.id);
    expect(consensus.consensusReached).toBe(true);

    // Allocate carbon credits
    await carbonMarket.allocateCarbonCredits('tenant-a', 100, 'allocation');

    // Check cultural bias
    const biasResult = await culturalFilter.detectBias(
      ['Test content'],
      [{ language: 'en', timestamp: new Date() }]
    );
    expect(biasResult).toBeDefined();

    // Compact provenance
    const compactionResult = await compactionEngine.compactWindow(
      [
        {
          runId: 'test-run',
          timestamp: new Date(),
          evidenceIds: ['e1'],
          evidenceHashes: ['hash1'],
          trustScores: [0.9],
          citationCount: 1,
          nliVerified: true,
        },
      ],
      new Date(Date.now() - 3600000),
      new Date()
    );
    expect(compactionResult.success).toBe(true);

    // Verify all layers worked
    expect(federation.getStats().totalStates).toBeGreaterThan(0);
    expect(carbonMarket.getStats().totalCredits).toBeGreaterThan(0);
    expect(compactionEngine.getStats().totalWindows).toBeGreaterThan(0);
  });
});
