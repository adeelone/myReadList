// ==UserScript==
// @name         Novel Phoenix Exporter
// @namespace    local.myReadList
// @version      2.2.0
// @description  Export signed-in NovelFire and NovelPhoenix.com libraries with authors, links, and reading progress.
// @match        https://novelfire.net/account/library*
// @match        https://novelphoenix.com/*
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  const runExtractor = () => {
    const OVERLAY_ID = "np-readlist-overlay";
    document.getElementById(OVERLAY_ID)?.remove();

    const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
    const number = (value) => Number.parseInt(String(value || "0").replace(/,/g, ""), 10) || 0;
    const absoluteUrl = (value, base = location.href) => {
      try {
        const url = new URL(value, base);
        return ["http:", "https:"].includes(url.protocol) ? url.href : "";
      } catch { return ""; }
    };
    const pageNumber = (url) => {
      try { return Math.max(1, number(new URL(url, location.href).searchParams.get("page")) || 1); }
      catch { return 1; }
    };
    const escapeHtml = (value) => String(value || "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
    const chapterNumber = (value) => number(String(value || "").match(/chapter[-\s_:]*(\d[\d,]*)/i)?.[1]);
    const progressFromText = (text) => {
      const compact = clean(text);
      const ratio = compact.match(/(\d[\d,]*)\s*\/\s*(\d[\d,]*)(?:\s*\(([\d.]+)%\))?/);
      if (ratio) {
        const read = number(ratio[1]);
        const total = number(ratio[2]);
        return { read, total, percent: ratio[3] || (total ? (read / total * 100).toFixed(1) : "") };
      }
      const read = number(compact.match(/(?:last\s+read|continue|read(?:ing)?(?:\s+at)?)\D{0,30}(?:chapter\s*)?(\d[\d,]*)/i)?.[1]);
      return { read, total: 0, percent: "" };
    };

    const extractBookMetadata = (doc) => {
      const authorNode = doc.querySelector('a[href*="/author/"],[class*="author"],[id*="author"]');
      const bodyText = clean(doc.body?.innerText);
      const author = clean(authorNode?.textContent || bodyText.match(/\bAuthor\s*:?\s*([^,|]+?)(?:\s{2,}|Chapters|Status|$)/i)?.[1]).replace(/^author\s*:?\s*/i, "");
      const totalMatch = bodyText.match(/(\d[\d,]*)\s+Chapters\b/i) || bodyText.match(/Chapters\s*:?\s*(\d[\d,]*)/i);
      const latest = doc.querySelector('a[class*="chapter-latest"],a[href$="/chapters"]');
      return { author, totalChapters: number(totalMatch?.[1]) || chapterNumber(latest?.textContent) };
    };

    const adapters = [
      {
        key: "novelfire", name: "NovelFire",
        matches: () => /(^|\.)novelfire\.net$/i.test(location.hostname),
        isLibrary: (doc = document) => /\/account\/library/i.test(new URL(doc.URL || location.href).pathname),
        paginationSelector: 'a[href*="/account/library?page="]',
        extract(doc) {
          return [...doc.querySelectorAll('li a[href*="/book/"]')].map((anchor) => anchor.closest("li")).filter(Boolean).map((container) => {
            const links = [...container.querySelectorAll('a[href*="/book/"]')];
            const chapter = links.find((link) => /\/chapter/i.test(link.getAttribute("href") || ""));
            const book = links.find((link) => !/\/chapter/i.test(link.getAttribute("href") || ""));
            const progress = progressFromText(container.textContent);
            return { source: this.name, title: clean(book?.textContent || book?.title), author: "", bookUrl: absoluteUrl(book?.getAttribute("href"), doc.URL), chapterTitle: clean(chapter?.textContent), chapterUrl: absoluteUrl(chapter?.getAttribute("href"), doc.URL), chaptersRead: progress.read || chapterNumber(chapter?.getAttribute("href") || chapter?.textContent), totalChapters: progress.total, progressPercent: progress.percent };
          }).filter((item) => item.title && item.bookUrl);
        },
        metadata: extractBookMetadata
      },
      {
        key: "novelphoenix", name: "NovelPhoenix.com",
        matches: () => /(^|\.)novelphoenix\.com$/i.test(location.hostname),
        isLibrary(doc = document) {
          const url = new URL(doc.URL || location.href);
          const identity = `${url.pathname} ${doc.querySelector("h1,h2,h3")?.textContent || ""}`;
          return /library|bookshelf|bookmark|reading[-\s]?list|follow(?:ing|ed)?/i.test(identity);
        },
        paginationSelector: 'a[href*="?page="],a[href*="&page="]',
        extract(doc) {
          const groups = new Map();
          for (const anchor of doc.querySelectorAll('a[href*="/novel/"]')) {
            const url = absoluteUrl(anchor.getAttribute("href"), doc.URL);
            const slug = new URL(url).pathname.match(/^\/novel\/([^/]+)/i)?.[1];
            if (!slug) continue;
            const container = anchor.closest("li,article,tr,.novel-item,.book-item,.library-item,.list-item,.row") || anchor.parentElement;
            if (!container) continue;
            const old = groups.get(slug);
            if (!old || container.querySelectorAll('a[href*="/novel/"]').length > old.querySelectorAll('a[href*="/novel/"]').length) groups.set(slug, container);
          }
          return [...groups.values()].map((container) => {
            const links = [...container.querySelectorAll('a[href*="/novel/"]')];
            const chapter = links.find((link) => /\/novel\/[a-z0-9-]+\/chapter[-_/]?\d+/i.test(absoluteUrl(link.getAttribute("href"), doc.URL)));
            const book = links.find((link) => /^\/novel\/[a-z0-9-]+\/?$/i.test(new URL(absoluteUrl(link.getAttribute("href"), doc.URL)).pathname));
            const heading = container.querySelector("h1,h2,h3,h4,[class*='title']");
            const progress = progressFromText(container.textContent);
            const read = progress.read || chapterNumber(chapter?.getAttribute("href") || chapter?.textContent);
            return { source: this.name, title: clean(book?.title || heading?.textContent || book?.textContent), author: clean(container.querySelector('a[href*="/author/"],[class*="author"]')?.textContent).replace(/^author\s*:?\s*/i, ""), bookUrl: absoluteUrl(book?.getAttribute("href"), doc.URL), chapterTitle: clean(chapter?.textContent || (read ? `Chapter ${read}` : "")), chapterUrl: absoluteUrl(chapter?.getAttribute("href"), doc.URL), chaptersRead: read, totalChapters: progress.total, progressPercent: progress.percent };
          }).filter((item) => item.title && item.bookUrl);
        },
        metadata: extractBookMetadata
      }
    ];

    const adapter = adapters.find((candidate) => candidate.matches());
    if (!adapter) return showMessage("Unsupported reading site", "Open a signed-in NovelFire or NovelPhoenix.com library page, then run the exporter again.");
    if (!adapter.isLibrary()) return showMessage(`Open your ${adapter.name} library`, "This is not a personal library page. Sign in, open Library or Bookmarks, then select Export reading list.");

    const currentPage = pageNumber(location.href);
    const maxPage = Math.max(1, ...[...document.querySelectorAll(adapter.paginationSelector)].map((link) => pageNumber(link.href)));
    const spinner = document.createElement("div");
    spinner.id = OVERLAY_ID;
    spinner.style.cssText = ["position:fixed", "inset:24px", "z-index:2147483647", "background:#020617ee", "color:#e2e8f0", "display:flex", "align-items:center", "justify-content:center", "font-family:system-ui,sans-serif", "font-size:18px", "text-align:center", "padding:24px"].join(";");
    spinner.textContent = `Collecting ${adapter.name} novels from ${maxPage} page${maxPage === 1 ? "" : "s"}...`;
    document.body.appendChild(spinner);

    const fetchPage = async (page) => {
      const url = new URL(location.href);
      if (page === 1) url.searchParams.delete("page"); else url.searchParams.set("page", String(page));
      const response = await fetch(url, { credentials: "include", headers: { Accept: "text/html" } });
      if (!response.ok) throw new Error(`Library page ${page} returned ${response.status}.`);
      return adapter.extract(new DOMParser().parseFromString(await response.text(), "text/html"));
    };
    const tasks = [Promise.resolve(adapter.extract(document))];
    for (let page = 1; page <= maxPage; page += 1) if (page !== currentPage) tasks.push(fetchPage(page).catch((error) => { console.warn(error); return []; }));

    Promise.all(tasks).then(async (results) => {
      const seen = new Set();
      const items = results.flat().filter((item) => { const key = item.bookUrl.replace(/\/$/, "").toLowerCase(); if (!key || seen.has(key)) return false; seen.add(key); return true; });
      if (!items.length) throw new Error(`No readable novels were found. Confirm that you are signed in and viewing your ${adapter.name} library.`);
      spinner.textContent = `Collected ${items.length} novels. Filling author and chapter totals...`;
      const rows = await mapConcurrent(items, 4, async (item) => {
        if (item.author && item.totalChapters) return item;
        try {
          const response = await fetch(item.bookUrl, { credentials: "include", headers: { Accept: "text/html" } });
          if (!response.ok) return item;
          const metadata = adapter.metadata(new DOMParser().parseFromString(await response.text(), "text/html"));
          const chaptersRead = item.chaptersRead || chapterNumber(item.chapterUrl || item.chapterTitle);
          const totalChapters = item.totalChapters || metadata.totalChapters;
          return { ...item, author: item.author || metadata.author, chaptersRead, totalChapters, progressPercent: item.progressPercent || (totalChapters ? (chaptersRead / totalChapters * 100).toFixed(1) : "") };
        } catch (error) { console.warn(`Could not enrich ${item.title}.`, error); return item; }
      });
      spinner.remove();
      showResults(rows, adapter, maxPage);
    }).catch((error) => { console.error(error); spinner.remove(); showMessage("Export could not be completed", error.message || "Check the browser console for details."); });

    async function mapConcurrent(items, limit, mapper) {
      const output = new Array(items.length);
      let cursor = 0;
      await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => { while (cursor < items.length) { const index = cursor++; output[index] = await mapper(items[index], index); } }));
      return output;
    }

    function showResults(items, source, pages) {
      const exportedAt = new Date().toISOString();
      const rows = items.map((item, index) => ({ ...item, libraryOrder: index + 1, exportedAt }));
      const header = ["Title", "Author", "Source", "Book URL", "Last read chapter", "Last read URL", "Chapters read", "Total chapters", "Progress (%)", "Library order", "Exported at"];
      const csv = [header, ...rows.map((row) => [row.title, row.author, row.source, row.bookUrl, row.chapterTitle, row.chapterUrl, row.chaptersRead, row.totalChapters, row.progressPercent, row.libraryOrder, row.exportedAt])].map((line) => line.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
      const overlay = document.createElement("div");
      overlay.id = OVERLAY_ID;
      overlay.style.cssText = ["position:fixed", "inset:24px", "z-index:2147483647", "background:#0f172a", "color:#e2e8f0", "border:1px solid #334155", "border-radius:16px", "box-shadow:0 20px 60px rgba(0,0,0,.45)", "padding:20px", "overflow:auto", "font-family:system-ui,sans-serif"].join(";");
      overlay.innerHTML = `<div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:16px"><div><div style="font-size:24px;font-weight:700">Novel Phoenix Export</div><div style="color:#94a3b8;margin-top:4px">Collected ${rows.length} ${escapeHtml(source.name)} entries from ${pages} page${pages === 1 ? "" : "s"}.</div></div><div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end"><button id="np-copy-json">Copy JSON</button><button id="np-copy-csv">Copy CSV</button><button id="np-download-csv">Download CSV</button><button id="np-close">Close</button></div></div><div style="overflow:auto;border:1px solid #334155;border-radius:12px"><table style="width:100%;border-collapse:collapse;background:#111827"><thead><tr><th>Title</th><th>Source</th><th>Progress</th><th>Last chapter</th></tr></thead><tbody>${rows.map((row) => `<tr><td><a href="${escapeHtml(row.bookUrl)}" target="_blank" rel="noreferrer">${escapeHtml(row.title)}</a><small>${escapeHtml(row.author || "Unknown author")}</small></td><td>${escapeHtml(row.source)}</td><td>${number(row.chaptersRead).toLocaleString()} / ${number(row.totalChapters).toLocaleString()}${row.progressPercent ? ` (${escapeHtml(row.progressPercent)}%)` : ""}</td><td>${row.chapterUrl ? `<a href="${escapeHtml(row.chapterUrl)}" target="_blank" rel="noreferrer">${escapeHtml(row.chapterTitle)}</a>` : escapeHtml(row.chapterTitle || "Not recorded")}</td></tr>`).join("")}</tbody></table></div>`;
      overlay.querySelectorAll("button").forEach((button) => { button.style.cssText = "padding:10px 14px;border-radius:10px;border:1px solid #475569;background:#1e293b;color:white;cursor:pointer"; });
      overlay.querySelectorAll("th,td").forEach((cell) => { cell.style.cssText = "text-align:left;padding:12px;border-top:1px solid #334155"; });
      overlay.querySelectorAll("td small").forEach((small) => { small.style.cssText = "display:block;color:#94a3b8;margin-top:4px"; });
      overlay.querySelectorAll("a").forEach((link) => { link.style.color = "#93c5fd"; });
      document.body.appendChild(overlay);
      const copy = async (text, label) => { try { await navigator.clipboard.writeText(text); alert(`${label} copied.`); } catch { console.log(text); alert(`Could not copy ${label}; it was written to the console.`); } };
      overlay.querySelector("#np-copy-json")?.addEventListener("click", () => copy(JSON.stringify(rows, null, 2), "JSON"));
      overlay.querySelector("#np-copy-csv")?.addEventListener("click", () => copy(csv, "CSV"));
      overlay.querySelector("#np-download-csv")?.addEventListener("click", () => { const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); link.download = `${source.key}-reading-${exportedAt.slice(0, 10)}.csv`; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(link.href), 1000); });
      overlay.querySelector("#np-close")?.addEventListener("click", () => overlay.remove());
      console.table(rows);
      window.novelPhoenixReadList = rows;
    }

    function showMessage(title, body) {
      const overlay = document.createElement("div");
      overlay.id = OVERLAY_ID;
      overlay.style.cssText = ["position:fixed", "right:24px", "bottom:78px", "z-index:2147483647", "max-width:420px", "background:#0f172a", "color:#e2e8f0", "border:1px solid #334155", "border-radius:14px", "box-shadow:0 20px 60px rgba(0,0,0,.4)", "padding:20px", "font-family:system-ui,sans-serif"].join(";");
      overlay.innerHTML = `<strong style="display:block;font-size:18px;margin-bottom:8px">${escapeHtml(title)}</strong><p style="margin:0 0 16px;color:#cbd5e1;line-height:1.5">${escapeHtml(body)}</p><button style="padding:8px 12px;border:0;border-radius:8px;background:#c83b12;color:white;cursor:pointer">Close</button>`;
      overlay.querySelector("button")?.addEventListener("click", () => overlay.remove());
      document.body.appendChild(overlay);
    }
  };

  const addButton = () => {
    if (document.getElementById("nf-readlist-launcher")) return;
    const button = document.createElement("button");
    button.id = "nf-readlist-launcher";
    button.textContent = "Export reading list";
    button.style.cssText = ["position:fixed", "right:20px", "bottom:20px", "z-index:2147483646", "padding:12px 16px", "border:0", "border-radius:999px", "background:#2563eb", "color:#fff", "font:600 14px system-ui,sans-serif", "cursor:pointer", "box-shadow:0 12px 30px rgba(0,0,0,.3)"].join(";");
    button.addEventListener("click", runExtractor);
    document.body.appendChild(button);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", addButton, { once: true });
  } else {
    addButton();
  }
})();
