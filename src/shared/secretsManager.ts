/**
 * Secrets Manager - Secure handling of sensitive configuration
 * Provides abstraction layer for different secret management solutions
 */

export interface SecretConfig {
  provider:
    | "env"
    | "github-secrets"
    | "aws-secrets"
    | "azure-keyvault"
    | "hashicorp-vault";
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

export class SecretsManager {
  private config: SecretConfig;
  private cache: Map<string, { value: string; expiresAt?: Date }> = new Map();

  constructor(config: SecretConfig) {
    this.config = config;
  }

  /**
   * Get secret value with caching and rotation support
   */
  async getSecret(key: string): Promise<string> {
    // Check cache first
    const cached = this.cache.get(key);
    if (cached && (!cached.expiresAt || cached.expiresAt > new Date())) {
      return this.maskSecretInLogs(cached.value);
    }

    // Fetch from provider
    let value: string;

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
  private maskSecretInLogs(secret: string): string {
    if (secret.length <= 8) {
      return "***MASKED***";
    }

    // Show first 3 and last 3 characters for debugging
    return `${secret.substring(0, 3)}***${secret.substring(secret.length - 3)}`;
  }

  /**
   * Get secret from environment variables
   */
  private getFromEnvironment(key: string): string {
    return process.env[key] || "";
  }

  /**
   * Get secret from GitHub Secrets (in CI/CD context)
   */
  private getFromGitHubSecrets(key: string): string {
    // In GitHub Actions, secrets are available as environment variables
    return process.env[key] || "";
  }

  /**
   * Get secret from AWS Secrets Manager
   */
  private async getFromAWSSecrets(key: string): Promise<string> {
    try {
      // AWS SDK implementation would go here
      // For now, fallback to environment
      return this.getFromEnvironment(key);
    } catch (error) {
      console.error(
        `Failed to fetch secret from AWS Secrets Manager: ${key}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get secret from Azure Key Vault
   */
  private async getFromAzureKeyVault(key: string): Promise<string> {
    try {
      // Azure SDK implementation would go here
      // For now, fallback to environment
      return this.getFromEnvironment(key);
    } catch (error) {
      console.error(
        `Failed to fetch secret from Azure Key Vault: ${key}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get secret from HashiCorp Vault
   */
  private async getFromHashiCorpVault(key: string): Promise<string> {
    try {
      // HashiCorp Vault implementation would go here
      // For now, fallback to environment
      return this.getFromEnvironment(key);
    } catch (error) {
      console.error(
        `Failed to fetch secret from HashiCorp Vault: ${key}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Rotate a secret (if supported by provider)
   */
  async rotateSecret(key: string): Promise<void> {
    // Implementation depends on provider
    console.log(`Secret rotation requested for: ${key}`);

    // Clear cache to force refresh
    this.cache.delete(key);
  }

  /**
   * Validate that all required secrets are available
   */
  async validateSecrets(
    requiredKeys: string[],
  ): Promise<{ valid: boolean; missing: string[] }> {
    const missing: string[] = [];

    for (const key of requiredKeys) {
      try {
        const value = await this.getSecret(key);
        if (
          !value ||
          value.includes("your_") ||
          value.includes("placeholder")
        ) {
          missing.push(key);
        }
      } catch {
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
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get secret metadata (without value)
   */
  getSecretMetadata(key: string): {
    exists: boolean;
    cached: boolean;
    expiresAt?: Date;
  } {
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
let secretsManager: SecretsManager;

/**
 * Initialize secrets manager with configuration
 */
export function initializeSecretsManager(
  config?: SecretConfig,
): SecretsManager {
  if (!secretsManager) {
    const defaultConfig: SecretConfig = {
      provider: (process.env.SECRETS_PROVIDER as any) || "env",
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
export function getSecretsManager(): SecretsManager {
  if (!secretsManager) {
    throw new Error(
      "Secrets manager not initialized. Call initializeSecretsManager() first.",
    );
  }

  return secretsManager;
}

/**
 * Convenience function to get a secret
 */
export async function getSecret(key: string): Promise<string> {
  const manager = getSecretsManager();
  return manager.getSecret(key);
}

/**
 * Convenience function to validate secrets
 */
export async function validateRequiredSecrets(keys: string[]): Promise<void> {
  const manager = getSecretsManager();
  const validation = await manager.validateSecrets(keys);

  if (!validation.valid) {
    throw new Error(
      `Missing required secrets: ${validation.missing.join(", ")}`,
    );
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
} as const;

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
} as const;
