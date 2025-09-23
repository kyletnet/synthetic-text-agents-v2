/**
 * Circuit Breaker Pattern Implementation
 * Prevents cascade failures by breaking the circuit when failure rate is too high
 */

export enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Circuit is open, rejecting calls
  HALF_OPEN = 'HALF_OPEN' // Testing if service has recovered
}

export interface CircuitBreakerConfig {
  failureThreshold: number;        // Number of failures before opening circuit
  successThreshold: number;        // Number of successes in half-open to close circuit
  timeout: number;                 // Time in ms to wait before trying half-open
  monitor?: (event: CircuitBreakerEvent) => void;
}

export interface CircuitBreakerEvent {
  circuitName: string;
  state: CircuitState;
  previousState?: CircuitState;
  timestamp: Date;
  reason: string;
  metrics: CircuitBreakerMetrics;
}

export interface CircuitBreakerMetrics {
  totalRequests: number;
  successCount: number;
  failureCount: number;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  uptime: number;
  failureRate: number;
}

export class CircuitBreakerError extends Error {
  constructor(
    public circuitName: string,
    public state: CircuitState,
    message: string
  ) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

/**
 * Circuit Breaker implementation
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private consecutiveFailures = 0;
  private consecutiveSuccesses = 0;
  private lastFailureTime?: Date;
  private lastSuccessTime?: Date;
  private nextAttemptTime?: Date;
  private totalRequests = 0;
  private readonly startTime = Date.now();

  constructor(
    private name: string,
    private config: CircuitBreakerConfig
  ) {}

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // Check if circuit should remain open
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.setState(CircuitState.HALF_OPEN, 'Attempting reset after timeout');
      } else {
        throw new CircuitBreakerError(
          this.name,
          this.state,
          `Circuit breaker is OPEN. Next attempt at ${this.nextAttemptTime?.toISOString()}`
        );
      }
    }

    this.totalRequests++;

    try {
      const result = await operation();
      this.onSuccess();
      return result;

    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  /**
   * Get current circuit breaker metrics
   */
  getMetrics(): CircuitBreakerMetrics {
    return {
      totalRequests: this.totalRequests,
      successCount: this.successCount,
      failureCount: this.failureCount,
      consecutiveFailures: this.consecutiveFailures,
      consecutiveSuccesses: this.consecutiveSuccesses,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      uptime: Date.now() - this.startTime,
      failureRate: this.totalRequests > 0 ? this.failureCount / this.totalRequests : 0
    };
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Force circuit to open (for testing or manual intervention)
   */
  forceOpen(reason: string = 'Manual intervention'): void {
    this.setState(CircuitState.OPEN, reason);
    this.scheduleNextAttempt();
  }

  /**
   * Force circuit to close (for testing or manual intervention)
   */
  forceClose(reason: string = 'Manual intervention'): void {
    this.setState(CircuitState.CLOSED, reason);
    this.resetCounts();
  }

  /**
   * Reset circuit breaker to initial state
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.resetCounts();
    this.nextAttemptTime = undefined;
  }

  /**
   * Handle successful operation
   */
  private onSuccess(): void {
    this.successCount++;
    this.consecutiveSuccesses++;
    this.consecutiveFailures = 0;
    this.lastSuccessTime = new Date();

    if (this.state === CircuitState.HALF_OPEN) {
      if (this.consecutiveSuccesses >= this.config.successThreshold) {
        this.setState(CircuitState.CLOSED, 'Sufficient successes in half-open state');
        this.resetCounts();
      }
    }
  }

  /**
   * Handle failed operation
   */
  private onFailure(error: unknown): void {
    this.failureCount++;
    this.consecutiveFailures++;
    this.consecutiveSuccesses = 0;
    this.lastFailureTime = new Date();

    if (this.state === CircuitState.CLOSED || this.state === CircuitState.HALF_OPEN) {
      if (this.consecutiveFailures >= this.config.failureThreshold) {
        this.setState(CircuitState.OPEN, `Failure threshold reached: ${this.consecutiveFailures} consecutive failures`);
        this.scheduleNextAttempt();
      }
    }
  }

  /**
   * Check if we should attempt to reset the circuit
   */
  private shouldAttemptReset(): boolean {
    return this.nextAttemptTime !== undefined && Date.now() >= this.nextAttemptTime.getTime();
  }

  /**
   * Schedule the next attempt time
   */
  private scheduleNextAttempt(): void {
    this.nextAttemptTime = new Date(Date.now() + this.config.timeout);
  }

  /**
   * Set circuit state and notify monitor
   */
  private setState(newState: CircuitState, reason: string): void {
    const previousState = this.state;
    this.state = newState;

    const event: CircuitBreakerEvent = {
      circuitName: this.name,
      state: newState,
      previousState,
      timestamp: new Date(),
      reason,
      metrics: this.getMetrics()
    };

    // Notify monitor if configured
    if (this.config.monitor) {
      try {
        this.config.monitor(event);
      } catch (error) {
        console.error('Circuit breaker monitor error:', error);
      }
    }

    console.log(`[CircuitBreaker:${this.name}] ${previousState} → ${newState}: ${reason}`);
  }

  /**
   * Reset success and failure counts
   */
  private resetCounts(): void {
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
  }
}

/**
 * Circuit Breaker Registry for managing multiple circuit breakers
 */
export class CircuitBreakerRegistry {
  private circuitBreakers = new Map<string, CircuitBreaker>();
  private globalConfig: Partial<CircuitBreakerConfig>;

