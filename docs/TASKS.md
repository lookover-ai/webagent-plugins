# Tasks · webagent-plugins

Task prefix `K`. One block per session. Check: see `CLAUDE.md`. Brief: `../webagent/hub/specs/qa-tester-usecase.md`.

- [x] **K1 · Claude Code plugin + Codex snippet.** Marketplace `webagent`, plugin `webagent` 0.1.0 (MCP server, skill
  `qa-test`, `/webagent:qa`, `/webagent:qa-init`), `.webagent/` templates and format doc, Codex `AGENTS.md` + `config.toml`, README.
- [ ] **K2 · Run the loop for real.** Against staging with a real key and the Test Arena page: `/webagent:qa` on a pass, a fail
  and an `error`; a cloudflared tunnel to a dev server end to end; an ngrok-free tunnel with the header; a signed-in `run_task`.
  Fix the skill where the model misbehaves (tool choice, polling, summary). Needs a key from the CTO.
- [ ] **K3 · Key setup without shell exports.** Use plugin `userConfig` (`sensitive: true`, `${user_config.api_key}`) so Claude
  Code asks for the key when the plugin is enabled; keep `WEBAGENT_API_KEY` as the fallback. Verify the validator and `/mcp`.
- [ ] **K4 · Codex packaging.** Check whether Codex loads Agent Skills / plugins from a repo path; if so ship the same
  `qa-test` skill instead of an `AGENTS.md` paste. Run the Codex snippet with a real agent.
- [ ] **K5 · Last-run memory.** `/webagent:qa rerun failed` across sessions: write `.webagent/.last-run.json` (case ids, verdicts,
  report ids, no URLs with tokens), gitignored. Only if K2 shows testers need it.
- [ ] **K6 · Import into Workflows.** When the api's Workflows module imports `.webagent/tests.yaml`: move the schema to
  `../webagent-contracts`, drop the draft banner in `docs/WEBAGENT-FOLDER.md`, add `/webagent:qa-ci` (print the CI call).
- [ ] **K7 · Publish.** CTO creates the public repo `lookover-ai/webagent-plugins` after Abhisht's OK; decide the license;
  switch the default API URL to the production host when it exists; submit to Anthropic's directory if wanted.
