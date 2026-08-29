import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export function createStore(dataDir) {
  const indexPath = path.join(dataDir, "index.json");
  let writeQueue = Promise.resolve();

  async function ensureDir() {
    await fs.mkdir(dataDir, { recursive: true });
  }

  async function readIndex() {
    try {
      const raw = await fs.readFile(indexPath, "utf8");
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      if (err.code === "ENOENT") return [];
      throw err;
    }
  }

  async function writeIndex(decks) {
    await ensureDir();
    const temp = `${indexPath}.${process.pid}.tmp`;
    await fs.writeFile(temp, JSON.stringify(decks, null, 2));
    await fs.rename(temp, indexPath);
  }

  function withLock(fn) {
    const next = writeQueue.then(fn, fn);
    writeQueue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  function deckDir(id) {
    return path.join(dataDir, "decks", id);
  }

  return {
    dataDir,
    deckDir,
    async list() {
      const decks = await readIndex();
      return [...decks].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
      );
    },
    async get(id) {
      const decks = await readIndex();
      return decks.find((deck) => deck.id === id) || null;
    },
    async create(record, files) {
      return withLock(async () => {
        const id = randomUUID();
        const dir = deckDir(id);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(path.join(dir, "deck.pptx"), files.pptx);
        if (files.thumbnail) {
          const ext = files.thumbnailType === "image/png" ? "png" : "jpg";
          await fs.writeFile(path.join(dir, `thumbnail.${ext}`), files.thumbnail);
        } else if (files.placeholder) {
          await fs.writeFile(path.join(dir, "thumbnail.svg"), files.placeholder);
        }
        const deck = {
          id,
          ...record,
          createdAt: new Date().toISOString(),
        };
        const decks = await readIndex();
        decks.push(deck);
        await writeIndex(decks);
        return deck;
      });
    },
    async update(id, patch) {
      return withLock(async () => {
        const decks = await readIndex();
        const index = decks.findIndex((deck) => deck.id === id);
        if (index === -1) return null;
        decks[index] = { ...decks[index], ...patch, updatedAt: new Date().toISOString() };
        await writeIndex(decks);
        return decks[index];
      });
    },
    async remove(id) {
      return withLock(async () => {
        const decks = await readIndex();
        const next = decks.filter((deck) => deck.id !== id);
        if (next.length === decks.length) return false;
        await writeIndex(next);
        await fs.rm(deckDir(id), { recursive: true, force: true });
        return true;
      });
    },
    async filePath(id, name) {
      return path.join(deckDir(id), name);
    },
  };
}

export function publicDeck(deck) {
  if (!deck) return null;
  return {
    id: deck.id,
    title: deck.title,
    originalName: deck.originalName,
    slideCount: deck.slideCount,
    intervalSeconds: deck.intervalSeconds,
    createdAt: deck.createdAt,
    updatedAt: deck.updatedAt || null,
    size: deck.size,
    hasThumbnail: Boolean(deck.hasThumbnail),
    thumbnailUrl: `/api/decks/${deck.id}/thumbnail`,
  };
}
