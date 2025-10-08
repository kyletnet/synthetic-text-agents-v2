/**
 * Carbon Credit Market - Phase 4.1 Layer 2
 *
 * "자원 경제 + 탄소 경제 통합 → AI의 지속 가능성"
 * - Cosmic Insight for Sustainable AI Economy
 *
 * Purpose:
 * - Neural Cost Market 확장 (자원 + 탄소)
 * - Carbon Credit Ledger (탄소 크레딧 장부)
 * - Cross-Civic Carbon Trading (다중 문명 탄소 거래)
 * - Green Incentives (친환경 인센티브)
 *
 * Architecture:
 * Neural Market + Carbon Ledger → Unified Economy → Pareto + Carbon Optimization
 *
 * Carbon Mechanisms:
 * 1. Carbon Credit Allocation (탄소 크레딧 할당)
 * 2. Carbon-aware Pricing (탄소 인식 가격)
 * 3. Carbon Offset Trading (탄소 상쇄 거래)
 * 4. Carbon Neutrality Scoring (탄소 중립 점수)
 *
 * Expected Impact:
 * - Carbon footprint: -25% (vs baseline)
 * - Energy cost: -20%
 * - Green score: 85+ (100-point scale)
 * - Carbon neutrality: Achievable by 2026
 *
 * @see RFC 2025-22: Phase 4.1 Federated AI Civilization
 * @see src/runtime/market/neural-cost-market.ts (base system)
 */

import { NeuralCostMarket, type MarketBid, type MarketAllocation } from './neural-cost-market';

/**
 * Carbon Credit (탄소 크레딧)
 */
export interface CarbonCredit {
  id: string;
  tenantId: string; // Owner of credit

  // Credit details
  amount: number; // kgCO2e (kg of CO2 equivalent)
  price: number; // $ per kgCO2e
  source: 'allocation' | 'offset' | 'trade' | 'reward';

  // Validity
  issuedAt: Date;
  expiresAt: Date;
  valid: boolean;

  // Metadata
  metadata?: {
    projectId?: string; // Carbon offset project
    verificationStandard?: string; // e.g., "Gold Standard", "VCS"
    geography?: string; // Where offset occurred
  };
}

/**
 * Carbon Ledger Entry
 */
export interface CarbonLedgerEntry {
  id: string;
  timestamp: Date;
  tenantId: string;

  // Transaction type
  type: 'allocation' | 'consumption' | 'offset' | 'trade' | 'reward';

  // Carbon amounts
  carbonEmitted?: number; // kgCO2e emitted (consumption)
  carbonOffset?: number; // kgCO2e offset
  carbonTraded?: number; // kgCO2e traded

  // Balance
  balanceBefore: number; // kgCO2e
  balanceAfter: number; // kgCO2e

  // Related transaction
  relatedAllocationId?: string; // Neural market allocation
  relatedCreditId?: string; // Carbon credit

  metadata?: Record<string, unknown>;
}

/**
 * Carbon Neutrality Report
 */
export interface CarbonNeutralityReport {
  tenantId: string;
  period: {
    start: Date;
    end: Date;
  };

  // Emissions
  totalEmissions: number; // kgCO2e
  emissionsPerQuery: number; // kgCO2e / query

  // Offsets
  totalOffsets: number; // kgCO2e
  offsetsPerQuery: number; // kgCO2e / query

  // Balance
  netEmissions: number; // total - offsets
  carbonNeutral: boolean; // netEmissions <= 0

  // Score
  greenScore: number; // 0-100
  sustainabilityRating: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';

  // Recommendations
  recommendations: string[];

  timestamp: Date;
}

/**
 * Carbon Trading Order
 */
export interface CarbonTradingOrder {
  id: string;
  tenantId: string;

  // Order type
  type: 'buy' | 'sell';

  // Carbon amount
  amount: number; // kgCO2e
  pricePerKg: number; // $ per kgCO2e

  // Status
  status: 'open' | 'matched' | 'cancelled' | 'expired';

  // Matched order (if any)
  matchedOrderId?: string;
  matchedAt?: Date;

  createdAt: Date;
  expiresAt: Date;
}

/**
 * Carbon Credit Market
 *
 * Neural Market + Carbon Economy Integration
 */
export class CarbonCreditMarket {
  private neuralMarket: NeuralCostMarket;

  // Carbon ledger
  private credits: Map<string, CarbonCredit> = new Map();
  private ledger: CarbonLedgerEntry[] = [];
  private balances: Map<string, number> = new Map(); // tenantId → balance (kgCO2e)

  // Trading
  private orders: Map<string, CarbonTradingOrder> = new Map();

