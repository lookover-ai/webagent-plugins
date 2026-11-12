---
description: Print the CI call that runs your .webagent/tests.yaml on every pull request (GitHub Actions snippet, plain CLI call, exit codes). Writes nothing.
argument-hint: [optional: the CI system, e.g. "github", "gitlab", "circleci"]
allowed-tools: Read Grep Glob
---

Show the user how to run `.webagent/tests.yaml` in CI. Print only; **write no file** (`/webagent:qa-init` offers the GitHub workflow file).
CI system (optional): $ARGUMENTS

Steps:
1. Look at the repo: `.github/workflows/` (GitHub Actions), `.gitlab-ci.yml`, `.circleci/`, `Jenkinsfile`, and whether `.webagent/tests.yaml`
   exists (if not, say `/webagent:qa-init` writes it) and has a `key:` line (a slug that names the workflow in the dashboard and the PR comment; suggest one).
   Find the preview or staging URL if the repo says where it is (deploy config, a workflow that deploys). Do not guess a host: use the placeholder.
2. Print the call for their setup. GitHub (or nothing detected): the snippet below, with their URL when known. Other CI: the CLI call.
3. Print the key setup and the exit codes (below). Say that a CI run uses an API key (a key, not the plugin's sign-in).

## GitHub Actions
Save as `.github/workflows/webagent-qa.yml` (the template is `${CLAUDE_PLUGIN_ROOT}/templates/github/webagent-qa.yml`):

```yaml
name: Lookover QA
on:
  pull_request:
  push:
    branches: [main]
permissions:
  contents: read
  pull-requests: write             # for the PR comment
jobs:
  qa:
    name: Lookover QA
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: lookover-ai/webagent-plugins/github-action@v1
        with:
          api-key: ${{ secrets.WEBAGENT_API_KEY }}
          url: https://staging.example.com      # the public https site to test
```
Inputs you may add under `with:` (exact names): `url`, `file`, `workflow`, `target`, `tags`, `case-ids`, `sync`, `wait-for-url`
(seconds, 1 to 180), `timeout-minutes`, `retries` (0 to 2), `on-error` (`block` or `neutral`), `fail-on` (`fail` or `never`), `comment`,
`share-links`. Outputs: `verdict`, `run-id`, `run-url`, `flaky`. Per-PR preview URLs (Vercel, Netlify) are in `github-action/README.md` of
the webagent-plugins repo. A pull request run never changes the saved workflow; a push to the default branch saves it (by `key`).

## Any other CI (the `webagent` CLI)
The CLI is `@lookover-ai/webagent-cli` (needs Node 22 or newer; it is not on npm yet, so ask the user to get the built `webagent.cjs` from the
webagent team, or use GitHub Actions, which bundles it). It reads the key from the environment:

```sh
export WEBAGENT_API_KEY=...        # a CI secret, never in a file. WEBAGENT_API_URL is optional (default: the webagent API)
webagent test --url "$PREVIEW_URL" --wait-for-url --junit out/junit.xml --markdown out/report.md
```
Flags (exact): `--file <path>` (default `.webagent/tests.yaml`), `--url <url>`, `--target <name>`, `--tags a,b`, `--case-ids a,b`, `--workflow <key>`,
`--sync` (default-branch pushes only: saves the workflow, then runs it; without it the run is ad hoc and saves nothing), `--retries 0..2`,
`--timeout-minutes <n>` (default 15), `--wait-for-url`, `--wait-for-url-timeout <s>` (default 120, max 180), `--on-error block|neutral`,
`--junit <path>`, `--markdown <path>`, `--json` (run as JSON on stdout). The URL must be public https: the cloud browser never opens localhost.

## The API key
Create it in the webagent dashboard, **API keys**, Create key (the **member** role is enough). Add it as the repository secret
`WEBAGENT_API_KEY` (GitHub: Settings, Secrets and variables, Actions, New repository secret; on other CI: its secret or masked variable store).
Never paste the key into a file or a chat. Keys stay for CI; the plugin's own sign-in is separate.

## Exit codes (the job passes or fails on these)
| Code | Meaning |
|---|---|
| 0 | pass (flaky passes and failed optional cases included; also "could not test" with `--on-error neutral`) |
| 1 | a required case failed: your app |
| 2 | could not test (platform error, timeout, preview never answered): not an app failure |
| 3 | setup problem (bad file or flags, missing or rejected key, API unreachable): fix the configuration |

Close with one line: the first run is best on a non-required check (`fail-on: never` in the Action) for a week, then mark `Lookover QA` required.
