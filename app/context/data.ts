import { jurisdictionProfiles } from "../questions/answer-data";
import { getTerritory, territoryDossiers, type TerritoryDossier } from "../territories/data";

export const contextReviewedAt = "2026-08-16";

type ContextItem = { category: string; question: string; principle: string };

const sections: { category: string; items: [string, string][] }[] = [
  { category: "Service, process & notice", items: [
    ["What constitutes a valid address for service of originating process on a natural person who has no fixed residential address?", "No universal declared address is sufficient. The local procedural code normally requires personal service, a qualifying last-known location, service out, or a court-approved alternative supported by evidence of reasonable tracing."],
    ["Can a purely electronic address ever satisfy a statutory requirement for an ‘address for service’?", "Only where legislation, court rules, an authorised agreement or a judicial order gives the electronic channel that effect. Email receipt alone does not automatically satisfy a rule requiring a physical address."],
    ["How do systems treat service effected at a ‘care-of’ or accommodation address that the recipient does not regularly attend?", "A care-of address works only if the applicable rule or appointment recognises it. Sporadic attendance weakens proof of notice and may justify a substituted-service application rather than unilateral reliance."],
    ["What happens when a document is validly served under the rules of Territory A but later relied upon in Territory B?", "Origin validity is necessary but not conclusive. The receiving system applies its own recognition rule, including jurisdiction, notice, timing and public-policy safeguards."],
    ["Is personal service still effective if the recipient refuses to accept the document?", "Many systems treat an informed refusal as effective once the server identifies the document and leaves it within the recipient’s control, but the precise local rule and proof of the encounter govern."],
    ["Can service on a company at its registered office remain valid after the company has ceased to maintain a physical presence there?", "Statutory service may remain effective at the registered address until the register is validly changed, although false or obsolete filings can trigger separate defaults, penalties and recognition objections."],
    ["How do rules distinguish between an address for service and an address for ordinary correspondence?", "A service address has effect because a procedural or statutory rule designates it. A correspondence address is factual convenience and does not acquire procedural force without a separate legal basis."],
    ["What residual powers does a court retain to order alternative service when conventional methods fail?", "Courts commonly retain a controlled power to approve a method likely to bring proceedings to the defendant’s attention. Diligence, proportionality and a clear evidential trail are central."],
    ["Does publication in a designated newspaper or gazette ever constitute constructive service, and under what precise conditions?", "Publication is effective only when a rule or order authorises it and its prescribed content, outlet and duration are followed. It is generally a last resort, not a self-executing substitute."],
    ["How is service treated when the recipient is temporarily outside the jurisdiction but maintains a local address?", "A maintained local address can remain relevant, but originating process, service out and any known foreign location must be analysed separately. Temporary absence does not itself validate every local delivery."],
  ]},
  { category: "Corporate identity, names & registration", items: [
    ["Can two separate legal systems simultaneously recognise companies with identical or near-identical names?", "Yes. Name availability is registry-relative, so identical names can coexist in independent systems. Jurisdiction and company number are required to distinguish the legal persons."],
    ["What legal consequences follow when a name that is exclusive on one register is used as a trading style in another territory?", "Foreign registry exclusivity does not normally travel by itself. Trade marks, passing off, consumer deception and the receiving territory’s business-name rules determine any remedy."],
    ["Does registration of a company name confer any exclusive right that travels with the company across borders?", "Usually not. Incorporation protects the name within the relevant index; cross-border exclusivity requires an applicable trade mark, goodwill-based claim or other receiving-law protection."],
    ["How do systems treat a company that changes its registered office to a different territory while retaining the same name?", "A mere address change cannot migrate a company outside the territory authorised by its incorporation law. Continuation or redomiciliation requires an express outbound and inbound statutory route."],
    ["What formal requirements attach to a company’s registered office, and can a pure postal or virtual address ever satisfy them?", "The local company statute controls. Modern regimes commonly require a physical or ‘appropriate’ address where documents can reach someone acting for the company; a mailbox alone may be insufficient."],
    ["Is a registered office address that is shared by hundreds of companies treated differently from one occupied by a single entity?", "Sharing is not inherently invalid, but it increases scrutiny of genuine access, record-keeping, licensed-provider duties, consent to use and the reliability of service."],
    ["How do naming rules interact with trade-mark and passing-off doctrines when the same string appears in multiple registers?", "Registry screening, trade marks and passing off protect different interests. Successful incorporation is not a defence to infringement or misleading conduct."],
    ["What happens when a dissolved company’s name becomes available again in one system while remaining protected or in use elsewhere?", "Local availability can revive without extinguishing foreign trade marks, goodwill or restoration rights. Reuse must be tested against each separate regime."],
    ["Can a foreign company lawfully use a name that would be prohibited if it sought domestic incorporation?", "Sometimes, because foreign recognition and domestic incorporation perform different functions. Trading-disclosure, sensitive-name, consumer-protection and registration-of-foreign-company rules may still restrict use."],
    ["How is the concept of ‘too like’ or ‘confusingly similar’ applied across independent company registries?", "Each registrar applies its own statutory comparison and disregarded words or symbols. A decision in one index is evidence at most, not a binding cross-registry determination."],
  ]},
  { category: "Vehicle, asset & identifier registration", items: [
    ["Can a registration mark lawfully issued in one territory be displayed on a vehicle while it is used on public roads in another?", "Yes, when host law permits temporary use of the lawfully foreign-registered vehicle. The mark remains foreign; it is not absorbed into the host registry."],
    ["What time or residence limits convert temporary recognition of a foreign registration mark into a local registration obligation?", "The host territory’s import, residence and vehicle rules set the trigger. Duration is only one factor; ordinary residence, permanent import and keeper status can be decisive."],
    ["How do systems prevent (or fail to prevent) collision between registration marks issued by neighbouring or related territories?", "Uniqueness is maintained within each registry, while territorial formats and origin identifiers distinguish equal character strings. Cross-registry collision is managed operationally rather than prohibited globally."],
    ["Does ownership of a personalised identifier in one system create any enforceable priority in another?", "No general priority travels. The holder usually owns a regulated assignment or display entitlement within the issuing system, not universal property in the characters."],
    ["What formal steps are required to transfer a registration mark between keepers located in different territories?", "The issuing registry must permit retention or transfer, and the destination must separately register the vehicle. A mark normally cannot be exported as if both registries were one database."],
    ["How is a vehicle treated when it carries marks that are valid under its home system but non-compliant with the display rules of the territory where it is driven?", "Home allocation and host display compliance are separate. The vehicle may remain registered at home yet commit a host-road offence through illegible, reformatted or improperly positioned plates."],
    ["Can the same physical asset carry simultaneous valid registrations under two different systems?", "Occasionally overlapping records exist during export or finance transitions, but ordinary road regimes expect one operative registration. Dual display risks misidentification and non-compliance."],
    ["What residual recognition is given to a mark after the underlying vehicle has been permanently exported?", "Any continuing entitlement depends on the home registry’s retention scheme. Host authorities recognise the newly operative registration, not a detached historical plate."],
    ["How do systems treat identifiers that are unique within one register but identical to identifiers issued elsewhere?", "The identifier is read together with issuing jurisdiction, format and record. Identical text does not mean identical legal identity."],
    ["What happens when a registration mark is retained on a certificate while the vehicle itself is re-registered under a different system?", "The certificate preserves only the issuing system’s retention entitlement and deadline. The exported vehicle must display the destination registration unless a specific transitional rule applies."],
  ]},
  { category: "Personal status, capacity & domicile", items: [
    ["How do systems determine the domicile or habitual residence of a person who maintains residences in multiple territories?", "Domicile examines home and intention; habitual residence is a fact-sensitive centre of life. Neither is determined solely by property ownership, nationality or a self-description."],
    ["What formal acts are required to change domicile, and how is the change recognised elsewhere?", "A domicile of choice generally requires actual residence plus an intention to reside indefinitely. Recognition depends on the receiving forum’s conflicts rules and evidence, not a single registration form."],
    ["Can a person be treated as resident for some legal purposes and non-resident for others within the same system?", "Yes. Tax, immigration, voting, social benefits and private international law use different residence definitions and periods."],
    ["How is capacity to contract or litigate assessed when the person’s personal law and the law of the forum diverge?", "The forum characterises the capacity issue and applies its conflicts rule, while procedural capacity is commonly controlled by forum law. Protective mandatory rules may override foreign capacity."],
    ["What residual status attaches to a person who has left a territory but has not yet acquired a new domicile elsewhere?", "A domicile is not lost merely by departure; the existing domicile ordinarily persists until a new one is acquired, subject to the forum’s doctrine of origin and choice."],
    ["How do systems treat service or notice on a person whose only known address is outside the jurisdiction?", "The claimant must use the local service-out rule, any applicable convention or an authorised alternative. Foreign location does not remove the forum’s procedural safeguards."],
    ["Can a declaration of residence or non-residence made under one system bind authorities in another?", "Not by itself. It is evidence whose weight depends on purpose, definition, period and the receiving authority’s law."],
    ["What formal evidence is accepted as proof of residence when documentary trails are incomplete?", "Courts and authorities may combine occupancy, family, employment, travel, utilities, financial and testimonial evidence. No single document is universally conclusive."],
    ["How is the concept of ‘last known address’ applied when the person has systematically avoided fixed addresses?", "The claimant must use reasonable diligence and the genuinely last address supported by evidence, while seeking alternative service if delivery is unlikely to give notice."],
    ["What happens when two systems simultaneously claim a person as domiciled or resident?", "Each claim may be valid for its own statute. A treaty tie-breaker or the forum’s conflicts rule resolves only the issue within its scope."],
  ]},
  { category: "Cross-border recognition & enforcement", items: [
    ["When is a judgment or order of one system entitled to recognition or enforcement in another without further examination of the merits?", "Only when a treaty, reciprocal statute or common-law rule recognises the origin court and the judgment satisfies jurisdiction, finality, notice and subject-matter conditions."],
    ["What public-policy or procedural objections can still prevent recognition even when formal requirements are met?", "Fraud, fundamental notice failure, incompatible judgments, penal or excluded subject matter, and manifest public-policy conflict are common safeguards. The exact statutory list controls."],
    ["How do systems treat interim or protective measures ordered by a foreign court?", "Interim relief often falls outside ordinary judgment-registration regimes. The receiving court may grant its own protective order or use an express cooperation power."],
    ["What residual effect does a foreign insolvency or restructuring proceeding have on local assets or creditors?", "It has no universal automatic stay. Recognition statutes, model-law provisions, common-law assistance and local secured-creditor rules determine the relief."],
    ["Can a security interest perfected under one system retain priority after the asset moves to another territory?", "Possibly, but movable-asset conflicts rules, local registration, notice and transition periods may require re-perfection. The original priority is not universally portable."],
    ["How is a power of attorney or agency appointment treated when used outside the territory of its creation?", "The receiving system tests execution, scope, continuing authority, authentication and mandatory local form. Valid creation does not guarantee acceptance for land, court or registry acts."],
    ["What formal steps convert a foreign authentic instrument into a locally enforceable title?", "Authentication, apostille or legalisation, translation, registration and sometimes a local enforcement order may be required. An authentic instrument is not automatically a judgment."],
    ["How do systems handle competing claims to the same asset asserted under different governing laws?", "The forum characterises the asset and issue, selects the relevant situs or governing-law rule, then applies priority and recognition rules with any public-policy override."],
    ["What residual gaps remain when mutual recognition regimes deliberately exclude certain categories of decision?", "Excluded matters revert to specialist treaties, domestic statutes or common law. Sometimes no streamlined route exists and fresh proceedings are necessary."],
    ["How is the concept of ‘final and conclusive’ judgment applied across systems with different appeal structures?", "Finality usually means the origin court has conclusively determined the merits even if an appeal is possible, though pending appeals can justify a stay. Local statutory language controls."],
  ]},
  { category: "Formal validity versus practical effect", items: [
    ["What acts are formally valid under the law of creation yet produce no practical effect in a second territory?", "Foreign registrations, licences, service acts, security interests and notarised documents can all be valid at origin yet require a receiving-law bridge before producing local effect."],
    ["How do systems distinguish between nullity, voidability, and mere unenforceability?", "A null act is treated as legally ineffective; a voidable act operates until avoided; an unenforceable obligation may exist without a court remedy. Characterisation follows the governing law."],
    ["What residual consequences follow from an act that was formally compliant at the time but later becomes non-compliant due to a change of residence or location?", "Past validity may survive while future use becomes unlawful or requires re-registration. Accrued rights, penalties and transition rules must be separated."],
    ["Can a document that satisfies the formal requirements of one system be rejected solely because it does not satisfy the formal requirements of another?", "Yes where the receiving system applies a mandatory local form or no conflicts saving rule. Otherwise alternative-validity rules may preserve a document valid where executed."],
    ["How is ‘substantial compliance’ versus ‘strict compliance’ applied to cross-border documents?", "The statute’s purpose, wording and consequences determine whether defects can be cured. Cross-border origin does not itself lower a strict requirement."],
    ["What happens when a statutory form or prescribed wording is mandatory in one system and unknown in another?", "The forum decides whether the foreign form proves the underlying act or whether local use demands re-execution, translation, certification or a domesticated form."],
    ["How do systems treat electronic signatures or remote witnessing when the receiving territory still requires wet-ink or physical presence?", "Electronic validity at origin does not displace a mandatory receiving rule. Conflict rules, technology statutes and instrument-specific exclusions must be checked."],
    ["What residual validity attaches to a document executed in a form that has been abolished in the territory where it is later relied upon?", "Abolition is not normally retroactive unless legislation says so. Historic validity may continue, while present registration or enforcement can require updated evidence."],
    ["Can parties contractually choose a formal regime that is more (or less) demanding than the default rules of the forum?", "Parties may add evidential formalities, but cannot contract out of mandatory execution, consumer, land, company or procedural requirements."],
    ["How is the doctrine of renvoi or incidental question used (or avoided) when formal validity is in issue?", "The forum decides whether its reference is to foreign domestic law alone or the foreign conflicts system. Many statutory validity rules avoid renvoi through express connecting alternatives."],
  ]},
  { category: "Time, limitation & continuity", items: [
    ["How do limitation or prescription periods interact when a cause of action has connections to more than one territory?", "The forum first characterises limitation as procedural or substantive under its statute and conflicts law, then selects the governing period and any foreign-law exception."],
    ["What events suspend or interrupt a limitation period, and are those events recognised across borders?", "Commencement, acknowledgment, payment, disability, fraud and concealment can affect time, but only the law governing limitation decides whether a foreign event counts."],
    ["How is continuity of a legal person or office preserved when the underlying registration or appointment migrates between systems?", "Continuity requires a statutory continuation or redomiciliation route recognised at both ends. Dissolution and reincorporation ordinarily create a new person."],
    ["What residual rights survive the formal dissolution or striking-off of an entity in its home territory?", "Restoration statutes, bona vacantia rules, preserved liabilities and creditor remedies may survive. Foreign proceedings usually depend on the entity’s status under its incorporation law."],
    ["How do systems treat acts performed during a period when an entity’s registration was suspended or defective?", "Consequences range from curable filing default to incapacity or officer liability. Later restoration may validate acts only to the extent the statute provides."],
    ["What formal steps are required to revive or restore a lapsed registration or appointment?", "The relevant registry or court route, time limit, filings, fees, tax clearance and notice requirements must be met. Foreign recognition follows only after status is restored."],
    ["How is ‘relation back’ applied when a later act is deemed to take effect from an earlier date?", "Relation back is a bounded statutory fiction. It cannot automatically prejudice protected third-party rights or alter a foreign system’s independent priority rules."],
    ["What residual exposure remains after a formal discharge, release, or limitation period has expired in one system but not another?", "A discharge may not release foreign-law debts or bind non-participating creditors abroad; limitation can bar one forum while another remains open, subject to conflicts rules."],
    ["How do systems calculate time when documents or notices cross territories with different public-holiday or non-business-day rules?", "The rule governing the deadline defines business days, time zone, receipt and extensions. Dispatch from another territory does not import its calendar."],
    ["What happens when a statutory deadline is met in one system but missed according to the calculation rules of another?", "Compliance is assessed separately for each legal act. A timely origin filing does not cure an independent receiving-system deadline unless a recognition rule says so."],
  ]},
  { category: "Information, disclosure & opacity", items: [
    ["What information about legal persons or arrangements is required to be on a public register in one system but remains private in another?", "Public access varies for offices, directors, beneficial owners, accounts and trusts. Foreign publicity does not automatically expand the local register, though disclosure duties may still compel production."],
    ["How do systems treat nominee or intermediary arrangements that are transparent under one regime and opaque under another?", "Legal validity is separate from disclosure. Local beneficial-ownership, AML, fiduciary and court-discovery duties can look through a nominee regardless of foreign registry visibility."],
    ["What residual disclosure obligations arise when an entity operates in a territory that demands more information than its home register supplies?", "The host can require foreign-company registration, licences, tax information, beneficial ownership and transaction reports as a condition of local operation."],
    ["How is beneficial ownership information collected, verified, and shared (or not shared) across related but independent systems?", "Each system sets its own collection, verification, access and exchange rules. International arrangements create channels, not a single shared register."],
    ["What formal consequences follow from providing an address or identity detail that is accurate under one system’s definitions but incomplete under another’s?", "The receiving filing may be rejected or treated as misleading because its definitions control. Good-faith accuracy elsewhere does not satisfy a distinct local field."],
    ["How do systems distinguish between a service address, a residential address, and a correspondence address for disclosure purposes?", "The statute assigns each address a different function and privacy level. One location can fill several roles only when every applicable definition is met."],
    ["What residual privacy protections survive when information that is public in one register is sought in proceedings elsewhere?", "The receiving court applies its own relevance, confidentiality, data-protection and sealing rules, although public availability can reduce the expectation of secrecy."],
    ["How is the accuracy of register information presumed, and under what conditions can that presumption be rebutted?", "Registers are authoritative evidence of recorded facts but rarely conclusive of underlying truth. Filed documents, control evidence and rectification proceedings can rebut the record."],
    ["What formal remedies exist when register information is false, outdated, or deliberately incomplete?", "Correction, rectification, administrative penalties, officer liability, disqualification, fraud remedies and court orders may apply. The remedy depends on the register and defect."],
    ["How do systems treat the use of an address that is lawfully maintained for one purpose but used for another?", "Purpose matters. A lawful mail or registered-office address does not automatically satisfy residence, substance, licensing, tax or personal-service requirements."],
  ]},
  { category: "Residual & structural questions I", items: [
    ["Where does formal territorial sovereignty end and practical cross-border effect begin?", "Sovereignty authorises domestic lawmaking; practical foreign effect begins only where the receiving system supplies recognition, choice-of-law, comity or administrative permission."],
    ["What categories of legal act are deliberately left outside mutual-recognition regimes?", "Penal, revenue, insolvency, family, succession, intellectual-property and public-law decisions are frequently excluded wholly or partly, requiring specialist routes."],
    ["How do anti-avoidance or substance-over-form doctrines interact with strict formal compliance?", "Formal compliance satisfies form, not purpose. Sham, fraud, abuse, beneficial-ownership and economic-substance doctrines can deny the intended consequence while leaving the document physically valid."],
    ["What residual spaces exist between ‘lawful under the home system’ and ‘effective in the receiving system’?", "Typical gaps include re-registration, licensing, authentication, service, tax nexus, local perfection and public-policy review."],
    ["How do systems allocate the burden of proving foreign law when formal validity is contested?", "The party relying on foreign law commonly pleads and proves it through authoritative texts and expert evidence; otherwise the forum may apply a presumption or its own law."],
    ["What happens when two systems both claim exclusive competence over the same person, asset, or relationship?", "The forum applies its jurisdiction and conflicts rules, while parallel proceedings are managed through stays, anti-suit relief, priority, comity and recognition—not constitutional rhetoric."],
    ["How is the concept of ‘public policy’ used to refuse recognition of an otherwise formally valid foreign act?", "Public policy is a narrow safety valve for results incompatible with fundamental forum principles. It is not a licence to reject foreign law merely because it differs."],
    ["What residual judicial discretion remains when statutes appear to create bright-line formal rules?", "Discretion survives only where the text supplies it—through extensions, relief from sanctions, validation, rectification or equitable remedies. Courts cannot invent an exception to a mandatory condition."],
    ["How do administrative practices diverge from the black-letter text of the rules governing addresses, names, or identifiers?", "Forms, guidance and registry systems can narrow practical access or add evidence requests, but they cannot lawfully enlarge statutory power. Divergence should be documented and challengeable."],
    ["What structural features of separate but neighbouring legal systems systematically generate residual gaps?", "Independent legislatures, separate registries, different commencement dates, treaty territorial clauses, distinct courts and uneven administrative capacity repeatedly generate gaps."],
  ]},
  { category: "Residual & structural questions II", items: [
    ["How is continuity of legal personality preserved (or broken) when an entity migrates between systems?", "Only compatible continuation statutes preserve the same person. Without them, dissolution and new incorporation break continuity even when ownership and name remain unchanged."],
    ["What formal acts are required to ‘domesticate’ a foreign legal position so that it produces local effects?", "Common acts include registration, recognition order, licence, apostille or legalisation, translation, local filing, re-perfection and appointment of a local representative."],
    ["How do systems treat simultaneous compliance with two incompatible formal regimes?", "Parties must identify which act each regime governs, use savings provisions where available and seek prospective directions. Purported compliance cannot rewrite genuinely incompatible mandatory rules."],
    ["What residual liability attaches to persons who rely on a formal position that is later held ineffective across borders?", "Contractual warranties, negligence, misrepresentation, penalties, restitution, director duties and loss of priority can remain even where reliance was initially in good faith."],
    ["How is the distinction between jurisdiction to adjudicate and jurisdiction to enforce maintained in cross-border settings?", "A court can have authority to decide without direct coercive power abroad. Enforcement requires assets, a receiving court and a recognised legal route."],
    ["What categories of document or act are given extraterritorial effect by statute, and which are not?", "The answer is instrument-specific: judgments, arbitral awards, status records, security interests and licences travel only to the extent an enactment or treaty says so."],
    ["How do systems resolve conflicts when the formal requirements of the place of execution and the place of performance diverge?", "Alternative-validity rules may uphold form valid at execution, but mandatory rules at the place of performance can still control local acts and remedies."],
    ["What residual role remains for party autonomy in choosing formalities when mandatory local rules intervene?", "Party choice governs within the permitted field. It cannot displace mandatory land, corporate, consumer, insolvency, registry or procedural form."],
    ["How is the concept of ‘centre of main interests’ or equivalent used to determine which system’s formal rules prevail?", "COMI allocates primary insolvency jurisdiction and recognition; it does not determine every corporate, property or tax formality. Objective and ascertainable administration facts matter."],
    ["Where, in any given pair of related legal systems, does the chain of formal validity stop and the requirement of local re-validation or fresh compliance begin?", "The chain stops at the first receiving-law requirement for which no treaty, statute, conflicts rule or administrative exception supplies equivalence. That requirement must then be satisfied locally."],
  ]},
];

