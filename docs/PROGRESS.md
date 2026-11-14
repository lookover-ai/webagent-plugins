# Progress · webagent-plugins

## 2026-11-12 K1 done
Done: marketplace `webagent` + plugin `webagent` 0.1.0 at `plugins/webagent`: `.mcp.json` (http, `${WEBAGENT_API_URL:-staging}/mcp`,
bearer `${WEBAGENT_API_KEY}`), skill `qa-test` (+ `reference.md`), `/webagent:qa`, `/webagent:qa-init`, `.webagent/` templates and
`docs/WEBAGENT-FOLDER.md`, Codex `AGENTS.md` + `config.toml` (parsed by `codex mcp get`), README, CLAUDE.md. Tool names and args read from
`webagent-api/src/modules/mcp/*` (api main bbe8e07) and contracts 0.33.x: `smoke_test`, `get_report`, `run_task` (takes `engineId`, `record`,
`headers`, `credentials`) are all there. Check: `claude plugin validate` on marketplace and plugin, plugin load test.
Next: K2 (run it for real with a key). Not done: no end-to-end run (no key, local stack not up), tunnel recipe not run.
Gotchas: installs copy only `plugins/webagent/`, so templates live inside it, not at the repo root. Codex's default tool timeout (60 s) is
shorter than a `smoke_test` wait, so `config.toml` sets 120. `engineId` must be a full id; the skill derives the `qa` id from the region.

## 2026-11-12 K2 + K3 done (plugin 0.2.0)
Done: skill/reference/Codex text from the tunnel run (smoke_test default, run_task never the gate, cloudflared default, ngrok header,
warning-page = error, engine slug then id, qa_run/qa_status when listed). `userConfig` api_key (sensitive, required) + api_url (default
staging) with `${user_config.*}` in `.mcp.json`; MIT `LICENSE` + `license`; README (beta staging host, OAuth coming).
Next: K4; live `/webagent:qa` run on staging; read `qa_run` args after api A86 and update SKILL.md section 4A + reference.md.
Gotchas: `${user_config.api_key:-${WEBAGENT_API_KEY}}` drops the server silently (so no env fallback); an unset required option also
hides the server; a default on `api_url` is enough (install says "not yet set" but connects). `claude plugin install --config k=v` sets
options non-interactively (used for the fake-server test of the Authorization header).

## 2026-11-12 K5 done (plugin 0.3.0)
Done: hub D66 split. New skill `browse` (+ reference.md), `/webagent:run`, `/webagent:engines` (asks before writing config), `.webagent/config.yaml`
(template + `docs/WEBAGENT-FOLDER.md`), qa-test engine order `tests.yaml` > `config.yaml` > `qa`, README/plugin.json/marketplace/Codex general first.
Tool names checked against `webagent-api/src/modules/mcp` (scrape, screenshot, pdf, crawl, run_task, create_session, skill_*) and contracts quick.ts.
Next: when api A91 lands, confirm `list_engines` output and slug `engineId`, drop the "if in your tool list" hedges; K4; K5b; live run on staging.
Gotchas: quick tools (scrape etc.) take no engineId or vault credentials. The plugin does not read `apiUrl` from config.yaml (URL is a plugin setting). Old K5 row renamed K5b.

## 2026-11-12 K6 done (plugin 0.3.1)
Done: tests.yaml now follows the shared contract (contracts 0.36.0, `tests-file.ts`): doc rewritten as short table + "contract is the reference",
template valid (`targets` as url strings, `checks`, `signedIn`, priority 1-5 default 3), skill/reference/qa-init/Codex updated, `qa_run` inline mapping
(`expect` and `checks` pass through, `id` derived from title, `path` `/`, `steps` `[]`, `signedIn` left out, no headers so ngrok uses `smoke_test`).
`scripts/check-templates.py` (PyYAML; `WEBAGENT_CONTRACTS_DIST` also runs `readTestsFile` + `testsFileToWorkflowRequest`).
Next: `/webagent:qa-ci` once the CI call is documented; K4; K5b; K7.
Gotchas: `qa_run` cases need `id`, `path`, `steps` (api schema), so the plugin fills them; the file allows omitting them. Public docs must not link the private contracts path.

