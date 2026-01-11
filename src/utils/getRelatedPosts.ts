import type { CollectionEntry } from "astro:content";

export function getRelatedPosts(
  currentPost: CollectionEntry<"blog">,
  allPosts: CollectionEntry<"blog">[],
  maxCount: number = 3
): CollectionEntry<"blog">[] {
  const currentTags = currentPost.data.tags || [];

  if (currentTags.length === 0) {
    return [];
  }

  const postsWithScore = allPosts
    .filter(post => post.id !== currentPost.id)
    .filter(post => !post.data.draft)
    .map(post => {
      const postTags = post.data.tags || [];
      const commonTags = currentTags.filter(tag => postTags.includes(tag));
      return {
        post,
        score: commonTags.length,
      };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return (
        new Date(b.post.data.pubDatetime).getTime() -
        new Date(a.post.data.pubDatetime).getTime()
      );
    });

  return postsWithScore.slice(0, maxCount).map(item => item.post);
}
