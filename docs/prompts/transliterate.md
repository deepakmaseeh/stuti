# Transliteration review

Use after `tools/translit/translit.py` (or for hand-typed Roman lines) to bring spellings in line with how people
actually type and sing. A native speaker still checks the result before `layers.roman` becomes `reviewed`.

```text
Review the Roman transliteration ("r") of this {{language}} Christian hymn for an Indian church app.
Goal: how ordinary believers would TYPE and SING it in Roman letters (WhatsApp style), not academic ISO.
Rules:
- No diacritics. Use common spellings: aa for long a only where people usually write it (e.g. "aaradhana"), ee/oo for long i/u where common.
- Tamil: ழ → "zh", ள/ல → "l", ண/ன/ந → "n", ற → "r"; keep church spellings (Yesu, Karthar, Devan, Sthothiram).
- Hindi/Punjabi: drop the silent final "a" (Yeshu, Prabhu, mera, not merA); ं → "n"/"m" as spoken.
- Telugu: keep final "u" (velugu), "aa" for long a in names as commonly written (Yesayya).
- Keep punctuation and capitalise the first word of each line.
- One Roman line per original line. Do not touch "n" or "e".
Return the same JSON with corrected "r" and a short list of changes you made.
Input:
{{paste song JSON}}
```
