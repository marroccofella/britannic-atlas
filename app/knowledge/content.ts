export type KnowledgeSource = {
  id: string;
  title: string;
  publisher: string;
  url: string;
  lastReviewed: string;
};

export type KnowledgeArticle = {
  slug: string;
  eyebrow: string;
  title: string;
  description: string;
  summary: string;
  keywords: string[];
  sourceIds: string[];
  sections: { heading: string; body: string }[];
  relatedLinks?: { label: string; href: string; description: string }[];
};

export const siteUpdatedAt = "2026-09-12";
const legacySourcesReviewedAt = "2026-08-15";

export const sources: KnowledgeSource[] = [
  {
    id: "uk-overseas-territories",
    title: "Guide to making legislation: Overseas Territories",
    publisher: "UK Cabinet Office",
    url: "https://www.gov.uk/government/publications/guide-to-making-legislation/guide-to-making-legislation-html--2",
    lastReviewed: legacySourcesReviewedAt,
  },
  {
    id: "crown-dependencies",
    title: "Crown Dependencies: Jersey, Guernsey and the Isle of Man",
    publisher: "UK Ministry of Justice",
    url: "https://www.gov.uk/government/publications/crown-dependencies-jersey-guernsey-and-the-isle-of-man",
    lastReviewed: legacySourcesReviewedAt,
  },
  {
    id: "commonwealth-members",
    title: "Commonwealth member countries",
    publisher: "Commonwealth Secretariat",
    url: "https://thecommonwealth.org/our-member-countries",
    lastReviewed: legacySourcesReviewedAt,
  },
  {
    id: "uk-devolution",
    title: "Devolution: Guidance for civil servants",
    publisher: "UK Cabinet Office",
    url: "https://www.gov.uk/government/publications/devolution-guidance-for-civil-servants",
    lastReviewed: legacySourcesReviewedAt,
  },
  {
    id: "nationality-law",
    title: "British citizenship: automatic acquisition",
    publisher: "UK Home Office",
    url: "https://www.gov.uk/government/publications/automatic-acquisition-nationality-policy-guidance",
    lastReviewed: legacySourcesReviewedAt,
  },
  {
    id: "chagos-status",
    title: "British Indian Ocean Territory and the UK",
    publisher: "UK Foreign, Commonwealth & Development Office",
    url: "https://www.gov.uk/world/british-indian-ocean-territory/news",
    lastReviewed: legacySourcesReviewedAt,
  },
  {
    id: "iom-overview",
    title: "Isle of Man — an overview",
    publisher: "Isle of Man Government",
    url: "https://www.gov.im/about-the-government/departments/cabinet-office/media-centre/isle-of-man-an-overview/",
    lastReviewed: siteUpdatedAt,
  },
  {
    id: "tynwald-legislation",
    title: "Making legislation",
    publisher: "Tynwald",
    url: "https://tynwald.org.im/TC/making-legislation",
    lastReviewed: siteUpdatedAt,
  },
  {
    id: "manx-legislation",
    title: "Isle of Man legislation",
    publisher: "Attorney General's Chambers",
    url: "https://legislation.gov.im/",
    lastReviewed: siteUpdatedAt,
  },
  {
    id: "manx-courts",
    title: "Court structure",
    publisher: "Isle of Man Courts of Justice",
    url: "https://www.courts.im/court-information/court-structure/",
    lastReviewed: siteUpdatedAt,
  },
];

