import { getCollection } from "astro:content";

export async function getPublishedBlogPosts() {
  return (await getCollection("blog"))
    .filter((post) => !post.data.draft)
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export async function getPublishedStories() {
  return (await getCollection("story"))
    .filter((post) => !post.data.draft)
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export async function getPublishedNowPosts() {
  return (await getCollection("now"))
    .filter((post) => !post.data.draft)
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export function getAllTags(posts: Array<{ data: { tags: string[] } }>) {
  return [...new Set(posts.flatMap((post) => post.data.tags))].sort((a, b) => a.localeCompare(b));
}

export function getEntrySlug(entry: { id: string }) {
  return entry.id.replace(/\.(md|mdx)$/, "");
}
