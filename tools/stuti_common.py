"""Shared helpers for the Stuti content tools (stdlib only, so --help always works)."""

from __future__ import annotations

import json
import re
import unicodedata
from datetime import date
from pathlib import Path

LANGS = ("en", "hi", "ta", "te", "pa")
REPO = Path(__file__).resolve().parents[1]
SONGS_DIR = REPO / "src" / "content" / "songs"

# Indian digits → ASCII, so "௧௧௭" or "११७" are read as 117.
_DIGITS = {}
for zero in (0x0966, 0x0A66, 0x0BE6, 0x0C66):  # Devanagari, Gurmukhi, Tamil, Telugu
    for i in range(10):
        _DIGITS[zero + i] = str(i)

# Section headings as printed in hymnbooks → (type, label). Matched on a line by itself.
SECTION_LABELS = {
    "பல்லவி": ("chorus", "Pallavi"),
    "அனுபல்லவி": ("other", "Anupallavi"),
    "சரணம்": ("verse", "Charanam"),
    "சரணங்கள்": ("verse", "Charanam"),
    "పల్లవి": ("chorus", "Pallavi"),
    "అనుపల్లవి": ("other", "Anupallavi"),
    "చరణం": ("verse", "Charanam"),
    "कोरस": ("chorus", "कोरस"),
    "टेक": ("chorus", "टेक"),
    "ਕੋਰਸ": ("chorus", "ਕੋਰਸ"),
    "chorus": ("chorus", "Chorus"),
    "refrain": ("refrain", "Refrain"),
}


def ascii_digits(text: str) -> str:
    return text.translate(_DIGITS)


def slugify(text: str) -> str:
    """'Yesuve En Thunai!' → 'yesuve-en-thunai'. Latin letters and digits only (may return '')."""
    t = unicodedata.normalize("NFKD", text)
    t = "".join(c for c in t if not unicodedata.combining(c)).lower()
    t = re.sub(r"[^a-z0-9]+", "-", t).strip("-")
    return t[:80].rstrip("-")


def _label_of(line: str):
    key = line.strip().rstrip(":.-–").strip()
    return SECTION_LABELS.get(key) or SECTION_LABELS.get(key.lower())


def split_sections(text: str) -> list[dict]:
    """Blank lines and printed headings (Pallavi, Chorus, कोरस …) separate sections.

    Unlabelled blocks become numbered verses. Returns schema-shaped sections with only `n` filled.
    """
    sections: list[dict] = []
    pending = None  # label waiting for its lines
    block: list[str] = []
    verse_no = 0

    def flush():
        nonlocal block, pending, verse_no
        if not block:
            return
        if pending:
            kind, label = pending
        else:
            verse_no += 1
            kind, label = "verse", f"Verse {verse_no}"
        sections.append({"type": kind, "label": label, "lines": [{"n": ln} for ln in block]})
        block, pending = [], None

    for raw in text.splitlines():
        line = re.sub(r"\s+", " ", raw).strip()
        if not line:
            flush()
            continue
        lab = _label_of(line)
        if lab:
            flush()
            pending = lab
            continue
        block.append(line)
    flush()
    return sections


def draft_song(*, lang: str, book: str, number: str, title: str, sections: list[dict],
               slug: str, scan: str = "", basis: str = "", today: str | None = None) -> dict:
    """Minimal draft in the same shape the CMS writes. Never published."""
    song: dict = {
        "slug": slug,
        "numbers": [{"book": book, "number": number}],
        "title": {"native": title},
        "sections": sections,
        "display": {"chorusAfterEachVerse": False},
        "author": {"name": "Unknown"},
        "rights": {"status": "permission_pending"},
        "layers": {"roman": "missing", "en": "missing"},
        "updated": today or date.today().isoformat(),
        "publish": False,
    }
    if basis:
        song["rights"]["basis"] = basis
    if scan:
        song["source"] = {"scan": scan}
    return song


def dump(song: dict) -> str:
    return json.dumps(song, ensure_ascii=False, indent=2) + "\n"


def write_new(path: Path, song: dict, dry_run: bool) -> Path | None:
    """Write a song file without ever overwriting: an existing file gets a sibling `.new.json`."""
    target = path if not path.exists() else path.with_suffix(".new.json")
    if dry_run:
        print(f"[dry-run] would write {target}")
        return None
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(dump(song), encoding="utf-8")
    if target != path:
        print(f"  {path.name} exists: wrote {target.name}. Compare them and merge by hand.")
    return target
