export type TerritoryDossier = {
  slug: string;
  name: string;
  officialName: string;
  code: string;
  region: string;
  administrativeCentre: string;
  population: string;
  populationDate: string;
  area: string;
  currency: string;
  timeZone: string;
  coordinates: [number, number];
  image?: string;
  imageAlt?: string;
  summary: string;
  constitutionalPosition: string;
  government: string;
  economy: string;
  environment: string;
  identity: string;
  researchNote: string;
  sources: { label: string; href: string }[];
};

const ukFramework = { label: "UK guide to the 14 Overseas Territories", href: "https://www.gov.uk/government/publications/guide-to-making-legislation/guide-to-making-legislation-html--2#overseas-territories" };

export const territoryDossiers: TerritoryDossier[] = [
  {
    slug: "anguilla", name: "Anguilla", officialName: "Anguilla", code: "AI", region: "Caribbean", administrativeCentre: "The Valley", population: "≈ 15,800", populationDate: "Recent estimate; check Statistics Anguilla for revisions", area: "91 km²", currency: "East Caribbean dollar (XCD)", timeZone: "Atlantic Standard Time (UTC−4)", coordinates: [18.2208, -63.0686],
    summary: "A low-lying Caribbean island territory known for coral beaches, a small population and close economic links across the eastern Caribbean.",
    constitutionalPosition: "Anguilla is a British Overseas Territory with a written constitution. Internal government is substantially local, while the Governor retains defined responsibilities and the UK remains responsible for defence, external affairs and overall good governance.",
    government: "An elected House of Assembly and locally formed government operate alongside a Governor appointed by the Crown. The Eastern Caribbean Supreme Court supplies the superior-court structure.",
    economy: "Tourism is the leading sector, supported by construction, financial services and links with neighbouring islands. Exposure to hurricanes makes resilient infrastructure and disaster finance especially important.",
    environment: "Dry scrub, salt ponds, reefs and small offshore cays support migratory birds and marine life. Water scarcity, coastal erosion and tropical cyclones are defining risks.",
    identity: "Anguillan identity was decisively shaped by the 1967 revolution and separation from the associated state of Saint Kitts–Nevis–Anguilla.",
    researchNote: "Do not treat Anguilla as part of the United Kingdom or as interchangeable with another Eastern Caribbean jurisdiction; local legislation and constitutional competences control.",
    sources: [{ label: "Government of Anguilla", href: "https://gov.ai/" }, { label: "Anguilla legislation", href: "https://laws.gov.ai/" }, ukFramework],
  },
  {
    slug: "bermuda", name: "Bermuda", officialName: "Bermuda", code: "BM", region: "North Atlantic", administrativeCentre: "Hamilton", population: "63,356", populationDate: "2023 estimate", area: "54 km²", currency: "Bermudian dollar (BMD)", timeZone: "Atlantic Time", coordinates: [32.2949, -64.7814], image: "/places/bermuda.jpg", imageAlt: "Pastel houses and white roofs on Bermuda's turquoise coast",
    summary: "A compact North Atlantic archipelago whose pastel architecture and global insurance market give it a cultural and economic reach far beyond its size.",
    constitutionalPosition: "Bermuda is Britain’s oldest continuously self-governing Overseas Territory. Its 1968 Constitution provides extensive internal self-government; the Governor and the United Kingdom retain defined responsibilities.",
    government: "Bermuda has a bicameral Parliament and a Cabinet led by the Premier. The Governor represents the Crown and retains constitutional functions including specified external and security responsibilities.",
    economy: "Insurance, reinsurance and other international business dominate measured output, alongside tourism and local services. The Bermudian dollar is pegged at parity with the US dollar.",
    environment: "A limestone island chain surrounded by reefs, Bermuda depends heavily on rainwater captured by its distinctive stepped roofs. Hurricane exposure and sea-level change shape planning.",
    identity: "Bermudian culture brings together African, European, Caribbean and Atlantic influences, with Gombey performance among its most recognisable traditions.",
    researchNote: "Bermuda has its own legislature, tax system, courts and regulator. UK legislation is not assumed to apply without extension or local implementation.",
    sources: [{ label: "Government of Bermuda", href: "https://www.gov.bm/" }, { label: "Bermuda Laws Online", href: "https://www.bermudalaws.bm/" }, { label: "Bermuda statistics", href: "https://www.gov.bm/digest-statistics" }, ukFramework],
  },
  {
    slug: "british-antarctic-territory", name: "British Antarctic Territory", officialName: "The British Antarctic Territory", code: "BAT", region: "Antarctica", administrativeCentre: "Administered from London", population: "No permanent population", populationDate: "Seasonal scientific and support personnel", area: "≈ 1.71 million km²", currency: "No circulating territorial currency", timeZone: "Research stations use operational time zones", coordinates: [-75, -50],
    summary: "Britain’s Antarctic claim encompasses the Antarctic Peninsula and surrounding islands, operating within the cooperative legal architecture of the Antarctic Treaty System.",
    constitutionalPosition: "The Territory is administered by a Commissioner. The UK’s claim is maintained while the Antarctic Treaty preserves the positions of claimant and non-claimant states and prohibits new or enlarged sovereignty claims while it is in force.",
    government: "There is no elected resident government. Administration, legislation, environmental permitting and postal functions are conducted from the United Kingdom.",
    economy: "There is no ordinary private resident economy. Scientific activity, logistics, heritage management and carefully regulated tourism are the principal human activities.",
    environment: "Ice sheets, glaciers, ocean systems and immense seabird and marine-mammal populations make the territory globally important to climate science and conservation.",
    identity: "The territory’s public identity is scientific rather than settler-based, centred on research stations, historic exploration sites and international cooperation.",
    researchNote: "Commercial, immigration, tax and company-law questions often have no ordinary local application. Antarctic Treaty obligations and permit rules must be checked first.",
    sources: [{ label: "British Antarctic Territory", href: "https://www.britishantarcticterritory.org.uk/" }, { label: "UK Antarctic legislation", href: "https://www.legislation.gov.uk/ukpga/1994/15/contents" }, ukFramework],
  },
  {
    slug: "british-indian-ocean-territory", name: "British Indian Ocean Territory", officialName: "The British Indian Ocean Territory", code: "IO", region: "Indian Ocean", administrativeCentre: "Administered from London", population: "No permanent civilian population", populationDate: "Military and support presence varies", area: "≈ 60 km² of land", currency: "US dollar in practical use", timeZone: "UTC+6", coordinates: [-7.3195, 72.4229],
    summary: "The Chagos Archipelago is strategically significant and politically contested, with sovereignty, defence arrangements and the displacement of Chagossians central to its modern history.",
    constitutionalPosition: "BIOT is administered by a Commissioner. Its future status has been the subject of UK–Mauritius negotiations, international proceedings and continuing debate; current legal status must therefore be checked against the latest official instruments.",
    government: "There is no elected resident civilian government. Administration is conducted from London, while Diego Garcia hosts a joint UK–US defence facility.",
    economy: "There is no conventional resident private economy. Defence logistics and environmental administration account for most organised activity.",
    environment: "The archipelago contains extensive coral reefs and marine ecosystems. Conservation policy is inseparable from questions of sovereignty, access and resettlement.",
    identity: "Chagossian communities live principally in Mauritius, Seychelles and the United Kingdom and maintain a distinct displaced-islander identity and claims of return.",
    researchNote: "This dossier flags a fast-changing and contested field. Verify any assertion about sovereignty, citizenship, access or resettlement against current official documents and judgments.",
    sources: [{ label: "BIOT Administration", href: "https://www.biot.gov.io/" }, { label: "UK policy on the Chagos Archipelago", href: "https://www.gov.uk/government/topical-events/chagos-archipelago" }, ukFramework],
  },
  {
    slug: "british-virgin-islands", name: "British Virgin Islands", officialName: "The Virgin Islands", code: "VG", region: "Caribbean", administrativeCentre: "Road Town", population: "≈ 39,000", populationDate: "Recent estimate", area: "153 km²", currency: "US dollar (USD)", timeZone: "Atlantic Standard Time (UTC−4)", coordinates: [18.4285, -64.6185],
    summary: "A Caribbean archipelago combining a globally significant company-registration sector with tourism, yachting and a closely connected island society.",
    constitutionalPosition: "The Virgin Islands are a British Overseas Territory with a written constitution and substantial internal self-government. The Governor holds reserved responsibilities and the UK retains ultimate responsibility for good governance.",
    government: "An elected House of Assembly supports a Cabinet led by the Premier. The territory participates in the Eastern Caribbean Supreme Court, with final appeal generally available to the Privy Council.",
    economy: "International business companies, financial and professional services, tourism and yacht services are leading activities. Beneficial ownership, economic substance and public-sector governance are major reform themes.",
    environment: "Steep volcanic islands, dry forest, beaches and coral reefs are highly exposed to hurricanes; recovery from severe storms has reshaped infrastructure policy.",
    identity: "Virgin Islands identity is expressed through music, food, sailing and the annual emancipation festival, alongside strong regional and diaspora ties.",
    researchNote: "Company incorporation in the BVI does not determine tax residence, beneficial ownership, substance or the law governing activity elsewhere.",
    sources: [{ label: "Government of the Virgin Islands", href: "https://bvi.gov.vg/" }, { label: "BVI legislation", href: "https://bvi.gov.vg/laws" }, { label: "BVI Financial Services Commission", href: "https://www.bvifsc.vg/" }, ukFramework],
  },
  {
    slug: "cayman-islands", name: "Cayman Islands", officialName: "The Cayman Islands", code: "KY", region: "Caribbean", administrativeCentre: "George Town", population: "88,833", populationDate: "2024 estimate", area: "264 km²", currency: "Cayman Islands dollar (KYD)", timeZone: "Eastern Standard Time (UTC−5)", coordinates: [19.2866, -81.3744],
    summary: "Three Caribbean islands whose population growth, tourism and major international financial centre sit alongside distinct Caymanian institutions and identity.",
    constitutionalPosition: "The Cayman Islands are a British Overseas Territory governed under a written constitution. Domestic government is substantially devolved, while the Governor retains specified responsibilities.",
    government: "Parliament and Cabinet manage most domestic affairs. The courts form a separate Cayman hierarchy with final appeal generally to the Judicial Committee of the Privy Council.",
    economy: "Financial services and tourism dominate. The territory has no general income or corporate profits tax, but fees, duties, regulatory obligations, economic-substance rules and international reporting standards apply.",
    environment: "Low elevation, coral ecosystems, mangroves and seagrass are exposed to hurricanes, coastal development pressure and sea-level rise.",
    identity: "Maritime traditions, seafaring, church life and the historical movement of Caymanians through the Caribbean and wider world shape public culture.",
    researchNote: "A Cayman vehicle’s local tax position does not neutralise foreign tax, securities, AML, beneficial-ownership or residence rules.",
    sources: [{ label: "Cayman Islands Government", href: "https://www.gov.ky/" }, { label: "Cayman legislation", href: "https://legislation.gov.ky/" }, { label: "Economics and Statistics Office", href: "https://www.eso.ky/" }, ukFramework],
  },
  {
    slug: "falkland-islands", name: "Falkland Islands", officialName: "The Falkland Islands", code: "FK", region: "South Atlantic", administrativeCentre: "Stanley", population: "3,662", populationDate: "2021 census resident population", area: "12,173 km²", currency: "Falkland Islands pound (FKP)", timeZone: "UTC−3", coordinates: [-51.6977, -57.8517],
    summary: "A widely scattered South Atlantic archipelago with a small, predominantly Stanley-based population, major fisheries and exceptional wildlife.",
    constitutionalPosition: "The Falkland Islands are internally self-governing under their constitution. The UK is responsible for defence and external affairs. Argentina disputes British sovereignty and calls the islands Islas Malvinas.",
    government: "Eight elected members of the Legislative Assembly and a public-service executive manage domestic government. There is no party-political cabinet system in the usual Westminster form.",
    economy: "Fisheries licensing is central to public revenue, supported by agriculture, tourism and services. Prospective hydrocarbons have long been politically and environmentally significant.",
    environment: "Tussac grasslands, peat landscapes and rich surrounding seas support globally important penguin, albatross and marine-mammal populations.",
    identity: "Falkland Islander identity is closely tied to self-determination, rural Camp life, Stanley, the 1982 war and links across the South Atlantic.",
    researchNote: "Every sovereignty statement should distinguish the UK and islanders’ position from Argentina’s claim and avoid implying that the dispute is settled by terminology alone.",
    sources: [{ label: "Falkland Islands Government", href: "https://www.falklands.gov.fk/" }, { label: "Falkland Islands legislation", href: "https://www.legislation.gov.fk/" }, { label: "2021 Census", href: "https://falklands.gov.fk/policy/2021-census/census" }, ukFramework],
  },
  {
    slug: "gibraltar", name: "Gibraltar", officialName: "Gibraltar", code: "GI", region: "Europe", administrativeCentre: "Gibraltar", population: "≈ 38,000", populationDate: "Preliminary 2022 census estimate", area: "6.8 km²", currency: "Gibraltar pound (GIP)", timeZone: "Central European Time", coordinates: [36.1408, -5.3536], image: "/places/gibraltar.jpg", imageAlt: "The limestone ridge of the Rock of Gibraltar above the Mediterranean",
    summary: "A dense Mediterranean city territory beneath the Rock, combining British institutions, intense links with neighbouring Spain and a highly international economy.",
    constitutionalPosition: "Gibraltar is a British Overseas Territory with extensive internal self-government. The UK retains responsibility for defence and external affairs. Spain disputes British sovereignty.",
    government: "An elected Parliament and ministers led by the Chief Minister manage domestic affairs. The Governor represents the Crown and exercises reserved constitutional responsibilities.",
    economy: "Financial services, online gaming, shipping, tourism and public services are prominent. Cross-border workers and access to the surrounding region are essential to daily economic life.",
    environment: "The Rock is a limestone promontory and migratory-bird landmark. Dense development, water production, maritime traffic and protected habitats coexist in a very small area.",
    identity: "Llanito speech and Gibraltarian identity combine English, Spanish, Genoese, Maltese, Jewish, Moroccan and other Mediterranean influences.",
    researchNote: "Gibraltar law is distinct from UK law. Post-Brexit border and market arrangements are changeable and should be verified at the date of use.",
    sources: [{ label: "HM Government of Gibraltar", href: "https://www.gibraltar.gov.gi/" }, { label: "Gibraltar Laws", href: "https://www.gibraltarlaws.gov.gi/" }, { label: "Gibraltar statistics", href: "https://www.gibraltar.gov.gi/statistics" }, ukFramework],
  },
  {
    slug: "montserrat", name: "Montserrat", officialName: "Montserrat", code: "MS", region: "Caribbean", administrativeCentre: "Brades", population: "≈ 4,300", populationDate: "Recent estimate", area: "102 km²", currency: "East Caribbean dollar (XCD)", timeZone: "Atlantic Standard Time (UTC−4)", coordinates: [16.7425, -62.1874],
    summary: "A Caribbean island transformed by the Soufrière Hills eruptions, with much of the south—including the former capital Plymouth—inside an exclusion zone.",
    constitutionalPosition: "Montserrat is a British Overseas Territory with a written constitution. Local elected government operates alongside a Governor, with continuing UK responsibilities and development support.",
    government: "A Legislative Assembly and Cabinet led by the Premier manage domestic affairs. The Governor retains specified constitutional functions.",
    economy: "Public services, construction, tourism and a small private sector operate in a population and geography radically altered by volcanic activity.",
    environment: "An active volcano dominates land use and settlement. Forest, reefs and volcanic landscapes sit alongside continuing monitoring, exclusion zones and disaster planning.",
    identity: "Montserrat’s Irish and African cultural inheritances, music traditions and global diaspora remain strong despite displacement after the eruptions.",
    researchNote: "Property, planning and access questions must account for volcanic exclusion zones and the exceptional post-eruption administrative landscape.",
    sources: [{ label: "Government of Montserrat", href: "https://www.gov.ms/" }, { label: "Attorney General's Chambers", href: "https://agc.gov.ms/" }, ukFramework],
  },
  {
    slug: "pitcairn-islands", name: "Pitcairn Islands", officialName: "Pitcairn, Henderson, Ducie and Oeno Islands", code: "PN", region: "Pacific", administrativeCentre: "Adamstown", population: "Fewer than 50", populationDate: "Resident count changes frequently", area: "≈ 47 km²", currency: "New Zealand dollar (NZD)", timeZone: "UTC−8", coordinates: [-25.0663, -130.1005],
    summary: "Britain’s only Pacific Overseas Territory consists of four remote islands; only Pitcairn is inhabited, by one of the world’s smallest island communities.",
    constitutionalPosition: "Pitcairn is governed under a written constitution by a Governor based outside the islands, working with an elected Island Council. The UK carries extensive administrative and financial responsibility.",
    government: "The Island Council manages local matters within a legal system of Pitcairn ordinances and applied law. External administration and specialist services are substantial because of the community’s scale and remoteness.",
    economy: "Public administration, subsistence production, handicrafts, honey, tourism and philatelic or domain-related income support a tiny economy with difficult transport access.",
    environment: "Henderson Island is a World Heritage site; the territory’s huge marine zone and remote ecosystems are significant, while plastic pollution reaches even uninhabited shores.",
    identity: "The settlement descends from Bounty mutineers and Polynesian companions, while modern identity is also shaped by migration, constitutional reform and community survival.",
    researchNote: "Numbers and services can change materially with a handful of arrivals or departures. Verify current resident and transport information directly with the administration.",
    sources: [{ label: "Pitcairn Islands Government", href: "https://www.government.pn/" }, { label: "Pitcairn Laws", href: "https://www.government.pn/laws/" }, ukFramework],
  },
  {
    slug: "saint-helena-ascension-tristan-da-cunha", name: "Saint Helena, Ascension and Tristan da Cunha", officialName: "Saint Helena, Ascension and Tristan da Cunha", code: "SH", region: "South Atlantic", administrativeCentre: "Jamestown; separate island administrations", population: "≈ 5,500 across the territory", populationDate: "Island totals are published separately", area: "≈ 394 km²", currency: "Saint Helena pound; pound sterling on Ascension", timeZone: "GMT", coordinates: [-15.9244, -5.7181],
    summary: "Three exceptionally remote island groups share one territorial constitution while retaining separate communities, councils, laws and practical administrations.",
    constitutionalPosition: "The 2009 Constitution establishes the single territory but treats Saint Helena, Ascension and Tristan da Cunha as distinct parts. A Governor is based on Saint Helena; Ascension and Tristan have Administrators and local councils.",
    government: "Saint Helena has ministerial government and a Legislative Council. Ascension and Tristan da Cunha have separate councils and locally applicable ordinances within the territorial framework.",
    economy: "Public administration, fishing, tourism, communications and defence-linked activity vary sharply between islands. Remoteness and transport costs dominate economic planning.",
    environment: "The islands contain extraordinary endemic species, volcanic landscapes and vast marine zones. Invasive species and access constraints make conservation unusually complex.",
    identity: "Saints, Ascension residents and Tristanians have distinct identities and migration histories; treating the territory as a single homogeneous island obscures important differences.",
    researchNote: "Always identify which island a rule or statistic concerns. A Saint Helena ordinance or service may not operate in the same way on Ascension or Tristan da Cunha.",
    sources: [{ label: "Saint Helena Government", href: "https://www.sainthelena.gov.sh/" }, { label: "Ascension Island Government", href: "https://www.ascension.gov.ac/" }, { label: "Tristan da Cunha Government", href: "https://www.tristandc.com/government.php" }, ukFramework],
  },
  {
    slug: "south-georgia-south-sandwich-islands", name: "South Georgia & South Sandwich Islands", officialName: "South Georgia and the South Sandwich Islands", code: "GS", region: "South Atlantic", administrativeCentre: "King Edward Point", population: "No permanent population", populationDate: "Rotating officials and researchers", area: "≈ 3,903 km²", currency: "Pound sterling in administration", timeZone: "UTC−2", coordinates: [-54.4296, -36.5879],
    summary: "A sub-Antarctic territory of vast wildlife colonies, glaciated mountains and historic whaling sites, administered without a permanent civilian population.",
    constitutionalPosition: "The territory is administered by a Commissioner, normally also the Governor of the Falkland Islands. Argentina disputes British sovereignty over both island groups.",
    government: "There is no elected resident government. The administration licenses fisheries and tourism, manages heritage and conservation, and maintains a small official presence at King Edward Point.",
    economy: "Fisheries licensing and regulated tourism generate revenue. There is no ordinary resident private economy or company-formation market.",
    environment: "Enormous penguin, seal and seabird populations depend on productive Southern Ocean ecosystems. Invasive-species eradication and biosecurity are major conservation achievements and continuing priorities.",
    identity: "The territory has no permanent people-based national identity; its public story centres on exploration, whaling, the Shackleton connection, science and ecological recovery.",
    researchNote: "Environmental permits, fisheries rules and biosecurity dominate practical law. Ordinary residence and consumer-market assumptions usually do not apply.",
    sources: [{ label: "Government of SGSSI", href: "https://gov.gs/" }, { label: "SGSSI legislation", href: "https://gov.gs/legislation/" }, ukFramework],
  },
  {
    slug: "akrotiri-dhekelia", name: "Akrotiri and Dhekelia", officialName: "The Sovereign Base Areas of Akrotiri and Dhekelia", code: "SBA", region: "Mediterranean", administrativeCentre: "Episkopi Cantonment", population: "≈ 18,000 residents plus personnel", populationDate: "Includes Cypriot communities; personnel vary", area: "254 km²", currency: "Euro (EUR)", timeZone: "Eastern European Time", coordinates: [34.6786, 32.9576],
    summary: "Two areas retained under British sovereignty when Cyprus became independent, administered primarily to sustain military bases rather than as a commercial colony.",
    constitutionalPosition: "The Sovereign Base Areas are British Overseas Territories administered by the Ministry of Defence. Their governing commitments aim not to develop them for non-military commercial purposes and to respect Cypriot community interests.",
    government: "An Administrator, who is also Commander British Forces Cyprus, heads the SBA Administration. Civil law and services are closely coordinated with the Republic of Cyprus.",
    economy: "The bases are not promoted as an investment, tax or company-registration jurisdiction. Local residents participate substantially in the surrounding Cypriot economy.",
    environment: "Akrotiri salt lake, wetlands and coastal habitats are major migratory-bird and biodiversity sites, coexisting with military and civilian land uses.",
    identity: "Most civilian residents are Cypriot rather than a distinct settler population of the territory. The areas’ identity is administrative and strategic.",
    researchNote: "Do not treat the SBAs as equivalent to a self-governing Caribbean territory. Military purpose, the 1960 arrangements and alignment with Cyprus are central.",
    sources: [{ label: "Sovereign Base Areas Administration", href: "https://www.sbaadministration.org/" }, { label: "SBA laws", href: "https://www.sbaadministration.org/index.php/legislation" }, ukFramework],
  },
  {
    slug: "turks-caicos-islands", name: "Turks and Caicos Islands", officialName: "The Turks and Caicos Islands", code: "TC", region: "Caribbean", administrativeCentre: "Cockburn Town", population: "≈ 49,000", populationDate: "Recent estimate", area: "≈ 948 km²", currency: "US dollar (USD)", timeZone: "Eastern Time", coordinates: [21.4675, -71.1389],
    summary: "A rapidly growing Caribbean archipelago where tourism, migration, construction and financial services meet fragile low-lying island environments.",
    constitutionalPosition: "The Turks and Caicos Islands are a British Overseas Territory with a written constitution and elected government. The Governor retains specified responsibilities and reserve powers.",
    government: "The House of Assembly and Cabinet led by the Premier manage domestic government. Courts operate within the territory with final appeal generally to the Privy Council.",
    economy: "High-value tourism, real estate, construction and financial services lead the economy. There is no general income tax, but customs duties, fees, regulation and external tax rules remain important.",
    environment: "Low limestone islands, wetlands, reefs and seagrass are highly exposed to hurricanes, water stress, coastal development and sea-level rise.",
    identity: "Turks and Caicos Islander status, migration and rapid demographic change are central to politics, land, work and belonging.",
    researchNote: "Nationality, immigration permission and Turks and Caicos Islander status are different legal categories with different rights.",
    sources: [{ label: "TCI Government", href: "https://www.gov.tc/" }, { label: "TCI laws", href: "https://www.gov.tc/agc/laws" }, { label: "TCI Statistics Authority", href: "https://stats.gov.tc/" }, ukFramework],
  },
];

export const territorySlugByName = Object.fromEntries(territoryDossiers.map((territory) => [territory.name, territory.slug]));

export function getTerritory(slug: string) {
  return territoryDossiers.find((territory) => territory.slug === slug);
}
