## webagent (cloud browser): web tasks and QA

The `webagent` MCP tools give you a real cloud browser (isolated, recorded; I can watch and take over live in the dashboard;
every session-starting tool returns a `Watch live: <url>` link). Do not use a local browser for web work. Two jobs: **web tasks** (below) and **testing my web app**
(the next section: use it whenever I ask to test, smoke test, QA or verify my own app).

### Web tasks (research, extract, fill a form, check a page, monitor a value, screenshot, crawl)
- Same rules as QA below: no secret in any tool call, never try to pass a CAPTCHA, close the sessions you open, tell me if the
  tools are missing or answer 401.
- Pick the cheapest tool: `scrape` (markdown), `screenshot`, `pdf`, `crawl` for read-only pages (no session to close);
  `run_task { goal, startUrl }` for a goal in plain words; `create_session` then `run_task { sessionId, goal }` per step, then
  `stop_session`, for dependent steps or when you need `headers`, `proxyUrl` or a vault login (`credentials: { namespace,
  autoSubmit: true }`); `list_skills` then the typed `skill_<name>` tool for a packaged skill. Prefer `scrape` over `run_task`
  when nothing needs clicking.
- Engine (only `run_task` and `create_session`), first hit wins: one I name; `engine:` in `.webagent/config.yaml` (read it if it
  exists; pass it as `engineId`); if the task clearly fits another engine, call `list_engines` once and
  pick by slug (`research`, `forms`, `monitor`, `careful`, `general`); else omit `engineId` (the project default runs).
  `engineId` takes a slug or a full id. Refused: retry once without it. Never invent an id. Do not use the `qa` engine for non-test work.
- A goal states one outcome, what to return and a stop condition. Waiting and reading as in "Wait without burning tokens" below.
  A call returning `running`: `get_report { id: taskId, waitSeconds: 90 }`, at most 3 times. Give me the `Watch live: <url>` link once for any task
  longer than a few seconds. `paused` = I took over: do not restart it. `captcha` / `blocked`: report it, do not retry.
- Finish with a few lines: what you found or did, key values, URLs, session id, what you could not do. Quote the task `answer`.

## QA with webagent (cloud browser)

Testing my own web app. You know the code, so you decide what to test. webagent decides how to test and keeps the evidence.

### Rules
- Tool names: on the QA-only endpoint `qa_report` is `get_report` and `qa_quick_check` is `smoke_test` (same args). Use whichever is in your tool list.
- Never put a secret (API key, password, token, `.env` value) in a tool call, step, goal or answer. Step and goal text is stored with the run.
  Test logins come from the webagent vault (by namespace) or a throwaway account I named in this conversation.
- `pass` and `fail` are the app's result. `error` means the test could not run (CAPTCHA, `navigation_blocked`, capacity, timeout).
  Never call an `error` a bug in the app. Never try to get past a CAPTCHA or bot check.
- Close what you open: `stop_session` for sessions you left open, kill tunnels you started.
- If the webagent tools are missing or answer 401: tell me to create a key in the webagent dashboard and `export WEBAGENT_API_KEY=...` (then restart Codex). Stop.

### Context
Read `.webagent/product.md` and `.webagent/tests.yaml` if they exist (format: cases with `id`, `title`, `path`, `steps`, `expect` or `checks {text, url, noText}`,
`tags`, `priority` 1 (most important) to 5, default 3; `targets` per environment, a url or `{ url, credentials }` with an optional vault namespace; or one
`url`; `defaultTarget`; this format is shared with the dashboard and CI, add no field of your own). Read `git diff --stat`
and only the changed route/page/form files. Choose the cases the diff touches plus the `smoke` / priority 1 cases, **at most 10**,
and tell me what you skipped. Append new cases for new behaviour to `tests.yaml` (plain language, no secrets).

### Target URL
My URL, else the `tests.yaml` target I name, else ask once. The cloud browser cannot open `localhost`, private IPs or `.internal`
(by design). For `localhost:<port>` (also `127.0.0.1`, `[::1]`) try connecting my machine first, only if ALL hold: `webagent-device` is on PATH and
`webagent-device --help` lists `connect`; `qa_run` in your tool list has a `localApp` argument; `webagent-device status` exits 0 with an `alias`
(a machine paired for a local app; the first pairing needs a one-time code that I type in my own terminal, never ask me for it). Otherwise say
one line, "Local-app mode is coming soon; using a tunnel", and use the tunnel below (never tell me how to install anything).
Connect: tell me in one line that while it runs my webagent test sessions (not the internet) can open that port, use test data. Run in the background, without `--yes`:
`nohup webagent-device connect <port> [<port>...] --json >$LOG 2>$LOG.err </dev/null &` (1 to 8 ports, 1024 and up; it keeps running), wait up to 30 s for ONE
stdout line `{"alias","urls","ports","status":"connected"}` (optional `notes`: pass them on). If it exits `Nothing shared.` it asked yes/no and a background shell cannot answer: show me what it
exposes (only those ports on this computer, to my own cloud test sessions; pages, API answers and secrets the app shows are kept as test evidence; dev tools on those ports are reachable; stop with Ctrl+C), ask me
yes/no in chat, and only on a yes run it again with `--yes`. Then `qa_run` with `url: "http://localhost:<port>"` (the server swaps it for the alias; `localApp: { ports: [<more>] }` only for extra ports,
`localApp.deviceId` only with several machines). Say "testing http://<alias>:<port>/ through your connected machine", never that the cloud browser opened localhost. A dev server "Blocked request" / "Invalid Host header" / 403
or a note about the host name: tell me once "Your dev server refused the host name <alias>. Allow it in its config (Vite: `server.allowedHosts`, webpack-dev-server: `allowedHosts`,
Next: `allowedDevOrigins`, Angular: `allowedHosts`) and reload." and mark the case could-not-test, never fail; the same when my laptop sleeps or the connection drops. Kill the `connect` process when done, also after a failure.
Tunnel (any other private host, or when the connect gate fails): tell me in one line that a tunnel exposes the dev server to the internet while it runs (use test data),
then run `cloudflared tunnel --url http://localhost:<port>` in the background (default, no account), wait about 10 s, read the
`https://...trycloudflare.com` address from its output, and use that. Second choice `ngrok http <port>` (its free plan needs header
`ngrok-skip-browser-warning`, see below). Stop the tunnel when done, also after a failure.

