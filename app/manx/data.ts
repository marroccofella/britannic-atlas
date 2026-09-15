import { sources as knowledgeSources } from "../knowledge/content";

export const manxReviewedAt = "2026-09-12";

export type ManxSource = {
  id: string;
  title: string;
  publisher: string;
  url: string;
  sourceType: "constitutional" | "legislation" | "regulator" | "registry" | "guidance" | "statistics" | "culture";
};

export type ManxConnection = {
  label: string;
  href: string;
  kind: "core" | "answers" | "doctoral" | "place" | "machine";
  use: string;
};

export type ManxSignal = {
  statement: string;
  implication: string;
  volatility: "structural" | "periodic" | "live-check";
};

export type ManxModule = {
  id: string;
  number: string;
  title: string;
  strapline: string;
  purpose: string;
  capabilities: string[];
  signals: ManxSignal[];
  guardrails: string[];
  keywords: string[];
  sourceIds: string[];
  connections: ManxConnection[];
};

function sharedKnowledgeSource(id: string, sourceType: ManxSource["sourceType"]): ManxSource {
  const source = knowledgeSources.find((item) => item.id === id);
  if (!source) throw new Error(`Missing shared knowledge source: ${id}`);
  return { id: source.id, title: source.title, publisher: source.publisher, url: source.url, sourceType };
}

export const manxSources: ManxSource[] = [
  sharedKnowledgeSource("iom-overview", "constitutional"),
  sharedKnowledgeSource("crown-dependencies", "constitutional"),
  sharedKnowledgeSource("tynwald-legislation", "legislation"),
  sharedKnowledgeSource("manx-legislation", "legislation"),
  sharedKnowledgeSource("manx-courts", "guidance"),
  { id: "manx-judgments", title: "Isle of Man judgments", publisher: "Isle of Man Courts of Justice", url: "https://www.judgments.im/", sourceType: "legislation" },
  { id: "manx-tax", title: "Income tax rates and allowances", publisher: "Isle of Man Government", url: "https://www.gov.im/categories/tax-vat-and-your-money/income-tax-and-national-insurance/individuals/residents/rates-and-allowances", sourceType: "guidance" },
  { id: "manx-customs", title: "Customs and Excise", publisher: "Isle of Man Government", url: "https://www.gov.im/categories/tax-vat-and-your-money/customs-and-excise/", sourceType: "guidance" },
  { id: "manx-companies", title: "Companies Registry", publisher: "Isle of Man Government", url: "https://www.gov.im/categories/business-and-industries/companies-registry/", sourceType: "registry" },
  { id: "manx-beneficial-ownership", title: "Beneficial Ownership", publisher: "Isle of Man Government", url: "https://www.gov.im/categories/business-and-industries/companies-registry/beneficial-ownership/", sourceType: "registry" },
  { id: "iomfsa", title: "Regulated sectors and supervisory material", publisher: "Isle of Man Financial Services Authority", url: "https://www.iomfsa.im/", sourceType: "regulator" },
  { id: "iomfsa-virtual-assets", title: "Virtual assets and the regulatory perimeter", publisher: "Isle of Man Financial Services Authority", url: "https://www.iomfsa.im/media/3407/fsa-virtual-assets-perimeter-guidance.pdf", sourceType: "regulator" },
  { id: "manx-immigration", title: "Immigration", publisher: "Isle of Man Government", url: "https://www.gov.im/immigration", sourceType: "guidance" },
  { id: "manx-worker-migrant-changes", title: "Worker Migrant rule changes and transitional arrangements", publisher: "Isle of Man Government", url: "https://www.gov.im/categories/travel-traffic-and-motoring/immigration/latest-immigration-rules-and-associated-policy-notices/", sourceType: "guidance" },
  { id: "manx-work-permits", title: "Work permits", publisher: "Isle of Man Government", url: "https://www.gov.im/categories/working-in-the-isle-of-man/work-permits/", sourceType: "guidance" },
  { id: "manx-health", title: "Reciprocal Healthcare Arrangement", publisher: "Isle of Man Government", url: "https://www.gov.im/about-the-government/departments/health-and-social-care/reciprocal-healthcare-arrangement/", sourceType: "guidance" },
  { id: "manx-social-security", title: "Reciprocal agreement with the UK", publisher: "Isle of Man Government", url: "https://www.gov.im/categories/tax-vat-and-your-money/income-tax-and-national-insurance/national-insurance-contributions/reciprocal-agreement-with-the-uk/", sourceType: "guidance" },
  { id: "manx-planning", title: "Planning and Building Control legislation", publisher: "Isle of Man Government", url: "https://pabc.gov.im/pbc/legislation/", sourceType: "legislation" },
  { id: "manx-ship-registry", title: "Isle of Man Ship Registry", publisher: "Isle of Man Government", url: "https://www.iomshipregistry.com/", sourceType: "registry" },
  { id: "manx-aircraft-registry", title: "Aircraft Registry Digital Information System", publisher: "Isle of Man Aircraft Registry", url: "https://ardis.iomaircraftregistry.com/", sourceType: "registry" },
  { id: "manx-vehicle-registration", title: "Vehicle registration and licensing", publisher: "Isle of Man Government", url: "https://www.gov.im/categories/travel-traffic-and-motoring/drivers-and-vehicles/vehicle-registration-and-licensing", sourceType: "registry" },
  { id: "manx-statistics", title: "Statistics Isle of Man", publisher: "Isle of Man Government", url: "https://www.gov.im/about-the-government/departments/cabinet-office/statistics-isle-of-man/", sourceType: "statistics" },
  { id: "manx-language", title: "Learn Manx", publisher: "Culture Vannin", url: "https://www.learnmanx.com/", sourceType: "culture" },
];

