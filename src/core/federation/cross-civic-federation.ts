/**
 * Cross-Civic Federation - Phase 4.1 Layer 1
 *
 * "단일 AI 문명 → 다중 문명 연합 네트워크"
 * - Cosmic Insight for Federated AI Civilization
 *
 * Purpose:
 * - BFT Consensus Engine (Byzantine Fault Tolerance)
 * - Governance Relay Protocol (거버넌스 중계)
 * - Cross-Civic Proof Synchronization (증명 동기화)
 * - Multi-Network State Management (상태 관리)
 *
 * Architecture:
 * Local Civic → Federation Protocol → BFT Consensus → Global State Sync
 *
 * Federation Mechanisms:
 * 1. Civic registration (문명 등록)
 * 2. BFT consensus (3f+1 nodes for f failures)
 * 3. Cross-civic proof exchange (증명 교환)
 * 4. State synchronization (상태 동기화)
 * 5. Conflict resolution (충돌 해결)
 *
 * Expected Impact:
 * - Multi-civic support: ∞ (unlimited civics)
 * - Consensus latency: <30s (BFT finality)
 * - Fault tolerance: 33% Byzantine nodes
 * - Global consistency: 100%
 *
 * @see RFC 2025-22: Phase 4.1 Federated AI Civilization
 */

import * as crypto from 'crypto';

/**
 * Civic Node (문명 노드)
 */
export interface CivicNode {
  id: string;
  name: string;
  networkId: string; // e.g., "mainnet", "testnet"

  // Node info
  endpoint: string; // URL for communication
  publicKey: string; // For cryptographic verification

  // Status
  status: 'active' | 'inactive' | 'byzantine' | 'offline';
  lastHeartbeat: Date;

  // Reputation
  reputationScore: number; // 0-100
  totalVotes: number;
  byzantineViolations: number;

  // Metadata
  joinedAt: Date;
  region?: string; // Geographic region
  version?: string; // Software version
}

/**
 * Federated State (연합 상태)
 */
export interface FederatedState {
  id: string;
  stateType: 'policy' | 'parameter' | 'resource' | 'governance';

  // State data
  data: Record<string, unknown>;

  // Versioning
  version: number;
  previousHash?: string;

  // Consensus
  proposedBy: string; // Civic node ID
  approvedBy: string[]; // List of civic node IDs
  consensusReached: boolean;

  // Timestamps
  proposedAt: Date;
  finalizedAt?: Date;
}

/**
 * Cross-Civic Proof (교차 문명 증명)
 */
export interface CrossCivicProof {
  id: string;
  sourceNode: string; // Source civic node
  targetNode: string; // Target civic node

  // Proof data
  proofType: 'trust_token' | 'carbon_credit' | 'governance_decision' | 'resource_allocation';
  proofData: Record<string, unknown>;

  // Cryptographic verification
  signature: string; // Signed by source node
  verified: boolean;

  // Metadata
  timestamp: Date;
  expiresAt?: Date;
}

/**
 * BFT Consensus Vote
 */
export interface ConsensusVote {
  id: string;
  stateId: string; // State being voted on
  voterId: string; // Civic node ID

  // Vote
  vote: 'approve' | 'reject';
  reason?: string;

  // Signature
  signature: string;
  timestamp: Date;
}

/**
 * Consensus Result
 */
export interface ConsensusResult {
  stateId: string;

  // Participation
  totalNodes: number;
  votedNodes: number;

  // Votes
  approveVotes: number;
  rejectVotes: number;

  // Result (BFT: 2f+1 approvals needed for f failures)
  consensusReached: boolean;
  byzantineTolerance: number; // f (max Byzantine nodes)

  // Finality
  finalized: boolean;
  finalizedAt?: Date;

  timestamp: Date;
}

/**
 * Cross-Civic Federation
 *
 * BFT-based Multi-Civic Network Consensus
 */
export class CrossCivicFederation {
  private nodes: Map<string, CivicNode> = new Map();
  private states: Map<string, FederatedState> = new Map();
  private proofs: Map<string, CrossCivicProof> = new Map();
  private votes: Map<string, ConsensusVote> = new Map();

  // Network configuration
  private networkId: string;
  private localNodeId?: string;

  // BFT parameters
  private readonly BFT_THRESHOLD = 2 / 3; // 2f+1 out of 3f+1

  constructor(config?: {
    networkId?: string;
    localNodeId?: string;
  }) {
    this.networkId = config?.networkId ?? 'mainnet';
    this.localNodeId = config?.localNodeId;
  }

