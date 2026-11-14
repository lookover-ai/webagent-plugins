/**
 * The Action with the REAL vendored CLI (`dist/webagent.cjs`, 0.3.0) against a fake API on localhost: the CLI and the
 * server own steps, expectations, case keys and verdict words; the Action must follow the CLI's exit code, never
 * a pass the reply does not prove. Nothing leaves the machine.
 */

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type CliResult, type Deps, run } from "./run.js";

const BUNDLE = join(__dirname, "..", "dist", "webagent.cjs");
const KEY = "wa_us_secretsecretsecretsecretsecretsecretsecret1";

interface Fake {
  /** Body of `POST /v1/workflow-runs` as the CLI sent it. */
  posted: unknown[];
  /** Reply of the final `GET /v1/workflow-runs/:id`. */
  final: unknown;
  /** When set, the POST is answered with this status and error body. */
  refuse?: { status: number; body: unknown };
}

const fake: Fake = { posted: [], final: {} };
let server: Server;
let apiUrl = "";

const readBody = (req: IncomingMessage): Promise<string> =>
  new Promise((resolve) => {
    let s = "";
    req.on("data", (b: Buffer) => {
      s += b.toString("utf8");
    });
    req.on("end", () => resolve(s));
  });

beforeAll(async () => {
  server = createServer(async (req, res) => {
    const path = new URL(req.url ?? "/", "http://x").pathname;
    const json = (status: number, body: unknown) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };
    if (req.method === "POST" && path === "/v1/workflow-runs") {
      fake.posted.push(JSON.parse(await readBody(req)));
      if (fake.refuse) return json(fake.refuse.status, fake.refuse.body);
      return json(200, { ...(fake.final as object), verdict: "running" });
    }
    if (req.method === "GET" && path.endsWith("/report.md")) {
      res.writeHead(200, { "content-type": "text/markdown" });
      return void res.end("# Lookover QA · report\n\n- Dashboard: https://dash.test/workflow-runs/wfr_1\n");
    }
    if (req.method === "GET" && path.startsWith("/v1/workflow-runs/")) return json(200, fake.final);
    return json(404, { error: { code: "not_found", message: "no such route" } });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  apiUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});

afterAll(() => new Promise<void>((resolve) => void server.close(() => resolve())));

const runReply = (verdict: string, caseVerdict: string) => ({
  id: "wfr_1",
  name: "Acme",
  verdict,
  summary: "",
  counts: { cases: 1, passed: 0, failed: 0, errored: 0, running: 0 },
  cases: [{ caseId: "checkout", title: "Checkout", verdict: caseVerdict, summary: "" }],
  costMicros: 0,
  startedAt: "2026-11-14T00:00:00Z",
});

/** A tests file with a step kind, an expectation shape and file-level keys this Action (and CLI) have never heard of. */
const FUTURE_FILE = `name: Acme
key: acme
url: https://preview.example.com
vars: { coupon: SAVE10 }
cases:
  - id: checkout
    title: Checkout
    steps:
      - kind: hover-magic
        target: { aria: "Pay now", nth: 2 }
    expect:
      - { kind: visual-diff, threshold: 0.02 }
`;

async function go(file: string, env: Record<string, string> = {}) {
  const dir = await mkdtemp(join(tmpdir(), "action-bundle-"));
  const testsPath = join(dir, "tests.yaml");
  await writeFile(testsPath, file, "utf8");
  const logs: string[] = [];
  const summary: string[] = [];
  const outputs: Record<string, string> = {};
  const deps: Deps = {
    env: {
      "INPUT_API-KEY": KEY,
      "INPUT_API-URL": apiUrl,
      INPUT_FILE: testsPath,
      "INPUT_WAIT-FOR-URL": "0",
      "INPUT_ON-ERROR": "block",
      "INPUT_FAIL-ON": "fail",
      INPUT_COMMENT: "false",
      PATH: process.env.PATH,
      ...env,
    } as Record<string, string>,
    event: {},
    fetch: (...a) => globalThis.fetch(...a),
    readText: async (p) => {
      try {
        return await readFile(p, "utf8");
      } catch {
        return undefined;
      }
    },
    runCli: (args, e) =>
      new Promise<CliResult>((resolve) => {
        const child = spawn(process.execPath, [BUNDLE, ...args], { env: e as NodeJS.ProcessEnv, stdio: ["ignore", "pipe", "pipe"] });
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (b: Buffer) => void (stdout += b.toString("utf8")));
        child.stderr.on("data", (b: Buffer) => {
          stderr += b.toString("utf8");
          logs.push(...b.toString("utf8").split("\n").filter(Boolean)); // main.ts streams the CLI's stderr to the job log
        });
        child.on("close", (code) => resolve({ code, stdout, stderr }));
      }),
    appendSummary: async (t) => void summary.push(t),
    setOutput: async (n, v) => void (outputs[n] = v),
    log: (l) => void logs.push(l),
    tmpDir: dir,
  };
  const code = await run(deps);
  return { code, logs, summary: summary.join(""), outputs };
}

