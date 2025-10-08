/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "domain-cannot-import-application",
      severity: "error",
      comment:
        "Domain layer MUST NOT depend on Application layer (DDD violation)",
      from: { path: "^src/domain" },
      to: { path: "^src/application" },
    },
    {
      name: "domain-cannot-import-infrastructure",
      severity: "error",
      comment:
        "Domain layer MUST NOT depend on Infrastructure layer (DDD violation)",
      from: { path: "^src/domain" },
      to: { path: "^src/infrastructure" },
    },
    {
      name: "application-cannot-import-infrastructure-details",
      severity: "warn",
      comment: "Application should use Infrastructure through interfaces only",
      from: { path: "^src/application" },
      to: {
        path: "^src/infrastructure",
        pathNot: "^src/infrastructure/.*/(index|.*-adapter)\\.ts$",
      },
    },
    {
      name: "no-circular-dependencies",
      severity: "error",
      comment: "Circular dependencies break modularity and testability",
      from: {},
      to: {
        circular: true,
      },
    },
    {
      name: "no-orphans",
      severity: "warn",
      comment: "Orphaned modules indicate unused code",
      from: {
        orphan: true,
        pathNot: [
          "(^|/)\\.[^/]+\\.(js|cjs|mjs|ts|json)$", // dot files
          "\\.d\\.ts$", // type declarations
          "(^|/)tsconfig\\.json$", // tsconfig
          "(^|/)(babel|webpack)\\.config\\.(js|cjs|mjs|ts|json)$", // configs
        ],
      },
      to: {},
    },
    {
      name: "no-deprecated-core",
      severity: "warn",
      comment: "Prefer the node: protocol for Node.js core modules",
      from: {},
      to: {
        dependencyTypes: ["core"],
        pathNot: "^node:",
      },
    },
  ],
  options: {
    doNotFollow: {
      path: "node_modules",
    },
    exclude: {
      path: "(^|/)(\\.git|node_modules|dist|coverage|test-results|legacy)/",
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: "tsconfig.json",
    },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
    },
    reporterOptions: {
      dot: {
        collapsePattern: "^(node_modules|packages)/[^/]+",
      },
      archi: {
        collapsePattern:
          "^(src/domain|src/application|src/infrastructure|src/shared)/[^/]+",
      },
      text: {
        highlightFocused: true,
      },
    },
  },
};
