#!/usr/bin/env node

/**
 * JSON Schema Validator for .gaprc.json
 *
 * Uses Ajv to validate .gaprc.json against schema
 */

import Ajv from "ajv";
import addFormats from "ajv-formats";
import { readFile } from "fs/promises";
import { existsSync } from "fs";

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

export class SchemaValidator {
  private ajv: Ajv;

  constructor() {
    this.ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(this.ajv); // Add format validators (email, uri, etc.)
  }

  async validateGaprc(
    configPath = ".gaprc.json",
    schemaPath = "schema/gaprc.schema.json",
  ): Promise<ValidationResult> {
    // Check files exist
    if (!existsSync(configPath)) {
      return {
        valid: false,
        errors: [`Configuration file not found: ${configPath}`],
      };
    }

    if (!existsSync(schemaPath)) {
      return {
        valid: false,
        errors: [`Schema file not found: ${schemaPath}`],
      };
    }

    try {
      // Load schema and config
      const schemaContent = await readFile(schemaPath, "utf-8");
      const configContent = await readFile(configPath, "utf-8");

      const schema = JSON.parse(schemaContent);
      const config = JSON.parse(configContent);

      // Compile schema
      const validate = this.ajv.compile(schema);

      // Validate
      const valid = validate(config);

      if (!valid && validate.errors) {
        const errors = validate.errors.map((err) => {
          const path = err.instancePath || "root";
          return `${path}: ${err.message}`;
        });

        return { valid: false, errors };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        errors: [
          error instanceof Error ? error.message : "Unknown validation error",
        ],
      };
    }
  }

  async validateAndThrow(
    configPath?: string,
    schemaPath?: string,
  ): Promise<void> {
    const result = await this.validateGaprc(configPath, schemaPath);

    if (!result.valid) {
      const errorMessage = result.errors?.join("\n") || "Validation failed";
      throw new Error(`Schema validation failed:\n${errorMessage}`);
    }
  }
}

// CLI
async function main() {
  const args = process.argv.slice(2);
  const configPath = args[0] || ".gaprc.json";
  const schemaPath = args[1] || "schema/gaprc.schema.json";

  const validator = new SchemaValidator();
  const result = await validator.validateGaprc(configPath, schemaPath);

  if (result.valid) {
    console.log("✅ Validation passed");
    process.exit(0);
  } else {
    console.error("❌ Validation failed:");
    for (const error of result.errors || []) {
      console.error(`   ${error}`);
    }
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
