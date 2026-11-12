---
name: qa-test
description: Test the web app you are building in a real cloud browser through webagent's MCP tools, read the QA report, fix the bugs and re-run only the failed cases. Use when the user asks to test, smoke test, QA, verify or check a page or flow (signup, login, checkout, a form) in a web app, after you build or change UI, or before a release.
argument-hint: [what to test]
---

# QA with webagent

You know the code, so you decide **what** to test. webagent decides **how** (cloud browser, QA engine) and keeps the
evidence. The tools are the MCP server `webagent` (Claude Code lists them as `mcp__plugin_webagent_webagent__<tool>`;
below they are bare names). Tool table, report fields, error codes, tests.yaml format: [reference.md](reference.md).

Hard rules, always:
- Never paste a secret (API key, password, token, `.env` value) into a tool call, a step, a goal or your answer. Goal and
  step text is stored with the run. Test accounts come from the webagent vault (by namespace) or a throwaway account the
  user named in this conversation.
- `fail` = the app is wrong. `error` = the test could not run (CAPTCHA, `navigation_blocked`, capacity, timeout, browser
  failure). **Never report `error` as an app bug.** Never try to get past a CAPTCHA or bot check.
- Close what you open: `stop_session` for every session you left open, kill every tunnel you started.

## 0. Is webagent connected?
If the `webagent` tools are not in your tool list, or a call says 401 / unauthorized: tell the user once, then stop:
create a key (member role is enough) in the webagent dashboard, run `export WEBAGENT_API_KEY=wa_...` in the shell that
starts Claude Code, restart it, check `/mcp`. Do not guess a key.

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
- Otherwise: cases whose area the diff touches, plus every `tags: [smoke]` / `priority: 1` case. **At most 5 per run**;
  list what you skipped. "all" or "regression" means every case.
- New or changed behaviour with no case: append one to `.webagent/tests.yaml` (`id`, `title`, `steps`, `expect`, `tags`,
  `priority`; plain language, no secrets). Edit an existing case only when the app changed on purpose, and say so.
- A case is what a user does and sees: steps like `click "Sign up"`, `type <unique email> into Email`; expect like
  `the page shows "Welcome"`. Signup needs a unique throwaway address (`qa+<random>@example.com`). A flow that needs a
  real inbox (email code) cannot be tested: mark that part COULD NOT TEST.

## 4. Run
Per case pick one tool.

**A. `smoke_test` (default).** Repeatable, asserted, recorded. One call, one report.
`{ url, steps: [...], expectText?, expectUrl?, expectNoText?, strictLinks: false, waitSeconds? }`
- `url` = target + the case `path`. Steps run after the page loads, in order; the first failed step stops the flow.
- Always set at least one of `expectText` (text that must be there), `expectUrl` (address contains), `expectNoText`
  (an error text that must be absent). Without one the case only proves the page loads.
- Flow cases: `strictLinks: false` (a broken link on the start page would fail a flow test; it stays a finding). Keep one
  page-level case with the default so links get checked.
- Cannot sign in with the vault (refused). Needs login: use B, or put a throwaway login in `steps`.

**B. `run_task` with the QA engine.** For a signed-in case (vault `credentials`), a judgement-based expectation, or a
multi-page flow smoke_test cannot assert.
`{ goal, startUrl, engineId, record: true, credentials?: { namespace, autoSubmit: true }, headers?, maxSteps?, waitSeconds? }`
- `engineId` is the built-in `qa` engine: `eng_<region>_00000000qa00000000000000`, `<region>` = the two letters in any id
  webagent returned (`sess_in_...` gives `in`). No id yet: run one `smoke_test` first, or omit `engineId`. If the engine is
  rejected as not found, retry without it and say so.
- A task has **no assertions**: verdict `pass` only means the agent says it is done. Put the check in the goal and end it
  with: `Answer exactly PASS: <what you saw> or FAIL: <what you saw instead>. If you cannot run the test (CAPTCHA, blocked
  page, missing data) answer COULD NOT TEST: <why>.` Read the `answer`, not only the verdict.