  constructor(globalConfig: Partial<CircuitBreakerConfig> = {}) {
    this.globalConfig = globalConfig;
  }

  /**
   * Get or create a circuit breaker
   */
  getCircuitBreaker(
    name: string,
    config?: Partial<CircuitBreakerConfig>
  ): CircuitBreaker {
    if (!this.circuitBreakers.has(name)) {
      const mergedConfig: CircuitBreakerConfig = {
        failureThreshold: 5,
        successThreshold: 3,
        timeout: 30000, // 30 seconds
        ...this.globalConfig,
        ...config
      };

      this.circuitBreakers.set(name, new CircuitBreaker(name, mergedConfig));
    }

    return this.circuitBreakers.get(name)!;
  }

  /**
   * Get all circuit breakers
   */
  getAllCircuitBreakers(): Map<string, CircuitBreaker> {
    return new Map(this.circuitBreakers);
  }

  /**
   * Get registry statistics
   */
  getRegistryStats(): {
    totalCircuits: number;
    openCircuits: number;
    halfOpenCircuits: number;
    closedCircuits: number;
    circuitDetails: Array<{
      name: string;
      state: CircuitState;
      metrics: CircuitBreakerMetrics;
    }>;
  } {
    const circuits = Array.from(this.circuitBreakers.entries());

    const stats = {
      totalCircuits: circuits.length,
      openCircuits: 0,
      halfOpenCircuits: 0,
      closedCircuits: 0,
      circuitDetails: circuits.map(([name, circuit]) => ({
        name,
        state: circuit.getState(),
        metrics: circuit.getMetrics()
      }))
    };

    stats.circuitDetails.forEach(circuit => {
      switch (circuit.state) {
        case CircuitState.OPEN:
          stats.openCircuits++;
          break;
        case CircuitState.HALF_OPEN:
          stats.halfOpenCircuits++;
          break;
        case CircuitState.CLOSED:
          stats.closedCircuits++;
          break;
      }
    });

    return stats;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    this.circuitBreakers.forEach(circuit => circuit.reset());
  }
}

/**
 * Global circuit breaker registry
 */
let globalRegistry: CircuitBreakerRegistry;

/**
 * Initialize global circuit breaker registry
 */
export function initializeCircuitBreakers(config?: Partial<CircuitBreakerConfig>): CircuitBreakerRegistry {
  globalRegistry = new CircuitBreakerRegistry(config);
  return globalRegistry;
}

/**
 * Get global circuit breaker registry
 */
export function getCircuitBreakerRegistry(): CircuitBreakerRegistry {
  if (!globalRegistry) {
    globalRegistry = new CircuitBreakerRegistry();
  }
  return globalRegistry;
}

/**
 * Convenience function to get a circuit breaker
 */
export function getCircuitBreaker(
  name: string,
  config?: Partial<CircuitBreakerConfig>
): CircuitBreaker {
  return getCircuitBreakerRegistry().getCircuitBreaker(name, config);
}

/**
 * Decorator for adding circuit breaker to methods
 */
export function circuitBreaker(
  name: string,
  config?: Partial<CircuitBreakerConfig>
) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const circuit = getCircuitBreaker(name, config);
      return circuit.execute(() => originalMethod.apply(this, args));
    };

    return descriptor;
  };
}

/**
 * Higher-order function for wrapping functions with circuit breaker
 */
export function withCircuitBreaker<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  name: string,
  config?: Partial<CircuitBreakerConfig>
): T {
  const circuit = getCircuitBreaker(name, config);

  return ((...args: any[]) => {
    return circuit.execute(() => fn(...args));
  }) as T;
}