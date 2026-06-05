import { defineCollection, z } from "astro:content";

const article = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    content_type: z.enum(["blog", "story", "now"]).default("blog"),
    category: z.string().optional(),
    tags: z.array(z.string()).default([]),
    source: z.string().optional(),
    feishu_url: z.string().optional(),
    draft: z.boolean().default(false),
    cover: z.string().optional()
  })
});

export const collections = {
  blog: article,
  story: article,
  now: article
};
