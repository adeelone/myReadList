# NovelFire Read List

This folder contains a browser-side extractor for your NovelFire library.

## What it does

When you run the script on `https://novelfire.net/account/library` while logged in, it collects your whole library across all pages and builds a readable list with:

- `Title`
- `Author`
- `Chapter amount`
- `Chapters I have read`
- `Last chapter title`
- `Progress (%)`

## Files

- `novelfire-readlist.js`: the main multi-page extractor script.
- `novelfire-readlist.bookmarklet.txt`: one-click bookmarklet code.
- `novelfire-readlist.user.js`: Tampermonkey userscript that adds an `Export Read List` button on the library page.
- `index.html`: local site for importing the exported CSV.
- `styles.css`: styling for the local site.
- `app.js`: CSV parsing and rendering logic for the local site.

## Recommended: Tampermonkey

This is the best option if you do not want to paste code again.

1. Install the Tampermonkey browser extension.
2. Create a new userscript in Tampermonkey.
3. Replace its contents with [novelfire-readlist.user.js](C:\Users\adeem\OneDrive\Desktop\gen_proj'\myReadList\novelfire-readlist.user.js).
4. Save it.
5. Open `https://novelfire.net/account/library` while logged in.
6. Click the floating `Export Read List` button.

The userscript will:

- scan every library page
- fetch each novel page to extract the author
- show one combined table
- let you copy JSON, copy CSV, or download CSV

## Alternative: Bookmarklet

1. Create a new bookmark in your browser.
2. Name it `NovelFire Read List`.
3. Copy the contents of [novelfire-readlist.bookmarklet.txt](C:\Users\adeem\OneDrive\Desktop\gen_proj'\myReadList\novelfire-readlist.bookmarklet.txt) into the bookmark URL field.
4. While logged into `https://novelfire.net/account/library`, click that bookmark.

## Manual fallback

1. Log into NovelFire.
2. Open `https://novelfire.net/account/library`.
3. Open Developer Tools in your browser.
4. Go to the `Console` tab.
5. Open [novelfire-readlist.js](C:\Users\adeem\OneDrive\Desktop\gen_proj'\myReadList\novelfire-readlist.js), copy the whole file, and paste it into the console.
6. Press Enter.

## Result

The script opens an overlay on the page and also prints a table in the browser console.

You can:

- copy JSON
- copy CSV
- download CSV

## Local Site

After you export the CSV, you can open the local site and import it for a cleaner reading view.

1. Open [index.html](</C:\Users\adeem\OneDrive\Desktop\gen_proj'\myReadList\index.html>) in your browser.
2. Upload the exported CSV file.
3. Use search and sorting to browse the list.

The site shows:

- summary stats
- a readable card view
- a full table view
- links back to the book page and last chapter

## Notes

- The public home page at `https://novelfire.net/home` does not expose your personal library.
- Run this while logged into `https://novelfire.net/account/library`.
- Author names are fetched from each novel page after the library pages are collected, so larger libraries may take a bit longer.
- If NovelFire changes its HTML structure, the selectors may need a small update.
