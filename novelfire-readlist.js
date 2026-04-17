(() => {
  const existing = document.getElementById("nf-readlist-overlay");
  if (existing) existing.remove();

  const clean = (value) => (value || "").replace(/\s+/g, " ").trim();
  const parsePageNumber = (url) => {
    try {
      const parsed = new URL(url, location.href);
      const page = parsed.searchParams.get("page");
      return page ? parseInt(page, 10) : 1;
    } catch {
      return 1;
    }
  };

  const currentPage = parsePageNumber(location.href);
  const getMaxPage = () => {
    const links = [...document.querySelectorAll('a[href*="/account/library?page="]')];
    const pageNumbers = links.map((link) => parsePageNumber(link.href)).filter((page) => Number.isFinite(page) && page > 0);
    return pageNumbers.length ? Math.max(...pageNumbers) : 1;
  };
  const maxPage = getMaxPage();

  const escapeHtml = (value) =>
    String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const findProgressText = (li) => {
    const textNode = [...li.childNodes].find((node) => node.nodeType === Node.TEXT_NODE && /\d+\s*\/\s*\d+/.test(node.textContent || ""));
    if (textNode) return clean(textNode.textContent);
    const elementNode = [...li.querySelectorAll("*")].find((el) => /\d+\s*\/\s*\d+/.test(el.textContent || ""));
    return clean(elementNode?.textContent || "");
  };

  const extractAuthorFromBookPage = (doc) => {
    const authorCandidates = [
      ...doc.querySelectorAll('a[href*="/author/"]'),
      ...doc.querySelectorAll('[class*="author"]'),
      ...doc.querySelectorAll('[id*="author"]'),
    ];
    for (const node of authorCandidates) {
      const text = clean(node.textContent).replace(/^author\s*:?\s*/i, "");
      if (text) return text;
    }
    const bodyText = clean(doc.body?.innerText || "");
    const authorMatch = bodyText.match(/\bAuthor\s*:?\s*([^\n]+)/i);
    return authorMatch ? clean(authorMatch[1]) : "";
  };

  const extractItemsFromDoc = (doc) =>
    [...doc.querySelectorAll('li a[href*="/book/"]')]
      .map((anchor) => anchor.closest("li"))
      .filter(Boolean)
      .map((li) => {
        const bookLinks = [...li.querySelectorAll('a[href*="/book/"]')];
        const chapterLink = bookLinks.find((link) => /\/chapter/i.test(link.getAttribute("href") || "")) || null;
        const bookLink = bookLinks.find((link) => !/\/chapter/i.test(link.getAttribute("href") || "")) || bookLinks[0] || null;
        const progressText = findProgressText(li);
        const progressMatch = progressText.match(/(\d+)\s*\/\s*(\d+)\s*\(([\d.]+)%\)/);

        return {
          title: clean(bookLink?.textContent),
          author: "",
          bookUrl: bookLink?.href || "",
          chapterTitle: clean(chapterLink?.textContent || ""),
          chapterUrl: chapterLink?.href || "",
          chaptersRead: progressMatch ? progressMatch[1] : "",
          chapterAmount: progressMatch ? progressMatch[2] : "",
          progressPercent: progressMatch ? progressMatch[3] : "",
        };
      })
      .filter((item) => item.title);

  const parsePageHtml = (html) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    return extractItemsFromDoc(doc);
  };

  const fetchPage = (pageNumber) => {
    const url = new URL(location.href);
    if (pageNumber === 1) {
      url.searchParams.delete("page");
    } else {
      url.searchParams.set("page", String(pageNumber));
    }
    return fetch(url.toString(), { credentials: "include" }).then((response) => response.text()).then((html) => parsePageHtml(html));
  };

  const fetchAuthor = (bookUrl) =>
    fetch(bookUrl, { credentials: "include" })
      .then((response) => response.text())
      .then((html) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        return extractAuthorFromBookPage(doc);
      })
      .catch(() => "");

  const buildAndShowOverlay = (allItems) => {
    const seen = new Set();
    const uniqueItems = allItems
      .filter((item) => {
        const key = `${item.title}::${item.bookUrl}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => a.title.localeCompare(b.title));

    const csvHeader = ["Title", "Author", "Book URL", "Last chapter title", "Last chapter URL", "Chapters read", "Total chapters", "Progress (%)"];
    const csv = [csvHeader, ...uniqueItems.map((row) => [row.title, row.author, row.bookUrl, row.chapterTitle, row.chapterUrl, row.chaptersRead, row.chapterAmount, row.progressPercent])]
      .map((line) => line.map((cell) => `"${String(cell || "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const json = JSON.stringify(uniqueItems, null, 2);

    const overlay = document.createElement("div");
    overlay.id = "nf-readlist-overlay";
    overlay.style.cssText = ["position:fixed", "inset:24px", "z-index:2147483647", "background:#0f172a", "color:#e2e8f0", "border:1px solid #334155", "border-radius:16px", "box-shadow:0 20px 60px rgba(0,0,0,.45)", "padding:20px", "overflow:auto", "font-family:system-ui,sans-serif"].join(";");
    overlay.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:16px;">
        <div>
          <div style="font-size:24px;font-weight:700;">NovelFire Read List</div>
          <div style="color:#94a3b8;margin-top:4px;">Collected ${uniqueItems.length} entries from pages 1-${maxPage}.</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
          <button id="nf-copy-json" style="padding:10px 14px;border-radius:10px;border:0;background:#2563eb;color:white;cursor:pointer;">Copy JSON</button>
          <button id="nf-copy-csv" style="padding:10px 14px;border-radius:10px;border:0;background:#0f766e;color:white;cursor:pointer;">Copy CSV</button>
          <button id="nf-download-csv" style="padding:10px 14px;border-radius:10px;border:0;background:#7c3aed;color:white;cursor:pointer;">Download CSV</button>
          <button id="nf-close" style="padding:10px 14px;border-radius:10px;border:1px solid #475569;background:transparent;color:#e2e8f0;cursor:pointer;">Close</button>
        </div>
      </div>
      <div style="overflow:auto;border:1px solid #334155;border-radius:12px;">
        <table style="width:100%;border-collapse:collapse;background:#111827;">
          <thead style="position:sticky;top:0;background:#1e293b;">
            <tr>
              <th style="text-align:left;padding:12px;border-bottom:1px solid #334155;">Title</th>
              <th style="text-align:left;padding:12px;border-bottom:1px solid #334155;">Author</th>
              <th style="text-align:left;padding:12px;border-bottom:1px solid #334155;">Progress</th>
              <th style="text-align:left;padding:12px;border-bottom:1px solid #334155;">Last chapter</th>
            </tr>
          </thead>
          <tbody>
            ${
              uniqueItems.length
                ? uniqueItems.map((row) => `
                  <tr>
                    <td style="padding:12px;border-bottom:1px solid #1f2937;"><a href="${escapeHtml(row.bookUrl)}" target="_blank" rel="noreferrer" style="color:#60a5fa;text-decoration:none;">${escapeHtml(row.title)}</a></td>
                    <td style="padding:12px;border-bottom:1px solid #1f2937;">${escapeHtml(row.author)}</td>
                    <td style="padding:12px;border-bottom:1px solid #1f2937;">${escapeHtml(row.chaptersRead)} / ${escapeHtml(row.chapterAmount)} (${escapeHtml(row.progressPercent)}%)</td>
                    <td style="padding:12px;border-bottom:1px solid #1f2937;"><a href="${escapeHtml(row.chapterUrl)}" target="_blank" rel="noreferrer" style="color:#a5b4fc;text-decoration:none;">${escapeHtml(row.chapterTitle)}</a></td>
                  </tr>`).join("")
                : '<tr><td colspan="4" style="padding:16px;color:#fca5a5;">No readable library items were found.</td></tr>'
            }
          </tbody>
        </table>
      </div>
    `;
    document.body.appendChild(overlay);

    const copyText = async (text, label) => {
      try {
        await navigator.clipboard.writeText(text);
        alert(`${label} copied to clipboard.`);
      } catch (error) {
        console.error(error);
        alert(`Could not copy ${label}. Open the console and copy it manually.`);
        console.log(text);
      }
    };

    const downloadCsv = () => {
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "novelfire-read-list-all-pages.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
    };

    overlay.querySelector("#nf-copy-json")?.addEventListener("click", () => copyText(json, "JSON"));
    overlay.querySelector("#nf-copy-csv")?.addEventListener("click", () => copyText(csv, "CSV"));
    overlay.querySelector("#nf-download-csv")?.addEventListener("click", downloadCsv);
    overlay.querySelector("#nf-close")?.addEventListener("click", () => overlay.remove());
    console.table(uniqueItems);
    window.novelFireReadList = uniqueItems;
  };

  const spinner = document.createElement("div");
  spinner.id = "nf-readlist-overlay";
  spinner.style.cssText = ["position:fixed", "inset:24px", "z-index:2147483647", "background:#020617cc", "color:#e2e8f0", "display:flex", "align-items:center", "justify-content:center", "font-family:system-ui,sans-serif", "font-size:18px", "text-align:center", "padding:24px"].join(";");
  spinner.textContent = `Collecting novels from all ${maxPage} page(s)...`;
  document.body.appendChild(spinner);

  const tasks = [Promise.resolve(extractItemsFromDoc(document))];
  for (let page = 1; page <= maxPage; page += 1) {
    if (page === currentPage) continue;
    tasks.push(fetchPage(page).catch(() => []));
  }

  Promise.all(tasks)
    .then(async (results) => {
      const mergedItems = results.flat();
      const deduped = [];
      const seen = new Set();
      for (const item of mergedItems) {
        const key = `${item.title}::${item.bookUrl}`;
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(item);
      }
      spinner.textContent = `Collected ${deduped.length} novels. Fetching author names...`;
      const withAuthors = await Promise.all(deduped.map(async (item) => ({ ...item, author: item.bookUrl ? await fetchAuthor(item.bookUrl) : "" })));
      spinner.remove();
      buildAndShowOverlay(withAuthors);
    })
    .catch((error) => {
      console.error(error);
      spinner.textContent = "Error while collecting data. Check console for details.";
    });
})();
