import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vinext from "vinext";
import { defineConfig } from "vite";

// Cloudflare deploys (scripts/deploy-cloudflare.mjs) point SHIKKHA_DEPLOY at deploy/cloudflare.json,
// which supplies the real Worker name, database IDs and settings. Local builds keep placeholders.
const deployConfig = process.env.SHIKKHA_DEPLOY
  ? JSON.parse(readFileSync(process.env.SHIKKHA_DEPLOY, "utf8"))
  : null;

// Local bindings. Keep the database name and ID unchanged: the local database in
// ../.shikkha-dev-state is filed under them, so changing them starts both sites from empty.
const localBindingConfig = {
  main: "./build/worker.ts",
  compatibility_flags: ["nodejs_compat"],
  d1_databases: [
    {
      binding: "DB",
      database_name: "site-creator-d1",
      database_id: "00000000-0000-4000-8000-000000000000",
    },
  ],
  // Same local bucket as the admin, so worksheets uploaded in the local admin open here.
  r2_buckets: [{ binding: "BUCKET", bucket_name: "site-creator-r2" }],
  ai: { binding: "AI" },
};

export default defineConfig(async ({ command }) => {
  // Use Miniflare's local Request.cf placeholder unless fetching is requested.
  process.env.CLOUDFLARE_CF_FETCH_ENABLED ??= "false";
  process.env.WRANGLER_SEND_METRICS ??= "false";

  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in the ignored `.dev.vars` file.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.WRANGLER_REGISTRY_PATH ??= ".wrangler/dev-registry";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    plugins: [
      vinext(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false,
        // Local dev: the admin and the website share one database, as they do on Cloudflare.
        persistState: {
          path: process.env.SHIKKHA_DEV_STATE ??
            fileURLToPath(new URL("../.shikkha-dev-state", import.meta.url)),
        },
        config: {
          ...localBindingConfig,
          ...(command === "build" && deployConfig ? deployConfig : {}),
        },
      }),
    ],
  };
});
