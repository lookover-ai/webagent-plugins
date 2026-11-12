# The `.webagent/` folder

A folder at the root of your repo that tells the QA agent what your app is and which flows matter. The agent in Claude Code
or Codex reads it before it tests, and appends cases when you build something new. Commit it with your code.

> **Status: v1, a draft.** Today only the agent reads it. When the webagent API's Workflows module imports it
> (run the same cases from CI or a schedule), this format becomes a shared contract and gets a JSON Schema. Until then keep
> it minimal: unknown keys are ignored, nothing here is validated by a server.

```
.webagent/
  product.md     what the app is: users, key flows, environments, test accounts (by name)
  tests.yaml     the cases
```
Templates: `plugins/webagent/templates/.webagent/`. Create them from your code with `/webagent:qa-init`.

## Never put secrets in it
No passwords, API keys, tokens or session cookies. Test logins live in the webagent vault (dashboard, Vault) and are referred
to by **namespace**. The agent also writes step text into tool calls and webagent stores it with the run.

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
engine: qa                  # optional: engine used for cases that run as a goal. Default qa.
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
