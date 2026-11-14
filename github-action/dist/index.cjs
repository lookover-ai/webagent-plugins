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
async function changedFiles(d, pr, max) {
  const out = [];
  try {
    for (let page = 1; out.length < max && page <= Math.ceil(max / 100) + 1; page++) {
      const list = await call(d, "GET", `/repos/${d.repo}/pulls/${pr}/files?per_page=100&page=${page}`);
      if (!Array.isArray(list)) return [];
      for (const f of list) if (typeof f.filename === "string" && f.filename !== "") out.push(f.filename);
      if (list.length < 100) break;
    }
  } catch {
    return [];
  }
  return out.slice(0, max);
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
    failedOnly: input(env, "failed-only").toLowerCase(),
    stopAfter: input(env, "stop-after"),
    sync: input(env, "sync").toLowerCase(),
    waitForUrl: input(env, "wait-for-url") || "120",
    timeoutMinutes: input(env, "timeout-minutes") || "15",
    retries: input(env, "retries"),
    onError: input(env, "on-error").toLowerCase() || "block",
    failOn: input(env, "fail-on").toLowerCase() || "fail",
    mode: input(env, "mode").toLowerCase() || "enforce",
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
  if (i.mode !== "enforce" && i.mode !== "practice") {
    throw new InputError(`input "mode" must be enforce or practice, got "${i.mode}"`);
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
  if (bool("failed-only", i.failedOnly) === true) args.push("--failed-only");
  if (i.stopAfter !== "") args.push("--stop-after", String(intIn("stop-after", i.stopAfter, 1, 500)));
  if (i.retries !== "") args.push("--retries", String(intIn("retries", i.retries, 0, 2)));
  args.push("--timeout-minutes", String(intIn("timeout-minutes", i.timeoutMinutes, 1, 360)));
  args.push("--on-error", "block");
  let waitSeconds = 0;
  if (i.waitForUrl !== "false" && i.waitForUrl !== "0") {
    waitSeconds = intIn("wait-for-url", i.waitForUrl === "true" ? "120" : i.waitForUrl, 1, 180);
    args.push("--wait-for-url", "--wait-for-url-timeout", String(waitSeconds));
  }
  return { args, waitSeconds };
}

// src/outcome.ts
function outcomeFor(cliCode, failOn, onError, mode = "enforce") {
  if (cliCode === 0) return { verdict: "pass", exitCode: 0, level: "notice" };
  if (cliCode === 1) {
    if (mode === "practice") {
      return {
        verdict: "fail",
        exitCode: 0,
        level: "warning",
        message: "A required case failed. The job passes because mode is practice (this check does not block merging yet)."
      };
    }
    return failOn === "never" ? {
      verdict: "fail",
      exitCode: 0,
      level: "warning",
      message: "A required case failed. The job passes because fail-on is never."
    } : { verdict: "fail", exitCode: 1, level: "error", message: "A required case failed." };
  }
  if (cliCode === 2) {
    if (failOn === "never" || onError === "neutral") {
      return {
        verdict: "error",
        exitCode: 0,
        level: "warning",
        message: `Could not test (not an app failure). The job passes because ${failOn === "never" ? "fail-on is never" : "on-error is neutral"}.`
      };
    }
    return {
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
async function finalCases(d, runId) {
  if (!runId) return void 0;
  try {
    const res = await d.fetch(`${d.apiUrl.replace(/\/+$/, "")}/v1/workflow-runs/${encodeURIComponent(runId)}`, {
      method: "GET",
      headers: { authorization: `Bearer ${d.apiKey}` }
    });
    if (!res.ok) return void 0;
    const body = await res.json();
    return Array.isArray(body.cases) ? body.cases : void 0;
  } catch {
    return void 0;
  }
}
var PRACTICE_BANNER = "Practice mode: this check does not block merging yet.";
async function replayLinks(d, cases) {
  const out = [];
  const bad = cases.filter((c) => c.verdict === "fail" && c.required !== false && typeof c.sessionId === "string" && c.sessionId !== "");
  for (const c of bad.slice(0, MAX_LINKS)) {
    try {
      const res = await d.fetch(`${d.apiUrl.replace(/\/+$/, "")}/v1/sessions/${encodeURIComponent(c.sessionId ?? "")}/share`, {
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
function summaryBody(p) {
  return `${p.practice ? `${PRACTICE_BANNER}

` : ""}${p.report.trimEnd()}
`;
}
function finalBody(p) {
  const lines = [marker(p.workflowKey), ...p.practice ? [PRACTICE_BANNER, ""] : [], p.report.trimEnd(), ""];
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
function runningBody(workflowKey, url, sha, buildUrl, practice = false) {
  return [
    marker(workflowKey),
    ...practice ? [PRACTICE_BANNER, ""] : [],
    `Lookover QA \xB7 RUNNING${url ? ` \xB7 testing ${url}` : ""}${sha ? ` \xB7 commit ${sha.slice(0, 7)}` : ""}`,
    "",
    `The result replaces this comment when the run ends.${buildUrl ? ` [Watch the job](${buildUrl})` : ""}`,
    ""
  ].join("\n");
}
function cancelledBody(workflowKey, bySha, buildUrl) {
  const sha = bySha.slice(0, 7);
  return [
    marker(workflowKey),
    `Lookover QA \xB7 Cancelled: newer commit${sha ? ` ${sha}` : ""}`,
    "",
    "A newer push started a run for this pull request, so this one stopped. Its result replaces this comment when it ends. The tests that did not run are not billed.",
    "",
    footer(buildUrl),
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
  pass: "Passed",
  fail: "Failed",
  error: "Couldn't test (not an app failure)",
  setup: "NOT RUN (setup problem, your app was not tested)",
  skipped: "SKIPPED"
};
function summaryFor(o, text) {
  return `### Lookover QA \xB7 ${HEADING[o.verdict]}

${text}
`;
}

// src/context.ts
var MAX_TITLE = 200;
var MAX_BODY2 = 2e3;
var MAX_PATH = 300;
var MAX_FILES = 300;
function clip(s, max) {
  return Array.from(s.replace(/\0/g, "")).slice(0, max).join("");
}
async function prContextEnv(gh, ctx) {
  if (ctx.eventName !== "pull_request" && ctx.eventName !== "pull_request_target") return {};
  if (secretsWithheld(ctx)) return {};
  const pr = ctx.event.pull_request;
  const out = {};
  const title = clip(pr?.title ?? "", MAX_TITLE);
  const body = clip(pr?.body ?? "", MAX_BODY2);
  if (title !== "") out.WEBAGENT_CI_TITLE = title;
  if (body !== "") out.WEBAGENT_CI_BODY = body;
  const number = pr?.number ?? ctx.event.number;
  if (number !== void 0 && gh.repo !== "" && gh.token !== "") {
    const files = (await changedFiles(gh, number, MAX_FILES)).map((p) => clip(p.replace(/[\r\n]+/g, " "), MAX_PATH)).filter((p) => p !== "");
    if (files.length > 0) out.WEBAGENT_CI_CHANGED_FILES = files.join("\n");
  }
  return out;
}

// src/run.ts
var DEFAULT_API_URL = "https://webagent-staging-in-api.lookover.ai";
var ANNOTATE = { notice: "notice", warning: "warning", error: "error" };
var esc = (s) => s.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
function parseRun(stdout) {
  const text = stdout.trim();
  if (!text.startsWith("{")) return void 0;
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    return void 0;
  }
  if (typeof raw !== "object" || raw === null) return void 0;
  const r = raw;
  const flaky = r.counts?.flaky;
  const superseded = r.cancelled?.reason === "superseded";
  return {
    id: typeof r.id === "string" ? r.id : "",
    flaky: typeof flaky === "number" && Number.isFinite(flaky) ? flaky : 0,
    cases: Array.isArray(r.cases) ? r.cases : [],
    ...superseded ? { supersededBy: typeof r.cancelled?.bySha === "string" ? r.cancelled.bySha : "" } : {}
  };
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
  if (ctx.eventName === "deployment_status" && inputs.url === "") {
    const ds = d.event.deployment_status;
    if (ds?.state !== "success") {
      const msg = `Lookover QA skipped: the deployment is not ready (state: ${ds?.state ?? "unknown"}). The check runs when the deployment succeeds.`;
      d.log(`::notice title=Lookover QA skipped::${esc(msg)}`);
      await d.appendSummary(`### Lookover QA \xB7 skipped

${msg}
`);
      return finish("skipped", 0);
    }
    inputs.url = (ds.environment_url || ds.target_url || "").trim();
  }
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
  const practice = inputs.mode === "practice";
  await comment(runningBody(workflowKey, inputs.url, sha, buildUrl, practice));
  const env = { ...d.env, WEBAGENT_API_KEY: inputs.apiKey };
  if (inputs.apiUrl) env.WEBAGENT_API_URL = inputs.apiUrl;
  Object.assign(env, await prContextEnv(gh, ctx));
  const res = await d.runCli(mapped.args, env);
  const runJson = parseRun(res.stdout);
  const report = await d.readText(reportPath);
  const out = outcomeFor(
    res.code,
    inputs.failOn,
    inputs.onError,
    inputs.mode
  );
  const url = report ? dashboardUrl(report) : "";
  const setup = out.verdict === "setup" ? setupLines(res.stderr) : [];
  if (runJson?.supersededBy !== void 0 && res.code === 2) {
    const sha2 = runJson.supersededBy;
    if (report) await d.appendSummary(summaryBody({ report, practice }));
    await comment(cancelledBody(workflowKey, sha2, buildUrl));
    const msg = `Cancelled: newer commit${sha2 ? ` ${sha2.slice(0, 7)}` : ""}. The newer run reports on this pull request.`;
    d.log(`::notice title=Lookover QA::${esc(msg)}`);
    return finish("skipped", 0, runJson.id, url, runJson.flaky);
  }
  if (report) {
    let links = [];
    const share = { fetch: d.fetch, apiUrl: inputs.apiUrl || d.env.WEBAGENT_API_URL || DEFAULT_API_URL, apiKey: inputs.apiKey };
    if (shareLinks) {
      links = await replayLinks(share, await finalCases(share, runJson?.id ?? "") ?? runJson?.cases ?? []);
    }
    await d.appendSummary(summaryBody({ report, practice }));
    await comment(finalBody({ workflowKey, report, links, buildUrl, practice }));
  } else if (out.verdict === "setup") {
    await d.appendSummary(summaryFor(out, setup.map((l) => `- ${l}`).join("\n") || "See the job log."));
    await comment(notRunBody(workflowKey, setup, buildUrl));
  } else {
    const text = "# Lookover QA \xB7 Couldn't test\n\nNo report was produced (the job was stopped or the CLI crashed). See the job log.\n";
    await d.appendSummary(summaryBody({ report: text, practice }));
    await comment(finalBody({ workflowKey, report: text, links: [], buildUrl, practice }));
  }
  if (out.message) {
    const message = out.verdict === "setup" && setup.length > 0 ? `Setup problem: ${setup.join(" \xB7 ")}` : out.message;
    d.log(`::${ANNOTATE[out.level]} title=Lookover QA::${esc(message)}`);
  }
  return finish(out.verdict, out.exitCode, runJson?.id ?? "", url, runJson?.flaky ?? 0);
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
