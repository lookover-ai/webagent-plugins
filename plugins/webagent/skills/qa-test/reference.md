# webagent QA reference

Checked against the webagent api and contracts on 2026-11-12 (MCP server `webagent` 0.1.0, 25 tools: 15 fixed + 10 `skill_*`) and
against a real run through a tunnel (2026-11-12). If a call is refused with `invalid_input`, trust the error text over this file.

## Tools you use for QA
| Tool | Args (real names) | Waits | Returns |
|---|---|---|---|
| `smoke_test` | `url` (required), `steps[]` (max 30, each 500 chars), `expectText`, `expectUrl`, `expectNoText`, `maxLinks` (0-200, default 50), `strictLinks` (default true), `waitSeconds` (1-90, default 60), `session` (`headers`, `proxyUrl`, `allowHosts`, ...; `credentials` is refused; recording is always on) | up to `waitSeconds` | text summary + failed steps; whole RunReport in `structuredContent` |
| `run_task` | `goal`, `maxSteps` (1-50), `startUrl`, `engineId`, `engineVersion`, `record`, `headers`, `proxyUrl`, `allowHosts`, `credentials` (`true` or `{namespace, autoSubmit}`), `mode` (`auto` default or `full_auto`), `keepOpen`, `sessionId`, `waitSeconds` (1-90, default 90) | up to 90 s | text (`Task finished|stopped (<stoppedBy>) ...`), `structuredContent {sessionId, sessionClosed, task}`; still running: `{sessionId, taskId, status: running}` |
| `get_report` | `id` (`run_...` or `tsk_...`), `waitSeconds` (0-90, default 30) | up to `waitSeconds` | the RunReport (text + `structuredContent`) |
| `get_task` | `sessionId`, `taskId?`, `waitSeconds` | up to 90 s | raw task record; use `get_report` instead |
| `create_session` | `startUrl`, `engineId`, `record`, `headers`, `credentials`, `proxyUrl`, `allowHosts`, ... | no | session record + token |
| `stop_session` | `sessionId` | no | session record (safe to repeat) |

`sessionId`, `startUrl`, `engineId`, `record`, `headers`, `proxyUrl`, `allowHosts`, `credentials` on `run_task` apply only
when it opens the session. With `sessionId` they are refused: put them on `create_session`.
Other tools exist (`scrape`, `screenshot`, `pdf`, `crawl`, `list_skills`, `run_skill`, `get_skill_run`, `list_sessions`,
`get_session`, 10 `skill_*`). QA does not need them; `skill_smoke_uat` runs the same flow as `smoke_test` but its text has no
verdict word, so use `smoke_test`.

**Planned, not in every server yet:** `qa_run` (a set of cases or a saved workflow in one call, waits up to `waitSeconds`) and
`qa_status` (`id` of a `wfr_`/`run_`/`tsk_`, optional `caseId`, `waitSeconds`) from the api's Workflows module. Use them only
when they are in your tool list, and follow their own input schema; the plugin does not guess it. Their per-case verdict
is the same `pass`/`fail`/`error`.

## The report (what to read)
`verdict`: `pass` | `fail` | `error` | `running`. `isError` on the tool call is true only for `error`: a failed test is a result.
| Field | Use |
|---|---|
| `summary` | Plain sentences, safe to relay. Read first. |
| `outcome` | Raw reason: skill status (`passed`, `failed`, `error`, `cancelled`, `denied`) or task `stoppedBy` |
| `url`, `finalUrl` | Page tested; where the browser ended (`finalUrl` needs the session log) |
| `counts` | True totals (`steps`, `failedSteps`, `findings`, `consoleErrors`, `networkFailures`) before the lists are cut |
| `steps[]` | `number`, `title`, `kind`, `status` (`pass`/`fail`/`skipped`), `error`, `ms`, `screenshotUrl` (failed steps of a skill run) |
| `findings[]` | `severity`, `title`, `url`, `fix`: broken links, accessibility. A task has none. |
| `consoleErrors[]`, `networkFailures[]` | First 15 / 20. `http_error` = 4xx/5xx answer, `request_failed` = no answer. |
| `evidence` | `reportSignedUrl` and `screenshotUrl` expire at `urlsExpireAt` (~5 min; call `get_report` again for fresh links). `recordingPath` and `logsPath` need the API key. |
| `notes[]` | What is missing and why. Read when a list looks too empty. |

A task step has only an action and target (`click e12`), no screenshot, no page URL.

## Why `run_task` is not the gate
Measured on a planted-bug checkout (500 on submit): the same goal, 6 runs: 3 `blocked` (verdict `error`), 3 `done` (verdict
`pass`, two of them with an answer saying the step was NOT RUN). `smoke_test` with explicit steps: 2 of 2 `fail`, 10-12 s, with
the failed step, console error (file:line), the failing request and the broken link. So: `smoke_test` for every case you can
write as steps; `run_task` to explore, with its answer quoted, never to decide pass or fail.

## Task `stoppedBy` (run_task)
`done` (pass if `ok`) · `stuck`, `budget`, `unanswered` = **fail** (agent could not finish the flow; check the app, then the goal) ·
`captcha`, `blocked`, `error`, `aborted`, `paused`, `navigation_blocked`, `capacity_exceeded`, `capacity_timeout`, `timeout` = **error**
(could not test, not an app bug).

