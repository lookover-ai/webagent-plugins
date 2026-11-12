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
