---
description: Test your web app in a real cloud browser with Lookover QA, read the report, fix bugs and re-run the failed tests.
argument-hint: [what to test, a URL, "all", or "rerun failed"]
allowed-tools: mcp__plugin_webagent_lookover-qa__list_apps mcp__plugin_webagent_lookover-qa-key__list_apps mcp__plugin_webagent_lookover-qa__create_app mcp__plugin_webagent_lookover-qa-key__create_app mcp__plugin_webagent_lookover-qa__add_url mcp__plugin_webagent_lookover-qa-key__add_url mcp__plugin_webagent_lookover-qa__add_login mcp__plugin_webagent_lookover-qa-key__add_login mcp__plugin_webagent_lookover-qa__connect_local_app mcp__plugin_webagent_lookover-qa-key__connect_local_app mcp__plugin_webagent_lookover-qa__list_tests mcp__plugin_webagent_lookover-qa-key__list_tests mcp__plugin_webagent_lookover-qa__get_test mcp__plugin_webagent_lookover-qa-key__get_test mcp__plugin_webagent_lookover-qa__create_tests mcp__plugin_webagent_lookover-qa-key__create_tests mcp__plugin_webagent_lookover-qa__update_test mcp__plugin_webagent_lookover-qa-key__update_test mcp__plugin_webagent_lookover-qa__list_folders mcp__plugin_webagent_lookover-qa-key__list_folders mcp__plugin_webagent_lookover-qa__list_proposed_tests mcp__plugin_webagent_lookover-qa-key__list_proposed_tests mcp__plugin_webagent_lookover-qa__quick_check mcp__plugin_webagent_lookover-qa-key__quick_check mcp__plugin_webagent_lookover-qa__run_tests mcp__plugin_webagent_lookover-qa-key__run_tests mcp__plugin_webagent_lookover-qa__get_run mcp__plugin_webagent_lookover-qa-key__get_run mcp__plugin_webagent_lookover-qa__cancel_run mcp__plugin_webagent_lookover-qa-key__cancel_run mcp__plugin_webagent_lookover-qa__list_runs mcp__plugin_webagent_lookover-qa-key__list_runs mcp__plugin_webagent_lookover-qa__get_report mcp__plugin_webagent_lookover-qa-key__get_report mcp__plugin_webagent_lookover-qa__share_report mcp__plugin_webagent_lookover-qa-key__share_report mcp__plugin_webagent_lookover-qa__file_bug mcp__plugin_webagent_lookover-qa-key__file_bug mcp__plugin_webagent_lookover-qa__get_knowledge mcp__plugin_webagent_lookover-qa-key__get_knowledge mcp__plugin_webagent_lookover-qa__add_knowledge mcp__plugin_webagent_lookover-qa-key__add_knowledge Read Grep Glob Bash(git status *) Bash(git diff *)
---

Run a QA pass with Lookover QA.

First load the skill `webagent:qa-test` and follow it step by step. If you cannot load it, read
`${CLAUDE_PLUGIN_ROOT}/skills/qa-test/SKILL.md` and `${CLAUDE_PLUGIN_ROOT}/skills/qa-test/reference.md` and follow those.

What to test: $ARGUMENTS

Default path: `list_apps`, read `.webagent/tests.yaml` and the diff, pick the saved tests with `list_tests` (propose missing ones with
`create_tests`, dry run first; a person approves them in the dashboard), then `run_tests` with `dryRun: true`, show the number of runs and the
cost estimate and start only after the user agrees. Follow with `get_run` and `get_report`. Local app: `connect_local_app` (section 7A of the
skill), else a tunnel (7B). Give the user the dashboard link once. No tests at all: `quick_check`. Failures to sort out or file as a bug:
`/webagent:qa-triage`.

If the argument is empty, test what the current diff changed plus the smoke tests (at most 10). If it is `all`, run every test of the
Folder. If it is `rerun failed`, run `run_tests` with `rerunOf` the last run and `failedOnly: true`. If it is a URL, use it as the
address. Keep the rules of the skill: no secrets in tool calls, Couldn't test is never an app bug, close tunnels and connections, and
end with the short summary.
