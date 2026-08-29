import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const pages = process.env.GITHUB_PAGES === "true";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "github-pages-spa",
      closeBundle() {
        if (!pages) return;
        const dist = path.join(rootDir, "dist");
        fs.writeFileSync(path.join(dist, ".nojekyll"), "");
        fs.copyFileSync(path.join(dist, "index.html"), path.join(dist, "404.html"));
      },
    },
  ],
  base: pages ? "/ZenDenSlides/" : "/",
  root: path.join(rootDir, "client"),
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:3000",
    },
  },
  preview: {
    host: true,
    port: 4173,
  },
  build: {
    outDir: path.join(rootDir, "dist"),
    emptyOutDir: true,
  },
});
