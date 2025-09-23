/**
 * Circuit Breaker Pattern Implementation
 * Prevents cascade failures by breaking the circuit when failure rate is too high
 */
export declare enum CircuitState {
    CLOSED = "CLOSED",// Normal operation
    OPEN = "OPEN",// Circuit is open, rejecting calls
    HALF_OPEN = "HALF_OPEN"
}
export interface CircuitBreakerConfig {
    failureThreshold: number;
    successThreshold: number;
    timeout: number;
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
export declare class CircuitBreakerError extends Error {
    circuitName: string;
    state: CircuitState;
    constructor(circuitName: string, state: CircuitState, message: string);
}
/**
 * Circuit Breaker implementation
 */
export declare class CircuitBreaker {
    private name;
    private config;
    private state;
    private failureCount;
    private successCount;
    private consecutiveFailures;
    private consecutiveSuccesses;
    private lastFailureTime?;
    private lastSuccessTime?;
    private nextAttemptTime?;
    private totalRequests;
    private readonly startTime;
    constructor(name: string, config: CircuitBreakerConfig);
    /**
     * Execute a function with circuit breaker protection
     */
    execute<T>(operation: () => Promise<T>): Promise<T>;
    /**
     * Get current circuit breaker metrics
     */
    getMetrics(): CircuitBreakerMetrics;
    /**
     * Get current state
     */
    getState(): CircuitState;
    /**
     * Force circuit to open (for testing or manual intervention)
     */
    forceOpen(reason?: string): void;
    /**
     * Force circuit to close (for testing or manual intervention)
     */
    forceClose(reason?: string): void;
    /**
     * Reset circuit breaker to initial state
     */
    reset(): void;
    /**
     * Handle successful operation
     */
    private onSuccess;
    /**
     * Handle failed operation
     */
    private onFailure;
    /**
     * Check if we should attempt to reset the circuit
     */
    private shouldAttemptReset;
    /**
     * Schedule the next attempt time
     */
    private scheduleNextAttempt;
    /**
     * Set circuit state and notify monitor
     */
    private setState;
    /**
     * Reset success and failure counts
     */
    private resetCounts;
}
/**
 * Circuit Breaker Registry for managing multiple circuit breakers
 */
export declare class CircuitBreakerRegistry {
    private circuitBreakers;
    private globalConfig;
    constructor(globalConfig?: Partial<CircuitBreakerConfig>);
    /**
     * Get or create a circuit breaker
     */
    getCircuitBreaker(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker;
    /**
     * Get all circuit breakers
     */
    getAllCircuitBreakers(): Map<string, CircuitBreaker>;
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
    };
    /**
     * Reset all circuit breakers
     */
    resetAll(): void;
}
/**
 * Initialize global circuit breaker registry
 */
export declare function initializeCircuitBreakers(config?: Partial<CircuitBreakerConfig>): CircuitBreakerRegistry;
/**
 * Get global circuit breaker registry
 */
export declare function getCircuitBreakerRegistry(): CircuitBreakerRegistry;
/**
 * Convenience function to get a circuit breaker
 */
export declare function getCircuitBreaker(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker;
/**
 * Decorator for adding circuit breaker to methods
 */
export declare function circuitBreaker(name: string, config?: Partial<CircuitBreakerConfig>): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
/**
 * Higher-order function for wrapping functions with circuit breaker
 */
export declare function withCircuitBreaker<T extends (...args: any[]) => Promise<any>>(fn: T, name: string, config?: Partial<CircuitBreakerConfig>): T;
//# sourceMappingURL=circuitBreaker.d.ts.map