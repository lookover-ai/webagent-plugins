# Lookover QA · GitHub Action

Run your `.webagent/tests.yaml` in a cloud browser on every pull request. The job passes or fails on the result, one comment on the
PR shows what broke (updated on every push, never a new one), and the job summary has the full report. Same file as the
dashboard and the `/webagent:qa` plugin command: [format](../docs/WEBAGENT-FOLDER.md).

> Beta. The Action is bundled JavaScript (no npm install, runs on the `node24` runtime). It carries the `webagent` CLI
> ([`@lookover-ai/webagent-cli`](../../webagent-contracts/cli/README.md) is the same engine; run it yourself on other CI systems).
> It is not published yet: `@v1` works once `lookover-ai/webagent-plugins` is public and tagged `v1` (the dashboard's "Add to CI" card prints the same `uses:` line).

## 1. Set up (two minutes)

1. Dashboard, **API keys**, create a key (the **member** role is enough). Save it as the repository secret `WEBAGENT_API_KEY`
   (Settings, Secrets and variables, Actions). The key is never in a file.
2. Commit `.webagent/tests.yaml` (run `/webagent:qa-init` in Claude Code to write it from your code, or copy the template).
   Put a `key:` in it (for example `key: checkout-flow`): it names the workflow in the dashboard and the PR comment.
3. Add the workflow below.

## 2. Copy-paste: every PR, plus a sync on `main`

```yaml
# .github/workflows/lookover-qa.yml
name: Lookover QA
on:
  pull_request:
  push:
    branches: [main]

concurrency:                       # a new push cancels the old run (the action cancels the cloud run too)
  group: lookover-qa-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read
  pull-requests: write             # for the PR comment (without it the check still works, just no comment)

jobs:
  qa:
    name: Lookover QA              # the status check you can mark "required" later
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: lookover-ai/webagent-plugins/github-action@v1
        with:
          api-key: ${{ secrets.WEBAGENT_API_KEY }}
          url: https://staging.example.com          # the site to test (see "Preview URLs" for per-PR previews)
```

`sync` is on by itself for a push to the default branch: the file is saved as the workflow (by `key`), so the dashboard, its history
and its schedule use the `main` definition. **A pull request run never changes the saved workflow**: it runs the PR's file ad hoc, groups
under the same workflow in the dashboard, and leaves the saved one alone (so an edited file in a PR cannot redefine what `main` and the
nightly run test). Set `sync: true` or `sync: false` to override.

A workflow synced from the repo is marked "Managed by owner/repo" in the dashboard: edit `.webagent/tests.yaml` in the repo, or
duplicate the workflow to edit it in the dashboard.

### Which engine runs the tests

`engine:` in `tests.yaml` (any engine's short name or id, your own engines included) wins; without it the saved workflow's engine runs;
without that, your project's default engine. Nothing is forced to a built-in. A name that matches no engine in your project stops the job
before any run starts: exit **3**, `NOT RUN · setup problem`, and the plain sentence `Engine '<name>' not found in this project` in the
job summary and the PR comment. Fix the name in `tests.yaml` (the dashboard's Engines page lists the names and ids).

## 3. Preview URLs

The `url` input wins over the target in `tests.yaml`. The action waits up to 120 s for the URL to answer (2xx or 3xx) before it
starts (`wait-for-url`), so a preview that is still building does not become a failed test. The URL must be public https: the cloud browser
never opens localhost or a private address.

**Vercel (or any host that sends a `deployment_status` event):**

```yaml
name: Lookover QA
on: deployment_status

permissions:
  contents: read
  pull-requests: write

jobs:
  qa:
    name: Lookover QA
    if: github.event.deployment_status.state == 'success'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: lookover-ai/webagent-plugins/github-action@v1
        with:
          api-key: ${{ secrets.WEBAGENT_API_KEY }}
          url: ${{ github.event.deployment_status.environment_url || github.event.deployment_status.target_url }}
```

The comment goes to the PR that owns the deployed commit. If your preview is behind Vercel's login page (Deployment Protection), the
cloud browser sees the login page, not your app: use a staging URL, or turn protection off for previews you test.

**Netlify:** deploy previews have a fixed address, so `pull_request` is enough:

```yaml
on: pull_request
# ...
      - uses: lookover-ai/webagent-plugins/github-action@v1
        with:
          api-key: ${{ secrets.WEBAGENT_API_KEY }}
          url: https://deploy-preview-${{ github.event.number }}--YOUR-SITE.netlify.app
          wait-for-url: 180   # the most the action waits; a build that takes longer: start this job after the deploy
```

**A static staging URL** (deployed from `main`): `url: https://staging.example.com`, as in the first example.

**Deploy gate:** order the jobs, no special integration: `deploy-preview`, then `qa` (this action), then `promote` with
`needs: [qa]`. A red check stops `promote`.

## 4. Inputs and outputs

| Input | Default | What it does |
|---|---|---|
| `api-key` | (required) | Your API key, from a secret |
| `api-url` | the CLI's built-in host | API origin without a path |
| `url` | | Site to test. Wins over the file's target |
| `file` | `.webagent/tests.yaml` | The tests file. If this default is missing and `workflow` is set, the saved workflow of that key runs (needs `url`) |
| `workflow` | `key` in the file | Workflow key; also names the PR comment |
| `target` | `defaultTarget` of the file | A target name from the file |
| `tags` / `case-ids` | all cases | Comma-separated; run a subset |
| `sync` | on for a push to the default branch, else off | Save the file as the workflow before running |
| `wait-for-url` | `120` | Seconds (1 to 180) to wait for the URL to answer. `0` or `false`: do not wait |
| `timeout-minutes` | `15` | Give up and cancel the run |
| `retries` | the API default (1 for CI) | Extra tries for a failed case, 0 to 2. A case that passes on a retry is "flaky": it passes the job and is flagged |
| `on-error` | `block` | `block`: could not test fails the job (exit 2). `neutral`: it passes with a warning |
| `fail-on` | `fail` | `never`: report only, a result never fails the job (run it a week as a non-required check, then require it) |
| `comment` | `true` | Keep one PR comment |
| `share-links` | on for private repos, off for public | A 7-day replay link per failed case in the comment. Anyone with the link can watch, so it is off by default on public repos |
| `github-token` | `${{ github.token }}` | For the PR comment |

| Output | Value |
|---|---|
| `verdict` | `pass`, `fail`, `error` (could not test), `setup` (not run: setup problem), `skipped` (fork PR without the secret) |
| `run-id` | the run id (empty when no run started) |
| `run-url` | dashboard page of the run |
| `flaky` | how many cases passed only on a retry |

Use outputs in a later step: `if: steps.qa.outputs.verdict == 'fail'` (give the step `id: qa`).

## 5. What the job does (every state)

| State | Job | PR comment |
|---|---|---|
| Running | in progress | `Lookover QA · RUNNING · testing <url>`, replaced when the run ends |
| Pass (flaky passes included) | exit 0 | `PASS`, counts, case table; flaky cases marked `PASS (flaky: passed on try 2 of 2)` |
| A required case failed | exit **1** | `FAIL`, the failed step, expected vs actual, page, console error, failed request, replay link |
| Could not test (preview never answered, capacity, timeout; **not** an app failure) | exit **2** (`on-error: neutral`: 0 with a warning) | `COULD NOT TEST`, in plain words why |
| Setup problem (no key, key rejected or revoked, bad file, bad input, `engine:` not found) | exit **3** | `NOT RUN · setup problem`: what to fix, for example "API key rejected: make a new one in API keys" or "Engine 'my-qa' not found in this project" |
| Fork PR, or Dependabot (GitHub gives no secrets) | exit 0, one notice | none |
| No `pull-requests: write` | unchanged | one notice in the log; the job summary still has the report |
| Job cancelled (new push) | the cloud run is cancelled | updated to could not test (best effort) |

| Exit code | Meaning |
|---|---|
| 0 | pass (also: could not test with `on-error: neutral`, any result with `fail-on: never`, fork PR skip) |
| 1 | a required case failed: your app |
| 2 | could not test: not an app failure |
| 3 | setup problem: your configuration (`fail-on: never` does not hide these) |

Failed cases show the replay link only when `share-links` allows it; the dashboard link works for every member of your project.
The status check is the job: name it `Lookover QA`. GitHub only blocks merging on checks you mark **required** (Settings, Branches).

## 6. Fork pull requests

GitHub does not give secrets to a workflow started by a fork (or Dependabot), so there is no API key. The action prints one notice,
leaves the comment alone and exits 0 (neutral): nothing was tested, nothing failed. It runs when a maintainer pushes the branch to
the repo. Do not switch to `pull_request_target` to get the secret: that runs untrusted code with your key.

## 7. Develop

```
cd github-action
pnpm install
VITEST_MAX_WORKERS=4 pnpm check     # typecheck, tests, build (dist/index.cjs + vendored dist/webagent.cjs)
```

`dist/` is committed (a JavaScript action runs what is in the repo). `dist/webagent.cjs` is the CLI bundle from
`webagent-contracts/cli/dist/webagent.cjs` (`pnpm build` there first; `WEBAGENT_CLI_BUNDLE` points elsewhere): re-vendor it when the
CLI changes. The CLI is the engine (flags, exit codes, `report.md` come from it and the API); `src/` only maps inputs to flags,
writes the summary, outputs and the sticky comment (hidden marker `<!-- lookover-qa:<workflow key> -->`).
