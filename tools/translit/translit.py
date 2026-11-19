"""Fill the Roman layer ("r") of song files from the original script (spec §16.2).

Example:
  python tools/translit/translit.py src/content/songs/ta/*.json --only-missing
  python tools/translit/translit.py src/content/songs/hi/*.json --dry-run

Uses Aksharamukha (pip install -r tools/requirements.txt), then the church-spelling rules in
tools/translit/rules/<lang>.json. Never touches "n" or "e". Filled layers are marked "draft":
a native speaker must review them (docs/prompts/transliterate.md helps).
"""

from __future__ import annotations

import argparse
import glob
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from stuti_common import dump  # noqa: E402

SCRIPT = {"hi": "Devanagari", "ta": "Tamil", "te": "Telugu", "pa": "Gurmukhi"}
RULES_DIR = Path(__file__).resolve().parent / "rules"

# Word-final bare consonant → add virama, so the inherent "a" isn't spoken (Hindi/Punjabi: "naam", not "naama").
# Only after another letter of the word: one-letter words like न keep their vowel ("na").
_FINAL_CONSONANT = {
    "hi": (re.compile(r"(?<=[\u0900-\u097F])([\u0915-\u0939\u0958-\u095F]\u093C?)(?=[\s,.;:!?।॥'\"-]|$)"), "\u094D"),
    "pa": (re.compile(r"(?<=[\u0A00-\u0A7F])([\u0A15-\u0A39\u0A59-\u0A5E]\u0A3C?)(?=[\s,.;:!?।॥'\"-]|$)"), "\u0A4D"),
}


# Word-final nasal sign (ं ँ / ਂ ੰ) is written "n" by most people (main, gaaoon), not "m" as Aksharamukha does.
_FINAL_NASAL = {
    "hi": (re.compile(r"[\u0901\u0902](?=[\s,.;:!?।॥'\"-]|$)"), "\u0928\u094D"),
    "pa": (re.compile(r"[\u0A02\u0A70](?=[\s,.;:!?।॥'\"-]|$)"), "\u0A28\u0A4D"),
}


def prepare(text: str, lang: str) -> str:
    """Hindi/Punjabi spelling fixes that are only reliable in the original script."""
    if lang in _FINAL_NASAL:
        pattern, n = _FINAL_NASAL[lang]
        text = pattern.sub(n, text)
    if lang in _FINAL_CONSONANT:
        pattern, virama = _FINAL_CONSONANT[lang]
        text = pattern.sub(lambda m: m.group(1) + virama, text)
    return text


def load_rules(lang: str) -> list[tuple[re.Pattern, str]]:
    path = RULES_DIR / f"{lang}.json"
    if not path.exists():
        return []
    data = json.loads(path.read_text(encoding="utf-8"))
    return [(re.compile(r["from"]), r["to"]) for r in data.get("replace", [])]


def readable(raw: str, rules: list[tuple[re.Pattern, str]]) -> str:
    """Post-process Aksharamukha output: plain lowercase letters, church spellings, first word capitalised."""
    t = raw.lower()
    # Aksharamukha marks retroflex/alveolar letters with an apostrophe (e'n, pat't'aavu); people don't type them.
    t = re.sub(r"(?<=[a-z])'", "", t)
    for pattern, to in rules:
        t = pattern.sub(to, t)
    t = re.sub(r"\s+", " ", t).strip()
    return t[:1].upper() + t[1:]


def transliterate(text: str, lang: str, rules) -> str:
    try:
        from aksharamukha import transliterate as ak
    except ImportError:
        sys.exit("Missing package: pip install -r tools/requirements.txt (aksharamukha)")
    return readable(ak.process(SCRIPT[lang], "RomanReadable", prepare(text, lang)), rules)


def lang_of(path: Path) -> str:
    return path.parent.name


def fill_song(song: dict, lang: str, convert, overwrite: bool) -> int:
    """Fill r (and title.roman) where empty, or everywhere with overwrite. Returns lines changed."""
    changed = 0
    title = song.setdefault("title", {})
    if overwrite or not title.get("roman"):
        title["roman"] = convert(title["native"])
    for sec in song.get("sections", []):
        for line in sec.get("lines", []):
            if overwrite or not line.get("r"):
                line["r"] = convert(line["n"])
                changed += 1
    if changed:
        song.setdefault("layers", {})["roman"] = "draft"
    return changed


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("files", nargs="+", help="song JSON files (globs allowed)")
    mode = ap.add_mutually_exclusive_group()
    mode.add_argument("--only-missing", action="store_true", default=True, help="fill empty r only (default)")
    mode.add_argument("--overwrite", action="store_true", help="replace existing r too (sets layer back to draft)")
    ap.add_argument("--scheme", default="readable", choices=["readable"], help="output style (readable only)")
    ap.add_argument("--dry-run", action="store_true", help="show changes without writing")
    a = ap.parse_args(argv)

    files = sorted({Path(f) for pattern in a.files for f in glob.glob(pattern)})
    total = 0
    for path in files:
        lang = lang_of(path)
        if lang not in SCRIPT:
            print(f"skip {path} (language '{lang}' has no transliteration)")
            continue
        rules = load_rules(lang)
        song = json.loads(path.read_text(encoding="utf-8"))
        n = fill_song(song, lang, lambda t: transliterate(t, lang, rules), a.overwrite)
        total += n
        if not n:
            continue
        if a.dry_run:
            print(f"[dry-run] {path}: {n} line(s)")
            for sec in song["sections"]:
                for line in sec["lines"]:
                    print(f"    {line['n']}  →  {line['r']}")
        else:
            path.write_text(dump(song), encoding="utf-8")
            print(f"{path}: {n} line(s) filled (layers.roman = draft)")
    print(f"\n{total} line(s) {'would be ' if a.dry_run else ''}transliterated in {len(files)} file(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