const manxSourceById = new Map(manxSources.map((source) => [source.id, source]));

export const manxAgentContract = {
  subset: "MANX",
  canonicalJurisdiction: "Isle of Man",
  nativeName: "Ellan Vannin",
  aliases: ["MANX", "Isle of Man", "Ellan Vannin", "Mann", "IM", "IOM"],
  classification: "A self-governing Crown Dependency with its own legislature, government, courts, legal system and fiscal system; it is not part of the United Kingdom and is not a British Overseas Territory.",
  useWhen: "A question has a material Isle of Man nexus, concerns whether a UK rule reaches the Island, or requires a Manx institution, register, licence, status, tax, court or evidence route.",
  answerSequence: [
    "Classify the constitutional, legal and territorial nexus before comparing rules.",
    "Route the question to one or more MANX modules and name the competent Manx institution.",
    "Identify the current Manx enactment, extension instrument, reciprocal arrangement or registry record that supplies authority.",
    "Separate operative law from guidance, proposals, announcements and administrative practice.",
    "State the review date, volatility and evidence still needed for a fact-specific conclusion.",
    "Use the connected atlas corpus for comparative context without importing a UK, Jersey or Guernsey result.",
  ],
  hardStops: [
    "Never describe the Isle of Man as part of the UK, Great Britain or the British Overseas Territories.",
    "Never assume a Westminster Act, UK visa, UK licence, UK company status or UK court step operates in the Island without a Manx legal bridge.",
    "Never collapse CTA travel, immigration permission, right to work and the work-permit regime into one test.",
    "Never treat shared customs, VAT, health or social-security arrangements as general constitutional integration.",
    "Never give a live legal, tax, regulatory or immigration conclusion from a dated summary alone; follow the primary source and commencement history.",
  ],
};

export const manxFocusedSubset = {
  name: "MANX",
  jurisdiction: manxAgentContract.canonicalJurisdiction,
  page: "/manx",
  api: "/api/manx",
  purpose: "Route Isle of Man baselines through focused Manx institutions, decision signals and primary sources.",
} as const;

