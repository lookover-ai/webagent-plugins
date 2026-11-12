/** The Action's flow, with every outside effect injected so tests can fake it. `main.ts` wires the real ones. */

import { type GithubDeps, marker, pullForCommit, upsertComment } from "./github.js";
import {
  type GithubEvent,
  InputError,
  mapToCliArgs,
  readContext,
  readInputs,
  resolveComment,
  resolveShareLinks,
  resolveSync,
  secretsWithheld,
} from "./inputs.js";
import { outcomeFor, type RunLike, type VerdictOutput } from "./outcome.js";
import {
  dashboardUrl,
  finalBody,
  finalCases,
  noticeForFork,
  notRunBody,
  type RunCase,
  replayLinks,
  runningBody,
  setupLines,
  summaryFor,
} from "./report.js";

/** Same constant as the CLI's `src/constants.ts` (staging until production exists): change both together. */
export const DEFAULT_API_URL = "https://webagent-staging-in-api.lookover.ai";

export interface CliResult {
  /** `null` when the process was killed by a signal. */
  code: number | null;
  stdout: string;
  stderr: string;
}

export interface Deps {
  env: Record<string, string | undefined>;
  fetch: typeof fetch;
  /** The event payload (`GITHUB_EVENT_PATH`), `{}` when absent. */
  event: GithubEvent & { deployment?: { sha?: string } };
  /** Text of a file in the checkout, `undefined` when missing. */
  readText: (path: string) => Promise<string | undefined>;
  /** Run the vendored CLI with these args; streams its stderr to the job log. */
  runCli: (args: string[], env: Record<string, string | undefined>) => Promise<CliResult>;
  /** Append to `GITHUB_STEP_SUMMARY`. */
  appendSummary: (text: string) => Promise<void>;
  /** Append `name=value` to `GITHUB_OUTPUT`. */
  setOutput: (name: string, value: string) => Promise<void>;
  /** Workflow-command lines for the log (`::notice::...`) and plain lines. */
  log: (line: string) => void;
  tmpDir: string;
}

const ANNOTATE = { notice: "notice", warning: "warning", error: "error" } as const;

/** `%`, CR and LF in a workflow-command message must be escaped. */
const esc = (s: string): string => s.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");

function parseRun(stdout: string): (RunLike & { cases?: RunCase[] }) | undefined {
  const text = stdout.trim();
  if (!text.startsWith("{")) return undefined;
  try {
    return JSON.parse(text) as RunLike & { cases?: RunCase[] };
  } catch {
    return undefined;
  }
}

