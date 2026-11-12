"use strict";

// src/main.ts
var import_node_child_process = require("node:child_process");
var import_promises = require("node:fs/promises");
var import_node_os = require("node:os");
var import_node_path = require("node:path");

// src/github.ts
var marker = (workflowKey) => `<!-- lookover-qa:${workflowKey} -->`;
var MAX_BODY = 6e4;
var MAX_PAGES = 10;
var HttpError = class extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
  status;
};
async function call(d, method, path, body) {
  const res = await d.fetch(`${d.apiUrl.replace(/\/+$/, "")}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${d.token}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "lookover-qa-action",
      ...body === void 0 ? {} : { "content-type": "application/json" }
    },
    ...body === void 0 ? {} : { body: JSON.stringify(body) }
  });
  if (!res.ok) {
    let msg = "";
    try {
      msg = (await res.json()).message ?? "";
    } catch {
    }
    throw new HttpError(res.status, msg || `HTTP ${res.status}`);
  }
  return res.status === 204 ? void 0 : await res.json();
}
function fitBody(body) {
  if (body.length <= MAX_BODY) return body;
  return `${body.slice(0, MAX_BODY)}

_The report was cut to fit a comment. The full report is in the job summary and on the dashboard._
`;
}
async function findComment(d, pr, mark) {
  for (let page = 1; page <= MAX_PAGES; page++) {
    const list = await call(
      d,
      "GET",
      `/repos/${d.repo}/issues/${pr}/comments?per_page=100&page=${page}`
    );
    const hit = list.find((c) => typeof c.body === "string" && c.body.includes(mark));
    if (hit) return hit.id;
    if (list.length < 100) return void 0;
  }
  return void 0;
}
function why(e) {
  if (e instanceof HttpError && (e.status === 403 || e.status === 404)) {
    return `GitHub refused (${e.status}: ${e.message}). Give the job \`permissions: pull-requests: write\` to get the PR comment`;
  }
  return e instanceof Error ? e.message : String(e);
}
async function upsertComment(d, pr, mark, body) {
  const text = fitBody(body);
  try {
    const existing = await findComment(d, pr, mark);
    if (existing !== void 0) {
      try {
        await call(d, "PATCH", `/repos/${d.repo}/issues/comments/${existing}`, { body: text });
        return { status: "updated", id: existing };
      } catch (e) {
        if (!(e instanceof HttpError && (e.status === 403 || e.status === 404))) throw e;
      }
    }
    const made = await call(d, "POST", `/repos/${d.repo}/issues/${pr}/comments`, {
      body: text
    });
    return { status: "created", id: made.id };
  } catch (e) {
    return { status: "skipped", reason: why(e) };
  }
}
async function pullForCommit(d, sha) {
  try {
    const pulls = await call(
      d,
      "GET",
      `/repos/${d.repo}/commits/${sha}/pulls?per_page=10`
    );
    return pulls.find((p) => p.state === "open")?.number;
  } catch {
    return void 0;
  }
}

