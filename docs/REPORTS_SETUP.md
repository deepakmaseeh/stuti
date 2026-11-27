# Report a mistake → Google Form → Sheet

Stuti Songs does not send church members to GitHub. Reports go:

**App (same Report UI) → Cloudflare Worker `/api/report` → Google Form `formResponse` → linked Sheet.**

Users never open a Google Form page. Tap Send stays inside Stuti.

## 1. Google Form

1. Sign in as the church Google account → [forms.google.com](https://forms.google.com) → blank form.
2. Title: **Stuti Songs – Corrections**.
3. Add **Short answer** questions with these **exact titles** (order does not matter):

| Question title   | Maps from app field |
|------------------|---------------------|
| Report ID        | `id`                |
| Status           | always `New`        |
| Book             | `book`              |
| Number           | `no`                |
| Title            | `title`             |
| Layer            | `layer`             |
| Stanza           | `stanzaLabel`       |
| Line             | `lineIndex` (+1)    |
| What's wrong     | `kind` (label)      |
| Current text     | `current`           |
| Correct text     | `suggested`         |
| Note             | `note`              |
| Name             | `name`              |
| Church           | `church`            |
| Contact          | `contact`           |
| App version      | `appVersion`        |
| Data version     | `dataVersion`       |
| Page URL         | `url`               |

4. **Responses** → Link to Sheets → choose **Stuti Songs – Corrections** (or create a new sheet).
5. **Send** → ⋮ → **Get pre-filled link** → fill dummy values → copy the URL.
6. From that URL note:
   - Action: `https://docs.google.com/forms/d/e/<FORM_ID>/formResponse` (replace `/viewform` with `/formResponse`)
   - Each `entry.XXXXXXXX` id next to the field it belongs to

## 2. Worker secrets / vars

```bash
npx wrangler secret put GOOGLE_FORM_ACTION_URL
# paste: https://docs.google.com/forms/d/e/XXXX/formResponse

npx wrangler secret put GOOGLE_FORM_ENTRIES
# paste JSON, e.g.
# {"id":"entry.111","status":"entry.222","book":"entry.333","no":"entry.444","title":"entry.555","layer":"entry.666","stanzaLabel":"entry.777","lineIndex":"entry.888","kind":"entry.999","current":"entry.101","suggested":"entry.102","note":"entry.103","name":"entry.104","church":"entry.105","contact":"entry.106","appVersion":"entry.107","dataVersion":"entry.108","url":"entry.109"}
```

Also set `APP_ORIGIN` (wrangler `[vars]`) and optional `REPORT_LIMIT` (20 / 60 s per IP).

No Apps Script. No `SHEET_WEBHOOK_URL` / `SHEET_TOKEN`.

## 3. App behaviour

- Same Report sheet UI; Send → `POST /api/report`.
- Offline or Worker error → queue in IndexedDB; flush when online.
- Until Form secrets are set, reports stay queued locally.
