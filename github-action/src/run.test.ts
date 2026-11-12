import { describe, expect, it } from "vitest";
import { type CliResult, type Deps, run, workflowKeyOf } from "./run.js";

const REPORT = `# Checkout: FAIL

Lookover QA · FAIL · 1 passed · 1 failed · 0 flaky · 0 could not test · 20 s · $0.00 AI

- Dashboard: https://dash.test/workflow-runs/wfr_1
`;

interface Rig {
  deps: Deps;
  outputs: Record<string, string>;
  summary: string[];
  logs: string[];
  cliCalls: { args: string[]; env: Record<string, string | undefined> }[];
  gh: { method: string; path: string; body?: { body?: string } }[];
  shares: string[];
}

function rig(o: {
  env?: Record<string, string>;
  event?: Deps["event"];
  cli?: Partial<CliResult> & { report?: string | null };
  files?: Record<string, string>;
  comments?: { id: number; body: string }[];
  ghStatus?: number;
  runJson?: unknown;
}): Rig {
  const env: Record<string, string> = {
    "INPUT_API-KEY": "wa_us_secretsecretsecretsecretsecretsecretsecret1",
    "INPUT_GITHUB-TOKEN": "ghs_x",
    INPUT_FILE: ".webagent/tests.yaml",
    "INPUT_ON-ERROR": "block",
    "INPUT_FAIL-ON": "fail",
    INPUT_COMMENT: "true",
    GITHUB_EVENT_NAME: "pull_request",
    GITHUB_REPOSITORY: "o/r",
    GITHUB_RUN_ID: "42",
    GITHUB_SHA: "a1b2c3d4e5f6",
    ...o.env,
  };
  const r: Rig = { outputs: {}, summary: [], logs: [], cliCalls: [], gh: [], shares: [], deps: undefined as never };
  const files: Record<string, string> = { ".webagent/tests.yaml": "key: checkout\nname: Checkout\n", ...o.files };
  const cli = o.cli ?? {};
  const runJson = o.runJson ?? {
    id: "wfr_1",
    verdict: "fail",
    counts: { flaky: 1 },
    cases: [
      { caseId: "pay", verdict: "fail", sessionId: "ses_1" },
      { caseId: "home", verdict: "pass", sessionId: "ses_2" },
    ],
  };
  const comments = o.comments ?? [];
  r.deps = {
    env,
    event: o.event ?? { number: 7, pull_request: { number: 7, head: { sha: "feedface00", repo: { full_name: "o/r", fork: false } } }, repository: { private: true, default_branch: "main" } },
    fetch: (async (url: string, init: RequestInit = {}) => {
      const u = new URL(url);
      const method = init.method ?? "GET";
      if (u.host === "api.github.com") {
        r.gh.push({ method, path: u.pathname, ...(init.body ? { body: JSON.parse(String(init.body)) } : {}) });
        if (o.ghStatus) return new Response(JSON.stringify({ message: "Resource not accessible by integration" }), { status: o.ghStatus });
        if (method === "GET") return new Response(JSON.stringify(comments));
        return new Response(JSON.stringify({ id: 99 }), { status: 201 });
      }
      r.shares.push(`${method} ${url} ${String(init.body)}`);
      return new Response(JSON.stringify({ url: `https://dash.test/share/${u.pathname.split("/")[3]}` }));
    }) as unknown as typeof fetch,
    readText: async (p) => (p.endsWith("report.md") ? (cli.report === null ? undefined : (cli.report ?? REPORT)) : files[p]),
    runCli: async (args, e) => {
      r.cliCalls.push({ args, env: e });
      return { code: cli.code ?? 1, stdout: cli.stdout ?? JSON.stringify(runJson), stderr: cli.stderr ?? "" };
    },
    appendSummary: async (t) => void r.summary.push(t),
    setOutput: async (n, v) => void (r.outputs[n] = v),
    log: (l) => void r.logs.push(l),
    tmpDir: "/tmp/x",
  };
  return r;
}

const MARK = "<!-- lookover-qa:checkout -->";

