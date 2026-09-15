import { bankruptcyQuestions as sourceQuestions } from "./data";

export type TerritoryInsolvencySource = { id: string; title: string; publisher: string; url: string };

export type TerritoryInsolvencyProfile = {
  slug: string;
  name: string;
  code: string;
  regime: "active" | "limited";
  framework: string;
  court: string;
  personal: string;
  corporate: string;
  arrangements: string;
  officeHolder: string;
  stay: string;
  discharge: string;
  estate: string;
  secured: string;
  priorities: string;
  clawback: string;
  records: string;
  crossBorder: string;
  caution: string;
  sources: TerritoryInsolvencySource[];
};

export type TerritoryInsolvencyAnswer = {
  id: number;
  category: string;
  question: string;
  answer: string;
  status: "Territory baseline" | "No ordinary local procedure";
  sources: TerritoryInsolvencySource[];
};

export const territoryInsolvencyReviewedAt = "2026-08-16";

export const territoryInsolvencyProfiles: TerritoryInsolvencyProfile[] = [
  {
    slug: "anguilla", name: "Anguilla", code: "AI", regime: "active",
    framework: "the Bankruptcy Act, R.S.A. c. B15, the Bankruptcy General Rules and the liquidation provisions of the Business Companies Act",
    court: "the High Court of the Eastern Caribbean Supreme Court in Anguilla",
    personal: "an individual may be proceeded against, or petition personally, under Anguilla's Bankruptcy Act; the Act uses receiving order, adjudication, official receiver and trustee terminology",
    corporate: "companies use voluntary or court-supervised liquidation under company legislation rather than a U.S.-style personal bankruptcy chapter",
    arrangements: "the older bankruptcy framework recognises compositions and schemes with creditors, but it is not a Chapter 13-style consumer plan",
    officeHolder: "the official receiver and any trustee appointed under the Act administer the bankrupt estate; a company liquidation is administered by its liquidator",
    stay: "a receiving order changes control of the estate and constrains individual enforcement, but the exact protection and any leave of court must be checked under the Act and Rules",
    discharge: "discharge is by the Court under the Bankruptcy Act and may be granted, suspended, conditioned or refused; it is not an automatic U.S.-style discharge",
    estate: "property vesting in the trustee is defined by the Bankruptcy Act, subject to statutory exclusions and any court directions",
    secured: "secured creditors generally retain security rights subject to the Act, valuation, proof and any court order",
    priorities: "estate expenses and preferential debts are paid before ordinary unsecured claims in the statutory order",
    clawback: "preferences, settlements and transactions affecting creditors may be challenged within the periods and conditions fixed by the local Act",
    records: "court files, the bankruptcy register and required Gazette or public notices are the starting points; availability and search procedure should be confirmed with the Registry",
    crossBorder: "cross-border recognition is not safely assumed from UK law; the Anguilla statute, ECSC procedure and any applicable cooperation rules must be checked",
    caution: "The published revised-law database is guidance and later amendments, fees and court practice must be checked with the Anguilla Registry or local counsel.",
    sources: [
      { id: "ai-bankruptcy", title: "Bankruptcy Act, R.S.A. c. B15", publisher: "Government of Anguilla", url: "https://gov.ai/Legislation/Acts/B015-Bankruptcy%20Act.pdf" },
      { id: "ai-laws", title: "2022 Revised Statutes and Regulations", publisher: "Government of Anguilla", url: "https://www.gov.ai/service/2022-revised-statutes-and-regulations" },
      { id: "ai-companies", title: "Business Companies Act", publisher: "Government of Anguilla", url: "https://gov.ai/Legislation/Acts/B072-Business%20Companies%20Act" },
    ],
  },
  {
    slug: "bermuda", name: "Bermuda", code: "BM", regime: "active",
    framework: "the Bankruptcy Act 1989 and Bankruptcy Rules 1990 for individuals, together with Parts XIII and XIV of the Companies Act 1981 and the Companies (Winding-Up) Rules 1982 for companies",
    court: "the Supreme Court of Bermuda",
    personal: "personal bankruptcy is available by petition under the Bankruptcy Act 1989 and is administered through the Supreme Court and Official Receiver",
    corporate: "companies may be wound up by the Court or voluntarily, and restructuring may use schemes of arrangement or provisional-liquidation tools where legally available",
    arrangements: "a composition, scheme or negotiated workout may be possible, but there is no direct equivalent of U.S. Chapter 13",
    officeHolder: "the Official Receiver administers personal bankruptcies and court liquidations when appointed; private liquidators and restructuring professionals may act in company cases",
    stay: "a bankruptcy or winding-up order has collective-proceeding effects, while any earlier or broader moratorium depends on the precise procedure and court order",
    discharge: "an individual applies for discharge under the Bankruptcy Act; the order may be unconditional, suspended or conditional and statutory exceptions remain",
    estate: "the bankrupt's divisible property vests in the trustee or Official Receiver, subject to the Act's protected property and court-controlled administration",
    secured: "security is ordinarily respected, subject to validity, perfection, valuation, set-off and avoidance rules",
    priorities: "costs and statutory preferential debts rank ahead of ordinary unsecured claims; the current statutory schedule controls",
    clawback: "preferences, settlements and transactions at an undervalue may be reviewed under the applicable personal or corporate regime",
    records: "Supreme Court files and Official Gazette bankruptcy and winding-up notices provide public evidence, subject to Registry access rules",
    crossBorder: "Bermuda courts may assist foreign insolvencies under local law and common-law principles, but recognition and relief are order-specific",
    caution: "Fees, forms, office-holder appointments and the current consolidated text should be verified with the Supreme Court Registry and Registrar of Companies.",
    sources: [
      { id: "bm-roc", title: "Registrar of Companies — Insolvency & Liquidations", publisher: "Government of Bermuda", url: "https://www.gov.bm/department/registrar-companies" },
      { id: "bm-gazette", title: "Official Gazette", publisher: "Government of Bermuda", url: "https://www.gov.bm/official-gazette" },
      { id: "bm-notices", title: "Notices of Bankruptcy Orders", publisher: "Government of Bermuda", url: "https://www.gov.bm/notice-type/notice-bankruptcy-order" },
    ],
  },
  {
    slug: "british-antarctic-territory", name: "British Antarctic Territory", code: "BAT", regime: "limited",
    framework: "the Territory's published Ordinances and the Administration of Justice Ordinance 2021, which applies the law of England only so far as local circumstances permit",
    court: "the British Antarctic Territory Supreme Court, if constituted for a justiciable territorial matter",
    personal: "there is no ordinary resident consumer bankruptcy market or separately published local bankruptcy code in the Territory's legislation list",
    corporate: "there is no routine locally incorporated commercial sector for which a standard territorial corporate insolvency pathway is published",
    arrangements: "no ordinary local consumer repayment-plan procedure is identified in the published BAT Ordinances",
    officeHolder: "any office-holder and jurisdiction would have to be established from the applicable English-law rule, territorial Ordinance and a specific court order",
    stay: "no routine territorial filing and automatic stay should be assumed",
    discharge: "no routine local discharge procedure should be assumed for personnel temporarily present at research stations",
    estate: "property and employment connections will usually point to another home jurisdiction; a BAT nexus requires specialist analysis",
    secured: "security and enforcement depend on the governing law of the asset and obligation, not merely physical presence in Antarctica",
    priorities: "no standalone BAT insolvency distribution schedule is identified in the published Ordinance list",
    clawback: "no ordinary local look-back rule should be quoted without first establishing an applicable insolvency law and BAT jurisdiction",
    records: "the BAT Gazette is the official record of territorial legislation, orders and appointments",
    crossBorder: "the law of a person's employer, home jurisdiction, incorporated entity and contract is likely to be more important than temporary presence in BAT",
    caution: "This is a no-ordinary-procedure finding, not a conclusion that debts or insolvency law disappear. A real matter requires conflict-of-laws advice.",
    sources: [
      { id: "bat-laws", title: "British Antarctic Territory legislation", publisher: "Government of the British Antarctic Territory", url: "https://www.britishantarcticterritory.org.uk/about/legislation/" },
      { id: "bat-gazette", title: "British Antarctic Territory Gazette", publisher: "Government of the British Antarctic Territory", url: "https://www.britishantarcticterritory.org.uk/about/gazette/" },
    ],
  },
  {
    slug: "british-indian-ocean-territory", name: "British Indian Ocean Territory", code: "BIOT", regime: "limited",
    framework: "the BIOT Constitution, Courts Ordinance 1983, Companies Ordinance 1981 and the Territory's published revised Ordinances and Gazettes",
    court: "the courts established under the BIOT Courts Ordinance",
    personal: "the Territory has no permanent civilian population and its published revised Ordinance list does not identify a routine resident personal-bankruptcy code",
    corporate: "the Companies Ordinance 1981 is the starting point for a locally connected company, but a current winding-up route must be verified from the text and any later Gazette",
    arrangements: "no ordinary consumer repayment arrangement is identified for the Territory",
    officeHolder: "any liquidator, receiver or court officer must derive authority from the applicable BIOT Ordinance and order",
    stay: "no automatic stay should be inferred merely from debt distress or presence on Diego Garcia",
    discharge: "no routine BIOT consumer discharge procedure is identified in the published revised laws",
    estate: "most individuals present have legal, employment and asset connections elsewhere, requiring a conflict-of-laws analysis",
    secured: "the governing law and situs of collateral will control alongside any BIOT rule that validly applies",
    priorities: "no general resident bankruptcy priority ladder is identified in the published revised Ordinances",
    clawback: "avoidance powers cannot be assumed without identifying a valid BIOT corporate or other insolvency proceeding",
    records: "the BIOT Gazette and revised-Ordinance library are the official starting points",
    crossBorder: "a real case will ordinarily turn on the debtor's home or incorporation jurisdiction and contracts as well as any BIOT connection",
    caution: "The territory is an exceptional administrative and defence context. Ordinary consumer-bankruptcy assumptions are especially unsafe.",
    sources: [
      { id: "biot-laws", title: "Revised Ordinances", publisher: "BIOT Administration", url: "https://www.biot.gov.io/governance/legislation/revised-ordinances/" },
      { id: "biot-gazettes", title: "Legal Gazettes", publisher: "BIOT Administration", url: "https://www.biot.gov.io/governance/legislation/gazettes/" },
    ],
  },
  {
    slug: "british-virgin-islands", name: "British Virgin Islands", code: "BVI", regime: "active",
    framework: "the Insolvency Act 2003 (Revised 2020), Insolvency Rules, Insolvency Code of Practice and subsequent amendments",
    court: "the High Court of the Eastern Caribbean Supreme Court, including the Commercial Division in BVI matters",
    personal: "the Insolvency Act provides bankruptcy for individuals and individual creditors' arrangements",
    corporate: "companies may use liquidation, administration, receivership and company creditors' arrangements, subject to statutory availability and commencement provisions",
    arrangements: "individual and company creditors' arrangements provide formal compromise routes; they are not U.S. Bankruptcy Code chapters",
    officeHolder: "a licensed BVI insolvency practitioner, trustee, supervisor, administrator, receiver or liquidator acts according to the procedure; the Official Receiver has statutory functions",
    stay: "the protection varies: bankruptcy, liquidation, administration and an arrangement each have different commencement and moratorium rules",
    discharge: "personal release depends on the BVI bankruptcy and discharge provisions; it is not safe to import U.S. nondischargeability rules",
    estate: "bankruptcy property vests and is administered under the Act, with local exclusions and treatment of after-acquired property",
    secured: "secured-creditor rights are generally preserved, subject to the security's validity, statutory stays, priority, set-off and avoidance",
    priorities: "insolvency expenses, preferential claims and unsecured claims follow the statutory order, with security and subordination analysed separately",
    clawback: "the Act contains voidable-transaction provisions including unfair preferences and undervalue transactions, with statutory conditions and periods",
    records: "court records, Registry filings, Gazette notices and FSC office-holder records are relevant, depending on procedure",
    crossBorder: "Part XIX assistance and common-law recognition may matter, but relief and reciprocity must be established in the particular case",
    caution: "Some provisions have commencement histories and recent amendments. Use the current consolidated Act, Rules and Code of Practice.",
    sources: [
      { id: "bvi-act", title: "Insolvency Act (Revised 2020)", publisher: "BVI Financial Services Commission", url: "https://www.bvifsc.vg/sites/default/files/insolvency_act.pdf" },
      { id: "bvi-library", title: "Insolvency legislation library", publisher: "BVI Financial Services Commission", url: "https://www.bvifsc.vg/library/legislation" },
      { id: "bvi-forms", title: "Statutory insolvency forms", publisher: "BVI Financial Services Commission", url: "https://www.bvifsc.vg/forms-0" },
    ],
  },
  {
    slug: "cayman-islands", name: "Cayman Islands", code: "KY", regime: "active",
    framework: "the Bankruptcy Act (2026 Revision), Grand Court Bankruptcy Rules, Companies Act (2026 Revision), Companies Winding Up Rules and Insolvency Practitioners Regulations",
    court: "the Grand Court of the Cayman Islands, with company matters commonly handled in the Financial Services Division",
    personal: "individual bankruptcy is governed by the Bankruptcy Act and Grand Court Bankruptcy Rules",
    corporate: "companies may be wound up and may pursue schemes or the restructuring-officer regime under the Companies Act",
    arrangements: "statutory composition and company restructuring mechanisms exist, but there is no U.S.-style Chapter 13 consumer plan",
    officeHolder: "the trustee or official trustee administers bankruptcy; qualified insolvency practitioners act as liquidators or restructuring officers under the corporate regime",
    stay: "the effect and timing of any stay depend on the bankruptcy, winding-up, provisional-liquidation or restructuring-officer process used",
    discharge: "individual discharge is governed by the Bankruptcy Act and Court; exceptions and conditions must be read from the Cayman statute",
    estate: "the Bankruptcy Act defines property available for creditors and any protected necessities or excluded property",
    secured: "valid security is generally respected, subject to stays, priority, valuation, set-off and avoidance law",
    priorities: "the applicable Bankruptcy or Companies Act priority provisions determine expenses, preferential debts and unsecured distributions",
    clawback: "preferences, dispositions and other avoidable transactions are governed by Cayman statutory tests and time periods",
    records: "Grand Court files, Gazette notices and company Registry material provide the public record, subject to access rules",
    crossBorder: "the Foreign Bankruptcy Proceedings (International Cooperation) Rules and common-law assistance may support recognition, but an order is required",
    caution: "Cayman legislation is revised frequently; use the current 2026 texts and confirm Court practice and fees.",
    sources: [
      { id: "ky-subject", title: "Bankruptcy and insolvency legislation by subject", publisher: "Cayman Islands Legislation", url: "https://legislation.gov.ky/cms/legislation/index/by-subject.html" },
      { id: "ky-current", title: "Current legislation and revision history", publisher: "Cayman Islands Legislation", url: "https://legislation.gov.ky/cms/legislation/current/by-tag.html" },
    ],
  },
  {
    slug: "falkland-islands", name: "Falkland Islands", code: "FK", regime: "active",
    framework: "locally applicable and modified older UK bankruptcy and insolvency enactments, including the Bankruptcy Act 1914 and elements of the Insolvency Acts 1976 and 1986, alongside local company legislation",
    court: "the Supreme Court of the Falkland Islands",
    personal: "personal bankruptcy exists under older legislation applied locally, but terminology, modifications and current procedural availability require close checking",
    corporate: "company winding-up and insolvency draw on locally applied UK-era company and insolvency legislation",
    arrangements: "compositions or arrangements may be available within the older framework, but there is no assumption of modern England-and-Wales procedures",
    officeHolder: "the official receiver, trustee or liquidator derives authority from the locally applicable enactment and Supreme Court order",
    stay: "collective-proceeding protection depends on the order made and the locally applicable older statute",
    discharge: "discharge must be sought under the locally applied bankruptcy regime and may be conditional or suspended",
    estate: "the applicable bankruptcy enactment determines vesting, protected property and after-acquired assets",
    secured: "security is addressed under local property, company and insolvency law; modern UK rules cannot simply be substituted",
    priorities: "the locally applied statute and modifications determine preferential and unsecured ranking",
    clawback: "older preference and settlement rules may apply; dates and statutory language must be checked against the Falkland law database",
    records: "the Supreme Court Registry and Falkland Islands Gazette are the principal public-record routes",
    crossBorder: "recognition and assistance require analysis of Falkland legislation and court powers rather than reliance on current UK statutes",
    caution: "The framework is historically layered. Confirm every cited provision in the current Falkland Islands Statute Law Database before acting.",
    sources: [
      { id: "fk-laws", title: "Falkland Islands Statute Law Database", publisher: "Falkland Islands Government", url: "https://legislation.gov.fk/" },
      { id: "fk-gazette", title: "Gazettes and legislative supplements", publisher: "Falkland Islands Government", url: "https://falklands.gov.fk/legalservices/statute-law-commissioner/gazettes-supplements" },
      { id: "fk-legal", title: "Law and Regulation Directorate", publisher: "Falkland Islands Government", url: "https://falklands.gov.fk/legalservices/" },
    ],
  },
  {
    slug: "gibraltar", name: "Gibraltar", code: "GI", regime: "active",
    framework: "the Insolvency Act 2011, in force from 2014, the Insolvency Rules 2014 and related regulations and amendments",
    court: "the Supreme Court of Gibraltar",
    personal: "Part 13 of the Insolvency Act provides personal bankruptcy and Part 12 provides arrangements for individuals",
    corporate: "the Act provides liquidation, administration, receivership and company arrangements",
    arrangements: "individual and company arrangements can compromise creditors when statutory approval, voting and court requirements are met",
    officeHolder: "licensed insolvency practitioners may act as trustee, supervisor, administrator, receiver or liquidator under Court and statutory control",
    stay: "moratoria and restrictions vary across administration, liquidation, bankruptcy and arrangements; the chosen procedure controls",
    discharge: "the Act governs discharge from bankruptcy and statutory exceptions; the Court and trustee process matters",
    estate: "bankruptcy estate property, exclusions and after-acquired property are defined by the 2011 Act",
    secured: "secured claims are generally treated outside the unsecured pool to the extent of valid security, subject to stays and statutory controls",
    priorities: "the Act and Rules prescribe office-holder expenses, preferential claims and unsecured ranking",
    clawback: "transactions at an undervalue, preferences and other antecedent transactions may be challenged on the statutory tests",
    records: "the insolvency register, Supreme Court files, Gazette notices and company Registry records may be relevant",
    crossBorder: "the cross-border insolvency regulations implement a recognition framework; formal relief still depends on application and order",
    caution: "Use the current Gibraltar Laws version, including 2025 and 2026 Rules and cross-border amendments.",
    sources: [
      { id: "gi-act", title: "Insolvency Act 2011", publisher: "Gibraltar Laws", url: "https://www.gibraltarlaws.gov.gi/legislations/insolvency-act-2011-3738/download" },
      { id: "gi-topic", title: "Current insolvency legislation", publisher: "Gibraltar Laws", url: "https://www.gibraltarlaws.gov.gi/index.php/legislations?topic=380" },
    ],
  },
  {
    slug: "montserrat", name: "Montserrat", code: "MS", regime: "active",
    framework: "the Bankruptcy Act, Cap. 03.03, its Rules and the locally applicable company and Eastern Caribbean Supreme Court framework",
    court: "the High Court of the Eastern Caribbean Supreme Court in Montserrat",
    personal: "the Bankruptcy Act provides petition-based personal bankruptcy, receiving orders, adjudication and discharge",
    corporate: "company insolvency ordinarily proceeds through winding-up and liquidation under local company legislation",
    arrangements: "the Bankruptcy Act includes compositions and older administration-order concepts, not a modern Chapter 13 equivalent",
    officeHolder: "the official receiver and trustee administer personal estates; a liquidator administers a company winding-up",
    stay: "the receiving or bankruptcy order changes the enforcement position, but the Act and any Court leave govern its reach",
    discharge: "the Court decides discharge and may impose statutory conditions or suspension",
    estate: "the Bankruptcy Act determines property passing to the trustee and any protected necessities",
    secured: "secured creditors generally rely on their collateral, subject to proof, valuation, statutory intervention and Court order",
    priorities: "costs and preferential debts precede ordinary unsecured distributions under the Act",
    clawback: "settlements, preferences and fraudulent or creditor-defeating transfers are tested under local statutory rules",
    records: "High Court files and Gazette notices are the core public record, subject to Registry procedure",
    crossBorder: "ECSC procedure and Montserrat legislation govern recognition or assistance; no current UK process should be assumed to apply directly",
    caution: "Montserrat's statute retains older language and monetary thresholds. Verify the 2025 revised law and current Court-fee rules.",
    sources: [
      { id: "ms-act", title: "Bankruptcy Act, Cap. 03.03", publisher: "Government of Montserrat", url: "https://www.gov.ms/wp-content/uploads/2020/06/Bankruptcy-Act.pdf" },
      { id: "ms-laws", title: "Acts — Revised 2025", publisher: "Government of Montserrat", url: "https://www.gov.ms/government/legal-department/attorney-generals-chambers/acts-revised-2025/" },
      { id: "ms-court", title: "Eastern Caribbean Supreme Court information", publisher: "Government of Montserrat", url: "https://www.gov.ms/2018/04/18/eastern-caribbean-supreme-court/" },
    ],
  },
  {
    slug: "pitcairn-islands", name: "Pitcairn Islands", code: "PN", regime: "limited",
    framework: "Pitcairn Ordinances plus English common law, equity and statutes of general application only so far as local circumstances and jurisdiction permit under section 42 of the Constitution",
    court: "the Supreme Court of Pitcairn",
    personal: "no dedicated bankruptcy Ordinance or routine consumer-bankruptcy system is identified in the published Pitcairn law index",
    corporate: "Pitcairn has a registration-of-business-names framework but no ordinary locally incorporated corporate insolvency market identified in the published index",
    arrangements: "no routine statutory consumer repayment plan is identified",
    officeHolder: "an office-holder could act only if a valid applicable law and Court order established the office and powers",
    stay: "no automatic local insolvency stay should be assumed",
    discharge: "no routine Pitcairn discharge route is identified; a debtor's external jurisdiction may be decisive",
    estate: "land is governed by distinctive Pitcairn land law, while other assets and debts may have governing-law connections elsewhere",
    secured: "collateral rights require analysis of the asset, contract, local land rules and any external jurisdiction",
    priorities: "no ordinary local bankruptcy distribution schedule is identified in the published Ordinance list",
    clawback: "no local look-back period should be quoted without identifying a law validly applied by the Pitcairn Court",
    records: "the official laws page and published decisions of the Pitcairn courts are the starting points",
    crossBorder: "New Zealand-based judicial administration does not make New Zealand insolvency law automatically applicable; governing law and jurisdiction must be established",
    caution: "Pitcairn's reception clause is limited by local circumstances. It is not a blanket incorporation of every current English insolvency rule.",
    sources: [
      { id: "pn-laws", title: "Laws of Pitcairn", publisher: "Government of the Pitcairn Islands", url: "https://www.government.pn/laws" },
      { id: "pn-cases", title: "Decisions of the Courts of Pitcairn Island", publisher: "Government of the Pitcairn Islands", url: "https://www.government.pn/decisions-of-the-courts" },
    ],
  },
  {
    slug: "saint-helena-ascension-tristan-da-cunha", name: "Saint Helena, Ascension and Tristan da Cunha", code: "SH", regime: "active",
    framework: "the separate bodies of law for St Helena, Ascension and Tristan da Cunha, including applicable bankruptcy law and the St Helena Companies Ordinance's insolvency and winding-up provisions",
    court: "the Supreme Court of St Helena or the competent court for Ascension or Tristan da Cunha, depending on the island and applicable law",
    personal: "bankruptcy is recognised in St Helena law, but the applicable enactment and its extension or modification must be checked separately for each of the three islands",
    corporate: "the St Helena Companies Ordinance provides dissolution, supervised liquidation and Court liquidation; application to entities connected with Ascension or Tristan must be verified",
    arrangements: "compositions or Court-controlled arrangements may exist under applicable law, but there is no safe single territory-wide analogue to Chapter 13",
    officeHolder: "a trustee, liquidator, curator or other officer acts under the applicable island law and Court order",
    stay: "the protection from enforcement depends on the island, procedure and order; there is no single territory-wide automatic-stay answer",
    discharge: "personal discharge must be established under the bankruptcy law applying on the relevant island",
    estate: "bankruptcy can transmit registered land to a trustee on St Helena, while the wider estate and exclusions depend on the applicable island law",
    secured: "security, registered land and enforcement must be analysed under the law of the relevant island and asset",
    priorities: "the applicable bankruptcy or company statute determines expenses, preferential claims and unsecured ranking",
    clawback: "any preference or transfer challenge depends on the enactment applying on the relevant island",
    records: "the relevant Government Gazette, Supreme Court record and company or land register provide the evidence trail",
    crossBorder: "the three-island constitutional structure and external connections require the exact island and debtor nexus to be identified first",
    caution: "Treating St Helena, Ascension and Tristan da Cunha as one insolvency jurisdiction can produce the wrong answer. Verify island-specific application for every case.",
    sources: [
      { id: "sh-intro", title: "General introduction to legislation", publisher: "St Helena Government", url: "https://www.sainthelena.gov.sh/st-helena/government/legislation/general-introduction/" },
      { id: "sh-companies", title: "Companies Ordinance — insolvency and winding up", publisher: "St Helena Government", url: "https://www.sainthelena.gov.sh/wp-content/uploads/2020/07/Companies-Ordinance-Updated-100720.pdf" },
      { id: "sh-gazette", title: "St Helena Government Gazette", publisher: "St Helena Government", url: "https://www.sainthelena.gov.sh/gazette/" },
    ],
  },
  {
    slug: "south-georgia-south-sandwich-islands", name: "South Georgia & South Sandwich Islands", code: "GS", regime: "limited",
    framework: "SGSSI Ordinances, application-of-enactments legislation and the official Gazette, including historically applied UK bankruptcy enactments where still operative",
    court: "the Supreme Court of South Georgia and the South Sandwich Islands",
    personal: "there is no permanent civilian population and no ordinary resident consumer-bankruptcy service",
    corporate: "a company or operator with a territorial nexus requires analysis of the applicable enactments, licence, contract and place of incorporation",
    arrangements: "no routine local consumer repayment-plan procedure is identified",
    officeHolder: "any trustee or liquidator must derive authority from an applicable enactment and Court order",
    stay: "no automatic stay should be assumed without an identified proceeding and governing law",
    discharge: "no ordinary local consumer discharge route is identified",
    estate: "assets are likely to be vessels, licences, contracts or property with multiple governing-law connections",
    secured: "the law governing the asset and security, maritime rules and any territorial enactment must be analysed together",
    priorities: "no modern general consumer priority schedule should be asserted without checking the applied enactments",
    clawback: "historical application of bankruptcy enactments makes current text and modification analysis essential before stating a look-back period",
    records: "the SGSSI Gazette is the publication of record; the laws website is a research aid with an express beta warning",
    crossBorder: "most real insolvencies will be centred in the operator's or owner's incorporation jurisdiction, with SGSSI law addressing the territorial asset or licence",
    caution: "The public laws site warns that the Gazette remains authoritative. Historic applied enactments must be traced before reliance.",
    sources: [
      { id: "gs-laws", title: "South Georgia and South Sandwich Islands Laws", publisher: "Government of SGSSI", url: "https://laws.gov.gs/" },
      { id: "gs-application", title: "Application of Enactments Ordinances", publisher: "Government of SGSSI", url: "https://laws.gov.gs/application-of-enactments-ordinances/" },
    ],
  },
  {
    slug: "akrotiri-dhekelia", name: "Akrotiri and Dhekelia", code: "SBA", regime: "active",
    framework: "the Sovereign Base Areas Bankruptcy Law, Cap. 5, related Rules and the locally applicable company and enforcement laws",
    court: "the Sovereign Base Areas Court with bankruptcy jurisdiction",
    personal: "the Bankruptcy Law provides acts of bankruptcy, receiving orders, adjudication, proof, trustee administration and discharge",
    corporate: "corporate winding-up depends on the company law applying in the Areas and the entity's place of incorporation",
    arrangements: "compositions and schemes may be available under the older bankruptcy framework; there is no U.S.-style consumer chapter",
    officeHolder: "the official receiver and trustee administer bankruptcy under the Court's supervision; a liquidator acts in a company winding-up",
    stay: "a receiving order and bankruptcy proceeding affect execution and creditor action according to the local Law and Court directions",
    discharge: "the SBA Court determines discharge under Cap. 5 and may impose statutory conditions",
    estate: "property divisible among creditors is defined by Cap. 5, with local exclusions and special land or public-property constraints",
    secured: "secured rights generally remain subject to their validity, valuation, proof, Court control and the local insolvency law",
    priorities: "the Bankruptcy Law fixes estate expenses and preferential debts before ordinary unsecured claims",
    clawback: "preferences, settlements and creditor-defeating dealings may be set aside under the statutory conditions",
    records: "Court records and the SBA Gazette or legislation database provide the formal trail",
    crossBorder: "SBA law is often aligned with Cyprus, but Republic of Cyprus law does not apply automatically; the exact SBA enactment controls",
    caution: "The Areas have a distinctive military-administration jurisdiction. Confirm the current consolidated Law, Court forms and interaction with Cyprus.",
    sources: [
      { id: "sba-law", title: "Bankruptcy Law, Cap. 5", publisher: "Sovereign Base Areas Administration", url: "https://www.sbaadministration.org/home/legislation/01_02_09_04_INCON/B/20120101_AGLA_BankruptcyLaw_CAP.5.pdf" },
      { id: "sba-court", title: "Sovereign Base Areas Court", publisher: "Sovereign Base Areas Administration", url: "https://sbaadministration.org/index.php/court" },
    ],
  },
  {
    slug: "turks-caicos-islands", name: "Turks and Caicos Islands", code: "TCI", regime: "active",
    framework: "the Insolvency Ordinance 2017, Insolvency Rules, Companies Ordinance 2017 and later amendments including the Insolvency (Amendment) Ordinance 2021",
    court: "the Supreme Court of the Turks and Caicos Islands",
    personal: "the Insolvency Ordinance provides bankruptcy for individuals and assigns statutory functions to trustees and the Official Assignee",
    corporate: "companies may use liquidation, administration and receivership, subject to the Ordinance and commencement of particular provisions",
    arrangements: "formal arrangements and negotiated restructurings may be available, but no U.S.-chapter label should be used",
    officeHolder: "a licensed insolvency practitioner or the Official Assignee may act as trustee or liquidator; administrators and receivers exercise procedure-specific powers",
    stay: "the moratorium or restriction depends on bankruptcy, administration, liquidation or another formal procedure and the point at which it begins",
    discharge: "the Ordinance governs an individual's release and exceptions; current commencement and transitional rules must be checked",
    estate: "the statutory estate includes property captured by the Ordinance subject to exclusions and treatment of later-acquired assets",
    secured: "valid security is generally preserved but may be affected by a moratorium, priority, avoidance, valuation and Court orders",
    priorities: "expenses, preferential debts and ordinary unsecured claims rank under the statutory waterfall",
    clawback: "the Ordinance provides avoidance powers for preferences, undervalue and other impeachable transactions on defined tests and periods",
    records: "Supreme Court, Companies Registry, FSC and Gazette records may each matter depending on the procedure",
    crossBorder: "cross-border assistance depends on the Ordinance, any designated framework and the relief ordered by the TCI Court",
    caution: "Confirm that the relevant 2017 provision is in force and read it with the 2021 amendment, Rules and current professional regulations.",
    sources: [
      { id: "tci-2017", title: "Insolvency Ordinance 2017", publisher: "Turks and Caicos Islands Attorney General's Chambers", url: "https://publishing.gov.tc/agc/2017-ordinances" },
      { id: "tci-2021", title: "Insolvency (Amendment) Ordinance 2021", publisher: "Turks and Caicos Islands Attorney General's Chambers", url: "https://publishing.gov.tc/agc/2021-ordinances" },
    ],
  },
];

