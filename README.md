# Novel Phoenix

Novel Phoenix is a public NovelFire reading library. Visitors can see the current library, last-read chapter, reading progress, direct novel/chapter links, reading history, and import history. The owner can preview a CSV snapshot locally before publishing a sanitized public data file.

Live site: <https://adeelone.github.io/myReadList/>

## Architecture

- The public site is a static GitHub Pages deployment.
- Public reading data lives in `data/library.json` and is safe to cache, review, and version in Git.
- Browser imports are local drafts stored under `novel-phoenix-v1`; they never overwrite the public site by themselves.
- Import filenames are removed from published snapshots.
- GitHub Actions runs tests, builds the static artifact, and deploys every push to `main`.
- No database, server password, API key, analytics tracker, or browser-side admin token is required.

This repository-backed approach is deliberate: it makes public reads reliable and owner writes secure without exposing credentials in frontend code.

## Export from NovelFire

1. Install Tampermonkey.
2. Create a userscript using `novelfire-readlist.user.js`.
3. Open `https://novelfire.net/account/library` while signed in.
4. Select **Export to Novel Phoenix**.
5. Download the generated CSV.

The exporter scans every library page, fetches author names, preserves NovelFire library order, records the export time, and includes direct novel and last-read chapter URLs. Legacy exports remain supported.

## Publish a new snapshot

### Recommended: one command

From this repository on `main`:

```powershell
npm run publish:snapshot -- "C:\path\to\novel-phoenix-2026-08-12.csv"
```

The command:

1. refuses to run when unrelated files are already staged;
2. converts the CSV into sanitized public JSON;
3. compares it with the current public snapshot and records forward progress;
4. runs the automated tests and production build;
5. commits only `data/library.json`;
6. pushes `main`, which triggers the Pages deployment.

### Browser-assisted alternative

1. Open the live site and choose **Import snapshot**.
2. Review the local draft, history, links, and statistics.
3. Open **Imports** and choose **Download publish data**.
4. Replace `data/library.json` in this repository with the downloaded file.
5. Commit and push the change to `main`.

Until step 5, only that browser sees the draft. Visitors continue seeing the last published snapshot.

## Appearance

Light and Dark modes each remember an independent background and accent palette. Curated paper, beige, mist, blush, charcoal, pitch-black, graphite, aubergine, orange, blue, purple, and green choices are included, along with custom color pickers. Supporting contrast is derived automatically.

## Local development

Requires Node.js 20 or newer.

```powershell
npm install
npm run dev
```

Open <http://127.0.0.1:4173/>. Use `?preview=1` for non-persistent representative data.

Validation commands:

```powershell
npm test
npm run build
npm run check
```

The production build is written to `dist/`.

## Privacy and security

- CSV files are parsed locally; the site does not upload them to a server.
- The public snapshot contains novel data, reading progress, links, and timestamps by design.
- Local source filenames are removed before publication.
- Only `http:` and `https:` links are accepted; unsafe URL schemes are discarded.
- A restrictive Content Security Policy limits scripts, connections, images, and forms to the site itself.
- Appearance preferences and local drafts remain in browser storage until cleared.

See `SECURITY.md` for vulnerability reporting.

## Project files

- `index.html`, `styles.css`, `app.js`: production site.
- `lib/core.js`: CSV parsing, validation, snapshot merging, and sanitization.
- `data/library.json`: public reading data consumed by visitors.
- `scripts/ingest.mjs`: convert a CSV into public data without committing.
- `scripts/publish-snapshot.mjs`: validate, commit, and push one snapshot.
- `novelfire-readlist.user.js`: recommended Tampermonkey exporter.
- `novelfire-readlist.js`: developer-console fallback.
- `.github/workflows/pages.yml`: CI and GitHub Pages deployment.
