/**
 * Council Oversight Protocol - Phase 4.1 Layer 3
 *
 * "AI + Human 협의회 → 민주적 AI 거버넌스"
 * - Cosmic Insight for Democratic AI Governance
 *
 * Purpose:
 * - Human-AI 협의회 구성 (Council Composition)
 * - 투표 메커니즘 (Voting Mechanism)
 * - 심의 인터페이스 (Deliberation Interface)
 * - 정책 추적 및 공개 장부 (Policy Trace & Public Ledger)
 *
 * Architecture:
 * Proposal → Deliberation → Voting → Execution → Public Ledger
 *
 * Governance Mechanisms:
 * 1. Council seats (human + AI members)
 * 2. Proposal submission
 * 3. Deliberation period
 * 4. Voting (quadratic voting)
 * 5. Execution & public record
 *
 * Expected Impact:
 * - Human participation: 100% (transparent governance)
 * - Proposal approval rate: 70-80% (balanced)
 * - Decision latency: <7 days (efficient)
 * - Public trust: 95%+ (accountable)
 *
 * @see RFC 2025-22: Phase 4.1 Federated AI Civilization
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Council Member
 */
export interface CouncilMember {
  id: string;
  name: string;
  type: 'human' | 'ai';

  // Voting power
  votingPower: number; // 0-100 (based on stake, reputation, etc.)
  quadraticVotes: number; // sqrt(votingPower) for quadratic voting

  // Membership
  joinedAt: Date;
  term: number; // Months
  active: boolean;

  // Metadata
  expertise?: string[]; // e.g., ["ethics", "economics", "security"]
  affiliation?: string; // e.g., "University", "Company", "AI System"
}

/**
 * Proposal
 */
export interface Proposal {
  id: string;
  title: string;
  description: string;

  // Proposer
  proposerId: string;
  proposerType: 'human' | 'ai';

  // Type
  type:
    | 'policy_change'
    | 'parameter_adjustment'
    | 'budget_allocation'
    | 'emergency_action'
    | 'other';

  // Voting
  votingStartsAt: Date;
  votingEndsAt: Date;
  deliberationPeriod: number; // Days before voting

  // Status
  status:
    | 'draft'
    | 'deliberation'
    | 'voting'
    | 'approved'
    | 'rejected'
    | 'executed';

  // Votes
  votes: Vote[];
  quorum: number; // Minimum participation required (0-1)

  // Execution
  executedAt?: Date;
  executionResult?: {
    success: boolean;
    message: string;
  };

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Vote
 */
export interface Vote {
  id: string;
  proposalId: string;
  voterId: string;

  // Vote choice
  choice: 'approve' | 'reject' | 'abstain';

  // Voting power used
  votingPowerUsed: number; // Quadratic voting

  // Reasoning (optional)
  reasoning?: string;

  // Metadata
  timestamp: Date;
  signature?: string; // Cryptographic signature for verification
}

/**
 * Deliberation Comment
 */
export interface DeliberationComment {
  id: string;
  proposalId: string;
  authorId: string;
  authorType: 'human' | 'ai';

  // Content
  content: string;
  replyToId?: string; // Reply to another comment

  // Metadata
  timestamp: Date;
}

/**
 * Public Ledger Entry
 */
export interface PublicLedgerEntry {
  id: string;
  timestamp: Date;

  // Event type
  eventType:
    | 'proposal_created'
    | 'voting_started'
    | 'vote_cast'
    | 'proposal_approved'
    | 'proposal_rejected'
    | 'proposal_executed';

  // Event data
  proposalId: string;
  proposalTitle: string;
  actorId?: string; // Who triggered the event
  actorType?: 'human' | 'ai';

  // Metadata
  metadata?: Record<string, unknown>;

  // Immutability proof
  hash: string; // SHA-256 hash of entry
  previousHash?: string; // Blockchain-style chaining
}

/**
 * Voting Result
 */
export interface VotingResult {
  proposalId: string;

  // Participation
  totalMembers: number;
  votedMembers: number;
  participationRate: number; // 0-1

  // Votes
  approveVotes: number;
  rejectVotes: number;
  abstainVotes: number;

  // Weighted votes (quadratic)
  approveVotesWeighted: number;
  rejectVotesWeighted: number;

  // Result
  approved: boolean;
  quorumMet: boolean;
  consensusReached: boolean; // Alias for approved (quorum met + majority)
  approvalRate: number; // 0-1

