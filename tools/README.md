# Content tools

Python helpers for digitising hymnbooks (spec §15.2, §16). They are **not** needed to build or run the app.
Every tool writes **drafts only**: `rights.status: permission_pending`, `publish: false`. Nothing they produce is
published until a person proofreads it and the rights are checked (CONTRIBUTING.md).

```bash
python -m venv .venv && .venv/Scripts/activate      # macOS/Linux: source .venv/bin/activate
pip install -r tools/requirements.txt
python -m unittest discover tools/tests              # quick self-check (no extra packages needed)
```

Every tool has `--help` and `--dry-run` (prints what it would do, writes nothing).

## OCR: `tools/ocr/ocr.py`

Scanned pages → one draft JSON per song, in `tools/ocr/out/<lang>/` (git-ignored).

```bash
python tools/ocr/ocr.py --lang ta --book KK --images "scans/kk/*.jpg" --dry-run
python tools/ocr/ocr.py --lang ta --book KK --images "scans/kk/*.jpg"
```

- Needs **Tesseract 5** with `hin`, `tam`, `tel`, `pan` traineddata (`tessdata_best` reads Indian scripts better).
- A new song starts at a line like `117.` or `117)` (Indian digits work too). Blank lines and printed headings
  (Pallavi, Charanam, Chorus, कोरस, टेक …) split sections.
- Prints low-confidence words for each page: check those against the scan first (`docs/prompts/proofread.md`).
- Drafts are named `<book>-<number>.json`. Give each a proper URL name (Roman title) when you move it into
  `src/content/songs/<lang>/`.
- Keep scans **outside** this public repo (e.g. a private Drive folder); `source.scan` holds the file name.

## Roman layer: `tools/translit/translit.py`

Fills empty `r` lines (and `title.roman`) from the original script with Aksharamukha, then applies the
church-spelling rules in `tools/translit/rules/<lang>.json`.

```bash
python tools/translit/translit.py "src/content/songs/hi/*.json" --dry-run
python tools/translit/translit.py "src/content/songs/hi/*.json"            # only empty lines
python tools/translit/translit.py src/content/songs/hi/x.json --overwrite  # redo every line
```

- Sets `layers.roman` to `draft`. Never touches `n` or `e`.
- Hindi/Punjabi: the silent final "a" is dropped (naam, not naama), except one-letter words (na); a final
  nasal is written "n" (main, gaaoon).
- The output is close but not perfect (e.g. "usake" where people write "uske"). A native speaker reviews
  every line; `docs/prompts/transliterate.md` helps.
- Add a spelling to the rules file when the same fix comes up again and again. Rules are regular expressions
  applied in order to the lowercase output.

## Form import: `tools/import/sheet_to_json.py`

Google Form responses (File → Download → CSV) → draft songs in `src/content/songs/<lang>/`.

```bash
python tools/import/sheet_to_json.py responses.csv --dry-run
python tools/import/sheet_to_json.py responses.csv
```

- Columns: Timestamp, Name, Language, Book, Number, Title, Lyrics, Source/Permission, Email.
- Rows without a language, book, number, title or lyrics are skipped with a reason.
- **Never overwrites**: an existing song gets a `<slug>.new.json` next to it to compare by hand.
- The submitter's name and email are **not** copied into the repo (it is public). Keep the Sheet private.
- Then run `npm run validate` and proofread in the CMS.

## English meaning draft: `tools/translate/translate.py` (optional)

Sends one song at a time to an AI model with the prompt in `docs/prompts/translate.md`, and fills empty `e`
lines. You can do the same by hand in any AI chat with that prompt.

```bash
python tools/translate/translate.py "src/content/songs/ta/*.json" --dry-run    # shows the prompt only
$env:STUTI_AI_KEY = "..."                                                        # PowerShell; never commit it
python tools/translate/translate.py src/content/songs/ta/x.json --model <model-name>
```

- Works with any OpenAI-compatible API (`--base-url` or `STUTI_AI_BASE_URL`).
- Rejects answers that change the number of lines. Sets `layers.en` to `draft`.
- The key is read from the environment only. Don't put it in `.env` files that could be committed.
