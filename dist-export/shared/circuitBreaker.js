/**
 * Circuit Breaker Pattern Implementation
 * Prevents cascade failures by breaking the circuit when failure rate is too high
 */
export var CircuitState;
(function (CircuitState) {
  CircuitState["CLOSED"] = "CLOSED";
  CircuitState["OPEN"] = "OPEN";
  CircuitState["HALF_OPEN"] = "HALF_OPEN";
})(CircuitState || (CircuitState = {}));
export class CircuitBreakerError extends Error {
  circuitName;
  state;
  constructor(circuitName, state, message) {
    super(message);
    this.circuitName = circuitName;
    this.state = state;
    this.name = "CircuitBreakerError";
  }
}
/**
 * Circuit Breaker implementation
 */
export class CircuitBreaker {
  name;
  config;
  state = CircuitState.CLOSED;
  failureCount = 0;
  successCount = 0;
  consecutiveFailures = 0;
  consecutiveSuccesses = 0;
  lastFailureTime;
  lastSuccessTime;
  nextAttemptTime;
  totalRequests = 0;
  startTime = Date.now();
  constructor(name, config) {
    this.name = name;
    this.config = config;
  }
  /**
   * Execute a function with circuit breaker protection
   */
  async execute(operation) {
    // Check if circuit should remain open
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.setState(CircuitState.HALF_OPEN, "Attempting reset after timeout");
      } else {
        throw new CircuitBreakerError(
          this.name,
          this.state,
          `Circuit breaker is OPEN. Next attempt at ${this.nextAttemptTime?.toISOString()}`,
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
  getMetrics() {
    return {
      totalRequests: this.totalRequests,
      successCount: this.successCount,
      failureCount: this.failureCount,
      consecutiveFailures: this.consecutiveFailures,
      consecutiveSuccesses: this.consecutiveSuccesses,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      uptime: Date.now() - this.startTime,
      failureRate:
        this.totalRequests > 0 ? this.failureCount / this.totalRequests : 0,
    };
  }
  /**
   * Get current state
   */
  getState() {
    return this.state;
  }
  /**
   * Force circuit to open (for testing or manual intervention)
   */
  forceOpen(reason = "Manual intervention") {
    this.setState(CircuitState.OPEN, reason);
    this.scheduleNextAttempt();
  }
  /**
   * Force circuit to close (for testing or manual intervention)
   */
  forceClose(reason = "Manual intervention") {
    this.setState(CircuitState.CLOSED, reason);
    this.resetCounts();
  }
  /**
   * Reset circuit breaker to initial state
   */
  reset() {
    this.state = CircuitState.CLOSED;
    this.resetCounts();
    this.nextAttemptTime = undefined;
  }
  /**
   * Handle successful operation
   */
  onSuccess() {
    this.successCount++;
    this.consecutiveSuccesses++;
    this.consecutiveFailures = 0;
    this.lastSuccessTime = new Date();
    if (this.state === CircuitState.HALF_OPEN) {
      if (this.consecutiveSuccesses >= this.config.successThreshold) {
        this.setState(
          CircuitState.CLOSED,
          "Sufficient successes in half-open state",
        );
        this.resetCounts();
      }
    }
  }
  /**
   * Handle failed operation
   */
  onFailure(error) {
    this.failureCount++;
    this.consecutiveFailures++;
    this.consecutiveSuccesses = 0;
    this.lastFailureTime = new Date();
    if (
      this.state === CircuitState.CLOSED ||
      this.state === CircuitState.HALF_OPEN
    ) {
      if (this.consecutiveFailures >= this.config.failureThreshold) {
        this.setState(
          CircuitState.OPEN,
          `Failure threshold reached: ${this.consecutiveFailures} consecutive failures`,
        );
        this.scheduleNextAttempt();
      }
    }
  }
  /**
   * Check if we should attempt to reset the circuit
   */
  shouldAttemptReset() {
    return (
      this.nextAttemptTime !== undefined &&
      Date.now() >= this.nextAttemptTime.getTime()
    );
  }
  /**
   * Schedule the next attempt time
   */
  scheduleNextAttempt() {
    this.nextAttemptTime = new Date(Date.now() + this.config.timeout);
  }
  /**
   * Set circuit state and notify monitor
   */
  setState(newState, reason) {
    const previousState = this.state;
    this.state = newState;
    const event = {
      circuitName: this.name,
      state: newState,
      previousState,
      timestamp: new Date(),
      reason,
      metrics: this.getMetrics(),
    };
    // Notify monitor if configured
    if (this.config.monitor) {
      try {
        this.config.monitor(event);
      } catch (error) {
        console.error("Circuit breaker monitor error:", error);
      }
    }
    console.log(
      `[CircuitBreaker:${this.name}] ${previousState} → ${newState}: ${reason}`,
    );
  }
  /**
   * Reset success and failure counts
   */
  resetCounts() {
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
  }
}
/**
 * Circuit Breaker Registry for managing multiple circuit breakers
 */
export class CircuitBreakerRegistry {
  circuitBreakers = new Map();
  globalConfig;
  constructor(globalConfig = {}) {
    this.globalConfig = globalConfig;
  }
  /**
   * Get or create a circuit breaker
   */
  getCircuitBreaker(name, config) {
    if (!this.circuitBreakers.has(name)) {
      const mergedConfig = {
        failureThreshold: 5,
        successThreshold: 3,
        timeout: 30000, // 30 seconds
        ...this.globalConfig,
        ...config,
      };
      this.circuitBreakers.set(name, new CircuitBreaker(name, mergedConfig));
    }
    const circuitBreaker = this.circuitBreakers.get(name);
    if (!circuitBreaker) {
      throw new Error(`Circuit breaker '${name}' not found`);
    }
    return circuitBreaker;
  }
  /**
   * Get all circuit breakers
   */
  getAllCircuitBreakers() {
    return new Map(this.circuitBreakers);
  }
  /**
   * Get registry statistics
   */
  getRegistryStats() {
    const circuits = Array.from(this.circuitBreakers.entries());
    const stats = {
      totalCircuits: circuits.length,
      openCircuits: 0,
      halfOpenCircuits: 0,
      closedCircuits: 0,
      circuitDetails: circuits.map(([name, circuit]) => ({
        name,
        state: circuit.getState(),
        metrics: circuit.getMetrics(),
      })),
    };
    stats.circuitDetails.forEach((circuit) => {
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
  resetAll() {
    this.circuitBreakers.forEach((circuit) => circuit.reset());
  }
}
/**
 * Global circuit breaker registry
 */
let globalRegistry;
/**
 * Initialize global circuit breaker registry
 */
export function initializeCircuitBreakers(config) {
  globalRegistry = new CircuitBreakerRegistry(config);
  return globalRegistry;
}
/**
 * Get global circuit breaker registry
 */
export function getCircuitBreakerRegistry() {
  if (!globalRegistry) {
    globalRegistry = new CircuitBreakerRegistry();
  }
  return globalRegistry;
}
/**
 * Convenience function to get a circuit breaker
 */
export function getCircuitBreaker(name, config) {
  return getCircuitBreakerRegistry().getCircuitBreaker(name, config);
}
/**
 * Decorator for adding circuit breaker to methods
 */
export function circuitBreaker(name, config) {
  return function (target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args) {
      const circuit = getCircuitBreaker(name, config);
      return circuit.execute(() => originalMethod.apply(this, args));
    };
    return descriptor;
  };
}
/**
 * Higher-order function for wrapping functions with circuit breaker
 */
export function withCircuitBreaker(fn, name, config) {
  const circuit = getCircuitBreaker(name, config);
  return (...args) => {
    return circuit.execute(() => fn(...args));
  };
}
//# sourceMappingURL=circuitBreaker.js.map
