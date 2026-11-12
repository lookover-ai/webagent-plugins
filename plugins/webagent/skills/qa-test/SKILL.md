---
name: qa-test
description: Test the web app you are building in a real cloud browser through webagent's MCP tools, read the QA report, fix the bugs and re-run only the failed cases. Use when the user asks to test, smoke test, QA, verify or check a page or flow (signup, login, checkout, a form) in a web app, after you build or change UI, or before a release.
argument-hint: [what to test]
---

# QA with webagent

You know the code, so you decide **what** to test. webagent decides **how** (cloud browser, QA engine) and keeps the
evidence. The tools are the MCP server `webagent` (Claude Code lists them as `mcp__plugin_webagent_webagent__<tool>`;
below they are bare names). Tool table, report fields, error codes, `tests.yaml` format (priorities 1 to 5, `checks`, `url` shorthand): [reference.md](reference.md).

Hard rules, always:
- Never paste a secret (API key, password, token, `.env` value) into a tool call, a step, a goal or your answer. Goal and
  step text is stored with the run. Test accounts come from the webagent vault (by namespace) or a throwaway account the
  user named in this conversation.
- `fail` = the app is wrong. `error` = the test could not run (CAPTCHA, `navigation_blocked`, capacity, timeout, browser
  failure). **Never report `error` as an app bug.** Never try to get past a CAPTCHA or bot check.
- Close what you open: `stop_session` for every session you left open, kill every tunnel you started.

## 0. Is webagent connected?
If the `webagent` tools are not in your tool list, or a call says 401 / unauthorized: tell the user once, then stop. They
set the key in Claude Code: `/plugin configure webagent@webagent` (webagent API key, from the dashboard; member role is
enough), then restart and check `/mcp`. Do not guess a key, do not ask them to paste it in chat.

## 1. Pick the target URL
Order: a URL the user gave > `.webagent/tests.yaml` `targets` (the env they named; else `local` if its dev server answers;
else the first) > ask one short question.
**Local or private URL** (`localhost`, `127.*`, `10.*`, `192.168.*`, `172.16-31.*`, `*.local`, `*.internal`): webagent's
browser can never reach it (SSRF guard, no override). Do not call a tool with it. Open a tunnel first (section 7).

## 2. Read context (cheap, once)
- `.webagent/product.md` and `.webagent/tests.yaml` if they exist. If not, carry on with cases from the diff and suggest
  `/webagent:qa-init` in your summary. Do not block on it.
- `git status --short` and `git diff --stat` (on a feature branch also `git diff <base>...HEAD --stat`). Read only the
  changed route, page, form and handler files you need to write good steps. Do not read the whole repo.

## 3. Choose cases
- The user named something: that, plus the nearest `tests.yaml` case.
- Otherwise: cases whose area the diff touches, plus every `tags: [smoke]` / `priority: 1` case (priority runs 1 = most important to 5, default 3). **At most 10 per run**;
  list what you skipped. "all" or "regression" means every case (in calls of up to 20).
- New or changed behaviour with no case: append one to `.webagent/tests.yaml` (`title` is the only required field; add `id`, `steps`, `expect`, `tags`,
  `priority`; plain language, no secrets; only fields from the format in reference.md). Edit an existing case only when the app changed on purpose, and say so.
- A case is what a user does and sees: steps like `click "Sign up"`, `type <unique email> into Email`; expect like
  `the page shows "Welcome"`. Signup needs a unique throwaway address (`qa+<random>@example.com`). A flow that needs a
  real inbox (email code) cannot be tested: mark that part COULD NOT TEST.

## 4. Run: one `qa_run` for the whole set
**Default: ONE `qa_run` call with every chosen case** (at most 20 per call; more: a second call). The server derives case ids, defaults
`path` and `steps`, queues the cases (3 at a time), asserts, and records. The verdict comes from the report, never from your reading of
a transcript. (A goal-driven `run_task` said `pass` on a broken checkout in 3 of 6 test runs.)
**Do not fill `id`, `path` or `steps` yourself.** Send the cases as the file has them. Only `title` is required.

