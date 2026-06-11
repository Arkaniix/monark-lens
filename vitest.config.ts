import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Node 20 fournit WebCrypto (crypto.subtle), URL, TextEncoder, atob/btoa en global
    // -> l'env node suffit pour adhash + auth-logic (pas de DOM nécessaire).
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
