import { getManxModule, getManxSources, manxAgentContract, manxConnections, manxModules, manxReviewedAt, searchManxModules } from "../../manx/data";

function serialiseModule(module: (typeof manxModules)[number], score?: number, matchedKeywords?: string[]) {
  return {
    ...module,
    ...(score === undefined ? {} : { relevance: { score, matchedKeywords } }),
    sources: getManxSources(module.sourceIds),
  };
}

function connectedApis(origin: string) {
  return {
    legalAnswers: `${origin}/api/answers?jurisdiction=Isle%20of%20Man`,
    questions: `${origin}/api/questions?jurisdiction=Isle%20of%20Man`,
    knowledge: `${origin}/api/knowledge`,
    places: `${origin}/api/places`,
    doctoral: `${origin}/api/doctoral`,
  };
}

export function GET(request: Request) {
  const url = new URL(request.url);
  const focus = url.searchParams.get("focus")?.trim();
  const query = url.searchParams.get("q")?.trim() ?? "";
  const rawLimit = url.searchParams.get("limit");
  const limitValue = rawLimit === null || rawLimit === "" ? 10 : /^-?\d+$/.test(rawLimit) ? Number(rawLimit) : Number.NaN;
  const limit = Number.isInteger(limitValue) ? Math.min(Math.max(limitValue, 1), manxModules.length) : Math.min(10, manxModules.length);

  if (focus) {
    const focusModule = getManxModule(focus);
    if (!focusModule) return Response.json({ error: "Unknown MANX focus", validFocus: manxModules.map((item) => item.id) }, { status: 400, headers: { "Access-Control-Allow-Origin": "*" } });
    const serialisedModule = serialiseModule(focusModule);
    return Response.json({
      name: `MANX / ${focusModule.title}`,
      subset: "MANX",
      jurisdiction: manxAgentContract.canonicalJurisdiction,
      dateModified: manxReviewedAt,
      agentContract: manxAgentContract,
      focus: focusModule.id,
      count: 1,
      totalModules: manxModules.length,
      module: serialisedModule,
      modules: [serialisedModule],
      connections: manxConnections,
      connectedApis: connectedApis(url.origin),
      related: { page: `${url.origin}/manx#${focusModule.id}`, fullCorpus: `${url.origin}/api/manx`, answerLibrary: `${url.origin}/api/answers?jurisdiction=Isle%20of%20Man` },
    }, { headers: { "Cache-Control": "public, max-age=300, s-maxage=3600", "Access-Control-Allow-Origin": "*" } });
  }

  const matches = query
    ? searchManxModules(query).slice(0, limit)
    : manxModules.slice(0, limit).map((module) => ({ module, score: undefined, matchedKeywords: undefined }));
  return Response.json({
    name: "MANX — Isle of Man focused intelligence",
    description: "A source-led routing and synthesis layer for questions with an Isle of Man nexus.",
    subset: "MANX",
    jurisdiction: manxAgentContract.canonicalJurisdiction,
    aliases: manxAgentContract.aliases,
    dateModified: manxReviewedAt,
    query: query || null,
    count: matches.length,
    totalModules: manxModules.length,
    agentContract: manxAgentContract,
    routing: {
      method: query ? "Keyword-weighted retrieval across module purpose, capabilities, signals and routing vocabulary." : "All MANX modules in canonical order.",
      noMatch: "If count is zero, use the full corpus and classify the constitutional nexus before broadening into the connected atlas.",
      examples: [`${url.origin}/api/manx?q=work%20permit`, `${url.origin}/api/manx?q=VAT%20company`, `${url.origin}/api/manx?focus=legislation-courts`],
    },
    modules: matches.map(({ module, score, matchedKeywords }) => serialiseModule(module, score, matchedKeywords)),
    connections: manxConnections,
    connectedApis: connectedApis(url.origin),
  }, { headers: { "Cache-Control": "public, max-age=300, s-maxage=3600", "Access-Control-Allow-Origin": "*" } });
}