## Errors that are not the app's fault
| You see | Meaning | Do |
|---|---|---|
| `navigation_blocked` | The browser may not open that address (localhost, private IP, `.internal`) | Use a tunnel or a public URL |
| `capacity_exceeded`, `capacity_timeout` | All browsers of the plan are busy | Wait 30 s, retry once with fewer parallel cases, else COULD NOT TEST |
| `rate_limited` / 429 | 600 requests per minute per key | Slow down; you should never hit this |
| 401 `invalid API key`, 421 `wrong_region` | Key wrong or for another region | Tell the user (new key from the right dashboard) |
| `captcha` | A bot check appeared | Do not try to pass it. COULD NOT TEST; the user can test that step by hand or use a staging build without it |
| `not_found` / `invalid_input` on `engineId` | The slug or id is not known in this region | Next form in the list under "Engine id", last: omit `engineId` |
| Fail on a tunnel URL, text missing, page is a warning page | The tunnel's interstitial, not your app | `error`: ngrok header or cloudflared, re-run |

## Engine id (`run_task`, `create_session`)
Which engine: `tests.yaml` `engine`, else `.webagent/config.yaml` `engine`, else `qa`. Pass the slug (or full id) as `engineId`.
The server accepts a slug (api A91) or an id. If it refuses the slug, and the engine is `qa`, try `eng_us_00000000qa00000000000000`
(the seeded id of the built-in QA engine); still refused: omit `engineId` and say so. Never invent another id. `list_engines`
(when in your tool list) shows the real ones. For non-QA work, the `browse` skill covers engines.

## Tunnels
| | cloudflared quick tunnel (default) | ngrok free |
|---|---|---|
| Account | none | authtoken |
| Start | `cloudflared tunnel --url http://localhost:PORT`; URL `https://<words>.trycloudflare.com` in its output after ~10 s | `ngrok http PORT`; URL from `curl -s localhost:4040/api/tunnels` after ~2 s |
| Warning page | none | yes, unless the header below is sent |
| Stop | kill the process you started | kill the process you started |
Both expose the dev server to the internet while they run. Verified end to end with the planted-bug app: `smoke_test` found the
bug through both. A "host not allowed" page means the dev server must allow the tunnel host.

## Headers (ngrok free, WAF bypass, staging gate)
Sent only to the hosts named (and subdomains); values are write-only (logs show names only).
```json
[{ "hosts": ["abc123.ngrok-free.app"], "headers": { "ngrok-skip-browser-warning": "1" } }]
```
`run_task`/`create_session`: top-level `headers`. `smoke_test`: `session: { "headers": [ ... ] }`. `hosts` = the host of the
tunnel URL, nothing else. Without the header a `smoke_test` on ngrok returns verdict `fail` ("Expected text ... is not on the
page") because the page is ngrok's "You are about to visit ..." page; the report does not say so. Treat that as `error`.

## Vault logins (signed-in cases)
Logins are saved by the user in the dashboard Vault (origin + username + password), grouped by **namespace**
(default `default`). The browser fills them for that exact origin; you never see the password.
`run_task { startUrl: <login page>, credentials: { namespace: "staging", autoSubmit: true } }`.
Exact origin only: `https://staging.example.com` is not `https://www.example.com`. A tunnel URL is a new origin, so a vault
login saved for it does not exist: for tunnelled apps use a throwaway login in the steps (text is stored with the run).
Skill runs (`smoke_test`) cannot use `credentials`.

## Goal template for exploratory `run_task`
```
Test: <title>. Start on <path>. Do: <steps as sentences>.
Expected: <expect>. Treat console errors, broken layout, pages slower than 5 s and failed requests as findings.
Answer exactly PASS: <what you saw> or FAIL: <what you saw instead>. If you cannot run the test (CAPTCHA, blocked
page, missing data) answer COULD NOT TEST: <why>.
```
Payments: the `qa` engine blocks actions that spend money. Test checkout against the app's test mode and expect to stop
at the real payment button; report that as not tested.

## Mapping a case to `smoke_test`
| tests.yaml | smoke_test |
|---|---|
| `target url` + `path` | `url` |
| `steps` | `steps` (one string each) |
| `expect` literal text on the page | `expectText` |
| `expect` the address changes | `expectUrl` (a fragment such as `/dashboard`) |
| `expect` an error must not show | `expectNoText` |
| expectation needs judgement (a total, a colour, an order) | split into literal checks (`expectText` for the total), or explore with `run_task` and report it as explored |

## `.webagent/` format
Full description: `docs/WEBAGENT-FOLDER.md` in the plugin repo; templates in `${CLAUDE_PLUGIN_ROOT}/templates/.webagent/`.
`product.md`: free Markdown (what the app is, roles, key flows, environments, test accounts by vault namespace, never passwords).
`tests.yaml`:
```yaml
version: 1
targets:                         # one per environment
  local:   { url: http://localhost:3000 }          # local URLs get a tunnel
  staging: { url: https://staging.example.com, credentials: staging }  # vault namespace
engine: qa                       # optional: engine for run_task cases (default: config.yaml engine, else qa)
cases:
  - id: signup-happy             # unique, kebab-case
    title: A new user can sign up
    path: /signup                # optional, default /
    steps: [type a unique email into Email, type a throwaway password into Password, click "Create account"]
    expect: the page shows "Welcome" and the address contains /dashboard
    tags: [smoke, auth]
    priority: 1                  # 1 = run on every change
    signedIn: false              # optional: needs the target's vault login (runs via run_task)
```
