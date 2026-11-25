# Lookover QA reference

Checked against the Lookover QA server (`/mcp/qa`, hub spec `specs/mcp-structure.md`, D102) and the contracts' QA tool inputs. If a call is
refused with `invalid_input`, trust the error text and the tool's own schema over this file.

## Tools (server `lookover-qa`)
Names are `verb_noun`. Every answer ends with a `next:` line and a dashboard link. Tests you write become **proposals** (a person approves
them in the dashboard, Proposed tests) or, with `git` on a feature branch, **branch drafts**. Results are one of three words: Passed, Failed, Couldn't test.
| Group | Tool | Key inputs | Use |
|---|---|---|---|
| Set up | `list_apps` | `git?` | The Apps of the project; with `git`, which App the repo resolves to and the person's remembered choices (ask which when unclear; never guess) |
| | `create_app` | `name`, `baseUrl`, `environment?`, `repo?` | A new App with its first URL (a public address) |
| | `add_url` | `appId?`, `name`, `baseUrl`, `previewPattern?`, `branch?`, `kind?` | Save a URL (an address of an App: staging, a preview) so runs use it by name |
| | `add_login` | `origin`, `label?`, `username?`, `namespace?`, `role?`, `environmentId?`; later `addId` | A one-time code to save a site login without the password passing through chat; call again with `addId` to see if it was saved |
| | `connect_local_app` | `ports`, `name?` | Connect the person's machine so tests reach their localhost app (needs a signed-in person) |
| Write | `list_tests` | `appId?`, `filter?`, `area?`, `suiteId?`, `limit?`, `git?`, `module?`, `loginRole?`, `include?: ["branch_drafts"]`, `detail?` | Saved tests with their latest result, author and Modules used |
| | `get_test` | `testRef`, `git?` | One test: steps, expectation, recent results; with `git` the branch's override |
| | `create_tests` | `tests[]` or `yaml` or `story`; `suiteId?`, `appId?`, `dryRun` (default true), `git?`; per test `area?`, `loginRole?` (YAML `as:`), `use` + `with` | Show the tests and problems; with `dryRun: false` save as proposed, or as a branch draft when `git.branch` is not the default (`tests[].kind`); warnings name an unknown Area, Module or role |
| | `update_test` | `testRef`, `title?`, `steps?`, `expect?`, `area?`, `loginRole?`, `git?` | Propose a change (or a branch draft with `git`); applies only when a person approves or the PR merges; `flags` lists weakened checks |
| | `list_folders` | `appId?` | The Folders (suites) of the Test suite with test count and latest result |
| | `list_proposed_tests` | `appId?`, `branch?` | Tests and test changes waiting for a person to approve, branch drafts grouped by branch with their flags |
| | `list_modules` | `appId?`, `git?`, `detail?` | Reusable steps with inputs, start state, Used by, health, latest version, the branch's draft |
| | `save_module` | `name`, `steps`, `description?`, `inputs?`, `startState?`, `changeNote?`, `appId?`, `git?` | A new Module version, or a branch draft with `git`; `kind: version\|branch_draft` |
| | `list_areas` | `appId?` | Areas: name, code globs, URL patterns, test counts |
| | `save_area` | `name`, `description?`, `codePaths?`, `urlPatterns?`, `alwaysRun?`, `appId?` | Create or update an Area by name |
| Run | `quick_check` | `url`, `appId?`, `environmentId?`, `maxPages?` | First look at a site with no tests set up; suggests tests (saves none) |
| | `run_tests` | `suiteId?` or `tests[]`; `appId?`, `environmentId?`, `url?`, `tags?`, `dryRun?`, `stopAfterFailures?`, `rerunOf?`, `failedOnly?`, `git?`, `select?` (`changed`\|`all`), `remember?`, `detail?` | Run tests, only those the changed files touch when `git.changedFiles` is sent (answer: `selection`, `runIds`); `dryRun: true` first: the tests that would run and the cost estimate; start only after the person agrees |
| | `get_run` | `runId` or `runIds` (up to 20), `detail?` | How a run is going: result so far, how many finished, which failed, in buckets `yourWork` / `notYourCode` / `environment` |
| | `cancel_run` | `runId` | Stop a run that is still going |
| | `list_runs` | `appId?`, `environmentId?`, `trigger?`, `verdict?`, `limit?`, `branch?` | Recent runs, newest first (each shows what started it, e.g. Claude Code) |
| Results | `get_report` | `runId` or `testRef` (exactly one) | Expected vs saw, one screenshot, healed steps |
| | `share_report` | `runId`, `expiresIn?` | A public read-only link (default 7 days); ask the person first; needs a signed-in person |
| | `file_bug` | `runId`, `caseId`, `tracker?` (`linear`, `jira`, `markdown`) | File or draft a bug for one failed result |
| Knowledge | `get_knowledge` | `appId?` | The App's notes and Knowledge docs |
| | `add_knowledge` | `kind` (`note` = App note, `doc` = Knowledge doc), `appId?`; a note: `text`, `noteType?`, `testRef?`; a doc: `title`, `bodyMd` | Teach Lookover a lasting fact; never a secret |
`?profile=dev` adds `explore_app` and `get_debug_link`; the plugin does not use them.
Argument names are the contracts' (0.73, `qa-mcp.ts`); if a name is refused the error text lists the right one.