const neutralQuestionText = `What is bankruptcy (or its local equivalent)?
What are the main types or categories of insolvency proceedings available?
What is the equivalent of a liquidation-style personal bankruptcy procedure?
What is the equivalent of a business reorganization or restructuring procedure?
What is the equivalent of a structured repayment-plan procedure for individuals?
Is there a specialized insolvency procedure for agricultural or family businesses?
What is the difference between liquidation and reorganization proceedings?
What does the automatic stay (or equivalent protection from creditor actions) mean?
What is a discharge of debts (or local equivalent relief from liability)?
Which types of debts can typically be discharged or released?
Which types of debts are usually excluded from discharge?
Is there a financial eligibility or means test (or local equivalent) for liquidation proceedings?
Who is eligible to commence insolvency proceedings?
Can a legal entity (company) commence insolvency proceedings?
Can an individual commence insolvency proceedings more than once, and under what conditions?
What documents and information are required to commence proceedings?
What are the typical filing fees or court costs?
Is legal representation required or strongly recommended?
Is pre-filing credit counselling or debt-advice mandatory?
Is a post-filing debtor-education or financial-management course required?
How long does a typical liquidation-style procedure take?
How long does a typical repayment-plan procedure last?
What is the formal petition or application that starts the process?
What is the role of the insolvency practitioner, trustee, or equivalent official?
What happens at the first meeting of creditors (or local equivalent hearing)?
Can creditors object to the granting of a discharge or relief?
What constitutes preferential treatment of certain creditors?
What is a voidable or fraudulent transfer (or local equivalent)?
Can a debtor retain a primary residence under local exemption rules?
Can a debtor retain a vehicle under local exemption rules?
What property is protected by exemptions (or local equivalent shields)?
Are there national/federal-style exemptions as well as regional/local ones?
Is there a homestead or primary-residence exemption (or equivalent)?
Are retirement or pension accounts generally protected?
How is jointly owned property treated?
What is reaffirmation (or local equivalent agreement to remain liable) of a debt?
Is there a redemption option allowing a debtor to keep property by paying its value?
Can the insolvency official sell non-exempt assets?
How are tax refunds or similar recoveries treated during the proceedings?
Are inheritances or litigation recoveries considered part of the estate?
How are secured debts treated?
How are unsecured debts treated?
How are priority or preferential debts ranked?
Are student or education-related loans generally dischargeable?
Can tax liabilities be discharged or compromised?
How are maintenance, alimony, or child-support obligations treated?
Can medical or healthcare debts be included?
How is consumer credit-card or revolving debt treated?
How are co-signers or guarantors affected?
What is a proof of claim (or local equivalent creditor filing)?
How does a court-supervised repayment plan work?
How is the required plan payment calculated?
Can a confirmed plan later be modified?
What happens if plan payments are missed?
Can a case be converted from a repayment plan to a liquidation procedure?
Is a hardship or early discharge available under certain conditions?
How does the procedure help cure arrears on a primary residence?
Can junior liens on a residence be stripped or modified?
Is there a disposable-income or surplus-income test?
What is the minimum or maximum duration of a repayment plan?
Which entities typically use formal reorganization proceedings?
What is the concept of a debtor remaining in possession or control?
What is a plan of reorganization (or local equivalent restructuring plan)?
What is the absolute-priority or ranking rule among creditors?
Is there a simplified reorganization track for smaller businesses?
How are executory contracts and unexpired leases treated?
Can the business continue trading during the proceedings?
Is there a court-supervised sale process for assets (or local equivalent)?
How do creditors vote on or approve a reorganization plan?
What is required for formal confirmation or sanction of a plan?
How does an insolvency filing affect credit records or ratings?
How long does the record of insolvency remain visible?
Is it possible to obtain new credit after the proceedings?
Does the filing stop or delay enforcement against a residence?
Does the filing stop wage or income garnishment?
Does the filing stop repossession of vehicles or other goods?
How are residential tenancies or leases affected?
How are co-debtors, spouses, or household members affected?
Are there restrictions on travel or other personal freedoms?
Must an employer be notified of the proceedings?
What happens if a significant inheritance or windfall is received after filing?
How are gambling or speculative debts treated?
What are the consequences of concealing assets?
What penalties exist for insolvency-related fraud or misconduct?
Can individuals with education-loan debt still access the procedures?
How do the rules apply to married or civil-partnered couples?
What happens if only one partner files?
Can non-residents or foreign nationals access the local procedures?
How do ongoing lawsuits interact with the insolvency stay?
What happens to pending claims or litigation when proceedings begin?
What formal or informal alternatives exist to full insolvency proceedings?
How does negotiated debt settlement compare with formal insolvency?
When is a liquidation-style procedure generally preferable?
When is a repayment-plan or reorganization procedure generally preferable?
Can direct negotiation with creditors achieve a better outcome?
What is a formal debt-management or voluntary arrangement (or local equivalent)?
Is it advisable to pay particular creditors immediately before filing?
What is the relevant look-back or claw-back period for pre-filing transfers?
How should a debtor decide which available procedure is most suitable?
What key questions should be asked of an insolvency professional before engaging them?`.split("\n");

