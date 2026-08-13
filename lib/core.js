export const STATE_VERSION = 1;
export const MAX_HISTORY = 1000;
export const MAX_IMPORTS = 100;

export function parseCsv(text) {
  const records = [];
  let cell = "";
  let row = [];
  let quoted = false;

  for (let index = 0; index < String(text || "").length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value !== "")) records.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }

  row.push(cell);
  if (row.some((value) => value !== "")) records.push(row);
  if (records.length < 2) return [];

  const headers = records.shift().map((value) => value.trim());
  return records
    .map((values, index) => normalizeRow(Object.fromEntries(headers.map((header, column) => [header, (values[column] || "").trim()])), index))
    .filter((book) => book.title);
}

export function normalizeRow(row, fallbackOrder = 0) {
  const chaptersRead = integer(row["Chapters read"] || row["Chapters I have read"]);
  const totalChapters = integer(row["Total chapters"] || row["Chapter amount"]);
  const suppliedProgress = Number.parseFloat(row["Progress (%)"]);
  const bookUrl = safeUrl(row["Book URL"]);

  return {
    id: canonicalUrl(bookUrl) || String(row.Title || "").trim().toLowerCase(),
    title: String(row.Title || "").trim(),
    author: String(row.Author || "").trim(),
    bookUrl,
    chapterTitle: String(row["Last read chapter"] || row["Last chapter title"] || "").trim(),
    chapterUrl: safeUrl(row["Last read URL"] || row["Last chapter URL"]),
    chaptersRead,
    totalChapters,
    progress: clamp(Number.isFinite(suppliedProgress) ? suppliedProgress : (totalChapters ? chaptersRead / totalChapters * 100 : 0), 0, 100),
    libraryOrder: integer(row["Library order"]) || fallbackOrder + 1,
    exportedAt: validDate(row["Exported at"]) || ""
  };
}

export function normalizeState(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    version: STATE_VERSION,
    generatedAt: validDate(source.generatedAt) || null,
    library: Array.isArray(source.library) ? source.library.map(normalizeBook).filter((book) => book.title) : [],
    history: Array.isArray(source.history) ? source.history.map(normalizeHistoryEvent).filter((event) => event.title).slice(0, MAX_HISTORY) : [],
    imports: Array.isArray(source.imports) ? source.imports.map(normalizeImport).filter((item) => item.importedAt).slice(0, MAX_IMPORTS) : []
  };
}

export function mergeSnapshot(currentState, rows, options = {}) {
  const current = normalizeState(currentState);
  const importedAt = validDate(options.importedAt) || new Date().toISOString();
  const fileName = cleanFileName(options.fileName) || "NovelFire snapshot";
  const previous = new Map(current.library.map((book) => [book.id, book]));
  const changes = [];

  const library = rows.map((input, index) => {
    const book = normalizeBook({ ...input, libraryOrder: input.libraryOrder || index + 1 });
    const old = previous.get(book.id);
    const advanced = Boolean(old && book.chaptersRead > old.chaptersRead);
    const chapterChanged = Boolean(old && book.chapterUrl && book.chapterUrl !== old.chapterUrl);
    const changed = !old || advanced || chapterChanged;

    if (advanced) {
      changes.push({
        id: randomId(importedAt, index),
        importedAt,
        bookId: book.id,
        title: book.title,
        fromChapter: old.chaptersRead,
        toChapter: book.chaptersRead,
        chapterTitle: book.chapterTitle,
        chapterUrl: book.chapterUrl,
        bookUrl: book.bookUrl
      });
    }

    return {
      ...book,
      firstSeenAt: old?.firstSeenAt || importedAt,
      updatedAt: changed ? importedAt : old?.updatedAt || importedAt
    };
  });

  const next = {
    version: STATE_VERSION,
    generatedAt: importedAt,
    library,
    history: [...changes.reverse(), ...current.history].slice(0, MAX_HISTORY),
    imports: [{ id: importedAt, importedAt, fileName, novelCount: library.length, changes: changes.length }, ...current.imports].slice(0, MAX_IMPORTS)
  };

  return { state: next, changes: changes.length };
}

export function createPublicSnapshot(value, generatedAt = new Date().toISOString()) {
  const state = normalizeState(value);
  return {
    version: STATE_VERSION,
    generatedAt: validDate(generatedAt) || new Date().toISOString(),
    library: state.library,
    history: state.history,
    imports: state.imports.map(({ fileName: _fileName, ...item }) => ({ ...item, label: "NovelFire snapshot" }))
  };
}

export function safeUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
  } catch (_) {
    return "";
  }
}

function normalizeBook(value) {
  const bookUrl = safeUrl(value?.bookUrl);
  const chaptersRead = integer(value?.chaptersRead);
  const totalChapters = integer(value?.totalChapters);
  return {
    id: String(value?.id || canonicalUrl(bookUrl) || value?.title || "").trim().toLowerCase(),
    title: String(value?.title || "").trim().slice(0, 500),
    author: String(value?.author || "").trim().slice(0, 300),
    bookUrl,
    chapterTitle: String(value?.chapterTitle || "").trim().slice(0, 500),
    chapterUrl: safeUrl(value?.chapterUrl),
    chaptersRead,
    totalChapters,
    progress: clamp(number(value?.progress, totalChapters ? chaptersRead / totalChapters * 100 : 0), 0, 100),
    libraryOrder: integer(value?.libraryOrder) || 1,
    exportedAt: validDate(value?.exportedAt) || "",
    firstSeenAt: validDate(value?.firstSeenAt) || "",
    updatedAt: validDate(value?.updatedAt) || ""
  };
}

function normalizeHistoryEvent(value) {
  return {
    id: String(value?.id || ""),
    importedAt: validDate(value?.importedAt) || "",
    bookId: String(value?.bookId || ""),
    title: String(value?.title || "").trim().slice(0, 500),
    fromChapter: integer(value?.fromChapter),
    toChapter: integer(value?.toChapter),
    chapterTitle: String(value?.chapterTitle || "").trim().slice(0, 500),
    chapterUrl: safeUrl(value?.chapterUrl),
    bookUrl: safeUrl(value?.bookUrl)
  };
}

function normalizeImport(value) {
  return {
    id: String(value?.id || value?.importedAt || ""),
    importedAt: validDate(value?.importedAt) || "",
    fileName: cleanFileName(value?.fileName),
    label: String(value?.label || "").trim().slice(0, 100),
    novelCount: integer(value?.novelCount),
    changes: integer(value?.changes)
  };
}

function canonicalUrl(value) { return safeUrl(value).replace(/\/$/, "").toLowerCase(); }
function integer(value) { return Math.max(0, Number.parseInt(value || "0", 10) || 0); }
function number(value, fallback = 0) { const parsed = Number.parseFloat(value); return Number.isFinite(parsed) ? parsed : fallback; }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function validDate(value) { const date = new Date(value || ""); return Number.isNaN(date.getTime()) ? "" : date.toISOString(); }
function cleanFileName(value) { return String(value || "").replace(/[\\/:*?"<>|]/g, "-").trim().slice(0, 180); }
function randomId(prefix, index) { return globalThis.crypto?.randomUUID?.() || `${prefix}-${index}`; }
