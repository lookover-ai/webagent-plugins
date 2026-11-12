# webagent QA reference

Checked against the webagent api and contracts on 2026-11-12 (MCP server `webagent` 0.1.0). If a call is refused with
`invalid_input`, trust the error text over this file.

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
`get_session`). QA does not need them.

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
| `not_found` on `engineId` | The qa engine is not seeded in this region | Retry without `engineId` |

## Headers (ngrok free, WAF bypass, staging gate)
Sent only to the hosts named (and subdomains); values are write-only (logs show names only).
```json
[{ "hosts": ["abc123.ngrok-free.app"], "headers": { "ngrok-skip-browser-warning": "1" } }]
```
`run_task`/`create_session`: top-level `headers`. `smoke_test`: `session: { "headers": [ ... ] }`.

## Vault logins (signed-in cases)
Logins are saved by the user in the dashboard Vault (origin + username + password), grouped by **namespace**
(default `default`). The browser fills them for that exact origin; you never see the password.
`run_task { startUrl: <login page>, credentials: { namespace: "staging", autoSubmit: true } }`.
Exact origin only: `https://staging.example.com` is not `https://www.example.com`. A tunnel URL is a new origin, so a vault
login saved for it does not exist: for tunnelled apps use a throwaway login in the steps (text is stored with the run).
Skill runs (`smoke_test`) cannot use `credentials`.

## Goal template for `run_task` cases
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
| expectation needs judgement (a total, a colour, an order) | use `run_task` |

## `.webagent/` format
Full description: `docs/WEBAGENT-FOLDER.md` in the plugin repo; templates in `${CLAUDE_PLUGIN_ROOT}/templates/.webagent/`.
`product.md`: free Markdown (what the app is, roles, key flows, environments, test accounts by vault namespace, never passwords).
`tests.yaml`:
```yaml
version: 1
targets:                         # one per environment
  local:   { url: http://localhost:3000 }          # local URLs get a tunnel
  staging: { url: https://staging.example.com, credentials: staging }  # vault namespace
engine: qa                       # optional: engine for run_task cases (default qa)
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