function activeAnswer(profile: TerritoryInsolvencyProfile, id: number): string {
  if (id === 1) return `In ${profile.name}, the legal starting point is ${profile.framework}. ${profile.personal}.`;
  if (id === 2) return `The main local routes separate people from entities. For individuals, ${profile.personal}. For entities, ${profile.corporate}. ${profile.arrangements}.`;
  if (id === 3) return `${profile.personal}. That is the closest local equivalent of liquidation-style personal bankruptcy.`;
  if (id === 4) return `${profile.corporate}. The local statute and Court—not U.S. chapter labels—determine whether rescue, administration, arrangement or liquidation is available.`;
  if (id === 5 || id === 51) return `${profile.arrangements}. Any payment plan binds creditors only through the approval, supervision and default rules of that local procedure.`;
  if (id === 6) return `No separate agricultural or family-business chapter should be assumed in ${profile.name}. Eligibility must be tested under the ordinary personal or corporate routes in ${profile.framework}.`;
  if (id === 7) return `Liquidation realises available assets and distributes proceeds; reorganisation tries to preserve value and alter obligations through an arrangement or rescue process. In ${profile.name}, ${profile.corporate}.`;
  if (id === 8 || [74,75,76,89].includes(id)) return `${profile.stay}. Secured enforcement, family obligations, criminal matters and proceedings started before the order may be treated differently.`;
  if ([9,10,11,15,26,44,45,46,47,48,56,82,85].includes(id)) return `${profile.discharge}. The treatment of this particular debt must be checked against the local exceptions, proof rules, any security and the terms of the Court's order.`;
  if (id === 12 || id === 59) return `Do not import the U.S. means test. Eligibility and any income or contribution assessment arise only from ${profile.framework}, the debtor's evidence and directions of ${profile.court}.`;
  if ([13,14,23,88].includes(id)) return `Standing, territorial connection and the initiating document are governed by ${profile.framework}. Proceedings are brought in ${profile.court}; residence, business, assets, debt thresholds and entity type must be verified before filing.`;
  if (id === 16) return `Expect a petition or originating application, verified financial statement, creditor and asset schedules, contracts, recent transactions and supporting records. ${profile.officeHolder} may require further disclosure under ${profile.framework}.`;
  if (id === 17) return `There is no safe fixed figure to quote across time. Obtain the current fee schedule from ${profile.court} and budget separately for notices, service, deposits and the fees of the office-holder.`;
  if (id === 18) return `Representation rules depend on the applicant and proceeding, but specialist local advice is strongly recommended. Companies will ordinarily need counsel, and an individual filing without advice remains bound by the same disclosure and procedural duties.`;
  if (id === 19 || id === 20) return `No U.S.-style counselling or debtor-education requirement should be assumed. Check ${profile.framework} for any local advice certificate, meeting, examination or condition of discharge.`;
  if (id === 21 || id === 22 || id === 60) return `The local law does not promise a universal duration. Timing depends on asset realisations, claims, litigation, cooperation and any arrangement terms; obtain a case-specific timetable from ${profile.officeHolder}.`;
  if (id === 24) return `${profile.officeHolder}. The office-holder must collect information, preserve value, report, adjudicate claims where authorised and distribute or supervise according to the statute and Court orders.`;
  if (id === 25) return `The first creditor meeting, examination or hearing is procedure-specific. It commonly verifies the debtor's affairs, receives the office-holder's report and permits creditor decisions, but ${profile.framework} and the notice convening it control.`;
  if (id === 27 || id === 97 || id === 98) return `${profile.clawback}. Paying a connected or favoured creditor shortly before filing can therefore worsen the recipient's and debtor's position; the exact look-back period depends on the statutory ground.`;
  if (id === 28 || id === 83 || id === 84) return `${profile.clawback}. Concealment, false statements and creditor-defeating transactions can lead to recovery orders, refusal of discharge, costs, disqualification and criminal consequences under local law.`;
  if ([29,30,31,33,34,35,38,39,40,81].includes(id)) return `${profile.estate}. There is no safe assumption that a home, vehicle, pension, refund, inheritance, joint interest or litigation recovery is exempt; ownership, timing, value and the precise local protection must be documented.`;
  if (id === 32) return `There is no federal-versus-state exemption election. ${profile.name} has its own law; ${profile.estate}.`;
  if (id === 36) return `Do not assume a U.S.-style reaffirmation agreement exists. Continued liability or retention of collateral must be structured under ${profile.framework}, the security documents and any required office-holder or Court approval.`;
  if (id === 37) return `No general U.S.-style redemption right should be assumed. A debtor may keep collateral only through a local statutory right, consensual payoff or restructuring, or a Court-approved arrangement.`;
  if (id === 41 || id === 58) return `${profile.secured}. Lien stripping or modification is available only if the local statute clearly authorises it and the required valuation and Court process are satisfied.`;
  if (id === 42) return `Unsecured creditors prove for the admitted amount and share in the estate after costs, secured claims against collateral and preferential debts. ${profile.priorities}.`;
  if (id === 43 || id === 64) return `${profile.priorities}. Contractual subordination, proprietary claims and valid security must be analysed separately from the unsecured statutory waterfall.`;
  if (id === 49 || id === 78 || id === 87) return `A filing ordinarily protects or releases only the debtor and estate before ${profile.court}; it does not automatically discharge a guarantor, co-borrower or non-filing partner. Joint property and shared contracts still require separate analysis.`;
  if (id === 50) return `A proof of debt or claim is the creditor's prescribed filing stating the debt, basis, security and evidence. ${profile.officeHolder} adjudicates it subject to ${profile.framework} and review by the Court.`;
  if ([52,53,54,55,57].includes(id)) return `${profile.arrangements}. Payment calculation, modification, default, conversion and treatment of arrears come from the proposal, voting result, statute and Court or supervisor approval—not a universal formula.`;
  if ([61,62,63,65,66,67,68,69,70].includes(id)) return `${profile.corporate}. Control, trading, contracts, asset sales, voting and sanction depend on the selected local procedure, the office-holder's powers and orders of ${profile.court}.`;
  if (id === 71 || id === 72 || id === 73) return `${profile.records}. Credit decisions remain private decisions by lenders, and no fixed credit-recovery period is guaranteed by insolvency law.`;
  if (id === 77) return `A tenancy is an executory contract and may also involve protected housing law. Filing does not erase post-order rent; termination, arrears and occupation depend on the lease, ${profile.framework} and any stay or Court order.`;
  if (id === 79) return `Bankruptcy does not ordinarily create a general travel ban, but the debtor must cooperate, attend examinations when required and obey Court orders. Passport or departure restrictions should never be inferred without specific local authority.`;
  if (id === 80) return `There is no universal duty to notify every employer. Disclosure may arise from payroll enforcement, a regulated role, contract, security clearance or a statutory restriction; check the role and local employment law.`;
  if (id === 86) return `Marriage does not merge every debt or estate automatically. Liability, beneficial ownership, jointly held property and the effect of one or two filings must be determined under ${profile.name}'s family, property and insolvency law.`;
  if (id === 90) return `Claims owned by the debtor may become estate assets controlled by the office-holder, while actions against the debtor may be stayed. ${profile.stay}.`;
  if (id === 91 || id === 92 || id === 95 || id === 96) return `Alternatives include direct workouts, refinancing, asset sales and ${profile.arrangements.toLowerCase()}. Informal settlement binds only participating creditors and normally lacks the collective protection of a formal Court process.`;
  if (id === 93) return `Liquidation is generally considered when rescue is not viable and transparent realisation would produce the best lawful outcome. In ${profile.name}, first test the consequences under ${profile.framework}, including home, livelihood, guarantees and discharge.`;
  if (id === 94) return `A plan or reorganisation is considered when future income or a viable business can support a better return than immediate liquidation. ${profile.arrangements}.`;
  if (id === 99) return `Compare eligibility, assets at risk, secured enforcement, likely dividend, total cost, duration, publicity, management control and discharge under ${profile.framework}. Obtain a written options analysis before choosing.`;
  if (id === 100) return `Ask which local procedure applies and why; who will act; what assets and licences are at risk; total fees and deposits; timetable; stay and discharge effects; creditor voting; avoidance exposure; public records; cross-border issues; and realistic alternatives. ${profile.caution}`;
  return `The answer in ${profile.name} is governed by ${profile.framework} and the orders of ${profile.court}. ${profile.caution}`;
}

