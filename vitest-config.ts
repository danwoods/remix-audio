import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./test/setup.ts"], // Optional: if you want to add global setup
    include: ["app/**/*.{test,spec}.{js,ts}"],
    exclude: [
      "server/**/*",
      "**/node_modules/**",
      "**/server/**/*.test.ts",
      "**/server/**/*.spec.ts",
    ],
  },
});
