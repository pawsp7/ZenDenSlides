import express from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createStore, publicDeck } from "./store.js";
import {
  inspectPptx,
  placeholderThumbnail,
  titleFromFilename,
} from "./pptx-meta.js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MAX_FILE_BYTES = 80 * 1024 * 1024;

function clampInterval(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 5;
  return Math.min(60, Math.max(1, Math.round(n * 10) / 10));
}

function isPptx(file) {
  const name = (file.originalname || "").toLowerCase();
  if (name.endsWith(".ppt") && !name.endsWith(".pptx")) return false;
  return (
    name.endsWith(".pptx") ||
    file.mimetype ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  );
}

export function createApp({ dataDir } = {}) {
  const store = createStore(dataDir || path.join(rootDir, "data"));
  const app = express();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_BYTES, files: 12 },
    fileFilter(req, file, cb) {
      if (isPptx(file)) {
        cb(null, true);
        return;
      }
      cb(new Error("Please upload a .pptx file (legacy .ppt is not supported)."));
    },
  });

  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (req, res) => {
    res.json({ ok: true, name: "ZenDen Slides" });
  });

  app.get("/api/decks", async (req, res, next) => {
    try {
      const decks = await store.list();
      res.json(decks.map(publicDeck));
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/decks", upload.array("files", 12), async (req, res, next) => {
    try {
      const incoming = req.files?.length
        ? req.files
        : req.file
          ? [req.file]
          : [];
      if (incoming.length === 0) {
        res.status(400).json({ error: "Choose one or more PowerPoint (.pptx) files." });
        return;
      }

      const intervalSeconds = clampInterval(req.body.intervalSeconds);
      const created = [];

      for (const file of incoming) {
        const info = await inspectPptx(file.buffer);
        const title =
          (req.body.title && incoming.length === 1 ? String(req.body.title) : "") ||
          info.title ||
          titleFromFilename(file.originalname) ||
          "Untitled deck";
        const deck = await store.create(
          {
            title,
            originalName: file.originalname,
            slideCount: info.slideCount,
            intervalSeconds,
            size: file.size,
            hasThumbnail: Boolean(info.thumbnail) || true,
            thumbnailType: info.thumbnailType || "image/svg+xml",
          },
          {
            pptx: file.buffer,
            thumbnail: info.thumbnail,
            thumbnailType: info.thumbnailType,
            placeholder: info.thumbnail
              ? null
              : placeholderThumbnail(title, info.slideCount),
          },
        );
        created.push(publicDeck(deck));
      }

      res.status(201).json(created.length === 1 ? created[0] : created);
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/decks/:id", async (req, res, next) => {
    try {
      const deck = publicDeck(await store.get(req.params.id));
      if (!deck) {
        res.status(404).json({ error: "Deck not found." });
        return;
      }
      res.json(deck);
    } catch (err) {
      next(err);
    }
  });

  app.patch("/api/decks/:id", async (req, res, next) => {
    try {
      const patch = {};
      if (req.body.title != null) {
        const title = String(req.body.title).trim().slice(0, 200);
        if (!title) {
          res.status(400).json({ error: "Title cannot be empty." });
          return;
        }
        patch.title = title;
      }
      if (req.body.intervalSeconds != null) {
        patch.intervalSeconds = clampInterval(req.body.intervalSeconds);
      }
      if (Object.keys(patch).length === 0) {
        res.status(400).json({ error: "Nothing to update." });
        return;
      }
      const deck = publicDeck(await store.update(req.params.id, patch));
      if (!deck) {
        res.status(404).json({ error: "Deck not found." });
        return;
      }
      res.json(deck);
    } catch (err) {
      next(err);
    }
  });

  app.delete("/api/decks/:id", async (req, res, next) => {
    try {
      const removed = await store.remove(req.params.id);
      if (!removed) {
        res.status(404).json({ error: "Deck not found." });
        return;
      }
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/decks/:id/file", async (req, res, next) => {
    try {
      const deck = await store.get(req.params.id);
      if (!deck) {
        res.status(404).json({ error: "Deck not found." });
        return;
      }
      const filePath = await store.filePath(req.params.id, "deck.pptx");
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      );
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${encodeURIComponent(deck.originalName || "deck.pptx")}"`,
      );
      res.sendFile(filePath);
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/decks/:id/thumbnail", async (req, res, next) => {
    try {
      const deck = await store.get(req.params.id);
      if (!deck) {
        res.status(404).json({ error: "Deck not found." });
        return;
      }
      const dir = store.deckDir(req.params.id);
      const candidates = [
        ["thumbnail.jpg", "image/jpeg"],
        ["thumbnail.png", "image/png"],
        ["thumbnail.svg", "image/svg+xml"],
      ];
      for (const [name, type] of candidates) {
        const filePath = path.join(dir, name);
        if (existsSync(filePath)) {
          res.setHeader("Cache-Control", "public, max-age=3600");
          res.type(type);
          res.sendFile(filePath);
          return;
        }
      }
      res.type("image/svg+xml");
      res.send(placeholderThumbnail(deck.title, deck.slideCount));
    } catch (err) {
      next(err);
    }
  });

  if (process.env.NODE_ENV === "production") {
    const distDir = path.join(rootDir, "dist");
    app.use(express.static(distDir));
    app.get(/^(?!\/api).*/, async (req, res, next) => {
      try {
        res.sendFile(path.join(distDir, "index.html"));
      } catch (err) {
        next(err);
      }
    });
  }

  app.use((err, req, res, next) => {
    if (res.headersSent) {
      next(err);
      return;
    }
    const status = err.status || (err instanceof multer.MulterError ? 400 : 400);
    const message =
      err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE"
        ? "That file is larger than the 80 MB limit."
        : err.message || "Upload failed.";
    res.status(status).json({ error: message });
  });

  return app;
}

const isDirectRun =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isDirectRun) {
  const port = Number(process.env.PORT) || 3000;
  const dataDir = process.env.DATA_DIR || path.join(rootDir, "data");
  await fs.mkdir(dataDir, { recursive: true });
  const app = createApp({ dataDir });
  app.listen(port, "0.0.0.0", () => {
    console.log(`ZenDen Slides listening on http://0.0.0.0:${port}`);
  });
}
