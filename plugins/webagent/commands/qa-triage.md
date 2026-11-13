---
description: Triage a QA run that had failures. Sorts each failed case into app bug, test needs update or couldn't test, proposes the fix or a bug report, and never calls anything fixed without a new run.
argument-hint: [run id (wfr_...), or empty for the last run]
allowed-tools: mcp__plugin_webagent_webagent__qa_status mcp__plugin_webagent_webagent__qa_report mcp__plugin_webagent_webagent__get_report mcp__plugin_webagent_webagent__qa_list_runs mcp__plugin_webagent_webagent__qa_file_bug Read Grep Glob Bash(git status *) Bash(git diff *) Bash(git log *)
---

Triage the failures of a webagent QA run. This command reads results and proposes; it does not re-run anything and it
does not edit a file until the user says yes.

Run: $ARGUMENTS

## 1. Get the run
In this order, first hit wins:
1. A run id in the arguments (`wfr_...`).
2. The last run id from this conversation (a `qa_run` or `qa_status` answer above).
3. `qa_list_runs`, only if it is in your tool list: take the newest run that has a failed or couldn't-test case.
4. Otherwise ask one short question: "Which run? Paste the run id (wfr_...) or the Watch live link."

Tools may carry the QA names or the general ones: use whichever is in your tool list (`qa_report` = `get_report`).
If no webagent tool is in your tool list, or a call says 401, tell the user once (`/plugin configure webagent@webagent`) and stop.

## 2. Read each failed case once
Call `qa_status { id: <wfr_...>, caseId }` once per `fail` or `error` case (the case ids are in the run answer).
Passed cases need no call. Read the page URL, the failed step, `error`, expected vs actual, the first 1-2 console errors and failed
requests, and the screenshot link. A field the report does not have: write `not recorded`, never guess. Console lists empty with a note that
the log is not available yet: call `qa_status` again after a few seconds before saying there were none.

## 3. Classify
| Class | When | Do |
|---|---|---|
| **App bug** | `fail`: on a real page of the app, expected and saw differ and the intent of the case still holds | Section 4 |
| **Test needs update** | `fail`: the locator, label or text changed but the intent holds (the app changed on purpose) | Section 5 |
| **Couldn't test** | `error`: site down or 5xx on every page, `navigation_blocked`, capacity or timeout, CAPTCHA or bot check, a tunnel or ngrok warning page, a sign-in or test account missing | Section 6. Not an app failure |

When it is unclear whether the app or the test is wrong, read the code the case touches (and `git log` / `git diff` for the page) before you decide.
Say your reason in one line per case.

## 4. App bug
Say what is wrong, with `file:line` if the repo is open (else "not checked: no repo").
- `qa_file_bug` is in your tool list: offer to file it, show the title and steps first, file only on the user's yes.
- Not in your tool list: write a markdown bug report in the chat, ready to paste into any tracker:
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
Show a `tests.yaml` diff (only fields of the format in `${CLAUDE_PLUGIN_ROOT}/skills/qa-test/reference.md`; plain language, quoted literal values,
no secrets, no new fields):
```diff
-  expect: shows "Welcome back"
+  expect: shows "Welcome, Sam"
```
Ask: "Apply this to .webagent/tests.yaml?" **Never apply it without the user's yes.** If the diff is large or you are not sure the
intent holds, treat the case as an app bug and say why.

## 6. Couldn't test
Say what blocked it and what unblocks it: open a tunnel or use a public URL, add the header for an ngrok free tunnel, wait and
retry for capacity, add a test account in the dashboard (vault), test the CAPTCHA step by hand. Never try to pass a CAPTCHA or
bot check. Never ask for a password in chat: test accounts are added in the dashboard, and you name them by namespace.

## 7. Finish
One block per class, a line per case (case id, one-line reason), then the next step for the user. Rules:
- Never say a bug is fixed or a test passes without a new `qa_run` result that shows it (`/webagent:qa rerun failed`).
- A remote target does not see a code fix until it is deployed: say so.
- Say only what the tool results show.
