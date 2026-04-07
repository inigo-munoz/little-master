import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    env: {
      BACKEND_URL: "http://127.0.0.1:3001",
      NODE_ENV: "test",
    },
  },
});
