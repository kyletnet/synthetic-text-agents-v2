import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    // Test environment
    environment: "node",

    // Global test setup
    globals: true,

    // Test file patterns
    include: ["tests/**/*.{test,spec}.{js,ts}", "src/**/*.{test,spec}.{js,ts}"],

    // Exclude patterns
    exclude: [
      "node_modules/**",
      "dist/**",
      "build/**",
      "coverage/**",
      "apps/fe-web/node_modules/**",
      "legacy/**",
    ],

    // Test timeout
    testTimeout: 30000,

    // Coverage configuration
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json", "lcov"],
      reportsDirectory: "./coverage",

      // Coverage thresholds
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },

      // Include/exclude patterns for coverage
      include: [
        "src/**/*.{js,ts}",
        "!src/**/*.{test,spec}.{js,ts}",
        "!src/**/*.d.ts",
      ],

      exclude: [
        "node_modules/**",
        "tests/**",
        "dist/**",
        "coverage/**",
        "legacy/**",
        "scripts/**",
        "**/*.config.{js,ts}",
        "**/*.d.ts",
      ],

      // Exclude specific files from coverage
      excludeAfterRemap: true,
    },

    // Setup files
    setupFiles: ["./tests/setup.ts"],

    // Reporters (removing ui dependency issue)
    reporter: ["verbose", "html", "json"],
    outputFile: {
      html: "./test-results/index.html",
      json: "./test-results/results.json",
    },

    // Parallel execution
    pool: "threads",
    poolOptions: {
      threads: {
        minThreads: 1,
        maxThreads: 4,
      },
    },

    // Watch mode options
    watch: false,

    // Mock options
    clearMocks: true,
    restoreMocks: true,

    // Retry failed tests
    retry: 1,

    // Bail on first failure in CI
    bail: process.env.CI ? 1 : 0,
  },

  // Resolve configuration
  resolve: {
    alias: {
      // Order matters: more specific paths must come first
      "@/lib": path.resolve(__dirname, "./apps/fe-web/lib"),
      "@/app": path.resolve(__dirname, "./apps/fe-web/app"),
      "@": path.resolve(__dirname, "./src"),
      "@tests": path.resolve(__dirname, "./tests"),
      "@shared": path.resolve(__dirname, "./src/shared"),
      "@agents": path.resolve(__dirname, "./src/agents"),
      "@core": path.resolve(__dirname, "./src/core"),
    },
  },

  // Define global constants
  define: {
    "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV || "test"),
    "process.env.VITEST": JSON.stringify("true"),
  },

  // ESBuild options for decorator support
  esbuild: {
    target: "ES2022",
    keepNames: true,
  },
});
