#!/usr/bin/env tsx

/**
 * Python Embedding Integration Test
 *
 * Tests the complete Python bridge workflow:
 * 1. Python environment detection
 * 2. Virtual environment setup
 * 3. Dependency installation
 * 4. Process management
 * 5. Embedding generation
 */

import { Logger } from "../src/shared/logger.js";
import { PythonEnvironmentManager } from "../src/rag/python-env-manager.js";
import { PythonProcessManager } from "../src/rag/python-process-manager.js";

async function test() {
  console.log("🧪 Python Embedding Bridge Integration Test");
  console.log("═".repeat(60));

  const logger = new Logger();

  try {
    // Step 1: Environment Detection
    console.log("\n📋 Step 1: Detecting Python environment...");
    const envManager = new PythonEnvironmentManager(logger);

    const env = await envManager.setup();

    if (!env.available) {
      console.log("❌ Python not found on system");
      console.log("💡 Please install Python 3.8+ to use local embeddings");
      console.log("   Fallback to mock embeddings will be used");
      process.exit(0);
    }

    console.log(`✅ Python found: ${env.version}`);
    console.log(`   Path: ${env.pythonPath}`);
    console.log(`   Venv: ${env.venvPath || "(none)"}`);

    // Step 2: Dependency Check
    console.log("\n📦 Step 2: Checking dependencies...");
    if (!env.dependenciesInstalled) {
      console.log("⚠️  sentence-transformers not installed");
      console.log(
        "💡 Installing dependencies (this may take a few minutes)...",
      );
      console.log(
        "   Note: This is a one-time setup. Future runs will be instant.",
      );
      // Installation already attempted in setup()
    } else {
      console.log("✅ All dependencies installed");
    }

    if (!env.dependenciesInstalled) {
      console.log("\n❌ Dependency installation failed");
      console.log("💡 You can manually install with:");
      console.log(`   ${env.pythonPath} -m pip install sentence-transformers`);
      process.exit(1);
    }

    // Step 3: Process Management
    console.log("\n🚀 Step 3: Starting Python embedding server...");
    const processManager = new PythonProcessManager(logger, env);

    await processManager.start();
    console.log("✅ Python process started");

    // Step 4: Ping Test
    console.log("\n🏓 Step 4: Testing process communication...");
    const pongReceived = await processManager.ping();

    if (!pongReceived) {
      console.log("❌ Process ping failed");
      process.exit(1);
    }

    console.log("✅ Process communication working");

    // Step 5: Embedding Generation
    console.log("\n🔢 Step 5: Generating embeddings...");
    const testTexts = [
      "This is a test sentence for embedding generation.",
      "Another test sentence with different content.",
      "The quick brown fox jumps over the lazy dog.",
    ];

    console.log(`   Testing with ${testTexts.length} texts...`);

    const start = Date.now();
    const embeddings = await processManager.embed(
      testTexts,
      "all-MiniLM-L6-v2",
    );
    const duration = Date.now() - start;

    console.log(`✅ Embeddings generated in ${duration}ms`);
    console.log(`   Shape: ${embeddings.length} x ${embeddings[0].length}`);
    console.log(`   Dimensions: ${embeddings[0].length}`);

    // Verify embeddings
    if (embeddings.length !== testTexts.length) {
      console.log("❌ Wrong number of embeddings returned");
      process.exit(1);
    }

    if (embeddings[0].length < 300 || embeddings[0].length > 400) {
      console.log("❌ Unexpected embedding dimensions");
      process.exit(1);
    }

    // Check that embeddings are different (not all zeros or same values)
    const emb1Sum = embeddings[0].reduce((a, b) => a + b, 0);
    const emb2Sum = embeddings[1].reduce((a, b) => a + b, 0);

    if (Math.abs(emb1Sum - emb2Sum) < 0.01) {
      console.log("❌ Embeddings appear to be identical (may be zeros)");
      process.exit(1);
    }

    console.log("✅ Embeddings validated");

    // Step 6: Cleanup
    console.log("\n🧹 Step 6: Shutting down process...");
    await processManager.shutdown();
    console.log("✅ Process shut down cleanly");

    // Success!
    console.log("\n" + "═".repeat(60));
    console.log("✅ ALL TESTS PASSED");
    console.log("\n💡 Local embedding generation is fully operational!");
    console.log(
      "   You can now use provider: 'local' in your embedding config",
    );
    console.log("\n📊 Performance:");
    console.log(`   ${testTexts.length} embeddings in ${duration}ms`);
    console.log(
      `   ~${Math.round(duration / testTexts.length)}ms per embedding`,
    );
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    console.error("\nStack trace:");
    console.error(error instanceof Error ? error.stack : String(error));
    process.exit(1);
  }
}

test().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
