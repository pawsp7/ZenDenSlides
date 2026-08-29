import JSZip from "jszip";

const SLIDE_PATH = /^ppt\/slides\/slide(\d+)\.xml$/i;

function decodeXml(text) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function encodeXml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function firstMatch(xml, pattern) {
  const match = xml.match(pattern);
  return match ? decodeXml(match[1]).trim() : "";
}

function slideSort(a, b) {
  const na = Number(a.match(SLIDE_PATH)[1]);
  const nb = Number(b.match(SLIDE_PATH)[1]);
  return na - nb;
}

function collectText(xml) {
  const bits = [];
  for (const match of xml.matchAll(/<a:t\b[^>]*>([^<]*)<\/a:t>/g)) {
    const text = decodeXml(match[1]).trim();
    if (text) bits.push(text);
  }
  return bits;
}

export function placeholderThumbnail(title, slideCount) {
  const label = encodeXml(title || "Untitled deck");
  const meta = encodeXml(
    slideCount === 1 ? "1 slide" : `${slideCount} slides`,
  );
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#3a2c22"/>
      <stop offset="1" stop-color="#1b1511"/>
    </linearGradient>
  </defs>
  <rect width="1600" height="900" fill="url(#g)"/>
  <rect x="48" y="48" width="1504" height="804" fill="none" stroke="#c4784a" stroke-opacity="0.35" stroke-width="3"/>
  <text x="120" y="390" fill="#f3e6d6" font-size="72" font-family="Georgia, serif">${label}</text>
  <text x="120" y="470" fill="#b5a394" font-size="32" font-family="system-ui, sans-serif">${meta}</text>
</svg>`;
  return new TextEncoder().encode(svg);
}

export async function inspectPptx(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.keys(zip.files)
    .filter((name) => SLIDE_PATH.test(name) && !zip.files[name].dir)
    .sort(slideSort);

  if (slideFiles.length === 0) {
    throw new Error("This file does not contain any slides.");
  }

  let title = "";
  const core = zip.file("docProps/core.xml");
  if (core) {
    const xml = await core.async("string");
    title =
      firstMatch(xml, /<dc:title[^>]*>([^<]*)<\/dc:title>/) ||
      firstMatch(xml, /<cp:subject[^>]*>([^<]*)<\/cp:subject>/);
    if (/^pptxgenjs presentation$/i.test(title)) title = "";
  }

  if (!title) {
    const firstSlide = zip.file(slideFiles[0]);
    if (firstSlide) {
      const texts = collectText(await firstSlide.async("string"));
      title = texts[0] || "";
    }
  }

  let thumbnail = null;
  let thumbnailType = null;
  const thumbCandidates = [
    ["docProps/thumbnail.jpeg", "image/jpeg"],
    ["docProps/thumbnail.jpg", "image/jpeg"],
    ["docProps/thumbnail.png", "image/png"],
  ];
  for (const [name, type] of thumbCandidates) {
    const file = zip.file(name);
    if (file) {
      thumbnail = await file.async("uint8array");
      thumbnailType = type;
      break;
    }
  }

  return {
    slideCount: slideFiles.length,
    title: title.slice(0, 200),
    thumbnail,
    thumbnailType,
  };
}

export function titleFromFilename(filename) {
  return filename.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
}