## 2026-11-12 K7a done (plugin 0.4.0)
Done: api A94 (80a67b0) wired into the plugin. `qa-test` section 4 rewritten: one `qa_run` (`testsFile` filtered, or `cases` with only `title`), no id/path/steps
filled by the plugin, `session.headers` for ngrok, `signedIn` left in the file (server warns) and run via `run_task` + vault namespace, `Warning:` lines and the
`Watch live:` link surfaced once, `qa_status { id, caseId }` for detail; `smoke_test` only if `qa_run` absent. reference.md (qa_run arg table), browse, `/webagent:qa`,
Codex `AGENTS.md`, README, format doc. Hedges for A91 dropped (slug `engineId`, `list_engines`). Old K7 publish row renamed K8.
Next: K8 publish; K4; K5b; live run with a real Claude Code on staging once A94 is deployed.
Gotchas: `cases` refuse `signedIn` but `testsFile` skips it with a warning; `qa_run` caps at 20 cases (inline request limit) even from a file of 100; `maxCostUsdPerCase` is not applied to inline runs.

## 2026-11-12 K7b done (plugin 0.4.1)
Done: api A96 (d27cb2e, contracts 0.38.0) wired in. `qa_run { testsYaml }` for a whole tests.yaml (raw text, <=64 KB, YAML errors with line/column); `session` allowed with `workflowId`;
`maxCostUsdPerCase` of a file is applied (note removed); diff-picked cap 5 -> 10; engine `slug` is for built-ins only (forks by `id`). SKILL 4A/4C, reference, `/webagent:qa`, Codex `AGENTS.md`.
Next: K8 publish; K4; K5b; live run on staging. Api ask: allow `caseIds` / `tags` with `testsYaml` / `testsFile` (now refused: "apply to a saved workflow").
Gotchas: brief said select with `caseIds`/`tags` + `testsYaml`; qa-tools.ts refuses that, so a subset still sends parsed `testsFile` and `testsYaml` runs the whole file (max 20 cases). `maxCostUsdPerCase` only via a file, `cases` has no such arg.

## 2026-11-12 K9 done (plugin 0.4.2)
Done: from the e2e gate (real Claude Code run). SKILL 3/5/8 + reference: `qa_status` once per failed case; exact final-summary template (page URL, step, expected vs actual, console, requests, screenshot, likely cause); "writing steps that replay" (quoted values, `{{uid}}`, one action, visible labels, canonical `shows "X"`) in reference, WEBAGENT-FOLDER.md, qa-init. Templates fixed.
Next: K8 publish; K4; K5b. Api asks (gate): `expect` prefix `the page shows`; runtime matcher must not type descriptive values; case `failure` should carry url + first console error.
Gotchas: `{{uid}}` in a case step is filled by the runtime (`template.ts`/`runner.ts`); the `signedIn` template `expect` now uses a quoted placeholder. Codex AGENTS.md already says to call `qa_status` for failed cases; template line added there too.

## 2026-11-12 K10 done (GitHub Action, hub G5)
Done: `github-action/` (node24 JS action; `src/` inputs/outcome/github/report/run/main; `dist/index.cjs` 18 KB + vendored CLI `dist/webagent.cjs` 1.25 MB from contracts 6c5fadf). Inputs map to CLI flags; running comment then final one, edited in place by marker; fork/Dependabot no-key skip (exit 0); exit 0/1/2/3, `fail-on never`, `on-error neutral`; replay links via `POST /v1/sessions/:id/share` (private repos default). 54 tests + a real-spawn smoke against a fake API/GitHub (pass, fail, key revoked). README has the YAML.
Next: K8 publish + tag `v1`; run on a real repo (needs the public repo); `act` is not installed, so no act smoke.
Gotchas: node20 and node24 are the only JS runtimes (node24 used, CLI built for node22 works). `DEFAULT_API_URL` is duplicated in `src/run.ts` (for share links only): change with the CLI constant. Comment key comes from `workflow:` or a top-level `key:` line of the file (regex, not a YAML parse). Setup/CLI output is not in the dashboard comment unless it starts with `Setup problem:`.

