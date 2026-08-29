import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import PptxGenJS from "pptxgenjs";
import { createApp } from "./index.js";

async function makePptx(title, slideCount) {
  const pptx = new PptxGenJS();
  pptx.title = title;
  for (let i = 0; i < slideCount; i += 1) {
    pptx.addSlide().addText(`${title} ${i + 1}`, {
      x: 1,
      y: 2,
      w: 8,
      h: 1,
      fontSize: 28,
    });
  }
  return pptx.write({ outputType: "nodebuffer" });
}

async function withServer(fn) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "zenden-"));
  const app = createApp({ dataDir });
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

test("upload, browse, play file, update pace, and delete", async () => {
  await withServer(async (base) => {
    const buffer = await makePptx("Lantern Talk", 3);
    const form = new FormData();
    form.append(
      "files",
      new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      }),
      "lantern-talk.pptx",
    );
    form.append("intervalSeconds", "4");

    const createdRes = await fetch(`${base}/api/decks`, {
      method: "POST",
      body: form,
    });
    assert.equal(createdRes.status, 201);
    const created = await createdRes.json();
    assert.equal(created.title, "Lantern Talk");
    assert.equal(created.slideCount, 3);
    assert.equal(created.intervalSeconds, 4);

    const list = await (await fetch(`${base}/api/decks`)).json();
    assert.equal(list.length, 1);
    assert.equal(list[0].id, created.id);

    const fileRes = await fetch(`${base}/api/decks/${created.id}/file`);
    assert.equal(fileRes.status, 200);
    const fileBuf = Buffer.from(await fileRes.arrayBuffer());
    assert.ok(fileBuf.length > 100);

    const thumbRes = await fetch(`${base}/api/decks/${created.id}/thumbnail`);
    assert.equal(thumbRes.status, 200);

    const patched = await (
      await fetch(`${base}/api/decks/${created.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intervalSeconds: 8, title: "Lantern Talk — final" }),
      })
    ).json();
    assert.equal(patched.intervalSeconds, 8);
    assert.equal(patched.title, "Lantern Talk — final");

    const deleted = await fetch(`${base}/api/decks/${created.id}`, {
      method: "DELETE",
    });
    assert.equal(deleted.status, 204);
    const empty = await (await fetch(`${base}/api/decks`)).json();
    assert.equal(empty.length, 0);
  });
});

test("rejects non-pptx uploads", async () => {
  await withServer(async (base) => {
    const form = new FormData();
    form.append("files", new Blob(["hello"], { type: "text/plain" }), "notes.txt");
    const res = await fetch(`${base}/api/decks`, { method: "POST", body: form });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /pptx/i);
  });
});

test("uploads several decks in one request", async () => {
  await withServer(async (base) => {
    const form = new FormData();
    for (const name of ["Cedar", "Moss"]) {
      const buffer = await makePptx(name, 2);
      form.append(
        "files",
        new Blob([buffer], {
          type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        }),
        `${name.toLowerCase()}.pptx`,
      );
    }
    form.append("intervalSeconds", "6");
    const res = await fetch(`${base}/api/decks`, { method: "POST", body: form });
    assert.equal(res.status, 201);
    const created = await res.json();
    assert.equal(created.length, 2);
    const list = await (await fetch(`${base}/api/decks`)).json();
    assert.equal(list.length, 2);
  });
});