// src/inputs.ts
var InputError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "InputError";
  }
};
var DEFAULT_FILE = ".webagent/tests.yaml";
function input(env, name) {
  return (env[`INPUT_${name.toUpperCase()}`] ?? "").trim();
}
function readInputs(env) {
  return {
    apiKey: input(env, "api-key"),
    apiUrl: input(env, "api-url"),
    url: input(env, "url"),
    file: input(env, "file") || DEFAULT_FILE,
    workflow: input(env, "workflow"),
    target: input(env, "target"),
    tags: input(env, "tags"),
    caseIds: input(env, "case-ids"),
    sync: input(env, "sync").toLowerCase(),
    waitForUrl: input(env, "wait-for-url") || "120",
    timeoutMinutes: input(env, "timeout-minutes") || "15",
    retries: input(env, "retries"),
    onError: input(env, "on-error").toLowerCase() || "block",
    failOn: input(env, "fail-on").toLowerCase() || "fail",
    comment: input(env, "comment").toLowerCase() || "true",
    shareLinks: input(env, "share-links").toLowerCase(),
    githubToken: input(env, "github-token")
  };
}
function readContext(env, event) {
  return {
    eventName: env.GITHUB_EVENT_NAME ?? "",
    ref: env.GITHUB_REF ?? "",
    actor: env.GITHUB_ACTOR ?? "",
    repository: env.GITHUB_REPOSITORY ?? "",
    event
  };
}
function bool(name, raw) {
  if (raw === "") return void 0;
  if (raw === "true") return true;
  if (raw === "false") return false;
  throw new InputError(`input "${name}" must be true or false, got "${raw}"`);
}
function resolveSync(i, c) {
  const set = bool("sync", i.sync);
  if (set !== void 0) return set;
  const def = c.event.repository?.default_branch;
  return c.eventName === "push" && def !== void 0 && c.ref === `refs/heads/${def}`;
}
function resolveShareLinks(i, c) {
  return bool("share-links", i.shareLinks) ?? c.event.repository?.private === true;
}
function resolveComment(i) {
  return bool("comment", i.comment) ?? true;
}
function secretsWithheld(c) {
  if (!c.eventName.startsWith("pull_request")) return false;
  const pr = c.event.pull_request;
  const headRepo = pr?.head?.repo;
  const fork = headRepo ? headRepo.fork === true || headRepo.full_name !== c.repository : false;
  return fork || c.actor === "dependabot[bot]";
}
function intIn(name, raw, min, max) {
  const n = Number(raw);
  if (raw === "" || !Number.isInteger(n) || n < min || n > max) {
    throw new InputError(`input "${name}" must be a whole number from ${min} to ${max}, got "${raw}"`);
  }
  return n;
}
function mapToCliArgs(i, sync, fileExists, reports) {
  if (i.onError !== "block" && i.onError !== "neutral") {
    throw new InputError(`input "on-error" must be block or neutral, got "${i.onError}"`);
  }
  if (i.failOn !== "fail" && i.failOn !== "never") {
    throw new InputError(`input "fail-on" must be fail or never, got "${i.failOn}"`);
  }
  const args = ["test", "--json", "--markdown", reports.markdown];
  const flag = (name, value) => {
    if (value !== "") args.push(`--${name}`, value);
  };
  if (i.file !== DEFAULT_FILE || fileExists) args.push("--file", i.file);
  flag("url", i.url);
  flag("workflow", i.workflow);
  flag("target", i.target);
  flag("tags", i.tags);
  flag("case-ids", i.caseIds);
  if (sync) args.push("--sync");
  if (i.retries !== "") args.push("--retries", String(intIn("retries", i.retries, 0, 2)));
  args.push("--timeout-minutes", String(intIn("timeout-minutes", i.timeoutMinutes, 1, 360)));
  args.push("--on-error", i.onError);
  let waitSeconds = 0;
  if (i.waitForUrl !== "false" && i.waitForUrl !== "0") {
    waitSeconds = intIn("wait-for-url", i.waitForUrl === "true" ? "120" : i.waitForUrl, 1, 180);
    args.push("--wait-for-url", "--wait-for-url-timeout", String(waitSeconds));
  }
  return { args, waitSeconds };
}

// src/outcome.ts
function outcomeFor(cliCode, run2, failOn) {
  if (cliCode === 0) {
    if (run2?.verdict === "error" || run2?.verdict === "running") {
      return {
        verdict: "error",
        exitCode: 0,
        level: "warning",
        message: "Could not test (not an app failure). The job passes because on-error is neutral."
      };
    }
    return { verdict: "pass", exitCode: 0, level: "notice" };
  }
  if (cliCode === 1) {
    return failOn === "never" ? {
      verdict: "fail",
      exitCode: 0,
      level: "warning",
      message: "A required case failed. The job passes because fail-on is never."
    } : { verdict: "fail", exitCode: 1, level: "error", message: "A required case failed." };
  }
  if (cliCode === 2) {
    return failOn === "never" ? {
      verdict: "error",
      exitCode: 0,
      level: "warning",
      message: "Could not test (not an app failure). The job passes because fail-on is never."
    } : {
      verdict: "error",
      exitCode: 2,
      level: "error",
      message: "Could not test (not an app failure): see the report for why."
    };
  }
  return {
    verdict: "setup",
    exitCode: 3,
    level: "error",
    message: "Setup problem: see the lines above (the app was not tested)."
  };
}

