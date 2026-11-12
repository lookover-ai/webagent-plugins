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
