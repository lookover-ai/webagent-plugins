# The `.webagent/` folder

A folder at the root of your repo that tells webagent's agent skills how to work here: which engine to use (`config.yaml`), and,
for QA, what your app is and which flows matter (`product.md`, `tests.yaml`). The agent in Claude Code or Codex reads it before it
acts, and appends cases when you build something new. Commit it with your code.

> **Status: v1, a shared format.** The `tests.yaml` format is defined once, in the webagent contracts, and read by the dashboard
> ("Paste tests.yaml"), the CI call, and this plugin. **The contract is the reference**: if this page and the contract differ, the
> contract wins. Unknown keys are ignored, so older readers keep working when the format grows.

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
A file that is only a list of cases is accepted too. Slugs (`key`, target names, case ids, tags) are lower-case letters, digits, `-`
and `_`, 1 to 64 characters, starting with a letter or digit.
```yaml
version: 1                  # optional, only 1 exists
name: Acme smoke            # optional: workflow name (default "Tests")
description: ...            # optional
key: acme-smoke             # optional slug: CI updates the same workflow by it
engine: qa                  # optional: engine slug or id for cases that run as a goal. Default: config.yaml `engine`, else qa.
targets:                    # the sites to test, by name (1 to 10)
  local: http://localhost:3000      # a url, or an object:
  staging:
    url: https://staging.example.com
    credentials: staging    # optional: vault namespace holding this site's test login (the plugin uses it, workflow runs do not)
    session: { ... }        # optional: session options merged over each case's session
defaultTarget: staging      # optional: one of the targets. Default: the first
# url: https://app.example.com   # shorthand for one target named `default`. Use `url` or `targets`, never both (an error)
concurrency: 3              # optional: cases at once, 1 to 10
maxCostUsdPerCase: 0.5      # optional: stop a case when its model spend passes this
cases:                      # required, 1 to 100
  - id: signup-happy        # optional slug, unique. Missing: made from the title
    title: A new user can sign up    # required
    path: /signup           # optional: start path under the target url. Default /
    steps: [click "Create account"]  # optional list of plain steps (max 30). Default none
    expect: the page shows "Welcome" # optional: the outcome in words
    checks: { text: Welcome, url: /dashboard, noText: error }   # optional: same, as exact fields. Wins over `expect`
    tags: [smoke, auth]     # optional
    priority: 1             # optional: 1 (most important) to 5. Default 3
    signedIn: false         # optional: needs the target's vault login (plugin only)
```

| Field | Rule |
|---|---|
| `targets` / `url` | Where the app runs. A local url is reached through a tunnel the agent opens. No sites at all: the reader asks you for one. |
| `id` | Stable: reports and fixes refer to it. Missing: made from the title (lower-case, other characters become `-`, cut to 64; `case-<position>` if nothing is left; `-2`, `-3` if taken). Ids you wrote are kept and never renamed. Write them for cases you keep. |
| `steps` | What a user does, one action per item: `click "Sign up"`, `type a unique email into Email`. No selectors, no secrets. Empty: the case only loads the page. |
| `expect` | What a user sees, in words. The server understands `shows "X"`, `address contains Y` and `does not show "Z"`; anything else is reported as "not checked". |
| `checks` | The exact form of `expect`: `text` (the page shows it), `url` (the address contains it), `noText` (the page must not show it). When set, `checks` wins over `expect`. |
| `tags` | `smoke` = the few cases that must pass on every change. Other tags are yours (`auth`, `checkout`, `validation`). |
| `priority` | 1 (most important) to 5, default 3. 1 runs on every change. |
| `signedIn` | The plugin runs the case as a signed-in goal with the target's `credentials` namespace. **A workflow run (dashboard, CI) skips it and says so in a warning**: it cannot sign in. |
| `concurrency`, `maxCostUsdPerCase` | Limits for workflow runs. The server runs 3 cases at once by default. |

The `session` option of a target (headers, proxy) is applied by the server: the plugin sends the file to `qa_run` as it is, so it works for plugin runs too.

How a case becomes a webagent call is in `plugins/webagent/skills/qa-test/reference.md`.

## Why plain language
webagent's engine decides how to click and type. A case that says `click "Create account"` keeps working when the markup
changes. A case with a CSS selector breaks. The trade-off: a very visual or timing-sensitive check is better as a goal with a
clear PASS/FAIL answer than as an assertion.
