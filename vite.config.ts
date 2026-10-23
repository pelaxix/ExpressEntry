import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [
    react(),
    {
      name: "local-api",
      async configureServer() {
        process.env.DATA_DIR ||= process.cwd() + "/.local-data";
        process.env.DEV_ORIGIN = "http://terminal.local:4173";
        await import("./server/index.mjs");
      },
    },
  ],
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
    proxy: { "/api": "http://127.0.0.1:31007" },
  },
  build: {
    outDir: "dist",
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "react-runtime",
              test: /node_modules[\\/](?:react|react-dom|scheduler)(?:[\\/]|$)/,
              priority: 20,
            },
            {
              name: "vendor",
              test: /node_modules/,
              priority: 10,
            },
          ],
        },
      },
    },
  },
});
