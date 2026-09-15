import { articles, getSources, siteUpdatedAt } from "../../knowledge/content";
import { manxFocusedSubset, manxModules } from "../../manx/data";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const payload = {
    name: "Britannic Atlas of the British World",
    description: "A citable knowledge base about the UK, Crown Dependencies, Overseas Territories, Commonwealth and connected histories.",
    dateModified: siteUpdatedAt,
    license: "Editorial content; verify reuse terms with the publisher.",
    focusedSubsets: [{ ...manxFocusedSubset, url: `${origin}${manxFocusedSubset.page}`, api: `${origin}${manxFocusedSubset.api}`, modules: manxModules.length }],
    items: articles.map((article) => ({
      id: `${origin}/knowledge/${article.slug}`,
      ...article,
      url: `${origin}/knowledge/${article.slug}`,
      sources: getSources(article.sourceIds),
    })),
  };
  return Response.json(payload, { headers: { "Cache-Control": "public, max-age=300, s-maxage=3600", "Access-Control-Allow-Origin": "*" } });
}
