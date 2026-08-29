import test from "node:test";
import assert from "node:assert/strict";
import PptxGenJS from "pptxgenjs";
import { inspectPptx, titleFromFilename } from "./pptx-meta.js";

async function makePptx({ title, slides }) {
  const pptx = new PptxGenJS();
  if (title) pptx.title = title;
  pptx.defineLayout({ name: "WIDE", width: 13.333, height: 7.5 });
  pptx.layout = "WIDE";
  for (const slide of slides) {
    const s = pptx.addSlide();
    s.background = { color: "1A1410" };
    s.addText(slide, {
      x: 0.8,
      y: 2.8,
      w: 11.7,
      h: 1.4,
      fontSize: 40,
      color: "F3E6D6",
      align: "center",
    });
  }
  return pptx.write({ outputType: "nodebuffer" });
}

test("inspectPptx reads slide count and document title", async () => {
  const buffer = await makePptx({
    title: "Garden Notes",
    slides: ["Beds to water", "Seeds to order"],
  });
  const info = await inspectPptx(buffer);
  assert.equal(info.slideCount, 2);
  assert.equal(info.title, "Garden Notes");
});

test("inspectPptx falls back to first slide text", async () => {
  const buffer = await makePptx({
    title: "",
    slides: ["Evening light", "Second thought"],
  });
  const info = await inspectPptx(buffer);
  assert.equal(info.slideCount, 2);
  assert.equal(info.title, "Evening light");
});

test("inspectPptx rejects empty archives", async () => {
  await assert.rejects(() => inspectPptx(Buffer.from("not a zip")), /./);
});

test("titleFromFilename cleans the original name", () => {
  assert.equal(titleFromFilename("q3_team-update.pptx"), "q3 team update");
});
