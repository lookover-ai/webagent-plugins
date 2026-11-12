---
description: Create .webagent/product.md and .webagent/tests.yaml for this repo by reading your code. Asks before writing.
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
5. Keep it small: 5 to 8 cases, plain-language steps, `expect` as what the user sees, one `smoke` tagged per critical flow
   (`priority: 1`; scale is 1 most important to 5, default 3), `local` target = the dev server URL (the agent opens a tunnel when
   it tests it). Give every case an `id`. Use only the fields in the templates: the format is shared with the dashboard and CI.
6. After writing, tell the user: commit `.webagent/` with the code (it holds no secrets), and run `/webagent:qa` next.
