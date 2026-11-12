import { describe, expect, it } from "vitest";
import {
  DEFAULT_FILE,
  InputError,
  mapToCliArgs,
  readContext,
  readInputs,
  resolveComment,
  resolveShareLinks,
  resolveSync,
  secretsWithheld,
} from "./inputs.js";

const md = { markdown: "/tmp/r.md" };
const inputs = (o: Record<string, string> = {}) =>
  readInputs(Object.fromEntries(Object.entries(o).map(([k, v]) => [`INPUT_${k.toUpperCase()}`, v])));

describe("mapToCliArgs", () => {
  it("defaults: json, report, timeout, on-error, wait", () => {
    const m = mapToCliArgs(inputs({ "api-key": "k" }), false, true, md);
    expect(m.args).toEqual([
      "test", "--json", "--markdown", "/tmp/r.md", "--file", DEFAULT_FILE,
      "--timeout-minutes", "15", "--on-error", "block",
      "--wait-for-url", "--wait-for-url-timeout", "120",
    ]);
    expect(m.waitSeconds).toBe(120);
  });

  it("maps every input to its flag", () => {
    const m = mapToCliArgs(
      inputs({
        url: "https://pr-1.example.com", file: "qa/t.yaml", workflow: "checkout", target: "staging",
        tags: "smoke,pay", "case-ids": "a,b", retries: "2", "timeout-minutes": "20",
        "on-error": "neutral", "wait-for-url": "30",
      }),
      true, false, md,
    );
    expect(m.args).toEqual([
      "test", "--json", "--markdown", "/tmp/r.md", "--file", "qa/t.yaml",
      "--url", "https://pr-1.example.com", "--workflow", "checkout", "--target", "staging",
      "--tags", "smoke,pay", "--case-ids", "a,b", "--sync", "--retries", "2",
      "--timeout-minutes", "20", "--on-error", "neutral", "--wait-for-url", "--wait-for-url-timeout", "30",
    ]);
  });

  it("leaves out a missing default file so the CLI can run a saved workflow", () => {
    const m = mapToCliArgs(inputs({ workflow: "checkout" }), false, false, md);
    expect(m.args).not.toContain("--file");
  });

  it("keeps a file the user named even when missing (the CLI says so)", () => {
    expect(mapToCliArgs(inputs({ file: "nope.yaml" }), false, false, md).args).toContain("nope.yaml");
  });

  it("no wait for 0 or false", () => {
    for (const v of ["0", "false"]) {
      const m = mapToCliArgs(inputs({ "wait-for-url": v }), false, true, md);
      expect(m.args).not.toContain("--wait-for-url");
      expect(m.waitSeconds).toBe(0);
    }
  });

  it.each([
    [{ "on-error": "maybe" }, /on-error/],
    [{ "fail-on": "always" }, /fail-on/],
    [{ retries: "3" }, /retries/],
    [{ retries: "x" }, /retries/],
    [{ "timeout-minutes": "0" }, /timeout-minutes/],
    [{ "wait-for-url": "500" }, /wait-for-url/],
  ])("rejects bad input %j", (o, re) => {
    expect(() => mapToCliArgs(inputs(o), false, true, md)).toThrow(InputError);
    expect(() => mapToCliArgs(inputs(o), false, true, md)).toThrow(re);
  });
});

const ctx = (env: Record<string, string>, event = {}) => readContext(env, event);

describe("sync default", () => {
  const ev = { repository: { default_branch: "main" } };
  it("on for a push to the default branch", () => {
    expect(resolveSync(inputs(), ctx({ GITHUB_EVENT_NAME: "push", GITHUB_REF: "refs/heads/main" }, ev))).toBe(true);
  });
  it("off for a PR, another branch, a tag", () => {
    expect(resolveSync(inputs(), ctx({ GITHUB_EVENT_NAME: "pull_request", GITHUB_REF: "refs/pull/3/merge" }, ev))).toBe(false);
    expect(resolveSync(inputs(), ctx({ GITHUB_EVENT_NAME: "push", GITHUB_REF: "refs/heads/dev" }, ev))).toBe(false);
    expect(resolveSync(inputs(), ctx({ GITHUB_EVENT_NAME: "push", GITHUB_REF: "refs/tags/v1" }, ev))).toBe(false);
  });
  it("off when the default branch is unknown", () => {
    expect(resolveSync(inputs(), ctx({ GITHUB_EVENT_NAME: "push", GITHUB_REF: "refs/heads/main" }))).toBe(false);
  });
  it("explicit wins", () => {
    expect(resolveSync(inputs({ sync: "true" }), ctx({ GITHUB_EVENT_NAME: "pull_request" }, ev))).toBe(true);
    expect(resolveSync(inputs({ sync: "false" }), ctx({ GITHUB_EVENT_NAME: "push", GITHUB_REF: "refs/heads/main" }, ev))).toBe(false);
  });
  it("rejects a non-boolean", () => {
    expect(() => resolveSync(inputs({ sync: "yes" }), ctx({}))).toThrow(InputError);
  });
});

describe("share links default", () => {
  it("off on public repos and when privacy is unknown, on for private", () => {
    expect(resolveShareLinks(inputs(), ctx({}, { repository: { private: false } }))).toBe(false);
    expect(resolveShareLinks(inputs(), ctx({}))).toBe(false);
    expect(resolveShareLinks(inputs(), ctx({}, { repository: { private: true } }))).toBe(true);
  });
  it("explicit wins", () => {
    expect(resolveShareLinks(inputs({ "share-links": "true" }), ctx({}, { repository: { private: false } }))).toBe(true);
    expect(resolveShareLinks(inputs({ "share-links": "false" }), ctx({}, { repository: { private: true } }))).toBe(false);
  });
});

describe("comment and fork detection", () => {
  it("comment defaults to true", () => {
    expect(resolveComment(inputs())).toBe(true);
    expect(resolveComment(inputs({ comment: "false" }))).toBe(false);
  });
  it("fork PR and Dependabot have no secrets; same-repo PR and push do", () => {
    const fork = { pull_request: { head: { repo: { full_name: "x/r", fork: true } } } };
    const same = { pull_request: { head: { repo: { full_name: "o/r", fork: false } } } };
    expect(secretsWithheld(ctx({ GITHUB_EVENT_NAME: "pull_request", GITHUB_REPOSITORY: "o/r" }, fork))).toBe(true);
    expect(secretsWithheld(ctx({ GITHUB_EVENT_NAME: "pull_request", GITHUB_REPOSITORY: "o/r" }, same))).toBe(false);
    expect(secretsWithheld(ctx({ GITHUB_EVENT_NAME: "pull_request", GITHUB_REPOSITORY: "o/r", GITHUB_ACTOR: "dependabot[bot]" }, same))).toBe(true);
    expect(secretsWithheld(ctx({ GITHUB_EVENT_NAME: "push", GITHUB_REPOSITORY: "o/r" }, fork))).toBe(false);
  });
});
