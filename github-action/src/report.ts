/** Text the Action adds around the API's `report.md`: comment bodies, replay links, the run URL. */

import { marker } from "./github.js";
import type { Outcome } from "./outcome.js";

export interface RunCase {
  caseId: string;
  title?: string;
  verdict: string;
  sessionId?: string;
  required?: boolean;
}

/** The dashboard link of the run, read from the report's `- Dashboard: <url>` line (the API builds it). */
export function dashboardUrl(markdown: string): string {
  return /^- Dashboard: (\S+)\s*$/m.exec(markdown)?.[1] ?? "";
}

export interface ShareDeps {
  fetch: typeof fetch;
  apiUrl: string;
  apiKey: string;
}

const MAX_LINKS = 10;
const SEVEN_DAYS = 7 * 86_400;

/**
 * The cases of the settled run, read fresh from the API: a case that was retried points at its LAST attempt's session
 * (the API clears `session_id` on retry and sets the new one), the same as the report's own "Replay:" line.
 * `undefined` when the read fails or has no `cases` (the caller falls back to the CLI's JSON). Never throws.
 */
export async function finalCases(d: ShareDeps, runId: string): Promise<RunCase[] | undefined> {
  if (!runId) return undefined;
  try {
    const res = await d.fetch(`${d.apiUrl.replace(/\/+$/, "")}/v1/workflow-runs/${encodeURIComponent(runId)}`, {
      method: "GET",
      headers: { authorization: `Bearer ${d.apiKey}` },
    });
    if (!res.ok) return undefined;
    const body = (await res.json()) as { cases?: unknown };
    return Array.isArray(body.cases) ? (body.cases as RunCase[]) : undefined;
  } catch {
    return undefined;
  }
}

/** Shown on top of the summary and the comment in `mode: practice`. */
export const PRACTICE_BANNER = "Practice mode: this check does not block merging yet.";

/** A 7-day replay link per failed required case (max 10). A case without a recording yields none; never throws. */
export async function replayLinks(
  d: ShareDeps,
  cases: RunCase[],
): Promise<{ caseId: string; url: string }[]> {
  const out: { caseId: string; url: string }[] = [];
  const bad = cases.filter((c) => c.verdict === "fail" && c.required !== false && c.sessionId);
  for (const c of bad.slice(0, MAX_LINKS)) {
    try {
      const res = await d.fetch(`${d.apiUrl.replace(/\/+$/, "")}/v1/sessions/${c.sessionId}/share`, {
        method: "POST",
        headers: { authorization: `Bearer ${d.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({ kind: "replay", ttlSeconds: SEVEN_DAYS }),
      });
      if (!res.ok) continue;
      const body = (await res.json()) as { url?: string };
      if (body.url) out.push({ caseId: c.caseId, url: body.url });
    } catch {
      /* the replay link is a bonus */
    }
  }
  return out;
}

export interface BodyParts {
  workflowKey: string;
  /** The run's `report.md`. */
  report: string;
  links: { caseId: string; url: string }[];
  buildUrl: string;
  /** `mode: practice`: the banner goes on top. */
  practice?: boolean;
}

const footer = (buildUrl: string): string =>
  `Re-run: push a commit, or "Re-run jobs" in Actions${buildUrl ? ` · [This job](${buildUrl})` : ""}`;

/** Job summary text of a finished run: the report (it carries the cost and time line itself) with the practice banner on top. */
export function summaryBody(p: Pick<BodyParts, "report" | "practice">): string {
  return `${p.practice ? `${PRACTICE_BANNER}\n\n` : ""}${p.report.trimEnd()}\n`;
}

/** The sticky comment once the run is over. */
export function finalBody(p: BodyParts): string {
  const lines = [marker(p.workflowKey), ...(p.practice ? [PRACTICE_BANNER, ""] : []), p.report.trimEnd(), ""];
  if (p.links.length > 0) {
    lines.push(
      "Replays (anyone with the link can watch, 7 days):",
      ...p.links.map((l) => `- ${l.caseId}: ${l.url}`),
      "",
    );
  }
  lines.push(footer(p.buildUrl), "");
  return lines.join("\n");
}

/** The sticky comment while the run is going (replaced by the final one). */
export function runningBody(workflowKey: string, url: string, sha: string, buildUrl: string, practice = false): string {
  return [
    marker(workflowKey),
    ...(practice ? [PRACTICE_BANNER, ""] : []),
    `Lookover QA · RUNNING${url ? ` · testing ${url}` : ""}${sha ? ` · commit ${sha.slice(0, 7)}` : ""}`,
    "",
    `The result replaces this comment when the run ends.${buildUrl ? ` [Watch the job](${buildUrl})` : ""}`,
    "",
  ].join("\n");
}

/** Comment (and summary) when no run happened: a setup problem, with the CLI's own lines. */
export function notRunBody(workflowKey: string, problem: string[], buildUrl: string): string {
  return [
    marker(workflowKey),
    "Lookover QA · NOT RUN · setup problem (your app was not tested)",
    "",
    ...(problem.length > 0 ? problem.map((l) => `- ${l}`) : ["- See the job log."]),
    "",
    `Fix it and push again. ${footer(buildUrl)}`,
    "",
  ].join("\n");
}

/** Lines of the CLI's stderr that explain an exit 3: `Setup problem: ...` and its `  - ` detail lines. */
export function setupLines(stderr: string): string[] {
  const out: string[] = [];
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

export const noticeForFork =
  "Lookover QA was skipped: this pull request comes from a fork (or Dependabot), so GitHub does not give the job the API key secret. " +
  "Nothing was tested and nothing failed. The check runs when a maintainer pushes the branch to this repo.";

const HEADING: Record<Outcome["verdict"], string> = {
  pass: "Passed",
  fail: "Failed",
  error: "Couldn't test (not an app failure)",
  setup: "NOT RUN (setup problem, your app was not tested)",
  skipped: "SKIPPED",
};

/** Job summary text when there is no report. */
export function summaryFor(o: Pick<Outcome, "verdict">, text: string): string {
  return `### Lookover QA · ${HEADING[o.verdict]}\n\n${text}\n`;
}
