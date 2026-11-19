"""Draft the English meaning layer ("e") with an AI model (optional helper, spec §16.3).

Example:
  set STUTI_AI_KEY=...            (PowerShell: $env:STUTI_AI_KEY="...")
  python tools/translate/translate.py src/content/songs/ta/yesuve-en-thunai.json --model <model-name>
  python tools/translate/translate.py src/content/songs/ta/*.json --dry-run     # show the prompt only

Talks to any OpenAI-compatible chat API (--base-url). The key is read from the STUTI_AI_KEY
environment variable and is never written anywhere. Only fills empty "e" lines, sets
layers.en = "draft", and refuses answers whose line count differs. A person must review every line.
"""

from __future__ import annotations

import argparse
import glob
import json
import os
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from stuti_common import REPO, dump  # noqa: E402

LANG_NAME = {"hi": "Hindi", "ta": "Tamil", "te": "Telugu", "pa": "Punjabi"}
PROMPT_FILE = REPO / "docs" / "prompts" / "translate.md"


def prompt_template() -> str:
    """The text block inside docs/prompts/translate.md (one source of truth for people and this tool)."""
    text = PROMPT_FILE.read_text(encoding="utf-8")
    start = text.index("```text") + len("```text")
    return text[start:text.index("```", start)].strip()


def build_prompt(song: dict, lang: str) -> str:
    payload = {"sections": [{"label": s["label"], "lines": [{"n": l["n"], "r": l.get("r", "")} for l in s["lines"]]}
                            for s in song["sections"]]}
    return (prompt_template()
            .replace("{{Tamil|Telugu|Hindi|Punjabi}}", LANG_NAME[lang])
            .replace("{{paste song JSON}}", json.dumps(payload, ensure_ascii=False, indent=2)))


def apply_answer(song: dict, answer: dict) -> int:
    """Copy "e" from the model's JSON into empty lines. Raises if the shape doesn't match."""
    ours = [l for s in song["sections"] for l in s["lines"]]
    theirs = [l for s in answer.get("sections", []) for l in s.get("lines", [])]
    if len(ours) != len(theirs):
        raise ValueError(f"line count changed ({len(ours)} → {len(theirs)}); nothing applied")
    filled = 0
    for line, new in zip(ours, theirs):
        e = str(new.get("e", "")).strip()
        if e and not line.get("e"):
            line["e"] = e
            filled += 1
    if filled:
        song.setdefault("layers", {})["en"] = "draft"
    return filled


def ask_model(prompt: str, model: str, base_url: str, key: str) -> dict:
    body = json.dumps({"model": model, "messages": [{"role": "user", "content": prompt}],
                       "response_format": {"type": "json_object"}}).encode()
    req = urllib.request.Request(f"{base_url.rstrip('/')}/chat/completions", data=body,
                                 headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        content = json.load(r)["choices"][0]["message"]["content"]
    return json.loads(content)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("files", nargs="+", help="song JSON files (globs allowed)")
    ap.add_argument("--model", default=os.environ.get("STUTI_AI_MODEL", ""), help="model name (or STUTI_AI_MODEL)")
    ap.add_argument("--base-url", default=os.environ.get("STUTI_AI_BASE_URL", "https://api.openai.com/v1"))
    ap.add_argument("--dry-run", action="store_true", help="print the prompt, call nothing")
    a = ap.parse_args(argv)

    key = os.environ.get("STUTI_AI_KEY", "")
    if not a.dry_run and (not key or not a.model):
        print("Set STUTI_AI_KEY and pass --model (or STUTI_AI_MODEL). Use --dry-run to see the prompt.")
        return 1
    for path in sorted({Path(f) for pattern in a.files for f in glob.glob(pattern)}):
        lang = path.parent.name
        if lang not in LANG_NAME:
            print(f"skip {path} (English songs need no translation)")
            continue
        song = json.loads(path.read_text(encoding="utf-8"))
        prompt = build_prompt(song, lang)
        if a.dry_run:
            print(f"--- {path}\n{prompt}\n")
            continue
        try:
            n = apply_answer(song, ask_model(prompt, a.model, a.base_url, key))
        except (ValueError, KeyError, json.JSONDecodeError, OSError) as e:
            print(f"{path}: {e}")
            continue
        path.write_text(dump(song), encoding="utf-8")
        print(f"{path}: {n} line(s) filled (layers.en = draft). Review every line.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