describe("the vendored CLI", () => {
  it("is the version recorded in CLI-SOURCE", () => {
    const recorded = readFileSync(join(__dirname, "..", "CLI-SOURCE"), "utf8");
    const version = /^version: (\S+)$/m.exec(recorded)?.[1];
    expect(version).toBe("0.3.0");
    expect(/^contracts: [0-9a-f]{7,40}$/m.test(recorded)).toBe(true);
    return new Promise<void>((resolve, reject) => {
      const child = spawn(process.execPath, [BUNDLE, "--version"]);
      let out = "";
      child.stdout.on("data", (b: Buffer) => void (out += b.toString("utf8")));
      child.on("close", () => {
        try {
          expect(out.trim()).toBe(version);
          resolve();
        } catch (e) {
          reject(e);
        }
      });
    });
  });
});

describe("Action + CLI 0.3.0: verdict words the Action does not know are never a pass", () => {
  it("run verdict `skipped`: could not test (exit 2), output error", async () => {
    fake.refuse = undefined;
    fake.final = runReply("skipped", "skipped");
    const r = await go(FUTURE_FILE);
    expect(r.code).toBe(2);
    expect(r.outputs.verdict).toBe("error");
    expect(r.logs.some((l) => l.startsWith("::error"))).toBe(true);
  });

  it("on-error neutral: the job passes with a warning, the output is still error, never pass", async () => {
    fake.final = runReply("skipped", "skipped");
    const r = await go(FUTURE_FILE, { "INPUT_ON-ERROR": "neutral" });
    expect(r.code).toBe(0);
    expect(r.outputs.verdict).toBe("error");
    expect(r.logs.some((l) => l.startsWith("::warning"))).toBe(true);
    expect(r.logs.some((l) => l.startsWith("::notice"))).toBe(false);
  });

  it("run says pass but a required case has an unknown verdict: not green", async () => {
    fake.final = runReply("pass", "quarantined");
    const r = await go(FUTURE_FILE, { "INPUT_ON-ERROR": "neutral" });
    expect(r.outputs.verdict).toBe("error");
  });

  it("a real pass is still a pass", async () => {
    fake.final = runReply("pass", "pass");
    const r = await go(FUTURE_FILE);
    expect(r.code).toBe(0);
    expect(r.outputs).toMatchObject({ verdict: "pass", "run-id": "wfr_1" });
  });
});

describe("Action + CLI 0.3.0: steps, expect and file keys pass through", () => {
  it("an unknown step kind, expectation and file-level key reach the server untouched", async () => {
    fake.posted = [];
    fake.final = runReply("pass", "pass");
    const r = await go(FUTURE_FILE);
    expect(r.code).toBe(0);
    const sent = fake.posted.at(-1) as { vars?: unknown; cases?: { steps?: unknown; expect?: unknown }[] };
    expect(sent.cases?.[0]?.steps).toEqual([{ kind: "hover-magic", target: { aria: "Pay now", nth: 2 } }]);
    expect(sent.cases?.[0]?.expect).toEqual([{ kind: "visual-diff", threshold: 0.02 }]);
    expect(sent.vars).toEqual({ coupon: "SAVE10" });
  });
});

describe("Action + CLI 0.3.0: a server refusal is exit 3 with the server's sentence", () => {
  it("shows the sentence and the failing path in the job log, the summary and the annotation", async () => {
    fake.refuse = {
      status: 400,
      body: {
        error: {
          code: "invalid_input",
          message: 'Case "checkout": step 1 has an unknown kind "hover-magic"',
          details: { issues: [{ path: ["cases", 0, "steps", 0, "kind"], message: "unknown step kind" }] },
        },
      },
    };
    try {
      const r = await go(FUTURE_FILE);
      expect(r.code).toBe(3);
      expect(r.outputs).toMatchObject({ verdict: "setup", "run-id": "" });
      const sentence = 'Case "checkout": step 1 has an unknown kind "hover-magic"';
      expect(r.logs.join("\n")).toContain(sentence); // the CLI's stderr, streamed
      expect(r.summary).toContain(sentence);
      expect(r.summary).toContain("cases.0.steps.0.kind: unknown step kind");
      const annotation = r.logs.find((l) => l.startsWith("::error title=Lookover QA::"));
      expect(annotation).toContain("Setup problem:");
      expect(annotation).toContain("hover-magic");
    } finally {
      fake.refuse = undefined;
    }
  });
});
