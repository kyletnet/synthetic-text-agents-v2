/**
 * Seed Manager
 * Provides consistent randomization across all system components
 * Ensures reproducible results for baseline runs
 */
export interface SeedState {
    global_seed: number;
    component_seeds: {
        [component: string]: number;
    };
    random_state: {
        call_count: number;
        last_value: number;
    };
    created_timestamp: string;
    run_id?: string;
}
export interface SeededRandomOptions {
    min?: number;
    max?: number;
    integer?: boolean;
}
export declare class SeedManager {
    private seedState;
    private componentCounters;
    constructor(globalSeed?: number, runId?: string);
    /**
     * Initialize seeds for common system components
     */
    private initializeComponentSeeds;
    /**
     * Derive deterministic seed for a component
     */
    private deriveComponentSeed;
    /**
     * Get seed for a specific component
     */
    getSeedForComponent(component: string): number;
    /**
     * Get seeded random number generator for a component
     */
    getSeededRandom(component: string): SeededRandom;
    /**
     * Generate global random value (advances global state)
     */
    random(options?: SeededRandomOptions): number;
    /**
     * Shuffle array deterministically
     */
    shuffle<T>(array: T[], component?: string): T[];
    /**
     * Sample items deterministically
     */
    sample<T>(array: T[], count: number, component?: string): T[];
    /**
     * Choose random item deterministically
     */
    choice<T>(array: T[], component?: string): T | undefined;
    /**
     * Generate random integer in range
     */
    randomInt(min: number, max: number, component?: string): number;
    /**
     * Get current seed state for serialization
     */
    getSeedState(): SeedState;
    /**
     * Restore from seed state
     */
    static fromSeedState(seedState: SeedState): SeedManager;
    /**
     * Create deterministic environment variable setup
     */
    getEnvironmentSeeds(): {
        [key: string]: string;
    };
    /**
     * Apply seeds to process environment
     */
    applyToEnvironment(): void;
    /**
     * Generate a new random seed
     */
    private generateSeed;
    /**
     * Create a seeded random configuration for LLM calls
     */
    getLLMRandomConfig(component?: string): any;
    /**
     * Get consistent retry delays for exponential backoff
     */
    getRetryDelay(attempt: number, baseMs?: number, component?: string): number;
    /**
     * Get current seed state
     */
    getCurrentSeed(): number;
}
/**
 * Seeded Random Number Generator
 * Provides deterministic random sequences for specific components
 */
export declare class SeededRandom {
    private seed;
    private current;
    constructor(seed: number);
    /**
     * Get next random value [0, 1)
     */
    next(): number;
    /**
     * Get random integer in range [min, max]
     */
    nextInt(min: number, max: number): number;
    /**
     * Get random float in range [min, max)
     */
    nextFloat(min?: number, max?: number): number;
    /**
     * Get random boolean with given probability
     */
    nextBoolean(probability?: number): boolean;
    /**
     * Reset to original seed
     */
    reset(): void;
    /**
     * Get current seed value
     */
    getSeed(): number;
}
/**
 * Initialize global seed manager
 */
export declare function initializeSeedManager(seed?: number, runId?: string): SeedManager;
/**
 * Get global seed manager (throws if not initialized)
 */
export declare function getSeedManager(): SeedManager;
/**
 * Get seeded random for a component (convenience function)
 */
export declare function getSeededRandom(component: string): SeededRandom;
/**
 * Deterministic sampling utilities
 */
export declare const SeededUtils: {
    /**
     * Deterministic shuffle
     */
    shuffle: <T>(array: T[], component?: string) => T[];
    /**
     * Deterministic sample
     */
    sample: <T>(array: T[], count: number, component?: string) => T[];
    /**
     * Deterministic choice
     */
    choice: <T>(array: T[], component?: string) => T | undefined;
    /**
     * Deterministic random integer
     */
    randomInt: (min: number, max: number, component?: string) => number;
    /**
     * Create diversity sampling strategy
     */
    createDiversitySampler: (items: any[], targetDistribution: any, component?: string) => {
        sample: (count: number) => any[];
    };
};
/**
 * Integration helpers for existing codebase
 */
export declare const SeedIntegration: {
    /**
     * Patch Math.random for specific scopes (use carefully)
     */
    patchMathRandom: (component: string, fn: () => any) => any;
    /**
     * Get deterministic Array.prototype.sort comparator
     */
    createDeterministicSort: (component?: string) => (a: any, b: any) => number;
    /**
     * Simple string hash function
     */
    hashString: (str: string) => number;
};
//# sourceMappingURL=seed_manager.d.ts.map