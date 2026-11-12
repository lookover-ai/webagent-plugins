## webagent (cloud browser): web tasks and QA

The `webagent` MCP tools give you a real cloud browser (isolated, recorded; I can watch and take over live in the dashboard,
Sessions, the session id). Do not use a local browser for web work. Two jobs: **web tasks** (below) and **testing my web app**
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
  exists; pass it as `engineId`); if the task clearly fits another engine and `list_engines` is in your tool list, call it once and
  pick by slug (`research`, `forms`, `monitor`, `careful`, `general`); else omit `engineId` (the project default runs).
  `engineId` takes a slug or a full id. Refused: retry once without it. Never invent an id. Do not use the `qa` engine for non-test work.
- A goal states one outcome, what to return and a stop condition. Waiting and reading as in "Wait without burning tokens" below.
  A call returning `running`: `get_report { id: taskId, waitSeconds: 90 }`, at most 3 times. Give me the session id once for any task
  longer than a few seconds. `paused` = I took over: do not restart it. `captcha` / `blocked`: report it, do not retry.
- Finish with a few lines: what you found or did, key values, URLs, session id, what you could not do. Quote the task `answer`.

## QA with webagent (cloud browser)

Testing my own web app. You know the code, so you decide what to test. webagent decides how to test and keeps the evidence.

### Rules
- Never put a secret (API key, password, token, `.env` value) in a tool call, step, goal or answer. Step and goal text is stored with the run.
  Test logins come from the webagent vault (by namespace) or a throwaway account I named in this conversation.
- `pass` and `fail` are the app's result. `error` means the test could not run (CAPTCHA, `navigation_blocked`, capacity, timeout).
  Never call an `error` a bug in the app. Never try to get past a CAPTCHA or bot check.
- Close what you open: `stop_session` for sessions you left open, kill tunnels you started.
- If the webagent tools are missing or answer 401: tell me to create a key in the webagent dashboard and `export WEBAGENT_API_KEY=...` (then restart Codex). Stop.

### Context
Read `.webagent/product.md` and `.webagent/tests.yaml` if they exist (format: cases with `id`, `title`, `path`, `steps`, `expect`,
`tags`, `priority`; `targets` per environment with `url` and an optional vault `credentials` namespace). Read `git diff --stat`
and only the changed route/page/form files. Choose the cases the diff touches plus the `smoke` / priority 1 cases, **at most 5**,
and tell me what you skipped. Append new cases for new behaviour to `tests.yaml` (plain language, no secrets).

### Target URL
My URL, else the `tests.yaml` target I name, else ask once. The cloud browser cannot open `localhost`, private IPs or `.internal`
(by design). For a local app, tell me in one line that a tunnel exposes the dev server to the internet while it runs (use test data),
then run `cloudflared tunnel --url http://localhost:<port>` in the background (default, no account), wait about 10 s, read the
`https://...trycloudflare.com` address from its output, and use that. Second choice `ngrok http <port>` (its free plan needs header
`ngrok-skip-browser-warning`, see below). Stop the tunnel when done, also after a failure.

### Run a case
- **`smoke_test`** (default, one call per case; the verdict comes from its report): `{ url, steps: [...], expectText, expectUrl,
  expectNoText, strictLinks: false }`. Always give at least one `expect...`; without it the case only checks that the page loads.
  Steps run after load, the first failed step stops the flow. It cannot use vault logins: for a signed-in case type a throwaway
  login in `steps`. If `qa_run` / `qa_status` are in your tool list, prefer one `qa_run` with all chosen cases, then `qa_status`
  on a failed case.
- **`run_task`** only to explore an unknown flow or when I ask, **never as the pass/fail gate** (it said `pass` on a broken
  checkout in 3 of 6 runs; `pass` only means the agent says it is done). Args: `goal`, `startUrl`, `record: true`, `engineId` (`tests.yaml`
  `engine`, else `.webagent/config.yaml` `engine`, else the slug `qa`; if the server refuses `qa`, try `eng_us_00000000qa00000000000000`, then omit it), `credentials: { namespace, autoSubmit: true }` for a vault
  login. End the goal with `Answer exactly PASS: <what you saw> or FAIL: <what you saw instead>. If you cannot run it answer
  COULD NOT TEST: <why>.` Quote the answer, call the result "explored".
- ngrok free: `headers: [{ "hosts": ["<tunnel host>"], "headers": { "ngrok-skip-browser-warning": "1" } }]` on `run_task`, or
  inside `session` on `smoke_test`. A failed case on a tunnel whose page is ngrok's "You are about to visit" page (or Cloudflare's
  "Just a moment") is `error`, not an app bug: fix the header and re-run.

### Wait without burning tokens
Run at most 3 cases at once. A call waits up to 60 s (`smoke_test`) or 90 s (`run_task`). If it returns `running`, call
`get_report { id, waitSeconds: 90 }`; at most 3 such calls per case, then report `error` (timeout). Never poll in a tight loop.
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
Evidence: report link (expires <urlsExpireAt>), session id. Changed: files, tests.yaml. Skipped: cases. Tunnel: closed.
```
Say only what the tool results show. A `run_task` pass means "the agent says it is done".
