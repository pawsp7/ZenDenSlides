import {
  inspectPptx,
  placeholderThumbnail,
  titleFromFilename,
} from "../../server/pptx-meta.js";

const DB_NAME = "zenden-slides";
const STORE = "decks";

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function withStore(mode, fn) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const store = tx.objectStore(STORE);
        const request = fn(store);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        tx.onerror = () => reject(tx.error);
      }),
  );
}

function bytesToDataUrl(bytes, mime) {
  const blob = new Blob([bytes], { type: mime });
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function publicRecord(record) {
  return {
    id: record.id,
    title: record.title,
    originalName: record.originalName,
    slideCount: record.slideCount,
    intervalSeconds: record.intervalSeconds,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt || null,
    size: record.size,
    hasThumbnail: true,
    thumbnailUrl: record.thumbnailUrl,
  };
}

function clampInterval(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 5;
  return Math.min(60, Math.max(1, Math.round(n * 10) / 10));
}

export async function listLocalDecks() {
  const records = (await withStore("readonly", (store) => store.getAll())) || [];
  return records
    .map(publicRecord)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export async function getLocalDeck(id) {
  const record = await withStore("readonly", (store) => store.get(id));
  return record ? publicRecord(record) : null;
}

export async function getLocalDeckFile(id) {
  const record = await withStore("readonly", (store) => store.get(id));
  if (!record) throw new Error("Deck not found.");
  return record.file;
}

export async function updateLocalDeck(id, patch) {
  const record = await withStore("readonly", (store) => store.get(id));
  if (!record) throw new Error("Deck not found.");
  const next = { ...record, ...patch, updatedAt: new Date().toISOString() };
  await withStore("readwrite", (store) => store.put(next));
  return publicRecord(next);
}

export async function deleteLocalDeck(id) {
  const record = await withStore("readonly", (store) => store.get(id));
  if (!record) throw new Error("Deck not found.");
  await withStore("readwrite", (store) => store.delete(id));
}

export async function uploadLocalDecks(files, intervalSeconds, onProgress) {
  const created = [];
  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    onProgress?.((i + 0.35) / files.length);
    const buffer = await file.arrayBuffer();
    const info = await inspectPptx(buffer);
    const title = info.title || titleFromFilename(file.name) || "Untitled deck";
    const thumbBytes = info.thumbnail || placeholderThumbnail(title, info.slideCount);
    const thumbType = info.thumbnailType || "image/svg+xml";
    const record = {
      id: crypto.randomUUID(),
      title,
      originalName: file.name,
      slideCount: info.slideCount,
      intervalSeconds: clampInterval(intervalSeconds),
      createdAt: new Date().toISOString(),
      updatedAt: null,
      size: file.size,
      file: buffer,
      thumbnailUrl: await bytesToDataUrl(thumbBytes, thumbType),
    };
    await withStore("readwrite", (store) => store.put(record));
    created.push(publicRecord(record));
    onProgress?.((i + 1) / files.length);
  }
  return created;
}
