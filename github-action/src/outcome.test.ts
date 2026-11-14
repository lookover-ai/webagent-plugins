import { describe, expect, it } from "vitest";
import { outcomeFor } from "./outcome.js";

describe("outcomeFor", () => {
  it("0 pass", () => {
    expect(outcomeFor(0, "fail", "block")).toMatchObject({ verdict: "pass", exitCode: 0 });
    expect(outcomeFor(0, "fail", "neutral")).toMatchObject({ verdict: "pass", exitCode: 0 });
  });
  it("1 fails the job, unless fail-on never", () => {
    expect(outcomeFor(1, "fail", "block")).toMatchObject({ verdict: "fail", exitCode: 1 });
    expect(outcomeFor(1, "never", "block")).toMatchObject({ verdict: "fail", exitCode: 0, level: "warning" });
  });
  it("2 could not test: exit 2; 0 with a warning on fail-on never or on-error neutral", () => {
    expect(outcomeFor(2, "fail", "block")).toMatchObject({ verdict: "error", exitCode: 2, level: "error" });
    expect(outcomeFor(2, "never", "block")).toMatchObject({ verdict: "error", exitCode: 0, level: "warning" });
    const neutral = outcomeFor(2, "fail", "neutral");
    expect(neutral).toMatchObject({ verdict: "error", exitCode: 0, level: "warning" });
    expect(neutral.message).toContain("on-error is neutral");
  });
  it("3, a crash and a signal are setup problems and always fail", () => {
    for (const code of [3, 7, null]) {
      expect(outcomeFor(code, "never", "neutral")).toMatchObject({ verdict: "setup", exitCode: 3 });
    }
  });
});

describe("outcomeFor mode", () => {
  it("practice turns a failed case (exit 1) into a green job but keeps the verdict", () => {
    expect(outcomeFor(1, "fail", "block", "practice")).toMatchObject({ verdict: "fail", exitCode: 0, level: "warning" });
    expect(outcomeFor(1, "fail", "block", "enforce")).toMatchObject({ verdict: "fail", exitCode: 1 });
  });
  it("practice leaves could-not-test and setup problems alone", () => {
    expect(outcomeFor(2, "fail", "block", "practice")).toMatchObject({ verdict: "error", exitCode: 2 });
    expect(outcomeFor(3, "fail", "block", "practice")).toMatchObject({ verdict: "setup", exitCode: 3 });
  });
  it("practice never reports a could-not-test as a pass, even with on-error neutral", () => {
    expect(outcomeFor(2, "fail", "neutral", "practice")).toMatchObject({ verdict: "error", exitCode: 0, level: "warning" });
  });
});
