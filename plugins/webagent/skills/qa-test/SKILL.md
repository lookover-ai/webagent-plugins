---
name: qa-test
description: Test the web app you are building in a real cloud browser with Lookover QA (MCP server lookover-qa), read the report, fix the bugs and re-run only the failed tests. Use when the user asks to test, smoke test, QA, verify or check a page or flow (signup, login, checkout, a form) in a web app, after you build or change UI, or before a release.
argument-hint: [what to test]
---

# QA with Lookover QA

You know the code, so you decide **what** to test. Lookover QA decides **how** (cloud browser) and keeps the evidence. The tools
are the MCP server `lookover-qa` (Claude Code lists them as `mcp__plugin_webagent_lookover-qa__<tool>`, or
`mcp__plugin_webagent_lookover-qa-key__<tool>` when the user set an API key; same tools; below they are bare names). Tool table,
report fields, error codes, `tests.yaml` format: [reference.md](reference.md).

Hard rules, always:
- Never paste a secret (API key, password, token, `.env` value) into a tool call, a step, a note or your answer. Test accounts are
  saved by the person with `add_login`; you never see the password. Text you send is stored with the run.
- `Failed` = the app is wrong. `Couldn't test` = the test could not run (CAPTCHA, blocked address, capacity, timeout, browser failure).
  **Never report `Couldn't test` as an app bug.** Never try to get past a CAPTCHA or bot check.
- Never say a test passed before `get_run` says so. Every answer ends with a `next:` line and a dashboard link: follow the `next:` line
  (a shell command or an `openUrl` in it: run it for the person, or show it to them).
- Tests you create or change are proposals. A person approves them in the dashboard (Proposed tests). Say so; never say they are live.
- Close what you open: kill every tunnel and `webagent-device connect` you started.

## 0. Is Lookover QA connected?
If the `lookover-qa` tools are not in your tool list, or a call says 401 / unauthorized: tell the user once, then stop. They sign in:
`/mcp`, select `plugin:webagent:lookover-qa`, Authenticate (browser, "Sign in with Lookover", pick a project). Without a browser (CI):
an API key in `/plugin configure webagent@webagent` (member role is enough), then restart. Do not guess a key, do not ask them to
paste it in chat. `share_report` and `connect_local_app` need a signed-in person: with an API key they say so.

## 1. Pick the App and the URL
`list_apps` once. Order for the URL: one the user gave > `.webagent/tests.yaml` `targets` (the env they named; else `local` if its dev
server answers; else the first) > the App's saved URL > ask one short question. Several Apps and unclear which: ask, never guess; pass
`appId` to the tools. No App yet: `create_app` (name + public address). Keep a new address for later runs with `add_url`.
**Local or private URL** (`localhost`, `127.*`, `10.*`, `192.168.*`, `172.16-31.*`, `*.local`, `*.internal`): the cloud browser never
opens it (SSRF guard, no override). `localhost:<port>`, `127.0.0.1:<port>`, `[::1]:<port>`: section 7A. Any other private host: 7B.

## 2. Read context (cheap, once)
- `.webagent/product.md` and `.webagent/tests.yaml` if they exist. If not, carry on with tests from the diff and suggest
  `/webagent:qa-init` in your summary. Do not block on it.
- `git status --short` and `git diff --stat` (on a feature branch also `git diff <base>...HEAD --stat`). Read only the
  changed route, page, form and handler files you need. Do not read the whole repo.
- `get_knowledge` for the App once: what the team already told Lookover about it.

