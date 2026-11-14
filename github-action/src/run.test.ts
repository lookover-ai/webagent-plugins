import { describe, expect, it } from "vitest";
import { type CliResult, type Deps, run, workflowKeyOf } from "./run.js";

// The report is the API's `report.md`; the words follow CLI 0.2.0 / contracts 0.45.0 (Passed, Failed, Couldn't test).
const REPORT = `# Checkout: Failed

Lookover QA · Failed · 1 passed · 1 failed
Took 20.0 s · Cost: $0.12

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
  reads: string[];
  /** `GET /pulls/:n/files` calls (kept apart from `gh`, the comment calls). */
  fileCalls: string[];
}

function rig(o: {
  env?: Record<string, string>;
  event?: Deps["event"];
  cli?: Partial<CliResult> & { report?: string | null };
  files?: Record<string, string>;
  comments?: { id: number; body: string }[];
  ghStatus?: number;
  runJson?: unknown;
  /** Body of `GET /v1/workflow-runs/:id` (the settled run); unset = the read answers 404. */
  finalRun?: unknown;
  /** Answers of `GET /pulls/:n/files`, one array per page; `"error"` answers 500. Unset: no files. */
  prFiles?: { filename: string }[][] | "error";
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
  const r: Rig = { outputs: {}, summary: [], logs: [], cliCalls: [], gh: [], shares: [], reads: [], fileCalls: [], deps: undefined as never };
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
        if (u.pathname.endsWith("/files")) {
          r.fileCalls.push(`${u.pathname}${u.search} ${new Headers(init.headers).get("authorization")}`);
          if (o.prFiles === "error") return new Response("{}", { status: 500 });
          const page = Number(u.searchParams.get("page") ?? "1");
          return new Response(JSON.stringify(o.prFiles?.[page - 1] ?? []));
        }
        r.gh.push({ method, path: u.pathname, ...(init.body ? { body: JSON.parse(String(init.body)) } : {}) });
        if (o.ghStatus) return new Response(JSON.stringify({ message: "Resource not accessible by integration" }), { status: o.ghStatus });
        if (method === "GET") return new Response(JSON.stringify(comments));
        return new Response(JSON.stringify({ id: 99 }), { status: 201 });
      }
      if (method === "GET" && u.pathname.startsWith("/v1/workflow-runs/")) {
        r.reads.push(`${u.pathname} ${new Headers(init.headers).get("authorization")}`);
        if (o.finalRun === undefined) return new Response("{}", { status: 404 });
        return new Response(JSON.stringify(o.finalRun));
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
    expect(r.summary.join("")).toContain("Lookover QA · Failed · 1 passed · 1 failed"); // the fake report text, shown as is
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

  it("a retried case: the share link uses the settled run's session (last attempt), not the CLI's copy", async () => {
    const r = rig({
      finalRun: { id: "wfr_1", cases: [{ caseId: "pay", verdict: "fail", sessionId: "ses_attempt2" }, { caseId: "home", verdict: "pass", sessionId: "ses_2" }] },
    });
    await run(r.deps);
    expect(r.reads).toEqual(["/v1/workflow-runs/wfr_1 Bearer wa_us_secretsecretsecretsecretsecretsecretsecret1"]);
    expect(r.shares).toHaveLength(1);
    expect(r.shares[0]).toContain("/v1/sessions/ses_attempt2/share");
    expect(r.shares[0]).not.toContain("ses_1/");
    const last = r.gh.filter((c) => c.method !== "GET").at(-1);
    expect(last?.body?.body).toContain("- pay: https://dash.test/share/ses_attempt2");
  });

  it("the final read fails: the links fall back to the CLI's cases", async () => {
    const r = rig({}); // finalRun unset: the read answers 404
    await run(r.deps);
    expect(r.reads).toHaveLength(1);
    expect(r.shares).toHaveLength(1);
    expect(r.shares[0]).toContain("/v1/sessions/ses_1/share");
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
    const n = rig({ env: { "INPUT_ON-ERROR": "neutral" }, cli: e });
    expect(await run(n.deps)).toBe(0);
    expect(n.outputs.verdict).toBe("error");
    expect(n.logs.some((l) => l.startsWith("::warning"))).toBe(true);
    expect(n.cliCalls[0]?.args.join(" ")).toContain("--on-error block"); // neutral is the Action's, so a CLI exit 0 is always a pass
  });

  it("unknown verdict words in the reply never make a pass: the CLI's exit code decides, the reply is not read for a verdict", async () => {
    // CLI 0.3.0 exits 2 for these; the raw reply it prints still says "skipped" / "pass".
    for (const stdout of [
      JSON.stringify({ id: "wfr_1", verdict: "skipped", counts: { flaky: 0 }, cases: [{ caseId: "a", verdict: "skipped", sessionId: "ses_1" }] }),
      JSON.stringify({ id: "wfr_1", verdict: "pass", cases: [{ caseId: "a", verdict: "quarantined" }] }),
    ]) {
      const r = rig({ cli: { code: 2, stdout } });
      expect(await run(r.deps)).toBe(2);
      expect(r.outputs.verdict).toBe("error");
      expect(r.shares).toHaveLength(0); // a case the Action cannot read gets no replay link
      const n = rig({ env: { "INPUT_ON-ERROR": "neutral" }, cli: { code: 2, stdout } });
      expect(await run(n.deps)).toBe(0);
      expect(n.outputs.verdict).toBe("error"); // never "pass", even when the job is green
    }
  });

  it("a reply of any shape cannot break the Action: odd or missing fields are left out", async () => {
    for (const stdout of [
      JSON.stringify({ id: 7, verdict: 3, counts: null, cases: "many" }),
      JSON.stringify({ id: "wfr_9", counts: { flaky: "lots" }, cases: [{ caseId: "a", verdict: "fail", sessionId: 5 }] }),
      "[1,2]",
      '{"id": ',
      "",
    ]) {
      const r = rig({ cli: { code: 1, stdout } });
      expect(await run(r.deps)).toBe(1);
      expect(r.outputs.verdict).toBe("fail");
      expect(r.outputs.flaky).toBe("0");
    }
  });

  it("a tests file with step kinds, expectations and keys the Action has never seen: passed to the CLI by path, never read", async () => {
    const odd = "name: x\nkey: odd\nvars: {a: 1}\ncases:\n  - title: T\n    steps: [{ kind: warp, to: 9 }]\n    expect: [{ kind: telepathy }]\n";
    const r = rig({ files: { ".webagent/tests.yaml": odd }, cli: { code: 0 } });
    expect(await run(r.deps)).toBe(0);
    expect(r.outputs.verdict).toBe("pass");
    expect(r.cliCalls[0]?.args).toEqual(expect.arrayContaining(["--file", ".webagent/tests.yaml"]));
    expect(r.cliCalls[0]?.args.join(" ")).not.toContain("warp"); // content is not turned into flags
    expect(r.gh.find((c) => c.method === "POST")?.body?.body).toContain("<!-- lookover-qa:odd -->");
  });

  it("exit 3 from a server refusal: the server's sentence is in the log annotation, the summary and the comment", async () => {
    const sentence = 'starting the run was rejected (invalid_input): Case "pay": step 2 has an unknown kind "zoom"';
    const r = rig({ cli: { code: 3, stdout: "", report: null, stderr: `Setup problem: ${sentence}\n  - cases.0.steps.1.kind: unknown step kind\n` } });
    expect(await run(r.deps)).toBe(3);
    const annotation = r.logs.find((l) => l.startsWith("::error title=Lookover QA::")) ?? "";
    expect(annotation).toContain("step 2 has an unknown kind");
    expect(annotation).toContain("cases.0.steps.1.kind");
    expect(r.summary.join("")).toContain(sentence);
    expect(r.gh.filter((c) => c.method !== "GET").at(-1)?.body?.body).toContain("cases.0.steps.1.kind: unknown step kind");
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

  it("engine in tests.yaml not found: exit 3, the CLI sentence is in the comment, summary and no run starts", async () => {
    const r = rig({
      cli: { code: 3, stdout: "", report: null, stderr: "Setup problem: Engine 'my-qa' not found in this project\n" },
    });
    expect(await run(r.deps)).toBe(3);
    expect(r.outputs).toMatchObject({ verdict: "setup", "run-id": "" });
    const body = r.gh.filter((c) => c.method !== "GET").at(-1)?.body?.body ?? "";
    expect(body).toContain("NOT RUN");
    expect(body).toContain("Engine 'my-qa' not found in this project");
    expect(r.summary.join("")).toContain("Engine 'my-qa' not found in this project");
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
    const r = rig({ env: { GITHUB_EVENT_NAME: "deployment_status" }, event: { deployment: { sha: "abc123" }, deployment_status: { state: "success", environment_url: "https://pr-9.example.app" } }, cli: { code: 0 } });
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

const prEvent = (pr: Record<string, unknown> = {}): Deps["event"] => ({
  number: 7,
  pull_request: { number: 7, title: "Fix checkout", body: "Please test the pay button", head: { sha: "feedface00", repo: { full_name: "o/r", fork: false } }, ...pr },
  repository: { private: true, default_branch: "main" },
});

const lastComment = (r: Rig) => r.gh.filter((c) => c.method !== "GET").at(-1)?.body?.body ?? "";

describe("mode", () => {
  it("enforce is the default: a failed case fails the job (exit 1), no banner", async () => {
    const r = rig({});
    expect(await run(r.deps)).toBe(1);
    expect(r.outputs.verdict).toBe("fail");
    expect(lastComment(r)).not.toContain("Practice mode");
    expect(r.summary.join("")).not.toContain("Practice mode");
    expect(r.cliCalls[0]?.args).not.toContain("--mode");
  });

  it("practice: exit 1 becomes a green job, the verdict output stays fail, banner in summary and comments", async () => {
    const r = rig({ env: { INPUT_MODE: "practice" } });
    expect(await run(r.deps)).toBe(0);
    expect(r.outputs.verdict).toBe("fail");
    expect(r.logs.some((l) => l.startsWith("::warning") && l.includes("mode is practice"))).toBe(true);
    const banner = "Practice mode: this check does not block merging yet.";
    expect(r.summary.join("").startsWith(banner)).toBe(true);
    const writes = r.gh.filter((c) => c.method !== "GET");
    expect(writes[0]?.body?.body).toContain(banner); // the running comment
    expect(lastComment(r).startsWith("<!-- lookover-qa:checkout -->\n")).toBe(true); // marker stays first
    expect(lastComment(r)).toContain(banner);
  });

  it("practice: could not test still follows on-error (block fails with 2, neutral passes)", async () => {
    const e = { code: 2, stdout: JSON.stringify({ id: "wfr_1", verdict: "error", counts: {}, cases: [] }) };
    expect(await run(rig({ env: { INPUT_MODE: "practice" }, cli: e }).deps)).toBe(2);
    const n = rig({ env: { INPUT_MODE: "practice", "INPUT_ON-ERROR": "neutral" }, cli: e });
    expect(await run(n.deps)).toBe(0);
    expect(n.outputs.verdict).toBe("error");
  });

  it("practice + an unknown verdict in the reply (CLI 0.3.0 exits 2): never reported as pass, banner still shown", async () => {
    for (const stdout of [
      JSON.stringify({ id: "wfr_1", verdict: "skipped", counts: {}, cases: [{ caseId: "a", verdict: "skipped" }] }),
      JSON.stringify({ id: "wfr_1", verdict: "pass", counts: {}, cases: [{ caseId: "a", verdict: "quarantined" }] }),
    ]) {
      const blocked = rig({ env: { INPUT_MODE: "practice" }, cli: { code: 2, stdout } });
      expect(await run(blocked.deps)).toBe(2);
      expect(blocked.outputs.verdict).toBe("error");
      expect(blocked.summary.join("").startsWith("Practice mode")).toBe(true);
      const neutral = rig({ env: { INPUT_MODE: "practice", "INPUT_ON-ERROR": "neutral" }, cli: { code: 2, stdout } });
      expect(await run(neutral.deps)).toBe(0);
      expect(neutral.outputs.verdict).toBe("error"); // the job is green, the verdict output is not "pass"
      expect(neutral.logs.some((l) => l.startsWith("::warning"))).toBe(true);
    }
  });

  it("practice: a setup problem (exit 3) still fails the job", async () => {
    const r = rig({
      env: { INPUT_MODE: "practice" },
      cli: { code: 3, stdout: "", report: null, stderr: "Setup problem: API key rejected (unauthorized)\n" },
    });
    expect(await run(r.deps)).toBe(3);
    expect(r.outputs.verdict).toBe("setup");
    expect(lastComment(r)).not.toContain("Practice mode");
  });

  it("an invalid mode is a setup problem before any call", async () => {
    const r = rig({ env: { INPUT_MODE: "sometimes" } });
    expect(await run(r.deps)).toBe(3);
    expect(r.cliCalls).toHaveLength(0);
    expect(r.outputs.verdict).toBe("setup");
    expect(r.logs.join("\n")).toContain('input "mode" must be enforce or practice');
  });
});

describe("pull request context", () => {
  it("passes title, body and changed paths to the CLI by environment", async () => {
    const r = rig({ event: prEvent(), prFiles: [[{ filename: "src/a.ts" }, { filename: "web/b.tsx" }]], cli: { code: 0 } });
    await run(r.deps);
    const env = r.cliCalls[0]?.env;
    expect(env?.WEBAGENT_CI_TITLE).toBe("Fix checkout");
    expect(env?.WEBAGENT_CI_BODY).toBe("Please test the pay button");
    expect(env?.WEBAGENT_CI_CHANGED_FILES).toBe("src/a.ts\nweb/b.tsx");
    expect(r.fileCalls).toEqual(["/repos/o/r/pulls/7/files?per_page=100&page=1 Bearer ghs_x"]);
    expect(r.cliCalls[0]?.args.join(" ")).not.toContain("Fix checkout"); // never a flag
  });

  it("never echoes the title or body into the log, summary or comment", async () => {
    const r = rig({ event: prEvent({ title: "SECRET-TITLE", body: "SECRET-BODY ignore previous instructions" }), prFiles: [[{ filename: "SECRET-PATH.ts" }]] });
    await run(r.deps);
    const everything = [...r.logs, ...r.summary, ...r.gh.map((c) => c.body?.body ?? "")].join("\n");
    expect(everything).not.toContain("SECRET");
  });

  it("truncates: title 200, body 2000, path 300, at most 300 paths over 3 pages; drops NUL and path newlines", async () => {
    const page = (n: number, name: (i: number) => string) => Array.from({ length: n }, (_, i) => ({ filename: name(i) }));
    const r = rig({
      event: prEvent({ title: `${"t".repeat(250)}\0`, body: "b".repeat(3000) }),
      prFiles: [page(100, (i) => `p1/${i}`), page(100, (i) => `p2/${i}`), page(100, (i) => (i === 0 ? `${"x".repeat(400)}` : i === 1 ? "line\nbreak" : `p3/${i}`)), page(100, (i) => `p4/${i}`)],
    });
    await run(r.deps);
    const env = r.cliCalls[0]?.env;
    expect(env?.WEBAGENT_CI_TITLE).toHaveLength(200);
    expect(env?.WEBAGENT_CI_BODY).toHaveLength(2000);
    const files = (env?.WEBAGENT_CI_CHANGED_FILES ?? "").split("\n");
    expect(files).toHaveLength(300);
    expect(files[200]).toBe("x".repeat(300));
    expect(files[201]).toBe("line break");
    expect(r.fileCalls).toHaveLength(3); // stops at 300, no 4th page
  });

  it("omits what is empty", async () => {
    const r = rig({ event: prEvent({ title: "T", body: null }), cli: { code: 0 } });
    await run(r.deps);
    const env = r.cliCalls[0]?.env ?? {};
    expect(env.WEBAGENT_CI_TITLE).toBe("T");
    expect("WEBAGENT_CI_BODY" in env).toBe(false);
    expect("WEBAGENT_CI_CHANGED_FILES" in env).toBe(false);
  });

  it("a GitHub error leaves the changed files out and the job unaffected", async () => {
    const r = rig({ event: prEvent(), prFiles: "error", cli: { code: 0 } });
    expect(await run(r.deps)).toBe(0);
    const env = r.cliCalls[0]?.env ?? {};
    expect(env.WEBAGENT_CI_TITLE).toBe("Fix checkout");
    expect("WEBAGENT_CI_CHANGED_FILES" in env).toBe(false);
  });

  it("works on pull_request_target; not on a fork PR; not on a push", async () => {
    const t = rig({ env: { GITHUB_EVENT_NAME: "pull_request_target" }, event: prEvent(), cli: { code: 0 } });
    await run(t.deps);
    expect(t.cliCalls[0]?.env.WEBAGENT_CI_TITLE).toBe("Fix checkout");
    const f = rig({ event: prEvent({ head: { repo: { full_name: "x/r", fork: true } } }), cli: { code: 0 } });
    await run(f.deps);
    expect(Object.keys(f.cliCalls[0]?.env ?? {}).filter((k) => k.startsWith("WEBAGENT_CI_"))).toEqual([]);
    expect(f.fileCalls).toHaveLength(0);
    const p = rig({ env: { GITHUB_EVENT_NAME: "push" }, event: {}, cli: { code: 0 } });
    await run(p.deps);
    expect(Object.keys(p.cliCalls[0]?.env ?? {}).filter((k) => k.startsWith("WEBAGENT_CI_"))).toEqual([]);
  });
});

describe("deployment_status", () => {
  const dep = (ds: Record<string, unknown>): Rig => {
    const r = rig({ env: { GITHUB_EVENT_NAME: "deployment_status" }, event: { deployment: { sha: "abc123" }, deployment_status: ds }, cli: { code: 0 } });
    r.deps.fetch = (async (_url: string, init: RequestInit = {}) =>
      (init.method ?? "GET") === "GET" ? new Response("[]") : new Response(JSON.stringify({ id: 1 }), { status: 201 })) as unknown as typeof fetch;
    return r;
  };

  it("an empty url input takes environment_url, else target_url", async () => {
    const a = dep({ state: "success", environment_url: "https://pr-1.example.app", target_url: "https://logs.example.com/1" });
    await run(a.deps);
    const args = a.cliCalls[0]?.args ?? [];
    expect(args[args.indexOf("--url") + 1]).toBe("https://pr-1.example.app");
    const b = dep({ state: "success", environment_url: "", target_url: "https://t.example.app" });
    await run(b.deps);
    const bargs = b.cliCalls[0]?.args ?? [];
    expect(bargs[bargs.indexOf("--url") + 1]).toBe("https://t.example.app");
    expect(bargs).toContain("--wait-for-url"); // the wait applies as before
  });

  it("the url input wins over the payload", async () => {
    const r = dep({ state: "success", environment_url: "https://pr-1.example.app" });
    r.deps.env["INPUT_URL"] = "https://mine.example.com";
    await run(r.deps);
    const args = r.cliCalls[0]?.args ?? [];
    expect(args[args.indexOf("--url") + 1]).toBe("https://mine.example.com");
  });

  it("a state other than success skips neutral with a notice and no CLI call", async () => {
    const r = dep({ state: "pending", environment_url: "https://pr-1.example.app" });
    expect(await run(r.deps)).toBe(0);
    expect(r.cliCalls).toHaveLength(0);
    expect(r.outputs.verdict).toBe("skipped");
    expect(r.logs.filter((l) => l.startsWith("::notice") && l.includes("pending"))).toHaveLength(1);
    expect(r.summary.join("")).toContain("not ready");
  });
});

describe("headline words and cost", () => {
  it("the Action's own headings are Passed / Failed / Couldn't test", async () => {
    const e = { code: 2, stdout: JSON.stringify({ id: "wfr_1", verdict: "error", counts: {}, cases: [] }), report: null };
    const r = rig({ cli: e });
    await run(r.deps);
    expect(r.summary.join("")).toContain("Couldn't test");
    expect(lastComment(r)).toContain("Couldn't test");
    expect(`${r.summary.join("")}${lastComment(r)}`).not.toContain("COULD NOT TEST");
  });

  it("adds no Cost line of its own: the report's single cost line is all there is", async () => {
    const r = rig({
      runJson: { id: "wfr_1", verdict: "fail", counts: {}, costMicros: 1_234_567, cases: [] },
      finalRun: { id: "wfr_1", costMicros: 420_000, cases: [] },
    });
    await run(r.deps);
    for (const text of [r.summary.join(""), lastComment(r)]) {
      expect(text.match(/Cost: \$/g)).toHaveLength(1); // the one in the CLI report
      expect(text).toContain("Cost: $0.12");
      expect(text).not.toContain("Cost: $1.23");
      expect(text).not.toContain("Cost: $0.42");
    }
  });

  it("matches nothing on the old verdict words: the verdict comes from the exit code", async () => {
    // A report with any wording (old or new) changes neither the outputs nor the exit code.
    const old = rig({ cli: { code: 1, report: "# Checkout: FAIL\n\nLookover QA · FAIL · 1 passed\n- Dashboard: https://dash.test/workflow-runs/wfr_1\n" } });
    expect(await run(old.deps)).toBe(1);
    expect(old.outputs.verdict).toBe("fail");
    expect(old.outputs["run-url"]).toBe("https://dash.test/workflow-runs/wfr_1");
    const pass = rig({ cli: { code: 0, stdout: JSON.stringify({ id: "wfr_1", verdict: "pass", counts: {}, cases: [] }), report: "# Checkout: Passed\n\nLookover QA · Passed · 2 passed\n" } });
    expect(await run(pass.deps)).toBe(0);
    expect(pass.outputs.verdict).toBe("pass");
  });
});
