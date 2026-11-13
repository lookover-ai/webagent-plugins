import { describe, expect, it } from "vitest";
import { outcomeFor } from "./outcome.js";

describe("outcomeFor", () => {
  it("0 pass", () => {
    expect(outcomeFor(0, { verdict: "pass" }, "fail")).toMatchObject({ verdict: "pass", exitCode: 0 });
  });
  it("0 with an error verdict is on-error neutral: warns, passes", () => {
    expect(outcomeFor(0, { verdict: "error" }, "fail")).toMatchObject({ verdict: "error", exitCode: 0, level: "warning" });
  });
  it("1 fails the job, unless fail-on never", () => {
    expect(outcomeFor(1, { verdict: "fail" }, "fail")).toMatchObject({ verdict: "fail", exitCode: 1 });
    expect(outcomeFor(1, { verdict: "fail" }, "never")).toMatchObject({ verdict: "fail", exitCode: 0, level: "warning" });
  });
  it("2 could not test: exit 2, or 0 with fail-on never", () => {
    expect(outcomeFor(2, undefined, "fail")).toMatchObject({ verdict: "error", exitCode: 2 });
    expect(outcomeFor(2, undefined, "never")).toMatchObject({ verdict: "error", exitCode: 0 });
  });
  it("3, a crash and a signal are setup problems and always fail", () => {
    for (const code of [3, 7, null]) {
      expect(outcomeFor(code, undefined, "never")).toMatchObject({ verdict: "setup", exitCode: 3 });
    }
  });
});

describe("outcomeFor mode", () => {
  it("practice turns a failed case (exit 1) into a green job but keeps the verdict", () => {
    expect(outcomeFor(1, { verdict: "fail" }, "fail", "practice")).toMatchObject({ verdict: "fail", exitCode: 0, level: "warning" });
    expect(outcomeFor(1, { verdict: "fail" }, "fail", "enforce")).toMatchObject({ verdict: "fail", exitCode: 1 });
  });
  it("practice leaves could-not-test and setup problems alone", () => {
    expect(outcomeFor(2, undefined, "fail", "practice")).toMatchObject({ verdict: "error", exitCode: 2 });
    expect(outcomeFor(3, undefined, "fail", "practice")).toMatchObject({ verdict: "setup", exitCode: 3 });
  });
});
