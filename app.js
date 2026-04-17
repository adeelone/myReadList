const state = {
  rows: [],
  filteredRows: [],
};

const els = {
  csvFile: document.getElementById("csvFile"),
  searchInput: document.getElementById("searchInput"),
  sortSelect: document.getElementById("sortSelect"),
  clearBtn: document.getElementById("clearBtn"),
  emptyState: document.getElementById("emptyState"),
  results: document.getElementById("results"),
  resultsCount: document.getElementById("resultsCount"),
  cardGrid: document.getElementById("cardGrid"),
  tableBody: document.getElementById("tableBody"),
  statBooks: document.getElementById("statBooks"),
  statRead: document.getElementById("statRead"),
  statTotal: document.getElementById("statTotal"),
  statAverage: document.getElementById("statAverage"),
  fileDrop: document.querySelector(".file-drop"),
};

function parseCsv(text) {
  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(current);
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  if (current.length || row.length) {
    row.push(current);
    if (row.some((cell) => cell !== "")) rows.push(row);
  }

  if (!rows.length) return [];

  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((values) => {
    const item = {};
    headers.forEach((header, index) => {
      item[header] = (values[index] || "").trim();
    });
    return normalizeRow(item);
  });
}

function normalizeRow(row) {
  const title = row.Title || "";
  const author = row.Author || "";
  const totalChapters = Number.parseInt(row["Total chapters"] || row["Chapter amount"] || "0", 10) || 0;
  const chaptersRead = Number.parseInt(row["Chapters read"] || row["Chapters I have read"] || "0", 10) || 0;
  const progressValue = Number.parseFloat(row["Progress (%)"] || "0") || 0;

  return {
    title,
    author,
    totalChapters,
    chaptersRead,
    progressValue,
    bookUrl: row["Book URL"] || "",
    chapterTitle: row["Last chapter title"] || "",
    chapterUrl: row["Last chapter URL"] || "",
  };
}

function sortRows(rows, mode) {
  const copy = [...rows];

  copy.sort((a, b) => {
    if (mode === "title-asc") return a.title.localeCompare(b.title);
    if (mode === "title-desc") return b.title.localeCompare(a.title);
    if (mode === "progress-desc") return b.chaptersRead - a.chaptersRead || a.title.localeCompare(b.title);
    if (mode === "progress-asc") return a.chaptersRead - b.chaptersRead || a.title.localeCompare(b.title);
    if (mode === "chapters-desc") return b.totalChapters - a.totalChapters || a.title.localeCompare(b.title);
    if (mode === "chapters-asc") return a.totalChapters - b.totalChapters || a.title.localeCompare(b.title);
    return 0;
  });

  return copy;
}

function applyFilters() {
  const query = els.searchInput.value.trim().toLowerCase();
  const sorted = sortRows(
    state.rows.filter((row) => {
      if (!query) return true;
      return row.title.toLowerCase().includes(query) || row.author.toLowerCase().includes(query);
    }),
    els.sortSelect.value
  );

  state.filteredRows = sorted;
  render();
}

function render() {
  const rows = state.filteredRows;
  const bookCount = rows.length;
  const totalRead = rows.reduce((sum, row) => sum + row.chaptersRead, 0);
  const totalChapters = rows.reduce((sum, row) => sum + row.totalChapters, 0);
  const average = bookCount ? rows.reduce((sum, row) => sum + row.progressValue, 0) / bookCount : 0;

  els.statBooks.textContent = String(bookCount);
  els.statRead.textContent = String(totalRead);
  els.statTotal.textContent = String(totalChapters);
  els.statAverage.textContent = `${average.toFixed(1)}%`;
  els.resultsCount.textContent = `${bookCount} ${bookCount === 1 ? "entry" : "entries"}`;

  els.cardGrid.innerHTML = rows
    .map((row) => {
      const width = Math.max(0, Math.min(100, row.progressValue));
      return `
        <article class="book-card">
          <h3>${escapeHtml(row.title)}</h3>
          <p class="author">${escapeHtml(row.author || "Unknown author")}</p>
          <div class="book-meta">
            <div>
              <span>Total Chapters</span>
              <strong>${row.totalChapters}</strong>
            </div>
            <div>
              <span>Chapters Read</span>
              <strong>${row.chaptersRead}</strong>
            </div>
          </div>
          <div class="progress-bar"><div style="width:${width}%"></div></div>
          <p><strong>${row.progressValue.toFixed(1)}%</strong> complete</p>
          <p class="muted">${escapeHtml(row.chapterTitle || "No last chapter title")}</p>
          <div class="book-links">
            ${row.bookUrl ? `<a href="${escapeHtml(row.bookUrl)}" target="_blank" rel="noreferrer">Book Page</a>` : ""}
            ${row.chapterUrl ? `<a href="${escapeHtml(row.chapterUrl)}" target="_blank" rel="noreferrer">Last Chapter</a>` : ""}
          </div>
        </article>
      `;
    })
    .join("");

  els.tableBody.innerHTML = rows
    .map(
      (row) => `
      <tr>
        <td>${escapeHtml(row.title)}</td>
        <td>${escapeHtml(row.author || "Unknown author")}</td>
        <td>${row.totalChapters}</td>
        <td>${row.chaptersRead}</td>
        <td>${row.progressValue.toFixed(1)}%</td>
        <td>${row.bookUrl ? `<a href="${escapeHtml(row.bookUrl)}" target="_blank" rel="noreferrer">Open</a>` : '<span class="muted">N/A</span>'}</td>
        <td>${row.chapterUrl ? `<a href="${escapeHtml(row.chapterUrl)}" target="_blank" rel="noreferrer">${escapeHtml(row.chapterTitle || "Open")}</a>` : escapeHtml(row.chapterTitle || "N/A")}</td>
      </tr>
    `
    )
    .join("");

  const hasRows = state.rows.length > 0;
  els.emptyState.classList.toggle("hidden", hasRows);
  els.results.classList.toggle("hidden", !hasRows);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function showError(message) {
  els.emptyState.classList.remove("hidden");
  els.results.classList.add("hidden");
  els.emptyState.innerHTML = `<h2>Could not load CSV</h2><p class="error">${escapeHtml(message)}</p>`;
}

function loadCsvText(text) {
  const rows = parseCsv(text).filter((row) => row.title);
  if (!rows.length) {
    showError("The CSV did not contain any readable entries.");
    return;
  }

  state.rows = rows;
  applyFilters();
}

function handleFile(file) {
  if (!file) return;
  file.text().then(loadCsvText).catch(() => showError("The selected file could not be read."));
}

els.csvFile.addEventListener("change", (event) => handleFile(event.target.files?.[0]));
els.searchInput.addEventListener("input", applyFilters);
els.sortSelect.addEventListener("change", applyFilters);
els.clearBtn.addEventListener("click", () => {
  els.searchInput.value = "";
  els.sortSelect.value = "title-asc";
  applyFilters();
});

els.fileDrop.addEventListener("dragover", (event) => {
  event.preventDefault();
  els.fileDrop.classList.add("dragover");
});

els.fileDrop.addEventListener("dragleave", () => {
  els.fileDrop.classList.remove("dragover");
});

els.fileDrop.addEventListener("drop", (event) => {
  event.preventDefault();
  els.fileDrop.classList.remove("dragover");
  handleFile(event.dataTransfer?.files?.[0]);
});

render();