  timestamp: Date;
}

/**
 * Council Oversight Protocol
 *
 * Human-AI 민주적 거버넌스 시스템
 */
export class CouncilOversightProtocol {
  private members: Map<string, CouncilMember> = new Map();
  private proposals: Map<string, Proposal> = new Map();
  private votes: Map<string, Vote> = new Map();
  private comments: Map<string, DeliberationComment> = new Map();
  private ledger: PublicLedgerEntry[] = [];

  // Ledger storage
  private ledgerPath: string;

  constructor(config?: { ledgerPath?: string }) {
    this.ledgerPath =
      config?.ledgerPath ?? 'reports/governance/council-ledger.jsonl';

    this.ensureLedgerDirectory();
    this.loadLedger();
  }

  /**
   * Add council member
   */
  async addMember(
    member: Omit<CouncilMember, 'id' | 'quadraticVotes' | 'joinedAt'>
  ): Promise<CouncilMember> {
    const newMember: CouncilMember = {
      id: this.generateMemberId(),
      ...member,
      quadraticVotes: Math.sqrt(member.votingPower),
      joinedAt: new Date(),
    };

    this.members.set(newMember.id, newMember);

    return newMember;
  }

  /**
   * Create proposal
   */
  async createProposal(
    proposal: Omit<
      Proposal,
      | 'id'
      | 'status'
      | 'votes'
      | 'createdAt'
      | 'updatedAt'
      | 'votingStartsAt'
      | 'votingEndsAt'
    >
  ): Promise<Proposal> {
    const now = new Date();

    const newProposal: Proposal = {
      id: this.generateProposalId(),
      ...proposal,
      status: 'deliberation',
      votes: [],
      votingStartsAt: new Date(
        now.getTime() + proposal.deliberationPeriod * 24 * 60 * 60 * 1000
      ),
      votingEndsAt: new Date(
        now.getTime() +
          (proposal.deliberationPeriod + 7) * 24 * 60 * 60 * 1000
      ), // 7-day voting period
      createdAt: now,
      updatedAt: now,
    };

    this.proposals.set(newProposal.id, newProposal);

    // Record in ledger
    await this.recordLedgerEntry({
      eventType: 'proposal_created',
      proposalId: newProposal.id,
      proposalTitle: newProposal.title,
      actorId: newProposal.proposerId,
      actorType: newProposal.proposerType,
    });

    return newProposal;
  }

  /**
   * Add deliberation comment
   */
  async addComment(
    comment: Omit<DeliberationComment, 'id' | 'timestamp'>
  ): Promise<DeliberationComment> {
    const newComment: DeliberationComment = {
      id: this.generateCommentId(),
      ...comment,
      timestamp: new Date(),
    };

    this.comments.set(newComment.id, newComment);

    return newComment;
  }

  /**
   * Cast vote
   */
  async castVote(
    proposalId: string,
    voterId: string,
    choice: Vote['choice'],
    reasoning?: string
  ): Promise<Vote> {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`);
    }

    // Check if voting is open
    const now = new Date();
    if (now < proposal.votingStartsAt) {
      throw new Error('Voting has not started yet');
    }
    if (now > proposal.votingEndsAt) {
      throw new Error('Voting has ended');
    }

    // Check if already voted
    const existingVote = proposal.votes.find(
      (v) => v.voterId === voterId
    );
    if (existingVote) {
      throw new Error('Already voted on this proposal');
    }

    // Get member voting power
    const member = this.members.get(voterId);
    if (!member?.active) {
      throw new Error('Invalid or inactive member');
    }

    // Create vote
    const vote: Vote = {
      id: this.generateVoteId(),
      proposalId,
      voterId,
      choice,
      votingPowerUsed: member.quadraticVotes,
      reasoning,
      timestamp: now,
      signature: this.signVote(proposalId, voterId, choice),
    };

    // Add to proposal
    proposal.votes.push(vote);
    this.votes.set(vote.id, vote);

    // Update proposal
    proposal.updatedAt = now;

    // Record in ledger
    await this.recordLedgerEntry({
      eventType: 'vote_cast',
      proposalId,
      proposalTitle: proposal.title,
      actorId: voterId,
      actorType: member.type,
      metadata: { choice },
    });

    return vote;
  }

  /**
   * Start voting period
   */
  async startVoting(proposalId: string): Promise<void> {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`);
    }

    if (proposal.status !== 'deliberation') {
      throw new Error(
        `Cannot start voting: proposal is ${proposal.status}`
      );
    }

