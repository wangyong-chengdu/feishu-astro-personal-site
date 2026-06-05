import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: process.env.SITE_URL || "https://example.com",
  base: process.env.SITE_BASE || "/",
  integrations: [sitemap()]
});
