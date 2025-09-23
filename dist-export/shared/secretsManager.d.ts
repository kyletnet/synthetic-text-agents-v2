/**
 * Secrets Manager - Secure handling of sensitive configuration
 * Provides abstraction layer for different secret management solutions
 */
export interface SecretConfig {
    provider: "env" | "github-secrets" | "aws-secrets" | "azure-keyvault" | "hashicorp-vault";
    region?: string;
    vaultUrl?: string;
    authToken?: string;
}
export interface Secret {
    key: string;
    value: string;
    expiresAt?: Date;
    rotationSchedule?: string;
}
export declare class SecretsManager {
    private config;
    private cache;
    constructor(config: SecretConfig);
    /**
     * Get secret value with caching and rotation support
     */
    getSecret(key: string): Promise<string>;
    /**
     * Mask secret in logs and error messages
     */
    private maskSecretInLogs;
    /**
     * Get secret from environment variables
     */
    private getFromEnvironment;
    /**
     * Get secret from GitHub Secrets (in CI/CD context)
     */
    private getFromGitHubSecrets;
    /**
     * Get secret from AWS Secrets Manager
     */
    private getFromAWSSecrets;
    /**
     * Get secret from Azure Key Vault
     */
    private getFromAzureKeyVault;
    /**
     * Get secret from HashiCorp Vault
     */
    private getFromHashiCorpVault;
    /**
     * Rotate a secret (if supported by provider)
     */
    rotateSecret(key: string): Promise<void>;
    /**
     * Validate that all required secrets are available
     */
    validateSecrets(requiredKeys: string[]): Promise<{
        valid: boolean;
        missing: string[];
    }>;
    /**
     * Clear all cached secrets
     */
    clearCache(): void;
    /**
     * Get secret metadata (without value)
     */
    getSecretMetadata(key: string): {
        exists: boolean;
        cached: boolean;
        expiresAt?: Date;
    };
}
/**
 * Initialize secrets manager with configuration
 */
export declare function initializeSecretsManager(config?: SecretConfig): SecretsManager;
/**
 * Get the global secrets manager instance
 */
export declare function getSecretsManager(): SecretsManager;
/**
 * Convenience function to get a secret
 */
export declare function getSecret(key: string): Promise<string>;
/**
 * Convenience function to validate secrets
 */
export declare function validateRequiredSecrets(keys: string[]): Promise<void>;
/**
 * Environment-specific secret keys
 */
export declare const SECRET_KEYS: {
    readonly ANTHROPIC_API_KEY: "ANTHROPIC_API_KEY";
    readonly OPENAI_API_KEY: "OPENAI_API_KEY";
    readonly DB_PASSWORD: "DB_PASSWORD";
    readonly DB_USER: "DB_USER";
    readonly JWT_SECRET: "JWT_SECRET";
    readonly ENCRYPTION_KEY: "ENCRYPTION_KEY";
    readonly SENTRY_DSN: "SENTRY_DSN";
    readonly DATADOG_API_KEY: "DATADOG_API_KEY";
    readonly REDIS_PASSWORD: "REDIS_PASSWORD";
    readonly AWS_ACCESS_KEY_ID: "AWS_ACCESS_KEY_ID";
    readonly AWS_SECRET_ACCESS_KEY: "AWS_SECRET_ACCESS_KEY";
};
/**
 * Required secrets for each environment
 */
export declare const REQUIRED_SECRETS: {
    readonly development: readonly ["ANTHROPIC_API_KEY"];
    readonly staging: readonly ["ANTHROPIC_API_KEY", "DB_PASSWORD", "JWT_SECRET", "SENTRY_DSN"];
    readonly production: readonly ["ANTHROPIC_API_KEY", "DB_PASSWORD", "JWT_SECRET", "ENCRYPTION_KEY", "SENTRY_DSN", "DATADOG_API_KEY"];
};
//# sourceMappingURL=secretsManager.d.ts.map