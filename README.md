# Novel Phoenix

Novel Phoenix is a public reading library for exports from NovelFire and NovelPhoenix.com. Visitors can see the current library, last-read chapter, reading progress, source novel/chapter links, reading history, and import history. The owner can preview a CSV snapshot locally before publishing a sanitized public data file.

Live site: <https://novel-phoenix-readlist.vercel.app/>

Fallback: <https://adeelone.github.io/myReadList/>

## Architecture

- The production site is a static Vercel deployment, with GitHub Pages retained as a fallback.
- Public reading data lives in `data/library.json` and is safe to cache, review, and version in Git.
- Browser imports are local drafts stored under `novel-phoenix-v1`; they never overwrite the public site by themselves.
- Import filenames are removed from published snapshots.
- GitHub Actions runs tests and deploys the fallback Pages artifact on every push to `main`; Vercel serves the same `dist/` build in production.
- No database, server password, API key, analytics tracker, or browser-side admin token is required.
- Privacy, terms, accessibility, security, and responsible-disclosure pages ship with the public artifact.

This repository-backed approach is deliberate: it makes public reads reliable and owner writes secure without exposing credentials in frontend code.

## Export from NovelFire or NovelPhoenix.com

1. Install Tampermonkey.
2. Create a userscript using `novelfire-readlist.user.js`.
3. While signed in, open `https://novelfire.net/account/library` or your personal library/bookshelf page on `https://novelphoenix.com/`.
4. Select **Export reading list**.
5. Download the generated CSV.

The exporter detects the active source, scans paginated library pages, fetches author and chapter-count metadata, preserves library order, records the export time, and includes direct novel and last-read chapter URLs. Legacy NovelFire exports remain supported. Because NovelPhoenix.com library pages require an authenticated account, run the exporter only on your own signed-in library page.

`novelfire-readlist.user.js` and `novelfire-readlist.bookmarklet.txt` are generated from `novelfire-readlist.js`, the single source of truth for the extraction logic. After editing `novelfire-readlist.js`, run:

```powershell
npm run generate
```

`npm run check` fails if either generated file is out of date.

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
6. pushes `main`, which triggers connected Vercel and fallback Pages deployments.

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
- A default-deny Content Security Policy limits scripts, connections, images, frames, workers, media, objects, and forms.
- CSV imports are capped at 5 MB and 5,000 novels; rendered content is normalized and escaped.
- Outbound links isolate the opener and suppress referrer information.
- GitHub Actions uses pinned commits, scoped job permissions, CodeQL scanning, Dependabot, and immutable build artifacts.
- Appearance preferences and local drafts remain in browser storage until cleared.

The live site includes [Privacy](https://novel-phoenix-readlist.vercel.app/privacy), [Terms](https://novel-phoenix-readlist.vercel.app/terms), [Accessibility](https://novel-phoenix-readlist.vercel.app/accessibility), and [Security](https://novel-phoenix-readlist.vercel.app/security) pages. See `SECURITY.md` for private vulnerability reporting and `docs/SECURITY-OPERATIONS.md` for the threat model and release checklist.

### Firewall boundary

Vercel provides HTTPS, CDN delivery, platform-level DDoS mitigation, and the response headers configured in `vercel.json`. Novel Phoenix has no application server or public write API. The project does not claim custom paid WAF rules or rate limits that have not been enabled in the Vercel account. GitHub Pages remains a fallback host with a more limited response-header surface.

## Project files

- `index.html`, `styles.css`, `app.js`: production site.
- `lib/core.js`: CSV parsing, validation, snapshot merging, and sanitization.
- `lib/render.js`: shared HTML-rendering helpers (escaping, links, the novel-row template) used by both `app.js` and the build-time pre-renderer, so the live table and the pre-rendered `view-source:` HTML can never drift apart.
- `data/library.json`: public reading data consumed by visitors.
- `feed.xml` (generated): Atom feed of forward reading-progress events, built from `data/library.json` at build time — see `scripts/build.mjs`.
- `scripts/ingest.mjs`: convert a CSV into public data without committing.
- `scripts/publish-snapshot.mjs`: validate, commit, and push one snapshot.
- `scripts/generate-readlist.mjs`, `scripts/bookmarklet.mjs`: regenerate the userscript and bookmarklet from `novelfire-readlist.js`.
- `novelfire-readlist.user.js`: recommended Tampermonkey exporter (generated).
- `novelfire-readlist.js`: developer-console bookmarklet source (single source of truth).
- `vercel.json`: production build, clean URLs, and hardened response headers.
- `.github/workflows/pages.yml`: CI and fallback GitHub Pages deployment.
