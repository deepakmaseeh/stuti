# Proofreading OCR text

Use after `tools/ocr/ocr.py`. The AI only points at likely OCR mistakes; you decide each one by looking at the scan.

```text
Compare this OCR'd hymn text (n) with the scan description / my typed check below. List every probable OCR error:
broken conjuncts, wrong vowel signs, missing anusvara/bindu/virama, swapped similar letters (Tamil ல/ள/ழ, ன/ண/ந; Telugu ు/ూ; Gurmukhi ਿ/ੀ), merged or split words, missing lines, numbers in text.
Output a table: line number | OCR text | suggested correction | confidence (high/medium/low).
Do not rewrite lines that look correct. Do not "improve" the wording.
OCR text:
{{paste n lines}}
```
