import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config.ts";

export default defineConfig((env) =>
  mergeConfig(typeof viteConfig === "function" ? viteConfig(env) : viteConfig, {
    test: {
      environment: "jsdom",
      // Absolute API base so requests are valid URLs for MSW under Node's fetch.
      env: { VITE_API_BASE: "http://launchops.test" },
      setupFiles: ["./src/test/setup.ts"],
      // App-level tests drive real pages through several steps; slow CI runners need headroom.
      testTimeout: 30_000,
      include: ["src/**/*.test.{ts,tsx}"],
      css: { modules: { classNameStrategy: "non-scoped" } },
      coverage: {
        provider: "v8",
        include: ["src/**/*.{ts,tsx}"],
        exclude: ["src/**/*.test.{ts,tsx}", "src/test/**", "src/main.tsx", "src/**/*.d.ts"],
        reporter: ["text-summary", "text"],
        // The deploy gate from the project constitution (the PR gate is 85%).
        thresholds: { lines: 95 },
      },
    },
  }),
);
