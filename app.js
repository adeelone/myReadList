import { createPublicSnapshot, mergeSnapshot, normalizeState, parseCsv } from "./lib/core.js";

const STORAGE_KEY = "novel-phoenix-v1";
const THEME_KEY = "novel-phoenix-theme-v1";
const isPreview = new URLSearchParams(location.search).has("preview");
let state = isPreview ? previewState() : loadState();
let dataSource = isPreview ? "preview" : state.library.length ? "local" : "loading";
const theme = loadTheme();

const $ = (id) => document.getElementById(id);
const els = {
  csvFile: $("csvFile"), importButton: $("importButton"), emptyImportButton: $("emptyImportButton"),
  search: $("searchInput"), sort: $("sortSelect"), body: $("tableBody"), empty: $("emptyState"),
  resultsCount: $("resultsCount"), books: $("statBooks"), read: $("statRead"), average: $("statAverage"),
  lastCard: $("lastReadCard"), lastTime: $("lastReadTime"), history: $("readingHistory"),
  imports: $("importHistory"), drop: $("fileDrop"), toast: $("toast"),
  dataStatus: $("dataStatus"), draftActions: $("draftActions"), downloadData: $("downloadDataButton"),
  clearDraft: $("clearDraftButton"), publishedNotice: $("publishedNotice")
};
Object.assign(els, {
  themeButton: $("themeButton"), themePanel: $("themePanel"), closeTheme: $("closeTheme"),
  backgroundSwatches: $("backgroundSwatches"), accentSwatches: $("accentSwatches"),
  backgroundColor: $("backgroundColor"), accentColor: $("accentColor"), resetTheme: $("resetTheme")
});

const palettes = {
  light: {
    backgrounds: [{ name: "Paper", value: "#fdfdfc" }, { name: "Beige", value: "#f3ecdf" }, { name: "Mist", value: "#eaf0f3" }, { name: "Blush", value: "#f5ebed" }],
    accents: [{ name: "Phoenix", value: "#c83b12" }, { name: "Blue", value: "#2869ad" }, { name: "Purple", value: "#7650a8" }, { name: "Green", value: "#39765a" }]
  },
  dark: {
    backgrounds: [{ name: "Charcoal", value: "#111210" }, { name: "Pitch black", value: "#000000" }, { name: "Graphite", value: "#1b1c20" }, { name: "Aubergine", value: "#18131d" }],
    accents: [{ name: "Ember", value: "#ed6a3d" }, { name: "Blue", value: "#69a9e9" }, { name: "Purple", value: "#b28ade" }, { name: "Green", value: "#73b991" }]
  }
};

function loadTheme() {
  const fallback = { mode: "light", light: { background: "#fdfdfc", accent: "#c83b12" }, dark: { background: "#111210", accent: "#ed6a3d" } };
  try {
    const saved = JSON.parse(localStorage.getItem(THEME_KEY));
    if (!saved) return fallback;
    return { ...fallback, ...saved, light: { ...fallback.light, ...saved.light }, dark: { ...fallback.dark, ...saved.dark } };
  } catch (_) { return fallback; }
}

function saveTheme() { localStorage.setItem(THEME_KEY, JSON.stringify(theme)); }

function applyTheme() {
  const colors = theme[theme.mode];
  const dark = luminance(colors.background) < 0.36;
  const ink = dark ? "#f5f3ef" : "#191817";
  const muted = mix(colors.background, ink, dark ? 0.62 : 0.58);
  const line = mix(colors.background, ink, dark ? 0.20 : 0.14);
  const soft = mix(colors.background, ink, dark ? 0.08 : 0.035);
  const readableAccent = ensureContrast(colors.accent, colors.background, 3.2);
  const root = document.documentElement;
  root.dataset.mode = theme.mode;
  root.style.colorScheme = theme.mode;
  root.style.setProperty("--paper", colors.background);
  root.style.setProperty("--ink", ink);
  root.style.setProperty("--muted", muted);
  root.style.setProperty("--line", line);
  root.style.setProperty("--soft", soft);
  root.style.setProperty("--accent", readableAccent);
  root.style.setProperty("--accent-dark", mix(readableAccent, dark ? "#ffffff" : "#000000", 0.18));
  root.style.setProperty("--accent-contrast", luminance(readableAccent) > 0.45 ? "#111111" : "#ffffff");
  root.style.setProperty("--header-bg", hexToRgba(colors.background, 0.96));
  renderThemeControls();
}

