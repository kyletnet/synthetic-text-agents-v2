#!/usr/bin/env node
import "dotenv/config";
import { Orchestrator } from "../core/orchestrator.js";
import { prewriteSessionMeta } from "../scripts/metrics/baselineReportGenerator.js";
import { initializeSystem } from "../core/systemInitializer.js";
async function main() {
    console.log("🚀 Starting Synthetic Text Agents System...\n");
    // Initialize production infrastructure first
    console.log("🔧 Initializing production infrastructure...");
    await initializeSystem();
    const orchestrator = new Orchestrator();
    try {
        await orchestrator.initialize();
        // Generate session metadata for dx system
        await prewriteSessionMeta({
            profile: "dev",
            mode: process.env.MODE || "production",
            dryRun: process.env.DRY_RUN || "false",
            casesTotal: 1,
        });
        const request = {
            topic: "초등 과학 – 물의 상태 변화",
            complexity: 7,
            domainContext: "education",
            qualityTarget: 9,
            count: 5,
        };
        console.log("📝 Processing request:", request);
        console.log("⏳ Generating high-quality Q&A pairs...\n");
        const response = await orchestrator.processRequest(request);
        console.log("✅ Results:");
        console.log(`📊 Generated ${response.questions.length} Q&A pairs`);
        console.log(`⏱️  Process time: ${response.metadata.processTime}ms`);
        console.log(`🎯 Quality score: ${response.metadata.qualityScore}/10`);
        console.log(`🤖 Agents used: ${response.metadata.agentsUsed.join(", ")}\n`);
        response.questions.slice(0, 3).forEach((qa, i) => {
            console.log(`${i + 1}. Q: ${qa.question}`);
            console.log(`   A: ${qa.answer}`);
            console.log(`   Confidence: ${qa.confidence.toFixed(2)}\n`);
        });
    }
    catch (error) {
        console.error("❌ Error:", error);
        process.exit(1);
    }
    finally {
        await orchestrator.shutdown();
        console.log("\n👋 System shutdown complete");
    }
}
// Run main if this is the entry point
if (import.meta.url === new URL(process.argv[1], "file://").href) {
    main().catch(console.error);
}
//# sourceMappingURL=main.js.map