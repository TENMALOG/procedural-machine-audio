// Deploys the static demo (../dist-demo) to Cloudflare at pma.rewrite.tw.
// Steps (from the project root): npm run build:demo, then cd deploy && npm install && npx cf deploy ../dist-demo
import { defineConfig } from "cf/config";

export default defineConfig({
  worker: {
    name: "pma-demo",
    compatibilityDate: "2026-11-01",
    // Only the custom domain; no workers.dev or preview URLs
    domains: ["pma.rewrite.tw"],
    workersDev: false,
    previewUrls: false,
  },
});