function renderThemeControls() {
  if (!els.backgroundSwatches) return;
  const current = theme[theme.mode];
  document.querySelectorAll("[data-mode-choice]").forEach((button) => {
    const active = button.dataset.modeChoice === theme.mode;
    button.classList.toggle("active", active); button.setAttribute("aria-pressed", String(active));
  });
  els.backgroundSwatches.innerHTML = palettes[theme.mode].backgrounds.map((item) => swatch("background", item, current.background)).join("");
  els.accentSwatches.innerHTML = palettes[theme.mode].accents.map((item) => swatch("accent", item, current.accent)).join("");
  els.backgroundColor.value = normalizeHex(current.background);
  els.accentColor.value = normalizeHex(current.accent);
}

function swatch(kind, item, selected) {
  const active = item.value.toLowerCase() === selected.toLowerCase();
  return `<button class="color-swatch ${active ? "active" : ""}" type="button" data-color-kind="${kind}" data-color="${item.value}" aria-label="${item.name}" aria-pressed="${active}" title="${item.name}"><span style="background:${item.value}"></span><small>${item.name}</small></button>`;
}

function normalizeHex(value) { return /^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"; }
function hexRgb(hex) { const value = normalizeHex(hex).slice(1); return [0, 2, 4].map((i) => Number.parseInt(value.slice(i, i + 2), 16)); }
function rgbHex(rgb) { return `#${rgb.map((value) => Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, "0")).join("")}`; }
function mix(from, to, amount) { const a = hexRgb(from); const b = hexRgb(to); return rgbHex(a.map((value, index) => value + (b[index] - value) * amount)); }
function luminance(hex) { const parts = hexRgb(hex).map((value) => { const channel = value / 255; return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4; }); return parts[0] * 0.2126 + parts[1] * 0.7152 + parts[2] * 0.0722; }
function contrast(a, b) { const l1 = luminance(a); const l2 = luminance(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); }
function ensureContrast(accent, background, target) { let value = accent; const toward = luminance(background) < 0.36 ? "#ffffff" : "#000000"; for (let step = 0; step < 12 && contrast(value, background) < target; step += 1) value = mix(value, toward, 0.12); return value; }
function hexToRgba(hex, alpha) { const [r, g, b] = hexRgb(hex); return `rgba(${r},${g},${b},${alpha})`; }

function loadState() {
  try {
    return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY)));
  } catch (_) {}
  return normalizeState({});
}

function previewState() {
  const now = new Date();
  const earlier = new Date(now.getTime() - 4 * 86400000);
  const book = (id, title, author, read, total, chapter, days, order) => ({ id, title, author, chaptersRead: read, totalChapters: total, progress: read / total * 100, libraryOrder: order, bookUrl: `https://novelfire.net/book/${id}`, chapterUrl: `https://novelfire.net/book/${id}/chapter-${read}`, chapterTitle: chapter, firstSeenAt: earlier.toISOString(), updatedAt: new Date(now.getTime() - days * 86400000).toISOString() });
  const library = [
    book("reverend-insanity", "Reverend Insanity", "Gu Zhen Ren", 108, 200, "Chapter 108: Phoenix", 0, 1),
    book("lord-of-mysteries", "Lord of the Mysteries", "Cuttlefish That Loves Diving", 89, 100, "Chapter 89: The Door", 1, 2),
    book("legendary-mechanic", "The Legendary Mechanic", "Chocolion", 63, 120, "Chapter 63: Departure", 2, 3),
    book("release-that-witch", "Release That Witch", "Er Mu", 44, 90, "Chapter 44: Border Town", 3, 4)
  ];
  return normalizeState({ version: 1, generatedAt: now.toISOString(), library, history: [{ id: "preview-event", importedAt: now.toISOString(), bookId: library[0].id, title: library[0].title, fromChapter: 100, toChapter: 108, chapterTitle: library[0].chapterTitle, chapterUrl: library[0].chapterUrl, bookUrl: library[0].bookUrl }], imports: [{ id: now.toISOString(), importedAt: now.toISOString(), fileName: "novel-phoenix-latest.csv", novelCount: 4, changes: 1 }, { id: earlier.toISOString(), importedAt: earlier.toISOString(), fileName: "novel-phoenix-previous.csv", novelCount: 4, changes: 0 }] });
}