## Git context, choose, drafts, selection
`git` = `{ repo: "owner/name", branch, sha?, baseRef?, pr?, changedFiles?, changedFilesTruncated? }` (at most 1000 paths of 300 chars). Untrusted: it steers
the App and URL, the labels and the selection, never access. `remember: true` with a `choose` answer keeps the person's pick for this repo.
`choose` = `{ field, question, options[{ value, label, detail? }], recommended?, rememberable }`: ask, then call again with `field` = the value.
Branch draft = a test or Module saved with `git.branch` not the default: runs at once on that branch, no approval, promoted when the PR merges
if it passed and nothing was flagged, else it becomes a proposal. A flagged change ("removes check '...'") is never applied by itself.
Selection reasons: `area_path`, `area_url`, `module_dependent`, `always_run`, `tracked_full` (a full run was forced), `branch_draft`,
`recently_failed`, `unmapped_include`, `named`. Skipped: `not_affected`, `proposed`, `quarantined`, `archived`, `capped`.
Triage: `get_run` and `get_report` carry `cause` (`app`, `test`, `module`, `environment`) as an AI guess. `get_report` names the Module
and step a failure came from.

## `run_tests`
Give a Folder (`suiteId`) or a list of `tests` (`testRef` = `{ workflowId, caseId }`); neither runs the project's default Folder. Only active
(approved) tests run. `url` overrides the address for this run (a preview, a tunnel, the localhost URL after `connect_local_app`).
`tags` narrows. `rerunOf: <runId>` with `failedOnly: true` re-runs only that run's tests that did not pass (without `rerunOf`, the latest
ended run of the Folder). `dryRun: true` starts nothing and says how many runs and the estimated cost: show it, wait for a yes.
The answer has a `runId` at once; poll `get_run`.

## The report (what to read)
Result words: Passed, Failed, Couldn't test (`pass` / `fail` / `error` in structured fields). A failed test is a result, not a tool error.
| Field | Use |
|---|---|
| summary | Plain sentences, safe to relay. Read first |
| steps | The failed step: title, error, expected vs saw, page URL |
| screenshot | One link; links expire (~5 min): call `get_report` again for a fresh one |
| healed steps | Steps the runner repaired itself: mention them, the test may need an update |
| console errors / failed requests | First few; a failed request is 4xx/5xx or no answer |
| notes | What is missing and why. Read when a list looks too empty |

