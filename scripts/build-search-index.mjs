import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const distDir = join(process.cwd(), "dist");
const outputDir = join(distDir, "search");
const indexPath = join(outputDir, "index.json");

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    const stat = statSync(path);
    return stat.isDirectory() ? walk(path) : [path];
  });
}

const entries = walk(distDir)
  .filter((path) => path.endsWith(".html"))
  .filter((path) => !relative(distDir, path).replace(/\\/g, "/").startsWith("blog/"))
  .map((path) => {
    const html = readFileSync(path, "utf8");
    const title = html.match(/<title>(.*?)<\/title>/)?.[1] || "";
    const description = html.match(/<meta name="description" content="([^"]*)"/)?.[1] || "";
    const url = `/${relative(distDir, path).replace(/index\.html$/, "").replace(/\\/g, "/")}`;
    return { title, description, url };
  });

mkdirSync(outputDir, { recursive: true });
writeFileSync(indexPath, `${JSON.stringify(entries, null, 2)}\n`);
console.log(`Search index generated: ${entries.length} pages`);
