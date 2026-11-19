# Contributing to Stuti

Thank you for helping. Stuti is used in church services, so **accuracy and permission come first**.

## Ways to help

- **Found a mistake?** Tap "Report a mistake" under any song in the app. No account needed.
- **Missing song?** Use "Report a missing song" in search, or the Google Form your church shares.
- **Editing songs** (editors with access): use the editor at `/admin` (below).
- **Code**: open an issue first for anything bigger than a small fix.

## Editing songs in the CMS (`/admin`)

1. Open `https://<site>/admin/` and log in with GitHub. Your GitHub account needs write access to the repo.
2. Pick a collection (Books, or Songs · Hindi / Tamil / Telugu / Punjabi / English).
3. Every save creates a **draft pull request**. Move it to _In review_ when you are done, and _Ready_ when the
   language moderator has approved it.
4. Each pull request gets a **preview link** from Cloudflare Pages. Open it on your phone and read the song at a
   large text size before approving.
5. After merge, the live site updates in about two minutes. Downloaded books show "Update available".

The **URL name** (`slug`) becomes the song's address, e.g. `/song/ta-yesuve-en-thunai/`. Use the Roman title in
lowercase with hyphens, and **never change it after publishing**: shared links and set lists would break.

### Trying the CMS on your own computer

```bash
npm ci
npx decap-server        # terminal 1: lets the CMS read and write files in this folder
npm run dev             # terminal 2
```

Then open `http://localhost:4321/admin/`. Changes are written straight to your files (no pull request).

### Starting a song from the command line

```bash
npm run new-song                       # asks for language, book, number, title and the first verse
npm run new-song -- --help             # all options, including --dry-run
```

It writes a draft (`permission_pending`, not published) that already passes `npm run validate`, then you add the
other verses in the CMS or a text editor. For digitising a whole book, see [`tools/README.md`](tools/README.md).

## Style rules

1. **Accuracy first.** The printed book (edition stated in Book) is the reference. Don't modernise wording.
2. **One line = one sung line.** Follow the printed line breaks.
3. **Section labels:** use what the book uses (Pallavi / Anupallavi / Charanam, Chorus, Verse 1, टेक/कोरस).
   Type = chorus for any repeated refrain.
4. **Chorus repeats:** write the chorus once; enable "Show ↻ Chorus after each verse" instead of duplicating text.
5. **Roman layer:** follow [`docs/prompts/transliterate.md`](docs/prompts/transliterate.md). Consistency matters
   more than perfection: same word, same spelling across the whole book.
6. **English layer:** meaning, not poetry ([`docs/prompts/translate.md`](docs/prompts/translate.md)). Mark unclear
   lines with `[?]` and leave the layer status as draft.
7. **Status honesty:** set layers to `reviewed` only after a native speaker has checked every line.
8. **Numbers:** exactly as printed, including letters (117a). Add every book this song appears in.
9. **Aliases:** add common alternate titles and spellings people search for (first words of chorus, popular names).
10. **Never** copy lyrics from other websites or apps. Source = a printed book scan you are allowed to use, or
    written permission.
11. **Rights:** fill the rights section before switching Publish on (below). If unsure → `permission_pending`.
12. **Review on phone:** open the pull request preview link on your phone and read the song at size A+ before
    approving.

## Rights: publish only if one of these is true

| Status               | When                                                                                                                                                          | Required fields                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `public_domain`      | Author died ≥ 61 years ago (India: life + 60 years, counted from the year after death), or anonymous/traditional with publication ≥ 61 years ago and evidence | `author.died`, or `rights.basis` with the source                                                |
| `licensed`           | Written permission from the author/heirs/publisher/ministry covering: web + app display, offline storage, transliteration, translation, sharing links         | `rights.holder`, `rights.evidence` (stored privately; reference only), `checkedBy`, `checkedOn` |
| `permission_pending` | Default for every new song                                                                                                                                    | none; **never published**                                                                       |
| `rejected`           | Permission refused / takedown                                                                                                                                 | **never published**; keep the file for history or delete it                                     |
| `demo`               | Prototype text written by the team                                                                                                                            | published only while `PUBLIC_INCLUDE_DEMO=true` (remove at real launch)                         |

The build **refuses** to publish anything else: `npm run validate` fails, and so does the pull request check.

- Translations and transliterations of a protected lyric need permission too.
- A **new edition** of an old hymnbook can contain new copyrighted material (new songs, revised wording,
  translations). Check each song, not the book.
- Bible text: only openly licensed translations (e.g. Hindi IRV, CC BY-SA 4.0). BSI texts need permission.
- **Takedown:** the About page shows a contact email. On a valid request set `rights.status: rejected` and
  `publish: false`, and deploy within 48 hours.
- Permission letters and scans stay **outside** this public repository. `rights.evidence` and `source.scan` only
  name where they are kept.
- This is not legal advice. Get a lawyer's review before adding modern songs at scale.

## Review checklist (moderators)

The pull request template lists it: rights, proofreading against the scan, layer status, numbers, phone preview.
Language folders have owners in [`.github/CODEOWNERS`](.github/CODEOWNERS).

## Code contributions

- Node 22+. `npm ci`, then `npm run dev`. Before a pull request: `npm run validate`, `npm test`, `npm run build`,
  `npm run test:e2e`.
- No analytics, ads, trackers, external fonts or CDNs. No secrets in the repo.
- Song text is shown as plain text only; never render content as HTML.
