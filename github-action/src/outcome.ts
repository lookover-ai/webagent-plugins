/** What the CLI's exit code and run mean for the job: the `verdict` output and the job's own exit code. */

/** `pass`, `fail`, `error` (could not test) come from the run; `setup` and `skipped` mean no run happened. */
export type VerdictOutput = "pass" | "fail" | "error" | "setup" | "skipped";

export interface RunLike {
  id?: string;
  verdict?: string;
  counts?: { flaky?: number };
}

export interface Outcome {
  verdict: VerdictOutput;
  /** The job's exit code: 0, 1 (a required case failed), 2 (could not test), 3 (setup problem). */
  exitCode: 0 | 1 | 2 | 3;
  /** A sentence for the log, or `undefined` for a clean pass. */
  message?: string;
  level: "notice" | "warning" | "error";
}

/** CLI exit code (0 pass, 1 fail, 2 could not test, 3 setup; anything else is a crash = 3) to the job outcome. */
export function outcomeFor(
  cliCode: number | null,
  run: RunLike | undefined,
  failOn: "fail" | "never",
  mode: "enforce" | "practice" = "enforce",
): Outcome {
  if (cliCode === 0) {
    if (run?.verdict === "error" || run?.verdict === "running") {
      return {
        verdict: "error",
        exitCode: 0,
        level: "warning",
        message: "Could not test (not an app failure). The job passes because on-error is neutral.",
      };
    }
    return { verdict: "pass", exitCode: 0, level: "notice" };
  }
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
    return failOn === "never"
      ? {
          verdict: "error",
          exitCode: 0,
          level: "warning",
          message: "Could not test (not an app failure). The job passes because fail-on is never.",
        }
      : {
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
