/**
 * Secrets Manager - Secure handling of sensitive configuration
 * Provides abstraction layer for different secret management solutions
 */
export class SecretsManager {
    config;
    cache = new Map();
    constructor(config) {
        this.config = config;
    }
    /**
     * Get secret value with caching and rotation support
     */
    async getSecret(key) {
        // Check cache first
        const cached = this.cache.get(key);
        if (cached && (!cached.expiresAt || cached.expiresAt > new Date())) {
            return this.maskSecretInLogs(cached.value);
        }
        // Fetch from provider
        let value;
        switch (this.config.provider) {
            case "env":
                value = this.getFromEnvironment(key);
                break;
            case "github-secrets":
                value = this.getFromGitHubSecrets(key);
                break;
            case "aws-secrets":
                value = await this.getFromAWSSecrets(key);
                break;
            case "azure-keyvault":
                value = await this.getFromAzureKeyVault(key);
                break;
            case "hashicorp-vault":
                value = await this.getFromHashiCorpVault(key);
                break;
            default:
                throw new Error(`Unsupported secret provider: ${this.config.provider}`);
        }
        if (!value) {
            throw new Error(`Secret not found: ${key}`);
        }
        // Cache the secret
        this.cache.set(key, {
            value,
            expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes cache
        });
        return value;
    }
    /**
     * Mask secret in logs and error messages
     */
    maskSecretInLogs(secret) {
        if (secret.length <= 8) {
            return "***MASKED***";
        }
        // Show first 3 and last 3 characters for debugging
        return `${secret.substring(0, 3)}***${secret.substring(secret.length - 3)}`;
    }
    /**
     * Get secret from environment variables
     */
    getFromEnvironment(key) {
        return process.env[key] || "";
    }
    /**
     * Get secret from GitHub Secrets (in CI/CD context)
     */
    getFromGitHubSecrets(key) {
        // In GitHub Actions, secrets are available as environment variables
        return process.env[key] || "";
    }
    /**
     * Get secret from AWS Secrets Manager
     */
    async getFromAWSSecrets(key) {
        try {
            // AWS SDK implementation would go here
            // For now, fallback to environment
            return this.getFromEnvironment(key);
        }
        catch (error) {
            console.error(`Failed to fetch secret from AWS Secrets Manager: ${key}`, error);
            throw error;
        }
    }
    /**
     * Get secret from Azure Key Vault
     */
    async getFromAzureKeyVault(key) {
        try {
            // Azure SDK implementation would go here
            // For now, fallback to environment
            return this.getFromEnvironment(key);
        }
        catch (error) {
            console.error(`Failed to fetch secret from Azure Key Vault: ${key}`, error);
            throw error;
        }
    }
    /**
     * Get secret from HashiCorp Vault
     */
    async getFromHashiCorpVault(key) {
        try {
            // HashiCorp Vault implementation would go here
            // For now, fallback to environment
            return this.getFromEnvironment(key);
        }
        catch (error) {
            console.error(`Failed to fetch secret from HashiCorp Vault: ${key}`, error);
            throw error;
        }
    }
    /**
     * Rotate a secret (if supported by provider)
     */
    async rotateSecret(key) {
        // Implementation depends on provider
        console.log(`Secret rotation requested for: ${key}`);
        // Clear cache to force refresh
        this.cache.delete(key);
    }
    /**
     * Validate that all required secrets are available
     */
    async validateSecrets(requiredKeys) {
        const missing = [];
        for (const key of requiredKeys) {
            try {
                const value = await this.getSecret(key);
                if (!value ||
                    value.includes("your_") ||
                    value.includes("placeholder")) {
                    missing.push(key);
                }
            }
            catch (error) {
                missing.push(key);
            }
        }
        return {
            valid: missing.length === 0,
            missing,
        };
    }
    /**
     * Clear all cached secrets
     */
    clearCache() {
        this.cache.clear();
    }
    /**
     * Get secret metadata (without value)
     */
    getSecretMetadata(key) {
        const cached = this.cache.get(key);
        return {
            exists: Boolean(this.getFromEnvironment(key)),
            cached: Boolean(cached),
            expiresAt: cached?.expiresAt,
        };
    }
}
/**
 * Global secrets manager instance
 */
let secretsManager;
/**
 * Initialize secrets manager with configuration
 */
export function initializeSecretsManager(config) {
    if (!secretsManager) {
        const defaultConfig = {
            provider: process.env.SECRETS_PROVIDER || "env",
            region: process.env.AWS_REGION || "us-east-1",
            vaultUrl: process.env.VAULT_URL,
            authToken: process.env.VAULT_TOKEN,
        };
        secretsManager = new SecretsManager(config || defaultConfig);
    }
    return secretsManager;
}
/**
 * Get the global secrets manager instance
 */
export function getSecretsManager() {
    if (!secretsManager) {
        throw new Error("Secrets manager not initialized. Call initializeSecretsManager() first.");
    }
    return secretsManager;
}
/**
 * Convenience function to get a secret
 */
export async function getSecret(key) {
    const manager = getSecretsManager();
    return manager.getSecret(key);
}
/**
 * Convenience function to validate secrets
 */
export async function validateRequiredSecrets(keys) {
    const manager = getSecretsManager();
    const validation = await manager.validateSecrets(keys);
    if (!validation.valid) {
        throw new Error(`Missing required secrets: ${validation.missing.join(", ")}`);
    }
}
/**
 * Environment-specific secret keys
 */
export const SECRET_KEYS = {
    // AI Services
    ANTHROPIC_API_KEY: "ANTHROPIC_API_KEY",
    OPENAI_API_KEY: "OPENAI_API_KEY",
    // Database
    DB_PASSWORD: "DB_PASSWORD",
    DB_USER: "DB_USER",
    // Security
    JWT_SECRET: "JWT_SECRET",
    ENCRYPTION_KEY: "ENCRYPTION_KEY",
    // External Services
    SENTRY_DSN: "SENTRY_DSN",
    DATADOG_API_KEY: "DATADOG_API_KEY",
    // Infrastructure
    REDIS_PASSWORD: "REDIS_PASSWORD",
    AWS_ACCESS_KEY_ID: "AWS_ACCESS_KEY_ID",
    AWS_SECRET_ACCESS_KEY: "AWS_SECRET_ACCESS_KEY",
};
/**
 * Required secrets for each environment
 */
export const REQUIRED_SECRETS = {
    development: [SECRET_KEYS.ANTHROPIC_API_KEY],
    staging: [
        SECRET_KEYS.ANTHROPIC_API_KEY,
        SECRET_KEYS.DB_PASSWORD,
        SECRET_KEYS.JWT_SECRET,
        SECRET_KEYS.SENTRY_DSN,
    ],
    production: [
        SECRET_KEYS.ANTHROPIC_API_KEY,
        SECRET_KEYS.DB_PASSWORD,
        SECRET_KEYS.JWT_SECRET,
        SECRET_KEYS.ENCRYPTION_KEY,
        SECRET_KEYS.SENTRY_DSN,
        SECRET_KEYS.DATADOG_API_KEY,
    ],
};
//# sourceMappingURL=secretsManager.js.map