    proposal.status = 'voting';
    proposal.updatedAt = new Date();

    // Record in ledger
    await this.recordLedgerEntry({
      eventType: 'voting_started',
      proposalId,
      proposalTitle: proposal.title,
    });
  }

  /**
   * Close voting and determine result
   */
  async closeVoting(proposalId: string): Promise<VotingResult> {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`);
    }

    if (proposal.status !== 'voting') {
      throw new Error(
        `Cannot close voting: proposal is ${proposal.status}`
      );
    }

    // Calculate result
    const result = this.calculateVotingResult(proposal);

    // Update proposal status
    proposal.status = result.approved ? 'approved' : 'rejected';
    proposal.updatedAt = new Date();

    // Record in ledger
    await this.recordLedgerEntry({
      eventType: result.approved
        ? 'proposal_approved'
        : 'proposal_rejected',
      proposalId,
      proposalTitle: proposal.title,
      metadata: { result },
    });

    return result;
  }

  /**
   * Execute approved proposal
   */
  async executeProposal(
    proposalId: string,
    executor: (proposal: Proposal) => Promise<{ success: boolean; message: string }>
  ): Promise<void> {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`);
    }

    if (proposal.status !== 'approved') {
      throw new Error(`Proposal is not approved: ${proposal.status}`);
    }

    // Execute
    const result = await executor(proposal);

    proposal.status = 'executed';
    proposal.executedAt = new Date();
    proposal.executionResult = result;
    proposal.updatedAt = new Date();

    // Record in ledger
    await this.recordLedgerEntry({
      eventType: 'proposal_executed',
      proposalId,
      proposalTitle: proposal.title,
      metadata: { result },
    });
  }

  /**
   * Get public ledger
   */
  getPublicLedger(
    filter?: {
      eventType?: PublicLedgerEntry['eventType'];
      proposalId?: string;
      startTime?: Date;
      endTime?: Date;
    }
  ): PublicLedgerEntry[] {
    let ledger = [...this.ledger];

    if (filter) {
      if (filter.eventType) {
        ledger = ledger.filter(
          (e) => e.eventType === filter.eventType
        );
      }
      if (filter.proposalId) {
        ledger = ledger.filter(
          (e) => e.proposalId === filter.proposalId
        );
      }
      if (filter.startTime) {
        ledger = ledger.filter(
          (e) => e.timestamp >= filter.startTime!
        );
      }
      if (filter.endTime) {
        ledger = ledger.filter(
          (e) => e.timestamp <= filter.endTime!
        );
      }
    }

    return ledger;
  }

  // ========== Helper Methods ==========

  /**
   * Calculate voting result
   */
  private calculateVotingResult(proposal: Proposal): VotingResult {
    const totalMembers = Array.from(this.members.values()).filter(
      (m) => m.active
    ).length;
    const votedMembers = proposal.votes.length;
    const participationRate = votedMembers / totalMembers;

    // Count votes
    const approveVotes = proposal.votes.filter(
      (v) => v.choice === 'approve'
    ).length;
    const rejectVotes = proposal.votes.filter(
      (v) => v.choice === 'reject'
    ).length;
    const abstainVotes = proposal.votes.filter(
      (v) => v.choice === 'abstain'
    ).length;

    // Weighted votes (quadratic)
    const approveVotesWeighted = proposal.votes
      .filter((v) => v.choice === 'approve')
      .reduce((sum, v) => sum + v.votingPowerUsed, 0);

    const rejectVotesWeighted = proposal.votes
      .filter((v) => v.choice === 'reject')
      .reduce((sum, v) => sum + v.votingPowerUsed, 0);

    // Quorum check
    const quorumMet = participationRate >= proposal.quorum;

    // Approval check (simple majority of weighted votes)
    const totalWeightedVotes =
      approveVotesWeighted + rejectVotesWeighted;
    const approvalRate =
      totalWeightedVotes > 0
        ? approveVotesWeighted / totalWeightedVotes
        : 0;

    const approved = quorumMet && approvalRate > 0.5;

    return {
      proposalId: proposal.id,
      totalMembers,
      votedMembers,
      participationRate,
      approveVotes,
      rejectVotes,
      abstainVotes,
      approveVotesWeighted,
      rejectVotesWeighted,
      approved,
      quorumMet,
      consensusReached: approved, // Same as approved (quorum met + majority)
      approvalRate,
      timestamp: new Date(),
    };
  }

  /**
   * Sign vote (cryptographic signature)
   */
  private signVote(
    proposalId: string,
    voterId: string,
    choice: Vote['choice']
  ): string {
    const data = `${proposalId}:${voterId}:${choice}:${Date.now()}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Record ledger entry
   */
  private async recordLedgerEntry(
    entry: Omit<PublicLedgerEntry, 'id' | 'timestamp' | 'hash' | 'previousHash'>
  ): Promise<void> {
    const previousHash =
      this.ledger.length > 0
        ? this.ledger[this.ledger.length - 1].hash
        : undefined;

    const ledgerEntry: PublicLedgerEntry = {
      id: this.generateLedgerId(),
      timestamp: new Date(),
      ...entry,
      previousHash,
      hash: '', // Computed below
    };

    // Compute hash (blockchain-style)
    const hashData = JSON.stringify({
      ...ledgerEntry,
      hash: undefined,
    });
    ledgerEntry.hash = crypto
      .createHash('sha256')
      .update(hashData)
      .digest('hex');

    this.ledger.push(ledgerEntry);

    // Append to file (JSONL)
    this.appendToLedgerFile(ledgerEntry);
  }

  /**
   * Append to ledger file
   */
  private appendToLedgerFile(entry: PublicLedgerEntry): void {
    fs.appendFileSync(
      this.ledgerPath,
      JSON.stringify(entry) + '\n'
    );
  }

  /**
   * Load ledger from file
   */
  private loadLedger(): void {
    if (!fs.existsSync(this.ledgerPath)) return;

    const lines = fs
      .readFileSync(this.ledgerPath, 'utf-8')
      .split('\n')
      .filter((line) => line.trim() !== '');

    this.ledger = lines.map((line) => JSON.parse(line));
  }

  /**
   * Ensure ledger directory exists
   */
  private ensureLedgerDirectory(): void {
    const dir = path.dirname(this.ledgerPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Generate IDs
   */
  private generateMemberId(): string {
    return `member_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  private generateProposalId(): string {
    return `proposal_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  private generateVoteId(): string {
    return `vote_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  private generateCommentId(): string {
    return `comment_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  private generateLedgerId(): string {
    return `ledger_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalMembers: number;
    activeMembers: number;
    totalProposals: number;
    approvedProposals: number;
    rejectedProposals: number;
    executedProposals: number;
    totalVotes: number;
    avgParticipationRate: number;
  } {
    const activeMembers = Array.from(this.members.values()).filter(
      (m) => m.active
    );

    const proposals = Array.from(this.proposals.values());
    const approvedProposals = proposals.filter(
      (p) => p.status === 'approved' || p.status === 'executed'
    );
    const rejectedProposals = proposals.filter(
      (p) => p.status === 'rejected'
    );
    const executedProposals = proposals.filter(
      (p) => p.status === 'executed'
    );

    // Calculate average participation
    const votingProposals = proposals.filter(
      (p) =>
        p.status === 'voting' ||
        p.status === 'approved' ||
        p.status === 'rejected' ||
        p.status === 'executed'
    );
    const avgParticipationRate =
      votingProposals.length > 0
        ? votingProposals.reduce((sum, p) => {
            const rate = p.votes.length / activeMembers.length;
            return sum + rate;
          }, 0) / votingProposals.length
        : 0;

    return {
      totalMembers: this.members.size,
      activeMembers: activeMembers.length,
      totalProposals: proposals.length,
      approvedProposals: approvedProposals.length,
      rejectedProposals: rejectedProposals.length,
      executedProposals: executedProposals.length,
      totalVotes: this.votes.size,
      avgParticipationRate,
    };
  }

  /**
   * Get all members
   */
  getMembers(): CouncilMember[] {
    return Array.from(this.members.values());
  }

  /**
   * Get all proposals
   */
  getProposals(
    filter?: { status?: Proposal['status'] }
  ): Proposal[] {
    let proposals = Array.from(this.proposals.values());

    if (filter?.status) {
      proposals = proposals.filter(
        (p) => p.status === filter.status
      );
    }

    return proposals;
  }

  /**
   * Get proposal by ID
   */
  getProposal(proposalId: string): Proposal | undefined {
    return this.proposals.get(proposalId);
  }

  /**
   * Get comments for proposal
   */
  getComments(proposalId: string): DeliberationComment[] {
    return Array.from(this.comments.values()).filter(
      (c) => c.proposalId === proposalId
    );
  }
}

/**
 * Default singleton instance
 */
export const councilOversightProtocol = new CouncilOversightProtocol();
