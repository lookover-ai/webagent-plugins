# webagent plugins

Test the web app you are building without leaving your coding agent. Type
`/webagent:qa test the signup I just built`, and Claude Code (or Codex) runs the flow in a real cloud browser through
[webagent](https://webagent.lookover.ai)'s MCP, reads the report, fixes the bug it finds and re-runs only the failed cases.

Your agent knows your code, so it decides **what** to test. webagent decides **how** (cloud browser, QA engine) and keeps
the proof: a verdict, the failed step, console errors, failed network calls, a screenshot and a replay.

## Claude Code

1. Create a webagent API key (dashboard, Keys, Create key; the **member** role is enough) and export it in the shell that
   starts Claude Code:
   ```bash
   export WEBAGENT_API_KEY=wa_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
2. Install the plugin:
   ```
   /plugin marketplace add lookover-ai/webagent-plugins
   /plugin install webagent@webagent
   ```
3. Check `/mcp`: the server `webagent` is connected.
4. First prompt:
   ```
   /webagent:qa test the signup I just built
   ```
   No `.webagent/` folder yet? Run `/webagent:qa-init` once: it reads your code and proposes `product.md` and `tests.yaml`
   (it asks before writing).

| Variable | Needed | Meaning |
|---|---|---|
| `WEBAGENT_API_KEY` | yes | Your key (`wa_<region>_...`). Never commit it. |
| `WEBAGENT_API_URL` | no | API origin without `/mcp`. Default is the staging host below. |

**Availability.** Production hosts are not live yet. The default API is the staging host
`https://webagent-staging-in-api.lookover.ai` (key from the staging dashboard, `https://webagent-staging.lookover.ai`).
Use `export WEBAGENT_API_URL=...` to point somewhere else.

## Codex

1. Add the server to `~/.codex/config.toml` (copy [`codex/config.toml`](codex/config.toml); it sets a 120 s tool timeout because
   a test waits up to 90 s) and `export WEBAGENT_API_KEY=...`.
2. Paste [`codex/AGENTS.md`](codex/AGENTS.md) into your project's `AGENTS.md` (or `~/.codex/AGENTS.md`).
3. Ask: `Smoke test the signup I just built.` Check with `codex mcp get webagent`.

## What it does

1. Picks the target: the URL you give, or a target in `.webagent/tests.yaml`.
2. Reads `.webagent/` and your diff, chooses up to 5 cases (your changed areas plus the smoke cases).
3. Runs them in the cloud browser (`smoke_test`, or `run_task` with the QA engine for signed-in or judgement checks).
4. Reads the compact report. Verdicts: `pass`, `fail` (the app is wrong), `error` (the test could not run: CAPTCHA, blocked
   address, capacity, timeout; never reported as an app bug).
5. Fixes the code for each `fail`, re-runs only those cases, at most 2 rounds. A remote target is re-run only after you deploy.
6. Ends with a short summary: what passed, what failed and why, evidence links.

## Testing localhost

webagent's cloud browser can never open `localhost` or a private address (by design). For a local dev server the agent opens a
tunnel itself (`cloudflared tunnel --url http://localhost:<port>`, no account; or `ngrok http <port>`), tests the public tunnel
URL and closes the tunnel afterwards. **The tunnel exposes your dev server to the internet while it runs. Use test data.**
Nothing is installed for you: install `cloudflared` or `ngrok` once.

## The `.webagent/` folder

`product.md` (what the app is, roles, flows, environments, test accounts by vault namespace, never passwords) and
`tests.yaml` (plain-language cases). Format: [docs/WEBAGENT-FOLDER.md](docs/WEBAGENT-FOLDER.md). Templates:
[`plugins/webagent/templates/.webagent/`](plugins/webagent/templates/.webagent/). It is a draft format and will become a shared
contract when webagent's Workflows import it.

## Safety

The agent never pastes secrets into tool calls (step and goal text is stored with the run), uses test accounts, never tries to
pass a CAPTCHA, and closes the browser sessions and tunnels it opens.

## Develop

`claude plugin validate .` and `claude plugin validate plugins/webagent`; try it without installing:
`claude --plugin-dir plugins/webagent`. See [CLAUDE.md](CLAUDE.md).
