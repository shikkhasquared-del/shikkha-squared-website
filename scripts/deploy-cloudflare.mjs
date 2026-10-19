// Builds this site with the real Cloudflare settings in deploy/cloudflare.json, then deploys it
// with the project's Wrangler. Extra arguments go to `wrangler deploy` (for example --dry-run).
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const config = "deploy/cloudflare.json";
if (!existsSync(root + config)) throw new Error(`Missing ${config}`);

function run(args, env = {}) {
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: "inherit", env: { ...process.env, ...env } });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(["scripts/run-framework.mjs", "build"], { SHIKKHA_DEPLOY: config });
run(["--import", "./scripts/sites-env.mjs", "./node_modules/wrangler/bin/wrangler.js", "deploy", "--config", "dist/server/wrangler.json", ...process.argv.slice(2)]);