const coreConnections: Record<string, ManxConnection> = {
  constitutionalFamily: { label: "The constitutional family", href: "/knowledge/constitutional-family", kind: "core", use: "Place the Island correctly within the British constitutional map." },
  crownDependencies: { label: "Crown Dependencies", href: "/knowledge/crown-dependencies", kind: "core", use: "Compare the Crown relationship without treating the three dependencies as interchangeable." },
  manxArticle: { label: "Isle of Man core dossier", href: "/knowledge/isle-of-man", kind: "core", use: "Use the concise citable starting point before a specialist module." },
  earth: { label: "MANX Earth & Street View", href: "/manx/earth", kind: "place", use: "Open satellite context, street-level viewpoints and nearby place searches for named Manx localities." },
  answers: { label: "1,000 templated research baselines", href: "/questions?jurisdiction=Isle%20of%20Man", kind: "answers", use: "Open the domain-by-lens bank of templated research baselines with the Manx jurisdiction preselected; each entry is composed from templates, not individually researched." },
  answersApi: { label: "Isle of Man baseline API", href: "/api/answers?jurisdiction=Isle%20of%20Man", kind: "machine", use: "Retrieve all 1,000 templated research baselines for the Island as JSON." },
  place: { label: "Isle of Man place profile", href: "/explore?place=isle-of-man", kind: "place", use: "Ground legal and policy analysis in population, geography, economy and identity." },
  service: { label: "Service of process dossier", href: "/doctoral/service-of-process", kind: "doctoral", use: "Trace Manx procedural formality and service out across borders." },
  vehicles: { label: "Vehicle marks dossier", href: "/doctoral/vehicle-registration-marks", kind: "doctoral", use: "Compare MAN, MN and MANX registration marks and cross-border vehicle effects." },
  companyNames: { label: "Company names dossier", href: "/doctoral/company-names", kind: "doctoral", use: "Keep identity and registration effects separate across company registers." },
  registeredOffices: { label: "Registered offices dossier", href: "/doctoral/registered-offices-and-individuals", kind: "doctoral", use: "Distinguish registered-office publicity, personal address and service." },
  recognition: { label: "Recognition and residual gaps", href: "/doctoral/recognition-and-residual-gaps", kind: "doctoral", use: "Test where a UK, Irish, Jersey or Manx legal effect stops and local validation begins." },
};