function saveState() {
  if (!isPreview) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

async function loadPublishedState(force = false) {
  if (isPreview || (dataSource === "local" && !force)) return;
  try {
    const response = await fetch("./data/library.json", { cache: "no-store", headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Public library returned ${response.status}.`);
    state = normalizeState(await response.json());
    dataSource = "public";
  } catch (error) {
    state = normalizeState({});
    dataSource = "error";
    console.error("Could not load the public library.", error);
  }
  render();
}

async function importFile(file) {
  if (!file) return;
  try {
    const rows = parseCsv(await file.text());
    if (!rows.length) throw new Error("No readable novels were found in this CSV.");
    const importedAt = new Date().toISOString();
    const result = mergeSnapshot(state, rows, { importedAt, fileName: file.name });
    state = result.state;
    dataSource = "local";
    saveState(); render(); showToast(`${rows.length} novels imported - ${result.changes} progress ${result.changes === 1 ? "change" : "changes"}`);
    els.csvFile.value = "";
  } catch (error) { showToast(error.message || "This file could not be imported.", true); }
}

function filteredLibrary() {
  const query = els.search.value.trim().toLowerCase();
  const rows = state.library.filter((book) => `${book.title} ${book.author} ${book.chapterTitle}`.toLowerCase().includes(query));
  return rows.sort((a, b) => {
    if (els.sort.value === "title-asc") return a.title.localeCompare(b.title);
    if (els.sort.value === "title-desc") return b.title.localeCompare(a.title);
    if (els.sort.value === "progress-desc") return b.progress - a.progress || a.title.localeCompare(b.title);
    return new Date(b.updatedAt) - new Date(a.updatedAt) || b.chaptersRead - a.chaptersRead;
  });
}

function render() {
  const books = state.library;
  const visible = filteredLibrary();
  els.books.textContent = books.length.toLocaleString();
  els.read.textContent = books.reduce((sum, book) => sum + book.chaptersRead, 0).toLocaleString();
  els.average.textContent = `${(books.length ? books.reduce((sum, book) => sum + book.progress, 0) / books.length : 0).toFixed(1)}%`;
  els.resultsCount.textContent = `${visible.length} ${visible.length === 1 ? "novel" : "novels"}`;
  els.empty.classList.toggle("hidden", books.length > 0);
  els.body.innerHTML = visible.map(bookRow).join("");
  renderDataStatus(); renderLastRead(); renderHistory(); renderImports();
}

function renderDataStatus() {
  const labels = {
    preview: "Preview data",
    local: "Local draft - not published",
    loading: "Loading public library...",
    error: "Public library unavailable",
    public: state.generatedAt ? `Public library - updated ${formatDate(state.generatedAt)}` : "Public library"
  };
  els.dataStatus.textContent = labels[dataSource] || labels.public;
  els.dataStatus.dataset.source = dataSource;
  els.draftActions.classList.toggle("hidden", dataSource !== "local");
  els.publishedNotice.classList.toggle("hidden", dataSource === "local");
}

function bookRow(book) {
  return `<tr><td><a class="title-link" ${href(book.bookUrl)}>${escapeHtml(book.title)}</a></td><td>${escapeHtml(book.author || "Unknown")}</td><td><div class="progress-cell"><span>${book.progress.toFixed(1)}%</span><i><b style="width:${clamp(book.progress)}%"></b></i><small>${book.chaptersRead.toLocaleString()} / ${book.totalChapters.toLocaleString()}</small></div></td><td><a class="chapter-link" ${href(book.chapterUrl)}>${escapeHtml(book.chapterTitle || "Not recorded")}</a><small class="date">${formatDate(book.updatedAt)}</small></td><td><div class="row-links">${book.chapterUrl ? `<a ${href(book.chapterUrl)}>Continue</a>` : ""}${book.bookUrl ? `<a ${href(book.bookUrl)}>Novel page</a>` : ""}</div></td></tr>`;
}

function renderLastRead() {
  const event = state.history[0];
  const orderedBook = [...state.library].sort((a, b) => a.libraryOrder - b.libraryOrder)[0];
  const book = event
    ? state.library.find((item) => item.id === event.bookId)
    : orderedBook?.exportedAt ? orderedBook : null;
  if (!book) {
    const hasLibrary = state.library.length > 0;
    els.lastTime.textContent = hasLibrary ? "Not available in the legacy export" : "No reading activity yet";
    els.lastCard.innerHTML = `<div class="book-glyph" aria-hidden="true">P</div><div class="last-title"><h2>${hasLibrary ? "Activity order unavailable" : "No published novels yet"}</h2><p>${hasLibrary ? "The first new-format snapshot will establish the latest read." : "Import a NovelFire snapshot to create a local draft."}</p></div><div class="last-detail"><span>Last chapter</span><strong>-</strong><small>-</small></div><div class="last-detail"><span>Progress</span><strong>-</strong><small>-</small></div><div class="last-actions"></div>`;
    return;
  }
  els.lastTime.textContent = `Updated ${formatDate(book.updatedAt)}`;
  els.lastCard.innerHTML = `<div class="book-glyph" aria-hidden="true">P</div><div class="last-title"><h2>${escapeHtml(book.title)}</h2><p>${escapeHtml(book.author || "Unknown author")}</p></div><div class="last-detail"><span>Last chapter</span><strong>${escapeHtml(book.chapterTitle || `Chapter ${book.chaptersRead}`)}</strong><small>${book.chaptersRead.toLocaleString()} chapters read</small></div><div class="last-detail"><span>Progress</span><strong class="accent">${book.progress.toFixed(1)}%</strong><small>${book.chaptersRead.toLocaleString()} / ${book.totalChapters.toLocaleString()} chapters</small></div><div class="last-actions">${book.chapterUrl ? `<a ${href(book.chapterUrl)}>Continue reading &rarr;</a>` : ""}${book.bookUrl ? `<a ${href(book.bookUrl)}>Novel page &nearr;</a>` : ""}</div>`;
}

function renderHistory() {
  els.history.innerHTML = state.history.length ? state.history.map((event) => `<article class="timeline-item"><time>${formatDate(event.importedAt)}</time><div><h2>${escapeHtml(event.title)}</h2><p>Advanced from chapter ${event.fromChapter.toLocaleString()} to ${event.toChapter.toLocaleString()}.</p><div class="inline-links">${event.chapterUrl ? `<a ${href(event.chapterUrl)}>${escapeHtml(event.chapterTitle || "Open last read chapter")}</a>` : ""}${event.bookUrl ? `<a ${href(event.bookUrl)}>Novel page &nearr;</a>` : ""}</div></div></article>`).join("") : emptyMessage("No reading changes yet", "Import a newer snapshot after you have read more chapters.");
}

function renderImports() {
  els.imports.innerHTML = state.imports.length ? state.imports.map((item, index) => `<article class="timeline-item ${index === 0 ? "current" : ""}"><time>${formatDate(item.importedAt)}</time><div><h2>${item.novelCount.toLocaleString()} novels imported</h2><p>${item.changes} progress ${item.changes === 1 ? "change" : "changes"} - ${escapeHtml(item.fileName || item.label || "NovelFire snapshot")}</p></div></article>`).join("") : emptyMessage("No imports yet", "Your snapshot history will appear here.");
}

function emptyMessage(title, body) { return `<div class="empty compact"><h2>${title}</h2><p>${body}</p></div>`; }
function href(url) { return url ? `href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer"` : "aria-disabled=\"true\""; }
function clamp(value) { return Math.max(0, Math.min(100, value)); }
function escapeHtml(value) { return String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]); }
function formatDate(value) { if (!value) return "Not recorded"; return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function showToast(message, error = false) { els.toast.textContent = message; els.toast.classList.toggle("error", error); els.toast.classList.add("show"); clearTimeout(showToast.timer); showToast.timer = setTimeout(() => els.toast.classList.remove("show"), 3600); }

function downloadPublicData() {
  const contents = `${JSON.stringify(createPublicSnapshot(state), null, 2)}\n`;
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([contents], { type: "application/json" }));
  link.download = "library.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  showToast("Publish-ready library.json downloaded.");
}

async function clearLocalDraft() {
  localStorage.removeItem(STORAGE_KEY);
  state = normalizeState({});
  dataSource = "loading";
  render();
  await loadPublishedState(true);
  showToast("Showing the public library again.");
}

function setThemeColor(kind, value) { theme[theme.mode][kind] = value; saveTheme(); applyTheme(); }
function toggleThemePanel(force) {
  const open = typeof force === "boolean" ? force : els.themePanel.classList.contains("hidden");
  els.themePanel.classList.toggle("hidden", !open); els.themeButton.setAttribute("aria-expanded", String(open));
}

function openPicker() { els.csvFile.click(); }
els.importButton.addEventListener("click", openPicker);
els.emptyImportButton.addEventListener("click", openPicker);
els.csvFile.addEventListener("change", (event) => importFile(event.target.files?.[0]));
els.downloadData.addEventListener("click", downloadPublicData);
els.clearDraft.addEventListener("click", clearLocalDraft);
els.search.addEventListener("input", render);
els.sort.addEventListener("change", render);
els.themeButton.addEventListener("click", () => toggleThemePanel());
els.closeTheme.addEventListener("click", () => toggleThemePanel(false));
document.querySelectorAll("[data-mode-choice]").forEach((button) => button.addEventListener("click", () => { theme.mode = button.dataset.modeChoice; saveTheme(); applyTheme(); }));
els.themePanel.addEventListener("click", (event) => { event.stopPropagation(); const button = event.target.closest("[data-color-kind]"); if (button) setThemeColor(button.dataset.colorKind, button.dataset.color); });
els.backgroundColor.addEventListener("input", (event) => setThemeColor("background", event.target.value));
els.accentColor.addEventListener("input", (event) => setThemeColor("accent", event.target.value));
els.resetTheme.addEventListener("click", () => { theme[theme.mode] = theme.mode === "light" ? { background: "#fdfdfc", accent: "#c83b12" } : { background: "#111210", accent: "#ed6a3d" }; saveTheme(); applyTheme(); });
document.addEventListener("click", (event) => { if (!els.themePanel.classList.contains("hidden") && !event.target.closest(".header-actions")) toggleThemePanel(false); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape") toggleThemePanel(false); });
document.querySelectorAll(".nav-link").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll(".nav-link").forEach((item) => item.classList.toggle("active", item === button));
  document.querySelectorAll(".view").forEach((view) => view.classList.add("hidden"));
  $(`${button.dataset.view}View`).classList.remove("hidden");
  location.hash = button.dataset.view;
}));
["dragenter", "dragover"].forEach((type) => els.drop.addEventListener(type, (event) => { event.preventDefault(); els.drop.classList.add("dragover"); }));
["dragleave", "drop"].forEach((type) => els.drop.addEventListener(type, (event) => { event.preventDefault(); els.drop.classList.remove("dragover"); }));
els.drop.addEventListener("drop", (event) => importFile(event.dataTransfer.files?.[0]));

const initialView = location.hash.slice(1);
if (["history", "imports"].includes(initialView)) document.querySelector(`[data-view="${initialView}"]`).click();
applyTheme();
render();
loadPublishedState();
