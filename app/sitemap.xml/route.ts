import { articles, siteUpdatedAt } from "../knowledge/content";
import { territoryDossiers } from "../territories/data";
import { doctoralDossiers, doctoralReviewedAt } from "../doctoral/data";
import { contextReviewedAt } from "../context/data";
import { manxReviewedAt } from "../manx/data";
import { discoveryStats } from "../manx/discover/stats";

const xmlEntities: Record<string, string> = { "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" };

function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, (character) => xmlEntities[character] ?? character);
}

export function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const paths = ["/", "/explore", "/territories", "/knowledge", "/questions", "/context", "/manx", "/manx/discover", "/manx/earth", "/api/manx", "/api/answers", "/api/territories", "/api/bankruptcy", "/api/doctoral", "/api/context", "/bankruptcy", "/doctoral", ...doctoralDossiers.map((dossier) => `/doctoral/${dossier.slug}`), ...territoryDossiers.flatMap((territory) => [`/territories/${territory.slug}`, `/territories/${territory.slug}/insolvency`, `/territories/${territory.slug}/context`]), ...articles.map((article) => `/knowledge/${article.slug}`)];
  const reviewedSections: [predicate: (path: string) => boolean, date: string][] = [
    [(path) => path === "/network" || path === "/api/network", [siteUpdatedAt, manxReviewedAt, doctoralReviewedAt, contextReviewedAt].sort().at(-1) ?? siteUpdatedAt],
    [(path) => path === "/manx/discover", discoveryStats.reviewedAt],
    [(path) => path === "/manx" || path === "/manx/earth" || path === "/api/manx", manxReviewedAt],
    [(path) => path.startsWith("/doctoral") || path === "/api/doctoral", doctoralReviewedAt],
    [(path) => path.startsWith("/context") || path.endsWith("/context") || path === "/api/context", contextReviewedAt],
  ];
  paths.push("/network", "/api/network");
  const lastModified = (path: string) => reviewedSections.find(([matches]) => matches(path))?.[1] ?? siteUpdatedAt;
  const urls = paths.map((path) => `<url><loc>${escapeXml(`${origin}${path}`)}</loc><lastmod>${lastModified(path)}</lastmod><changefreq>${path === "/" ? "weekly" : "monthly"}</changefreq><priority>${path === "/" ? "1.0" : path === "/knowledge" || path === "/doctoral" || path === "/context" || path === "/manx" ? "0.9" : "0.8"}</priority></url>`).join("");
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
