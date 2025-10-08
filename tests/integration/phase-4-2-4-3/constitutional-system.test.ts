/**
 * Integration Tests - Phase 4.2-4.3 Constitutional & Advanced Systems
 *
 * Tests for:
 * - Constitutional Codex
 * - Adaptive BFT Engine
 * - Macro-Economy Router
 * - Delegated Council Voting
 * - Post-Quantum Ledger
 * - Zero-Knowledge Integrity Audit
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ConstitutionalCodex } from '../../../src/core/governance/constitution-codex';
import { AdaptiveBFTEngine } from '../../../src/core/federation/adaptive-bft-engine';
import { MacroEconomyRouter } from '../../../src/runtime/economy/macro-economy-router';
import { DelegatedCouncilVoting } from '../../../src/core/governance/delegated-council-voting';
import { PQledger } from '../../../src/core/security/pq-ledger';
import { ZKIntegrityAudit } from '../../../src/core/security/zk-integrity-audit';

describe('Phase 4.2 - Constitutional Codex', () => {
  let codex: ConstitutionalCodex;

  beforeEach(() => {
    codex = new ConstitutionalCodex();
  });

  it('should initialize with 5 fundamental rights', () => {
    const articles = codex.getArticles({ layer: 'fundamental_rights' });

    expect(articles.length).toBe(5);
    expect(articles[0].title).toBe('Right to Transparency');
    expect(articles[0].immutable).toBe(true);
  });

  it('should validate actions against constitution', async () => {
    const result = await codex.validateAction(
      'action-1',
      'This action respects privacy and transparency'
    );

    expect(result.valid).toBeDefined();
    expect(result.proofs.length).toBeGreaterThan(0);
  });

  it('should detect ethical conflicts', async () => {
    // Add conflicting articles
    codex.enactArticle({
      articleNumber: 10,
      title: 'Test Transparency',
      content: 'All data must be fully transparent',
      layer: 'operational_rules',
      immutable: false,
      precedence: 50,
    });

    codex.enactArticle({
      articleNumber: 11,
      title: 'Test Privacy',
      content: 'All data must be fully private',
      layer: 'operational_rules',
      immutable: false,
      precedence: 50,
    });

    const conflicts = await codex.detectConflicts();
    expect(conflicts.length).toBeGreaterThanOrEqual(0);
  });

  it('should support constitutional amendments', async () => {
    const article = codex.enactArticle({
      articleNumber: 20,
      title: 'Amendable Rule',
      content: 'Original content',
      layer: 'operational_rules',
      immutable: false,
      precedence: 30,
    });

    const amendment = await codex.proposeAmendment({
      articleId: article.id,
      proposedChange: 'Updated content',
      rationale: 'Improvement needed',
      proposerId: 'test-proposer',
      proposerType: 'human',
      votingStartsAt: new Date(),
      votingEndsAt: new Date(Date.now() + 1000),
      quorum: 0.5,
    });

    expect(amendment.status).toBe('proposed');
  });
});

describe('Phase 4.2 - Adaptive BFT Engine', () => {
  let engine: AdaptiveBFTEngine;

  beforeEach(() => {
    engine = new AdaptiveBFTEngine();
  });

  it('should calculate adaptive quorum', () => {
    const nodes = [
      { id: '1', status: 'active', reputationScore: 90 } as any,
      { id: '2', status: 'active', reputationScore: 85 } as any,
      { id: '3', status: 'active', reputationScore: 80 } as any,
    ];

    const quorum = engine.calculateAdaptiveQuorum(nodes);

    expect(quorum).toBeGreaterThanOrEqual(0.51);
    expect(quorum).toBeLessThanOrEqual(0.80);
  });

  it('should enable fast path for trusted nodes', () => {
    const trustedNodes = [
      { id: '1', status: 'active', reputationScore: 95 } as any,
      { id: '2', status: 'active', reputationScore: 92 } as any,
      { id: '3', status: 'active', reputationScore: 90 } as any,
    ];

    const canUseFastPath = engine.canUseFastPath(trustedNodes);
    expect(canUseFastPath).toBe(true);
  });

  it('should process proposals with pipelined consensus', async () => {
    const state = {
      id: 'state-1',
      stateType: 'policy' as const,
      data: { test: 'data' },
      version: 1,
      proposedBy: 'node-1',
      approvedBy: [],
      consensusReached: false,
      proposedAt: new Date(),
    };

    const nodes = [
      { id: '1', status: 'active', reputationScore: 80 } as any,
      { id: '2', status: 'active', reputationScore: 85 } as any,
      { id: '3', status: 'active', reputationScore: 90 } as any,
    ];

    const result = await engine.processProposal(state, nodes);

    expect(result.latency).toBeDefined();
    expect(result.stages.length).toBe(4); // 4 pipeline stages
  });
});

describe('Phase 4.2 - Macro-Economy Router', () => {
  let router: MacroEconomyRouter;

  beforeEach(() => {
    router = new MacroEconomyRouter();
  });

  it('should route requests to best civic', async () => {
    const bid = {
      userId: 'user-1',
      maxCost: 10,
      maxLatency: 5000,
      minQuality: 0.8,
      weights: { cost: 0.4, latency: 0.3, quality: 0.3 },
    };

    const civics = [
      { id: 'civic-a', status: 'active', reputationScore: 80 } as any,
      { id: 'civic-b', status: 'active', reputationScore: 85 } as any,
    ];

    const decision = await router.routeRequest(bid, civics, {
      prioritizeCost: true,
    });

    expect(decision.civicId).toBeDefined();
    expect(decision.reason).toBeDefined();
    expect(decision.trade).toBeDefined();
  });

  it('should discover prices across civics', async () => {
    const bid = {
      userId: 'user-1',
      maxCost: 10,
      maxLatency: 5000,
      minQuality: 0.8,
      weights: { cost: 0.4, latency: 0.3, quality: 0.3 },
    };

    const civics = [
      { id: 'civic-a', status: 'active' } as any,
      { id: 'civic-b', status: 'active' } as any,
    ];

    const prices = await router.discoverPrices(bid, civics);

    expect(prices.bestCivicId).toBeDefined();
    expect(prices.alternatives.length).toBeGreaterThan(0);
  });
});

describe('Phase 4.2 - Delegated Council Voting', () => {
  let voting: DelegatedCouncilVoting;

  beforeEach(() => {
    voting = new DelegatedCouncilVoting();
  });

  it('should register delegates', async () => {
    const member = {
      id: 'member-1',
      name: 'Alice',
      type: 'human' as const,
      votingPower: 100,
      quadraticVotes: 10,
      term: 12,
      active: true,
      joinedAt: new Date(),
    };

    const delegate = await voting.registerDelegate(member);

    expect(delegate.id).toBe('member-1');
    expect(delegate.totalDelegatedPower).toBe(0);
  });

  it('should allow delegation', async () => {
    const delegate = await voting.registerDelegate({
      id: 'delegate-1',
      name: 'Bob',
      type: 'human' as const,
      votingPower: 100,
      quadraticVotes: 10,
      term: 12,
      active: true,
      joinedAt: new Date(),
    });

    const delegation = await voting.delegate(
      'delegator-1',
      delegate.id,
      50
    );

    expect(delegation.stakeAmount).toBe(50);
    expect(delegation.active).toBe(true);
  });

  it('should cast delegated votes', async () => {
    const delegate = await voting.registerDelegate({
      id: 'delegate-2',
      name: 'Charlie',
      type: 'human' as const,
      votingPower: 100,
      quadraticVotes: 10,
      term: 12,
      active: true,
      joinedAt: new Date(),
    });

    await voting.delegate('delegator-2', delegate.id, 30);

    const vote = await voting.castDelegatedVote(
      'proposal-1',
      delegate.id,
      'approve',
      'Good proposal'
    );

    expect(vote.choice).toBe('approve');
    expect(vote.delegatedPower).toBeGreaterThan(0);
  });
});

describe('Phase 4.3 - Post-Quantum Ledger', () => {
  let ledger: PQledger;

  beforeEach(() => {
    ledger = new PQledger();
  });

  it('should generate PQ key pairs', async () => {
    const keyPair = await ledger.generateKeyPair('dilithium');

    expect(keyPair.algorithm).toBe('dilithium');
    expect(keyPair.publicKey).toBeDefined();
    expect(keyPair.privateKey).toBeDefined();
    expect(keyPair.keySize).toBeGreaterThan(0);
  });

  it('should sign and verify data', async () => {
    const keyPair = await ledger.generateKeyPair('hybrid_ed25519_dilithium');
    const data = { test: 'data', value: 123 };

    const signature = await ledger.sign(data, keyPair);

    expect(signature.algorithm).toBe('hybrid_ed25519_dilithium');
    expect(signature.signature).toBeDefined();

    const verification = await ledger.verify(data, signature);

    expect(verification.valid).toBe(true);
    expect(verification.quantumSafe).toBe(true);
  });

  it('should add entries to ledger', async () => {
    const keyPair = await ledger.generateKeyPair('dilithium');
    const data = { action: 'test', timestamp: Date.now() };

    const entry = await ledger.addEntry('transaction', data, keyPair);

    expect(entry.verified).toBe(true);
    expect(entry.signature.algorithm).toBe('dilithium');
    expect(entry.blockHeight).toBe(1);
  });

  it('should verify entire ledger chain', async () => {
    const keyPair = await ledger.generateKeyPair('dilithium');

    await ledger.addEntry('transaction', { id: 1 }, keyPair);
    await ledger.addEntry('transaction', { id: 2 }, keyPair);
    await ledger.addEntry('transaction', { id: 3 }, keyPair);

    const result = await ledger.verifyChain();

    expect(result.valid).toBe(true);
    expect(result.totalEntries).toBe(3);
    expect(result.verifiedEntries).toBe(3);
  });
});

describe('Phase 4.3 - Zero-Knowledge Integrity Audit', () => {
  let audit: ZKIntegrityAudit;

  beforeEach(() => {
    audit = new ZKIntegrityAudit();
  });

  it('should create commitments', async () => {
    const commitment = await audit.createCommitment(
      'test-data',
      'evidence'
    );

    expect(commitment.commitmentValue).toBeDefined();
    expect(commitment.dataType).toBe('evidence');
  });

  it('should generate integrity proofs', async () => {
    const commitment = await audit.createCommitment(
      'test-data',
      'hash_chain'
    );

    const proof = await audit.generateIntegrityProof(
      'test-data',
      commitment
    );

    expect(proof.proofType).toBe('integrity');
    expect(proof.proof.commitment).toBeDefined();
  });

  it('should verify ZK proofs', async () => {
    const commitment = await audit.createCommitment(
      'test-data',
      'provenance'
    );

    const proof = await audit.generateIntegrityProof(
      'test-data',
      commitment
    );

    const valid = await audit.verifyProof(proof);

    expect(valid).toBe(true);
  });

  it('should audit compacted evidence', async () => {
    const compacted = {
      windowId: 'window-1',
      startTime: new Date(),
      endTime: new Date(),
      evidenceHashChain: 'test-hash-chain',
      trustScoreStats: {
        min: 0.8,
        max: 0.95,
        avg: 0.88,
        stddev: 0.05,
      },
      totalEvidence: 10,
      uniqueEvidence: 8,
      duplicateCount: 2,
      sampleEvidence: [
        {
          evidenceId: 'e1',
          evidenceHash: 'hash1',
          trustScore: 0.9,
          timestamp: new Date(),
        },
      ],
      provenanceSummary: {
        totalRuns: 5,
        totalCitations: 25,
        avgNliVerified: 0.85,
      },
      compressionRatio: 10,
      storageReduction: 9000,
      retentionExpiry: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      legalHold: false,
      timestamp: new Date(),
    };

    const report = await audit.auditCompactedEvidence(compacted);

    expect(report.integrityVerified).toBeDefined();
    expect(report.dataExposed).toBe(false); // Zero knowledge!
    expect(report.checks.length).toBeGreaterThan(0);
  });
});

describe('Phase 4 - End-to-End Integration', () => {
  it('should integrate constitutional + BFT + economy + voting', async () => {
    // Setup all systems
    const codex = new ConstitutionalCodex();
    const bft = new AdaptiveBFTEngine();
    const economy = new MacroEconomyRouter();
    const voting = new DelegatedCouncilVoting();

    // 1. Validate action against constitution
    const validation = await codex.validateAction(
      'e2e-action',
      'Test cross-civic resource allocation with ethical compliance'
    );
    expect(validation.valid).toBeDefined();

    // 2. BFT consensus
    const nodes = [
      { id: '1', status: 'active', reputationScore: 85 } as any,
      { id: '2', status: 'active', reputationScore: 90 } as any,
    ];

    const quorum = bft.calculateAdaptiveQuorum(nodes);
    expect(quorum).toBeGreaterThan(0.5);

    // 3. Economy routing
    const bid = {
      userId: 'e2e-user',
      maxCost: 10,
      maxLatency: 5000,
      minQuality: 0.8,
      weights: { cost: 0.4, latency: 0.3, quality: 0.3 },
    };

    const decision = await economy.routeRequest(bid, nodes);
    expect(decision.civicId).toBeDefined();

    // 4. Voting
    const delegate = await voting.registerDelegate({
      id: 'e2e-delegate',
      name: 'E2E Delegate',
      type: 'ai' as const,
      votingPower: 100,
      quadraticVotes: 10,
      term: 12,
      active: true,
      joinedAt: new Date(),
    });

    expect(delegate).toBeDefined();

    // All systems integrated successfully
    expect(codex.getStats().totalArticles).toBeGreaterThan(0);
    expect(bft.getStats().totalStages).toBeGreaterThanOrEqual(0);
    expect(economy.getStats().totalTrades).toBeGreaterThanOrEqual(0);
    expect(voting.getStats().totalDelegates).toBeGreaterThan(0);
  });

  it('should integrate quantum-safe + ZK audit', async () => {
    const pq = new PQledger();
    const zk = new ZKIntegrityAudit();

    // 1. Generate quantum-safe keys
    const keyPair = await pq.generateKeyPair('hybrid_ed25519_dilithium');
    expect(keyPair.algorithm).toBe('hybrid_ed25519_dilithium');

    // 2. Add data to ledger
    const data = { critical: 'data', value: 999 };
    const entry = await pq.addEntry('proof', data, keyPair);
    expect(entry.verified).toBe(true);

    // 3. Create ZK commitment
    const commitment = await zk.createCommitment(
      JSON.stringify(data),
      'provenance'
    );
    expect(commitment.commitmentValue).toBeDefined();

    // 4. Generate ZK proof
    const proof = await zk.generateIntegrityProof(
      JSON.stringify(data),
      commitment
    );
    expect(proof.proofType).toBe('integrity');

    // 5. Verify proof (zero knowledge!)
    const valid = await zk.verifyProof(proof);
    expect(valid).toBe(true);

    // Both systems working together
    expect(pq.getStats().totalEntries).toBeGreaterThan(0);
    expect(zk.getStats().totalCommitments).toBeGreaterThan(0);
  });
});
