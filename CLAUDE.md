# webagent-plugins

Plugins and snippets that put webagent QA inside the user's own coding agent (Lookover suite, task prefix `K`).
First product: the Claude Code plugin `webagent` (general connector: `/webagent:run`, `/webagent:engines`; QA is the headline use case: `/webagent:qa`) plus a Codex snippet. Public repo planned
(`lookover-ai/webagent-plugins`); until the CTO creates it there is no remote: do not add one, do not push.
Product decisions: `../webagent/hub/specs/qa-tester-usecase.md`, `../webagent/hub/ENGINES.md` (the `qa` engine).

> **Managed from the hub.** This file wins inside this repo. Hub product rules still bind: no CAPTCHA solving, no
> fingerprint evasion, no humanized input; SSRF guard (our cloud browser never opens localhost, a tunnel is the user's
> door); contracts are the only shared code (copy no API types here); no secrets anywhere.

## Layout
```
.claude-plugin/marketplace.json     marketplace `webagent`, one plugin
plugins/webagent/                   the plugin (installs copy ONLY this folder: nothing in it may reach outside it)
  .claude-plugin/plugin.json        name, version, license MIT, userConfig (api_key sensitive, api_url default)
  .mcp.json                         http MCP server `webagent` (${user_config.api_key}, ${user_config.api_url})
  skills/browse/SKILL.md            general web tasks (hub D66); reference.md beside it
  skills/qa-test/SKILL.md           the QA workflow, written for a model; long reference in reference.md
  commands/run.md, engines.md, qa.md, qa-init.md, qa-ci.md   /webagent:run, :engines, :qa, :qa-init, :qa-ci
  templates/.webagent/              config.yaml, product.md, tests.yaml starters
  templates/github/webagent-qa.yml  the workflow /webagent:qa-init offers (checked against github-action/action.yml)
codex/AGENTS.md, config.toml        the same workflow for Codex
github-action/                      the GitHub Action (K10): action.yml, src/ (TypeScript), dist/ (committed bundle + vendored CLI), README
docs/WEBAGENT-FOLDER.md             the `.webagent/` format; docs/TASKS.md, docs/PROGRESS.md
```

## Rules
1. **Truth lives in the api code.** Every tool name and argument in a skill is checked against
   `../webagent-api/src/modules/mcp/*` and the contracts. A gap in the product goes to the hub as a task, never into the
   skill as a promise. Re-check after every api MCP change (tool table in `reference.md`, `codex/AGENTS.md`).
2. **The skill is read by a model.** Short imperative steps, exact arg names, no marketing. Keep SKILL.md under 200 lines;
   long tables go in `reference.md`. A claim the model should not make (a fix is live, a CAPTCHA passed) is a rule in the skill.
3. **Never** put a secret, a real key or a real host id in a file. Placeholder keys: `wa_<region>_...`. The default API URL
   lives in ONE place (`userConfig.api_url.default` in `plugin.json`; plus `codex/config.toml`); change both together when production hosts exist.
4. **`tests.yaml` is a shared contract** (`../webagent-contracts/src/public/tests-file.ts`, 0.36.0); it wins over `docs/WEBAGENT-FOLDER.md`.
   Never add a field here: request it from the hub, then follow. The public docs describe it in words (no link to the private repo).
   `scripts/check-templates.py` checks the templates (set `WEBAGENT_CONTRACTS_DIST` to also run the contract's own reader).
5. The plugin has NO env fallback for the key: `${user_config.x:-${ENV}}` makes Claude Code drop the server (tested, v2.1.322). Do not
   add one. Codex keeps `WEBAGENT_API_KEY`.
6. Bump `version` in `plugin.json` on every change users should receive (Claude Code caches by version).

## Check (before every commit)
```
claude plugin validate .                         # marketplace
claude plugin validate plugins/webagent          # plugin + skills + commands + MCP entries
claude plugin validate plugins/webagent --strict # warnings count too
claude -p --plugin-dir plugins/webagent --output-format stream-json --verbose "hi"   # init line lists skills, commands, MCP server
H=$(mktemp -d) && cp codex/config.toml "$H" && CODEX_HOME="$H" codex mcp get webagent   # Codex parses the TOML
python3 scripts/check-templates.py   # templates parse and match the format (WEBAGENT_CONTRACTS_DIST=../webagent-contracts/dist adds the contract reader)
```
The plugin has no build and no dependencies. `github-action/` does: `cd github-action && VITEST_MAX_WORKERS=4 flock /tmp/claude-1000/webagent-heavy.lock pnpm check` (typecheck, tests, build; commit `dist/`; re-vendor `dist/webagent.cjs` from `../webagent-contracts/cli/dist/webagent.cjs` after `pnpm -C cli build` there). The Action only maps inputs to the CLI's flags: the CLI and the api own behaviour. No dev server. Commits: one block, check green; no remote yet (DEV MODE applies once it exists).
PROGRESS.md entry per task (max 10 lines: `## <date> <id> done`, `Done:`, `Next:`, `Gotchas:`).
