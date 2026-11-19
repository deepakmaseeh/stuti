#!/usr/bin/env python3
"""Restructure TLBC Hindi song JSON for Present: one chorus + verses + chorusAfterEachVerse.

Run from repo root:
  python tools/restructure_tlbc_sections.py
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SONGS = ROOT / "src" / "content" / "songs" / "hi"

CHORUS_TITLE = re.compile(r"^\s*कोरस\s*[:：\-–—.]?\s*", re.I)
CHORUS_JUNK = re.compile(r"^[:：\-–—.ः\s]+")
REPEAT_MARK = re.compile(r"\s*\(\d+\)\s*$")
ELLIPSIS = re.compile(r"\.{3,}|…")


def norm(text: str) -> str:
    t = REPEAT_MARK.sub("", text or "")
    t = ELLIPSIS.sub("", t)
    t = re.sub(r"\s+", " ", t).strip()
    t = t.replace("ठुकरा", "ठकरा")
    return t


def line_obj(n: str) -> dict:
    return {"n": n.strip(), "r": "", "e": ""}


def clean_native_title(title: str) -> str:
    t = CHORUS_TITLE.sub("", title or "").strip()
    t = REPEAT_MARK.sub("", t).strip()
    t = re.sub(r"^[\s:：\-–—.]+", "", t).strip()
    return t or title


def clean_line_n(n: str) -> str:
    n = CHORUS_JUNK.sub("", n or "").strip()
    n = REPEAT_MARK.sub("", n).strip()
    return n


def chorus_key(sec: dict) -> str:
    lines = sec.get("lines") or []
    if not lines:
        return ""
    return norm(clean_line_n(lines[0].get("n", "")))


def relabel_verses(sections: list[dict]) -> list[dict]:
    verse_n = 0
    chorus_n = 0
    out = []
    for s in sections:
        typ = s["type"]
        lines = [
            {**ln, "n": clean_line_n(ln.get("n", ""))}
            for ln in s.get("lines") or []
            if clean_line_n(ln.get("n", ""))
        ]
        if not lines:
            continue
        if typ in ("chorus", "refrain"):
            chorus_n += 1
            label = "Chorus" if chorus_n == 1 else f"Chorus {chorus_n}"
            out.append({"type": "chorus", "label": label, "lines": lines})
        elif typ == "bridge":
            out.append({"type": "bridge", "label": "Bridge", "lines": lines})
        else:
            verse_n += 1
            out.append({"type": "verse", "label": f"Verse {verse_n}", "lines": lines})
    return out


def dedupe_repeated_choruses(sections: list[dict]) -> tuple[list[dict], bool]:
    """If several choruses share the same opening refrain, extract one chorus + verses."""
    choruses = [(i, s) for i, s in enumerate(sections) if s["type"] in ("chorus", "refrain")]
    if len(choruses) < 2:
        return sections, False

    keys = [chorus_key(s) for _, s in choruses]
    if not keys[0]:
        return sections, False

    # Require at least half of choruses to share the first chorus opening.
    same = sum(1 for k in keys if k and (k == keys[0] or k.startswith(keys[0][:12]) or keys[0].startswith(k[:12])))
    if same < 2:
        return sections, False

    refrain = choruses[0][1]["lines"][:1]
    # Prefer a short refrain: if first chorus opens with one long combined line, keep one line.
    if len(choruses[0][1]["lines"]) >= 2:
        # Keep first line only when later choruses also start with it.
        refrain = [choruses[0][1]["lines"][0]]

    new_secs: list[dict] = []
    for s in sections:
        if s["type"] not in ("chorus", "refrain"):
            new_secs.append(s)
            continue
        body = s["lines"]
        # Drop leading lines that match the refrain.
        i = 0
        while i < len(body) and (
            norm(clean_line_n(body[i]["n"])) == norm(clean_line_n(refrain[0]["n"]))
            or norm(clean_line_n(body[i]["n"])).startswith(norm(clean_line_n(refrain[0]["n"]))[:16])
        ):
            i += 1
        rest = body[i:]
        if rest:
            new_secs.append({"type": "verse", "label": "Verse", "lines": rest})

    # Insert canonical chorus after first verse block if any, else at start.
    first_verse_idx = next((i for i, s in enumerate(new_secs) if s["type"] == "verse"), -1)
    chorus_sec = {"type": "chorus", "label": "Chorus", "lines": refrain}
    if first_verse_idx >= 0:
        # Place chorus after verse 1 for natural V-C-V-C with flag.
        insert_at = first_verse_idx + 1
        new_secs[insert_at:insert_at] = [chorus_sec]
    else:
        new_secs.insert(0, chorus_sec)

    return relabel_verses(new_secs), True


def split_oversized_chorus(sections: list[dict]) -> tuple[list[dict], bool]:
    """When Chorus is a wall of text after a short verse, peel real chorus then stanza pairs."""
    if len(sections) < 2:
        return sections, False
    # Find first chorus with many lines
    for i, s in enumerate(sections):
        if s["type"] not in ("chorus", "refrain"):
            continue
        lines = s["lines"]
        if len(lines) < 6:
            continue
        # Real chorus: first 2–3 lines (after cleaning junk prefixes)
        cleaned = [{**ln, "n": clean_line_n(ln["n"])} for ln in lines if clean_line_n(ln.get("n", ""))]
        if len(cleaned) < 6:
            continue
        chorus_n = 3 if len(cleaned) >= 3 else 2
        chorus_lines = cleaned[:chorus_n]
        rest = cleaned[chorus_n:]
        # Group rest into verses of 2 lines when possible
        verses: list[dict] = []
        for j in range(0, len(rest), 2):
            chunk = rest[j : j + 2]
            verses.append({"type": "verse", "label": "Verse", "lines": chunk})
        new_secs = sections[:i] + [{"type": "chorus", "label": "Chorus", "lines": chorus_lines}] + verses + sections[i + 1 :]
        return relabel_verses(new_secs), True
    return sections, False


def split_single_blob(sections: list[dict], title: str) -> tuple[list[dict], bool]:
    """Single verse: pull a repeating chorus line out when possible."""
    if len(sections) != 1 or sections[0]["type"] != "verse":
        return sections, False
    lines = [
        {**ln, "n": clean_line_n(ln.get("n", ""))}
        for ln in sections[0]["lines"]
        if clean_line_n(ln.get("n", ""))
    ]
    if len(lines) < 4:
        return sections, False

    # Count normalized line frequencies — chorus often repeats.
    counts: dict[str, int] = {}
    for ln in lines:
        k = norm(ln["n"])
        if len(k) < 8:
            continue
        counts[k] = counts.get(k, 0) + 1
    repeats = [(k, c) for k, c in counts.items() if c >= 2]
    if not repeats:
        # Title was a chorus line
        t = norm(clean_native_title(title))
        if t and any(norm(ln["n"]) == t or t in norm(ln["n"]) for ln in lines):
            chorus_lines = [line_obj(clean_native_title(title))]
            body = [ln for ln in lines if norm(ln["n"]) != norm(chorus_lines[0]["n"])]
            if not body:
                return sections, False
            # Split body into groups of 3 (common stanza shape in bolo…)
            verses = []
            for j in range(0, len(body), 3):
                verses.append({"type": "verse", "label": "Verse", "lines": body[j : j + 3]})
            secs = verses[:1] + [{"type": "chorus", "label": "Chorus", "lines": chorus_lines}] + verses[1:]
            return relabel_verses(secs), True
        return sections, False

    repeats.sort(key=lambda x: (-x[1], -len(x[0])))
    chorus_text = repeats[0][0]
    chorus_lines = [line_obj(next(ln["n"] for ln in lines if norm(ln["n"]) == chorus_text))]
    # Build verses from non-chorus runs
    verses: list[list[dict]] = []
    cur: list[dict] = []
    for ln in lines:
        if norm(ln["n"]) == chorus_text:
            if cur:
                verses.append(cur)
                cur = []
            continue
        cur.append(ln)
    if cur:
        verses.append(cur)
    if not verses:
        return sections, False
    secs = [{"type": "verse", "label": "Verse", "lines": v} for v in verses]
    # Insert chorus after first verse
    secs[1:1] = [{"type": "chorus", "label": "Chorus", "lines": chorus_lines}]
    return relabel_verses(secs), True


def restructure(song: dict) -> tuple[dict, list[str]]:
    notes: list[str] = []
    title_n = song.get("title", {}).get("native", "")
    cleaned_title = clean_native_title(title_n)
    if cleaned_title != title_n:
        song.setdefault("title", {})["native"] = cleaned_title
        notes.append("title")

    sections = song.get("sections") or []
    flag = bool(song.get("display", {}).get("chorusAfterEachVerse"))

    sections, changed = dedupe_repeated_choruses(sections)
    if changed:
        flag = True
        notes.append("dedupe-chorus")

    sections, changed = split_oversized_chorus(sections)
    if changed:
        # After peel, repeating between stanzas is likely
        flag = True
        notes.append("split-fat-chorus")

    sections, changed = split_single_blob(sections, cleaned_title)
    if changed:
        flag = True
        notes.append("split-blob")

    # Drop exact duplicate chorus sections still left
    seen_c: set[str] = set()
    pruned: list[dict] = []
    for s in sections:
        if s["type"] in ("chorus", "refrain"):
            k = chorus_key(s)
            if k in seen_c:
                flag = True
                notes.append("drop-dup-chorus")
                continue
            seen_c.add(k)
        pruned.append(s)
    sections = relabel_verses(pruned)

    # Guard: do not inject chorus after a wall-of-text verse (broken Present).
    if flag:
        verse_lens = [len(s.get("lines") or []) for s in sections if s["type"] == "verse"]
        if verse_lens and max(verse_lens) >= 10:
            flag = False
            notes.append("flag-off-mega-verse")

    song["sections"] = sections
    song["display"] = {"chorusAfterEachVerse": flag}
    return song, notes


def main() -> None:
    changed_files = 0
    flagged = 0
    for path in sorted(SONGS.glob("*.json")):
        raw = path.read_text(encoding="utf-8")
        song = json.loads(raw)
        before = json.dumps(song, ensure_ascii=False, sort_keys=True)
        song, notes = restructure(song)
        after = json.dumps(song, ensure_ascii=False, sort_keys=True)
        if before == after:
            continue
        # Pretty-print like existing content (2-space)
        path.write_text(json.dumps(song, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        changed_files += 1
        if song.get("display", {}).get("chorusAfterEachVerse"):
            flagged += 1
        print(f"{path.name}: {', '.join(notes) or 'touch'}")
    print(f"\nUpdated {changed_files} files; chorusAfterEachVerse true on {flagged} of those.")


if __name__ == "__main__":
    main()
