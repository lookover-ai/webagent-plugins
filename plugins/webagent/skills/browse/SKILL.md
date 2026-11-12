---
name: browse
description: Do a web task in a real cloud browser through webagent's MCP tools: research or extract data from a site, fill in a form, check a page, monitor a value, take a screenshot, scrape or crawl pages, or run a multi-step task on a website. Use when the user wants something done on or read from the web, not when they want their own web app tested (that is the qa-test skill).
argument-hint: [the web task]
---

# Browse with webagent

webagent gives you a real cloud browser (isolated, recorded, watchable live). You decide **what** to do; the tools do the
browsing. The tools are the MCP server `webagent` (Claude Code lists them as `mcp__plugin_webagent_webagent__<tool>`; below
they are bare names). Args and result fields: [reference.md](reference.md).

**Testing the user's own web app (signup works? checkout broken? smoke test)? Stop: use the `qa-test` skill.**

Hard rules, always:
- Never paste a secret (API key, password, token, `.env` value) into a tool call, a goal or your answer. Goal text is stored
  with the run. Sign-ins use the webagent vault (`credentials`, by namespace) or a throwaway account the user named here.
- Never try to get past a CAPTCHA or bot check. If one appears the task stops `captcha`: tell the user, they can take over
  in the dashboard and solve it by hand.
- Read only what the user asked for. Do not submit forms that spend money, send messages or delete data unless the user said
  so in this conversation. Say what you did, from the tool results only.
- Close what you open: `stop_session` for every session you left open.

## 0. Connected?
If the `webagent` tools are not in your tool list, or a call says 401 / unauthorized: tell the user once, then stop. They set
the key with `/plugin configure webagent@webagent`, restart, check `/mcp`. Do not guess a key or ask for one in chat.

## 1. Pick the tool (cheapest that fits)
| The user wants | Use |
|---|---|
| The content, a screenshot or a PDF of one known page; read-only | `scrape` (markdown by default), `screenshot`, `pdf` |
| Many pages of one site | `crawl` (set `maxPages`, `include`; follow `cursor` only if you need more) |
| A goal in plain words ("find the price of X", "fill this form", "check if the banner says Y") | `run_task { goal, startUrl }` |
| Several dependent steps, or headers, a proxy, a vault login, or a task you will follow up on | `create_session { startUrl, ... }`, then `run_task { sessionId, goal }` per step, then `stop_session` |
| A repeatable check with a pass/fail answer on a page they own | `smoke_test` (or the `qa-test` skill) |
| One of the packaged skills (price check, page audit, ...) | `list_skills` once, then the typed `skill_<name>` tool (or `run_skill`) |
`scrape`, `screenshot`, `pdf`, `crawl` are single calls with no engine and no session to close. Prefer them over `run_task`
whenever you do not need to click or type: faster, cheaper, no model in the loop.
A URL on `localhost` or a private address cannot be opened by the cloud browser (SSRF guard, no override). For the user's local
app use the `qa-test` skill's tunnel recipe or ask for a public URL.

## 2. Pick an engine (only for `run_task` and `create_session`)
An engine is the agent that drives the browser (`qa`, `general`, `research`, `forms`, `monitor`, `careful`, or a team fork).
Order, first hit wins:
1. The user named one in this conversation.
2. `.webagent/config.yaml` `engine:` in the repo (read it if the file exists; format in the plugin repo `docs/WEBAGENT-FOLDER.md`).
3. The task clearly fits a non-default engine (find or extract information `research`; fill forms or portals from given data `forms`;
   check a page for changes `monitor`; account, billing or admin work `careful`) **and** `list_engines` is in your
   tool list: call it once, pick by `slug`/`description`, pass that `slug` as `engineId`.
4. Otherwise omit `engineId`: the project default engine runs. Most tasks end here; do not call `list_engines` for them.
`engineId` accepts the slug or the full id. A `not_found` / `invalid_input` on it: retry once without `engineId` and say so.
Never invent an id. The `qa` engine is for testing; do not use it for general tasks.

## 3. Write the goal
One outcome, plain words, what to return: `Open <url>, find the monthly price of the Pro plan, answer with the number and the
page it was on.` Add a stop condition (`if there is no Pro plan, answer NOT FOUND`). Put the start page in `startUrl`, not in
prose. Do not put credentials in it. Keep `maxSteps` low (10 to 20) for a simple goal.

## 4. Wait without burning tokens
- A call waits up to 90 s. If it returns `running` (`{sessionId, taskId}`), call `get_report { id: taskId, waitSeconds: 90 }`
  and let the server wait. At most 3 such calls, then tell the user it is still running and give the session link.
- Several independent pages: send the calls in one message (at most 3 at once; the free plan allows 3 browsers).
- Use the `answer`, `stoppedBy` and `summary`. Do not print or re-read whole pages or reports. Ask `scrape` for `markdown`
  (or `readability`), not `html`. Download a screenshot only when the text is not enough.

## 5. The user can watch and take over
Every session is live in the dashboard (Sessions, then the session id: `/sessions/<sessionId>`): they can watch, pause,
type, and take over the browser. After you start a task that takes more than a few seconds, give them the `sessionId` once.
- A task that ends `paused`: a person paused or took over. Say so, do not restart it; ask whether to continue.
- `blocked` or `captcha`: the agent hit something it must not do alone (a bot check, a payment, a hard block). Report it, say
  what the user can do by hand in the live view, and stop. Do not retry in `full_auto` unless the user asks for it.
- `stuck`, `budget`, `unanswered`: the goal was too vague or too big. Narrow it once (one step less), else report.
- `capacity_exceeded`, `capacity_timeout`: all browsers are busy; wait 30 s, retry once.

## 6. Finish
Answer in a few lines: what you found or did, the key values, the page URL(s), the session id or report link, and anything
you could not do and why. Quote the task `answer`; do not add facts it does not contain. Then `stop_session` for each session
you opened with `create_session` or `keepOpen`. `run_task` without a `sessionId` closes its own session.
