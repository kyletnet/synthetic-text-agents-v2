#!/usr/bin/env tsx
/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 *
 * Report Encryption - Security Simulation Results
 *
 * Purpose:
 * - Encrypt sensitive Red-Team Drill results
 * - Protect internal security simulation logs
 * - Secure storage of penetration test findings
 *
 * Usage:
 *   npm run report:encrypt <input-file> [output-file]
 *   npm run report:decrypt <input-file> [output-file]
 *
 * Example:
 *   npm run report:encrypt reports/phase0-drill.json
 *   npm run report:decrypt reports/phase0-drill.json.enc
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";
import { basename } from "path";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

/**
 * Derive encryption key from passphrase
 */
function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return scryptSync(passphrase, salt, KEY_LENGTH);
}

/**
 * Encrypt file
 */
function encryptFile(inputPath: string, outputPath: string, passphrase: string) {
  console.log(`🔐 Encrypting: ${basename(inputPath)}`);

  // Read input file
  const plaintext = readFileSync(inputPath);

  // Generate random salt and IV
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);

  // Derive key from passphrase
  const key = deriveKey(passphrase, salt);

  // Create cipher
  const cipher = createCipheriv(ALGORITHM, key, iv);

  // Encrypt
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);

  // Get auth tag
  const authTag = cipher.getAuthTag();

  // Combine: salt (32) + iv (16) + authTag (16) + encrypted data
  const output = Buffer.concat([salt, iv, authTag, encrypted]);

  // Write encrypted file
  writeFileSync(outputPath, output);

  console.log(`✅ Encrypted file created: ${basename(outputPath)}`);
  console.log(`   Size: ${plaintext.length} → ${output.length} bytes`);
  console.log(`   Algorithm: ${ALGORITHM}`);
}

/**
 * Decrypt file
 */
function decryptFile(inputPath: string, outputPath: string, passphrase: string) {
  console.log(`🔓 Decrypting: ${basename(inputPath)}`);

  // Read encrypted file
  const encrypted = readFileSync(inputPath);

  // Extract components
  const salt = encrypted.subarray(0, SALT_LENGTH);
  const iv = encrypted.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = encrypted.subarray(
    SALT_LENGTH + IV_LENGTH,
    SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
  );
  const ciphertext = encrypted.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

  // Derive key from passphrase
  const key = deriveKey(passphrase, salt);

  // Create decipher
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  // Decrypt
  try {
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    // Write decrypted file
    writeFileSync(outputPath, decrypted);

    console.log(`✅ Decrypted file created: ${basename(outputPath)}`);
    console.log(`   Size: ${encrypted.length} → ${decrypted.length} bytes`);
  } catch (error) {
    console.error(`❌ Decryption failed: Invalid passphrase or corrupted file`);
    process.exit(1);
  }
}

/**
 * Main execution
 */
function main() {
  const args = process.argv.slice(2);
  const mode = process.env.npm_lifecycle_event || "";

  if (args.length === 0) {
    console.log("╔════════════════════════════════════════════════════════════╗");
    console.log("║         Report Encryption - Security Tool                 ║");
    console.log("╚════════════════════════════════════════════════════════════╝\n");
    console.log("Usage:");
    console.log("  npm run report:encrypt <input-file> [output-file]");
    console.log("  npm run report:decrypt <input-file> [output-file]\n");
    console.log("Examples:");
    console.log("  npm run report:encrypt reports/phase0-drill.json");
    console.log("  npm run report:decrypt reports/phase0-drill.json.enc\n");
    console.log("Environment Variables:");
    console.log("  ENCRYPTION_PASSPHRASE - Passphrase for encryption/decryption");
    console.log("                         (Required, no default)\n");
    process.exit(1);
  }

  const inputPath = args[0];

  if (!existsSync(inputPath)) {
    console.error(`❌ Input file not found: ${inputPath}`);
    process.exit(1);
  }

  // Get passphrase from environment
  const passphrase = process.env.ENCRYPTION_PASSPHRASE;

  if (!passphrase || passphrase.length < 16) {
    console.error("❌ ENCRYPTION_PASSPHRASE environment variable required");
    console.error("   Must be at least 16 characters long");
    console.error("\n   Example:");
    console.error("   export ENCRYPTION_PASSPHRASE='your-secure-passphrase-here'");
    process.exit(1);
  }

  // Determine operation mode
  const isDecrypt = mode.includes("decrypt");
  const outputPath =
    args[1] ||
    (isDecrypt
      ? inputPath.replace(/\.enc$/, "")
      : inputPath + ".enc");

  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║         Report Encryption - Security Tool                 ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  if (isDecrypt) {
    decryptFile(inputPath, outputPath, passphrase);
  } else {
    encryptFile(inputPath, outputPath, passphrase);
  }

  console.log("\n✅ Operation complete\n");
}

main();
