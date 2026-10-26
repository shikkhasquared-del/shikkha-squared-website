// Loaded with `node --import` before Wrangler runs: keeps Wrangler's logs and registries inside
// this project's .wrangler folder (as vite.config.ts does for dev and build) and turns off
// usage metrics.
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const stateRoot = path.join(projectRoot, ".wrangler");

process.env.CLOUDFLARE_CF_FETCH_ENABLED ||= "false";
process.env.WRANGLER_SEND_METRICS ||= "false";
process.env.WRANGLER_WRITE_LOGS ||= "false";
process.env.WRANGLER_LOG_PATH ||= path.join(stateRoot, "logs");
process.env.WRANGLER_REGISTRY_PATH ||= path.join(stateRoot, "dev-registry");
process.env.MINIFLARE_REGISTRY_PATH ||= path.join(stateRoot, "registry");

process.chdir(projectRoot);
for (const directory of [
  process.env.WRANGLER_LOG_PATH,
  process.env.WRANGLER_REGISTRY_PATH,
  process.env.MINIFLARE_REGISTRY_PATH,
]) {
  mkdirSync(directory, { recursive: true });
}
