---
description: Do a web task in a real cloud browser with webagent (research, extract, fill a form, check a page, monitor a value, screenshot, crawl).
argument-hint: <the web task, e.g. "find the price of the Pro plan on example.com/pricing">
allowed-tools: mcp__plugin_webagent_webagent__run_task mcp__plugin_webagent_webagent__create_session mcp__plugin_webagent_webagent__stop_session mcp__plugin_webagent_webagent__get_report mcp__plugin_webagent_webagent__get_task mcp__plugin_webagent_webagent__get_session mcp__plugin_webagent_webagent__scrape mcp__plugin_webagent_webagent__screenshot mcp__plugin_webagent_webagent__pdf mcp__plugin_webagent_webagent__crawl mcp__plugin_webagent_webagent__list_skills mcp__plugin_webagent_webagent__run_skill mcp__plugin_webagent_webagent__get_skill_run mcp__plugin_webagent_webagent__list_engines Read Glob
---

Do a web task with webagent.

First load the skill `webagent:browse` and follow it. If you cannot load it, read
`${CLAUDE_PLUGIN_ROOT}/skills/browse/SKILL.md` and `${CLAUDE_PLUGIN_ROOT}/skills/browse/reference.md` and follow those.

The task: $ARGUMENTS

If that is empty, ask the user for the task in one short question and stop. If the task is about testing the user's own web app,
use `/webagent:qa` instead (skill `webagent:qa-test`) and say so.

Pick the cheapest tool that fits (`scrape`, `screenshot` or `crawl` for read-only pages; `run_task` for a goal; a session for
several dependent steps). Engine: read `.webagent/config.yaml` if it exists and pass its `engine`; otherwise omit `engineId`
unless the task clearly fits another engine and `list_engines` exists. Give the user the session id so they can watch or take
over in the dashboard. No secrets in tool calls, never try to pass a CAPTCHA, close sessions you opened, end with a short answer.
