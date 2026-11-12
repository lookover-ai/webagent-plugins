# Tasks · webagent-plugins

Task prefix `K`. One block per session. Check: see `CLAUDE.md`. Brief: `../webagent/hub/specs/qa-tester-usecase.md`.

- [x] **K1 · Claude Code plugin + Codex snippet.** Marketplace `webagent`, plugin `webagent` 0.1.0 (MCP server, skill
  `qa-test`, `/webagent:qa`, `/webagent:qa-init`), `.webagent/` templates and format doc, Codex `AGENTS.md` + `config.toml`, README.
- [x] **K2 · Run the loop for real.** Evidence: `../webagent/hub/overnight/qa-ready/tunnel-check.md` (local stack, real model,
  cloudflared + ngrok, planted bug). Skill now: `smoke_test` per case by default, `run_task` only to explore (never the gate),
  cloudflared default + ngrok header recipe, tunnel-warning-page rule, qa engine slug then id, `qa_run`/`qa_status` when listed.
  Open: a signed-in `run_task` and `/webagent:qa` driven by a live Claude Code (not JSON-RPC) on staging; `qa_run` args once A86 lands.
- [x] **K3 · Key setup without shell exports.** Plugin `userConfig` (`api_key` sensitive + required, `api_url` default staging),
  `${user_config.*}` in `.mcp.json`; validated and tested with a fake server (the header carried the key). No env fallback is
  possible (see CLAUDE.md rule 5); README says so and notes OAuth sign-in is coming, API keys stay for CI.
- [ ] **K4 · Codex packaging.** Check whether Codex loads Agent Skills / plugins from a repo path; if so ship the same
  `qa-test` skill instead of an `AGENTS.md` paste. Run the Codex snippet with a real agent.
- [ ] **K5b · Last-run memory.** `/webagent:qa rerun failed` across sessions: write `.webagent/.last-run.json` (case ids, verdicts,
  report ids, no URLs with tokens), gitignored. Only if K2 shows testers need it.
- [x] **K5 · General connector (hub D66).** Plugin 0.3.0: skill `browse` (+ reference), `/webagent:run`, `/webagent:engines`,
  `.webagent/config.yaml` (`version`, `engine`, `apiUrl` note; format + template), engine order in `qa-test`, README / plugin.json /
  Codex `AGENTS.md` general-first. Waits on api A91 for `list_engines` and slug `engineId` (skills say "if in your tool list").
  (The old "Last-run memory" row is renamed K5b.)
- [x] **K6 · tests.yaml is a shared contract (contracts 0.36.0).** Plugin 0.3.1: `docs/WEBAGENT-FOLDER.md`, templates, skill/reference,
  `qa-init`, Codex `AGENTS.md` follow the contract (optional steps/expect/targets, `url` shorthand, `defaultTarget`, priority 1-5 default 3,
  `checks`, `key`, `concurrency`, `maxCostUsdPerCase`; `signedIn` skipped by workflow runs); `qa_run` inline mapping; `scripts/check-templates.py`.
  Open: `/webagent:qa-ci` (print the CI call) waits on the CI endpoint docs.
- [x] **K7a · qa_run tests-file path (api A94, plugin 0.4.0).** Default QA path is one `qa_run` with the filtered `testsFile` (or `cases`; only
  `title` required, no id/path/steps from the plugin); `session.headers` on `qa_run` replaces `smoke_test` for ngrok; `Warning:` lines (skipped
  `signedIn`) and the `Watch live:` link surfaced once per run; task steps `url`/`expected`/`actual`; `smoke_test` kept as fallback only when
  `qa_run` is absent; A91/A94 hedges dropped (slug `engineId`, `list_engines`). Skills, reference, `/webagent:qa`, Codex `AGENTS.md`, README, format doc.
- [x] **K7b · qa_run testsYaml (api A96, plugin 0.4.1).** Whole `tests.yaml` goes as raw `testsYaml` (server parses, YAML errors with line/column); a subset still goes
  as filtered `testsFile` (the api has no `caseIds`/`tags` with a file: see PROGRESS); `session` also with `workflowId`; `maxCostUsdPerCase` applied; cap from the diff 5 to 10; `slug` on built-in engines only.
- [x] **K9 · Gate fixes (plugin 0.4.2).** Failed cases: `qa_status` once each, summary template with page URL, expected vs actual, console, requests, screenshot, likely cause (reference.md). Templates and docs use quoted values / `{{uid}}` and the canonical `shows "X"` form; "writing steps that replay" note.
- [x] **K10 · GitHub Action (hub G5, spec automation-ci §4).** `github-action/`: `node24` JS action (`action.yml`, inputs `api-key`, `api-url`, `url`, `file`, `workflow`, `target`, `tags`, `case-ids`, `sync`, `wait-for-url`, `timeout-minutes`, `retries`, `on-error`, `fail-on`, `comment`, `share-links`, `github-token`; outputs `verdict`, `run-id`, `run-url`, `flaky`), runs the vendored CLI (contracts 6c5fadf), job summary, sticky PR comment (marker `<!-- lookover-qa:<key> -->`), fork-PR neutral skip, exit 0/1/2/3, 7-day replay links (private repos by default). 54 tests; README with workflow YAML. Local only: no remote, no tag.
- [x] **K10b · Engine per D68 in the Action + docs.** Re-vendored CLI 0.1.1 (contracts 2582c0e: `engine:` from tests.yaml via `resolveEngine`, unknown engine exit 3 "Engine '<ref>' not found in this project"); Action test for that message in summary + PR comment (55 tests); README "Which engine runs the tests"; no "default qa" wording left in skills, templates, format doc, Codex, README (plugin 0.4.3). Local only.
- [x] **K11 · PR comment share links use the case's last attempt (qa-polish B3).** The Action reads the settled run (`GET /v1/workflow-runs/<id>`, same key and API URL) and shares `cases[].sessionId` from it; the CLI's JSON is only the fallback if the read fails. 58 tests; `dist/index.cjs` rebuilt; tag `v1` not moved.
- [ ] **K8 · Publish.** CTO creates the public repo `lookover-ai/webagent-plugins` after Abhisht's OK; license is MIT (decided, `LICENSE`);
  switch the default API URL to the production host when it exists; submit to Anthropic's directory if wanted. Also: tag `v1` (the dashboard card prints `@v1`), re-vendor `github-action/dist/webagent.cjs` from the CLI that is then published.
