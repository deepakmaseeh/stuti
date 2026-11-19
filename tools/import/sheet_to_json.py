"""Turn Google Form song submissions (CSV export) into draft song files (spec §16.4).

Example:
  python tools/import/sheet_to_json.py responses.csv --dry-run
  python tools/import/sheet_to_json.py responses.csv

Expected columns: Timestamp, Name, Language, Book, Number, Title, Lyrics, Source/Permission, Email.
Writes src/content/songs/<lang>/<slug>.json as unpublished drafts (rights: permission_pending).
Never overwrites: if the file exists, writes <slug>.new.json next to it.
Privacy: the submitter's name and email are NOT written into the repo (it is public).
"""

from __future__ import annotations

import argparse
import csv
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from stuti_common import LANGS, SONGS_DIR, draft_song, slugify, split_sections, write_new  # noqa: E402

LANG_NAMES = {"hindi": "hi", "tamil": "ta", "telugu": "te", "punjabi": "pa", "english": "en"}


def lang_code(value: str) -> str | None:
    v = value.strip().lower()
    return v if v in LANGS else LANG_NAMES.get(v)


def row_to_song(row: dict, today: str) -> tuple[str, dict] | str:
    """Returns (relPath, song) or an error message for the row."""
    lang = lang_code(row.get("Language", ""))
    if not lang:
        return f"unknown language {row.get('Language')!r}"
    title = (row.get("Title") or "").strip()
    lyrics = (row.get("Lyrics") or "").strip()
    book = (row.get("Book") or "").strip()
    number = (row.get("Number") or "").strip()
    if not title or not lyrics:
        return "title and lyrics are required"
    if not book or not number:
        return "book and number are required (add them by hand, then re-run)"
    sections = split_sections(lyrics)
    slug = slugify(title) or f"{book.lower()}-{slugify(number) or 'x'}"
    basis = (row.get("Source/Permission") or "").strip()
    song = draft_song(lang=lang, book=book, number=number, title=title, sections=sections,
                      slug=slug, basis=f"Submitted via form: {basis}" if basis else "", today=today)
    return f"{lang}/{slug}.json", song


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("csv", help="CSV export of the form responses")
    ap.add_argument("--out", default=str(SONGS_DIR), help="songs folder (default: src/content/songs)")
    ap.add_argument("--dry-run", action="store_true", help="print what would be written")
    a = ap.parse_args(argv)

    today = date.today().isoformat()
    written = skipped = 0
    with open(a.csv, newline="", encoding="utf-8-sig") as f:
        for i, row in enumerate(csv.DictReader(f), start=2):  # row 1 is the header
            res = row_to_song(row, today)
            if isinstance(res, str):
                print(f"row {i}: skipped ({res})")
                skipped += 1
                continue
            rel, song = res
            print(f"row {i}: {rel}  ({len(song['sections'])} section(s))")
            write_new(Path(a.out) / rel, song, a.dry_run)
            written += 1
    print(f"\n{written} draft(s), {skipped} skipped. Next: npm run validate, then proofread in the CMS.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