/** `key:` of the tests file (a plain top-level line), which names the sticky comment. */
export function workflowKeyOf(fileText: string | undefined): string | undefined {
  return fileText ? /^key:\s*["']?([A-Za-z0-9_-]{1,64})["']?\s*(#.*)?$/m.exec(fileText)?.[1] : undefined;
}

export async function run(d: Deps): Promise<number> {
  const inputs = readInputs(d.env);
  const ctx = readContext(d.env, d.event);
  const buildUrl =
    d.env.GITHUB_REPOSITORY && d.env.GITHUB_RUN_ID
      ? `${(d.env.GITHUB_SERVER_URL || "https://github.com").replace(/\/+$/, "")}/${d.env.GITHUB_REPOSITORY}/actions/runs/${d.env.GITHUB_RUN_ID}`
      : "";

  const finish = async (verdict: VerdictOutput, code: number, runId = "", runUrl = "", flaky = 0) => {
    await d.setOutput("verdict", verdict);
    await d.setOutput("run-id", runId);
    await d.setOutput("run-url", runUrl);
    await d.setOutput("flaky", String(flaky));
    return code;
  };

  // No key: a fork PR (or Dependabot) never gets secrets: one notice, exit 0, no comment. Anything else is a setup problem.
  if (inputs.apiKey === "") {
    if (secretsWithheld(ctx)) {
      d.log(`::notice title=Lookover QA skipped::${esc(noticeForFork)}`);
      await d.appendSummary(`### Lookover QA · skipped\n\n${noticeForFork}\n`);
      return finish("skipped", 0);
    }
    const msg =
      "api-key is empty. Create a key in the dashboard (API keys), save it as the repository secret WEBAGENT_API_KEY and pass `api-key: ${{ secrets.WEBAGENT_API_KEY }}`.";
    d.log(`::error title=Lookover QA setup problem::${esc(msg)}`);
    await d.appendSummary(summaryFor({ verdict: "setup" }, msg));
    return finish("setup", 3);
  }
  d.log(`::add-mask::${inputs.apiKey}`);

  const reportPath = `${d.tmpDir}/report.md`;
  let mapped: ReturnType<typeof mapToCliArgs>;
  let shareLinks: boolean;
  let wantComment: boolean;
  try {
    const sync = resolveSync(inputs, ctx);
    const fileText = await d.readText(inputs.file);
    mapped = mapToCliArgs(inputs, sync, fileText !== undefined, { markdown: reportPath });
    shareLinks = resolveShareLinks(inputs, ctx);
    wantComment = resolveComment(inputs);
  } catch (e) {
    if (!(e instanceof InputError)) throw e;
    d.log(`::error title=Lookover QA setup problem::${esc(e.message)}`);
    await d.appendSummary(summaryFor({ verdict: "setup" }, e.message));
    return finish("setup", 3);
  }
  const workflowKey =
    inputs.workflow || workflowKeyOf(await d.readText(inputs.file)) || "tests";

  // The sticky comment. Any trouble (no permission, no PR) is one notice, never a failed job.
  const gh: GithubDeps = {
    fetch: d.fetch,
    apiUrl: d.env.GITHUB_API_URL || "https://api.github.com",
    repo: ctx.repository,
    token: inputs.githubToken,
  };
  let pr: number | undefined;
  let commenting = wantComment && inputs.githubToken !== "" && ctx.repository !== "";
  const sha = d.event.pull_request?.head?.sha ?? d.event.deployment?.sha ?? d.env.GITHUB_SHA ?? "";
  if (commenting) {
    pr = d.event.pull_request?.number ?? (ctx.eventName.startsWith("pull_request") ? d.event.number : undefined);
    if (pr === undefined && ctx.eventName === "deployment_status" && sha) {
      pr = await pullForCommit(gh, sha);
    }
    if (pr === undefined) commenting = false; // not a PR run: the summary and outputs are enough
  }
  const comment = async (body: string) => {
    if (!commenting || pr === undefined) return;
    const res = await upsertComment(gh, pr, marker(workflowKey), body);
    if (res.status === "skipped") {
      commenting = false;
      d.log(`::notice title=Lookover QA comment skipped::${esc(`No PR comment: ${res.reason}.`)}`);
    }
  };

  await comment(runningBody(workflowKey, inputs.url, sha, buildUrl));

  const env: Record<string, string | undefined> = { ...d.env, WEBAGENT_API_KEY: inputs.apiKey };
  if (inputs.apiUrl) env.WEBAGENT_API_URL = inputs.apiUrl;
  const res = await d.runCli(mapped.args, env);

  const runJson = parseRun(res.stdout);
  const report = await d.readText(reportPath);
  const out = outcomeFor(res.code, runJson, inputs.failOn as "fail" | "never");
  const url = report ? dashboardUrl(report) : "";

  if (report) {
    let links: { caseId: string; url: string }[] = [];
    if (shareLinks) {
      const share = { fetch: d.fetch, apiUrl: inputs.apiUrl || d.env.WEBAGENT_API_URL || DEFAULT_API_URL, apiKey: inputs.apiKey };
      // Links follow the settled run (a retried case's LAST attempt), not the CLI's copy; the CLI's JSON is the fallback.
      const settled = await finalCases(share, runJson?.id ?? "");
      links = await replayLinks(share, settled ?? runJson?.cases ?? []);
    }
    await d.appendSummary(`${report.trimEnd()}\n`);
    await comment(finalBody({ workflowKey, report, links, buildUrl }));
  } else if (out.verdict === "setup") {
    const lines = setupLines(res.stderr);
    await d.appendSummary(summaryFor(out, lines.map((l) => `- ${l}`).join("\n") || "See the job log."));
    await comment(notRunBody(workflowKey, lines, buildUrl));
  } else {
    const text = "# Lookover QA · could not test\n\nNo report was produced (the job was stopped or the CLI crashed). See the job log.\n";
    await d.appendSummary(text);
    await comment(finalBody({ workflowKey, report: text, links: [], buildUrl }));
  }

  if (out.message) {
    d.log(`::${ANNOTATE[out.level]} title=Lookover QA::${esc(out.message)}`);
  }
  return finish(out.verdict, out.exitCode, runJson?.id ?? "", url, runJson?.counts?.flaky ?? 0);
}
