export type QuestionDomain = {
  slug: string;
  title: string;
  description: string;
  topics: string[];
};

export const questionDomains: QuestionDomain[] = [
  { slug: "corporate-structuring", title: "Corporate structuring", description: "Entity classification, control, substance and cross-border group design.", topics: ["hybrid entity classification", "check-the-box elections", "intellectual-property transfer pricing", "intra-group debt and earnings stripping", "place of effective management", "separation of control and economic ownership", "corporate continuation and redomiciliation", "treaty-conduit structures", "protected and segregated cells", "corporate inversions"] },
  { slug: "tax-capital", title: "Tax, deductions & capital", description: "Deferral, valuation, characterisation and statutory reliefs.", topics: ["borrowing against unrealised gains", "basis adjustment on death", "like-kind property exchanges", "carried-interest characterisation", "qualified small-business stock relief", "tax-neutral corporate separations", "research and development credits", "cost segregation and accelerated depreciation", "private-placement life insurance", "withholding-tax treaty claims"] },
  { slug: "trusts-estates", title: "Trusts, assets & estates", description: "Control, creditor rights, succession and beneficial ownership.", topics: ["foreign asset-protection trusts", "trust migration and flight clauses", "spendthrift protections", "perpetual and dynasty trusts", "grantor-retained annuity trusts", "intentionally defective grantor trusts", "family partnership valuation discounts", "domestic self-settled trusts", "blind trusts and conflicts of interest", "non-charitable purpose trusts"] },
  { slug: "residency-mobility", title: "Residency & mobility", description: "Residence, domicile, nationality and cross-border personal taxation.", topics: ["non-residence across territorial systems", "remittance-basis taxation", "statutory residence day counting", "foreign earned-income exclusions", "investment migration programmes", "citizenship renunciation and exit tax", "lump-sum taxation regimes", "digital-nomad visas", "split-year residence treatment", "tax-treaty residence tie-breakers"] },
  { slug: "maritime-aviation", title: "Maritime & aviation", description: "Registration, asset finance, operating jurisdiction and liability.", topics: ["open ship registries", "bareboat charter registration", "aircraft owner trusts", "Cape Town Convention priorities", "temporary admission for yachts", "aircraft and engine leasing vehicles", "high-seas jurisdiction", "tonnage-tax regimes", "maritime limitation of liability", "sovereign-base jurisdiction"] },
  { slug: "finance-crypto", title: "Finance, fintech & crypto", description: "Regulatory perimeter, custody, disclosure and market integrity.", topics: ["DAO and protocol legal personality", "recursive collateralised borrowing", "token securities classification", "offshore derivatives onboarding", "stablecoin reserve structures", "merchant-of-record payment models", "high-frequency order handling", "private-placement exemptions", "segregated client-money trusts", "digital-asset attachment and custody"] },
  { slug: "litigation-insolvency", title: "Litigation & insolvency", description: "Forum, recognition, creditor priority and accountability.", topics: ["foreign sovereign immunity", "investment-treaty arbitration", "refusal of foreign arbitral awards", "debtor-in-possession restructuring", "cross-border insolvency recognition", "structural subordination", "group liability across non-signatory subsidiaries", "divisional-merger mass-tort restructurings", "extraterritorial contractor liability", "forum non conveniens"] },
  { slug: "intellectual-property", title: "Intellectual property", description: "Licensing, safe harbours, territorial rights and competition.", topics: ["patent-box taxation", "platform copyright safe harbours", "copyleft software boundaries", "pharmaceutical patent evergreening", "territorial copyright licensing", "cross-border royalty clearing", "first-to-file trademark systems", "international IP holding companies", "text-and-data-mining exceptions", "patent pools and cross-licensing"] },
  { slug: "employment-services", title: "Employment & services", description: "Worker status, payroll nexus, incentives and professional networks.", topics: ["independent-contractor classification", "employers of record", "equity compensation elections", "maritime crew employment", "split payroll arrangements", "executive severance protections", "seasonal and guest-worker exemptions", "cross-border consultancy classification", "Swiss Verein professional networks", "cross-border non-compete enforcement"] },
  { slug: "trade-sanctions", title: "Trade, tariffs & sanctions", description: "Origin, customs valuation, export controls and supply-chain integrity.", topics: ["substantial-transformation origin rules", "first-sale customs valuation", "free-trade zones and bonded warehouses", "de minimis import thresholds", "non-dollar trade settlement", "vessel identity and AIS compliance", "dual-use end-user controls", "outward-processing relief", "trade-preference origin claims", "parallel imports and exhaustion"] },
];

export const questionLenses = [
  { slug: "legal-basis", title: "Legal basis", build: (topic: string, place: string) => `What is the current statutory and regulatory basis for ${topic} in ${place}, which authorities administer it, and where does the rule stop applying?` },
  { slug: "eligibility", title: "Eligibility", build: (topic: string, place: string) => `Who can lawfully use ${topic} in ${place}, what conditions must be satisfied, and which persons, assets or transactions are excluded?` },
  { slug: "classification", title: "Classification", build: (topic: string, place: string) => `How does ${place} classify ${topic} for tax, regulatory and private-law purposes, and where can another jurisdiction reach a different classification?` },
  { slug: "substance", title: "Substance & purpose", build: (topic: string, place: string) => `What economic-substance, commercial-purpose and control evidence is required for ${topic} to be respected in ${place}?` },
  { slug: "disclosure", title: "Disclosure", build: (topic: string, place: string) => `Which registrations, beneficial-ownership reports, tax disclosures and professional notifications does ${topic} trigger in ${place}?` },
  { slug: "anti-abuse", title: "Anti-abuse rules", build: (topic: string, place: string) => `Which general or targeted anti-abuse rules in ${place} can defeat ${topic}, and what facts most often trigger recharacterisation?` },
  { slug: "enforcement", title: "Enforcement", build: (topic: string, place: string) => `How do regulators, tax authorities and courts in ${place} detect and challenge abusive use of ${topic}, and what penalties or remedies apply?` },
  { slug: "precedent", title: "Cases & precedent", build: (topic: string, place: string) => `Which leading decisions or published rulings in ${place} define the lawful boundary of ${topic}, and which factual distinctions determined the outcome?` },
  { slug: "cross-border", title: "Cross-border conflict", build: (topic: string, place: string) => `When ${topic} spans ${place} and another jurisdiction, which residence, source, treaty, conflict-of-laws or recognition rules decide the result?` },
  { slug: "reform", title: "Reform & safeguards", build: (topic: string, place: string) => `What reforms have been proposed or enacted in ${place} concerning ${topic}, which avoidance risk do they target, and what legitimate activity must they preserve?` },
];

export type ResearchQuestion = {
  id: string;
  number: number;
  domain: string;
  domainSlug: string;
  topic: string;
  lens: string;
  lensSlug: string;
  jurisdiction: string;
  question: string;
};

export function buildQuestionBank(jurisdiction = "the selected jurisdiction"): ResearchQuestion[] {
  let number = 0;
  return questionDomains.flatMap((domain) => domain.topics.flatMap((topic) => questionLenses.map((lens) => {
    number += 1;
    return { id: `Q-${number.toString().padStart(4, "0")}`, number, domain: domain.title, domainSlug: domain.slug, topic, lens: lens.title, lensSlug: lens.slug, jurisdiction, question: lens.build(topic, jurisdiction) };
  })));
}

export const defaultQuestionBank = buildQuestionBank();
