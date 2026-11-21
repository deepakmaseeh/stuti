"""Convert legacy PDF songbooks to clean Unicode Markdown (.md) files.

Features:
1. ccf-hindi-song-book.pdf -> ccf-hindi-song-book.md:
   - Span-aware font detection: converts Shivaji01 to clean Devanagari Hindi,
     while keeping genuine English lyrics (e.g. 'He is Lord', 'Jesus Power') in English.
   - Filters out floating margin labels (P1, W1, S1 etc.).
   - Stanza-wise formatting with empty line gaps between stanzas.
   - Preserves original pauses, ellipses (…), and punctuation.
   - Complete Table of Contents (Praise 1-104, Worship 1-35, Dedication 1-10).

2. 147343845-sunday-school-song-lyrics.pdf -> 147343845-sunday-school-song-lyrics.md:
   - True 2-column reading order.
   - Stanza-wise formatting with verse breaks and line gaps.
   - Removes raw box glyphs.
"""

from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path
import fitz  # PyMuPDF

ROOT = Path(__file__).resolve().parents[2]
SHIVAJI_JS = ROOT / "tools" / "import" / "shivaji_converter.cjs"


def batch_convert_shivaji(text_list: list[str]) -> list[str]:
    """Convert a list of Shivaji font text strings to Unicode Devanagari via Node.js."""
    if not text_list:
        return []
    node_script = """
const { convertShivajiText } = require('./tools/import/shivaji_converter.cjs');
const fs = require('fs');

let input = JSON.parse(fs.readFileSync(0, 'utf-8'));
let output = input.map(s => {
  let res = convertShivajiText(s);
  // Post-clean common typewriter artifacts in lyrics
  res = res.replace(/प्रोमी/g, 'प्रेमी');
  res = res.replace(/प्रोम/g, 'प्रेम');
  res = res.replace(/प्राभु/g, 'प्रभु');
  res = res.replace(/प्राीत/g, 'प्रीत');
  res = res.replace(/मक्ति/g, 'मुक्ति');
  res = res.replace(/आनेवला/g, 'आनेवाला');
  res = res.replace(/गाऔ/g, 'गाओ');
  res = res.replace(/खुन/g, 'खून');
  res = res.replace(/बिगाडी/g, 'बिगड़ी');
  res = res.replace(/सॄष्टि/g, 'सृष्टि');
  return res;
});
process.stdout.write(JSON.stringify(output));
"""
    p = subprocess.run(
        ["node", "-e", node_script],
        input=json.dumps(text_list),
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    if p.returncode != 0:
        raise RuntimeError(f"Shivaji converter failed: {p.stderr}")
    return json.loads(p.stdout)


def is_ccf_floating_header(b) -> bool:
    """Check if block is the floating margin header (P1, W1, S1 etc.)."""
    t = b.get("text", "").strip()
    bbox = b.get("bbox", (0, 0, 0, 0))
    return bool(bbox[0] > 60 and len(t) <= 6 and any(t.startswith(c) for c in ["P", "W", "S"]) and any(c.isdigit() for c in t))


def process_ccf_hindi_songbook(pdf_path: Path, out_path: Path) -> dict:
    doc = fitz.open(str(pdf_path))
    print(f"Loaded {pdf_path.name}: {len(doc)} pages")

    # 1. Parse Table of Contents from Pages 1 to 6
    toc_entries = []  # (category, num, raw_title)
    for p_num in range(6):
        lines = [ln.strip() for ln in doc[p_num].get_text().splitlines() if ln.strip()]
        i = 0
        while i < len(lines):
            ln = lines[i]
            if i + 1 < len(lines) and re.match(r"^[PWS]\d+$", lines[i + 1]):
                code = lines[i + 1]
                cat = "Stuti" if code.startswith("P") else ("Aradhana" if code.startswith("W") else "Samarpan")
                num = int(re.search(r"\d+", code).group(0))
                toc_entries.append((cat, num, ln))
                i += 2
            elif re.search(r"\b([PWS]\d+)\b", ln):
                m = re.search(r"\b([PWS]\d+)\b", ln)
                code = m.group(1)
                title = ln.replace(code, "").strip()
                cat = "Stuti" if code.startswith("P") else ("Aradhana" if code.startswith("W") else "Samarpan")
                num = int(re.search(r"\d+", code).group(0))
                toc_entries.append((cat, num, title))
                i += 1
            else:
                i += 1

    # Convert TOC titles to clean Hindi
    raw_titles = [e[2] for e in toc_entries]
    converted_titles = batch_convert_shivaji(raw_titles)

    stuti_toc = []
    aradhana_toc = []
    samarpan_toc = []

    for (cat, num, _), t_u in zip(toc_entries, converted_titles):
        clean_t = t_u.strip().strip("….").strip()
        row = f"| {num} | {clean_t} |"
        if cat == "Stuti":
            stuti_toc.append((num, row))
        elif cat == "Aradhana":
            aradhana_toc.append((num, row))
        else:
            samarpan_toc.append((num, row))

    stuti_toc.sort(key=lambda x: x[0])
    aradhana_toc.sort(key=lambda x: x[0])
    samarpan_toc.sort(key=lambda x: x[0])

    toc_md = f"""### स्तुति गायन सूची (Praise Songs Index)

| क्र. | गीत का शीर्षक |
| :---: | :--- |
{chr(10).join(r[1] for r in stuti_toc)}

### आराधना गायन सूची (Worship Songs Index)

| क्र. | गीत का शीर्षक |
| :---: | :--- |
{chr(10).join(r[1] for r in aradhana_toc)}

### समर्पण गायन सूची (Dedication Songs Index)

| क्र. | गीत का शीर्षक |
| :---: | :--- |
{chr(10).join(r[1] for r in samarpan_toc)}
"""

    # 2. Extract song stanzas from Pages 7 to 92 with span-aware font detection
    # We collect all spans that need Shivaji conversion
    raw_blocks_data = []

    for p_num in range(6, len(doc)):
        page = doc[p_num]
        d = page.get_text("dict")

        for b in d["blocks"]:
            if "lines" not in b:
                continue
            # Check floating header
            block_plain_text = "".join(s["text"] for l in b["lines"] for s in l["spans"]).strip()
            if is_ccf_floating_header({"text": block_plain_text, "bbox": b["bbox"]}):
                continue

            # Build lines for this block
            block_lines = []
            for l in b["lines"]:
                line_spans = []
                for s in l["spans"]:
                    t = s["text"]
                    if not t:
                        continue
                    font = s["font"]
                    is_shivaji = "Shivaji" in font
                    line_spans.append({"text": t, "is_shivaji": is_shivaji})
                if line_spans:
                    block_lines.append(line_spans)

            if block_lines:
                raw_blocks_data.append((p_num + 1, b["bbox"][1], block_lines))

    # Sort blocks by page and vertical y0
    raw_blocks_data.sort(key=lambda x: (x[0], x[1]))

    # Collect all Shivaji spans for batch conversion
    all_shivaji_snippets = []
    for _, _, blk in raw_blocks_data:
        for line in blk:
            for sp in line:
                if sp["is_shivaji"]:
                    # Fix known typo on page 72: 'gaayanaM naM 4.11' -> 'AaraQanaa gaayanaM naM 11'
                    txt = sp["text"]
                    if "gaayanaM naM 4.11" in txt:
                        txt = txt.replace("gaayanaM naM 4.11", "AaraQanaa gaayanaM naM 11")
                    sp["text"] = txt
                    all_shivaji_snippets.append(txt)

    converted_snippets = batch_convert_shivaji(all_shivaji_snippets)

    # Reassemble blocks with converted Hindi text and untouched English text
    snip_idx = 0
    final_stanzas = []

    for _, _, blk in raw_blocks_data:
        stanza_lines = []
        for line in blk:
            line_str = ""
            for sp in line:
                if sp["is_shivaji"]:
                    line_str += converted_snippets[snip_idx]
                    snip_idx += 1
                else:
                    line_str += sp["text"]
            stanza_lines.append(line_str)
        stanza_text = "\n".join(stanza_lines).strip()
        if stanza_text:
            final_stanzas.append(stanza_text)

    # Group stanzas into individual songs
    songs = []
    current_song = None

    for st in final_stanzas:
        lines = st.splitlines()
        first_line = lines[0].strip()

        m = re.match(r"^(स्तुति|आराधना|समर्पण)\s*गायनं?\s*नं?\s*(\d+)", first_line)
        if m:
            if current_song:
                songs.append(current_song)
            cat_name = m.group(1)
            song_num = int(m.group(2))
            rest_of_stanza = "\n".join(lines[1:]).strip()

            current_song = {
                "header": f"## {cat_name} गायन नं {song_num}",
                "stanzas": [rest_of_stanza] if rest_of_stanza else [],
            }
        else:
            if current_song:
                current_song["stanzas"].append(st)

    if current_song:
        songs.append(current_song)

    # Format songs into Markdown
    formatted_songs = []
    for s in songs:
        song_text = s["header"] + "\n\n" + "\n\n".join(s["stanzas"])
        formatted_songs.append(song_text)

    songs_body = "\n\n---\n\n".join(formatted_songs)

    final_md = f"""# CCF Hindi Song Book (सी.सी.एफ. हिंदी गीत पुस्तक)

> **संग्रह:** क्रिश्चियन कम्युनिटी फेलोशिप (CCF), अंबरनाथ सभा  
> **कुल गीत:** {len(songs)} गीत (स्तुति: {len(stuti_toc)}, आराधना: {len(aradhana_toc)}, समर्पण: {len(samarpan_toc)})  
> **लिपि:** शुद्ध देवनागरी यूनिकोड (UTF-8)  
> **प्रारूप:** मूल पुस्तक के अनुसार अंतरा-वार (Stanza-wise) पंक्तियाँ, विराम-चिह्न एवं पद विन्यास  

---

## विषय सूची (Table of Contents)

{toc_md}

---

# संपूर्ण गीत संग्रह (Song Lyrics)

{songs_body}
"""

    out_path.write_text(final_md, encoding="utf-8")
    print(f"Wrote {out_path} ({len(final_md)} chars, {len(songs)} songs)")
    return {"pages": len(doc), "songs_count": len(songs), "size": len(final_md)}


def get_page_blocks_2col(page) -> list[str]:
    """Extract page blocks in true 2-column reading order (Col 1 then Col 2)."""
    blocks = page.get_text("blocks")
    col1 = [b for b in blocks if b[0] < 300 and b[4].strip()]
    col2 = [b for b in blocks if b[0] >= 300 and b[4].strip()]
    col1.sort(key=lambda b: b[1])
    col2.sort(key=lambda b: b[1])
    return [b[4].strip() for b in (col1 + col2)]


def decode_telugu_pua_to_ascii(text: str) -> str:
    """Translate PUA codepoints (0xF000..0xF0FF) to their base ASCII equivalents."""
    res = []
    for ch in text:
        code = ord(ch)
        if 0xF000 <= code <= 0xF0FF:
            res.append(chr(code - 0xF000))
        else:
            res.append(ch)
    return "".join(res)


def process_sunday_school_lyrics(pdf_path: Path, out_path: Path) -> dict:
    doc = fitz.open(str(pdf_path))
    print(f"Loaded {pdf_path.name}: {len(doc)} pages")

    # Front matter from page 1
    p1_text = doc[0].get_text().strip()

    # Collect blocks from pages 3-28 in 2-column order
    all_blocks = []
    for p_num in range(2, len(doc)):
        all_blocks.extend(get_page_blocks_2col(doc[p_num]))

    # Group by song
    songs = []
    current_song = None

    for blk in all_blocks:
        lines = blk.splitlines()
        first_line = lines[0].strip()

        m = re.match(r"^Song\s*[-–]\s*(\d+)", first_line, re.IGNORECASE)
        if m:
            if current_song:
                songs.append(current_song)
            num = int(m.group(1))
            rest = "\n".join(lines[1:]).strip()
            current_song = {
                "num": num,
                "header": f"## Song {num}",
                "stanzas": [rest] if rest else [],
            }
        else:
            if current_song:
                current_song["stanzas"].append(blk.strip())

    if current_song:
        songs.append(current_song)

    # Build TOC and formatted songs
    toc_rows = []
    formatted_songs = []

    for s in songs:
        num = s["num"]
        clean_stanzas = []
        first_line = ""

        for st in s["stanzas"]:
            # If stanza has PUA characters, decode to ASCII / text representation
            if any(0xF000 <= ord(c) <= 0xF0FF for c in st):
                decoded_st = decode_telugu_pua_to_ascii(st)
                clean_stanzas.append(decoded_st)
            else:
                clean_stanzas.append(st)
                if not first_line and st.strip():
                    first_line = st.strip().splitlines()[0]

        if first_line:
            title = re.sub(r"^\d+[\.\)]\s*", "", first_line)
            title = re.sub(r"\s*\(\d+\)\s*$", "", title).strip()
            if len(title) > 60:
                title = title[:60] + "…"
        else:
            title = "Regional / Telugu Song"

        toc_rows.append(f"| {num} | {title} |")
        song_content = f"## Song {num}: {title}\n\n" + "\n\n".join(clean_stanzas)
        formatted_songs.append(song_content)

    toc_md = (
        "| No. | Song Title |\n"
        "| :---: | :--- |\n" + "\n".join(toc_rows)
    )

    songs_body = "\n\n---\n\n".join(formatted_songs)

    final_md = f"""# Sunday School Song Lyrics

> **Publisher:** Jehovah Jireh Prayer House  
> **Scripture:** Exodus 15:1 — *"I will sing to the lord, for he is highly exalted"*  
> **Total Songs:** {len(songs)} Songs (English & Regional Hymns)  
> **Formatting:** Stanza-wise with verse breaks, line gaps, and authentic punctuation  

---

## Front Matter

```text
{p1_text}
```

---

## Index of Songs

{toc_md}

---

# Songs Collection

{songs_body}
"""

    out_path.write_text(final_md, encoding="utf-8")
    print(f"Wrote {out_path} ({len(final_md)} chars, {len(songs)} songs)")
    return {"pages": len(doc), "songs_count": len(songs), "size": len(final_md)}


def main() -> None:
    ccf_pdf = ROOT / "ccf-hindi-song-book.pdf"
    ccf_out = ROOT / "ccf-hindi-song-book.md"

    ss_pdf = ROOT / "147343845-sunday-school-song-lyrics.pdf"
    ss_out = ROOT / "147343845-sunday-school-song-lyrics.md"

    print("=== Converting CCF Hindi Song Book ===")
    r1 = process_ccf_hindi_songbook(ccf_pdf, ccf_out)

    print("\n=== Converting Sunday School Song Lyrics ===")
    r2 = process_sunday_school_lyrics(ss_pdf, ss_out)

    print("\n=== Done ===")
    print(f"1. {ccf_out.name}: {r1['size']:,} bytes ({r1['songs_count']} songs)")
    print(f"2. {ss_out.name}: {r2['size']:,} bytes ({r2['songs_count']} songs)")


if __name__ == "__main__":
    main()