export const manxModules: ManxModule[] = [
  {
    id: "constitutional-order",
    number: "01",
    title: "Constitutional order",
    strapline: "Start with the Crown relationship, not a UK analogy.",
    purpose: "Classify authority among Tynwald, the Council of Ministers, the Lieutenant Governor, the Crown and the UK Government before reaching the subject rule.",
    capabilities: [
      "Correctly classify the Island and explain why devolution language is misleading.",
      "Map a public question to Tynwald, a Manx department, the Lieutenant Governor, the Crown or the UK Government.",
      "Distinguish domestic autonomy from UK responsibility for defence and international relations.",
    ],
    signals: [
      { statement: "The Isle of Man is a self-governing Crown Dependency and is not part of the United Kingdom.", implication: "UK-wide labels and datasets require a territorial-coverage check before use.", volatility: "structural" },
      { statement: "Tynwald's legislative authority is not a devolved grant from Westminster.", implication: "Research starts with Manx competence and local legislation, not a reserved-powers schedule.", volatility: "structural" },
      { statement: "The UK acts for the Crown on defence and international relations, subject to evolving entrustment and consultation practice.", implication: "External authority must be traced instrument by instrument.", volatility: "periodic" },
    ],
    guardrails: ["Do not call Tynwald a devolved parliament.", "Do not infer that Crown Dependency status makes Jersey or Guernsey law persuasive or applicable."],
    keywords: ["isle of man", "constitution", "crown dependency", "crown", "tynwald", "house of keys", "legislative council", "lieutenant governor", "lord of mann", "government", "sovereignty", "devolution"],
    sourceIds: ["iom-overview", "crown-dependencies", "tynwald-legislation"],
    connections: [coreConnections.constitutionalFamily, coreConnections.crownDependencies, coreConnections.manxArticle, coreConnections.answers],
  },
  {
    id: "legislation-courts",
    number: "02",
    title: "Legislation, courts & remedies",
    strapline: "Establish the Manx text, commencement and forum.",
    purpose: "Research Acts of Tynwald, applied or extended UK legislation, secondary instruments, Manx procedure, judgments, appeal routes and enforcement.",
    capabilities: [
      "Build an authority chain from current Manx text through amendments and commencement.",
      "Route civil, criminal, summary, appellate and final-appeal questions to the proper court level.",
      "Test service, limitation, judgment recognition and enforcement as separate procedural stages.",
    ],
    signals: [
      { statement: "Most new primary legislation affecting the Island is made in Tynwald; UK legislation can reach it only through a recognised route.", implication: "The title of a UK Act is never enough evidence of territorial application.", volatility: "structural" },
      { statement: "The court hierarchy includes the High Court, Staff of Government (Appeal Division) and, for final appeal, the Judicial Committee of the Privy Council.", implication: "UK Supreme Court authorities are not the Island's final appellate decisions merely because they are UK cases.", volatility: "periodic" },
      { statement: "The legislation database, court rules and judgments answer different parts of a legal question.", implication: "A defensible answer cites operative text, procedural route and relevant judicial treatment separately.", volatility: "live-check" },
    ],
    guardrails: ["Do not substitute England and Wales CPR for the Rules of the High Court of Justice 2009.", "Do not assume recognition, service or enforcement because the underlying judgment is British."],
    keywords: ["law", "act", "legislation", "statute", "order", "commencement", "court", "deemster", "appeal", "privy council", "judgment", "service", "enforcement", "limitation"],
    sourceIds: ["tynwald-legislation", "manx-legislation", "manx-courts", "manx-judgments"],
    connections: [coreConnections.service, coreConnections.registeredOffices, coreConnections.recognition, coreConnections.answersApi],
  },
  {
    id: "external-relations",
    number: "03",
    title: "UK, international & treaty bridges",
    strapline: "A British connection is context; an instrument supplies legal effect.",
    purpose: "Determine when a UK act, treaty, sanctions measure, reciprocal arrangement or international obligation extends to or is implemented in the Island.",
    capabilities: [
      "Audit territorial clauses, Orders in Council, Manx implementing measures and commencement dates.",
      "Distinguish UK representation from Manx domestic implementation and enforcement.",
      "Identify where a reciprocal scheme creates a narrow bridge without merging the jurisdictions.",
    ],
    signals: [
      { statement: "The UK is responsible for the Island's international relations, but Manx interests and domestic implementation remain distinct questions.", implication: "Treaty participation and domestic effect must each be proved.", volatility: "periodic" },
      { statement: "Letters of Entrustment may authorise the Manx Government to negotiate or conclude defined international arrangements.", implication: "The scope of the entrustment, not general practice, controls the capacity exercised.", volatility: "live-check" },
      { statement: "Customs, health, social security and other UK–Manx arrangements are subject-specific.", implication: "Never generalise one bridge into a rule of UK equivalence.", volatility: "live-check" },
    ],
    guardrails: ["Do not treat UK treaty ratification as automatic territorial extension.", "Do not infer domestic rights from political statements or a signed instrument before entry into force."],
    keywords: ["uk", "westminster", "treaty", "international", "order in council", "extension", "territorial extent", "sanctions", "letters of entrustment", "reciprocal", "defence", "external relations"],
    sourceIds: ["crown-dependencies", "tynwald-legislation", "manx-legislation"],
    connections: [coreConnections.constitutionalFamily, coreConnections.recognition, coreConnections.answers],
  },
  {
    id: "tax-customs",
    number: "04",
    title: "Tax, VAT & customs",
    strapline: "Separate direct-tax autonomy from the shared indirect-tax bridge.",
    purpose: "Route income, corporate, national-insurance, VAT, customs, excise, import and export questions to the right Manx rule and any operative UK agreement.",
    capabilities: [
      "Distinguish residence, source, taxpayer, rate, allowance and reporting period under Manx direct-tax law.",
      "Explain the UK–Isle of Man Customs and Excise Agreement without implying general UK tax jurisdiction.",
      "Identify when current annual rates, Budget measures, VAT notices or customs procedures require a live check.",
    ],
    signals: [
      { statement: "The Island has its own direct-tax system and annually reviewed rates and allowances.", implication: "A UK tax rate, residence assumption or filing route is not a Manx answer.", volatility: "live-check" },
      { statement: "For customs, excise and VAT, the UK and Island are treated as one under a specific agreement backed by legislation.", implication: "Shared treatment is real but confined to the agreement's subject matter and exceptions.", volatility: "periodic" },
      { statement: "National-insurance coordination relies on reciprocal arrangements that can change independently of income tax.", implication: "Contribution liability and benefit entitlement require their own effective-date analysis.", volatility: "live-check" },
    ],
    guardrails: ["Do not quote an annual rate without its tax year and source date.", "Do not turn customs/VAT unity into a claim that UK income or corporation tax applies."],
    keywords: ["tax", "income tax", "corporate tax", "vat", "customs", "excise", "duty", "import", "export", "eori", "national insurance", "budget", "residence", "allowance"],
    sourceIds: ["manx-tax", "manx-customs", "manx-social-security", "manx-legislation"],
    connections: [coreConnections.answers, coreConnections.answersApi, coreConnections.constitutionalFamily],
  },
  {
    id: "companies-ownership",
    number: "05",
    title: "Companies, ownership & registries",
    strapline: "Entity type, registry evidence and regulated service provider all matter.",
    purpose: "Research Manx company regimes, names, formation, registered offices and agents, filings, beneficial ownership, charges, restoration and insolvency connections.",
    capabilities: [
      "Identify whether a vehicle arises under the 1931, 2006 or another Manx statutory regime.",
      "Separate public company-file evidence from beneficial-ownership database duties and access rules.",
      "Trace naming, registered-office, registered-agent, filing and regulated corporate-service requirements together.",
    ],
    signals: [
      { statement: "The Companies Registry administers multiple entity registries with different legislation and filing obligations.", implication: "A generic 'Manx company' answer is too coarse for formation or diligence work.", volatility: "periodic" },
      { statement: "Beneficial-ownership identification, verification, submission and access are governed by a separate statutory framework.", implication: "A public company search is not a complete ownership conclusion.", volatility: "live-check" },
      { statement: "Some entity regimes require a locally regulated registered agent or corporate service provider.", implication: "Formation mechanics and the financial-services perimeter must be checked together.", volatility: "live-check" },
    ],
    guardrails: ["Do not import UK Companies Act duties or Companies House concepts by label alone.", "Do not state that a registry search proves ultimate ownership, solvency or regulatory status."],
    keywords: ["company", "companies", "1931 act", "2006 act", "llc", "foundation", "partnership", "registry", "registered office", "registered agent", "beneficial owner", "charge", "director", "incorporation", "restoration", "insolvency"],
    sourceIds: ["manx-companies", "manx-beneficial-ownership", "manx-legislation", "iomfsa"],
    connections: [coreConnections.companyNames, coreConnections.registeredOffices, coreConnections.recognition, coreConnections.answers],
  },
  {
    id: "financial-services",
    number: "06",
    title: "Finance, insurance & digital assets",
    strapline: "Map activity to the perimeter before discussing products.",
    purpose: "Classify regulated financial services, insurance, pensions, fiduciary activity, AML/CFT duties, designated businesses and virtual-asset activity under the Manx perimeter.",
    capabilities: [
      "Map business conduct to the competent regulator, licence class, registration or exemption question.",
      "Distinguish financial-services licensing from designated-business AML registration.",
      "Apply the current virtual-asset perimeter to activity and function rather than token labels.",
    ],
    signals: [
      { statement: "The Isle of Man Financial Services Authority supervises defined regulated sectors and designated-business obligations under distinct legislation.", implication: "Authorisation, AML registration and company formation are separate gates.", volatility: "live-check" },
      { statement: "Virtual-asset treatment depends on the actual activity and can engage more than one perimeter.", implication: "A token's marketing name cannot settle licensing, custody, exchange or AML treatment.", volatility: "live-check" },
      { statement: "Cross-border promotion or service can create obligations outside the Island as well as within it.", implication: "A Manx licence or registration is not a passport into the UK or another market.", volatility: "structural" },
    ],
    guardrails: ["Do not treat registration as a quality endorsement or a substitute for licensing.", "Do not provide structures for evading tax, sanctions, beneficial-ownership or AML controls."],
    keywords: ["finance", "bank", "insurance", "pension", "fiduciary", "trust", "fund", "licence", "fsa", "aml", "cft", "designated business", "crypto", "token", "virtual asset", "vasp", "fintech", "payments"],
    sourceIds: ["iomfsa", "iomfsa-virtual-assets", "manx-beneficial-ownership", "manx-legislation"],
    connections: [coreConnections.answers, coreConnections.answersApi, coreConnections.recognition],
  },
  {
    id: "immigration-work",
    number: "07",
    title: "Immigration, work & residence",
    strapline: "Travel, immigration status and permission to work are separate gates.",
    purpose: "Analyse Common Travel Area movement, Manx immigration permission, employer sponsorship, Immigration Employment Documents, work permits, exemptions and residence evidence.",
    capabilities: [
      "Separate British or Irish CTA movement from the rules applying to other nationalities.",
      "Test immigration permission and work-permit requirements independently.",
      "Identify current route, employer and transitional requirements for a proposed move or hire.",
    ],
    signals: [
      { statement: "The Island participates in the Common Travel Area, but CTA movement does not erase Manx employment controls.", implication: "Nationality, immigration permission and Isle of Man Worker or exemption status must be classified separately.", volatility: "periodic" },
      { statement: "An Immigration Employment Document can evidence permission to work and an exemption from a separate work permit for its holder.", implication: "The document and its conditions must be verified rather than inferred from a visa label.", volatility: "live-check" },
      { statement: "Worker Migrant rules and associated employer policies changed on 1 June 2026, with transitional arrangements for earlier applications and Confirmations of Employment.", implication: "Check the application and Confirmation of Employment dates, transitional provisions and the current rules before applying the change to an individual case.", volatility: "live-check" },
    ],
    guardrails: ["Do not say that a UK work visa authorises work in the Island.", "Do not treat property ownership, tax residence, immigration leave and Isle of Man Worker status as the same concept."],
    keywords: ["immigration", "visa", "common travel area", "cta", "work", "employment", "work permit", "worker migrant", "sponsor", "residence", "right to work", "isle of man worker", "ied", "relocation"],
    sourceIds: ["manx-immigration", "manx-worker-migrant-changes", "manx-work-permits", "iom-overview", "manx-legislation"],
    connections: [coreConnections.answers, coreConnections.place, coreConnections.constitutionalFamily],
  },
  {
    id: "land-public-services",
    number: "08",
    title: "Land, planning & public services",
    strapline: "Local eligibility and reciprocal access are evidence questions.",
    purpose: "Route land registration, conveyancing, planning, housing, health, social security, education and local-service questions through Manx institutions and narrow reciprocal arrangements.",
    capabilities: [
      "Separate title evidence, planning permission, building control and occupancy or eligibility questions.",
      "Check the scope and duration of reciprocal healthcare rather than assuming NHS equivalence.",
      "Trace national-insurance and benefit coordination by contribution period, worker status and effective agreement.",
    ],
    signals: [
      { statement: "Land registration and planning operate under Manx legislation and local administrative systems.", implication: "UK title, planning and housing terminology may conceal different legal tests.", volatility: "periodic" },
      { statement: "The UK–Isle of Man reciprocal healthcare arrangement covers defined necessary care for visitors; it is not general NHS membership.", implication: "Treatment type, residence, visit duration and referral pathway still matter.", volatility: "live-check" },
      { statement: "Social-security coordination is agreement-specific and has changed over time.", implication: "Contribution history and the effective instrument are essential evidence.", volatility: "live-check" },
    ],
    guardrails: ["Do not infer planning consent from title or title from occupation.", "Do not promise free treatment, benefit portability or pension treatment without checking current scope and facts."],
    keywords: ["land", "property", "title", "deeds", "planning", "building control", "housing", "health", "healthcare", "manx care", "social security", "benefit", "pension", "education", "reciprocal"],
    sourceIds: ["manx-planning", "manx-health", "manx-social-security", "manx-legislation"],
    connections: [coreConnections.place, coreConnections.earth, coreConnections.answers, coreConnections.recognition],
  },
  {
    id: "transport-registries",
    number: "09",
    title: "Vehicles, ships & aircraft",
    strapline: "Registration creates a governed status, not universal portability.",
    purpose: "Research road vehicles and MAN/MN/MANX marks, visiting-vehicle rules, ship and aircraft registration, qualified ownership, safety regulation and cross-border recognition.",
    capabilities: [
      "Distinguish a registration mark, vehicle registration, title, licensing and permission for temporary foreign use.",
      "Route ship and aircraft questions to the relevant registry, safety regulator and enabling legislation.",
      "Test whether a Manx registration produces the claimed tax, operational or recognition effect elsewhere.",
    ],
    signals: [
      { statement: "MAN, MN and MANX vehicle marks arise under Manx registration legislation.", implication: "Display and reassignment rights depend on Manx rules, while use abroad depends on receiving law.", volatility: "periodic" },
      { statement: "The ship and aircraft registries are also safety-regulatory systems.", implication: "Eligibility to register, operational compliance and commercial structuring are separate enquiries.", volatility: "live-check" },
      { statement: "Registry status does not by itself settle ownership, tax residence, customs treatment or permission to operate in another state.", implication: "Cross-border effects require an additional receiving-law analysis.", volatility: "structural" },
    ],
    guardrails: ["Do not describe a personalised mark as ownership of an immutable asset without checking the legislation.", "Do not market Manx registration as a shortcut around another jurisdiction's tax, sanctions or safety rules."],
    keywords: ["vehicle", "car", "registration", "number plate", "manx plate", "man", "mn", "ship", "yacht", "flag", "aircraft", "aviation", "registry", "m-reg", "transport", "customs"],
    sourceIds: ["manx-vehicle-registration", "manx-ship-registry", "manx-aircraft-registry", "manx-legislation"],
    connections: [coreConnections.vehicles, coreConnections.earth, coreConnections.recognition, coreConnections.answers],
  },
  {
    id: "identity-evidence",
    number: "10",
    title: "People, language & evidence",
    strapline: "Use Manx categories and Manx data before importing a British average.",
    purpose: "Ground answers in Manx demography, labour-market evidence, language, cultural institutions, local naming and the distinction between identity and legal status.",
    capabilities: [
      "Route population, earnings and social claims to dated Statistics Isle of Man releases.",
      "Use Isle of Man, Manx and Ellan Vannin accurately without turning identity terms into legal-status tests.",
      "Add cultural and linguistic context without substituting heritage narratives for legal authority.",
    ],
    signals: [
      { statement: "Official Manx statistics use their own periods, definitions and experimental-status labels.", implication: "UK regional figures are comparators, not substitutes for local evidence.", volatility: "live-check" },
      { statement: "Manx Gaelic (Gaelg) is an indigenous language with active public and community revival work.", implication: "Names, bilingual material and cultural meaning should be preserved where relevant.", volatility: "periodic" },
      { statement: "Manx identity, residence, nationality, domicile, tax residence and Isle of Man Worker status are different categories.", implication: "A claim about one cannot be used as evidence of another without the legal test.", volatility: "structural" },
    ],
    guardrails: ["Do not use 'Manx' as a proxy for citizenship, ethnicity, residence or work status.", "Do not compare economic figures without retaining the local measure, reference period and population."],
    keywords: ["manx", "ellan vannin", "gaelg", "language", "culture", "identity", "population", "census", "statistics", "earnings", "labour market", "history", "heritage", "name"],
    sourceIds: ["manx-statistics", "manx-language", "iom-overview"],
    connections: [coreConnections.place, coreConnections.earth, coreConnections.manxArticle, coreConnections.answers],
  },
];

