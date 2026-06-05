import rss from "@astrojs/rss";
import { getEntrySlug, getPublishedBlogPosts } from "../lib/content";
import { getSiteConfig } from "../lib/config";

export async function GET(context) {
  const site = getSiteConfig();
  const posts = await getPublishedBlogPosts();

  return rss({
    title: site.title,
    description: site.description,
    site: context.site,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.date,
      link: `/blog/${getEntrySlug(post)}/`
    }))
  });
}
