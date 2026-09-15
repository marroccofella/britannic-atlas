import { articles, siteUpdatedAt } from "../knowledge/content";

function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[character] ?? character);
}

export function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const entries = articles.map((article) => `<entry><id>${origin}/knowledge/${article.slug}</id><title>${escapeXml(article.title)}</title><link href="${origin}/knowledge/${article.slug}"/><updated>${siteUpdatedAt}T00:00:00Z</updated><summary>${escapeXml(article.description)}</summary></entry>`).join("");
  const feed = `<?xml version="1.0" encoding="UTF-8"?><feed xmlns="http://www.w3.org/2005/Atom"><id>${origin}/</id><title>Britannic Atlas knowledge updates</title><link href="${origin}/feed.xml" rel="self"/><link href="${origin}/knowledge"/><updated>${siteUpdatedAt}T00:00:00Z</updated>${entries}</feed>`;
  return new Response(feed, { headers: { "Content-Type": "application/atom+xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
