import { describe, expect, it } from "vitest";
import { fitBody, findComment, marker, pullForCommit, upsertComment, type GithubDeps } from "./github.js";

interface Call { method: string; path: string; body?: unknown }

/** A fake GitHub: `handler` answers by "METHOD path-prefix". */
function fake(handler: (c: Call) => { status?: number; json?: unknown }): { deps: GithubDeps; calls: Call[] } {
  const calls: Call[] = [];
  const f = (async (url: string, init: RequestInit = {}) => {
    const u = new URL(url);
    const call: Call = {
      method: init.method ?? "GET",
      path: u.pathname + u.search,
      ...(init.body ? { body: JSON.parse(String(init.body)) } : {}),
    };
    calls.push(call);
    const r = handler(call);
    const status = r.status ?? 200;
    return new Response(r.json === undefined ? null : JSON.stringify(r.json), { status });
  }) as unknown as typeof fetch;
  return { deps: { fetch: f, apiUrl: "https://api.github.com", repo: "o/r", token: "t" }, calls };
}

const mark = marker("checkout");

describe("sticky comment", () => {
  it("marker carries the workflow key", () => {
    expect(mark).toBe("<!-- lookover-qa:checkout -->");
  });

  it("creates when none carries the marker (other comments and other keys are left alone)", () => {
    const { deps, calls } = fake((c) =>
      c.method === "GET"
        ? { json: [{ id: 1, body: "hello" }, { id: 2, body: marker("other") + "x" }] }
        : { status: 201, json: { id: 9 } },
    );
    return upsertComment(deps, 5, mark, `${mark}\nbody`).then((r) => {
      expect(r).toEqual({ status: "created", id: 9 });
      expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
        "GET /repos/o/r/issues/5/comments?per_page=100&page=1",
        "POST /repos/o/r/issues/5/comments",
      ]);
    });
  });

  it("updates the comment that carries the marker", async () => {
    const { deps, calls } = fake((c) =>
      c.method === "GET" ? { json: [{ id: 1, body: "hi" }, { id: 7, body: `${mark}\nold` }] } : { json: { id: 7 } },
    );
    expect(await upsertComment(deps, 5, mark, `${mark}\nnew`)).toEqual({ status: "updated", id: 7 });
    expect(calls[1]).toMatchObject({ method: "PATCH", path: "/repos/o/r/issues/comments/7", body: { body: `${mark}\nnew` } });
  });

  it("finds the comment on a later page", async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => ({ id: i + 1, body: "x" }));
    const { deps } = fake((c) => (c.path.endsWith("&page=1") ? { json: page1 } : { json: [{ id: 300, body: mark }] }));
    expect(await findComment(deps, 5, mark)).toBe(300);
  });

  it("skips with the permissions hint when GitHub refuses", async () => {
    const { deps } = fake(() => ({ status: 403, json: { message: "Resource not accessible by integration" } }));
    const r = await upsertComment(deps, 5, mark, "b");
    expect(r.status).toBe("skipped");
    expect(r).toMatchObject({ reason: expect.stringContaining("pull-requests: write") });
  });

  it("a comment it may not edit: makes its own instead", async () => {
    const { deps, calls } = fake((c) => {
      if (c.method === "GET") return { json: [{ id: 7, body: mark }] };
      if (c.method === "PATCH") return { status: 403, json: { message: "no" } };
      return { status: 201, json: { id: 8 } };
    });
    expect(await upsertComment(deps, 5, mark, "b")).toEqual({ status: "created", id: 8 });
    expect(calls.map((c) => c.method)).toEqual(["GET", "PATCH", "POST"]);
  });

  it("a network error is a skip, never a throw", async () => {
    const deps: GithubDeps = { fetch: (async () => { throw new Error("offline"); }) as unknown as typeof fetch, apiUrl: "x", repo: "o/r", token: "t" };
    expect(await upsertComment(deps, 5, mark, "b")).toEqual({ status: "skipped", reason: "offline" });
  });

  it("cuts a body that is too long", () => {
    const cut = fitBody("a".repeat(70_000));
    expect(cut.length).toBeLessThan(65_536);
    expect(cut).toContain("cut to fit");
  });
});

describe("pullForCommit", () => {
  it("returns the open PR", async () => {
    const { deps } = fake(() => ({ json: [{ number: 3, state: "closed" }, { number: 4, state: "open" }] }));
    expect(await pullForCommit(deps, "abc")).toBe(4);
  });
  it("undefined on error", async () => {
    const { deps } = fake(() => ({ status: 404, json: {} }));
    expect(await pullForCommit(deps, "abc")).toBeUndefined();
  });
});