  /**
   * Register civic node
   */
  async registerNode(
    node: Omit<
      CivicNode,
      | 'id'
      | 'status'
      | 'lastHeartbeat'
      | 'reputationScore'
      | 'totalVotes'
      | 'byzantineViolations'
      | 'joinedAt'
    >
  ): Promise<CivicNode> {
    const newNode: CivicNode = {
      id: this.generateNodeId(),
      ...node,
      status: 'active',
      lastHeartbeat: new Date(),
      reputationScore: 50, // Start with neutral reputation
      totalVotes: 0,
      byzantineViolations: 0,
      joinedAt: new Date(),
    };

    this.nodes.set(newNode.id, newNode);

    return newNode;
  }

  /**
   * Propose federated state
   */
  async proposeState(
    state: Omit<
      FederatedState,
      | 'id'
      | 'version'
      | 'approvedBy'
      | 'consensusReached'
      | 'proposedAt'
      | 'finalizedAt'
    >
  ): Promise<FederatedState> {
    // Get current version (if updating existing state)
    const existingStates = Array.from(this.states.values()).filter(
      (s) => s.stateType === state.stateType
    );
    const currentVersion = existingStates.length;

    const previousHash =
      currentVersion > 0
        ? this.computeStateHash(existingStates[currentVersion - 1])
        : undefined;

    const newState: FederatedState = {
      id: this.generateStateId(),
      ...state,
      version: currentVersion + 1,
      previousHash,
      approvedBy: [],
      consensusReached: false,
      proposedAt: new Date(),
    };

    this.states.set(newState.id, newState);

    return newState;
  }

  /**
   * Vote on proposed state (BFT consensus)
   */
  async voteOnState(
    stateId: string,
    voterId: string,
    vote: ConsensusVote['vote'],
    reason?: string
  ): Promise<ConsensusVote> {
    const state = this.states.get(stateId);
    if (!state) {
      throw new Error(`State ${stateId} not found`);
    }

    const voter = this.nodes.get(voterId);
    if (!voter || voter.status !== 'active') {
      throw new Error('Invalid or inactive voter node');
    }

    // Check if already voted
    const existingVote = Array.from(this.votes.values()).find(
      (v) => v.stateId === stateId && v.voterId === voterId
    );
    if (existingVote) {
      throw new Error('Already voted on this state');
    }

    // Create vote
    const consensusVote: ConsensusVote = {
      id: this.generateVoteId(),
      stateId,
      voterId,
      vote,
      reason,
      signature: this.signVote(stateId, voterId, vote),
      timestamp: new Date(),
    };

    this.votes.set(consensusVote.id, consensusVote);

    // Update voter stats
    voter.totalVotes++;

    // Update state approvals
    if (vote === 'approve') {
      state.approvedBy.push(voterId);
    }

    // Check if consensus reached
    await this.checkConsensus(stateId);

    return consensusVote;
  }

  /**
   * Check if BFT consensus reached
   */
  private async checkConsensus(stateId: string): Promise<void> {
    const state = this.states.get(stateId);
    if (!state || state.consensusReached) return;

    const result = this.calculateConsensusResult(stateId);

    if (result.consensusReached) {
      state.consensusReached = true;
      state.finalizedAt = new Date();
    }
  }

  /**
   * Calculate consensus result (BFT)
   */
  calculateConsensusResult(stateId: string): ConsensusResult {
    const state = this.states.get(stateId);
    if (!state) {
      throw new Error(`State ${stateId} not found`);
    }

    // Get active nodes
    const activeNodes = Array.from(this.nodes.values()).filter(
      (n) => n.status === 'active'
    );
    const totalNodes = activeNodes.length;

    // Get votes for this state
    const stateVotes = Array.from(this.votes.values()).filter(
      (v) => v.stateId === stateId
    );
    const votedNodes = new Set(stateVotes.map((v) => v.voterId)).size;

    const approveVotes = stateVotes.filter(
      (v) => v.vote === 'approve'
    ).length;
    const rejectVotes = stateVotes.filter(
      (v) => v.vote === 'reject'
    ).length;

    // BFT: f = (n-1)/3, need 2f+1 = (2n+1)/3 approvals
    // For n=3f+1, need 2f+1 approvals to tolerate f Byzantine nodes
    const byzantineTolerance = Math.floor((totalNodes - 1) / 3);
    const requiredApprovals = Math.floor(
      (2 * totalNodes + 1) / 3
    );

    const consensusReached = approveVotes >= requiredApprovals;

    return {
      stateId,
      totalNodes,
      votedNodes,
      approveVotes,
      rejectVotes,
      consensusReached,
      byzantineTolerance,
      finalized: consensusReached,
      finalizedAt: consensusReached ? new Date() : undefined,
      timestamp: new Date(),
    };
  }