function limitedAnswer(profile: TerritoryInsolvencyProfile, id: number, category: string): string {
  const focus = category === "Business / Reorganization Specific" ? profile.corporate : category === "Assets, Exemptions & Property" ? profile.estate : category === "Debts & Creditors" ? profile.secured : profile.personal;
  return `${profile.name} has no ordinary resident consumer-bankruptcy procedure identified for this question. ${focus}. Any real matter must first establish the debtor's home or incorporation jurisdiction, governing law, asset location and whether ${profile.court} has jurisdiction. ${profile.caution}`;
}

export function getTerritoryInsolvencyProfile(slug: string) {
  return territoryInsolvencyProfiles.find((profile) => profile.slug === slug);
}

export function buildTerritoryInsolvencyAnswers(slug: string): TerritoryInsolvencyAnswer[] {
  const profile = getTerritoryInsolvencyProfile(slug) ?? territoryInsolvencyProfiles[0];
  return sourceQuestions.map((source, index) => ({
    id: source.id,
    category: source.category,
    question: neutralQuestionText[index] ?? source.question,
    answer: profile.regime === "active" ? activeAnswer(profile, source.id) : limitedAnswer(profile, source.id, source.category),
    status: profile.regime === "active" ? "Territory baseline" : "No ordinary local procedure",
    sources: profile.sources,
  }));
}

export const territoryInsolvencyCategories = [...new Set(sourceQuestions.map((item) => item.category))];
