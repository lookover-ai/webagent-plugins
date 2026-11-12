# webagent plugins

Give your coding agent a cloud browser: run web tasks, test your app. Claude Code (or Codex) drives a real, isolated, recorded
cloud browser through [webagent](https://webagent.lookover.ai)'s MCP, and you can watch it live and take over from the dashboard.

- **Run web tasks.** `/webagent:run find the monthly price of the Pro plan on example.com/pricing`: research and extract, fill a
  form, check a page, monitor a value, screenshot, scrape or crawl, multi-step tasks on a site. Skill `browse`.
- **Test your app (the headline use case).** `/webagent:qa test the signup I just built`: the agent runs the flow in the cloud
  browser, reads the report, fixes the bug it finds and re-runs only the failed cases. Skill `qa-test`.

Your agent knows your code, so it decides **what** to do or test. webagent decides **how** (cloud browser, engine) and keeps
the proof: for tests a verdict, the failed step, console errors, failed network calls, a screenshot and a replay.

## Claude Code

1. Create a webagent API key (dashboard, Keys, Create key; the **member** role is enough).
2. Install the plugin:
   ```
   /plugin marketplace add lookover-ai/webagent-plugins
   /plugin install webagent@webagent
   ```
3. Claude Code asks for two values when the plugin is enabled: your **API key** (masked, kept in your system keychain, never in a
   file) and the **API URL** (keep the default). Change them later with `/plugin configure webagent@webagent`.
4. Check `/mcp`: the server `webagent` is connected.
5. First prompt:
   ```
   /webagent:run find the price of the Pro plan on example.com/pricing
   /webagent:qa test the signup I just built
   ```
   For tests, no `.webagent/` folder yet? Run `/webagent:qa-init` once: it reads your code and proposes `product.md` and
   `tests.yaml` (it asks before writing).

| Command | What it does |
|---|---|
| `/webagent:run <task>` | Any web task in a cloud browser |
| `/webagent:engines` | List the engines, pick one, optionally save it to `.webagent/config.yaml` |
| `/webagent:qa <what to test>` | Test your web app, fix, re-run the failures |
| `/webagent:qa-init` | Create `.webagent/product.md` and `tests.yaml` from your code |

**Engines.** An engine is the agent that drives the browser (`general`, `research`, `forms`, `monitor`, `careful`, `qa`, or a
fork of your team). Order: the engine the call names, then `engine:` in `.webagent/config.yaml`, then your project's default.

| Setting | Needed | Meaning |
|---|---|---|
| API key | yes | Your key (`wa_<region>_...`). Never commit it. |
| API URL | no | API origin without `/mcp`. Default is the staging host below. |

The Claude Code plugin reads these two settings only; a `WEBAGENT_API_KEY` shell variable is **not** used by the plugin (Claude
Code cannot fall back to an environment variable inside the plugin's server entry). Codex and CI use the variable, see below.

**Coming: "Sign in with Lookover".** Browser sign-in (OAuth), no key to copy, is planned. API keys stay for CI and for Codex.

**Beta.** Production hosts are not live yet. The default API is the staging host
`https://webagent-staging-in-api.lookover.ai` (key from the staging dashboard, `https://webagent-staging.lookover.ai`).
Set another API URL in `/plugin configure webagent@webagent` when your team gives you one.

## Codex

1. Add the server to `~/.codex/config.toml` (copy [`codex/config.toml`](codex/config.toml); it sets a 120 s tool timeout because
   a test waits up to 90 s) and `export WEBAGENT_API_KEY=...`.
2. Paste [`codex/AGENTS.md`](codex/AGENTS.md) into your project's `AGENTS.md` (or `~/.codex/AGENTS.md`).
3. Ask: `Smoke test the signup I just built.` Check with `codex mcp get webagent`.

## What testing does

1. Picks the target: the URL you give, or a target in `.webagent/tests.yaml`.
2. Reads `.webagent/` and your diff, chooses up to 5 cases (your changed areas plus the smoke cases).
3. Runs them in the cloud browser in one `qa_run` call (your `tests.yaml`, filtered to those cases, with the target you picked; the server
   queues them and keeps the evidence). It gives you a "Watch live" link, and passes on warnings (for example `signedIn` cases it skipped).
   `run_task` is only for exploring a flow you cannot write as steps or a signed-in case; it is never the pass/fail gate.
4. Reads the compact report. Verdicts: `pass`, `fail` (the app is wrong), `error` (the test could not run: CAPTCHA, blocked
   address, capacity, timeout; never reported as an app bug).
5. Fixes the code for each `fail`, re-runs only those cases, at most 2 rounds. A remote target is re-run only after you deploy.
6. Ends with a short summary: what passed, what failed and why, evidence links.

## Testing localhost

webagent's cloud browser can never open `localhost` or a private address (by design). For a local dev server the agent opens a
tunnel itself (`cloudflared tunnel --url http://localhost:<port>`, no account, the default; or `ngrok http <port>` with the
`ngrok-skip-browser-warning` header it adds for you), tests the public tunnel URL and closes the tunnel afterwards. **The tunnel exposes your dev server to the internet while it runs. Use test data.**
Nothing is installed for you: install `cloudflared` or `ngrok` once.

## The `.webagent/` folder

`config.yaml` (optional: which engine, no key ever), `product.md` (what the app is, roles, flows, environments, test accounts by
vault namespace, never passwords) and `tests.yaml` (plain-language cases). Format: [docs/WEBAGENT-FOLDER.md](docs/WEBAGENT-FOLDER.md). Templates:
[`plugins/webagent/templates/.webagent/`](plugins/webagent/templates/.webagent/). The `tests.yaml` format is shared with webagent's dashboard import and CI call, so the same file runs from here, from CI or from the dashboard.

## Safety

The agent never pastes secrets into tool calls (step and goal text is stored with the run), uses test accounts, never tries to
pass a CAPTCHA, and closes the browser sessions and tunnels it opens.

## License

MIT, see [LICENSE](LICENSE).

## Develop

`claude plugin validate .` and `claude plugin validate plugins/webagent`; try it without installing:
`claude --plugin-dir plugins/webagent`. See [CLAUDE.md](CLAUDE.md).
