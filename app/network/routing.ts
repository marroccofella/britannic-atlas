export type NetworkPlace = { slug: string; name: string; status: string; visual?: boolean; answers?: string; territory?: string; aliases?: readonly string[] };
export type NetworkApp = { id: string; name: string; role: string; voice: string; focus: string; href: string; mark: string; scope: "all" | "territories" | "manx"; api?: string };

export const networkApps: NetworkApp[] = [
  { id: "atlas", name: "Britannic Atlas", mark: "BA", role: "The cartographer", voice: "Wide-angle, historical and comparative", focus: "Orient yourself in the British world: constitutional relationships, empire and its afterlives.", href: "/", scope: "all" },
  { id: "places", name: "Visual Atlas", mark: "VA", role: "The field guide", voice: "Visual, geographical and concrete", focus: "Explore places, population and earnings context, then open maps and street views.", href: "/explore", scope: "all", api: "/api/places" },
  { id: "territories", name: "Territory dossiers", mark: "TD", role: "The local editor", voice: "Place-specific, attentive to local identity", focus: "Read each Overseas Territory through its own government, economy, environment and sources.", href: "/territories", scope: "territories", api: "/api/territories" },
  { id: "knowledge", name: "Knowledge library", mark: "KL", role: "The archivist", voice: "Explanatory, historical and source-led", focus: "Understand the constitutional family, Commonwealth and connected histories through permanent articles.", href: "/knowledge", scope: "all", api: "/api/knowledge" },
  { id: "answers", name: "Answer library", mark: "QA", role: "The research guide", voice: "Direct, structured and jurisdiction-aware", focus: "Work through everyday institutional questions with the relevant jurisdiction in view.", href: "/questions", scope: "all", api: "/api/answers" },
  { id: "insolvency", name: "Insolvency library", mark: "IL", role: "The specialist", voice: "Practical, precise and cautious about applicability", focus: "Explore debt, rescue and insolvency questions separately for each Overseas Territory.", href: "/bankruptcy", scope: "territories", api: "/api/bankruptcy" },
  { id: "context", name: "Structural context", mark: "SC", role: "The systems analyst", voice: "Critical, comparative and explicit about limits", focus: "Follow local rules, territorial limits, recognition bridges and remaining gaps.", href: "/context", scope: "territories", api: "/api/context" },
  { id: "doctoral", name: "Doctoral research", mark: "DR", role: "The comparative scholar", voice: "Argument-led and grounded in primary authority", focus: "Examine formal validity, service, identity and recognition through five comparative dossiers.", href: "/doctoral", scope: "all", api: "/api/doctoral" },
  { id: "manx", name: "MANX", mark: "M", role: "The island specialist", voice: "Manx-first, institutional and precise", focus: "Bring together the Isle of Man’s law, institutions and evidence through focused research guides.", href: "/manx", scope: "manx", api: "/api/manx" },
  { id: "discovery", name: "Island discovery", mark: "ID", role: "The curious guide", voice: "Exploratory, connected and candid about gaps", focus: "Follow Manx topics and their relationships, distinguish outlines from sourced descriptions, and prepare a question.", href: "/manx/discover", scope: "manx" },
  { id: "earth", name: "MANX Earth", mark: "ME", role: "The island navigator", voice: "Spatial, local and observational", focus: "Move from the whole island to named localities, maps and street-level views.", href: "/manx/earth", scope: "manx" },
  { id: "mannin", name: "Mannin", mark: "Mn", role: "The conversation companion", voice: "Conversational, spoken and Manx-first", focus: "Ask by voice or text, explore the island, and request a source check or second opinion in the local app.", href: "http://127.0.0.1:4242/", scope: "manx" },
];

export function appDestination(app: NetworkApp, place?: NetworkPlace) {
  if (!place) return app.href;
  if (app.id === "places" && place.visual) return `/explore?place=${encodeURIComponent(place.slug)}`;
  if (app.id === "answers" && place.answers) return `/questions?jurisdiction=${encodeURIComponent(place.answers)}`;
  if (place.territory) {
    const base = `/territories/${place.territory}`;
    if (app.id === "territories") return base;
    if (app.id === "insolvency") return `${base}/insolvency`;
    if (app.id === "context") return `${base}/context`;
  }
  if (app.id === "knowledge" && place.slug === "isle-of-man") return "/knowledge/isle-of-man";
  return app.href;
}

export function routePlace(path: string, query: URLSearchParams, places: NetworkPlace[]) {
  if (path === "/manx" || path.startsWith("/manx/") || path === "/knowledge/isle-of-man") return places.find(p => p.slug === "isle-of-man");
  const territory = path.match(/^\/territories\/([^/]+)/)?.[1];
  if (territory) return places.find(p => p.territory === territory);
  if (path === "/explore") return places.find(p => p.visual && p.slug === query.get("place")) ?? places.find(p => p.slug === "england");
  if (path === "/questions") {
    const requested = query.get("jurisdiction")?.trim().toLowerCase();
    return places.find(p => p.answers && (p.answers.toLowerCase() === requested || p.aliases?.some(alias => alias.toLowerCase() === requested))) ?? places.find(p => p.slug === "united-kingdom");
  }
  const slug = query.get("place");
  if (slug) return places.find(p => p.slug === slug);
  const jurisdiction = query.get("jurisdiction");
  if (jurisdiction) return places.find(p => p.name === jurisdiction || p.answers === jurisdiction);
  return undefined;
}

export function destinationScope(app: NetworkApp, place?: NetworkPlace) {
  if (app.scope === "manx") return "Isle of Man";
  if (app.id === "answers" && place?.answers) return place.answers;
  if (place && appDestination(app, place) !== app.href) return place.name;
  return app.scope === "territories" ? "Overseas Territories directory" : "Across the British world";
}

export function currentApp(path: string) {
  if (/^\/territories\/[^/]+\/insolvency\/?$/.test(path)) return networkApps.find(a => a.id === "insolvency")!;
  if (/^\/territories\/[^/]+\/context\/?$/.test(path)) return networkApps.find(a => a.id === "context")!;
  return [...networkApps].filter(a => a.href.startsWith("/")).sort((a,b) => b.href.length - a.href.length).find(a => path === a.href || (a.href !== "/" && path.startsWith(a.href + "/"))) ?? networkApps[0];
}
