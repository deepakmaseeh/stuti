## What changed

<!-- One or two sentences. For songs: which book and numbers. -->

## Songs: rights (required when publish is true)

- [ ] Rights status is `public_domain` or `licensed` for every song with `publish: true` (CONTRIBUTING.md, "Rights")
- [ ] `public_domain`: author died 61+ years ago (`author.died`) or `rights.basis` explains why, with a source
- [ ] `licensed`: `rights.holder` and `rights.evidence` filled; the permission letter is stored privately (not in this repo)
- [ ] No lyrics copied from other websites or apps

## Songs: proofreading

- [ ] Original script checked line by line against the printed book (edition and page in `source`)
- [ ] Line breaks follow the book; chorus written once ("Show ↻ Chorus after each verse" if needed)
- [ ] Roman layer follows the spelling rules; layer status is honest (`reviewed` only after a native speaker checked every line)
- [ ] English is meaning, not poetry; unclear lines marked `[?]` and left as `draft`
- [ ] Numbers exactly as printed (e.g. `117a`), every book the song appears in
- [ ] Opened the preview link on a phone and read the song at a large text size

## Code changes

- [ ] `npm run validate`, `npm test`, `npm run build` pass locally
- [ ] No new trackers, analytics, external fonts or CDNs; nothing secret committed
