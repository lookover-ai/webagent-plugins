---
description: Drive a cloud browser on your App with your own model (Lookover Browser): explore it, walk a flow, and save it as a test.
argument-hint: <what to explore or which flow, e.g. "walk through checkout and save it as a test">
allowed-tools: mcp__plugin_webagent_lookover-browser__list_apps mcp__plugin_webagent_lookover-browser-key__list_apps mcp__plugin_webagent_lookover-browser__start_session mcp__plugin_webagent_lookover-browser-key__start_session mcp__plugin_webagent_lookover-browser__observe mcp__plugin_webagent_lookover-browser-key__observe mcp__plugin_webagent_lookover-browser__click mcp__plugin_webagent_lookover-browser-key__click mcp__plugin_webagent_lookover-browser__type mcp__plugin_webagent_lookover-browser-key__type mcp__plugin_webagent_lookover-browser__select mcp__plugin_webagent_lookover-browser-key__select mcp__plugin_webagent_lookover-browser__press mcp__plugin_webagent_lookover-browser-key__press mcp__plugin_webagent_lookover-browser__navigate mcp__plugin_webagent_lookover-browser-key__navigate mcp__plugin_webagent_lookover-browser__scroll mcp__plugin_webagent_lookover-browser-key__scroll mcp__plugin_webagent_lookover-browser__assert mcp__plugin_webagent_lookover-browser-key__assert mcp__plugin_webagent_lookover-browser__sign_in mcp__plugin_webagent_lookover-browser-key__sign_in mcp__plugin_webagent_lookover-browser__handoff mcp__plugin_webagent_lookover-browser-key__handoff mcp__plugin_webagent_lookover-browser__save_as_test mcp__plugin_webagent_lookover-browser-key__save_as_test mcp__plugin_webagent_lookover-browser__end_session mcp__plugin_webagent_lookover-browser-key__end_session Read Glob
---

Drive Lookover Browser.

First load the skill `webagent:browse` and follow it. If you cannot load it, read
`${CLAUDE_PLUGIN_ROOT}/skills/browse/SKILL.md` and `${CLAUDE_PLUGIN_ROOT}/skills/browse/reference.md` and follow those.

The task: $ARGUMENTS

If that is empty, ask the user for the task in one short question and stop. If the task is to run saved tests or check the app
pass/fail, use `/webagent:qa` instead (skill `webagent:qa-test`) and say so.

Order: `list_apps` (ask which App when there are several), `start_session` (show the start card word for word and wait for a yes), then
`observe` and act by ref. Give the user the live link once so they can watch or take over. To save a flow as a test, `assert` what the page
must show first, then `save_as_test` (it is a proposal; Unverified until Lookover's replay passes), then `end_session`. No secrets in tool
calls, never try to pass a CAPTCHA (`handoff`), close the session you opened, end with a short answer.
