import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

// GitHub refuses an action.yml that is not valid YAML (a ": " inside an unquoted description broke v1 on 2026-11-12).
describe("action.yml", () => {
  const manifest = parse(readFileSync(join(__dirname, "..", "action.yml"), "utf8")) as {
    name: string;
    inputs: Record<string, { description: string }>;
    outputs: Record<string, unknown>;
    runs: { using: string; main: string };
  };

  it("parses as YAML with the expected shape", () => {
    expect(manifest.name).toBe("Lookover QA");
    expect(manifest.runs).toEqual({ using: "node24", main: "dist/index.cjs" });
    for (const name of ["api-key", "url", "file", "workflow", "on-error"]) {
      expect(manifest.inputs[name]?.description, name).toBeTruthy();
    }
    expect(Object.keys(manifest.outputs)).toEqual(expect.arrayContaining(["verdict", "run-id", "run-url", "flaky"]));
  });
});
