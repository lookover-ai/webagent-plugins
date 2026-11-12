// Bundles src/main.ts to dist/index.cjs (no node_modules needed at run time) and vendors the CLI bundle
// as dist/webagent.cjs. JavaScript actions run what is committed in dist/, so commit it.
// The CLI comes from the contracts repo: `pnpm build` in ../../webagent-contracts, or set WEBAGENT_CLI_BUNDLE.
import { build } from "esbuild";
import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
mkdirSync(dist, { recursive: true });

await build({
  entryPoints: [join(root, "src/main.ts")],
  outfile: join(dist, "index.cjs"),
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22", // the action runs on node24; the vendored CLI is built for node22 too
  legalComments: "none",
  logLevel: "info",
});

const cli = process.env.WEBAGENT_CLI_BUNDLE ?? resolve(root, "../../webagent-contracts/cli/dist/webagent.cjs");
if (existsSync(cli)) {
  copyFileSync(cli, join(dist, "webagent.cjs"));
  console.log(`vendored CLI: ${cli} (${(statSync(cli).size / 1024).toFixed(0)} KB)`);
} else if (!existsSync(join(dist, "webagent.cjs"))) {
  console.error(`CLI bundle not found at ${cli}: run "pnpm build" in webagent-contracts first`);
  process.exit(1);
} else {
  console.warn(`CLI bundle not found at ${cli}: kept the committed dist/webagent.cjs`);
}