## Errors that are not the app's fault
| You see | Meaning | Do |
|---|---|---|
| `navigation_blocked` | The browser may not open that address (localhost, private IP, `.internal`) | Local app: 7A or a tunnel (7B); else a public URL |
| Dev server page "Blocked request" / "Invalid Host header" / 403 | The dev server refuses the alias or tunnel host name | Couldn't test; give the allowedHosts line, re-run after the reload |
| capacity or timeout | All browsers of the plan are busy | Wait 30 s, retry once, else Couldn't test |
| `rate_limited` / 429 | Too many requests | Slow down |
| 401 `unauthorized` / `invalid API key`, 421 `wrong_region` | Sign-in expired or revoked, key wrong, or another region | Tell the user (sign in again: `/mcp`, `plugin:webagent:lookover-qa`, Authenticate; or a new key from the right dashboard) |
| `needs_person` / forbidden on `share_report`, `connect_local_app` | An API key has no person | Sign in with Lookover instead, or tell the person to do it in the dashboard |
| CAPTCHA | A bot check appeared | Do not try to pass it. Couldn't test; the person can test that step by hand or use a staging build without it |
| Fail on a tunnel URL, text missing, page is a warning page | The tunnel's interstitial, not your app | Couldn't test: use cloudflared, re-run |

