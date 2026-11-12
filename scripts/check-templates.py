#!/usr/bin/env python3
"""Check the .webagent templates against the tests.yaml format (docs/WEBAGENT-FOLDER.md).

Needs python3 + PyYAML. Optional: WEBAGENT_CONTRACTS_DIST=<path to the built contracts dist folder> also runs the
contract's own reader (readTestsFile) on the template through node, which is the real reference.
"""
import json
import os
import re
import subprocess
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
TPL = ROOT / "plugins/webagent/templates/.webagent"
SLUG = re.compile(r"^[a-z0-9][a-z0-9_-]{0,63}$")
errors = []


def err(msg):
    errors.append(msg)


def url_ok(u):
    return isinstance(u, str) and re.match(r"^https?://", u, re.I) is not None and len(u) <= 2000


def check_tests(d):
    if isinstance(d, list):
        d = {"cases": d}
    if d.get("version", 1) != 1:
        err("version must be 1")
    if "targets" in d and "url" in d:
        err("use targets or url, not both")
    names = list(d["targets"]) if "targets" in d else (["default"] if "url" in d else [])
    if len(names) > 10:
        err("more than 10 targets")
    for n, t in (d.get("targets") or {}).items():
        if not SLUG.match(n):
            err(f"target name {n!r} is not a slug")
        u = t if isinstance(t, str) else (t or {}).get("url")
        if not url_ok(u):
            err(f"target {n}: url must be http(s)")
    if "url" in d and not url_ok(d["url"]):
        err("url must be http(s)")
    if "defaultTarget" in d and d["defaultTarget"] not in names:
        err("defaultTarget is not one of the targets")
    if "key" in d and not SLUG.match(d["key"]):
        err("key is not a slug")
    if "concurrency" in d and not (isinstance(d["concurrency"], int) and 1 <= d["concurrency"] <= 10):
        err("concurrency 1..10")
    cases = d.get("cases")
    if not isinstance(cases, list) or not 1 <= len(cases) <= 100:
        err("cases: 1..100 required")
        return
    seen = set()
    for i, c in enumerate(cases):
        w = f"cases[{i}]"
        if not str(c.get("title", "")).strip():
            err(f"{w}: title required")
        if "id" in c:
            if not SLUG.match(c["id"]):
                err(f"{w}: id is not a slug")
            if c["id"] in seen:
                err(f"{w}: duplicate id")
            seen.add(c["id"])
        if "path" in c and not str(c["path"]).startswith("/"):
            err(f"{w}: path starts with /")
        steps = c.get("steps", [])
        if not isinstance(steps, list) or len(steps) > 30 or not all(isinstance(s, str) and s for s in steps):
            err(f"{w}: steps is a list of up to 30 strings")
        if "priority" in c and not (isinstance(c["priority"], int) and 1 <= c["priority"] <= 5):
            err(f"{w}: priority 1..5")
        for t in c.get("tags", []):
            if not SLUG.match(t):
                err(f"{w}: tag {t!r} is not a slug")
        if "checks" in c and not set(c["checks"]) <= {"text", "url", "noText"}:
            err(f"{w}: checks keys are text, url, noText")
        if "signedIn" in c and not isinstance(c["signedIn"], bool):
            err(f"{w}: signedIn is true or false")


def contract_reader(d):
    dist = os.environ.get("WEBAGENT_CONTRACTS_DIST")
    if not dist:
        print("contract reader: skipped (set WEBAGENT_CONTRACTS_DIST)")
        return
    js = (
        "const m=await import(process.argv[1]);const r=m.readTestsFile(JSON.parse(process.argv[2]));"
        "if(!r.success){console.error(JSON.stringify(r.error.issues));process.exit(1)}"
        "const c=m.testsFileToWorkflowRequest(r.data);console.log('warnings:',JSON.stringify(c.warnings))"
    )
    p = subprocess.run(
        ["node", "--input-type=module", "-e", js, "file://" + str(Path(dist).resolve() / "index.js"), json.dumps(d)],
        capture_output=True,
        text=True,
    )
    print("contract reader:", (p.stdout or p.stderr).strip())
    if p.returncode != 0:
        err("contract reader rejected tests.yaml")


for f in sorted(TPL.glob("*.yaml")):
    d = yaml.safe_load(f.read_text())
    if f.name == "tests.yaml":
        check_tests(d)
        contract_reader(d)
    elif f.name == "config.yaml":
        if d.get("version") != 1:
            err("config.yaml: version must be 1")
    print("parsed", f.name)

if errors:
    print("FAIL")
    for e in errors:
        print(" -", e)
    sys.exit(1)
print("OK")
