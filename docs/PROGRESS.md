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