## Local app: connect (`webagent-device connect`)
`connect_local_app { ports }` answers `connected` (with the machine's alias) or `waiting_for_device` with a one-time code (10 minutes) and the exact
command to run in the background in the person's terminal. Call it again until `connected`. The command is `webagent-device connect <PORT>... --code CODE --yes`
(the tool prints it; the code is the person's own).
```
webagent-device connect <PORT>... [--code CODE --api URL] [--yes] [--json]
```
| Part | What it does |
|---|---|
| `<PORT>...` | 1 to 8 different ports, 1024-65535 (`3000 5173` or `3000,5173`). Refused: mail, database, SSH, remote-desktop ports (for example 3306, 5432, 6379, 9200, 27017). Below 1024 is never shared. |
| `--code CODE --api URL` | Only the first time (pairing). `connect_local_app` makes the code for this person's local app and prints the whole command; never invent or reuse a code. Without it: `First time: webagent-device connect <port> --code <PAIRING CODE> --api <URL>` (exit 2). A code for a browser exit: `That pairing code was not made for a local app` (exit 2). |
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
| `Nothing shared.` (exit 1) | Question not answered yes | Ask in chat, then `--yes` (SKILL 7A step 2) |
| `First time: … --code …` (exit 2) | Not paired | Call `connect_local_app` again for a fresh code and command; still no: tunnel |
| `This device is paired as an exit node…` (exit 2) | The machine is a browser exit, not a local app | Tell the user once; tunnel |
| `ports must be 1 to 8…` / `… is a mail, database or remote-access port` (exit 2) | Port not allowed | Another port, or tunnel |
| `Nothing is listening on port N yet. Start your app; this stays connected.` (a `notes` entry) | App not running | Start the app (or ask), then run |
| `Your dev server refused the host name <alias>. Allow it in its config (Vite: server.allowedHosts, webpack-dev-server: allowedHosts, Next: allowedDevOrigins, Angular: allowedHosts) and reload.` | The dev server checks the Host header (400/403/421) | Tell the user this line; after the reload, run |

Say the fix with the suffix, the recommended form because it covers every device and alias (a leading dot means the domain and all its subdomains; in Next.js `*` is exactly one name part, which matches `d-<12 letters>.local-app.invalid`; `.invalid` can never resolve in DNS, so it is safe to allow). Never `true` or `all` (DNS rebinding).

| Tool | Recommended: any alias | Alternative: this alias only |
|---|---|---|
| Vite (`vite.config.ts`) | `server: { allowedHosts: [".local-app.invalid"] }` | `server: { allowedHosts: ["<alias>"] }` |
| webpack-dev-server | `devServer: { allowedHosts: [".local-app.invalid"] }` | `devServer: { allowedHosts: ["<alias>"] }` |
| Angular (`angular.json`, `serve` options; it passes the value to Vite) | `"allowedHosts": [".local-app.invalid"]` | `"allowedHosts": ["<alias>"]` |
| Next.js (`next.config.js`) | `allowedDevOrigins: ["*.local-app.invalid"]` (host name only, no scheme or port) | `allowedDevOrigins: ["<alias>"]` |

`run_tests` side: `url: "http://localhost:<port>"` (also `127.0.0.1`, `[::1]`) is swapped for the alias of the connected machine. Errors are
`invalid_input` with the next step in the text (no machine online, port below 1024).
Do not send the alias URL yourself. In the answer, say "tested through your connected machine", and never that the cloud browser opened localhost.

## Tunnels
cloudflared quick tunnel: no account, no header. `cloudflared tunnel --url http://localhost:PORT`; the URL `https://<words>.trycloudflare.com`
is in its output after ~10 s. Stop it by killing the process you started. It exposes the dev server to the internet while it runs. A "host
not allowed" page means the dev server must allow the tunnel host. ngrok free puts a warning page in front of the site and `run_tests` has
no way to send the header that skips it: do not use it.

## Vault logins (Password manager)
The person saves logins with `add_login` or in the dashboard (Password manager): origin + username + password, grouped by namespace. The
browser fills them for that exact origin; you never see the password. A tunnel URL is a new origin, so a login saved for the real site does
not apply to it: for tunnelled apps use a throwaway login in the test's steps (step text is stored with the run).

## `.webagent/` format
Full description: `docs/WEBAGENT-FOLDER.md` in the plugin repo; templates in `${CLAUDE_PLUGIN_ROOT}/templates/.webagent/`. The
`tests.yaml` format is a shared contract (the dashboard import and CI read the same file): add no field of your own. The file is how you write
tests down; Lookover runs the tests saved in the Test suite. Send the file's raw text with `create_tests { yaml }` (dry run first) to propose its cases.
`product.md`: free Markdown (what the app is, roles, key flows, environments, test accounts by vault namespace, never passwords).
`tests.yaml` (a file that is only a list of cases is valid too):
```yaml
version: 1                       # optional
name: My app smoke tests         # optional; key: <slug> lets CI update the same workflow
targets:                         # one per environment (or `url: https://...` for a single site; never both)
  local:   http://localhost:3000                   # local URLs: connect your machine, else a tunnel
  staging: { url: https://staging.example.com, credentials: staging }  # credentials = vault namespace
defaultTarget: staging           # optional, default the first target
engine: qa                       # optional (part of the shared format; the plugin does not read it)
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
    signedIn: false              # optional: the case needs a saved login (shared format; ask the person to add it with add_login)
```

## Writing steps that replay
One action per step. Name a control by its visible label (`click "Create account"`, `type "..." into Email`). Quote every typed value; a
description ("a unique email") is typed as written. `{{uid}}` is a new short value per run: `qa+{{uid}}@example.com`. No secrets in steps.
`expect`: `shows "X"`, `address contains Y`, `does not show "Z"` (join with "and"); other wording is "not checked". When unsure use `checks`.
**YAML colon trap:** a value that contains `: ` (colon, space) is quoted as a whole: `expect: 'shows "Total: $19.00"'`. Unquoted
(`expect: shows "Total: $19.00"`) is invalid YAML and the whole file fails to load. Same for steps (`- 'click "Pay: now"'`). Check this on every case you write.

## Final summary template
Passed: one line. Failed: one block, filled from `get_report { runId }` (call it once per failed test). Keep each field to one line.
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
Dashboard / replay: <dashboard link from the answer>. Report link (expires): <if shared with share_report>
Warnings: <warnings the answers carried>
Changed: <files>, tests proposed or updated (waiting for approval): <titles>. Skipped: <tests>. Tunnel / connect: closed.
```