export const contextQuestions: ContextItem[] = sections.flatMap((section) => section.items.map(([question, principle]) => ({ category: section.category, question, principle })));

const profileAliases: Record<string, string> = {
  "south-georgia-south-sandwich-islands": "South Georgia and the South Sandwich Islands",
  "akrotiri-dhekelia": "Sovereign Base Areas of Akrotiri and Dhekelia",
};

function getProfile(territory: TerritoryDossier) {
  const profileName = profileAliases[territory.slug] ?? territory.name;
  return jurisdictionProfiles.find((profile) => profile.name === profileName);
}

function localFrame(category: string, territory: TerritoryDossier) {
  const profile = getProfile(territory);
  if (category.startsWith("Service")) return `the operative source is the Territory’s own court procedure and any expressly applicable service instrument; ${territory.government}`;
  if (category.startsWith("Corporate")) return `${profile?.companyPosition ?? "local company and registry legislation controls"}; ${territory.economy}`;
  if (category.startsWith("Vehicle")) return `local vehicle, customs and road-traffic rules control, while temporary foreign use must be established rather than assumed`;
  if (category.startsWith("Personal")) return `domicile, immigration, residence and belonging remain separate tests under ${profile?.legalSystem ?? "the local legal system"}`;
  if (category.startsWith("Cross-border")) return `recognition depends on local legislation, common law and any convention expressly extended to the Territory; UK participation alone is not enough`;
  if (category.startsWith("Formal")) return `the local statute and the receiving system must be read separately; ${territory.researchNote}`;
  if (category.startsWith("Time")) return `local limitation, registry and court-calculation rules govern, including their own commencement and restoration provisions`;
  if (category.startsWith("Information")) return `${profile?.regulator ?? "the relevant local authority"} and local registry legislation determine what is collected, public, verified and shared`;
  return `${territory.constitutionalPosition} The precise bridge must therefore be identified in legislation rather than inferred from the British connection`;
}