export const manxConnections = Object.values(coreConnections);

export function getManxSource(id: string) {
  const source = manxSourceById.get(id);
  if (!source) throw new Error(`Unknown MANX source: ${id}`);
  return source;
}

export function getManxSources(ids: string[]) {
  return ids.map(getManxSource);
}

export function getManxModule(id: string) {
  return manxModules.find((module) => module.id === id);
}

function normalise(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function terms(value: string) {
  return normalise(value).split(" ").filter((term) => term.length > 1);
}

const manxSearchIndex = manxModules.map((module) => ({
  module,
  keywords: module.keywords.map((keyword) => ({ keyword, terms: terms(keyword) })),
  haystack: new Set(terms(`${module.title} ${module.strapline} ${module.purpose} ${module.capabilities.join(" ")} ${module.signals.map((signal) => `${signal.statement} ${signal.implication}`).join(" ")}`)),
}));

export function searchManxModules(query: string) {
  const phrase = normalise(query);
  if (!phrase) return [];
  const queryTerms = [...new Set(phrase.split(" ").filter((term) => term.length > 1))];
  const queryTermSet = new Set(queryTerms);
  return manxSearchIndex
    .map(({ module, keywords, haystack }) => {
      const keywordMatches = keywords.map((keyword) => ({ ...keyword, matchedTerms: keyword.terms.filter((term) => queryTermSet.has(term)).length })).filter((keyword) => keyword.matchedTerms > 0);
      const matchedKeywords = keywordMatches.map(({ keyword }) => keyword);
      const keywordScore = keywordMatches.reduce((score, keyword) => score + 4 * (keyword.matchedTerms / keyword.terms.length), 0);
      const termScore = queryTerms.reduce((score, term) => score + (haystack.has(term) ? 1 : 0), 0);
      const score = keywordScore + termScore;
      return { module, score, matchedKeywords };
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.module.number.localeCompare(b.module.number));
}