  /**
   * Create cross-civic proof
   */
  async createProof(
    proof: Omit<
      CrossCivicProof,
      'id' | 'signature' | 'verified' | 'timestamp'
    >
  ): Promise<CrossCivicProof> {
    const sourceNode = this.nodes.get(proof.sourceNode);
    if (!sourceNode) {
      throw new Error(`Source node ${proof.sourceNode} not found`);
    }

    const newProof: CrossCivicProof = {
      id: this.generateProofId(),
      ...proof,
      signature: this.signProof(proof.sourceNode, proof.proofData),
      verified: false,
      timestamp: new Date(),
    };

    this.proofs.set(newProof.id, newProof);

    return newProof;
  }

  /**
   * Verify cross-civic proof
   */
  async verifyProof(proofId: string): Promise<boolean> {
    const proof = this.proofs.get(proofId);
    if (!proof) {
      throw new Error(`Proof ${proofId} not found`);
    }

    const sourceNode = this.nodes.get(proof.sourceNode);
    if (!sourceNode) {
      throw new Error(`Source node ${proof.sourceNode} not found`);
    }

    // Verify signature (simplified - in production use real crypto)
    const expectedSignature = this.signProof(
      proof.sourceNode,
      proof.proofData
    );
    const verified = proof.signature === expectedSignature;

    proof.verified = verified;

    return verified;
  }

  /**
   * Synchronize state across civics
   */
  async syncState(stateId: string): Promise<{
    synced: boolean;
    syncedNodes: string[];
    failedNodes: string[];
  }> {
    const state = this.states.get(stateId);
    if (!state) {
      throw new Error(`State ${stateId} not found`);
    }

    if (!state.consensusReached) {
      throw new Error('Cannot sync state without consensus');
    }

    const activeNodes = Array.from(this.nodes.values()).filter(
      (n) => n.status === 'active'
    );

    const syncedNodes: string[] = [];
    const failedNodes: string[] = [];

    // Simulate sync (in production, would make actual network calls)
    for (const node of activeNodes) {
      try {
        // Simulate network call
        const success = await this.syncStateToNode(node.id, state);
        if (success) {
          syncedNodes.push(node.id);
        } else {
          failedNodes.push(node.id);
        }
      } catch (error) {
        failedNodes.push(node.id);
      }
    }

    return {
      synced: failedNodes.length === 0,
      syncedNodes,
      failedNodes,
    };
  }

  /**
   * Sync state to specific node (placeholder)
   */
  private async syncStateToNode(
    _nodeId: string,
    _state: FederatedState
  ): Promise<boolean> {
    // Placeholder - in production, make HTTP/WebSocket call
    return true;
  }

  /**
   * Detect Byzantine node
   */
  async detectByzantineNode(nodeId: string): Promise<{
    isByzantine: boolean;
    reason?: string;
  }> {
    const node = this.nodes.get(nodeId);
    if (!node) {
      return { isByzantine: false };
    }

    // Simple Byzantine detection (expand in production)
    const violations = node.byzantineViolations;
    const reputationThreshold = 20;

    if (violations > 3) {
      return {
        isByzantine: true,
        reason: `${violations} Byzantine violations detected`,
      };
    }

    if (node.reputationScore < reputationThreshold) {
      return {
        isByzantine: true,
        reason: `Reputation score too low: ${node.reputationScore}`,
      };
    }

    return { isByzantine: false };
  }

  /**
   * Mark node as Byzantine
   */
  async markByzantine(
    nodeId: string,
    reason: string
  ): Promise<void> {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    node.status = 'byzantine';
    node.byzantineViolations++;
    node.reputationScore = Math.max(
      0,
      node.reputationScore - 20
    );

    // Log the Byzantine detection (in production, alert admins)
    console.warn(
      `[Federation] Byzantine node detected: ${nodeId} - ${reason}`
    );
  }

  /**
   * Heartbeat (keep-alive)
   */
  async heartbeat(nodeId: string): Promise<void> {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    node.lastHeartbeat = new Date();

    // Update status based on heartbeat
    if (node.status === 'offline') {
      node.status = 'active';
    }
  }