export type ContextAnswer = {
  id: string;
  number: number;
  category: string;
  question: string;
  status: "Contextual baseline" | "Exceptional / limited application";
  answer: string;
  evidence: string[];
  authorities: { label: string; href: string }[];
  reviewedAt: string;
};

export function buildTerritoryContextAnswers(slug: string): ContextAnswer[] {
  const territory = getTerritory(slug);
  if (!territory) return [];
  const profile = getProfile(territory);
  const exceptional = Boolean(profile?.limitedPrivateMarket) || territory.population.startsWith("No permanent");
  const authorities = [...territory.sources, ...(profile?.sources ?? [])].filter((source, index, all) => all.findIndex((candidate) => candidate.href === source.href) === index);
  return contextQuestions.map((item, index) => ({
    id: `CTX-${String(index + 1).padStart(3, "0")}`,
    number: index + 1,
    category: item.category,
    question: item.question,
    status: exceptional ? "Exceptional / limited application" : "Contextual baseline",
    answer: `${item.principle} In ${territory.name}, ${localFrame(item.category, territory).replace(/[.\s]+$/, "")}. ${exceptional ? "Because the Territory has no ordinary large private market or permanent civilian population, applicability must first be established from a real territorial nexus." : "The current local text, commencement history and facts remain decisive."}`,
    evidence: [
      `Current ${territory.name} legislation and court or registry rules for ${item.category.toLowerCase()}`,
      `Any UK Act, Order in Council or treaty instrument expressly extending the relevant rule to ${territory.name}`,
      "The underlying register entry, service record, residence evidence, instrument or judgment relied upon",
    ],
    authorities,
    reviewedAt: contextReviewedAt,
  }));
}

export const contextTerritories = territoryDossiers.map((territory) => ({ ...territory, answerCount: 100, exceptional: Boolean(getProfile(territory)?.limitedPrivateMarket) || territory.population.startsWith("No permanent") }));
