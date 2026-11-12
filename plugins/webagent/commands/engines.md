---
description: List the webagent engines you can use, pick one, and optionally save it as this repo's default in .webagent/config.yaml.
argument-hint: [optional: an engine slug to set right away, e.g. research]
allowed-tools: mcp__plugin_webagent_webagent__list_engines Read Glob Write Edit
---

Show the webagent engines and let the user choose one. An engine is the agent that drives the cloud browser; the choice order is
the call's `engineId`, then `engine:` in `.webagent/config.yaml`, then the project's default engine.

Steps:
1. Call `list_engines` (the MCP server `webagent`). If the tool is not in your tool list, say: "This webagent server does not list
   engines yet. The built-in slugs are qa, general, research, forms, monitor, careful (the project default runs when none is set)."
   Then go to step 3 using those slugs.
2. Show a short table from the result: slug, name, one-line description, version, and mark the project default.
3. Read `.webagent/config.yaml` if it exists and say which engine it sets now (or that none is set, so the project default runs).
   If `$ARGUMENTS` names a slug that is in the list, treat it as the user's choice; otherwise ask which one they want, or none.
4. Offer to save it: "Save `engine: <slug>` to `.webagent/config.yaml`? Every webagent call in this repo then uses it unless a
   call or `tests.yaml` names another." **Ask first; write only after a yes.** Start from
   `${CLAUDE_PLUGIN_ROOT}/templates/.webagent/config.yaml`; keep any other keys that file already has; never write a key or secret.
5. After writing, say: commit `.webagent/config.yaml` with the code, and that `/webagent:run <task>` uses it.
   For testing use `/webagent:qa` (it keeps the `qa` engine unless `tests.yaml` names one).
