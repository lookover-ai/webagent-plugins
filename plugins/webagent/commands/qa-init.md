---
description: Create .webagent/product.md and .webagent/tests.yaml for this repo by reading your code, and offer a GitHub Actions workflow. Asks before writing.
argument-hint: [optional: the area to start with, e.g. "signup and checkout"]
allowed-tools: Read Grep Glob
---

Set up the `.webagent/` folder for this repository so `/webagent:qa` knows what the app is and which flows matter.
Format: `${CLAUDE_PLUGIN_ROOT}/skills/qa-test/reference.md` (section `.webagent/ format`). Start from the templates in
`${CLAUDE_PLUGIN_ROOT}/templates/.webagent/product.md` and `tests.yaml`. Focus (optional): $ARGUMENTS

Steps:
1. If `.webagent/` already exists, read it and offer to extend it. Never overwrite a file without showing the change.
2. Read the code, not everything: the package manifest, the dev script and port, the router (Next `app/` or `pages/`,
   React Router, Express/Fastify routes, Rails/Django/Laravel routes), forms and their field names, the auth flow (sign in,
   sign up, sessions, roles) and visible texts you can use as expectations. Note what you cannot tell.
3. Ask the user, in ONE message, only what the code cannot tell: the staging/preview URL(s); whether a webagent vault login
   exists for the test account and its namespace (the dashboard Vault groups logins by namespace); the 3 to 5 flows that
   must never break. Passwords are never asked for and never written down.
4. Show the draft of both files (the full `tests.yaml`, a short `product.md`) and ask for approval. Write them only after a yes.
5. Write steps that replay: one action per step, controls named by their visible label, every typed value a quoted literal
   (`type "qa+{{uid}}@example.com" into Email`; `{{uid}}` is new each run), `expect` as `shows "X"` / `address contains Y` / `does not show "Z"`.
   Keep it small: 5 to 8 cases, plain-language steps, `expect` as what the user sees, one `smoke` tagged per critical flow
   (`priority: 1`; scale is 1 most important to 5, default 3), `local` target = the dev server URL (the agent opens a tunnel when
   it tests it). Give every case an `id`. Use only the fields in the templates: the format is shared with the dashboard and CI.
   A YAML value that contains `: ` (colon and space) is quoted as a whole, or the file does not parse:
   `expect: 'shows "Total: $19.00"'`, never `expect: shows "Total: $19.00"`. Add a `key:` slug (for example `key: checkout-flow`): CI uses it to name the workflow.
6. After writing, tell the user: commit `.webagent/` with the code (it holds no secrets), and run `/webagent:qa` next.
7. **Offer CI, ask, never write silently.** Ask once: "Run these tests on every pull request with a GitHub Actions workflow?"
   Only on a yes: if `.github/workflows/webagent-qa.yml` exists, show it and offer a change, never overwrite. Otherwise copy
   `${CLAUDE_PLUGIN_ROOT}/templates/github/webagent-qa.yml` to `.github/workflows/webagent-qa.yml`, changing only the `url:` line to the
   public https staging or preview URL the user gave (never localhost, never a guessed host; if there is none, keep the placeholder and say it must be replaced).
   Show the file before writing. Do not add inputs or change the `uses:` line. Then tell the user:
   - Create an API key in the webagent dashboard, **API keys**, Create key (the **member** role is enough), and add it as the repository secret
     `WEBAGENT_API_KEY` (GitHub: Settings, Secrets and variables, Actions, New repository secret). Never paste the key into a file or this chat.
     CI uses a key; it is not the plugin's sign-in.
   - Commit the workflow with `.webagent/`; the first pull request then gets the check and one PR comment.
   - Other CI, or the CLI flags and exit codes: `/webagent:qa-ci`.
   On a no, say `/webagent:qa-ci` prints the call later.