- Several dependent steps on one browser: `create_session {startUrl, engineId, record, credentials}`, then `run_task
  {sessionId, goal}` per step, then `stop_session`. Otherwise one `run_task` per case (it opens and closes its own).

**Tunnel to ngrok free?** Add header `ngrok-skip-browser-warning` (reference.md) or the browser sees ngrok's warning page.

## 5. Wait without burning tokens
- Several cases: put the calls in one message (at most 3 at once; the free plan allows 3 browsers).
- A call waits up to 60 s (`smoke_test`) or 90 s (`run_task`). If it comes back `running`, call
  `get_report { id, waitSeconds: 90 }` and let the server wait. At most 3 such calls per case, then report `error`
  (timeout). Never loop with short waits and never poll in a tight loop.
- Do not print or re-read the whole report. Use `summary`, `verdict`, failed `steps[]` (`title`, `error`), `counts`.
  Open `consoleErrors` and `networkFailures` only for a failed case, first 5. Download a screenshot (`curl` its URL to a
  temp file, then Read it) only when the text does not explain the failure, at most once per failure.
- Console errors and network failures come from a log saved when the session ends. Empty lists plus a note saying the log
  is not available: call `get_report` again after a few seconds before you say there were none.

## 6. Fix loop
1. For each `fail`: decide if the app or the test is wrong. Read the failed step, the `error` and the code. A case that
   expects old text after an intended change is a stale test: update the case, say so.
2. Fix the app code (smallest change). State cause as `file:line`.
3. Re-run **only the failed cases**. Local/tunnel target: the dev server reloads, re-run now. Staging or other remote:
   the fix is not live until deployed. Say so and stop; do not re-run against old code or claim it is fixed.
4. Maximum 2 fix rounds per case. Then report it as still failing with what you tried.
5. `error` cases: do not edit app code. Say why it could not run and what unblocks it (open a tunnel, use a vault login,
   wait for capacity, ask the user to solve the CAPTCHA step by hand).

## 7. Local app: tunnel recipe
Warn the user first, in one line: the tunnel exposes the dev server to the internet while it runs; use test data; the
cases may create records. Then (cloudflared needs no account):
```bash
LOG=$(mktemp); nohup cloudflared tunnel --url http://localhost:PORT >"$LOG" 2>&1 & echo $! >"$LOG.pid"
for i in $(seq 1 30); do URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$LOG" | head -1); [ -n "$URL" ] && break; sleep 1; done; echo "$URL"
```
No cloudflared: `ngrok http PORT` and read the URL from `curl -s localhost:4040/api/tunnels`. Neither installed: tell the user
to install one (do not install software without asking) or to give a public preview URL.
Before testing, `curl -sI "$URL"` until it answers (a new tunnel hostname takes a few seconds). A "host not allowed" page:
the dev server must allow the tunnel host (Vite `server.allowedHosts`, webpack `allowedHosts`, Next `allowedDevOrigins`).
Use `$URL` as the target. **When done, always: `kill $(cat "$LOG.pid")`**, also after a failed run.

## 8. Final summary (always, short)
```
QA <target url> · <n> passed · <n> failed · <n> could not test
PASS  <case id> - <title>
FAIL  <case id> - <title>: <summary line>. Cause <file:line>. <Fixed and re-run: pass | Fix ready, redeploy then /webagent:qa rerun | Still failing after 2 rounds>
COULD NOT TEST  <case id> - <why>. To unblock: <one step>
Evidence: report <reportSignedUrl> (expires <urlsExpireAt>), replay recordingPath (needs your key)
Changed: <files>, tests.yaml: <cases added/edited>. Skipped: <cases>. Tunnel: closed.
```
Say nothing the tool results do not show. A task `pass` is "the agent says it is done", say so.
