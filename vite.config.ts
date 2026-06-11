import { defineConfig } from "vite";
import type { Plugin } from "vite";
import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

const root = process.cwd();
const out = resolve(root, "dist");

/** Copie récursive d'un dossier (gère les sous-dossiers, ex. assets/fonts/). */
function copyDir(src: string, dst: string): void {
  mkdirSync(dst, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const s = join(src, entry.name);
    const d = join(dst, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else copyFileSync(s, d);
  }
}

/**
 * Copie les fichiers statiques (manifest, popup.html/css, icônes) vers dist/
 * aux emplacements attendus par MV3, sans passer par le pipeline JS de Vite.
 * Zéro dépendance externe.
 */
function copyStatic(): Plugin {
  return {
    name: "monark-copy-static",
    apply: "build",
    closeBundle() {
      mkdirSync(join(out, "popup"), { recursive: true });
      copyFileSync(resolve(root, "src/manifest.json"), join(out, "manifest.json"));
      copyFileSync(resolve(root, "src/popup/popup.html"), join(out, "popup/popup.html"));
      copyFileSync(resolve(root, "src/popup/popup.css"), join(out, "popup/popup.css"));
      // Copie récursive de assets/ (icônes + assets/fonts/*.woff2 + licences OFL).
      copyDir(resolve(root, "assets"), join(out, "assets"));
    },
  };
}

// Build multi-entrées reproduisant le layout v1. minify désactivé (choix délibéré :
// debug + review Web Store). Le content script reste auto-suffisant (pas d'import de
// chunk partagé — voir src/content/main.ts) ; service-worker et popup sont des modules.
export default defineConfig({
  root,
  publicDir: false,
  build: {
    outDir: "dist",
    emptyOutDir: true,
    minify: false,
    sourcemap: false,
    target: "es2022",
    rollupOptions: {
      input: {
        "content/main": resolve(root, "src/content/main.ts"),
        "background/service-worker": resolve(root, "src/background/service-worker.ts"),
        "popup/popup": resolve(root, "src/popup/popup.ts"),
      },
      output: {
        format: "es",
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name].js",
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
  plugins: [copyStatic()],
});
