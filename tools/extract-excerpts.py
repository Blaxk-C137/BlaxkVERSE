#!/usr/bin/env python3
"""
extract-excerpts — builds site/assets/js/bx-excerpts.js from the pinned source.

Why this exists as a separate step:

A code excerpt published on a portfolio is a claim about what a file contains. If
the excerpt text is typed or edited by hand, that claim can drift from the source
without anyone noticing — which is precisely the failure this project is supposed
to make impossible.

So the bodies are never written by hand. This script reads the cached copy of each
file, sliced at the commit SHA recorded in bx-data.js, verifies the file's hash
against sources/MANIFEST.json, and emits the exact lines. If the source cache is
tampered with, extraction fails rather than publishing something untrue.

Usage: python3 tools/extract-excerpts.py
"""
import hashlib, json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCES = os.path.join(ROOT, "sources")
SITE = os.path.join(ROOT, "site")

# ------------------------------------------------------------------ load records
def load_data():
    code = ("global.window={};require(process.argv[1]);"
            "process.stdout.write(JSON.stringify(window.BX_DATA));")
    out = subprocess.run(["node", "-e", code, os.path.join(SITE, "assets", "js", "bx-data.js")],
                         capture_output=True, text=True)
    if out.returncode != 0:
        raise SystemExit("bx-data.js failed to load:\n" + out.stderr)
    return json.loads(out.stdout)


D = load_data()
manifest = json.load(open(os.path.join(SOURCES, "MANIFEST.json")))
by_repo = {m["repo"]: m for m in manifest["files"]}

out = {}
problems = []

for p in D["projects"]:
    for ex in p.get("excerpts", []):
        if not ex.get("startLine"):
            continue  # pointer-only entry: deliberately has no body
        m = by_repo.get(p["repo"])
        if not m:
            problems.append(f"no cached source for {p['repo']} ({ex['path']})")
            continue
        if m["sha"] != ex["sha"]:
            problems.append(
                f"{p['repo']}: cached source is commit {m['sha']} but the record pins {ex['sha']} — "
                f"re-fetch the file at the pinned commit rather than publishing an unpinned excerpt")
            continue

        path = os.path.join(SOURCES, m["file"])
        raw = open(path, "rb").read()
        digest = hashlib.sha256(raw).hexdigest()
        if digest != m["sha256"]:
            problems.append(f"{m['file']}: content hash {digest[:12]}… does not match the manifest — "
                            f"the cached source has been modified")
            continue

        lines = raw.decode("utf-8", "replace").split("\n")
        start, end = ex["startLine"], ex["endLine"]
        if end > len(lines):
            problems.append(f"{p['slug']} {ex['path']}: range ends at {end} but the file has {len(lines)} lines")
            continue
        body = lines[start - 1:end]

        # Trailing whitespace is preserved in the file but meaningless in a
        # rendered excerpt, so it is stripped — and the manifest records that as
        # the only permitted transformation.
        body = [ln.rstrip() for ln in body]

        key = f"{p['repo']}::{ex['path']}"
        out[key] = {
            "repo": p["repo"], "path": ex["path"], "sha": ex["sha"],
            "startLine": start, "endLine": end, "lang": ex["lang"],
            "lines": body,
            "lineCount": len(body),
            "sha256_of_source": m["sha256"],
        }

if problems:
    print("EXTRACTION FAILED — refusing to publish an excerpt that cannot be traced:\n", file=sys.stderr)
    for x in problems:
        print("  ✗ " + x, file=sys.stderr)
    sys.exit(1)

# ------------------------------------------------------------------- emit module
parts = ["/* ============================================================================",
         "   BLAXKVERSE — pinned code excerpts",
         "   ----------------------------------------------------------------------------",
         "   GENERATED FILE — do not edit. Produced by tools/extract-excerpts.py,",
         "   which slices the exact line ranges out of the cached source files that sit",
         "   at the commit SHAs recorded in sources/MANIFEST.json.",
         "",
         "   Every body below is verbatim source. It is mechanically extracted rather",
         "   than transcribed, because a portfolio that quotes code is making a factual",
         "   claim about what that code contains.",
         "   ========================================================================== */",
         "",
         "window.BX_EXCERPTS = (function () {",
         '  "use strict";',
         "  return {"]

for key, val in out.items():
    parts.append(f"    // {val['repo']} · {val['path']} @ {val['sha'][:10]} · lines {val['startLine']}–{val['endLine']}")
    parts.append(f"    {json.dumps(key)}: {{")
    for field in ("repo", "path", "sha", "lang"):
        parts.append(f"      {field}: {json.dumps(val[field])},")
    parts.append(f"      startLine: {val['startLine']},")
    parts.append(f"      endLine: {val['endLine']},")
    parts.append(f"      lineCount: {val['lineCount']},")
    parts.append(f"      sha256OfSource: {json.dumps(val['sha256_of_source'])},")
    parts.append("      lines: [")
    for ln in val["lines"]:
        parts.append("        " + json.dumps(ln) + ",")
    parts.append("      ],")
    parts.append("    },")
parts.append("  };")
parts.append("})();")
parts.append("")

dest = os.path.join(SITE, "assets", "js", "bx-excerpts.js")
with open(dest, "w", encoding="utf-8") as f:
    f.write("\n".join(parts))

total = sum(v["lineCount"] for v in out.values())
print(f"Extracted {len(out)} excerpt(s), {total} lines, verbatim from pinned commits.")
for k, v in out.items():
    print(f"  ✓ {v['repo']:<26} {v['path']:<34} L{v['startLine']}-{v['endLine']} ({v['lineCount']} lines)")
print(f"\nwrote {os.path.relpath(dest, ROOT)}")
