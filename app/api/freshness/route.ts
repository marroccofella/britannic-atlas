import { sources } from "../../knowledge/content";

export async function GET() {
  const results = await Promise.all(sources.map(async (source) => {
    try {
      const response = await fetch(source.url, { method: "HEAD", redirect: "follow" });
      return { id: source.id, ok: response.ok, status: response.status, lastModified: response.headers.get("last-modified") };
    } catch {
      return { id: source.id, ok: false, status: 0, lastModified: null };
    }
  }));
  return Response.json({
    checkedAt: new Date().toISOString(),
    healthy: results.filter((result) => result.ok).length,
    total: results.length,
    sources: results,
  }, { headers: { "Cache-Control": "public, max-age=300, s-maxage=21600", "Access-Control-Allow-Origin": "*" } });
}