## 2026-11-12 K10b done (plugin 0.4.3)
Done: contracts pull (2582c0e), CLI rebuilt and re-vendored into `github-action/dist/webagent.cjs` (resolveEngine present); `dist/index.cjs` unchanged. New test: exit 3 `Engine 'my-qa' not found in this project` reaches the PR comment and job summary (setupLines path, no Action code change). Engine order per D68 (tests.yaml `engine` > saved workflow's engine > project default) in Action README; "default qa" wording removed from qa-test SKILL/reference, engines command, WEBAGENT-FOLDER.md, tests.yaml template, Codex AGENTS.md, README. `qa` stays a suggestion.
Next: K8 publish + tag v1; K4; K5b.
Gotchas: the plugin's `config.yaml`/qa flow still falls back to omitting `engineId` (project default); CLAUDE.md layout line unchanged.

## 2026-11-13 K11 done (qa-polish B3)
Done: staging PR #2 showed a replay share link for attempt 1 while the report and API said attempt 2. `report.ts` `finalCases` does a fresh `GET /v1/workflow-runs/<id>` (same key, API URL) after the CLI exits; `run.ts` builds the 7-day share links from those cases, falling back to the CLI's `runJson.cases` if the read fails or has no cases. 2 new tests in `run.test.ts` (58 total); `dist/index.cjs` rebuilt. Comment format, exit codes, check status unchanged.
Next: CTO release (tag `v1` not moved); K8.
Gotchas: the Action only copies the CLI's stdout JSON (`WorkflowRun` printed after `waitForWorkflowRun`, `cli/src/run-test.ts:338`); it never read `attempts[0]`. So the CLI's last poll held a stale `sessionId` (api race: verdict terminal before the retry swapped `session_id`?). Not confirmed; the Action no longer depends on it.

## 2026-11-13 K12 done (plugin 0.5.0, qa-polish G9)
Done: `/webagent:qa-init` step 7 offers (asks first) `.github/workflows/webagent-qa.yml` from `templates/github/webagent-qa.yml` (the Action README example, only `url:` edited) + tells the user to add repo secret `WEBAGENT_API_KEY` from dashboard API keys. New `/webagent:qa-ci`: GitHub snippet, CLI call (flags/env from `cli/src/args.ts`), exit codes 0/1/2/3 as the CLI defines them, writes nothing. YAML colon trap: `expect: 'shows "Total: $19.00"'` + one-line why in tests.yaml template, format doc, SKILL, reference, Codex. `check-templates.py` now also checks the workflow (inputs vs `action.yml`) and unquoted `expect:` in docs. README/CLAUDE.md command lists.
Next: K8 publish + tag v1; a real run of the offered workflow (not tonight).
Gotchas: the CLI is not on npm, so `/webagent:qa-ci` for non-GitHub CI says to get `webagent.cjs` from the webagent team (CLI request: publish `@lookover-ai/webagent-cli`). Action `github-action/` untouched, tests not re-run.

## 2026-11-14 K13 done (Action: practice mode, PR context, deployment URL; qa-dist A1)
Done: input `mode` (`enforce` default = old behaviour; `practice`: exit 1 -> green job, `verdict` output stays `fail`, banner in summary and comments; exit 2 follows `on-error`, exit 3 and a bad `mode` still fail). `src/context.ts`: non-fork PR title/body/changed paths (REST `pulls/:n/files`, 300 max, errors tolerated) -> env `WEBAGENT_CI_TITLE/BODY/CHANGED_FILES` (never logged or commented). `deployment_status` + empty `url` -> `environment_url || target_url`, state != success skips neutral. Headings Passed/Failed/Couldn't test, `Cost: $x.xx` from `costMicros` (settled run read, else CLI JSON). 79 tests, `dist/index.cjs` rebuilt, vendored CLI and tag `v1` untouched, templates need no change.
Handoff: done = branch feat/k13-action-practice-pr-context + PR into development. Left = CLI must read the 3 env vars (contract request to CTO); CLI report wording (PASS/FAIL words in the report body) is separate; tag `v1` not moved (CTO). Next = K8 publish; re-vendor CLI when it reads the env.
Gotchas (superseded by K14: the Cost line is gone): the CLI report body keeps its own headline and its own `$ AI` cost, so the Cost line repeats it; an old test relied on a bare deployment_status event, now it needs `deployment_status.state`. Event with empty `url` and non-success state now skips (before it ran the file target).

## 2026-11-14 K9a done (plugin 0.6.0, qa-dist P1)
Done: `/webagent:qa-triage` (run id > last run > `qa_list_runs` if listed > ask; `qa_status` once per failed case; app bug / test needs update / couldn't test; tests.yaml diff only with a yes; `qa_file_bug` if listed else markdown bug). `qa_report`/`qa_quick_check` taught as aliases of `get_report`/`smoke_test` (checked in api A159 `qa-profile.ts`). Codex commented `/mcp/qa` block, README Cursor section. `.mcp.json` unchanged (stays `/mcp`).
Next: K8 publish; P2 (K9b localhost connect) when R82 block 3 lands; re-check names once A161 (10-tool set, `qa_list_runs`/`qa_file_bug`) is on staging.
Gotchas: API keys work on `/mcp/qa` (api A159 `auth.guard.ts:65-79` has no route check for `wa_` keys; test `mcp-qa.test.ts:173`), BUT a `ci`-scope key is refused there: `ci-scope.ts` allowlist has only `POST /mcp`. README says use a member/full key. Cursor snippet uses `${env:WEBAGENT_API_KEY}` (Cursor interpolates env in `url`/`headers`), no literal key. `qa_list_runs`/`qa_file_bug` are not in the api yet: the command says "if in your tool list". Codex cannot run both servers (duplicate `qa_run`), so the QA block is a commented replacement.

## 2026-11-14 K9b done (plugin 0.6.1, qa-dist P2)
Done: localhost via `webagent-device connect <port>... --json` (runtime `feat/r82-local-app`: `cli.ts`, `connect-command.ts`, `local-app.ts`) in SKILL 7A, reference "Local app: connect", `/webagent:qa`, Codex `AGENTS.md`, README line. Three-part gate (tool + `connect`, `qa_run` lists `localApp`, `status` has `alias`) else "Local-app mode is coming soon; using a tunnel" and cloudflared (7B, unchanged). No `--yes` until the user said yes in chat (a background shell has no terminal, the client then answers no). `kill` the process at the end. Host-check hint = the client's wording. Built on K9a (cherry-pick of b99bed0, plugins PR #2).
Next: re-check when A162 lands (api); `webagent-device` publish is Abhisht's call; a dashboard pairing code for a local app does not exist yet (web `ProxyDeviceNew` has no purpose), so first pairing is "coming soon" for most users.
Gotchas: no pushed api branch accepts `localApp` on `qa_run`: only the uncommitted work in the A162 worktree (`src/modules/mcp/local-app-target.ts`, `qa-tools.ts`). There the api rewrites a `localhost` url to the alias; an alias URL sent directly is NOT routed, so the skill sends the localhost url. Not run against a real device client (unpublished).

## 2026-11-14 K9c done (plugin 0.6.2, qa-dist F1)
Done: host-check fix in skill 7A step 5, reference "Local app: connect" (new recommended/alternative table) and Codex `AGENTS.md` now gives the suffix: `".local-app.invalid"` (Vite `server.allowedHosts`, webpack-dev-server `devServer.allowedHosts`, Angular `allowedHosts`), `"*.local-app.invalid"` (Next.js `allowedDevOrigins`), exact alias as the alternative, never `true`/`all`. Syntax checked in the official Vite, webpack, Next.js and Angular docs; Angular passes the option to Vite.
Next: re-check when the device client prints its own hint (it still names the exact alias); K8 publish.
Gotchas: K9a/K9b were cherry-picked onto staging first (-x). K9a's squash carried K13 rows (Action practice mode) that are not on staging: the K13 TASKS/PROGRESS entries were dropped here, they arrive with the K13 squash. Next.js `*` matches one name part only (the alias is one), and not the bare domain. The tunnel hint (7B) is unchanged: a tunnel host is not ours to allow by suffix.
Check: validate x3 and check-templates.py (see PR).

## 2026-11-14 K14 done (Action on CLI 0.2.0, qa-integrate)
Done: re-vendored `dist/webagent.cjs` = CLI 0.2.0 from contracts tag `v0.45.0-rc.1` (tag obj 91e8d6b, commit cb74dd4). CLI reads `WEBAGENT_CI_TITLE/BODY/CHANGED_FILES` = the names K13 sets; new `cli-contract.test.ts` checks them against the bundle. Action `Cost: $x.xx` line removed (`costLine`, `settledRun`, `costMicros` plumbing; `finalCases` kept), report fixture uses Passed/Failed words, verdict still from exit code + JSON (test with old and new words). README: words, no own cost line, vendoring note. 82 tests (79 - 2 cost + 5 new), `dist/index.cjs` rebuilt, inputs/defaults unchanged.
Handoff: done = branch chore/k14-action-cli-0-2-0 (K14 on top of K13 e4058f8, already on development), PR into development. Left = tag `v1` not moved (CTO); re-vendor from the final `v0.45.0` tag, not rc.1; docs engineer: PR-context env names in README section 5. Next = K8 publish; a real PR run once the API stores `ci.title/body/changedFiles`.
Gotchas: the report.md in the PR comment is the API markdown (`getWorkflowRunMarkdown`); the CLI 0.2.0 words live in its stderr table and JUnit, so the API markdown may still use older headings until the api prints the same words. The Action does not depend on any of them. check-templates passes; no e2e run.

## 2026-11-14 K15 done (Action on CLI 0.3.0, qa-next I0c')
Done: re-vendored CLI 0.3.0 (contracts 722e5b8, built in a worktree) + new `github-action/CLI-SOURCE`. Action no longer reads the run reply for a verdict: `outcomeFor(exit code, fail-on, on-error, mode)`; `on-error: neutral` is applied by the Action (CLI always `--on-error block`, so its exit 0 is a real pass); `mode: practice` (K13) only softens exit 1 and never turns a could-not-test into a pass; `parseRun` takes only id/flaky/cases with type checks; replay links only for `fail` cases with a string session id. Exit 3 sentence + issue lines now also in the `::error` annotation. `src/cli-bundle.test.ts`: real-spawn of the vendored bundle against a fake API (unknown verdicts not green, unknown step/expect/file keys reach the server untouched, 400 refusal = exit 3 with sentence). Rebased onto `origin/development` (needs K13 practice mode and K14 CLI 0.2.0 PR context, PRs #1-#5); `cli-contract.test.ts` updated to CLI 0.3.0. Typecheck green, `dist/` rebuilt twice with no diff; `check-templates.py` not needed (templates untouched). WATCH(qa-next): none new in Action code (CLI's own WATCH lines stay in contracts).
Handoff: done = branch `feat/i0c-action-cli-0-3-0` + PR #6 into development. Left = move tag `v1` (Abhisht's go, after #1-#5 and this reach `main`). Gotchas = `pnpm build` finds the CLI at `../../webagent-contracts` only from the main checkout: from a worktree set `WEBAGENT_CLI_BUNDLE`; the Action now depends on CLI 0.3.0 behaviour (unknown verdict = exit 2), so never vendor an older CLI.
