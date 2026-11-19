"""OCR scanned hymnbook pages into draft song files (spec §16.1).

Example:
  python tools/ocr/ocr.py --lang ta --book KK --images scans/kk/*.jpg --out tools/ocr/out/

Needs Tesseract 5 with hin/tam/tel/pan traineddata, plus `pip install -r tools/requirements.txt`.
Drafts are never published (rights: permission_pending, publish: false). Proofread every line
against the scan before changing that.
"""

from __future__ import annotations

import argparse
import glob
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from stuti_common import LANGS, ascii_digits, draft_song, slugify, split_sections, write_new  # noqa: E402

TESS_LANG = {"hi": "hin", "ta": "tam", "te": "tel", "pa": "pan", "en": "eng"}
NUMBER_RE = re.compile(r"^\s*(\d{1,4}[a-zA-Z]?)\s*[.)]\s*(.*)$")
LOW_CONF = 70


def split_songs(text: str) -> list[tuple[str, str]]:
    """Split OCR text into (number, body) where a line starts with '117.' or '117)'."""
    songs: list[tuple[str, list[str]]] = []
    for line in ascii_digits(text).splitlines():
        m = NUMBER_RE.match(line)
        if m:
            songs.append((m.group(1), [m.group(2)] if m.group(2).strip() else []))
        elif songs:
            songs[-1][1].append(line)
    return [(n, "\n".join(body).strip("\n")) for n, body in songs]


def parse_page_text(text: str, *, lang: str, book: str, scan: str, today: str | None = None) -> list[dict]:
    """Pure part of the pipeline (tested without Tesseract): OCR text → draft songs."""
    out = []
    for number, body in split_songs(text):
        sections = split_sections(body)
        if not sections:
            continue
        title = sections[0]["lines"][0]["n"]
        song = draft_song(lang=lang, book=book, number=number, title=title, sections=sections,
                          slug=f"{book.lower()}-{number.lower()}", scan=scan, today=today)
        out.append(song)
    return out


def ocr_image(path: str, lang: str):
    try:
        import pytesseract
        from PIL import Image, ImageOps
    except ImportError:
        sys.exit("Missing packages: pip install -r tools/requirements.txt")
    img = ImageOps.grayscale(Image.open(path))
    tl = TESS_LANG[lang]
    text = pytesseract.image_to_string(img, lang=tl, config="--psm 4")
    data = pytesseract.image_to_data(img, lang=tl, config="--psm 4", output_type=pytesseract.Output.DICT)
    low = [w for w, c in zip(data["text"], data["conf"]) if w.strip() and 0 <= float(c) < LOW_CONF]
    return text, low


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--lang", required=True, choices=LANGS)
    ap.add_argument("--book", required=True, help="book id, e.g. KK")
    ap.add_argument("--images", required=True, nargs="+", help="scan files (globs allowed)")
    ap.add_argument("--out", default="tools/ocr/out", help="folder for draft JSON (default: tools/ocr/out)")
    ap.add_argument("--dry-run", action="store_true", help="print what would be written")
    a = ap.parse_args(argv)

    files = sorted({f for pattern in a.images for f in glob.glob(pattern)})
    if not files:
        print("No images matched.")
        return 1
    out = Path(a.out) / a.lang
    found = 0
    for f in files:
        text, low = ocr_image(f, a.lang)
        songs = parse_page_text(text, lang=a.lang, book=a.book, scan=Path(f).name)
        found += len(songs)
        print(f"{Path(f).name}: {len(songs)} song(s), {len(low)} low-confidence word(s)")
        for w in low[:20]:
            print(f"    check: {w}")
        for s in songs:
            # OCR drafts are named <book>-<number>; give them a proper URL name in the CMS.
            write_new(out / f"{slugify(s['slug'])}.json", s, a.dry_run)
    print(f"\nDone: {found} draft song(s) from {len(files)} image(s). Proofread before publishing.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
