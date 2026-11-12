/** GitHub REST calls for the sticky PR comment. Never throws: a comment problem must not fail the job. */

export interface GithubDeps {
  fetch: typeof fetch;
  /** `GITHUB_API_URL`, default `https://api.github.com`. */
  apiUrl: string;
  /** `owner/name`. */
  repo: string;
  token: string;
}

export type CommentResult =
  | { status: "created" | "updated"; id: number }
  | { status: "skipped"; reason: string };

/** Hidden first line of the bot's comment: one comment per workflow key per PR. */
export const marker = (workflowKey: string): string => `<!-- lookover-qa:${workflowKey} -->`;

const MAX_BODY = 60_000;
const MAX_PAGES = 10;

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(d: GithubDeps, method: string, path: string, body?: unknown): Promise<T> {
  const res = await d.fetch(`${d.apiUrl.replace(/\/+$/, "")}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${d.token}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "lookover-qa-action",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!res.ok) {
    let msg = "";
    try {
      msg = ((await res.json()) as { message?: string }).message ?? "";
    } catch {
      /* no body */
    }
    throw new HttpError(res.status, msg || `HTTP ${res.status}`);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

/** A body GitHub accepts (max 65536 characters): cut with a pointer to the full report. */
export function fitBody(body: string): string {
  if (body.length <= MAX_BODY) return body;
  return `${body.slice(0, MAX_BODY)}\n\n_The report was cut to fit a comment. The full report is in the job summary and on the dashboard._\n`;
}

/** The id of the existing comment that starts with this marker, or `undefined`. */
export async function findComment(d: GithubDeps, pr: number, mark: string): Promise<number | undefined> {
  for (let page = 1; page <= MAX_PAGES; page++) {
    const list = await call<{ id: number; body?: string }[]>(
      d,
      "GET",
      `/repos/${d.repo}/issues/${pr}/comments?per_page=100&page=${page}`,
    );
    const hit = list.find((c) => typeof c.body === "string" && c.body.includes(mark));
    if (hit) return hit.id;
    if (list.length < 100) return undefined;
  }
  return undefined;
}

/** Plain sentence for a failed comment call. */
function why(e: unknown): string {
  if (e instanceof HttpError && (e.status === 403 || e.status === 404)) {
    return `GitHub refused (${e.status}: ${e.message}). Give the job \`permissions: pull-requests: write\` to get the PR comment`;
  }
  return e instanceof Error ? e.message : String(e);
}

/** Update the sticky comment, or create it. Skips (with a reason) when GitHub says the token may not comment. */
export async function upsertComment(
  d: GithubDeps,
  pr: number,
  mark: string,
  body: string,
): Promise<CommentResult> {
  const text = fitBody(body);
  try {
    const existing = await findComment(d, pr, mark);
    if (existing !== undefined) {
      try {
        await call(d, "PATCH", `/repos/${d.repo}/issues/comments/${existing}`, { body: text });
        return { status: "updated", id: existing };
      } catch (e) {
        // Someone else's comment (a different token) cannot be edited: fall through and make our own.
        if (!(e instanceof HttpError && (e.status === 403 || e.status === 404))) throw e;
      }
    }
    const made = await call<{ id: number }>(d, "POST", `/repos/${d.repo}/issues/${pr}/comments`, {
      body: text,
    });
    return { status: "created", id: made.id };
  } catch (e) {
    return { status: "skipped", reason: why(e) };
  }
}

/** The open pull request of a commit (for `deployment_status` and push events, which carry no PR number). */
export async function pullForCommit(d: GithubDeps, sha: string): Promise<number | undefined> {
  try {
    const pulls = await call<{ number: number; state?: string }[]>(
      d,
      "GET",
      `/repos/${d.repo}/commits/${sha}/pulls?per_page=10`,
    );
    return pulls.find((p) => p.state === "open")?.number;
  } catch {
    return undefined;
  }
}