// src/report.ts
function dashboardUrl(markdown) {
  return /^- Dashboard: (\S+)\s*$/m.exec(markdown)?.[1] ?? "";
}
var MAX_LINKS = 10;
var SEVEN_DAYS = 7 * 86400;
async function replayLinks(d, cases) {
  const out = [];
  const bad = cases.filter((c) => c.verdict === "fail" && c.required !== false && c.sessionId);
  for (const c of bad.slice(0, MAX_LINKS)) {
    try {
      const res = await d.fetch(`${d.apiUrl.replace(/\/+$/, "")}/v1/sessions/${c.sessionId}/share`, {
        method: "POST",
        headers: { authorization: `Bearer ${d.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({ kind: "replay", ttlSeconds: SEVEN_DAYS })
      });
      if (!res.ok) continue;
      const body = await res.json();
      if (body.url) out.push({ caseId: c.caseId, url: body.url });
    } catch {
    }
  }
  return out;
}
var footer = (buildUrl) => `Re-run: push a commit, or "Re-run jobs" in Actions${buildUrl ? ` \xB7 [This job](${buildUrl})` : ""}`;
function finalBody(p) {
  const lines = [marker(p.workflowKey), p.report.trimEnd(), ""];
  if (p.links.length > 0) {
    lines.push(
      "Replays (anyone with the link can watch, 7 days):",
      ...p.links.map((l) => `- ${l.caseId}: ${l.url}`),
      ""
    );
  }
  lines.push(footer(p.buildUrl), "");
  return lines.join("\n");
}
function runningBody(workflowKey, url, sha, buildUrl) {
  return [
    marker(workflowKey),
    `Lookover QA \xB7 RUNNING${url ? ` \xB7 testing ${url}` : ""}${sha ? ` \xB7 commit ${sha.slice(0, 7)}` : ""}`,
    "",
    `The result replaces this comment when the run ends.${buildUrl ? ` [Watch the job](${buildUrl})` : ""}`,
    ""
  ].join("\n");
}
function notRunBody(workflowKey, problem, buildUrl) {
  return [
    marker(workflowKey),
    "Lookover QA \xB7 NOT RUN \xB7 setup problem (your app was not tested)",
    "",
    ...problem.length > 0 ? problem.map((l) => `- ${l}`) : ["- See the job log."],
    "",
    `Fix it and push again. ${footer(buildUrl)}`,
    ""
  ].join("\n");
}
function setupLines(stderr) {
  const out = [];
  let on = false;
  for (const raw of stderr.split("\n")) {
    if (raw.startsWith("Setup problem:")) {
      on = true;
      out.push(raw.replace(/^Setup problem:\s*/, ""));
    } else if (on && raw.startsWith("  - ")) {
      out.push(raw.slice(4));
    } else {
      on = false;
    }
  }
  return out;
}
var noticeForFork = "Lookover QA was skipped: this pull request comes from a fork (or Dependabot), so GitHub does not give the job the API key secret. Nothing was tested and nothing failed. The check runs when a maintainer pushes the branch to this repo.";
var HEADING = {
  pass: "PASS",
  fail: "FAIL",
  error: "COULD NOT TEST (not an app failure)",
  setup: "NOT RUN (setup problem, your app was not tested)",
  skipped: "SKIPPED"
};
function summaryFor(o, text) {
  return `### Lookover QA \xB7 ${HEADING[o.verdict]}

${text}
`;
}

// src/run.ts
var DEFAULT_API_URL = "https://webagent-staging-in-api.lookover.ai";
var ANNOTATE = { notice: "notice", warning: "warning", error: "error" };
var esc = (s) => s.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
function parseRun(stdout) {
  const text = stdout.trim();
  if (!text.startsWith("{")) return void 0;
  try {
    return JSON.parse(text);
  } catch {
    return void 0;
  }
}
function workflowKeyOf(fileText) {
  return fileText ? /^key:\s*["']?([A-Za-z0-9_-]{1,64})["']?\s*(#.*)?$/m.exec(fileText)?.[1] : void 0;
}
async function run(d) {
  const inputs = readInputs(d.env);
  const ctx = readContext(d.env, d.event);
  const buildUrl = d.env.GITHUB_REPOSITORY && d.env.GITHUB_RUN_ID ? `${(d.env.GITHUB_SERVER_URL || "https://github.com").replace(/\/+$/, "")}/${d.env.GITHUB_REPOSITORY}/actions/runs/${d.env.GITHUB_RUN_ID}` : "";
  const finish = async (verdict, code, runId = "", runUrl = "", flaky = 0) => {
    await d.setOutput("verdict", verdict);
    await d.setOutput("run-id", runId);
    await d.setOutput("run-url", runUrl);
    await d.setOutput("flaky", String(flaky));
    return code;
  };
  if (inputs.apiKey === "") {
    if (secretsWithheld(ctx)) {
      d.log(`::notice title=Lookover QA skipped::${esc(noticeForFork)}`);
      await d.appendSummary(`### Lookover QA \xB7 skipped

${noticeForFork}
`);
      return finish("skipped", 0);
    }
    const msg = "api-key is empty. Create a key in the dashboard (API keys), save it as the repository secret WEBAGENT_API_KEY and pass `api-key: ${{ secrets.WEBAGENT_API_KEY }}`.";
    d.log(`::error title=Lookover QA setup problem::${esc(msg)}`);
    await d.appendSummary(summaryFor({ verdict: "setup" }, msg));
    return finish("setup", 3);
  }
  d.log(`::add-mask::${inputs.apiKey}`);
  const reportPath = `${d.tmpDir}/report.md`;
  let mapped;
  let shareLinks;
  let wantComment;
  try {
    const sync = resolveSync(inputs, ctx);
    const fileText = await d.readText(inputs.file);
    mapped = mapToCliArgs(inputs, sync, fileText !== void 0, { markdown: reportPath });
    shareLinks = resolveShareLinks(inputs, ctx);
    wantComment = resolveComment(inputs);
  } catch (e) {
    if (!(e instanceof InputError)) throw e;
    d.log(`::error title=Lookover QA setup problem::${esc(e.message)}`);
    await d.appendSummary(summaryFor({ verdict: "setup" }, e.message));
    return finish("setup", 3);
  }
  const workflowKey = inputs.workflow || workflowKeyOf(await d.readText(inputs.file)) || "tests";
  const gh = {
    fetch: d.fetch,
    apiUrl: d.env.GITHUB_API_URL || "https://api.github.com",
    repo: ctx.repository,
    token: inputs.githubToken
  };
  let pr;
  let commenting = wantComment && inputs.githubToken !== "" && ctx.repository !== "";
  const sha = d.event.pull_request?.head?.sha ?? d.event.deployment?.sha ?? d.env.GITHUB_SHA ?? "";
  if (commenting) {
    pr = d.event.pull_request?.number ?? (ctx.eventName.startsWith("pull_request") ? d.event.number : void 0);
    if (pr === void 0 && ctx.eventName === "deployment_status" && sha) {
      pr = await pullForCommit(gh, sha);
    }
    if (pr === void 0) commenting = false;
  }
  const comment = async (body) => {
    if (!commenting || pr === void 0) return;
    const res2 = await upsertComment(gh, pr, marker(workflowKey), body);
    if (res2.status === "skipped") {
      commenting = false;
      d.log(`::notice title=Lookover QA comment skipped::${esc(`No PR comment: ${res2.reason}.`)}`);
    }
  };
  await comment(runningBody(workflowKey, inputs.url, sha, buildUrl));
  const env = { ...d.env, WEBAGENT_API_KEY: inputs.apiKey };
  if (inputs.apiUrl) env.WEBAGENT_API_URL = inputs.apiUrl;
  const res = await d.runCli(mapped.args, env);
  const runJson = parseRun(res.stdout);
  const report = await d.readText(reportPath);
  const out = outcomeFor(res.code, runJson, inputs.failOn);
  const url = report ? dashboardUrl(report) : "";
  if (report) {
    const links = shareLinks ? await replayLinks(
      { fetch: d.fetch, apiUrl: inputs.apiUrl || d.env.WEBAGENT_API_URL || DEFAULT_API_URL, apiKey: inputs.apiKey },
      runJson?.cases ?? []
    ) : [];
    await d.appendSummary(`${report.trimEnd()}
`);
    await comment(finalBody({ workflowKey, report, links, buildUrl }));
  } else if (out.verdict === "setup") {
    const lines = setupLines(res.stderr);
    await d.appendSummary(summaryFor(out, lines.map((l) => `- ${l}`).join("\n") || "See the job log."));
    await comment(notRunBody(workflowKey, lines, buildUrl));
  } else {
    const text = "# Lookover QA \xB7 could not test\n\nNo report was produced (the job was stopped or the CLI crashed). See the job log.\n";
    await d.appendSummary(text);
    await comment(finalBody({ workflowKey, report: text, links: [], buildUrl }));
  }
  if (out.message) {
    d.log(`::${ANNOTATE[out.level]} title=Lookover QA::${esc(out.message)}`);
  }
  return finish(out.verdict, out.exitCode, runJson?.id ?? "", url, runJson?.counts?.flaky ?? 0);
}

// src/main.ts
async function readText(path) {
  try {
    return await (0, import_promises.readFile)(path, "utf8");
  } catch {
    return void 0;
  }
}
function runCli(args, env) {
  return new Promise((resolve) => {
    const child = (0, import_node_child_process.spawn)(process.execPath, [(0, import_node_path.join)(__dirname, "webagent.cjs"), ...args], {
      env,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (b) => {
      stdout += b.toString("utf8");
    });
    child.stderr.on("data", (b) => {
      stderr += b.toString("utf8");
      process.stdout.write(b);
    });
    const forward = (sig) => () => child.kill(sig);
    const onInt = forward("SIGINT");
    const onTerm = forward("SIGTERM");
    process.on("SIGINT", onInt);
    process.on("SIGTERM", onTerm);
    child.on("error", (e) => {
      stderr += `Setup problem: could not start the bundled CLI: ${e.message}
`;
      resolve({ code: 3, stdout, stderr });
    });
    child.on("close", (code) => {
      process.off("SIGINT", onInt);
      process.off("SIGTERM", onTerm);
      resolve({ code, stdout, stderr });
    });
  });
}
async function main() {
  const env = process.env;
  const eventText = env.GITHUB_EVENT_PATH ? await readText(env.GITHUB_EVENT_PATH) : void 0;
  let event = {};
  try {
    event = eventText ? JSON.parse(eventText) : {};
  } catch {
  }
  const append = (file) => async (text) => {
    if (file) await (0, import_promises.appendFile)(file, text, "utf8");
  };
  const summary = append(env.GITHUB_STEP_SUMMARY);
  const output = append(env.GITHUB_OUTPUT);
  return run({
    env,
    fetch: (...a) => globalThis.fetch(...a),
    event,
    readText,
    runCli,
    appendSummary: summary,
    setOutput: (name, value) => output(`${name}=${value.replace(/[\r\n]+/g, " ")}
`),
    log: (l) => console.log(l),
    tmpDir: await (0, import_promises.mkdtemp)((0, import_node_path.join)(env.RUNNER_TEMP || (0, import_node_os.tmpdir)(), "lookover-qa-"))
  });
}
main().then(
  (code) => {
    process.exitCode = code;
  },
  (err) => {
    console.log(`::error title=Lookover QA::${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 3;
  }
);
