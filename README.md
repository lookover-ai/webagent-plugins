# webagent plugins

Put Lookover in your coding agent: test your app in a real cloud browser, or let your agent drive one. Claude Code (or Codex) talks to
two [Lookover](https://webagent.lookover.ai) MCP servers, and you can watch the browser live and take over from the dashboard.

- **Lookover QA** (`lookover-qa`, the headline use case). `/webagent:qa test the signup I just built`: the agent finds or proposes tests,
  runs them in the cloud browser (it shows the cost estimate first), reads the report, fixes the bug it finds and re-runs only the failed
  tests. Skill `qa-test`.
- **Lookover Browser** (`lookover-browser`, bring your own model). `/webagent:run walk through checkout and save it as a test`: your
  agent's own model drives the browser step by step on your App, checks what it saw with `assert`, and saves the flow as a proposed
  test. Skill `browse`.

Your agent knows your code, so it decides **what** to test. Lookover decides **how** (cloud browser) and keeps the proof: a result, the
failed step, console errors, failed network calls, a screenshot and a replay. Tests your agent writes are proposals: you approve them in
the dashboard.

## Claude Code

1. Install the plugin:
   ```
   /plugin marketplace add lookover-ai/webagent-plugins
   /plugin install webagent@webagent
   ```
   Claude Code asks for two settings: leave **API key** empty (it is optional) and keep the default **API URL**.
2. Sign in, once per server: `/mcp`, select `plugin:webagent:lookover-qa`, **Authenticate**. Your browser opens: "Sign in with Lookover",
   pick the project, Allow. Do the same for `plugin:webagent:lookover-browser` if you want to drive the browser yourself. No key to copy.
3. First prompt:
   ```
   /webagent:qa test the signup I just built
   /webagent:run walk through checkout and save it as a test
   ```
   For tests, no `.webagent/` folder yet? Run `/webagent:qa-init` once: it reads your code and proposes `product.md` and
   `tests.yaml` (it asks before writing).

| Command | What it does |
|---|---|
| `/webagent:qa <what to test>` | Test your web app with Lookover QA, fix, re-run the failures |
| `/webagent:qa-triage [run id]` | Sort the failures of a run into app bug / test needs update / couldn't test; propose a test change or a bug report. Changes nothing without your yes |
| `/webagent:qa-init` | Create `.webagent/product.md` and `tests.yaml` from your code; offers the GitHub Actions workflow (asks first) |
| `/webagent:qa-ci` | Print the CI call (GitHub Actions snippet, plain CLI call, exit codes). Writes nothing |
| `/webagent:run <task>` | Drive a browser on your App with your own model (Lookover Browser): explore it, walk a flow, save it as a test |

**Sign-in, renewal, revoke.** The sign-in gives Claude Code access to **one project** with the **member** role, per server. Claude Code
renews the access (1 hour) by itself; the renewal lasts 30 days and is extended each time you use it. Sign in again (same steps) after
30 days unused, or after you disconnect it in the dashboard (**Workspace, Connected apps**, row menu, **Disconnect**). To switch projects,
disconnect, then Authenticate again and pick the other project. `share_report` and `connect_local_app` need a signed-in person: an API key has none.

| Setting | Needed | Meaning |
|---|---|---|
| API key | no | Only for CI or a machine without a browser: a key (`wa_<region>_...`, dashboard API keys, member role). Leave empty to sign in. Never commit it. Change it with `/plugin configure webagent@webagent`. |
| API URL | no | API origin without `/mcp`. Default is the staging host below. |

**Four servers in `/mcp`.** The plugin declares `lookover-qa` and `lookover-browser` (sign in) and `lookover-qa-key` and
`lookover-browser-key` (API key). Use one of each pair: with no key, the `-key` servers show as failed, ignore them; with a key, they
connect and the sign-in servers wait for a sign-in you can skip. Never Authenticate a `-key` server. The plugin reads only these two
settings; a `WEBAGENT_API_KEY` shell variable is **not** used by the plugin (Claude Code cannot fall back to an environment variable inside
the plugin's server entry). Codex and CI use the variable, see below.

**Beta.** Production hosts are not live yet. The default API is the staging host
`https://webagent-staging-in-api.lookover.ai` (sign in or create keys with your staging dashboard account, `https://webagent-staging.lookover.ai`).
Set another API URL in `/plugin configure webagent@webagent` when your team gives you one.

## Codex

1. Add the servers to `~/.codex/config.toml` (copy [`codex/config.toml`](codex/config.toml); it sets a 120 s tool timeout), then run
   `codex mcp login lookover-qa` (and `codex mcp login lookover-browser`) once: a browser opens, sign in with Lookover, pick the project,
   Allow. No key. For CI or a machine without a browser, use the API key blocks in that file (`?auth=key`,
   `export WEBAGENT_API_KEY=...`) instead.
2. Paste [`codex/AGENTS.md`](codex/AGENTS.md) into your project's `AGENTS.md` (or `~/.codex/AGENTS.md`).
3. Ask: `Smoke test the signup I just built.` Check with `codex mcp get lookover-qa`.

## Cursor

Cursor takes a remote MCP server with a `url` and `headers`, and fills `${env:NAME}` from your shell, so the key stays out of the file.
Add this to `.cursor/mcp.json` (one project) or `~/.cursor/mcp.json` (all projects), `export WEBAGENT_API_KEY=wa_<region>_...` in the shell that
starts Cursor, restart Cursor, and check Settings, MCP:

```json
{
  "mcpServers": {
    "lookover-qa": {
      "url": "https://webagent-staging-in-api.lookover.ai/mcp/qa",
      "headers": { "Authorization": "Bearer ${env:WEBAGENT_API_KEY}" }
    },
    "lookover-browser": {
      "url": "https://webagent-staging-in-api.lookover.ai/mcp/browser",
      "headers": { "Authorization": "Bearer ${env:WEBAGENT_API_KEY}" }
    }
  }
}
```
Use a **member** or full API key. A key limited to CI is refused on both servers. Keep only `lookover-qa` if you do not want to drive the
browser yourself. Paste the QA workflow of [`codex/AGENTS.md`](codex/AGENTS.md) into your Cursor rules if you want the same behaviour as the
Claude Code plugin.

**Claude and ChatGPT apps** (no coding agent): add the connector URL `<API URL>/mcp/qa` as a custom connector and sign in; no key is
needed (`<API URL>/mcp/browser` is the second server). Steps are in the webagent docs ("Connect Claude", "Connect ChatGPT"). The default API URL is the beta staging host above.

## What testing does

1. Picks the App and the address: the URL you give, a target in `.webagent/tests.yaml`, or the App's saved URL.
2. Reads `.webagent/` and your diff, chooses up to 10 saved tests (your changed areas plus the smoke ones); a test that does not exist yet is
   proposed with `create_tests` and waits for your approval in the dashboard.
3. Asks for a dry run first: how many runs and the cost estimate. You say yes, then `run_tests` runs them in the cloud browser and gives you
   a dashboard link.
4. Reads the compact report. Results: Passed, Failed (the app is wrong), Couldn't test (CAPTCHA, blocked address, capacity, timeout; never
   reported as an app bug).
5. Fixes the code for each Failed, re-runs only those tests, at most 2 rounds. A remote target is re-run only after you deploy.
6. Ends with a short summary: what passed, what failed and why, evidence links.

## Testing localhost

Lookover's cloud browser can never open `localhost` or a private address (by design). For a local dev server the agent first connects
your own machine (`connect_local_app`: your machine connects out to Lookover, the app is never exposed to the internet; it asks you first),
then tests `http://localhost:<port>` through it. Without a signed-in person, or when it cannot connect, it opens a tunnel itself
(`cloudflared tunnel --url http://localhost:<port>`, no account), tests the public tunnel URL and closes the tunnel afterwards.
**A tunnel exposes your dev server to the internet while it runs. Use test data.** Nothing is installed for you.

## The `.webagent/` folder

`product.md` (what the app is, roles, flows, environments, test logins by name, never passwords), `tests.yaml` (plain-language cases) and an
optional `config.yaml`. Format: [docs/WEBAGENT-FOLDER.md](docs/WEBAGENT-FOLDER.md). Templates:
[`plugins/webagent/templates/.webagent/`](plugins/webagent/templates/.webagent/). The `tests.yaml` format is shared with webagent's dashboard import and CI call, so the same file is proposed from here with `create_tests`, runs from CI or imports into the dashboard.

## CI: the GitHub Action

Run the same `.webagent/tests.yaml` on every pull request: [`github-action/`](github-action/README.md) (`lookover-ai/webagent-plugins/github-action@v1`)
gates the job, keeps one comment on the PR (updated on every push) and writes the report to the job summary. Copy-paste workflow,
preview-URL examples (Vercel, Netlify, a staging URL) and the exit codes are in its README. `/webagent:qa-init` offers to write the
workflow (`.github/workflows/webagent-qa.yml`, from [`templates/github/`](plugins/webagent/templates/github/webagent-qa.yml)); `/webagent:qa-ci` prints
the call for your CI. CI uses an API key kept as the repository secret `WEBAGENT_API_KEY` (a key, not the plugin's sign-in).

## Safety

The agent never pastes secrets into tool calls (step text is stored with the run), uses test accounts saved with `add_login`, never tries to
pass a CAPTCHA, and closes the browser sessions and tunnels it opens.

## License

MIT, see [LICENSE](LICENSE).

## Develop

`claude plugin validate .` and `claude plugin validate plugins/webagent`; try it without installing:
`claude --plugin-dir plugins/webagent`. See [CLAUDE.md](CLAUDE.md).