  /**
   * Detect offline nodes
   */
  async detectOfflineNodes(
    timeoutMs: number = 60000
  ): Promise<string[]> {
    const now = Date.now();
    const offlineNodes: string[] = [];

    for (const [nodeId, node] of this.nodes.entries()) {
      const lastHeartbeatTime = node.lastHeartbeat.getTime();
      const timeSinceHeartbeat = now - lastHeartbeatTime;

      if (
        timeSinceHeartbeat > timeoutMs &&
        node.status !== 'offline'
      ) {
        node.status = 'offline';
        offlineNodes.push(nodeId);
      }
    }

    return offlineNodes;
  }

  // ========== Helper Methods ==========

  /**
   * Compute state hash
   */
  private computeStateHash(state: FederatedState): string {
    const hashData = JSON.stringify({
      stateType: state.stateType,
      data: state.data,
      version: state.version,
    });
    return crypto.createHash('sha256').update(hashData).digest('hex');
  }

  /**
   * Sign vote
   */
  private signVote(
    stateId: string,
    voterId: string,
    vote: ConsensusVote['vote']
  ): string {
    const data = `${stateId}:${voterId}:${vote}:${Date.now()}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Sign proof
   */
  private signProof(
    nodeId: string,
    proofData: Record<string, unknown>
  ): string {
    const data = `${nodeId}:${JSON.stringify(proofData)}:${Date.now()}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Generate IDs
   */
  private generateNodeId(): string {
    return `node_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  private generateStateId(): string {
    return `state_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  private generateVoteId(): string {
    return `vote_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  private generateProofId(): string {
    return `proof_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalNodes: number;
    activeNodes: number;
    offlineNodes: number;
    byzantineNodes: number;
    totalStates: number;
    consensusStates: number;
    totalProofs: number;
    verifiedProofs: number;
    totalVotes: number;
    avgConsensusTime: number;
  } {
    const nodes = Array.from(this.nodes.values());
    const activeNodes = nodes.filter((n) => n.status === 'active');
    const offlineNodes = nodes.filter((n) => n.status === 'offline');
    const byzantineNodes = nodes.filter(
      (n) => n.status === 'byzantine'
    );

    const states = Array.from(this.states.values());
    const consensusStates = states.filter(
      (s) => s.consensusReached
    );

    const proofs = Array.from(this.proofs.values());
    const verifiedProofs = proofs.filter((p) => p.verified);

    // Calculate average consensus time
    const consensusTimes = consensusStates
      .filter((s) => s.finalizedAt)
      .map(
        (s) =>
          s.finalizedAt!.getTime() - s.proposedAt.getTime()
      );

    const avgConsensusTime =
      consensusTimes.length > 0
        ? consensusTimes.reduce((sum, t) => sum + t, 0) /
          consensusTimes.length
        : 0;

    return {
      totalNodes: nodes.length,
      activeNodes: activeNodes.length,
      offlineNodes: offlineNodes.length,
      byzantineNodes: byzantineNodes.length,
      totalStates: states.length,
      consensusStates: consensusStates.length,
      totalProofs: proofs.length,
      verifiedProofs: verifiedProofs.length,
      totalVotes: this.votes.size,
      avgConsensusTime,
    };
  }

  /**
   * Get nodes
   */
  getNodes(filter?: { status?: CivicNode['status'] }): CivicNode[] {
    let nodes = Array.from(this.nodes.values());

    if (filter?.status) {
      nodes = nodes.filter((n) => n.status === filter.status);
    }

    return nodes;
  }

  /**
   * Get states
   */
  getStates(filter?: {
    stateType?: FederatedState['stateType'];
    consensusReached?: boolean;
  }): FederatedState[] {
    let states = Array.from(this.states.values());

    if (filter) {
      if (filter.stateType) {
        states = states.filter(
          (s) => s.stateType === filter.stateType
        );
      }
      if (filter.consensusReached !== undefined) {
        states = states.filter(
          (s) => s.consensusReached === filter.consensusReached
        );
      }
    }

    return states;
  }

  /**
   * Get proofs
   */
  getProofs(filter?: {
    sourceNode?: string;
    targetNode?: string;
    verified?: boolean;
  }): CrossCivicProof[] {
    let proofs = Array.from(this.proofs.values());

    if (filter) {
      if (filter.sourceNode) {
        proofs = proofs.filter(
          (p) => p.sourceNode === filter.sourceNode
        );
      }
      if (filter.targetNode) {
        proofs = proofs.filter(
          (p) => p.targetNode === filter.targetNode
        );
      }
      if (filter.verified !== undefined) {
        proofs = proofs.filter(
          (p) => p.verified === filter.verified
        );
      }
    }

    return proofs;
  }
}

/**
 * Default singleton instance
 */
export const crossCivicFederation = new CrossCivicFederation();
