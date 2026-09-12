// Shared HTML-rendering helpers used by both the live client (app.js) and the
// build-time SEO pre-renderer (scripts/build.mjs), so the two never drift apart.

// Escapes the 5 characters HTML and XML 1.0 both require as named entities in
// text content, so this one function is also safe for atomFeed's XML output.
export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

export function href(url) {
  return url ? `href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer"` : 'aria-disabled="true"';
}

export function clamp(value) {
  return Math.max(0, Math.min(100, value));
}

export function bookRow(book, { formatDate, locale } = {}) {
  const num = (value) => value.toLocaleString(locale);
  return `<tr><td><a class="title-link" ${href(book.bookUrl)}>${escapeHtml(book.title)}</a></td><td>${escapeHtml(book.author || "Unknown")}<small class="source-label">${escapeHtml(book.source || "Reading source")}</small></td><td><div class="progress-cell"><span>${book.progress.toFixed(1)}%</span><i><b style="width:${clamp(book.progress)}%"></b></i><small>${num(book.chaptersRead)} / ${num(book.totalChapters)}</small></div></td><td><a class="chapter-link" ${href(book.chapterUrl)}>${escapeHtml(book.chapterTitle || "Not recorded")}</a><small class="date">${formatDate(book.updatedAt)}</small></td><td><div class="row-links">${book.chapterUrl ? `<a ${href(book.chapterUrl)}>Continue</a>` : ""}${book.bookUrl ? `<a ${href(book.bookUrl)}>Novel page</a>` : ""}</div></td></tr>`;
}

// Atom feed of forward reading-progress events (lib/core.js's mergeSnapshot only
// records a history entry when a novel's chapter count actually advances), so
// a feed reader can follow updates without polling the HTML page.
export function atomFeed(state, { siteUrl }) {
  const entries = state.history.map((event) => {
    const link = event.chapterUrl || event.bookUrl || `${siteUrl}/#history`;
    const title = `${event.title}: chapter ${event.fromChapter.toLocaleString("en-US")} to ${event.toChapter.toLocaleString("en-US")}`;
    return `  <entry>
    <title>${escapeHtml(title)}</title>
    <link href="${escapeHtml(link)}"/>
    <id>${siteUrl}/#history-${escapeHtml(event.id || `${event.bookId}-${event.importedAt}`)}</id>
    <updated>${event.importedAt}</updated>
    <summary>Advanced from chapter ${event.fromChapter.toLocaleString("en-US")} to ${event.toChapter.toLocaleString("en-US")} on ${escapeHtml(event.source || "the reading source")}.</summary>
  </entry>`;
  }).join("\n");
  const updated = state.history[0]?.importedAt || state.generatedAt || new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Novel Phoenix — Reading History</title>
  <subtitle>Chapter progress recorded as newer snapshots move novels forward.</subtitle>
  <link href="${siteUrl}/feed.xml" rel="self" type="application/atom+xml"/>
  <link href="${siteUrl}/"/>
  <id>${siteUrl}/</id>
  <updated>${updated}</updated>
${entries}
</feed>
`;
}
