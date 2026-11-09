#!/usr/bin/env python3
"""Rebuild worker/src/legal-pages.js from public/{privacy,terms,support}.html."""
from pathlib import Path

root = Path(__file__).resolve().parents[1]
pages = {}
for slug in ("privacy", "terms", "support"):
    pages[slug] = (root / "public" / f"{slug}.html").read_text(encoding="utf-8")

out = [
    "// Static legal pages served by the percolator-tech Worker.\n",
    "// Generated from public/{privacy,terms,support}.html. Re-run scripts/embed-legal-pages.py after edits.\n",
    "export const LEGAL_PAGES = {\n",
]
for slug, html in pages.items():
    out.append(f"  {slug}: {html!r},\n")
out.append("};\n\n")
out.append(
    "export function legalResponse(slug) {\n"
    "  const html = LEGAL_PAGES[slug];\n"
    "  if (!html) return null;\n"
    "  return new Response(html, {\n"
    "    status: 200,\n"
    "    headers: {\n"
    "      'content-type': 'text/html; charset=utf-8',\n"
    "      'cache-control': 'public, max-age=300',\n"
    "    },\n"
    "  });\n"
    "}\n"
)
dest = root / "worker/src/legal-pages.js"
dest.write_text("".join(out), encoding="utf-8")
print("wrote", dest)
