# The `.webagent/` folder

A folder at the root of your repo that tells webagent's agent skills how to work here: which engine to use (`config.yaml`), and,
for QA, what your app is and which flows matter (`product.md`, `tests.yaml`). The agent in Claude Code or Codex reads it before it
acts, and appends cases when you build something new. Commit it with your code.

> **Status: v1, a draft.** Today only the agent reads it. When the webagent API's Workflows module imports it
> (run the same cases from CI or a schedule), this format becomes a shared contract and gets a JSON Schema. Until then keep
> it minimal: unknown keys are ignored, nothing here is validated by a server.

```
.webagent/
  config.yaml    settings for any webagent task: which engine (optional file)
  product.md     QA: what the app is: users, key flows, environments, test accounts (by name)
  tests.yaml     QA: the cases
```
Templates: `plugins/webagent/templates/.webagent/`. Create `product.md` and `tests.yaml` from your code with `/webagent:qa-init`,
and `config.yaml` with `/webagent:engines`.

## Never put secrets in it
No passwords, API keys, tokens or session cookies. Test logins live in the webagent vault (dashboard, Vault) and are referred
to by **namespace**. The agent also writes step text into tool calls and webagent stores it with the run.

## `config.yaml`
```yaml
version: 1        # required, integer
engine: research  # optional: engine slug (qa, general, research, forms, monitor, careful, or a team fork) or a full engine id
apiUrl: https://...  # optional, informational: the API origin your team uses (no /mcp)
```
| Field | Rule |
|---|---|
| `engine` | The engine that drives the cloud browser for tasks started from this repo. Omitted: the project's default engine runs. **Choice order:** the call's `engineId` (a user's explicit choice) > `tests.yaml` `engine` (QA only) > `config.yaml` `engine` > the project default. QA with none set uses `qa`. |
| `apiUrl` | A note for teammates. The plugin does not read it: the URL is each person's plugin setting (`/plugin configure webagent@webagent`). |

**The API key never goes in this file** (nor anywhere in the repo). It lives in your coding agent's settings (Claude Code
keychain via plugin settings; Codex `WEBAGENT_API_KEY`). The agent reads `config.yaml` and passes `engine` as the `engineId`
of `run_task` / `create_session`; the server does not read your repo. Set it with `/webagent:engines`.

## `product.md`
Free Markdown, under one page. Suggested sections: what it is, users and roles, key flows, environments (name, URL, notes),
test accounts (vault namespace and role), test data and gotchas, what cannot be tested (email codes, real payments, CAPTCHA).

## `tests.yaml`
```yaml
version: 1                  # required, integer
targets:                    # required: one entry per environment
  <name>:
    url: <base url>         # required. A local URL is reached through a tunnel the agent opens.
    credentials: <namespace> # optional: webagent vault namespace holding this site's test login
engine: qa                  # optional: engine used for cases that run as a goal. Default: config.yaml `engine`, else qa.
cases:                      # required
  - id: <kebab-case>        # required, unique
    title: <sentence>       # required
    steps: [<plain language>, ...]   # required (may be empty: the case then only loads the page)
    expect: <plain language>  # required: what the user sees when it works
    tags: [smoke, auth]     # optional
    priority: 1             # optional, 1 (highest) to 3. 1 runs on every change. Default 2.
    path: /signup           # optional, start path under the target url. Default /
    signedIn: false         # optional: needs the target's vault login
```

| Field | Rule |
|---|---|
| `id` | Lower-case letters, digits and `-`. Stable: reports and fixes refer to it. |
| `steps` | What a user does, one action per item: `click "Sign up"`, `type a unique email into Email`. No selectors, no secrets. |
| `expect` | What a user sees: a text, an address, a missing error. The agent turns it into webagent's `expectText`, `expectUrl` or `expectNoText`, or into the goal of a task. |
| `tags` | `smoke` = the few cases that must pass on every change. Other tags are yours (`auth`, `checkout`, `validation`). |
| `signedIn` | The case runs as a signed-in task using the target's `credentials` namespace. |

How a case becomes a webagent call is in `plugins/webagent/skills/qa-test/reference.md`.

## Why plain language
webagent's engine decides how to click and type. A case that says `click "Create account"` keeps working when the markup
changes. A case with a CSS selector breaks. The trade-off: a very visual or timing-sensitive check is better as a goal with a
clear PASS/FAIL answer than as an assertion.
