/** What the CLI's exit code means for the job: the `verdict` output and the job's own exit code. */

/** `pass`, `fail`, `error` (could not test) come from the run; `setup` and `skipped` mean no run happened. */
export type VerdictOutput = "pass" | "fail" | "error" | "setup" | "skipped";

export interface Outcome {
  verdict: VerdictOutput;
  /** The job's exit code: 0, 1 (a required case failed), 2 (could not test), 3 (setup problem). */
  exitCode: 0 | 1 | 2 | 3;
  /** A sentence for the log, or `undefined` for a clean pass. */
  message?: string;
  level: "notice" | "warning" | "error";
}

/**
 * CLI exit code (0 pass, 1 fail, 2 could not test, 3 setup; anything else is a crash = 3) to the job outcome.
 *
 * The exit code is the ONLY signal: the run reply is never read for a verdict, because a reply may carry a verdict
 * this Action does not know. CLI 0.3.0 turns an unknown verdict (run or case) into "could not test" = exit 2, so
 * 0 means the CLI saw a pass. `on-error: neutral` is applied here, not by the CLI (the Action always starts the CLI
 * with `--on-error block`): a CLI exit 0 can then never hide a could-not-test.
 * `mode: practice` only softens exit 1 (a failed required case); a could-not-test is never reported as a pass.
 */
export function outcomeFor(
  cliCode: number | null,
  failOn: "fail" | "never",
  onError: "block" | "neutral",
  mode: "enforce" | "practice" = "enforce",
): Outcome {
  if (cliCode === 0) return { verdict: "pass", exitCode: 0, level: "notice" };
  if (cliCode === 1) {
    if (mode === "practice") {
      return {
        verdict: "fail",
        exitCode: 0,
        level: "warning",
        message: "A required case failed. The job passes because mode is practice (this check does not block merging yet).",
      };
    }
    return failOn === "never"
      ? {
          verdict: "fail",
          exitCode: 0,
          level: "warning",
          message: "A required case failed. The job passes because fail-on is never.",
        }
      : { verdict: "fail", exitCode: 1, level: "error", message: "A required case failed." };
  }
  if (cliCode === 2) {
    if (failOn === "never" || onError === "neutral") {
      return {
        verdict: "error",
        exitCode: 0,
        level: "warning",
        message: `Could not test (not an app failure). The job passes because ${failOn === "never" ? "fail-on is never" : "on-error is neutral"}.`,
      };
    }
    return {
      verdict: "error",
      exitCode: 2,
      level: "error",
      message: "Could not test (not an app failure): see the report for why.",
    };
  }
  return {
    verdict: "setup",
    exitCode: 3,
    level: "error",
    message: "Setup problem: see the lines above (the app was not tested).",
  };
}
