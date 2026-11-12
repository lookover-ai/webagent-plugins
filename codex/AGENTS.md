## QA with webagent (cloud browser)

Use the `webagent` MCP tools to test web apps in a real cloud browser. Do not use a local browser for this.
You know the code, so you decide what to test. webagent decides how to test and keeps the evidence.

### Rules
- Never put a secret (API key, password, token, `.env` value) in a tool call, step, goal or answer. Step and goal text is stored with the run.
  Test logins come from the webagent vault (by namespace) or a throwaway account I named in this conversation.
- `pass` and `fail` are the app's result. `error` means the test could not run (CAPTCHA, `navigation_blocked`, capacity, timeout).
  Never call an `error` a bug in the app. Never try to get past a CAPTCHA or bot check.
- Close what you open: `stop_session` for sessions you left open, kill tunnels you started.
- If the webagent tools are missing or answer 401: tell me to create a key in the webagent dashboard and `export WEBAGENT_API_KEY=...`. Stop.

### Context
Read `.webagent/product.md` and `.webagent/tests.yaml` if they exist (format: cases with `id`, `title`, `path`, `steps`, `expect`,
`tags`, `priority`; `targets` per environment with `url` and an optional vault `credentials` namespace). Read `git diff --stat`
and only the changed route/page/form files. Choose the cases the diff touches plus the `smoke` / priority 1 cases, **at most 5**,
and tell me what you skipped. Append new cases for new behaviour to `tests.yaml` (plain language, no secrets).

### Target URL
My URL, else the `tests.yaml` target I name, else ask once. The cloud browser cannot open `localhost`, private IPs or `.internal`
(by design). For a local app, tell me in one line that a tunnel exposes the dev server to the internet while it runs (use test data),
then run `cloudflared tunnel --url http://localhost:<port>` in the background (no account), read the `https://...trycloudflare.com`
address from its output, and use that. Without cloudflared use `ngrok http <port>` (its free plan needs header
`ngrok-skip-browser-warning`, see below). Stop the tunnel when done, also after a failure.

### Run a case
- **`smoke_test`** (default): `{ url, steps: [...], expectText, expectUrl, expectNoText, strictLinks: false }`. Always give at least one
  `expect...`; without it the case only checks that the page loads. Steps run after load, the first failed step stops the flow.
  It cannot use vault logins.
- **`run_task`** for a signed-in case (`startUrl`, `credentials: { namespace, autoSubmit: true }`) or a judgement-based check:
  add `engineId` of the `qa` engine (`eng_<region>_00000000qa00000000000000`, region = two letters in any returned id such as
  `sess_in_...`; omit it if unknown or rejected) and `record: true`. A task has no assertions: end the goal with
  `Answer exactly PASS: <what you saw> or FAIL: <what you saw instead>. If you cannot run it answer COULD NOT TEST: <why>.` and read the answer.
- ngrok free or another gate: `headers: [{ "hosts": ["<host>"], "headers": { "ngrok-skip-browser-warning": "1" } }]` on `run_task`,
  or inside `session` on `smoke_test`.

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
