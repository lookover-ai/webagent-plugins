/** Action inputs (read from `INPUT_*`), the repo context they depend on, and the CLI flags they map to. */

export class InputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InputError";
  }
}

export const DEFAULT_FILE = ".webagent/tests.yaml";

export interface Inputs {
  apiKey: string;
  apiUrl: string;
  url: string;
  file: string;
  workflow: string;
  target: string;
  tags: string;
  caseIds: string;
  /** `""` means auto: on only for a push to the default branch. */
  sync: string;
  waitForUrl: string;
  timeoutMinutes: string;
  retries: string;
  onError: string;
  failOn: string;
  comment: string;
  /** `""` means auto: on for private repos only. */
  shareLinks: string;
  githubToken: string;
}

type Env = Record<string, string | undefined>;

/** GitHub turns `wait-for-url` into `INPUT_WAIT-FOR-URL` (spaces to `_`, upper case, dashes kept). */
function input(env: Env, name: string): string {
  return (env[`INPUT_${name.toUpperCase()}`] ?? "").trim();
}

export function readInputs(env: Env): Inputs {
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
    githubToken: input(env, "github-token"),
  };
}

/** The parts of the GitHub event payload the Action reads; anything may be missing. */
export interface GithubEvent {
  number?: number;
  pull_request?: {
    number?: number;
    head?: { sha?: string; repo?: { full_name?: string; fork?: boolean } | null };
  };
  repository?: { private?: boolean; default_branch?: string; full_name?: string };
}

export interface RepoContext {
  eventName: string;
  ref: string;
  actor: string;
  repository: string;
  event: GithubEvent;
}

export function readContext(env: Env, event: GithubEvent): RepoContext {
  return {
    eventName: env.GITHUB_EVENT_NAME ?? "",
    ref: env.GITHUB_REF ?? "",
    actor: env.GITHUB_ACTOR ?? "",
    repository: env.GITHUB_REPOSITORY ?? "",
    event,
  };
}

function bool(name: string, raw: string): boolean | undefined {
  if (raw === "") return undefined;
  if (raw === "true") return true;
  if (raw === "false") return false;
  throw new InputError(`input "${name}" must be true or false, got "${raw}"`);
}

/** `sync` on: set explicitly, else only for a push to the repo's default branch. */
export function resolveSync(i: Inputs, c: RepoContext): boolean {
  const set = bool("sync", i.sync);
  if (set !== undefined) return set;
  const def = c.event.repository?.default_branch;
  return c.eventName === "push" && def !== undefined && c.ref === `refs/heads/${def}`;
}

/** Share links are bearer links: off by default on public repos (and when the repo's privacy is unknown). */
export function resolveShareLinks(i: Inputs, c: RepoContext): boolean {
  return bool("share-links", i.shareLinks) ?? c.event.repository?.private === true;
}

export function resolveComment(i: Inputs): boolean {
  return bool("comment", i.comment) ?? true;
}

/** True when the key is empty because GitHub withholds secrets: a fork PR, or one opened by Dependabot. */
export function secretsWithheld(c: RepoContext): boolean {
  if (!c.eventName.startsWith("pull_request")) return false;
  const pr = c.event.pull_request;
  const headRepo = pr?.head?.repo;
  const fork = headRepo ? headRepo.fork === true || headRepo.full_name !== c.repository : false;
  return fork || c.actor === "dependabot[bot]";
}

export interface Mapped {
  args: string[];
  /** Seconds to wait for the preview, 0 for no wait. */
  waitSeconds: number;
}

function intIn(name: string, raw: string, min: number, max: number): number {
  const n = Number(raw);
  if (raw === "" || !Number.isInteger(n) || n < min || n > max) {
    throw new InputError(`input "${name}" must be a whole number from ${min} to ${max}, got "${raw}"`);
  }
  return n;
}

/**
 * Inputs to CLI flags. `fileExists` tells whether the default tests file is in the checkout: a missing default file is
 * left out of the flags so the CLI can run a saved workflow (`workflow:` with no file); a missing file the user named is an error.
 */
export function mapToCliArgs(
  i: Inputs,
  sync: boolean,
  fileExists: boolean,
  reports: { markdown: string },
): Mapped {
  if (i.onError !== "block" && i.onError !== "neutral") {
    throw new InputError(`input "on-error" must be block or neutral, got "${i.onError}"`);
  }
  if (i.failOn !== "fail" && i.failOn !== "never") {
    throw new InputError(`input "fail-on" must be fail or never, got "${i.failOn}"`);
  }
  const args = ["test", "--json", "--markdown", reports.markdown];
  const flag = (name: string, value: string) => {
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
