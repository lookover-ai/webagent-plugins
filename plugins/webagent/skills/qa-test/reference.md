# webagent QA reference

Checked against the webagent api (A96, commit d27cb2e, `src/modules/mcp/qa-tools.ts`, `qa-yaml.ts`, `qa-inline.ts`, `dashboard-url.ts`) and contracts 0.38.0
on 2026-11-12, and against a real run through a tunnel. If a call is refused with `invalid_input`, trust the error text over this file.

## Tools you use for QA
The QA endpoint (`/mcp/qa`) names two of them differently: `qa_report` is `get_report`, `qa_quick_check` is `smoke_test` (same args, same answers). Use whichever is in your tool list. The plugin's own server (`/mcp`) keeps `get_report` / `smoke_test`; a project set up for testing may list the QA names there too. `qa_list_runs` and `qa_file_bug` are not live yet: use them only if they are in your tool list (`/webagent:qa-triage`).
| Tool | Args (real names) | Waits | Returns |
|---|---|---|---|
| `qa_run` | see "`qa_run`" below | up to `waitSeconds` (default 60) | rollup text + failed cases (max 5) + `Watch live:` line; whole `WorkflowRun` (`wfr_...`) in `structuredContent` |
| `qa_status` | `id` (`wfr_`, `run_` or `tsk_`), `caseId?` (with `wfr_`), `waitSeconds` (0-90, default 30) | up to `waitSeconds` | the run, or with `caseId` that case's whole report |
| `smoke_test` = `qa_quick_check` (fallback: only when `qa_run` is absent) | `url` (required), `steps[]` (max 30, each 500 chars), `expectText`, `expectUrl`, `expectNoText`, `maxLinks` (0-200, default 50), `strictLinks` (default true), `waitSeconds` (1-90, default 60), `session` (`headers`, `proxyUrl`, `allowHosts`, ...; `credentials` is refused; recording is always on) | up to `waitSeconds` | text summary + failed steps; whole RunReport in `structuredContent` |
| `run_task` | `goal`, `maxSteps` (1-50), `startUrl`, `engineId`, `engineVersion`, `record`, `headers`, `proxyUrl`, `allowHosts`, `credentials` (`true` or `{namespace, autoSubmit}`), `mode` (`auto` default or `full_auto`), `keepOpen`, `sessionId`, `waitSeconds` (1-90, default 90) | up to 90 s | text (`Task finished|stopped (<stoppedBy>) ...`), `structuredContent {sessionId, sessionClosed, task}`; still running: `{sessionId, taskId, status: running}` |
| `get_report` = `qa_report` | `id` (`run_...` or `tsk_...`), `waitSeconds` (0-90, default 30) | up to `waitSeconds` | the RunReport (text + `structuredContent`) |
| `get_task` | `sessionId`, `taskId?`, `waitSeconds` | up to 90 s | raw task record; use `get_report` instead |
| `create_session` | `startUrl`, `engineId`, `record`, `headers`, `credentials`, `proxyUrl`, `allowHosts`, ... | no | session record + token |
| `stop_session` | `sessionId` | no | session record (safe to repeat) |

`sessionId`, `startUrl`, `engineId`, `record`, `headers`, `proxyUrl`, `allowHosts`, `credentials` on `run_task` apply only
when it opens the session. With `sessionId` they are refused: put them on `create_session`.
Other tools exist (`scrape`, `screenshot`, `pdf`, `crawl`, `list_skills`, `run_skill`, `get_skill_run`, `list_sessions`,
`get_session`, 10 `skill_*`). QA does not need them; `skill_smoke_uat` runs the same flow as `smoke_test` but its text has no
verdict word, so use `smoke_test`.

