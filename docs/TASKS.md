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
- [ ] **K5 · Last-run memory.** `/webagent:qa rerun failed` across sessions: write `.webagent/.last-run.json` (case ids, verdicts,
  report ids, no URLs with tokens), gitignored. Only if K2 shows testers need it.
- [ ] **K6 · Import into Workflows.** When the api's Workflows module imports `.webagent/tests.yaml`: move the schema to
  `../webagent-contracts`, drop the draft banner in `docs/WEBAGENT-FOLDER.md`, add `/webagent:qa-ci` (print the CI call).
- [ ] **K7 · Publish.** CTO creates the public repo `lookover-ai/webagent-plugins` after Abhisht's OK; license is MIT (decided, `LICENSE`);
  switch the default API URL to the production host when it exists; submit to Anthropic's directory if wanted.