**A. `.webagent/tests.yaml` exists: send the file.**
- **Every case of the file (user said "all", or you chose them all; the file has at most 20 cases):** Read the file and send its text
  **exactly as it reads**, not re-written as JSON: `qa_run { testsYaml: <raw text, at most 64 KB>, target?: <name>, url?: <override> }`. The
  server parses it. A YAML mistake comes back as `invalid_input` with the line and column: fix that line in the file (or the text) and send again.
- **Only some cases:** `caseIds` and `tags` do not work with `testsYaml` / `testsFile` (they are for a saved `workflowId`). Parse the file,
  keep only the chosen cases in `cases`, and call `qa_run { testsFile: <that object>, target?: <name>, url?: <override> }`. More than 20
  cases in the file: this path too, in calls of up to 20.
- `target` = the environment name the user gave (default: the file's `defaultTarget`). `url` replaces that target's address: set it
  to the tunnel URL for a local target (section 7) or to a URL the user gave. A file with no `targets`/`url` takes `url` as its site.
- Leave `engine`, `concurrency`, `name` in the file: the server reads them. Pass `engineId` only to override (order: `tests.yaml`
  `engine` > `.webagent/config.yaml` `engine` > `qa`). `maxCostUsdPerCase` in the file is applied (a case stops when its model spend passes it).
- Leave `signedIn` cases in the file you send: the server skips them and says so (`Warning:` line, `structuredContent.warnings`). Run
  those yourself as in D.

**B. No tests.yaml, or cases you wrote from the diff: send `cases`.** `qa_run { url, cases: [{ title, path?, steps?, expect | checks, tags?, priority? }] }`.
`expect` goes through **unchanged** (the server reads it; do not split it into `checks` yourself). `signedIn` is refused in `cases`: run
that case as in D.

**C. Headers (ngrok, a WAF or staging gate): `session: { headers: [{ hosts: ["<tunnel host>"], headers: { "ngrok-skip-browser-warning": "1" } }] }`**
on `qa_run` (merged with the target's own headers; also allowed with a saved `workflowId`). So an ngrok tunnel works with `qa_run`: no
`smoke_test` needed. Never put a real secret value in it from memory: ask the user.

**D. `run_task` (QA engine): only to explore an unknown flow, run a `signedIn` case, or when the user asks. Never a pass/fail gate.** A task
has no assertions: `pass` only means the agent says it is done, and a found bug often ends `blocked` (verdict `error`). Report it as
"explored", quote the `answer`, treat consoleErrors/networkFailures as findings. A `FAIL:` answer is worth acting on; a `pass` proves
nothing. Args, goal template, `engineId`: reference.md. For a `signedIn` case use the target's `credentials` namespace:
`run_task { startUrl, credentials: { namespace, autoSubmit: true }, goal }`. For dependent steps on one browser: `create_session`,
`run_task {sessionId, goal}` per step, `stop_session`.

**E. Tunnel page, not your app.** On a tunnel URL a `fail` such as "Expected text not on the page" may be the tunnel's warning page
(ngrok "You are about to visit", Cloudflare "Just a moment"). If the report says so, or the screenshot or `finalUrl` suggests it, the
case is `error` (could not test): add the ngrok header (C) or use cloudflared, re-run.

**Fallback, only when `qa_run` is NOT in your tool list (older server): one `smoke_test` per case.** Mapping and args: reference.md.
Never say a tool exists that you do not see.

**Tell the user where to watch, once per run.** Every run answer has a `Watch live: <url>` line (and `structuredContent.dashboardUrl`). Give
that link in one line when you start the run. Do not repeat it for each poll.
**Warnings.** If the answer has `Warning:` lines, pass them on in your summary (for example "2 signedIn cases were skipped").

## 5. Wait without burning tokens
- One `qa_run` waits up to 60 s (`waitSeconds` up to 90). If it comes back `running`, call `qa_status { id: <wfr_...>, waitSeconds: 90 }`
  and let the server wait. At most 3 such calls, then report the unfinished cases as `error` (timeout) and give the Watch live link.
  Never loop with short waits and never poll in a tight loop. (`run_task`: 90 s, then `get_report { id, waitSeconds: 90 }`.)
- Do not print or re-read the whole run. Use the answer text (rollup + up to 5 failed cases). For one failed case:
  `qa_status { id: <wfr_...>, caseId }` (the `caseId` is in the answer; the server made it from the title). Read `summary`, `verdict`,
  failed `steps[]` (`title`, `error`; task steps also `expected`, `actual`, `url`), `counts`. Open `consoleErrors` and `networkFailures` only for a
  failed case, first 5. Download a screenshot (`curl` its URL to a temp file, then Read it) only when the text does not explain the
  failure, at most once per failure.
- Console errors and network failures come from a log saved when the session ends. Empty lists plus a note saying the log
  is not available: call `qa_status` again after a few seconds before you say there were none.

## 6. Fix loop
1. For each `fail`: decide if the app or the test is wrong. Read the failed step, the `error` and the code. A case that
   expects old text after an intended change is a stale test: update the case, say so.
2. Fix the app code (smallest change). State cause as `file:line`.
3. Re-run **only the failed cases**: the same `qa_run` with only those cases (`testsFile` filtered, or `cases`; not `testsYaml`, it runs the whole file). Local/tunnel target: the dev server reloads, re-run now. Staging or other remote:
   the fix is not live until deployed. Say so and stop; do not re-run against old code or claim it is fixed.
4. Maximum 2 fix rounds per case. Then report it as still failing with what you tried.
5. `error` cases: do not edit app code. Say why it could not run and what unblocks it (open a tunnel, use a vault login,
   wait for capacity, ask the user to solve the CAPTCHA step by hand).

## 7. Local app: tunnel recipe
Warn the user first, in one line: the tunnel exposes the dev server to the internet while it runs; use test data; the
cases may create records. **cloudflared is the default** (no account, no header):
```bash
LOG=$(mktemp); nohup cloudflared tunnel --url http://localhost:PORT >"$LOG" 2>&1 & echo $! >"$LOG.pid"
for i in $(seq 1 30); do URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$LOG" | head -1); [ -n "$URL" ] && break; sleep 1; done; echo "$URL"
```
The URL shows after about 10 s. Then `curl -sI "$URL"` until it answers (a new hostname takes a few more seconds).
**ngrok is second** (needs the user's authtoken): `ngrok http PORT`, URL from `curl -s localhost:4040/api/tunnels`, and every
webagent call needs the `ngrok-skip-browser-warning` header for that host (`session.headers` on `qa_run`, section 4C). Neither installed: tell the user
to install one (do not install software without asking) or give a public preview URL.
A "host not allowed" page: the dev server must allow the tunnel host (Vite `server.allowedHosts`, webpack `allowedHosts`,
Next `allowedDevOrigins`). Use `$URL` as the target. **When done, always: `kill $(cat "$LOG.pid")`** (ngrok: kill its
process), also after a failed run.

## 8. Final summary (always, short)
```
QA <target url> · <n> passed · <n> failed · <n> could not test
PASS  <case id> - <title>
FAIL  <case id> - <title>: <summary line>. Cause <file:line>. <Fixed and re-run: pass | Fix ready, redeploy then /webagent:qa rerun | Still failing after 2 rounds>
COULD NOT TEST  <case id> - <why>. To unblock: <one step>
Watch live / replay: <dashboardUrl>. Evidence: report <reportSignedUrl> (expires <urlsExpireAt>), recordingPath (needs your key)
Warnings: <the Warning: lines, e.g. signedIn cases skipped>
Changed: <files>, tests.yaml: <cases added/edited>. Skipped: <cases>. Tunnel: closed.
```
Say nothing the tool results do not show. A task `pass` is "the agent says it is done", say so.
