import PptxGenJS from "pptxgenjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const outDir =
  process.argv[2] ||
  path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "tmp-samples");

fs.mkdirSync(outDir, { recursive: true });

function styleSlide(slide, background) {
  slide.background = { color: background };
}

async function writeDeck(filename, title, builder) {
  const pptx = new PptxGenJS();
  pptx.title = title;
  pptx.author = "ZenDen";
  pptx.defineLayout({ name: "WIDE", width: 13.333, height: 7.5 });
  pptx.layout = "WIDE";
  builder(pptx);
  const dest = path.join(outDir, filename);
  await pptx.writeFile({ fileName: dest });
  return dest;
}

await writeDeck("evening-in-the-den.pptx", "Evening in the Den", (pptx) => {
  const one = pptx.addSlide();
  styleSlide(one, "191511");
  one.addShape(pptx.ShapeType.roundRect, {
    x: 0.6,
    y: 0.6,
    w: 12.1,
    h: 6.3,
    fill: { color: "241C16" },
    rectRadius: 0.15,
    line: { color: "C4784A", transparency: 50, width: 1 },
  });
  one.addText("Evening in the Den", {
    x: 1,
    y: 2.3,
    w: 11.3,
    h: 1.2,
    fontSize: 44,
    fontFace: "Georgia",
    color: "F3E6D6",
    align: "center",
  });
  one.addText("A short walk through unhurried slides.", {
    x: 1,
    y: 3.6,
    w: 11.3,
    h: 0.6,
    fontSize: 20,
    color: "B5A394",
    align: "center",
  });

  const two = pptx.addSlide();
  styleSlide(two, "1F1814");
  two.addText("Set the pace", {
    x: 0.9,
    y: 1.4,
    w: 11,
    h: 0.8,
    fontSize: 36,
    color: "E8945A",
  });
  two.addText(
    "Each deck can advance on its own clock — a few seconds for a glance, or a long hold for a room that is still settling.",
    {
      x: 0.9,
      y: 2.5,
      w: 11,
      h: 2.2,
      fontSize: 22,
      color: "F3E6D6",
    },
  );

  const three = pptx.addSlide();
  styleSlide(three, "1A2218");
  three.addShape(pptx.ShapeType.ellipse, {
    x: 9.6,
    y: 0.8,
    w: 2.6,
    h: 2.6,
    fill: { color: "6B8F71" },
  });
  three.addText("Browse the shelf", {
    x: 0.9,
    y: 2.2,
    w: 8,
    h: 0.9,
    fontSize: 36,
    color: "F3E6D6",
  });
  three.addText(
    "Keep several PowerPoints in the den. Open one, step to another, and come back when you are ready.",
    {
      x: 0.9,
      y: 3.3,
      w: 8.6,
      h: 2,
      fontSize: 20,
      color: "C5D0B8",
    },
  );

  const four = pptx.addSlide();
  styleSlide(four, "191511");
  four.addText("That’s the whole ritual.", {
    x: 0.9,
    y: 2.7,
    w: 11.5,
    h: 1.2,
    fontSize: 36,
    color: "F3E6D6",
    align: "center",
  });
  four.addText("Upload. Choose a rate. Let the slides unfold.", {
    x: 0.9,
    y: 4,
    w: 11.5,
    h: 0.6,
    fontSize: 18,
    color: "B5A394",
    align: "center",
  });
});

await writeDeck("garden-notes.pptx", "Garden Notes", (pptx) => {
  const one = pptx.addSlide();
  styleSlide(one, "132018");
  one.addText("Garden Notes", {
    x: 0.8,
    y: 2.6,
    w: 11.7,
    h: 1,
    fontSize: 42,
    color: "E8F0DC",
    align: "center",
  });
  one.addText("What to tend this week", {
    x: 0.8,
    y: 3.7,
    w: 11.7,
    h: 0.5,
    fontSize: 18,
    color: "8A9A6D",
    align: "center",
  });

  const two = pptx.addSlide();
  styleSlide(two, "1B241C");
  two.addShape(pptx.ShapeType.roundRect, {
    x: 0.8,
    y: 1.6,
    w: 5.5,
    h: 4.2,
    fill: { color: "243028" },
    rectRadius: 0.1,
  });
  two.addText("Water", {
    x: 1.1,
    y: 2.1,
    w: 4.9,
    h: 0.6,
    fontSize: 28,
    color: "E8945A",
  });
  two.addText("Deep soak the citrus.\nMist the ferns at dusk.", {
    x: 1.1,
    y: 2.9,
    w: 4.9,
    h: 2,
    fontSize: 18,
    color: "E8F0DC",
  });
  two.addShape(pptx.ShapeType.roundRect, {
    x: 7,
    y: 1.6,
    w: 5.5,
    h: 4.2,
    fill: { color: "243028" },
    rectRadius: 0.1,
  });
  two.addText("Harvest", {
    x: 7.3,
    y: 2.1,
    w: 4.9,
    h: 0.6,
    fontSize: 28,
    color: "C4A35A",
  });
  two.addText("Cut basil before it flowers.\nLeave the late tomatoes.", {
    x: 7.3,
    y: 2.9,
    w: 4.9,
    h: 2,
    fontSize: 18,
    color: "E8F0DC",
  });

  const three = pptx.addSlide();
  styleSlide(three, "132018");
  three.addText("Leave the rest for rain.", {
    x: 0.8,
    y: 3.1,
    w: 11.7,
    h: 1,
    fontSize: 32,
    color: "E8F0DC",
    align: "center",
  });
});

console.log(`Wrote sample decks to ${outDir}`);