## 3. Choose tests
- `list_tests` (the saved Test suite, with each test's latest result) and `list_folders`. The user named something: that, plus the
  nearest saved test. Otherwise: tests whose area the diff touches, plus every `smoke` / priority 1 test. **At most 10 per run**; list
  what you skipped. "all" or "regression" means the whole Folder.
- **No saved test covers new or changed behaviour:** `create_tests` (`tests` or the raw `yaml` of `.webagent/tests.yaml`; `title` is
  the only thing you must get right). It is a dry run by default: show the person what would be created and the warnings
  ("expectation not understood"), fix them, then send it again with `dryRun: false`. They are saved as **proposed**; tell the person to
  approve them in the dashboard (Proposed tests) before they can run. `list_proposed_tests` shows what is still waiting.
  Change an existing test with `update_test` (also a proposal), only when the app changed on purpose, and say so.
- **Write tests that replay:** one action per step, controls named by their visible label, every typed value a quoted literal:
  `click "Sign up"`, `type "qa+{{uid}}@example.com" into Email` (`{{uid}}` = a new value each run). Never describe a value ("a unique
  email"): it would be typed as written. `expect` in the form the server reads: `shows "Welcome"`, `address contains /dashboard`,
  `does not show "Error"`. Quote a YAML value that contains `: ` as a whole (`expect: 'shows "Total: $19.00"'`). A flow that needs a
  real inbox (email code) cannot be tested: COULD NOT TEST.
- **No tests at all and the person wants a first look:** `quick_check { url }`. It looks at the first pages for defects and suggests
  tests worth adding (it saves none). Then `get_run`, `get_report`.

## 4. Run: `run_tests`, estimate first
1. `run_tests { ..., dryRun: true }` with the Folder (`suiteId`) or the `tests` you chose (and `tags`, `url`, `environmentId` if needed).
   It starts nothing: it answers with the tests that would run and the cost estimate.
2. **Show the person the number of runs and the estimate; start only after they agree** (a clear yes in this conversation).
3. `run_tests` again without `dryRun`. It answers at once with a `runId`; the verdict comes from `get_run` and `get_report`, never from
   your reading of a transcript. Only proposed-and-approved (active) tests run.
- `url` overrides the address for this run (a preview, a tunnel, the localhost URL of 7A). `stopAfterFailures` stops early.
- Give the user the dashboard link from the answer once, in one line, when the run starts. Do not repeat it on each poll.

## 5. Wait without burning tokens
A run answers at once with a `runId`. Poll `get_run { runId }` with a pause of 20 to 30 s between calls (`sleep 25` in a shell), at most
6 times, then report the unfinished tests as `Couldn't test` (timeout) and give the dashboard link. Never loop in a tight poll. `cancel_run { runId }` stops a run the person
no longer wants.
- Do not print or re-read the whole run. `get_run` gives the result so far, how many tests finished and which failed.
  **For every failed test call `get_report { runId }` once** (or `{ testRef }` for a test's latest result): expected vs saw, one
  screenshot, healed steps. Read it; open a screenshot link only when the text does not explain the failure.
- Console errors and network failures can arrive after the run ends: if a list is empty with a note saying so, call `get_report`
  again after a few seconds before you say there were none.

## 6. Fix loop
1. For each `Failed`: decide if the app or the test is wrong. Read the failed step, expected vs saw and the code. A test that expects
   old text after an intended change is stale: `update_test` (a proposal), say so.
2. Fix the app code (smallest change). State cause as `file:line`.
3. Re-run **only the failed tests**: `run_tests { rerunOf: <runId>, failedOnly: true }` (dry run first, as in 4). Local target (7A or
   7B): the dev server reloads, re-run now. Staging or other remote: the fix is not live until deployed. Say so and stop; do not
   re-run against old code or claim it is fixed.
4. Maximum 2 fix rounds per test. Then report it as still failing with what you tried.
5. `Couldn't test`: do not edit app code. Say why it could not run and what unblocks it (connect your machine, a saved login with
   `add_login`, wait for capacity, ask the user to do the CAPTCHA step by hand).
6. A lasting fact about the app that would have saved you a step (a login route, a flaky widget): `add_knowledge` (`kind: "note"`
   for an App note, `kind: "doc"` for a Knowledge doc). Never a secret.

## 7A. Local app: connect your machine
Only for `localhost:<port>`, `127.0.0.1:<port>`, `[::1]:<port>`. Needs a signed-in person. The cloud browser still never opens
localhost: it reaches the app through your machine, which connects out to Lookover. Details: reference.md "Local app: connect".
1. Tell the user in one line: while it runs, your Lookover test sessions (not the internet) can open port N of this computer; use test
   data; tests may create records.
2. `connect_local_app { ports: [N] }`. `connected` = ready. `waiting_for_device` = it returns a one-time code and the exact command:
   run that command **in the background** (`nohup ... &`, keep its pid), read its first lines, then call `connect_local_app` again until
   `connected`. Show the user the consent text of reference.md and get a yes in chat **before** you run a command that contains `--yes`.
3. `run_tests { url: "http://localhost:<port>", ... }` exactly as the user's app is named: the server swaps it for the machine's alias.
   Say "testing through your connected machine", never "the cloud browser opened localhost".
4. A dev-server "Blocked request" / "Invalid Host header" / 403: it refuses the alias. Give the allowedHosts fix once (reference.md),
   re-run after they reload. That test is `Couldn't test`, not `Failed`. A laptop that sleeps or a `connect` that exited mid-run: the
   same. Offer to start it again once.
5. **When done, always kill the background command**, also after a failed run. Never leave it connected.
No signed-in person (API key), or the command cannot run here: go to 7B.

## 7B. Local app: tunnel
Warn the user first, in one line: the tunnel exposes the dev server to the internet while it runs; use test data; tests may create
records. **cloudflared** (no account, no header):
```bash
LOG=$(mktemp); nohup cloudflared tunnel --url http://localhost:PORT >"$LOG" 2>&1 & echo $! >"$LOG.pid"
for i in $(seq 1 30); do URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$LOG" | head -1); [ -n "$URL" ] && break; sleep 1; done; echo "$URL"
```
The URL shows after about 10 s. `curl -sI "$URL"` until it answers. Pass it as `url` on `run_tests`. Not installed: tell the user to
install it (do not install software without asking) or give a public preview URL. ngrok free shows a warning page that cannot be
skipped here: do not use it. A "host not allowed" page: the dev server must allow the tunnel host (Vite `server.allowedHosts`, webpack
`allowedHosts`, Next `allowedDevOrigins`). On a tunnel a `Failed` such as "Expected text not on the page" may be the tunnel's own page
("Just a moment", "You are about to visit"): then the test is `Couldn't test`. **When done, always `kill $(cat "$LOG.pid")`.**

## 8. Final summary (always, short)
Failures the user wants sorted (app bug, test to update, could not test) or filed as a bug: `/webagent:qa-triage` (`file_bug`).
A report link for a teammate: `share_report` (a public link anyone with it can read: ask first, needs a signed-in person).
Use the template in reference.md (`Final summary template`). Passed tests: one line each. **Every failed test gets a block** (from its
`get_report`): page URL, step, expected vs saw, first 1-2 console errors (trimmed), failed requests, screenshot link, then one line
"Likely cause" with `file:line` if the repo is open (else "not checked: no repo"). A field the report does not have: write
`not recorded`, never guess. Say nothing the tool results do not show.