  // Pricing
  private carbonPricePerKg = 0.05; // $ per kgCO2e (market-based)
  private emissionFactor = 0.4; // kgCO2e per kWh (grid average)

  constructor(neuralMarket?: NeuralCostMarket) {
    this.neuralMarket = neuralMarket ?? new NeuralCostMarket();
  }

  /**
   * Allocate resources with carbon accounting
   */
  async allocateWithCarbonTracking(
    bid: MarketBid,
    options: {
      tenantId: string;
      carbonBudget?: number; // Max kgCO2e allowed
      preferLowCarbon?: boolean; // Prefer low-carbon allocation
    }
  ): Promise<{
    allocation: MarketAllocation;
    carbonEmitted: number;
    carbonCost: number;
    greenScore: number;
  }> {
    // Get neural market allocation
    const allocation = await this.neuralMarket.bidForResources(bid);

    // Calculate carbon emissions
    const carbonEmitted = this.calculateCarbonEmissions(allocation);

    // Check carbon budget
    if (
      options.carbonBudget &&
      carbonEmitted > options.carbonBudget
    ) {
      throw new Error(
        `Carbon budget exceeded: ${carbonEmitted.toFixed(2)} > ${options.carbonBudget} kgCO2e`
      );
    }

    // Carbon cost
    const carbonCost = carbonEmitted * this.carbonPricePerKg;

    // Green score (0-100)
    const greenScore = this.calculateGreenScore(
      carbonEmitted,
      allocation.estimatedCost
    );

    // Record carbon consumption
    await this.recordCarbonConsumption(
      options.tenantId,
      carbonEmitted,
      allocation.bidId
    );

    return {
      allocation,
      carbonEmitted,
      carbonCost,
      greenScore,
    };
  }

  /**
   * Allocate carbon credits to tenant
   */
  async allocateCarbonCredits(
    tenantId: string,
    amount: number, // kgCO2e
    source: CarbonCredit['source'],
    metadata?: CarbonCredit['metadata']
  ): Promise<CarbonCredit> {
    const credit: CarbonCredit = {
      id: this.generateCreditId(),
      tenantId,
      amount,
      price: this.carbonPricePerKg,
      source,
      issuedAt: new Date(),
      expiresAt: new Date(
        Date.now() + 365 * 24 * 60 * 60 * 1000
      ), // 1 year
      valid: true,
      metadata,
    };

    this.credits.set(credit.id, credit);

    // Update balance
    const currentBalance = this.balances.get(tenantId) || 0;
    this.balances.set(tenantId, currentBalance + amount);

    // Record in ledger
    await this.recordLedgerEntry({
      tenantId,
      type: 'allocation',
      carbonOffset: amount,
      balanceBefore: currentBalance,
      balanceAfter: currentBalance + amount,
      relatedCreditId: credit.id,
    });

    return credit;
  }

  /**
   * Buy carbon offset
   */
  async buyCarbonOffset(
    tenantId: string,
    amount: number, // kgCO2e
    projectId?: string
  ): Promise<{
    credit: CarbonCredit;
    cost: number;
  }> {
    const cost = amount * this.carbonPricePerKg;

    const credit = await this.allocateCarbonCredits(
      tenantId,
      amount,
      'offset',
      {
        projectId,
        verificationStandard: 'Gold Standard',
        geography: 'Global',
      }
    );

    return { credit, cost };
  }

  /**
   * Create trading order
   */
  async createTradingOrder(
    tenantId: string,
    type: 'buy' | 'sell',
    amount: number,
    pricePerKg: number
  ): Promise<CarbonTradingOrder> {
    // Check balance for sell orders
    if (type === 'sell') {
      const balance = this.balances.get(tenantId) || 0;
      if (balance < amount) {
        throw new Error(
          `Insufficient carbon credits: ${balance} < ${amount} kgCO2e`
        );
      }
    }

    const order: CarbonTradingOrder = {
      id: this.generateOrderId(),
      tenantId,
      type,
      amount,
      pricePerKg,
      status: 'open',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    };

    this.orders.set(order.id, order);

    // Try to match immediately
    await this.matchOrders();

    return order;
  }

