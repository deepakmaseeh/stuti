# Report a mistake → Google Sheet

Stuti Songs no longer sends church members to GitHub sign-in. Reports go:

**App → Cloudflare Worker `/api/report` → Google Apps Script → Sheet “Stuti Songs – Corrections”.**

## 1. Google Sheet

1. Create a spreadsheet named **Stuti Songs – Corrections**.
2. Tab name: `Reports`.
3. Header row:

`Received | Report ID | Status | Book | No. | Title | Layer | Stanza | Line | What's wrong | Current text | Correct text | Note | Name | Church | Contact | App ver | Data ver | Link | Fixed by | Fixed on | Reviewer note`

4. Status column validation: New · Checking · Fixed · Not a mistake · Need printed book.

## 2. Apps Script

Extensions → Apps Script. Set script property `TOKEN` to a long random string. Deploy → Web app → Execute as **Me**, access **Anyone**.

```js
const TOKEN = PropertiesService.getScriptProperties().getProperty('TOKEN');
function doPost(e) {
  const d = JSON.parse(e.postData.contents);
  if (d.token !== TOKEN) return ContentService.createTextOutput('denied');
  const sh = SpreadsheetApp.getActive().getSheetByName('Reports');
  const ids = sh.getRange(2, 2, Math.max(sh.getLastRow() - 1, 1), 1).getValues().flat();
  if (ids.includes(d.id)) return ContentService.createTextOutput('dup');
  const kind = {
    spelling: 'Spelling',
    words: 'Wrong words',
    missing: 'Missing line/verse',
    order: 'Wrong order',
    number: 'Wrong hymn number',
    roman: 'Roman',
    english: 'English',
    other: 'Other',
  }[d.kind] || d.kind;
  sh.appendRow([
    new Date(), d.id, 'New', d.book || '', d.no || '', d.title, d.layer || '',
    d.stanzaLabel || '', (d.lineIndex ?? '') === '' ? '' : d.lineIndex + 1,
    kind, d.current || '', d.suggested || '', d.note || '',
    d.name || '', d.church || '', d.contact || '',
    d.appVersion, d.dataVersion, d.url, '', '', '',
  ]);
  return ContentService.createTextOutput('ok');
}
```

## 3. Worker secrets

On the same Worker that serves the site (or a dedicated report Worker):

- `SHEET_WEBHOOK_URL` — Apps Script `/exec` URL  
- `SHEET_TOKEN` — same as script property `TOKEN`  
- Optional `GITHUB_TOKEN` — server-side issue create only  
- `APP_ORIGIN` — CORS allowlist  
- Rate limit binding `REPORT_LIMIT` — 20 / 60 s per IP  

Route `POST /api/report` as in `STUTI_MASTER_SPEC.md` §17.

Until the Worker is wired, the app **queues reports in IndexedDB** and does not open GitHub for the user.