export const articles: KnowledgeArticle[] = [
  {
    slug: "constitutional-family",
    eyebrow: "Start here",
    title: "The constitutional family, without shortcuts",
    description: "A clear map of the United Kingdom, Crown Dependencies, Overseas Territories and Commonwealth—and why none of the labels are interchangeable.",
    summary: "The ‘British world’ is not one constitutional category. It is a research frame spanning the UK’s internal union, self-governing dependencies of the Crown, constitutionally separate Overseas Territories and a voluntary association of independent states.",
    keywords: ["British constitution", "Crown Dependencies", "Overseas Territories", "Commonwealth"],
    sourceIds: ["uk-overseas-territories", "crown-dependencies", "commonwealth-members"],
    sections: [
      { heading: "Four relationships", body: "England, Scotland, Wales and Northern Ireland form the United Kingdom. Jersey, Guernsey and the Isle of Man are self-governing dependencies of the Crown and are not part of the UK. The Overseas Territories are also constitutionally separate from the UK, each with its own constitution and government. Commonwealth members are independent and equal states." },
      { heading: "Why classification matters", body: "A rule about UK taxation, elections, immigration or public services cannot safely be assumed to apply in a dependency or territory. The correct starting question is always: which institution has legal authority here?" },
      { heading: "How to research it", body: "Separate formal legal status from political practice. Check the local constitution and legislation first, then identify any reserved UK responsibility, international obligation or convention that affects the result." },
    ],
  },
  {
    slug: "crown-dependencies",
    eyebrow: "Constitutional map",
    title: "What makes a Crown Dependency distinct?",
    description: "Jersey, Guernsey and the Isle of Man are neither UK nations nor Overseas Territories.",
    summary: "The three Crown Dependencies are self-governing dependencies of the Crown. They maintain their own elected legislatures, governments, fiscal systems, legal systems and courts, and are not represented in the UK Parliament.",
    keywords: ["Jersey", "Guernsey", "Isle of Man", "Crown Dependency"],
    sourceIds: ["crown-dependencies"],
    sections: [
      { heading: "Relationship through the Crown", body: "The constitutional relationship is maintained through the Crown rather than membership of the United Kingdom. The Ministry of Justice manages the UK Government’s overarching relationship with the islands." },
      { heading: "Domestic autonomy", body: "Each dependency legislates for its own domestic affairs. Their tax, company, property and public-service rules may differ substantially both from the UK and from one another." },
      { heading: "External responsibilities", body: "The UK is responsible for defence and international relations, while the islands may be authorised through Letters of Entrustment to negotiate and conclude some international agreements." },
    ],
  },
  {
    slug: "isle-of-man",
    eyebrow: "MANX · Focused subset",
    title: "The Isle of Man: a jurisdiction in its own right",
    description: "The constitutional and research baseline for Ellan Vannin, with a route into the MANX focused-intelligence corpus.",
    summary: "The Isle of Man is a self-governing Crown Dependency with its own parliament, government, courts, legal system and fiscal system. It is not part of the United Kingdom and is not an Overseas Territory. A reliable answer starts with Manx authority and proves any UK or international bridge separately.",
    keywords: ["MANX", "Isle of Man", "Ellan Vannin", "Tynwald", "Manx law", "Crown Dependency"],
    sourceIds: ["crown-dependencies", "iom-overview", "tynwald-legislation", "manx-legislation", "manx-courts"],
    sections: [
      { heading: "Not UK, not devolved", body: "The Island's relationship with the United Kingdom runs through the Crown. Tynwald's authority is not a devolved allocation from Westminster, so the research method is different from Scotland, Wales or Northern Ireland: begin with the Manx institution and Manx text rather than a reserved-powers map." },
      { heading: "Tynwald and the courts", body: "The House of Keys and Legislative Council consider primary legislation and sit together in Tynwald Court for policy, finance and other parliamentary purposes. Manx courts and procedure are distinct; final appeals may reach the Judicial Committee of the Privy Council rather than the UK Supreme Court." },
      { heading: "Prove each legal bridge", body: "A UK Act, treaty, visa, licence, company status or court step does not operate in the Island merely because it is British. Territorial application may depend on express text, implication, extension by Order in Council, Manx enactment, a reciprocal arrangement or another recognised route. Scope and commencement must be checked." },
      { heading: "Shared systems are narrow", body: "The Common Travel Area and UK–Isle of Man arrangements for customs, VAT, healthcare or social security create important but subject-specific connections. They do not make the Island part of the UK and should not be generalised beyond their actual terms." },
      { heading: "The MANX research layer", body: "MANX is the atlas's focused routing and synthesis layer for Isle of Man questions. It connects ten specialist modules to the bank of 1,000 templated research baselines, comparative-law dossiers, place evidence and official sources while preserving the Manx nexus throughout." },
    ],
    relatedLinks: [
      { label: "Open MANX focused intelligence", href: "/manx", description: "Route a question through ten Isle of Man modules, decision signals, guardrails and official sources." },
      { label: "Explore MANX Earth & Street View", href: "/manx/earth", description: "Open satellite context, street-level viewpoints and nearby hotel, bar, fuel and coffee searches for Manx localities." },
      { label: "Open 1,000 templated research baselines", href: "/questions?jurisdiction=Isle%20of%20Man", description: "Enter the templated legal and jurisdictional baseline bank with the Isle of Man preselected. Baselines are composed from templates, not individually researched." },
      { label: "Query the MANX API", href: "/api/manx", description: "Retrieve the agent contract, modules, knowledge connections and source registry as JSON." },
    ],
  },
  {
    slug: "overseas-territories",
    eyebrow: "Fourteen profiles",
    title: "How the Overseas Territories are governed",
    description: "A comparative guide to fourteen constitutionally separate territories and the responsibilities retained by the United Kingdom.",
    summary: "Each Overseas Territory has a written constitution and a distinct local settlement. Most have locally elected institutions, while the UK retains responsibilities that commonly include defence, external affairs and overall good governance.",
    keywords: ["British Overseas Territories", "Governor", "self-government", "UK Parliament"],
    sourceIds: ["uk-overseas-territories"],
    sections: [
      { heading: "Not part of the UK", body: "Overseas Territories are constitutionally separate from the United Kingdom. UK Acts do not normally extend automatically, although Parliament retains legal power to legislate for them." },
      { heading: "A spectrum of self-government", body: "The balance between a local legislature, ministers and a Governor varies by territory. Any comparison should identify the exact constitutional order and the responsibilities reserved to the Governor or UK authorities." },
      { heading: "Current-status caution", body: "Territorial status can be politically contested or subject to a signed but not yet operative agreement. Every profile therefore carries a review date and links to the current official source." },
    ],
  },
  {
    slug: "commonwealth",
    eyebrow: "Independent states",
    title: "The modern Commonwealth is not an empire",
    description: "A guide to a voluntary association of 56 independent and equal countries across five regions.",
    summary: "The Commonwealth’s roots lie partly in the British Empire, but today it is a voluntary association of 56 independent and equal countries. Membership is not a form of UK sovereignty and is not limited to former British colonies.",
    keywords: ["Commonwealth", "Commonwealth realms", "member states", "decolonisation"],
    sourceIds: ["commonwealth-members"],
    sections: [
      { heading: "Equal membership", body: "Members cooperate around agreed values and programmes, but each state is sovereign. The Commonwealth Secretariat supports the association; it is not a branch of the UK Government." },
      { heading: "Realm, monarchy or republic", body: "Some members share Charles III as monarch, some have their own monarch, and most are republics. These forms do not create different grades of Commonwealth membership." },
      { heading: "A careful historical frame", body: "A useful account holds two facts together: the association emerged from imperial history, and its present membership is an independent political choice made by sovereign states." },
    ],
  },
  {
    slug: "devolution",
    eyebrow: "United Kingdom",
    title: "Devolution changes who decides",
    description: "A practical introduction to the different legislative and executive settlements of Scotland, Wales and Northern Ireland.",
    summary: "Devolution transfers decision-making in specified areas while the UK Parliament remains legally sovereign. The settlements are asymmetric: the powers, institutions and legal context are not identical across Scotland, Wales and Northern Ireland.",
    keywords: ["devolution", "Scotland", "Wales", "Northern Ireland"],
    sourceIds: ["uk-devolution"],
    sections: [
      { heading: "Reserved and devolved matters", body: "Competence depends on the relevant settlement. Researchers should check current legislation rather than infer that a policy devolved in one nation is devolved on the same terms elsewhere." },
      { heading: "Law and administration", body: "Scotland and Northern Ireland have distinct legal systems; Wales shares the England-and-Wales jurisdiction while developing a growing body of Welsh law. Administrative responsibility also differs by subject." },
      { heading: "Living settlements", body: "Devolution has changed through successive statutes, political agreements and court decisions. Date-stamped sources are essential whenever the precise boundary of competence matters." },
    ],
  },
  {
    slug: "chagos-status",
    eyebrow: "Status watch",
    title: "Chagos and the British Indian Ocean Territory",
    description: "A date-stamped guide to a contested status and a treaty signed by the UK and Mauritius that has not entered into force.",
    summary: "As reviewed on 15 August 2026, the British Indian Ocean Territory remains a British Overseas Territory administered from London. The UK and Mauritius signed a sovereignty treaty in May 2025, but it has not entered into force; the implementation bill made no further progress when the 2024–26 parliamentary session ended.",
    keywords: ["Chagos Archipelago", "British Indian Ocean Territory", "Mauritius treaty", "Diego Garcia"],
    sourceIds: ["chagos-status"],
    sections: [
      { heading: "Current legal position", body: "Official UK sources continue to describe BIOT as a constitutionally separate Overseas Territory. Access is restricted, and the administration is based in London." },
      { heading: "Signed agreement, future effect", body: "The 2025 treaty provides for sovereignty to transfer to Mauritius when it enters into force, alongside arrangements concerning the military base on Diego Garcia. Until entry into force, describing the transfer as complete would be inaccurate." },
      { heading: "Why this page is monitored", body: "This is a high-volatility topic. The knowledge base links directly to the live FCDO status page and marks the date on which the summary was last reviewed." },
    ],
  },
];

export function getArticle(slug: string) {
  return articles.find((article) => article.slug === slug);
}

export function getSources(ids: string[]) {
  return ids.map((id) => sources.find((source) => source.id === id)).filter((source): source is KnowledgeSource => Boolean(source));
}