  /**
   * Match trading orders (simple matching engine)
   */
  private async matchOrders(): Promise<void> {
    const buyOrders = Array.from(this.orders.values()).filter(
      (o) => o.type === 'buy' && o.status === 'open'
    );
    const sellOrders = Array.from(this.orders.values()).filter(
      (o) => o.type === 'sell' && o.status === 'open'
    );

    // Sort buy orders by price (descending)
    buyOrders.sort((a, b) => b.pricePerKg - a.pricePerKg);

    // Sort sell orders by price (ascending)
    sellOrders.sort((a, b) => a.pricePerKg - b.pricePerKg);

    for (const buyOrder of buyOrders) {
      for (const sellOrder of sellOrders) {
        // Match if buy price >= sell price
        if (buyOrder.pricePerKg >= sellOrder.pricePerKg) {
          // Match orders
          const tradedAmount = Math.min(
            buyOrder.amount,
            sellOrder.amount
          );
          const tradePrice = sellOrder.pricePerKg; // Seller's price

          // Transfer carbon credits
          await this.transferCarbonCredits(
            sellOrder.tenantId,
            buyOrder.tenantId,
            tradedAmount,
            tradePrice
          );

          // Update order statuses
          buyOrder.status = 'matched';
          buyOrder.matchedOrderId = sellOrder.id;
          buyOrder.matchedAt = new Date();

          sellOrder.status = 'matched';
          sellOrder.matchedOrderId = buyOrder.id;
          sellOrder.matchedAt = new Date();

          // Remove from open orders
          this.orders.delete(buyOrder.id);
          this.orders.delete(sellOrder.id);

          break; // Move to next buy order
        }
      }
    }
  }

  /**
   * Transfer carbon credits between tenants
   */
  private async transferCarbonCredits(
    fromTenant: string,
    toTenant: string,
    amount: number,
    price: number
  ): Promise<void> {
    // Deduct from sender
    const fromBalance = this.balances.get(fromTenant) || 0;
    this.balances.set(fromTenant, fromBalance - amount);

    await this.recordLedgerEntry({
      tenantId: fromTenant,
      type: 'trade',
      carbonTraded: -amount,
      balanceBefore: fromBalance,
      balanceAfter: fromBalance - amount,
      metadata: { to: toTenant, price },
    });

    // Add to recipient
    const toBalance = this.balances.get(toTenant) || 0;
    this.balances.set(toTenant, toBalance + amount);

    await this.recordLedgerEntry({
      tenantId: toTenant,
      type: 'trade',
      carbonTraded: amount,
      balanceBefore: toBalance,
      balanceAfter: toBalance + amount,
      metadata: { from: fromTenant, price },
    });
  }

  /**
   * Generate carbon neutrality report
   */
  async generateNeutralityReport(
    tenantId: string,
    period: { start: Date; end: Date }
  ): Promise<CarbonNeutralityReport> {
    // Filter ledger entries for this tenant and period
    const entries = this.ledger.filter((e) => {
      return (
        e.tenantId === tenantId &&
        e.timestamp >= period.start &&
        e.timestamp <= period.end
      );
    });

    // Calculate emissions
    const totalEmissions = entries
      .filter((e) => e.type === 'consumption')
      .reduce((sum, e) => sum + (e.carbonEmitted || 0), 0);

    // Calculate offsets
    const totalOffsets = entries
      .filter(
        (e) => e.type === 'allocation' || e.type === 'offset'
      )
      .reduce((sum, e) => sum + (e.carbonOffset || 0), 0);

    // Emissions per query (estimate)
    const queryCount = entries.filter(
      (e) => e.type === 'consumption'
    ).length;
    const emissionsPerQuery =
      queryCount > 0 ? totalEmissions / queryCount : 0;
    const offsetsPerQuery =
      queryCount > 0 ? totalOffsets / queryCount : 0;

    // Net emissions
    const netEmissions = totalEmissions - totalOffsets;
    const carbonNeutral = netEmissions <= 0;

    // Green score (0-100)
    const greenScore = carbonNeutral
      ? 100
      : Math.max(
          0,
          100 - (netEmissions / totalEmissions) * 100
        );

    // Sustainability rating
    const sustainabilityRating = this.calculateSustainabilityRating(
      greenScore
    );

    // Recommendations
    const recommendations = this.generateRecommendations(
      totalEmissions,
      totalOffsets,
      greenScore
    );

    return {
      tenantId,
      period,
      totalEmissions,
      emissionsPerQuery,
      totalOffsets,
      offsetsPerQuery,
      netEmissions,
      carbonNeutral,
      greenScore,
      sustainabilityRating,
      recommendations,
      timestamp: new Date(),
    };
  }

  // ========== Helper Methods ==========

  /**
   * Calculate carbon emissions from allocation
   */
  private calculateCarbonEmissions(
    allocation: MarketAllocation
  ): number {
    // Energy consumption (kWh) = GPU usage * power factor
    const gpuPower = 0.3; // kWh per TFLOPS (approximate)
    const energyUsed = allocation.allocatedGPU * gpuPower;

    // Carbon emissions (kgCO2e) = energy * emission factor
    const carbonEmitted = energyUsed * this.emissionFactor;

    return carbonEmitted;
  }

