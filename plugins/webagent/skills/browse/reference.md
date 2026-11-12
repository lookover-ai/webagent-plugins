# webagent browse reference

Checked against the webagent api (MCP tools in `src/modules/mcp`) and contracts 0.33.x on 2026-11-12. If a call is refused with
`invalid_input`, trust the error text over this file. (Api A94, commit 80a67b0, 2026-11-12.)

## Tools for general tasks
| Tool | Args (real names) | Returns |
|---|---|---|
| `scrape` | `url`, `format` (list of `markdown` default, `html`, `cleaned_html`, `readability`), `waitUntil` (`load` default, `domcontentloaded`, `networkidle`), `waitForText`, `timeoutMs`, `screenshot`, `pdf`, `inventory`, `allowHosts`, `proxyUrl`, `device`, `viewport` | the page content |
| `screenshot` | `url`, `fullPage` (default true), `format` (`png` `jpeg` `webp`), `quality`, `waitForText`, `waitUntil` | an image |
| `pdf` | `url`, `paper` (`A4` `Letter` `Legal`), `landscape`, `printBackground` | a PDF |
| `crawl` | `url`, `scope` (`host` default, `subdomains`, or host list), `include[]`, `exclude[]`, `maxPages` (1-100, default 25), `maxDepth` (0-5, default 2), `respectRobots` (default true), `sitemap`, `content` (formats), `cursor` to continue | the pages found, and a `cursor` if it stopped early |
| `run_task` | `goal` (required), `maxSteps` (1-50), `startUrl`, `engineId`, `engineVersion`, `record`, `headers`, `proxyUrl`, `allowHosts`, `credentials` (`true` or `{namespace, autoSubmit}`), `mode` (`auto` default, `full_auto`), `keepOpen`, `sessionId`, `waitSeconds` (1-90, default 90) | `Task finished|stopped (<stoppedBy>)` text; `structuredContent {sessionId, sessionClosed, task}`; still running: `{sessionId, taskId, status: running}` |
| `create_session` | `startUrl`, `engineId`, `record`, `headers`, `credentials`, `proxyUrl`, `allowHosts`, ... | session record + token |
| `stop_session` | `sessionId` | session record (safe to repeat) |
| `get_report` | `id` (`tsk_...` or `run_...`), `waitSeconds` (0-90, default 30) | verdict + summary; for a task `pass` only means the agent says it is done |
| `get_task` | `sessionId`, `taskId?`, `waitSeconds` | raw task record |
| `list_sessions`, `get_session` | `sessionId` | what is open now |
| `list_skills`, `run_skill`, `get_skill_run`, `skill_<name>` | `list_skills` shows each skill's inputs; `run_skill {name, inputs, engineId?}` | a skill run (`run_...`) |
| `list_engines` | none | `[{id, slug?, name, description, version, isProjectDefault}]` (`slug` for built-ins only) |

`sessionId`, `startUrl`, `engineId`, `record`, `headers`, `proxyUrl`, `allowHosts`, `credentials` on `run_task` apply only
when it opens the session. With `sessionId` they are refused: put them on `create_session`.
Every tool that starts a session or run (`create_session`, `run_task`, `run_skill`, `smoke_test`, `qa_run`) also returns `dashboardUrl` in `structuredContent` and a `Watch live: <url>` line in its text (so do `get_report` and `qa_status`): tell the user once per task.
Quick tools (`scrape`, `screenshot`, `pdf`, `crawl`) take no `engineId`, no vault `credentials`, and cannot click or type.

## Engines
Built-ins (slug): `qa` (testing, see `qa-test`), `general` (any web task, the usual project default), `research` (find, read, compare, pull data out; changes nothing),
`forms` (fill forms and portals from the data you give), `monitor` (check a page and report changes), `careful` (account, billing
and admin work, one write step at a time).
Teams can fork them; forks appear in `list_engines` by name and `id` (only built-ins carry a `slug`; use a fork's `id`). `isProjectDefault: true` is what runs when you omit
`engineId`. Slug or full id both work as `engineId`. Choice order: the call's `engineId`, then `.webagent/config.yaml`
`engine:`, then the project default.

## `stoppedBy` of a task
`done` (the agent says it finished; check `ok`) · `stuck`, `budget`, `unanswered` (could not finish: goal too vague or too big) ·
`captcha`, `blocked`, `navigation_blocked`, `error`, `aborted`, `paused`, `capacity_exceeded`, `capacity_timeout`, `timeout`
(could not run, or a person stopped it).

## Headers, proxy, vault logins
`headers`: `[{ "hosts": ["staging.example.com"], "headers": { "X-Preview-Token": "..." } }]`, sent only to those hosts, values
are write-only. Do not put a real secret value in a call you write from memory: ask the user to supply it or use the vault.
`credentials: { namespace: "work", autoSubmit: true }` fills a saved login for the exact origin of the page the browser is on;
you never see the password. They are saved in the dashboard Vault.
`proxyUrl` routes the browser through the user's proxy (only when they gave you one). `allowHosts` widens what the browser
may open; it never lifts the private-address block.

## Errors that are not your fault
| You see | Do |
|---|---|
| `navigation_blocked` | The address is private or blocked. Use a public URL. |
| `capacity_exceeded`, `capacity_timeout` | Wait 30 s, retry once, else tell the user |
| `rate_limited` / 429 | Slow down |
| 401 `invalid API key`, 421 `wrong_region` | Tell the user: new key from the right dashboard |
| `captcha` | Do not try to pass it. The user can solve it in the live view |
| `not_found` / `invalid_input` on `engineId` | Retry once without `engineId`, say so |

## `.webagent/config.yaml`
```yaml
version: 1
engine: research     # optional: slug or id; omitted = project default
```
Never put a key in it. Full format: `docs/WEBAGENT-FOLDER.md` in the plugin repo; template in
`${CLAUDE_PLUGIN_ROOT}/templates/.webagent/config.yaml`.
