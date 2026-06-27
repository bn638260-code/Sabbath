import path from "path"
import { defineConfig, configDefaults } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    include: [
      "src/**/*.{test,spec}.{ts,tsx}",
      "web/app/**/*.{test,spec}.{ts,tsx}",
    ],
    exclude: [...configDefaults.exclude, "tests/e2e/**"],
    setupFiles: ["./src/test/setup.ts"],
    testTimeout: 10000,
    hookTimeout: 20000,
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "text", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/data/**", // generated hymnal data, no logic
        "src/test/**",
        "**/*.test.{ts,tsx}",
        "**/*.d.ts",
        "src/main.tsx",
        "src/broadcast-output.tsx",
      ],
      // Regression floor over ALL src files (include: src/**), set just below the
      // 2026-06-18 baseline (stmts 39.6% / branch 33.5% / funcs 37.3% / lines 40.8%).
      // Ratchet upward as the R4/R6/R13 refactors add tests.
      thresholds: {
        statements: 36,
        branches: 30,
        functions: 34,
        lines: 37,
      },
    },
  },
})
