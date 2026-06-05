import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { spawnSync } from "node:child_process";

const env = process.env;

const input = {
  feishuUrl: required("FEISHU_URL", env.FEISHU_URL || "mock://local"),
  slug: required("SLUG", env.SLUG || "my-first-post"),
  title: env.TITLE || "",
  titleSource: env.TITLE_SOURCE || "feishu",
  description: required("DESCRIPTION", env.DESCRIPTION || "用飞书写作，用 Astro 和 GitHub Pages 发布。"),
  contentType: required("CONTENT_TYPE", env.CONTENT_TYPE || "blog"),
  category: required("CATEGORY", env.CATEGORY || "technology"),
  tags: (env.TAGS || "独立开发,个人网站").split(/[,，]/).map((tag) => tag.trim()).filter(Boolean),
  draft: env.DRAFT === "true"
};

const siteBase = normalizeBase(env.SITE_BASE || "/");

const output = await loadMarkdown();
writeArticle(output.markdown, output.assetsDir);
writeReport(output);

async function loadMarkdown() {
  if (env.FEISHU_MOCK_MARKDOWN) {
    return {
      markdown: readFileSync(env.FEISHU_MOCK_MARKDOWN, "utf8"),
      assetsDir: null,
      mode: "mock"
    };
  }

  if (env.FEISHU_MARKDOWN_FILE) {
    return {
      markdown: readFileSync(env.FEISHU_MARKDOWN_FILE, "utf8"),
      assetsDir: env.FEISHU_ASSETS_DIR || null,
      mode: "markdown_file"
    };
  }

  const tool = findFeishuTool();
  if (!tool) {
    throw new Error("No Feishu conversion path available. Set FEISHU_MOCK_MARKDOWN, FEISHU_MARKDOWN_FILE, or install lark-cli+jq+pandoc with scripts/read-feishu-wiki.sh.");
  }

  const cacheDir = join(".cache", "feishu-publish", input.slug);
  rmSync(cacheDir, { recursive: true, force: true });
  mkdirSync(cacheDir, { recursive: true });

  const result = spawnSync("bash", [tool, input.feishuUrl, cacheDir], {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8"
  });

  if (result.status !== 0) {
    throw new Error(
      [
        `Feishu conversion failed with status ${String(result.status)}.`,
        result.error ? `error: ${result.error.message}` : "",
        result.stderr ? `stderr:\n${result.stderr}` : "",
        result.stdout ? `stdout:\n${result.stdout}` : ""
      ]
        .filter(Boolean)
        .join("\n")
    );
  }

  const mdPath = result.stdout.trim().split("\n").at(-1);
  if (!mdPath || !existsSync(mdPath)) {
    throw new Error("Feishu conversion did not output a Markdown file path.");
  }

  return {
    markdown: readFileSync(mdPath, "utf8"),
    assetsDir: join(cacheDir, "assets"),
    mode: "feishu"
  };
}

function writeArticle(markdown, assetsDir) {
  const collection = input.contentType;
  const articleDir = join("src", "content", collection);
  const imageDir = join("public", "images", collection, input.slug);
  const articlePath = join(articleDir, `${input.slug}.md`);
  const documentTitle = extractDocumentTitle(markdown);
  const articleTitle = input.titleSource === "manual" && input.title ? input.title : documentTitle || input.title || input.slug;

  mkdirSync(articleDir, { recursive: true });
  rmSync(imageDir, { recursive: true, force: true });
  mkdirSync(imageDir, { recursive: true });

  let body = stripDocumentTitle(markdown, documentTitle).replace(/^# .+?\n+/, "").trim();

  if (assetsDir && existsSync(assetsDir)) {
    copyAssets(assetsDir, imageDir);
    body = body.replace(/\.\.\/assets\/[^/\s)]+\/([^) \n]+)/g, publicPath(`/images/${collection}/${input.slug}/$1`));
  }

  body = sanitizeMarkdown(body);
  const cover = extractFirstImageSource(body);

  const frontmatter = [
    "---",
    `title: ${JSON.stringify(articleTitle)}`,
    `description: ${JSON.stringify(input.description)}`,
    `date: ${JSON.stringify(new Date().toISOString().slice(0, 10))}`,
    `updated: ${JSON.stringify(new Date().toISOString().slice(0, 10))}`,
    `content_type: ${JSON.stringify(collection)}`,
    `category: ${JSON.stringify(input.category)}`,
    "tags:",
    ...input.tags.map((tag) => `  - ${JSON.stringify(tag)}`),
    cover ? `cover: ${JSON.stringify(cover)}` : "",
    `source: "feishu"`,
    `feishu_url: ${JSON.stringify(input.feishuUrl)}`,
    `draft: ${input.draft ? "true" : "false"}`,
    "---",
    ""
  ].filter((line) => line !== "").join("\n");

  writeFileSync(articlePath, `${frontmatter}${body}\n`);
  console.log(`Article written: ${articlePath}`);
}

function extractFirstImageSource(markdown) {
  return markdown.match(/<img\s+[^>]*src="([^"]+)"/i)?.[1] || "";
}

function copyAssets(sourceDir, targetDir) {
  mkdirSync(targetDir, { recursive: true });
  for (const entry of walkFiles(sourceDir)) {
    copyFileSync(entry, join(targetDir, basename(entry)));
  }
}

function sanitizeMarkdown(markdown) {
  return markdown
    .replace(/\s+href="https:\/\/internal-api-drive-stream\.[^"]+"/g, "")
    .replace(/\s+href="https:\/\/[^"]*\/download\/authcode\/[^"]+"/g, "")
    .replace(/\s+data-[a-zA-Z0-9_-]+="[^"]*"/g, "")
    .replace(/\s+id="[^"]*"/g, "")
    .replace(/<img\s+src="(?!\/|https?:\/\/|\.\.?\/)[^"]+"[^>]*\/?>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractDocumentTitle(markdown) {
  const firstLine = markdown
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("---"));

  if (!firstLine) {
    return "";
  }

  return firstLine
    .replace(/^#\s+/, "")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function stripDocumentTitle(markdown, title) {
  if (!title) {
    return markdown;
  }

  const lines = markdown.split("\n");
  const firstContentIndex = lines.findIndex((line) => line.trim());
  if (firstContentIndex === -1) {
    return markdown;
  }

  const normalizedFirstLine = lines[firstContentIndex].trim().replace(/^#\s+/, "").trim();
  if (normalizedFirstLine === title) {
    lines.splice(firstContentIndex, 1);
  }

  return lines.join("\n");
}

function walkFiles(dir) {
  const result = spawnSync("find", [dir, "-type", "f"], { encoding: "utf8" });
  return result.stdout.split("\n").filter(Boolean);
}

function writeReport(output) {
  mkdirSync(".cache", { recursive: true });
  writeFileSync(
    join(".cache", "last-publish-report.json"),
    `${JSON.stringify({ input, mode: output.mode, generated_at: new Date().toISOString() }, null, 2)}\n`
  );
}

function findFeishuTool() {
  const local = join("scripts", "read-feishu-wiki.sh");
  if (existsSync(local)) {
    return local;
  }
  return null;
}

function required(name, value) {
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function publicPath(path) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (siteBase === "/") {
    return normalizedPath;
  }
  return `${siteBase.replace(/\/$/, "")}${normalizedPath}`;
}

function normalizeBase(value) {
  if (!value || value === ".") {
    return "/";
  }
  const withLeadingSlash = value.startsWith("/") ? value : `/${value}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
}
