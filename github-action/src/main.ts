/** Entry point of the Action (bundled to `dist/index.cjs`): wires the real file system, `fetch` and the vendored CLI. */

import { spawn } from "node:child_process";
import { appendFile, mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type CliResult, run } from "./run.js";

async function readText(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return undefined;
  }
}

/** Run `webagent.cjs` (vendored next to this file) with the job's Node. Its stderr is the job log; stdout is the run JSON. */
function runCli(args: string[], env: Record<string, string | undefined>): Promise<CliResult> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [join(__dirname, "webagent.cjs"), ...args], {
      env: env as NodeJS.ProcessEnv,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (b: Buffer) => {
      stdout += b.toString("utf8");
    });
    child.stderr.on("data", (b: Buffer) => {
      stderr += b.toString("utf8");
      process.stdout.write(b);
    });
    // Job cancelled: let the CLI cancel the run (it does on SIGINT/SIGTERM), then finish the comment as usual.
    const forward = (sig: NodeJS.Signals) => () => child.kill(sig);
    const onInt = forward("SIGINT");
    const onTerm = forward("SIGTERM");
    process.on("SIGINT", onInt);
    process.on("SIGTERM", onTerm);
    child.on("error", (e) => {
      stderr += `Setup problem: could not start the bundled CLI: ${e.message}\n`;
      resolve({ code: 3, stdout, stderr });
    });
    child.on("close", (code) => {
      process.off("SIGINT", onInt);
      process.off("SIGTERM", onTerm);
      resolve({ code, stdout, stderr });
    });
  });
}

async function main(): Promise<number> {
  const env = process.env;
  const eventText = env.GITHUB_EVENT_PATH ? await readText(env.GITHUB_EVENT_PATH) : undefined;
  let event = {};
  try {
    event = eventText ? JSON.parse(eventText) : {};
  } catch {
    /* no usable event */
  }
  const append = (file: string | undefined) => async (text: string) => {
    if (file) await appendFile(file, text, "utf8");
  };
  const summary = append(env.GITHUB_STEP_SUMMARY);
  const output = append(env.GITHUB_OUTPUT);
  return run({
    env,
    fetch: (...a) => globalThis.fetch(...a),
    event,
    readText,
    runCli,
    appendSummary: summary,
    setOutput: (name, value) => output(`${name}=${value.replace(/[\r\n]+/g, " ")}\n`),
    log: (l) => console.log(l),
    tmpDir: await mkdtemp(join(env.RUNNER_TEMP || tmpdir(), "lookover-qa-")),
  });
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (err) => {
    console.log(`::error title=Lookover QA::${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 3;
  },
);