describe("run", () => {
  it("pass: exit 0, outputs, summary, running comment then final comment (created, then updated in place)", async () => {
    const r = rig({ cli: { code: 0, stdout: JSON.stringify({ id: "wfr_1", verdict: "pass", counts: { flaky: 2 }, cases: [] }) } });
    expect(await run(r.deps)).toBe(0);
    expect(r.outputs).toEqual({ verdict: "pass", "run-id": "wfr_1", "run-url": "https://dash.test/workflow-runs/wfr_1", flaky: "2" });
    expect(r.summary.join("")).toContain("Lookover QA · FAIL"); // the fake report text, shown as is
    const writes = r.gh.filter((c) => c.method !== "GET");
    expect(writes).toHaveLength(2);
    expect(writes[0]?.body?.body).toContain(`${MARK}\nLookover QA · RUNNING`);
    expect(writes[1]?.body?.body?.startsWith(MARK)).toBe(true);
    expect(writes[1]?.path).toMatch(/comments/);
  });

  it("re-push updates the same comment (PATCH, no second POST)", async () => {
    const r = rig({ cli: { code: 0 }, comments: [{ id: 5, body: `${MARK}\nold` }] });
    await run(r.deps);
    expect(r.gh.filter((c) => c.method === "POST")).toHaveLength(0);
    expect(r.gh.filter((c) => c.method === "PATCH").map((c) => c.path)).toEqual(["/issues/comments/5", "/issues/comments/5"].map((p) => `/repos/o/r${p}`));
  });

  it("fail: exit 1, verdict fail, replay links on a private repo", async () => {
    const r = rig({});
    expect(await run(r.deps)).toBe(1);
    expect(r.outputs.verdict).toBe("fail");
    expect(r.outputs.flaky).toBe("1");
    expect(r.shares).toHaveLength(1);
    expect(r.shares[0]).toContain("/v1/sessions/ses_1/share");
    expect(r.shares[0]).toContain('"ttlSeconds":604800');
    const last = r.gh.filter((c) => c.method !== "GET").at(-1);
    expect(last?.body?.body).toContain("Replays");
    expect(last?.body?.body).toContain("https://dash.test/share/ses_1");
    expect(r.logs.some((l) => l.startsWith("::error"))).toBe(true);
  });

  it("no share links on a public repo by default", async () => {
    const r = rig({ event: { number: 7, pull_request: { number: 7, head: { repo: { full_name: "o/r", fork: false } } }, repository: { private: false } } });
    await run(r.deps);
    expect(r.shares).toHaveLength(0);
    expect(r.gh.filter((c) => c.method !== "GET").at(-1)?.body?.body).not.toContain("Replays");
  });

  it("share-links true on a public repo shares", async () => {
    const r = rig({ env: { "INPUT_SHARE-LINKS": "true" }, event: { number: 7, pull_request: { number: 7, head: { repo: { full_name: "o/r", fork: false } } }, repository: { private: false } } });
    await run(r.deps);
    expect(r.shares).toHaveLength(1);
  });

  it("could not test: exit 2; neutral: exit 0 with a warning", async () => {
    const e = { code: 2, stdout: JSON.stringify({ id: "wfr_1", verdict: "error", counts: {}, cases: [] }), report: "# Lookover QA · could not test\n\nthe preview answered 502 for 120 s\n" };
    const r = rig({ cli: e });
    expect(await run(r.deps)).toBe(2);
    expect(r.outputs.verdict).toBe("error");
    expect(r.gh.filter((c) => c.method !== "GET").at(-1)?.body?.body).toContain("answered 502");
    const n = rig({ env: { "INPUT_ON-ERROR": "neutral" }, cli: { ...e, code: 0 } });
    expect(await run(n.deps)).toBe(0);
    expect(n.outputs.verdict).toBe("error");
    expect(n.logs.some((l) => l.startsWith("::warning"))).toBe(true);
  });

  it("fail-on never: red result, green job", async () => {
    const r = rig({ env: { "INPUT_FAIL-ON": "never" } });
    expect(await run(r.deps)).toBe(0);
    expect(r.outputs.verdict).toBe("fail");
  });

  it("key revoked: exit 3, plain sentence in the comment and summary, no report", async () => {
    const r = rig({
      cli: { code: 3, stdout: "", report: null, stderr: "Setup problem: API key rejected (unauthorized): make a new one in API keys and update WEBAGENT_API_KEY\n  - bad key\n" },
    });
    expect(await run(r.deps)).toBe(3);
    expect(r.outputs).toMatchObject({ verdict: "setup", "run-id": "" });
    const body = r.gh.filter((c) => c.method !== "GET").at(-1)?.body?.body ?? "";
    expect(body).toContain("NOT RUN");
    expect(body).toContain("API key rejected");
    expect(r.summary.join("")).toContain("API key rejected");
  });

  it("fork PR without the secret: one notice, exit 0, no comment, no CLI", async () => {
    const r = rig({
      env: { "INPUT_API-KEY": "", GITHUB_ACTOR: "stranger" },
      event: { number: 7, pull_request: { number: 7, head: { repo: { full_name: "x/r", fork: true } } } },
    });
    expect(await run(r.deps)).toBe(0);
    expect(r.cliCalls).toHaveLength(0);
    expect(r.gh).toHaveLength(0);
    expect(r.outputs.verdict).toBe("skipped");
    expect(r.logs.filter((l) => l.startsWith("::notice"))).toHaveLength(1);
    expect(r.summary.join("")).toContain("fork");
  });

  it("empty key outside a fork is a setup problem (exit 3)", async () => {
    const r = rig({ env: { "INPUT_API-KEY": "", GITHUB_EVENT_NAME: "push" }, event: {} });
    expect(await run(r.deps)).toBe(3);
    expect(r.cliCalls).toHaveLength(0);
    expect(r.logs[0]).toContain("WEBAGENT_API_KEY");
  });

  it("a bad input is a setup problem before any call", async () => {
    const r = rig({ env: { "INPUT_ON-ERROR": "sometimes" } });
    expect(await run(r.deps)).toBe(3);
    expect(r.cliCalls).toHaveLength(0);
    expect(r.outputs.verdict).toBe("setup");
  });

  it("no pull-requests permission: one notice, the job result is unchanged", async () => {
    const r = rig({ ghStatus: 403, cli: { code: 0 } });
    expect(await run(r.deps)).toBe(0);
    expect(r.logs.filter((l) => l.includes("pull-requests: write"))).toHaveLength(1);
    expect(r.gh).toHaveLength(1); // the first call fails, then commenting stops
  });

  it("push event: no PR, no comment calls, summary and outputs still set", async () => {
    const r = rig({ env: { GITHUB_EVENT_NAME: "push", GITHUB_REF: "refs/heads/main" }, event: { repository: { default_branch: "main" } }, cli: { code: 0 } });
    expect(await run(r.deps)).toBe(0);
    expect(r.gh).toHaveLength(0);
    expect(r.summary.length).toBeGreaterThan(0);
    expect(r.cliCalls[0]?.args).toContain("--sync"); // default-branch push
  });

  it("a PR run never gets --sync", async () => {
    const r = rig({ cli: { code: 0 } });
    await run(r.deps);
    expect(r.cliCalls[0]?.args).not.toContain("--sync");
  });

  it("deployment_status finds the PR through the commit", async () => {
    const r = rig({ env: { GITHUB_EVENT_NAME: "deployment_status" }, event: { deployment: { sha: "abc123" } }, cli: { code: 0 } });
    r.deps.fetch = (async (url: string, init: RequestInit = {}) => {
      const u = new URL(url);
      r.gh.push({ method: init.method ?? "GET", path: u.pathname });
      if (u.pathname.endsWith("/pulls")) return new Response(JSON.stringify([{ number: 12, state: "open" }]));
      if ((init.method ?? "GET") === "GET") return new Response("[]");
      return new Response(JSON.stringify({ id: 1 }), { status: 201 });
    }) as unknown as typeof fetch;
    await run(r.deps);
    expect(r.gh.some((c) => c.path === "/repos/o/r/commits/abc123/pulls")).toBe(true);
    expect(r.gh.some((c) => c.method === "POST" && c.path === "/repos/o/r/issues/12/comments")).toBe(true);
  });

  it("comment: false makes no GitHub call", async () => {
    const r = rig({ env: { INPUT_COMMENT: "false" }, cli: { code: 0 } });
    await run(r.deps);
    expect(r.gh).toHaveLength(0);
  });

  it("the key reaches the CLI by environment, never by flag; api-url is passed on", async () => {
    const r = rig({ env: { "INPUT_API-URL": "http://localhost:4400" }, cli: { code: 0 } });
    await run(r.deps);
    const c = r.cliCalls[0];
    expect(c?.env.WEBAGENT_API_KEY).toContain("wa_us_");
    expect(c?.env.WEBAGENT_API_URL).toBe("http://localhost:4400");
    expect(c?.args.join(" ")).not.toContain("wa_us_");
  });

  it("comment key: input, else key in the file, else tests", async () => {
    const a = rig({ env: { INPUT_WORKFLOW: "smoke" }, cli: { code: 0 } });
    await run(a.deps);
    expect(a.gh.find((c) => c.method === "POST")?.body?.body).toContain("<!-- lookover-qa:smoke -->");
    const b = rig({ files: { ".webagent/tests.yaml": "name: x\n" }, cli: { code: 0 } });
    await run(b.deps);
    expect(b.gh.find((c) => c.method === "POST")?.body?.body).toContain("<!-- lookover-qa:tests -->");
  });
});

describe("workflowKeyOf", () => {
  it("reads a plain top-level key", () => {
    expect(workflowKeyOf('name: A\nkey: "checkout-flow"  # hi\n')).toBe("checkout-flow");
    expect(workflowKeyOf("cases:\n  - key: nested\n")).toBeUndefined();
    expect(workflowKeyOf(undefined)).toBeUndefined();
  });
});
