---
description: Test your web app in a real cloud browser with webagent, read the report, fix bugs and re-run the failed cases.
argument-hint: [what to test, a URL, "all", or "rerun failed"]
allowed-tools: mcp__plugin_webagent_webagent__smoke_test mcp__plugin_webagent_webagent__run_task mcp__plugin_webagent_webagent__get_report mcp__plugin_webagent_webagent__get_task mcp__plugin_webagent_webagent__create_session mcp__plugin_webagent_webagent__stop_session mcp__plugin_webagent_webagent__qa_run mcp__plugin_webagent_webagent__qa_status Read Grep Glob Bash(git status *) Bash(git diff *)
---

Run a QA pass with webagent.

First load the skill `webagent:qa-test` and follow it step by step. If you cannot load it, read
`${CLAUDE_PLUGIN_ROOT}/skills/qa-test/SKILL.md` and `${CLAUDE_PLUGIN_ROOT}/skills/qa-test/reference.md` and follow those.

What to test: $ARGUMENTS

If that is empty, test what the current diff changed plus the smoke cases in `.webagent/tests.yaml`. If it is `all`, run every
case. If it is `rerun failed`, re-run only the cases that failed earlier in this conversation. If it is a URL, use it as the
target. Keep the rules of the skill: no secrets in tool calls, `error` is never an app bug, close sessions and tunnels,
and end with the short summary.
