"""Tests for the content tools' pure logic. Run: python -m unittest discover tools/tests
No Tesseract, Aksharamukha or network needed."""

from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path

TOOLS = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(TOOLS))

import stuti_common as C  # noqa: E402


def load(rel: str):
    path = TOOLS / rel
    spec = importlib.util.spec_from_file_location(path.stem, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


ocr = load("ocr/ocr.py")
translit = load("translit/translit.py")
sheet = load("import/sheet_to_json.py")
translate = load("translate/translate.py")


class Common(unittest.TestCase):
    def test_slugify(self):
        self.assertEqual(C.slugify("Yesuve En Thunai!"), "yesuve-en-thunai")
        self.assertEqual(C.slugify("Prabhū Yeśu"), "prabhu-yesu")
        self.assertEqual(C.slugify("இயேசுவே"), "")

    def test_split_sections_labels_and_verses(self):
        text = "பல்லவி\nஇயேசுவே என் துணை\nஇருளில் என் ஒளி\n\nவழி தெரியாத\nஎன் கரம்\n\nசரணம்:\nகாலையும்"
        secs = C.split_sections(text)
        self.assertEqual([(s["type"], s["label"], len(s["lines"])) for s in secs],
                         [("chorus", "Pallavi", 2), ("verse", "Verse 1", 2), ("verse", "Charanam", 1)])

    def test_write_new_never_overwrites(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "x.json"
            p.write_text("{}", encoding="utf-8")
            out = C.write_new(p, {"a": 1}, dry_run=False)
            self.assertEqual(out.name, "x.new.json")
            self.assertEqual(p.read_text(encoding="utf-8"), "{}")


class Ocr(unittest.TestCase):
    def test_split_songs_by_number_including_tamil_digits(self):
        text = "117. இயேசுவே என் துணை\nஇருளில் என் ஒளி\n\n௧௧௮) புதிய பாடல்\nவரி"
        self.assertEqual([n for n, _ in ocr.split_songs(text)], ["117", "118"])

    def test_parse_page_text_makes_unpublished_drafts(self):
        songs = ocr.parse_page_text("117. இயேசுவே என் துணை\nஇருளில் என் ஒளி", lang="ta", book="KK",
                                    scan="p1.jpg", today="2026-11-19")
        self.assertEqual(len(songs), 1)
        s = songs[0]
        self.assertEqual(s["numbers"], [{"book": "KK", "number": "117"}])
        self.assertEqual(s["title"]["native"], "இயேசுவே என் துணை")
        self.assertFalse(s["publish"])
        self.assertEqual(s["rights"]["status"], "permission_pending")
        self.assertEqual(s["source"]["scan"], "p1.jpg")


class Translit(unittest.TestCase):
    def test_prepare_drops_final_schwa_but_not_one_letter_words(self):
        out = translit.prepare("जब राह न सूझे", "hi")
        self.assertIn("राह\u094D", out)
        self.assertIn(" न ", out)

    def test_prepare_final_nasal_becomes_n(self):
        self.assertTrue(translit.prepare("गाऊं", "hi").endswith("\u0928\u094D"))

    def test_readable_removes_markers_and_applies_rules(self):
        # Real Aksharamukha output for the Tamil demo song.
        rules = translit.load_rules("ta")
        self.assertEqual(translit.readable("Iyechuve e'n thunai neere", rules), "Yesuve en thunai neere")
        self.assertEqual(translit.readable("vazhi the'riyaatha neraththil", rules), "Vazhi theriyaatha nerathil")

    def test_fill_song_only_missing_and_marks_draft(self):
        song = {"title": {"native": "அ", "roman": "A"},
                "sections": [{"lines": [{"n": "அ", "r": "kept"}, {"n": "ஆ"}]}], "layers": {"roman": "missing"}}
        n = translit.fill_song(song, "ta", lambda t: f"<{t}>", overwrite=False)
        self.assertEqual(n, 1)
        self.assertEqual(song["sections"][0]["lines"][0]["r"], "kept")
        self.assertEqual(song["sections"][0]["lines"][1]["r"], "<ஆ>")
        self.assertEqual(song["layers"]["roman"], "draft")


class Sheet(unittest.TestCase):
    row = {"Language": "Tamil", "Book": "DT", "Number": "200", "Title": "Puthiya Paadal",
           "Lyrics": "வரி ஒன்று\nவரி இரண்டு", "Name": "Someone", "Email": "a@b.c", "Source/Permission": "author"}

    def test_row_to_song_keeps_personal_data_out(self):
        rel, song = sheet.row_to_song(self.row, "2026-11-19")
        self.assertEqual(rel, "ta/puthiya-paadal.json")
        blob = json.dumps(song, ensure_ascii=False)
        self.assertNotIn("a@b.c", blob)
        self.assertNotIn("Someone", blob)
        self.assertFalse(song["publish"])

    def test_row_errors(self):
        self.assertIn("language", sheet.row_to_song({**self.row, "Language": "Klingon"}, "2026-11-19"))
        self.assertIn("book", sheet.row_to_song({**self.row, "Number": ""}, "2026-11-19"))


class Translate(unittest.TestCase):
    song = {"sections": [{"label": "V1", "lines": [{"n": "அ", "r": "a"}, {"n": "ஆ", "r": "aa", "e": "kept"}]}],
            "layers": {"en": "missing"}}

    def test_prompt_comes_from_docs_and_fills_language(self):
        p = translate.build_prompt(self.song, "ta")
        self.assertIn("Language: Tamil.", p)
        self.assertIn('"n": "அ"', p)

    def test_apply_answer_fills_only_empty_lines(self):
        s = json.loads(json.dumps(self.song))
        n = translate.apply_answer(s, {"sections": [{"lines": [{"e": "first"}, {"e": "new"}]}]})
        self.assertEqual(n, 1)
        self.assertEqual([l.get("e") for l in s["sections"][0]["lines"]], ["first", "kept"])
        self.assertEqual(s["layers"]["en"], "draft")

    def test_apply_answer_refuses_changed_line_count(self):
        with self.assertRaises(ValueError):
            translate.apply_answer(json.loads(json.dumps(self.song)), {"sections": [{"lines": [{"e": "x"}]}]})


if __name__ == "__main__":
    unittest.main()
