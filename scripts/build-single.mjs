// Inlines the Vite build into one self-contained index.html, for hosts where a single file upload is easiest (tiiny.host).
// Run after `vite build`; output goes to dist-single/.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const dist = new URL("../dist/", import.meta.url);
const out = new URL("../dist-single/", import.meta.url);
const read = (path) => readFileSync(new URL(path, dist));
const dataUri = (path, type) => `data:${type};base64,${read(path).toString("base64")}`;

// Replacement callbacks rather than strings, so "$" in the bundle isn't treated as a pattern.
const html = read("index.html")
  .toString()
  .replace(/<script type="module" crossorigin src="\.\/(.+?)"><\/script>/, (_, src) => {
    const js = read(src).toString();
    if (js.includes("</script")) throw new Error("Bundle contains </script and can't be inlined");
    return `<script type="module">${js}</script>`;
  })
  .replace(/<link rel="stylesheet" crossorigin href="\.\/(.+?)">/, (_, href) => `<style>${read(href)}</style>`)
  .replace('href="icon.svg"', () => `href="${dataUri("icon.svg", "image/svg+xml")}"`)
  .replace('href="apple-touch-icon.png"', () => `href="${dataUri("apple-touch-icon.png", "image/png")}"`)
  // The manifest points at separate icon files, so it only works in the multi-file build.
  .replace(/\s*<link rel="manifest"[^>]*>/, "");

if (/(src|href)="\.?\/?assets\//.test(html)) throw new Error("Some assets were not inlined");
mkdirSync(out, { recursive: true });
writeFileSync(new URL("index.html", out), html);
console.log(`dist-single/index.html (${Math.round(html.length / 1024)} KB)`);