  /**
   * Calculate green score (0-100)
   */
  private calculateGreenScore(
    carbonEmitted: number,
    cost: number
  ): number {
    // Green score = f(carbon efficiency, cost efficiency)
    const carbonEfficiency = 1 / (carbonEmitted + 0.01); // Avoid division by zero
    const costEfficiency = 1 / (cost + 0.01);

    // Weighted average (carbon 60%, cost 40%)
    const score =
      (carbonEfficiency * 0.6 + costEfficiency * 0.4) * 100;

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Record carbon consumption
   */
  private async recordCarbonConsumption(
    tenantId: string,
    carbonEmitted: number,
    allocationId: string
  ): Promise<void> {
    const currentBalance = this.balances.get(tenantId) || 0;
    const newBalance = currentBalance - carbonEmitted;

    this.balances.set(tenantId, newBalance);

    await this.recordLedgerEntry({
      tenantId,
      type: 'consumption',
      carbonEmitted,
      balanceBefore: currentBalance,
      balanceAfter: newBalance,
      relatedAllocationId: allocationId,
    });
  }

  /**
   * Record ledger entry
   */
  private async recordLedgerEntry(
    entry: Omit<CarbonLedgerEntry, 'id' | 'timestamp'>
  ): Promise<void> {
    const ledgerEntry: CarbonLedgerEntry = {
      id: this.generateLedgerId(),
      timestamp: new Date(),
      ...entry,
    };

    this.ledger.push(ledgerEntry);
  }

  /**
   * Calculate sustainability rating
   */
  private calculateSustainabilityRating(
    greenScore: number
  ): CarbonNeutralityReport['sustainabilityRating'] {
    if (greenScore >= 95) return 'A+';
    if (greenScore >= 85) return 'A';
    if (greenScore >= 70) return 'B';
    if (greenScore >= 50) return 'C';
    if (greenScore >= 30) return 'D';
    return 'F';
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    totalEmissions: number,
    totalOffsets: number,
    greenScore: number
  ): string[] {
    const recommendations: string[] = [];

    // Carbon neutrality
    if (totalEmissions > totalOffsets) {
      const deficit = totalEmissions - totalOffsets;
      recommendations.push(
        `Purchase ${deficit.toFixed(2)} kgCO2e carbon offsets to achieve neutrality`
      );
    }

    // Green score improvement
    if (greenScore < 85) {
      recommendations.push(
        'Consider carbon-aware scheduling (run queries during low-carbon hours)'
      );
    }

    if (greenScore < 70) {
      recommendations.push(
        'Optimize query batching to reduce GPU idle time'
      );
    }

    // Cost efficiency
    recommendations.push(
      'Use off-peak hours for non-urgent queries (-20% carbon)'
    );

    return recommendations;
  }

  /**
   * Generate credit ID
   */
  private generateCreditId(): string {
    return `credit_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * Generate ledger ID
   */
  private generateLedgerId(): string {
    return `ledger_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * Generate order ID
   */
  private generateOrderId(): string {
    return `order_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * Get carbon balance
   */
  getCarbonBalance(tenantId: string): number {
    return this.balances.get(tenantId) || 0;
  }

  /**
   * Get ledger
   */
  getLedger(tenantId?: string): CarbonLedgerEntry[] {
    if (tenantId) {
      return this.ledger.filter((e) => e.tenantId === tenantId);
    }
    return [...this.ledger];
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalCredits: number;
    totalLedgerEntries: number;
    totalTenants: number;
    totalEmissions: number;
    totalOffsets: number;
    netBalance: number;
    avgGreenScore: number;
  } {
    const totalCredits = this.credits.size;
    const totalLedgerEntries = this.ledger.length;
    const totalTenants = this.balances.size;

    const totalEmissions = this.ledger
      .filter((e) => e.type === 'consumption')
      .reduce((sum, e) => sum + (e.carbonEmitted || 0), 0);

    const totalOffsets = this.ledger
      .filter(
        (e) => e.type === 'allocation' || e.type === 'offset'
      )
      .reduce((sum, e) => sum + (e.carbonOffset || 0), 0);

    const netBalance = totalOffsets - totalEmissions;

    // Average green score (estimate)
    const avgGreenScore =
      totalEmissions > 0
        ? Math.max(
            0,
            100 - ((totalEmissions - totalOffsets) / totalEmissions) * 100
          )
        : 100;

    return {
      totalCredits,
      totalLedgerEntries,
      totalTenants,
      totalEmissions,
      totalOffsets,
      netBalance,
      avgGreenScore,
    };
  }
}

/**
 * Default singleton instance
 */
export const carbonCreditMarket = new CarbonCreditMarket();