### Run a case
- **One `qa_run` for the whole set** (default; the verdict comes from its report; at most 20 cases per call). The server makes case ids and
  defaults `path` and `steps`: send the cases as written, only `title` is required, never fill `id`/`path`/`steps` yourself, pass `expect` unchanged.
  - `.webagent/tests.yaml` exists, every case (up to 20): `qa_run { testsYaml: <the file's raw text, max 64 KB, not re-written as JSON>, target?: <env name>,
    url?: <override> }`. A YAML mistake comes back with line and column: fix it and send again. Only some cases: `qa_run { testsFile: <the parsed file
    with only the chosen cases>, ... }` (`caseIds` / `tags` do not work with a file). `url` replaces the target's address: use the tunnel URL for a local
    target. The file's `engine`, `concurrency` and `maxCostUsdPerCase` are applied by the server.
    Leave `signedIn` cases in: the server skips them and says so; run them as `run_task` (below) with the target's vault namespace.
  - No file: `qa_run { url, cases: [{ title, path?, steps?, expect | checks, tags?, priority? }] }` (`signedIn` is refused in `cases`).
  - ngrok free, a WAF or staging gate: `session: { headers: [{ hosts: ["<host>"], headers: { "ngrok-skip-browser-warning": "1" } }] }`
    on `qa_run` (so ngrok needs no `smoke_test`).
  - **Every failed case:** call `qa_status { id: <wfr_...>, caseId }` once, then report per case: page URL, step, expected vs actual, first 1-2 console errors, failed requests (method, URL, status), screenshot link, one line likely cause (+ file:line if the repo is open). Not in the report: `not recorded`. Failed task steps carry `url`, `expected`, `actual`: quote them.
  - Write steps that replay: quoted literal values (`type "qa+{{uid}}@example.com" into Email`, `{{uid}}` is new each run), one action per step, visible labels; `expect` as `shows "X"`. In `tests.yaml` quote a value that contains `: ` as a whole (`expect: 'shows "Total: $19.00"'`; unquoted it is invalid YAML).
  - Tell me the `Watch live: <url>` link once per run (not on every poll). Pass on every `Warning:` line (skipped `signedIn` cases).
  - **Only when `qa_run` is not in your tool list:** one `smoke_test` per case: `{ url, steps: [...], expectText, expectUrl, expectNoText,
    strictLinks: false }` with at least one `expect...`; it cannot use vault logins, so a signed-in case types a throwaway login in `steps`.
- **`run_task`** only to explore an unknown flow or when I ask, **never as the pass/fail gate** (it said `pass` on a broken
  checkout in 3 of 6 runs; `pass` only means the agent says it is done). Args: `goal`, `startUrl`, `record: true`, `engineId` (`tests.yaml`
  `engine`, else `.webagent/config.yaml` `engine`, else the project default engine (omit `engineId`; `qa` is a sensible pick for testing, never required); the server accepts a slug or an id, `list_engines` shows them), `credentials: { namespace, autoSubmit: true }` for a vault
  login (use it for `signedIn` cases). End the goal with `Answer exactly PASS: <what you saw> or FAIL: <what you saw instead>. If you cannot run it answer
  COULD NOT TEST: <why>.` Quote the answer, call the result "explored".
- ngrok free: `headers: [{ "hosts": ["<tunnel host>"], "headers": { "ngrok-skip-browser-warning": "1" } }]` on `run_task`, or
  inside `session` on `qa_run` / `smoke_test`. A failed case on a tunnel whose page is ngrok's "You are about to visit" page (or Cloudflare's
  "Just a moment") is `error`, not an app bug: fix the header and re-run.

### Wait without burning tokens
`qa_run` waits up to 60 s (`waitSeconds` up to 90) and runs 3 cases at a time server-side. If it returns `running`, call
`qa_status { id: <wfr_...>, waitSeconds: 90 }`; at most 3 such calls, then report the rest as `error` (timeout). `run_task` waits 90 s, then
`get_report { id, waitSeconds: 90 }`. Never poll in a tight loop.
Read `summary`, `verdict`, the failed `steps`, `counts`. Open console errors and failed network calls only for a failed case.
Do not paste the whole report into the chat.

### Fix loop
For each `fail`: decide if the app or the test is wrong, fix the smallest thing (cause as `file:line`), then re-run **only the failed
cases**. A remote target does not see your fix until it is deployed: say so and stop instead of re-running old code.
At most 2 fix rounds per case. For `error`: do not change app code, say what unblocks it.

### Final answer
```
QA <target> · <n> passed · <n> failed · <n> could not test
PASS / FAIL / COULD NOT TEST  <case id> - <one line>. For FAIL: cause file:line and whether it is fixed and re-run.
Watch live / replay: <dashboardUrl>. Evidence: report link (expires <urlsExpireAt>). Warnings: <Warning: lines>.
Changed: files, tests.yaml. Skipped: cases. Tunnel / connect: closed.
```
Say only what the tool results show. A `run_task` pass means "the agent says it is done".
