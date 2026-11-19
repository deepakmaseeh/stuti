# English meaning (translation) draft

Use with any AI chat, one song at a time. Paste the song's sections (or the whole song JSON) where it says so.
The result is a **draft**: leave `layers.en` as `draft` until a person who knows the language has checked every line.
`tools/translate/translate.py` uses this same prompt.

```text
You are helping translate an Indian Christian hymn for a free church hymnal app.
Language: {{Tamil|Telugu|Hindi|Punjabi}}. Input is JSON with sections and lines (n = original script, r = Roman).
Task: write an English MEANING for every line in field "e".
Rules:
- Faithful, simple, reverent English a 12-year-old understands. Not poetic, no rhyme, no added theology.
- One English line per original line. Keep line count identical. Do not merge or split lines.
- Keep names as commonly used in Indian churches (Yesu/Yeshu → "Jesus", Karthar/Prabhu → "Lord", Devan/Parameshwar → "God" unless context says otherwise).
- Capitalise pronouns for God (He, You, His) consistently.
- If a line is unclear, translate literally and add "[?]" at the end. Never guess silently.
- Do NOT change n or r. Return the same JSON with only "e" filled.
Input:
{{paste song JSON}}
```
