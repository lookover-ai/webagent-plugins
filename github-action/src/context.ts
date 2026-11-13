/**
 * Pull request context passed to the CLI as environment variables (`WEBAGENT_CI_TITLE`, `WEBAGENT_CI_BODY`,
 * `WEBAGENT_CI_CHANGED_FILES`). The title, body and paths are written by whoever opened the PR: untrusted data.
 * They are only handed to the CLI; the Action never prints them to the log, the summary or the comment.
 */

import { changedFiles, type GithubDeps } from "./github.js";
import { type RepoContext, secretsWithheld } from "./inputs.js";

export const MAX_TITLE = 200;
export const MAX_BODY = 2000;
export const MAX_PATH = 300;
export const MAX_FILES = 300;

/** Cut to `max` characters (not splitting a surrogate pair); NUL is dropped because an environment value cannot hold it. */
function clip(s: string, max: number): string {
  return Array.from(s.replace(/\0/g, "")).slice(0, max).join("");
}

/**
 * Env entries for a non-fork `pull_request` / `pull_request_target` run; `{}` for every other event. Only non-empty values are
 * set. A failing GitHub call leaves the changed files out and never throws.
 */
export async function prContextEnv(gh: GithubDeps, ctx: RepoContext): Promise<Record<string, string>> {
  if (ctx.eventName !== "pull_request" && ctx.eventName !== "pull_request_target") return {};
  if (secretsWithheld(ctx)) return {};
  const pr = ctx.event.pull_request;
  const out: Record<string, string> = {};
  const title = clip(pr?.title ?? "", MAX_TITLE);
  const body = clip(pr?.body ?? "", MAX_BODY);
  if (title !== "") out.WEBAGENT_CI_TITLE = title;
  if (body !== "") out.WEBAGENT_CI_BODY = body;
  const number = pr?.number ?? ctx.event.number;
  if (number !== undefined && gh.repo !== "" && gh.token !== "") {
    const files = (await changedFiles(gh, number, MAX_FILES))
      .map((p) => clip(p.replace(/[\r\n]+/g, " "), MAX_PATH))
      .filter((p) => p !== "");
    if (files.length > 0) out.WEBAGENT_CI_CHANGED_FILES = files.join("\n");
  }
  return out;
}
