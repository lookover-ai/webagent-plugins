import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { prContextEnv } from "./context.js";
import type { GithubDeps } from "./github.js";
import { readContext } from "./inputs.js";

// The names the Action sets must be exactly the ones the vendored CLI (dist/webagent.cjs, CLI 0.2.0) reads.
// Reading the bundle itself means a future re-vendor that renames them fails here, not silently in CI.
const bundle = readFileSync(join(__dirname, "..", "dist", "webagent.cjs"), "utf8");
const CLI_NAMES = ["WEBAGENT_CI_TITLE", "WEBAGENT_CI_BODY", "WEBAGENT_CI_CHANGED_FILES"] as const;

describe("CLI 0.2.0 contract: PR context env names", () => {
  it("the vendored CLI reads WEBAGENT_CI_TITLE, WEBAGENT_CI_BODY, WEBAGENT_CI_CHANGED_FILES", () => {
    for (const name of CLI_NAMES) expect(bundle, name).toContain(name);
    // no other WEBAGENT_CI_* name exists in the bundle, so the three above are the whole set
    const found = new Set(bundle.match(/WEBAGENT_CI_[A-Z_]+/g));
    expect([...found].sort()).toEqual([...CLI_NAMES].sort());
  });

  it("the Action sets exactly those names (and nothing else under WEBAGENT_CI_)", async () => {
    const event = {
      number: 7,
      pull_request: {
        number: 7,
        title: "Fix checkout",
        body: "Please test the pay button",
        head: { sha: "feedface00", repo: { full_name: "o/r", fork: false } },
      },
      repository: { private: true, default_branch: "main" },
    };
    const ctx = readContext({ GITHUB_EVENT_NAME: "pull_request", GITHUB_REPOSITORY: "o/r" }, event);
    const fetchFiles = (async () => new Response(JSON.stringify([{ filename: "src/a.ts" }]))) as unknown as typeof fetch;
    const gh: GithubDeps = { fetch: fetchFiles, apiUrl: "https://api.github.com", repo: "o/r", token: "ghs_x" };
    const env = await prContextEnv(gh, ctx);
    expect(Object.keys(env).sort()).toEqual([...CLI_NAMES].sort());
  });

  it("the vendored CLI writes the 0.2.0 report words and the JUnit case_id property", () => {
    expect(bundle).toContain("Couldn't test");
    expect(bundle).toContain('name="case_id"');
    expect(bundle).not.toContain("COULD NOT TEST");
  });
});
