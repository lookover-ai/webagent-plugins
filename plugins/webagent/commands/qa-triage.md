---
description: Triage a QA run that had failures. Sorts each failed test into app bug, test needs update or couldn't test, proposes the fix or a bug report, and never calls anything fixed without a new run.
argument-hint: [run id (wfr_...), or empty for the last run]
allowed-tools: mcp__plugin_webagent_lookover-qa__get_run mcp__plugin_webagent_lookover-qa-key__get_run mcp__plugin_webagent_lookover-qa__get_report mcp__plugin_webagent_lookover-qa-key__get_report mcp__plugin_webagent_lookover-qa__list_runs mcp__plugin_webagent_lookover-qa-key__list_runs mcp__plugin_webagent_lookover-qa__file_bug mcp__plugin_webagent_lookover-qa-key__file_bug mcp__plugin_webagent_lookover-qa__get_test mcp__plugin_webagent_lookover-qa-key__get_test mcp__plugin_webagent_lookover-qa__update_test mcp__plugin_webagent_lookover-qa-key__update_test mcp__plugin_webagent_lookover-qa__share_report mcp__plugin_webagent_lookover-qa-key__share_report Read Grep Glob Bash(git status *) Bash(git diff *) Bash(git log *)
---

Triage the failures of a webagent QA run. This command reads results and proposes; it does not re-run anything and it
does not edit a file until the user says yes.

Run: $ARGUMENTS

## 1. Get the run
In this order, first hit wins:
1. A run id in the arguments (`wfr_...`).
2. The last run id from this conversation (a `run_tests` or `get_run` answer above).
3. `list_runs`: take the newest run that has a failed or couldn't-test test.
4. Otherwise ask one short question: "Which run? Paste the run id (wfr_...) or the dashboard link."

If no `lookover-qa` tool is in your tool list, or a call says 401, tell the user once (sign in with `/mcp`, `plugin:webagent:lookover-qa`, Authenticate, or `/plugin configure webagent@webagent` for an API key) and stop.

## 2. Read each failed case once
Call `get_report { runId }` once (it lists every failed and couldn't-test test of the run); for one test's latest result use `get_report { testRef }`.
Passed cases need no call. Read the page URL, the failed step, `error`, expected vs actual, the first 1-2 console errors and failed
requests, and the screenshot link. A field the report does not have: write `not recorded`, never guess. Console lists empty with a note that
the log is not available yet: call `get_report` again after a few seconds before saying there were none.

## 3. Classify
| Class | When | Do |
|---|---|---|
| **App bug** | `fail`: on a real page of the app, expected and saw differ and the intent of the case still holds | Section 4 |
| **Test needs update** | `fail`: the locator, label or text changed but the intent holds (the app changed on purpose) | Section 5 |
| **Couldn't test** | `error`: site down or 5xx on every page, `navigation_blocked`, capacity or timeout, CAPTCHA or bot check, a tunnel warning page, a sign-in or test account missing | Section 6. Not an app failure |

When it is unclear whether the app or the test is wrong, read the code the case touches (and `git log` / `git diff` for the page) before you decide.
Say your reason in one line per case.

## 4. App bug
Say what is wrong, with `file:line` if the repo is open (else "not checked: no repo").
- Offer `file_bug { runId, caseId }`: it files the bug in the project's connected tracker (Linear or Jira) or, with none, returns markdown to paste (`tracker: "markdown"` forces that). Show the title and steps first, file only on the user's yes.
- The user wants it in another tracker: write a markdown bug report in the chat, ready to paste:
  ```
  ### <title: what is wrong, where>
  **Steps:** 1. ... 2. ...
  **Expected:** ...
  **Saw:** ... (console error / failed request if any)
  **Page:** <page URL>
  **Evidence:** <screenshot or report link> (links expire; say so) · Run: <wfr_...>
  **Environment:** <target name and URL>, browser: webagent cloud browser, date
  ```
Offer to fix it in the code. After a fix, a new run is the only proof (section 7).

## 5. Test needs update
Show the change as a diff of the test (steps and `expect` in plain language, quoted literal values, no secrets, and in `.webagent/tests.yaml` only fields of
the format in `${CLAUDE_PLUGIN_ROOT}/skills/qa-test/reference.md`):
```diff
-  expect: shows "Welcome back"
+  expect: shows "Welcome, Sam"
```
Ask: "Propose this change to the test (and apply it to .webagent/tests.yaml)?" **Never do either without the user's yes.** On a yes, `update_test { testRef, steps?, expect? }` proposes the change (a person approves it in the dashboard) and you edit `.webagent/tests.yaml`. If the diff is large or you are not sure the
intent holds, treat the case as an app bug and say why.

## 6. Couldn't test
Say what blocked it and what unblocks it: connect the machine (`connect_local_app`) or use a public URL or a cloudflared tunnel, wait and
retry for capacity, add a test login (`add_login`), test the CAPTCHA step by hand. Never try to pass a CAPTCHA or
bot check. Never ask for a password in chat: logins are added with `add_login` or in the dashboard (Password manager).

## 7. Finish
One block per class, a line per case (case id, one-line reason), then the next step for the user. Rules:
- Never say a bug is fixed or a test passes without a new `run_tests` result that shows it (`/webagent:qa rerun failed`).
- A remote target does not see a code fix until it is deployed: say so.
- Say only what the tool results show.
