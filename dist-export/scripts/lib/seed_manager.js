/**
 * Seed Manager
 * Provides consistent randomization across all system components
 * Ensures reproducible results for baseline runs
 */
export class SeedManager {
    seedState;
    componentCounters = {};
    constructor(globalSeed, runId) {
        const seed = globalSeed ?? this.generateSeed();
        this.seedState = {
            global_seed: seed,
            component_seeds: {},
            random_state: {
                call_count: 0,
                last_value: seed,
            },
            created_timestamp: new Date().toISOString(),
        };
        if (typeof runId === "string")
            this.seedState.run_id = runId;
        // Initialize common component seeds
        this.initializeComponentSeeds();
    }
    /**
     * Initialize seeds for common system components
     */
    initializeComponentSeeds() {
        const components = [
            "batch_sampling", // For selecting items from batches
            "diversity_sampling", // For diversity planner agent
            "retriever_tiebreak", // For breaking ties in retrieval
            "agent_selection", // For selecting agents in MA orchestration
            "question_generation", // For QA generation randomness
            "answer_generation", // For answer generation randomness
            "evaluation_sampling", // For sampling evaluation items
            "llm_temperature", // For LLM temperature/randomness seeding
        ];
        for (const component of components) {
            this.seedState.component_seeds[component] =
                this.deriveComponentSeed(component);
        }
    }
    /**
     * Derive deterministic seed for a component
     */
    deriveComponentSeed(component) {
        // Use component name + global seed to derive deterministic component seed
        let hash = 0;
        const input = component + this.seedState.global_seed.toString();
        for (let i = 0; i < input.length; i++) {
            const char = input.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash) % 1000000;
    }
    /**
     * Get seed for a specific component
     */
    getSeedForComponent(component) {
        if (!this.seedState.component_seeds[component]) {
            this.seedState.component_seeds[component] =
                this.deriveComponentSeed(component);
        }
        return this.seedState.component_seeds[component];
    }
    /**
     * Get seeded random number generator for a component
     */
    getSeededRandom(component) {
        const seed = this.getSeedForComponent(component);
        const counter = this.componentCounters[component] || 0;
        // Advance counter for this component
        this.componentCounters[component] = counter + 1;
        return new SeededRandom(seed + counter);
    }
    /**
     * Generate global random value (advances global state)
     */
    random(options = {}) {
        this.seedState.random_state.call_count++;
        // Linear congruential generator for reproducible randomness
        const a = 1664525;
        const c = 1013904223;
        const m = Math.pow(2, 32);
        this.seedState.random_state.last_value =
            (a * this.seedState.random_state.last_value + c) % m;
        let value = this.seedState.random_state.last_value / m;
        // Apply options
        if (options.min !== undefined || options.max !== undefined) {
            const min = options.min ?? 0;
            const max = options.max ?? 1;
            value = min + value * (max - min);
        }
        if (options.integer) {
            value = Math.floor(value);
        }
        return value;
    }
    /**
     * Shuffle array deterministically
     */
    shuffle(array, component = "default") {
        const shuffled = [...array];
        const random = this.getSeededRandom(component);
        // Fisher-Yates shuffle with seeded random
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(random.next() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
    /**
     * Sample items deterministically
     */
    sample(array, count, component = "default") {
        if (count >= array.length)
            return [...array];
        const shuffled = this.shuffle(array, component);
        return shuffled.slice(0, count);
    }
    /**
     * Choose random item deterministically
     */
    choice(array, component = "default") {
        if (array.length === 0)
            return undefined;
        const random = this.getSeededRandom(component);
        const index = Math.floor(random.next() * array.length);
        return array[index];
    }
    /**
     * Generate random integer in range
     */
    randomInt(min, max, component = "default") {
        const random = this.getSeededRandom(component);
        return Math.floor(random.next() * (max - min + 1)) + min;
    }
    /**
     * Get current seed state for serialization
     */
    getSeedState() {
        return { ...this.seedState };
    }
    /**
     * Restore from seed state
     */
    static fromSeedState(seedState) {
        const manager = new SeedManager(seedState.global_seed, seedState.run_id);
        manager.seedState = { ...seedState };
        return manager;
    }
    /**
     * Create deterministic environment variable setup
     */
    getEnvironmentSeeds() {
        return {
            SEED_GLOBAL: this.seedState.global_seed.toString(),
            SEED_BATCH_SAMPLING: this.getSeedForComponent("batch_sampling").toString(),
            SEED_DIVERSITY: this.getSeedForComponent("diversity_sampling").toString(),
            SEED_RETRIEVER: this.getSeedForComponent("retriever_tiebreak").toString(),
            SEED_AGENT_SELECTION: this.getSeedForComponent("agent_selection").toString(),
            SEED_QA_GENERATION: this.getSeedForComponent("question_generation").toString(),
            SEED_LLM_TEMPERATURE: this.getSeedForComponent("llm_temperature").toString(),
        };
    }
    /**
     * Apply seeds to process environment
     */
    applyToEnvironment() {
        const envSeeds = this.getEnvironmentSeeds();
        for (const [key, value] of Object.entries(envSeeds)) {
            process.env[key] = value;
        }
        console.log(`🎲 Applied seeds to environment: global=${this.seedState.global_seed}`);
    }
    /**
     * Generate a new random seed
     */
    generateSeed() {
        return Math.floor(Math.random() * 1000000);
    }
    /**
     * Create a seeded random configuration for LLM calls
     */
    getLLMRandomConfig(component = "llm_temperature") {
        const seed = this.getSeedForComponent(component);
        // Derive temperature and other random parameters from seed
        const baseTemp = 0.1 + (seed % 100) / 1000; // 0.1 to 0.199
        return {
            temperature: Math.round(baseTemp * 1000) / 1000, // Round to 3 decimal places
            seed: seed,
            // Note: Different LLM providers handle seeding differently
            // This provides a consistent interface regardless of provider
        };
    }
    /**
     * Get consistent retry delays for exponential backoff
     */
    getRetryDelay(attempt, baseMs = 1000, component = "retry_delay") {
        const random = this.getSeededRandom(component);
        const jitter = 0.1 + random.next() * 0.1; // 10% to 20% jitter
        return Math.floor(baseMs * Math.pow(2, attempt) * jitter);
    }
    /**
     * Get current seed state
     */
    getCurrentSeed() {
        return this.seedState.global_seed;
    }
}
/**
 * Seeded Random Number Generator
 * Provides deterministic random sequences for specific components
 */
export class SeededRandom {
    seed;
    current;
    constructor(seed) {
        this.seed = seed;
        this.current = seed;
    }
    /**
     * Get next random value [0, 1)
     */
    next() {
        // Linear congruential generator
        const a = 1664525;
        const c = 1013904223;
        const m = Math.pow(2, 32);
        this.current = (a * this.current + c) % m;
        return this.current / m;
    }
    /**
     * Get random integer in range [min, max]
     */
    nextInt(min, max) {
        return Math.floor(this.next() * (max - min + 1)) + min;
    }
    /**
     * Get random float in range [min, max)
     */
    nextFloat(min = 0, max = 1) {
        return min + this.next() * (max - min);
    }
    /**
     * Get random boolean with given probability
     */
    nextBoolean(probability = 0.5) {
        return this.next() < probability;
    }
    /**
     * Reset to original seed
     */
    reset() {
        this.current = this.seed;
    }
    /**
     * Get current seed value
     */
    getSeed() {
        return this.seed;
    }
}
/**
 * Global seed manager instance
 */
let globalSeedManager = null;
/**
 * Initialize global seed manager
 */
export function initializeSeedManager(seed, runId) {
    globalSeedManager = new SeedManager(seed, runId);
    globalSeedManager.applyToEnvironment();
    return globalSeedManager;
}
/**
 * Get global seed manager (throws if not initialized)
 */
export function getSeedManager() {
    if (!globalSeedManager) {
        throw new Error("Seed manager not initialized. Call initializeSeedManager() first.");
    }
    return globalSeedManager;
}
/**
 * Get seeded random for a component (convenience function)
 */
export function getSeededRandom(component) {
    return getSeedManager().getSeededRandom(component);
}
/**
 * Deterministic sampling utilities
 */
export const SeededUtils = {
    /**
     * Deterministic shuffle
     */
    shuffle: (array, component = "default") => {
        return getSeedManager().shuffle(array, component);
    },
    /**
     * Deterministic sample
     */
    sample: (array, count, component = "default") => {
        return getSeedManager().sample(array, count, component);
    },
    /**
     * Deterministic choice
     */
    choice: (array, component = "default") => {
        return getSeedManager().choice(array, component);
    },
    /**
     * Deterministic random integer
     */
    randomInt: (min, max, component = "default") => {
        return getSeedManager().randomInt(min, max, component);
    },
    /**
     * Create diversity sampling strategy
     */
    createDiversitySampler: (items, targetDistribution, component = "diversity_sampling") => {
        const random = getSeededRandom(component);
        return {
            sample: (count) => {
                // Implement weighted sampling based on target distribution
                const shuffled = [...items].sort(() => random.next() - 0.5);
                // Apply distribution weights (simplified implementation)
                const weighted = shuffled.slice(0, count);
                return weighted;
            },
        };
    },
};
/**
 * Integration helpers for existing codebase
 */
export const SeedIntegration = {
    /**
     * Patch Math.random for specific scopes (use carefully)
     */
    patchMathRandom: (component, fn) => {
        const originalRandom = Math.random;
        const seededRandom = getSeededRandom(component);
        try {
            Math.random = () => seededRandom.next();
            return fn();
        }
        finally {
            Math.random = originalRandom;
        }
    },
    /**
     * Get deterministic Array.prototype.sort comparator
     */
    createDeterministicSort: (component = "array_sort") => {
        const random = getSeededRandom(component);
        return (a, b) => {
            // For equal items, use deterministic tiebreaker
            if (a === b)
                return 0;
            // Use hash of stringified values for consistent ordering
            const hashA = SeedIntegration.hashString(JSON.stringify(a));
            const hashB = SeedIntegration.hashString(JSON.stringify(b));
            if (hashA === hashB) {
                // Final tiebreaker using seeded random
                return random.next() - 0.5;
            }
            return hashA - hashB;
        };
    },
    /**
     * Simple string hash function
     */
    hashString: (str) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash;
    },
};
//# sourceMappingURL=seed_manager.js.map