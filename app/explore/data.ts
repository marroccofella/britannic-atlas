export type Place = {
  slug: string;
  name: string;
  strapline: string;
  status: string;
  region: string;
  capital: string;
  population: string;
  populationNote: string;
  earnings: string;
  earningsNote: string;
  area: string;
  currency: string;
  languages: string;
  timeZone: string;
  driving: string;
  callingCode: string;
  tld: string;
  coordinates: [number, number];
  image?: string;
  imageAlt?: string;
  imageCredit?: { label: string; href: string };
  introduction: string;
  character: string[];
  sources: { label: string; href: string }[];
};

const ukPopulationSource = "https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/populationestimates/bulletins/annualmidyearpopulationestimates/mid2024";
const ukEarningsSource = "https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/earningsandworkinghours/bulletins/annualsurveyofhoursandearnings/latest";

export const places: Place[] = [
  {
    slug: "england", name: "England", strapline: "A nation of regions, cities and shires", status: "Home nation · United Kingdom", region: "Europe", capital: "London",
    population: "58,620,101", populationNote: "Mid-2024 estimate", earnings: "£39,039", earningsNote: "UK median annual full-time earnings · 2025 benchmark", area: "130,279 km²", currency: "Pound sterling (GBP)", languages: "English; many regional and community languages", timeZone: "GMT / BST", driving: "Left", callingCode: "+44", tld: ".uk", coordinates: [51.5007, -0.1246],
    image: "/places/london.jpg", imageAlt: "The Palace of Westminster and Elizabeth Tower beside the River Thames", imageCredit: { label: "Marcin Nowak · Unsplash", href: "https://unsplash.com/photos/big-ben-londres-iXqTqC-f6jI" },
    introduction: "England is the largest nation of the United Kingdom by population. It has no separate national legislature: most England-only policy is made through UK institutions, while London and several city-regions have devolved or mayoral powers.",
    character: ["London is the UK capital and largest urban centre", "English common law has travelled widely through the former empire", "Regional identities—from Cornwall to Northumbria—remain politically and culturally important"],
    sources: [{ label: "ONS population estimates", href: ukPopulationSource }, { label: "ONS earnings survey", href: ukEarningsSource }],
  },
  {
    slug: "scotland", name: "Scotland", strapline: "Law, landscape and a devolved parliament", status: "Home nation · United Kingdom", region: "Europe", capital: "Edinburgh",
    population: "5,543,300", populationNote: "Revised mid-2024 estimate", earnings: "£39,039", earningsNote: "UK median annual full-time earnings · 2025 benchmark", area: "77,933 km²", currency: "Pound sterling (GBP); Scottish banknotes", languages: "English, Scots and Scottish Gaelic", timeZone: "GMT / BST", driving: "Left", callingCode: "+44", tld: ".uk / .scot", coordinates: [55.9533, -3.1883],
    image: "/places/edinburgh.jpg", imageAlt: "Edinburgh skyline and castle at sunset", imageCredit: { label: "Sophie Gerrie · Unsplash", href: "https://unsplash.com/photos/EJmEWG95WaA" },
    introduction: "Scotland joined England in the Kingdom of Great Britain in 1707 while retaining distinct legal, education and church institutions. Its devolved Parliament and Government have substantial authority over health, education, justice, environment and other domestic fields.",
    character: ["A mixed legal system with its own courts and professions", "More than 790 offshore islands, of which roughly 90 are inhabited", "Edinburgh is the political capital; Glasgow is the largest city"],
    sources: [{ label: "National Records of Scotland population", href: "https://nrscotland.gov.uk/publications/mid-2025-population-estimates/" }, { label: "ONS earnings survey", href: ukEarningsSource }],
  },
  {
    slug: "wales", name: "Wales · Cymru", strapline: "A bilingual nation shaped by coast and coal", status: "Home nation · United Kingdom", region: "Europe", capital: "Cardiff · Caerdydd",
    population: "3,186,581", populationNote: "Mid-2024 estimate", earnings: "£39,039", earningsNote: "UK median annual full-time earnings · 2025 benchmark", area: "20,779 km²", currency: "Pound sterling (GBP)", languages: "Welsh and English", timeZone: "GMT / BST", driving: "Left", callingCode: "+44", tld: ".uk / .cymru / .wales", coordinates: [51.4816, -3.1791],
    image: "/places/wales.jpg", imageAlt: "A green mountain valley and lake in Eryri, Wales", imageCredit: { label: "Korng Sok · Unsplash", href: "https://unsplash.com/photos/anE8Q_vVu5A" },
    introduction: "Wales is a bilingual nation with a devolved legislature, the Senedd, and Government. Welsh law now forms a growing body within the England-and-Wales legal jurisdiction, while the Welsh language has official status in Wales.",
    character: ["The Senedd sits on Cardiff Bay", "Cymraeg is a living community and public-service language", "Industrial valleys, national parks and a long coastline give Wales sharply varied landscapes"],
    sources: [{ label: "StatsWales population dataset", href: "https://stats.gov.wales/en-GB/82d9faea-b515-41cd-aedb-8f4594f66ce5" }, { label: "ONS earnings survey", href: ukEarningsSource }],
  },
  {
    slug: "northern-ireland", name: "Northern Ireland", strapline: "An intricate constitutional and cultural borderland", status: "Home nation · United Kingdom", region: "Europe", capital: "Belfast",
    population: "1,927,900", populationNote: "Mid-2024 estimate", earnings: "£39,039", earningsNote: "UK median annual full-time earnings · 2025 benchmark", area: "14,130 km²", currency: "Pound sterling (GBP); local banknotes", languages: "English; Irish and Ulster Scots recognised", timeZone: "GMT / BST", driving: "Left", callingCode: "+44 28", tld: ".uk", coordinates: [54.5973, -5.9301],
    introduction: "Northern Ireland’s institutions are shaped by the 1998 Belfast/Good Friday Agreement. Devolved government operates through power-sharing, while the UK–Ireland relationship and an open land border remain central to everyday life.",
    character: ["The Assembly and Executive sit at Stormont", "Constitutional identity is plural and protected by agreement", "Belfast links an industrial and maritime past to a technology and services economy"],
    sources: [{ label: "NISRA mid-2024 population", href: "https://datavis.nisra.gov.uk/population/2024-mid-year-estimates-for-northern-ireland.html" }, { label: "ONS earnings survey", href: ukEarningsSource }],
  },
  {
    slug: "jersey", name: "Jersey", strapline: "Norman custom, finance and extraordinary tides", status: "Crown Dependency · Bailiwick of Jersey", region: "Channel Islands", capital: "Saint Helier",
    population: "103,650", populationNote: "Provisional end-2023 estimate", earnings: "£850 / week", earningsNote: "Median full-time-equivalent earnings · June 2024", area: "120 km²", currency: "Jersey pound and pound sterling", languages: "English; French and Jèrriais have public roles", timeZone: "GMT / BST", driving: "Left", callingCode: "+44 1534", tld: ".je", coordinates: [49.1868, -2.1066],
    image: "/places/jersey.jpg", imageAlt: "An aerial view of Jersey's rugged green coastline and clear blue water", imageCredit: { label: "Visit Jersey", href: "https://business.jersey.com/marketing/campaigns/2026-brand-positioning/for-industry/" },
    introduction: "Jersey is a self-governing possession of the Crown, not part of the United Kingdom. Its elected States Assembly, ministers, courts and fiscal system operate separately, while the UK is responsible for defence and international representation.",
    character: ["One of the world’s largest tidal ranges reshapes the shore twice daily", "A legal tradition rooted partly in Norman customary law", "Finance, tourism, construction and agriculture are prominent sectors"],
    sources: [{ label: "Statistics Jersey population", href: "https://www.gov.je/News/2024/pages/population-and-migration-statistics-2023-published.aspx" }, { label: "Statistics Jersey earnings", href: "https://www.gov.je/news/2024/pages/averageearningsreportjune2024.aspx" }],
  },
  {
    slug: "isle-of-man", name: "Isle of Man · Ellan Vannin", strapline: "Tynwald, the Irish Sea and a modern island economy", status: "Crown Dependency", region: "Irish Sea", capital: "Douglas",
    population: "84,523", populationNote: "Experimental Q1 2024 estimate", earnings: "≈ £40,000 / year", earningsNote: "Local median annual earnings reference · 2024", area: "572 km²", currency: "Manx pound and pound sterling", languages: "English and Manx Gaelic", timeZone: "GMT / BST", driving: "Left", callingCode: "+44 1624", tld: ".im", coordinates: [54.1523, -4.4861],
    introduction: "The Isle of Man is a self-governing Crown Dependency with its own parliament, government, courts and tax system. Tynwald’s two-branch structure and annual open-air ceremony are among its most recognisable institutions.",
    character: ["Tynwald traces its parliamentary tradition back more than a millennium", "The TT motorcycle races turn public roads into an international circuit", "Financial services, e-gaming, manufacturing and the visitor economy are significant"],
    sources: [{ label: "Statistics Isle of Man population", href: "https://www.gov.im/census" }, { label: "Isle of Man earnings reference", href: "https://consult.gov.im/infrastructure/proposals-for-the-shared-equity-purchase/supporting_documents/consultation-document-proposals-for-the-shared-equity-purchase-assistance-schemes-finalpdf" }],
  },
  {
    slug: "gibraltar", name: "Gibraltar", strapline: "A British Mediterranean city beneath the Rock", status: "British Overseas Territory", region: "Iberian Peninsula", capital: "Gibraltar",
    population: "≈ 38,000", populationNote: "Preliminary 2022 census estimate", earnings: "£37,332 / year", earningsNote: "Average gross annual earnings · October 2024", area: "6.8 km²", currency: "Gibraltar pound and pound sterling", languages: "English; Spanish and Llanito widely spoken", timeZone: "CET / CEST", driving: "Right", callingCode: "+350", tld: ".gi", coordinates: [36.1408, -5.3536],
    image: "/places/gibraltar.jpg", imageAlt: "The limestone ridge of the Rock of Gibraltar above the Mediterranean", imageCredit: { label: "Danny Thomas · Unsplash", href: "https://unsplash.com/photos/AGrD3Pus_ns" },
    introduction: "Gibraltar is a densely populated, internally self-governing Overseas Territory at the entrance to the Mediterranean. The UK retains responsibility for defence and external affairs; Spain disputes British sovereignty.",
    character: ["The Rock dominates a territory smaller than many city districts", "English institutions coexist with intense everyday links to neighbouring Spain", "Shipping, financial services, tourism and online gaming are leading sectors"],
    sources: [{ label: "Gibraltar census publications", href: "https://www.gibraltar.gov.gi/statistics/census/census-reports" }, { label: "Gibraltar Employment Survey 2024", href: "https://www.gibraltar.gov.gi/uploads/statistics/2024/Reports/Employment%20Survey%20Report%202024.pdf" }],
  },
  {
    slug: "bermuda", name: "Bermuda", strapline: "Pastel roofs and a global insurance market", status: "British Overseas Territory", region: "North Atlantic", capital: "Hamilton",
    population: "63,356", populationNote: "2023 estimate", earnings: "BMD 75,718 / year", earningsNote: "Median gross annual income from main job · November 2024", area: "54 km²", currency: "Bermudian dollar (BMD), pegged to USD", languages: "English", timeZone: "Atlantic Time", driving: "Left", callingCode: "+1 441", tld: ".bm", coordinates: [32.2949, -64.7814],
    image: "/places/bermuda.jpg", imageAlt: "Pastel houses with white roofs on the turquoise coast of Bermuda", imageCredit: { label: "AARP Travel", href: "https://www.aarp.org/espanol/turismo/internacional/info-2019/consejos-para-visitar-las-islas-bermudas.html" },
    introduction: "Bermuda is Britain’s oldest continuously self-governing Overseas Territory. Its compact islands host one of the world’s most important reinsurance markets, alongside a distinctive architecture of pastel walls and stepped white roofs.",
    character: ["Hamilton is a small capital with an outsized financial role", "Rainwater harvesting helped shape the iconic limestone roof", "Bermuda lies in the North Atlantic, not the Caribbean"],
    sources: [{ label: "Bermuda Digest of Statistics", href: "https://www.gov.bm/digest-statistics" }, { label: "Bermuda Labour Force Survey", href: "https://www.gov.bm/articles/november-2024-labour-force-survey-report-0" }],
  },
  {
    slug: "cayman-islands", name: "Cayman Islands", strapline: "Three islands at a global financial crossroads", status: "British Overseas Territory", region: "Caribbean", capital: "George Town",
    population: "88,833", populationNote: "2024 estimate", earnings: "KYD 3,599.50 / month", earningsNote: "Median main monthly earnings · autumn 2024", area: "264 km²", currency: "Cayman Islands dollar (KYD)", languages: "English", timeZone: "Eastern Standard Time (year-round)", driving: "Left", callingCode: "+1 345", tld: ".ky", coordinates: [19.2866, -81.3744],
    introduction: "Grand Cayman, Cayman Brac and Little Cayman form a self-governing Overseas Territory. International finance and tourism dominate the economy, while the islands maintain their own legislature, courts and regulatory institutions.",
    character: ["George Town is a major offshore financial centre", "The Cayman Islands dollar is pegged to the US dollar", "Coral reefs and marine tourism are central environmental and economic assets"],
    sources: [{ label: "Cayman Compendium of Statistics 2024", href: "https://www.eso.ky/compendium-of-statistics-2024-released.html" }, { label: "Cayman Labour Force Survey 2024", href: "https://www.eso.ky/storage/page_docums/uploadFilePdf/924/The%20Cayman%20Islands%20Labour%20Force%20Survey%20Report%20Fall%202024.pdf" }],
  },
  {
    slug: "falkland-islands", name: "Falkland Islands", strapline: "A small South Atlantic community across a vast archipelago", status: "British Overseas Territory", region: "South Atlantic", capital: "Stanley",
    population: "3,662", populationNote: "2021 census resident population", earnings: "£24,000 / year", earningsNote: "Median annual income, all employed people · 2021 census", area: "12,173 km²", currency: "Falkland Islands pound and pound sterling", languages: "English", timeZone: "FKST (UTC−3)", driving: "Left", callingCode: "+500", tld: ".fk", coordinates: [-51.6977, -57.8517],
    introduction: "The Falkland Islands are an internally self-governing archipelago with a small population and a large maritime zone. Fisheries are central to public revenue, and sovereignty is disputed by Argentina, which calls the islands Islas Malvinas.",
    character: ["Most residents live in Stanley; the countryside is known locally as Camp", "Penguins, albatrosses and marine mammals support conservation and tourism", "The elected Legislative Assembly manages most domestic affairs"],
    sources: [{ label: "Falkland Islands 2021 Census", href: "https://falklands.gov.fk/policy/2021-census/census" }, { label: "2021 Census income table", href: "https://www.falklands.gov.fk/policy/downloads?catid=13&id=219%3Afalkland-islands-2021-census-report&task=download.send" }],
  },
];

export const photoPlaces = places.filter((place) => place.image);