## `qa_run` (the default QA call)
Give **exactly one** of `cases`, `testsFile`, `testsYaml`, `workflowId`.
| Arg | Meaning |
|---|---|
| `cases` | 1 to 20 inline cases in the tests-file shape: `title` (required); optional `id` (made from the title), `path` (default `/`), `steps` (default none), `expect` or `checks {text, url, noText}`, `tags`, `priority` 1-5. Needs `url`. `signedIn` or `credentials` in a case is refused. |
| `testsYaml` | The raw text of `.webagent/tests.yaml`, at most 64 KB, exactly as the file reads (the server parses it: do not re-write it as JSON). Same as `testsFile` otherwise. A YAML mistake: `invalid_input` with line and column. Runs **every** case of the file (max 20): no case selection. |
| `testsFile` | The parsed `.webagent/tests.yaml` (object with `cases` and `targets` or `url`, optional `name`, `engine`, `concurrency`, `maxCostUsdPerCase`) or just the list of cases. Filter `cases` first, then send (the way to run some cases of a file). `signedIn` cases are left out and named in a `Warning:` line. The file's `maxCostUsdPerCase` is applied. |
| `url` | The site under test. Required with `cases`. With `testsFile` / `testsYaml`: replaces the chosen target's address (use it for a tunnel). A file with no `targets`/`url` takes it as its site. |
| `localApp` | `{ deviceId?, ports? }`, only on servers that list it: pick the connected machine / open more ports of it. See "Local app: connect". |
| `target` | With `testsFile` / `testsYaml`: which target of the file (default its `defaultTarget`). With `workflowId`: the saved target. Unknown name: `invalid_input` listing the known ones. |
| `session` | Every run kind: `headers` (host-scoped; joined with the target's own), `proxyUrl`, `allowHosts`. Allowed with `workflowId` too. Recording is always on. |
| `engineId` | Slug or id. With `testsFile` / `testsYaml` the file's `engine` is used when you omit it. Refused with `workflowId`. |
| `name`, `waitSeconds` | A name for an inline run; wait 1-90 s (default 60). Still going: verdict `running` and an id for `qa_status`. |
| `workflowId` + `caseIds`, `tags`, `target`, `url`, `session` | A saved workflow (`wf_...`). `caseIds` (run only these) and `tags` exist **only** here: with `cases`, `testsFile` or `testsYaml` they are refused. The plugin does not use it unless the user names one. |
Per-case verdict is `pass` / `fail` / `error`. Case ids are made server-side (`deriveCaseIds`: title lower-cased, `-` between words); read them from the
answer or `structuredContent.cases[].caseId`. `isError` is true only when the whole run is `error`.
**Answers carry** `Note:` and `Warning:` lines (`structuredContent.warnings`: skipped `signedIn` cases) and, from every tool that
starts or polls a session or run, `Watch live: <dashboardUrl>` (also `structuredContent.dashboardUrl`): give it to the user once per run.

## The report (what to read)
`verdict`: `pass` | `fail` | `error` | `running`. `isError` on the tool call is true only for `error`: a failed test is a result.
| Field | Use |
|---|---|
| `summary` | Plain sentences, safe to relay. Read first. |
| `outcome` | Raw reason: skill status (`passed`, `failed`, `error`, `cancelled`, `denied`) or task `stoppedBy` |
| `url`, `finalUrl` | Page tested; where the browser ended (`finalUrl` needs the session log) |
| `counts` | True totals (`steps`, `failedSteps`, `findings`, `consoleErrors`, `networkFailures`) before the lists are cut |
| `steps[]` | `number`, `title`, `kind`, `status` (`pass`/`fail`/`skipped`), `error`, `ms`, `screenshotUrl` (failed steps of a skill run). Task steps (qa engine 1.1.0 `STEP` lines) also `url` (page), `expected`, `actual`: quote them for a failed step. |
| `findings[]` | `severity`, `title`, `url`, `fix`: broken links, accessibility. A task has none. |
| `consoleErrors[]`, `networkFailures[]` | First 15 / 20. `http_error` = 4xx/5xx answer, `request_failed` = no answer. |
| `evidence` | `reportSignedUrl` and `screenshotUrl` expire at `urlsExpireAt` (~5 min; call `get_report` again for fresh links). `recordingPath` and `logsPath` need the API key. |
| `notes[]` | What is missing and why. Read when a list looks too empty. |

A task whose engine wrote no `STEP` lines has only an action and target per step (`click e12`), no screenshot, no page URL.

## Why `run_task` is not the gate
Measured on a planted-bug checkout (500 on submit): the same goal, 6 runs: 3 `blocked` (verdict `error`), 3 `done` (verdict
`pass`, two of them with an answer saying the step was NOT RUN). `smoke_test` with explicit steps: 2 of 2 `fail`, 10-12 s, with
the failed step, console error (file:line), the failing request and the broken link. So: `qa_run` (same engine as `smoke_test`: asserted
steps) for every case you can write as steps; `run_task` to explore, with its answer quoted, never to decide pass or fail.

## Task `stoppedBy` (run_task)
`done` (pass if `ok`) · `stuck`, `budget`, `unanswered` = **fail** (agent could not finish the flow; check the app, then the goal) ·
`captcha`, `blocked`, `error`, `aborted`, `paused`, `navigation_blocked`, `capacity_exceeded`, `capacity_timeout`, `timeout` = **error**
(could not test, not an app bug).

## Errors that are not the app's fault
| You see | Meaning | Do |
|---|---|---|
| `navigation_blocked` | The browser may not open that address (localhost, private IP, `.internal`) | Local app: connect (SKILL 7A) or a tunnel; else a public URL |
| Dev server page "Blocked request" / "Invalid Host header" / 403 | The dev server refuses the alias or tunnel host name | `error`; give the allowedHosts line (SKILL 7A step 5), re-run after the reload |
| `capacity_exceeded`, `capacity_timeout` | All browsers of the plan are busy | Wait 30 s, retry once with fewer parallel cases, else COULD NOT TEST |
| `rate_limited` / 429 | 600 requests per minute per key | Slow down; you should never hit this |
| 401 `invalid API key`, 421 `wrong_region` | Key wrong or for another region | Tell the user (new key from the right dashboard) |
| `captcha` | A bot check appeared | Do not try to pass it. COULD NOT TEST; the user can test that step by hand or use a staging build without it |
| `not_found` / `invalid_input` on `engineId` | The slug or id is not known in this region | Check the slug (see "Engine id"), call `list_engines`, else omit `engineId` and say so |
| Fail on a tunnel URL, text missing, page is a warning page | The tunnel's interstitial, not your app | `error`: ngrok header or cloudflared, re-run |

## Engine id (`qa_run`, `run_task`, `create_session`)
Which engine: `tests.yaml` `engine` (read by the server on a `testsFile` / `testsYaml`), else `.webagent/config.yaml` `engine`, else the project default engine (`qa` is a sensible pick for testing, never required). Pass the slug
(`qa`, `general`, `research`, `forms`, `monitor`, `careful`) or a full id as `engineId`: the server resolves a built-in slug for your region.
`list_engines` shows the real ones (forks too; only built-ins have a `slug`, a fork is used by its `id`). A slug that is not built in and not an id is refused with `invalid_input`: ask the user,
never invent an id. For non-QA work, the `browse` skill covers engines.

## Local app: connect (`webagent-device connect`)
Checked against the device client's `connect` command (runtime R82) and `qa_run` (api A162). Not live for everyone yet: the SKILL gate decides
(tool installed, `qa_run` has `localApp`, machine paired); when it fails, say "Local-app mode is coming soon; using a tunnel" and use the tunnels below.
```
webagent-device connect <PORT>... [--code CODE --api URL] [--yes] [--json]
```
| Part | What it does |
|---|---|
| `<PORT>...` | 1 to 8 different ports, 1024-65535 (`3000 5173` or `3000,5173`). Refused: mail, database, SSH, remote-desktop ports (for example 3306, 5432, 6379, 9200, 27017). Below 1024 is never shared. |
| `--code CODE --api URL` | Only the first time (pairing). The code must be made for a local app; the user types it in their own terminal, you never do. Without it: `First time: webagent-device connect <port> --code <PAIRING CODE> --api <URL>` (exit 2). A code for a browser exit: `That pairing code was not made for a local app` (exit 2). |
| consent question | Asked when this machine is new or the ports differ from last time. It reads a terminal: with no terminal (your shell) it answers no: `Nothing shared.` and exit 1. |
| `--yes` | Skips only the question; the consent text is still printed (stderr with `--json`). Add it only after the user said yes in this chat. |
| `--json` | Once connected, ONE line on stdout: `{"alias","urls","ports","status":"connected"}` plus `notes` (strings) when the probe found something. All other text goes to stderr. Without `--json`, one line per port on stdout: `local-app alias=<alias> url=http://<alias>:<port>/`. |
| it keeps running | The process stays connected (reconnects by itself) until you kill it. Ctrl+C or the dashboard also stops it. |
`urls[i]` = `http://<alias>:<ports[i]>/`. The alias is derived from the paired device (`d-<12 letters>.local-app.invalid`), never typed by anyone.
**Consent summary to show the user before `--yes`** (their own words are fine, keep the facts): only the ports listed on THIS computer open, only to the cloud
browser sessions that you start, never as the open internet; pages, API answers and data or secrets the app shows or sends during a test (cookies, tokens, personal data) are
visible to Lookover and kept as test evidence, so use test data; dev tools and admin routes on those ports can be used by the test; nothing else on the machine or network is reachable;
stop any time with Ctrl+C or by removing the device in the dashboard.
| `connect` says | Meaning | Do |
|---|---|---|
| `Nothing shared.` (exit 1) | Question not answered yes | Ask in chat, then `--yes` (SKILL 7A step 3) |
| `First time: … --code …` (exit 2) | Not paired | User pairs in their own terminal; no code available: tunnel |
| `This device is paired as an exit node…` (exit 2) | The machine is a browser exit, not a local app | Tell the user once; tunnel |
| `ports must be 1 to 8…` / `… is a mail, database or remote-access port` (exit 2) | Port not allowed | Another port, or tunnel |
| `Nothing is listening on port N yet. Start your app; this stays connected.` (a `notes` entry) | App not running | Start the app (or ask), then run |
| `Your dev server refused the host name <alias>. Allow it in its config (Vite: server.allowedHosts, webpack-dev-server: allowedHosts, Next: allowedDevOrigins, Angular: allowedHosts) and reload.` | The dev server checks the Host header (400/403/421) | Tell the user this line; after the reload, run |
`qa_run` side: `url: "http://localhost:<port>"` (also `127.0.0.1`, `[::1]`) is swapped for the alias of the connected machine; `localApp: { deviceId?, ports? }`
adds a machine pick or more ports. Errors are `invalid_input` with the next step in the text (no machine online, several machines online: pass `localApp.deviceId`, port below 1024).
Do not send the alias URL yourself. In the answer, say "tested through your connected machine", and never that the cloud browser opened localhost.

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
`run_task`/`create_session`: top-level `headers`. `qa_run` (any kind) and `smoke_test`: `session: { "headers": [ ... ] }` (on `qa_run` they are joined
with the target's own headers and apply to every case). `hosts` = the host of the tunnel URL, nothing else. Without the header a run on ngrok returns verdict `fail` ("Expected text ... is not on the
page") because the page is ngrok's "You are about to visit ..." page; the report does not say so. Treat that as `error`.

## Vault logins (signed-in cases)
Logins are saved by the user in the dashboard Vault (origin + username + password), grouped by **namespace**
(default `default`). The browser fills them for that exact origin; you never see the password.
`run_task { startUrl: <login page>, credentials: { namespace: "staging", autoSubmit: true } }`.
Exact origin only: `https://staging.example.com` is not `https://www.example.com`. A tunnel URL is a new origin, so a vault
login saved for it does not exist: for tunnelled apps use a throwaway login in the steps (text is stored with the run).
Workflow runs (`qa_run`) and skill runs (`smoke_test`) cannot use `credentials`.

## Goal template for exploratory `run_task`
```
Test: <title>. Start on <path>. Do: <steps as sentences>.
Expected: <expect>. Treat console errors, broken layout, pages slower than 5 s and failed requests as findings.
Answer exactly PASS: <what you saw> or FAIL: <what you saw instead>. If you cannot run the test (CAPTCHA, blocked
page, missing data) answer COULD NOT TEST: <why>.
```
Payments: the `qa` engine blocks actions that spend money. Test checkout against the app's test mode and expect to stop
at the real payment button; report that as not tested.

## Cases to `qa_run`: no mapping
Send the cases as the file has them (`testsYaml` for the whole file, `testsFile` for some of it, or `cases` with only what you wrote). Do not add `id`, `path`, `steps` or `priority`
yourself; do not split `expect`. `signedIn` cases: leave them in a `testsYaml` / `testsFile` (the server skips them with a warning) and run them as a
`run_task` with the target's vault `credentials`; never put them in `cases`.

## Mapping a case to `smoke_test` (fallback when `qa_run` is absent)
| tests.yaml | smoke_test |
|---|---|
| `target url` + `path` | `url` |
| `steps` | `steps` (one string each) |
| `expect` literal text on the page | `expectText` |
| `expect` the address changes | `expectUrl` (a fragment such as `/dashboard`) |
| `expect` an error must not show | `expectNoText` |
| `checks.text` / `checks.url` / `checks.noText` | `expectText` / `expectUrl` / `expectNoText` (when `checks` is set it wins over `expect`) |
| no `expect` and no `checks` | no assertion: the case only proves the page loads and the steps run; say so in the summary, and add an `expect` to the case if you can |
| expectation needs judgement (a total, a colour, an order) | split into literal checks (`expectText` for the total), or explore with `run_task` and report it as explored |

## `.webagent/` format
Full description: `docs/WEBAGENT-FOLDER.md` in the plugin repo; templates in `${CLAUDE_PLUGIN_ROOT}/templates/.webagent/`. The
`tests.yaml` format is a shared contract (the dashboard import and CI read the same file): add no field of your own.
`product.md`: free Markdown (what the app is, roles, key flows, environments, test accounts by vault namespace, never passwords).
`tests.yaml` (a file that is only a list of cases is valid too):
```yaml
version: 1                       # optional
name: My app smoke tests         # optional; key: <slug> lets CI update the same workflow
targets:                         # one per environment (or `url: https://...` for a single site; never both)
  local:   http://localhost:3000                   # local URLs: connect your machine, else a tunnel
  staging: { url: https://staging.example.com, credentials: staging }  # credentials = vault namespace
defaultTarget: staging           # optional, default the first target
engine: qa                       # optional: engine slug or id for run_task cases (default: config.yaml engine, else the project default engine)
concurrency: 3                   # optional 1-10, maxCostUsdPerCase: 0.5 optional (workflow runs)
cases:                           # required, 1-100
  - id: signup-happy             # optional slug; made from the title if missing
    title: A new user can sign up       # required
    path: /signup                # optional, default /
    steps: ['type "qa+{{uid}}@example.com" into Email', 'type "Throwaway-{{uid}}-pw1" into Password', click "Create account"]   # optional
    expect: shows "Welcome" and address contains /dashboard   # optional; forms the server reads: shows "X", address contains Y, does not show "Z"
    checks: { text: Welcome, url: /dashboard, noText: error }              # optional, wins over expect
    tags: [smoke, auth]
    priority: 1                  # 1 (most important) to 5, default 3. 1 = run on every change
    signedIn: false              # optional: needs the target's vault login (the plugin runs it via run_task; workflow runs skip it)
```

## Writing steps that replay
One action per step. Name a control by its visible label (`click "Create account"`, `type "..." into Email`). Quote every typed value; a
description ("a unique email") is typed as written. `{{uid}}` is a new short value per run: `qa+{{uid}}@example.com`. No secrets in steps.
`expect`: `shows "X"`, `address contains Y`, `does not show "Z"` (join with "and"); other wording is "not checked". When unsure use `checks`.
**YAML colon trap:** a value that contains `: ` (colon, space) is quoted as a whole: `expect: 'shows "Total: $19.00"'`. Unquoted
(`expect: shows "Total: $19.00"`) is invalid YAML and the whole file fails to load. Same for steps (`- 'click "Pay: now"'`). Check this on every case you write.

## Final summary template
Passed: one line. Failed: one block, filled from `qa_status { id, caseId }` (call it once per failed case). Keep each field to one line.
```
QA <target url> · <n> passed · <n> failed · <n> could not test
PASS  <case id> - <title>
FAIL  <case id> - <title>
  Page:      <failing page URL (the step's `url`, else `finalUrl`)>
  Step:      <step number and title>
  Expected:  <expected>   Actual: <actual>          (or: not recorded)
  Console:   <first 1-2 console errors, each cut to ~120 chars>   (or: none recorded)
  Requests:  <METHOD url -> status>, up to 3          (or: none failed)
  Screenshot: <url>
  Likely cause: <one line>. Look at <file:line or route/handler>   (no repo open: "not checked: no repo")
  Status: <Fixed and re-run: pass | Fix ready, redeploy then /webagent:qa rerun | Still failing after 2 rounds>
COULD NOT TEST  <case id> - <why>. To unblock: <one step>
Watch live / replay: <dashboardUrl>. Report <reportSignedUrl> (expires <urlsExpireAt>), recording (needs your key)
Warnings: <the Warning: lines, e.g. signedIn cases skipped>
Changed: <files>, tests.yaml: <cases added/edited>. Skipped: <cases>. Tunnel / connect: closed.
```
