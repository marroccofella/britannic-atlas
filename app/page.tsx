"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { territorySlugByName } from "./territories/data";

type Profile = {
  name: string;
  type: string;
  region: string;
  code: string;
  relation: string;
  note?: string;
};

const homeNations: Profile[] = [
  { name: "England", type: "Home nation", region: "Europe", code: "ENG", relation: "Part of the United Kingdom", note: "Largest UK nation; most domestic policy is administered through UK institutions." },
  { name: "Scotland", type: "Home nation", region: "Europe", code: "SCT", relation: "Part of the United Kingdom", note: "Distinct legal and education systems, with devolved government at Holyrood." },
  { name: "Wales", type: "Home nation", region: "Europe", code: "WLS", relation: "Part of the United Kingdom", note: "Devolved legislature and government; Welsh and English are official languages." },
  { name: "Northern Ireland", type: "Home nation", region: "Europe", code: "NIR", relation: "Part of the United Kingdom", note: "Power-sharing devolution shaped by the Belfast / Good Friday Agreement." },
];

const crownDependencies: Profile[] = [
  { name: "Jersey", type: "Crown dependency", region: "Channel Islands", code: "JE", relation: "Self-governing possession of the Crown", note: "Not part of the UK. The Bailiwick has its own legislature, fiscal system and courts." },
  { name: "Guernsey", type: "Crown dependency", region: "Channel Islands", code: "GG", relation: "Self-governing possession of the Crown", note: "A Bailiwick that includes Guernsey, Alderney, Sark and smaller islands." },
  { name: "Isle of Man", type: "Crown dependency", region: "Irish Sea", code: "IM", relation: "Self-governing possession of the Crown", note: "Home to Tynwald, one of the world’s oldest continuous parliamentary institutions." },
];

const territories: Profile[] = [
  { name: "Anguilla", type: "Overseas territory", region: "Caribbean", code: "AI", relation: "British Overseas Territory", note: "A self-governing Caribbean territory with a UK-appointed Governor." },
  { name: "Bermuda", type: "Overseas territory", region: "North Atlantic", code: "BM", relation: "British Overseas Territory", note: "The oldest continuously self-governing Overseas Territory, with a major insurance sector." },
  { name: "British Antarctic Territory", type: "Overseas territory", region: "Antarctica", code: "BAT", relation: "Claim held subject to the Antarctic Treaty System", note: "Administered from London; the territorial claim is held in abeyance under the treaty system." },
  { name: "British Indian Ocean Territory", type: "Overseas territory", region: "Indian Ocean", code: "IO", relation: "British Overseas Territory", note: "The Chagos Archipelago; sovereignty, resettlement and defence arrangements remain central to its story." },
  { name: "British Virgin Islands", type: "Overseas territory", region: "Caribbean", code: "VG", relation: "British Overseas Territory", note: "A major international company-registration and financial-services centre." },
  { name: "Cayman Islands", type: "Overseas territory", region: "Caribbean", code: "KY", relation: "British Overseas Territory", note: "A leading global financial centre with its own legislature, courts and regulator." },
  { name: "Falkland Islands", type: "Overseas territory", region: "South Atlantic", code: "FK", relation: "British Overseas Territory", note: "Internally self-governing; sovereignty is disputed by Argentina." },
  { name: "Gibraltar", type: "Overseas territory", region: "Europe", code: "GI", relation: "British Overseas Territory", note: "A self-governing territory at the entrance to the Mediterranean; sovereignty is disputed by Spain." },
  { name: "Montserrat", type: "Overseas territory", region: "Caribbean", code: "MS", relation: "British Overseas Territory", note: "Its modern geography and public life were transformed by Soufrière Hills volcanic activity." },
  { name: "Pitcairn Islands", type: "Overseas territory", region: "Pacific", code: "PN", relation: "British Overseas Territory", note: "Pitcairn, Henderson, Ducie and Oeno form Britain’s only Pacific Overseas Territory." },
  { name: "Saint Helena, Ascension and Tristan da Cunha", type: "Overseas territory", region: "South Atlantic", code: "SH", relation: "British Overseas Territory", note: "Three widely separated island groups governed under one territorial constitution." },
  { name: "South Georgia & South Sandwich Islands", type: "Overseas territory", region: "South Atlantic", code: "GS", relation: "British Overseas Territory", note: "No permanent civilian population; globally significant sub-Antarctic ecosystems." },
  { name: "Akrotiri and Dhekelia", type: "Overseas territory", region: "Mediterranean", code: "SBA", relation: "Sovereign Base Areas", note: "Military base areas retained under British sovereignty when Cyprus became independent." },
  { name: "Turks and Caicos Islands", type: "Overseas territory", region: "Caribbean", code: "TC", relation: "British Overseas Territory", note: "An archipelago with internal self-government and a UK-appointed Governor." },
];

const realms = ["Antigua and Barbuda", "Australia", "The Bahamas", "Belize", "Canada", "Grenada", "Jamaica", "New Zealand", "Papua New Guinea", "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Solomon Islands", "Tuvalu"];
const monarchies = ["Brunei Darussalam", "Eswatini", "Lesotho", "Malaysia", "Tonga"];
const republics = ["Bangladesh", "Barbados", "Botswana", "Cameroon", "Cyprus", "Dominica", "Fiji", "Gabon", "The Gambia", "Ghana", "Guyana", "India", "Kenya", "Kiribati", "Malawi", "Maldives", "Malta", "Mauritius", "Mozambique", "Namibia", "Nauru", "Nigeria", "Pakistan", "Rwanda", "Samoa", "Seychelles", "Sierra Leone", "Singapore", "South Africa", "Sri Lanka", "Tanzania", "Togo", "Trinidad and Tobago", "Uganda", "Vanuatu", "Zambia"];
const commonwealth: Profile[] = [
  { name: "United Kingdom", type: "Commonwealth realm", region: "Europe", code: "UK", relation: "Commonwealth member and realm" },
  ...realms.map((name) => ({ name, type: "Commonwealth realm", region: "Commonwealth", code: name.slice(0, 2).toUpperCase(), relation: "Independent state sharing the same monarch" })),
  ...monarchies.map((name) => ({ name, type: "Commonwealth monarchy", region: "Commonwealth", code: name.slice(0, 2).toUpperCase(), relation: "Independent state with its own monarchy" })),
  ...republics.map((name) => ({ name, type: "Commonwealth republic", region: "Commonwealth", code: name.slice(0, 2).toUpperCase(), relation: "Independent republic in the Commonwealth" })),
];

const associated: Profile[] = [
  { name: "Cook Islands", type: "Associated state", region: "Pacific", code: "CK", relation: "Self-governing in free association with New Zealand" },
  { name: "Niue", type: "Associated state", region: "Pacific", code: "NU", relation: "Self-governing in free association with New Zealand" },
  { name: "Tokelau", type: "External territory", region: "Pacific", code: "TK", relation: "Non-self-governing territory of New Zealand" },
  { name: "Norfolk Island", type: "Australian external territory", region: "Pacific", code: "NF", relation: "External territory of Australia" },
  { name: "Christmas Island", type: "Australian external territory", region: "Indian Ocean", code: "CX", relation: "External territory of Australia" },
  { name: "Cocos (Keeling) Islands", type: "Australian external territory", region: "Indian Ocean", code: "CC", relation: "External territory of Australia" },
  { name: "Ashmore and Cartier Islands", type: "Australian external territory", region: "Indian Ocean", code: "AC", relation: "Uninhabited external territory of Australia" },
  { name: "Coral Sea Islands", type: "Australian external territory", region: "Pacific", code: "CS", relation: "External territory of Australia" },
  { name: "Heard Island and McDonald Islands", type: "Australian external territory", region: "Sub-Antarctic", code: "HM", relation: "External territory of Australia" },
  { name: "Australian Antarctic Territory", type: "Australian external territory", region: "Antarctica", code: "AAT", relation: "Australian claim subject to the Antarctic Treaty System" },
];

const profiles = [...homeNations, ...crownDependencies, ...territories, ...commonwealth, ...associated];

const systems = [
  ["Constitution & governance", "Who legislates?", "Reserved powers", "Governor’s role", "Constitutional reform"],
  ["Citizenship & belonging", "British nationality", "Belonger status", "Right of abode", "Naturalisation routes"],
  ["Immigration & work", "Entry rules", "Work permits", "Labour-market tests", "Family routes"],
  ["Courts & legal systems", "Legal tradition", "Final appeal", "Judicial appointments", "Legal aid"],
  ["Tax & public revenue", "Income tax", "Corporate tax", "Consumption tax", "Information exchange"],
  ["Companies & ownership", "Entity registry", "Beneficial ownership", "Economic substance", "Insolvency"],
  ["Banking & finance", "Regulator", "Deposit protection", "Payments access", "Digital assets"],
  ["Money & monetary links", "Legal tender", "Currency peg", "Local notes", "Exchange controls"],
  ["Health & care", "Public coverage", "Reciprocal access", "Medevac", "Professional licensing"],
  ["Social security", "Contributions", "Pensions", "Portability", "Retirement age"],
  ["Land & housing", "Foreign ownership", "Title system", "Planning", "Tenant rights"],
  ["Transport & registries", "Driving side", "Licence exchange", "Ship registry", "Aircraft registry"],
  ["Trade & customs", "Customs union", "Tariffs", "Rules of origin", "Sanctions"],
  ["Infrastructure & utilities", "Energy mix", "Water security", "Telecoms", "Emergency numbers"],
  ["Environment & ocean", "Marine protection", "Biodiversity", "Climate risk", "Resource rights"],
  ["Identity & public life", "Languages", "Education", "Media", "Commemoration"],
];

const lenses = ["Authority", "Eligibility", "Funding", "Process", "Enforcement", "Portability", "Transparency", "Reform"];
const questionForms = [
  (system: string, topic: string, place: string, lens: string) => `Who holds practical authority over ${topic.toLowerCase()} in ${place}, and how does that reflect its ${lens.toLowerCase()} framework?`,
  (system: string, topic: string, place: string, _lens: string) => `What rules govern ${topic.toLowerCase()} in ${place}, and which residents or institutions fall outside them?`,
  (system: string, topic: string, place: string, _lens: string) => `How does ${place} fund, administer and audit ${system.toLowerCase()}, especially in relation to ${topic.toLowerCase()}?`,
  (system: string, topic: string, place: string, _lens: string) => `Where does responsibility for ${topic.toLowerCase()} pass between local institutions, the UK and external bodies in ${place}?`,
  (system: string, topic: string, place: string, _lens: string) => `Which appeals, safeguards and enforcement routes apply when a ${topic.toLowerCase()} decision is disputed in ${place}?`,
  (system: string, topic: string, place: string, _lens: string) => `Can rights or qualifications connected to ${topic.toLowerCase()} move between ${place} and the UK, and on what terms?`,
  (system: string, topic: string, place: string, _lens: string) => `Which records about ${topic.toLowerCase()} are public in ${place}, and which remain restricted or discretionary?`,
  (system: string, topic: string, place: string, _lens: string) => `How has ${place} reformed ${topic.toLowerCase()} since 2000, and what proposals remain contested?`,
  (system: string, topic: string, place: string, _lens: string) => `What would a newcomer wrongly assume about ${topic.toLowerCase()} in ${place}, and what is the legally accurate position?`,
  (system: string, topic: string, place: string, lens: string) => `Which official sources would establish the current ${lens.toLowerCase()} position for ${topic.toLowerCase()} in ${place}?`,
];

const timeline = [
  ["1066", "Conquest and Crown", "The Norman Conquest reshapes landholding, governance and connections across the Channel."],
  ["1215", "Magna Carta", "A settlement between king and barons becomes a durable reference point in constitutional history."],
  ["1536–43", "Laws in Wales Acts", "Wales is incorporated into the English legal and administrative system."],
  ["1603", "Union of the Crowns", "James VI of Scotland also becomes James I of England and Ireland."],
  ["1607", "Jamestown", "The first lasting English settlement in North America is established in Virginia."],
  ["1655", "Jamaica captured", "English forces seize Jamaica from Spain; plantation slavery becomes central to its colonial economy."],
  ["1707", "Acts of Union", "England and Scotland form the Kingdom of Great Britain."],
  ["1713", "Treaty of Utrecht", "Britain gains strategic territories and commercial privileges after the War of the Spanish Succession."],
  ["1757", "Plassey", "East India Company power expands decisively in Bengal."],
  ["1763", "A global imperial settlement", "The Seven Years’ War ends with Britain holding a greatly expanded empire."],
  ["1776", "American Declaration", "Thirteen colonies declare independence; war ends with British recognition in 1783."],
  ["1788", "New South Wales", "A British penal colony is founded on Aboriginal lands at Sydney Cove."],
  ["1801", "United Kingdom formed", "Great Britain and Ireland unite under a new constitutional settlement."],
  ["1807", "Slave trade abolished", "Parliament prohibits the British transatlantic slave trade; slavery itself continues in much of the empire."],
  ["1815", "Post-Napoleonic order", "Victory and new territorial acquisitions underpin a century of British maritime reach."],
  ["1833", "Slavery abolition", "Slavery is abolished across most British colonies, with compensation paid to slave owners and coercive apprenticeship imposed on many freed people."],
  ["1858", "The British Raj", "Company rule ends after the 1857 uprising; India comes under direct Crown rule."],
  ["1867", "Canadian Confederation", "The Dominion of Canada establishes a model for settler self-government within the empire."],
  ["1884–85", "Berlin Conference", "European powers formalise rules for colonial expansion in Africa, accelerating partition."],
  ["1914–18", "A world at war", "Millions across the empire serve, labour and supply resources during the First World War."],
  ["1919", "Mandates and unrest", "Britain’s territorial reach peaks as anti-colonial movements gather strength."],
  ["1931", "Statute of Westminster", "Dominions gain legislative independence, transforming the imperial constitutional order."],
  ["1947", "India and Pakistan", "Partition accompanies independence, mass displacement and extensive communal violence."],
  ["1949", "Modern Commonwealth", "The London Declaration enables republics to remain in a reconstituted association."],
  ["1956", "Suez Crisis", "The failed intervention exposes the limits of Britain’s independent global power."],
  ["1960", "Wind of Change", "A rapid decade of African independence follows accelerating anti-colonial pressure."],
  ["1981", "Nationality recast", "The British Nationality Act reorganises citizenship around the UK and remaining territories."],
  ["1997", "Hong Kong handover", "British administration ends and sovereignty transfers to China."],
  ["1998", "Devolution era", "New institutions for Scotland, Wales and Northern Ireland reshape the UK’s territorial constitution."],
  ["2002", "Overseas Territories citizenship", "Most qualifying territory citizens gain British citizenship through legislation."],
  ["2020", "EU departure", "Brexit changes the UK’s external framework and has distinct consequences across its territories."],
];

const collections = [
  ["The constitutional family", "Start here", "How the UK, Crown Dependencies, Overseas Territories and Commonwealth differ—and why the labels matter.", "8 chapters"],
  ["Empire: power and resistance", "Essential history", "Trade, conquest, extraction, enslavement, migration, law, resistance and decolonisation in one connected chronology.", "14 chapters"],
  ["Island government field guide", "Comparative", "A practical route through governors, assemblies, public finance, disaster response and external affairs.", "11 chapters"],
  ["Nationality without shortcuts", "Legal map", "British citizen, BOTC, right of abode, belonger and local status—kept carefully distinct.", "9 chapters"],
  ["Money across the British world", "Systems", "Sterling, local pounds, dollar pegs, currency boards, payment rails and financial regulation.", "12 chapters"],
  ["Memory, monuments & repair", "Debate", "How archives, museums, schools and communities contest the meaning and afterlives of empire.", "10 chapters"],
];

const filters = ["All", "Home nation", "Crown dependency", "Overseas territory", "Commonwealth", "Associated & external"];
const nav = ["Atlas", "Systems", "Chronology", "Collections"];

function filterGroup(profile: Profile, filter: string) {
  if (filter === "All") return true;
  if (filter === "Commonwealth") return profile.type.startsWith("Commonwealth");
  if (filter === "Associated & external") return profile.type.includes("Associated") || profile.type.includes("external") || profile.type.includes("External");
  return profile.type === filter;
}

export default function Home() {
  const [active, setActive] = useState("Atlas");
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Profile | null>(territories[6]);
  const [palette, setPalette] = useState(false);
  const [era, setEra] = useState("All eras");
  const [systemIndex, setSystemIndex] = useState(0);
  const [lensIndex, setLensIndex] = useState(0);
  const [formIndex, setFormIndex] = useState(0);
  const paletteInput = useRef<HTMLInputElement>(null);
  const paletteDialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPalette((value) => !value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const dialog = paletteDialog.current;
    if (!palette || !dialog) return;
    if (!dialog.open) dialog.showModal();
    paletteInput.current?.focus();
    return () => { if (dialog.open) dialog.close(); };
  }, [palette]);

  const results = useMemo(() => profiles.filter((profile) => {
    const matches = `${profile.name} ${profile.type} ${profile.region} ${profile.relation}`.toLowerCase().includes(query.toLowerCase());
    return matches && filterGroup(profile, filter);
  }), [query, filter]);

  const jump = (destination: string) => {
    setActive(destination);
    setPalette(false);
    document.getElementById("workspace")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org", "@type": "WebSite",
        name: "Britannica Atlas of the British World",
        description: "A living, citable knowledge base mapping the constitutional British world and its connected histories.",
        dateModified: "2026-08-15", inLanguage: "en-GB",
        potentialAction: { "@type": "SearchAction", target: "/knowledge?query={search_term_string}", "query-input": "required name=search_term_string" },
      }) }} />
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Britannic Atlas home">
          <span className="brand-mark">BA</span>
          <span><b>BRITANNIC ATLAS</b><small>THE BRITISH WORLD, PROPERLY MAPPED</small></span>
        </a>
        <nav aria-label="Main navigation">
          {nav.map((item) => <button key={item} className={active === item ? "active" : ""} onClick={() => jump(item)}>{item}</button>)}
          <a className="knowledge-link visual-link" href="/explore">Visual explore</a>
          <Link className="knowledge-link" href="/manx">MANX intelligence</Link>
          <Link className="knowledge-link" href="/territories">14 territories</Link>
          <Link className="knowledge-link" href="/knowledge">Knowledge base</Link>
          <Link className="knowledge-link" href="/questions">18,000 templated baselines</Link>
          <Link className="knowledge-link" href="/bankruptcy">1,400 insolvency answers</Link>
          <Link className="knowledge-link" href="/doctoral">Doctoral law</Link>
          <Link className="knowledge-link" href="/context">1,400 context answers</Link>
        </nav>
        <button className="search-trigger" onClick={() => setPalette(true)} aria-label="Open search"><span>⌕</span> Search <kbd>⌘K</kbd></button>
      </header>

      <section className="hero" id="top">
        <div className="hero-lines" aria-hidden="true"><i /><i /><i /><i /></div>
        <div className="eyebrow"><span>AN INDEPENDENT KNOWLEDGE PROJECT</span><span>EDITION 01 — 2026</span></div>
        <div className="hero-grid">
          <div>
            <p className="kicker">One crown. Many constitutions.<br />Centuries of consequence.</p>
            <h1>The British world,<br /><em>properly mapped.</em></h1>
          </div>
          <div className="hero-aside">
            <p>A field guide to the United Kingdom, Crown Dependencies, Overseas Territories, Commonwealth—and the histories that bind and divide them.</p>
            <button onClick={() => jump("Atlas")}>ENTER THE ATLAS <span>↘</span></button>
          </div>
        </div>
        <div className="signal-row">
          <div><strong>87</strong><span>jurisdiction profiles</span></div>
          <div><strong>1,280</strong><span>system comparison paths</span></div>
          <div><strong>31</strong><span>turning points in context</span></div>
          <div className="status"><i /> Primary-source monitor live</div>
        </div>
      </section>

      <section className="home-visual-gateway">
        <a href="/explore" className="home-visual-lead"><img src="/places/jersey.jpg" alt="Jersey's green coastline and blue sea" /><span>NEW VISUAL EDITION</span><strong>See the places behind the constitutional map.</strong><b>EXPLORE IN EARTH, MAPS & STREET VIEW ↗</b></a>
        <a href="/explore#portrait"><img src="/places/edinburgh.jpg" alt="Edinburgh skyline at sunset" /><span>SCOTLAND</span></a>
        <a href="/explore#portrait"><img src="/places/gibraltar.jpg" alt="The Rock of Gibraltar above the Mediterranean" /><span>GIBRALTAR</span></a>
      </section>

      <section className="workspace" id="workspace">
        <div className="section-heading">
          <span>01 / {active.toUpperCase()}</span>
          <h2>{active === "Atlas" ? "A constitution is a relationship." : active === "Systems" ? "Compare like with like." : active === "Chronology" ? "Power changes shape over time." : "Routes through a connected world."}</h2>
          <p>{active === "Atlas" ? "Select any jurisdiction to see the legal relationship beneath the familiar flag." : active === "Systems" ? "Sixteen public systems, each opened through eight investigative lenses and ten question forms." : active === "Chronology" ? "A connected chronology of formation, expansion, resistance, reform and decolonisation." : "Editorially guided sequences for readers who want a coherent path rather than a pile of facts."}</p>
        </div>

        {active === "Atlas" && (
          <div className="atlas-view">
            <div className="filter-row" role="group" aria-label="Filter profiles">
              {filters.map((item) => <button key={item} className={filter === item ? "selected" : ""} onClick={() => setFilter(item)}>{item}</button>)}
            </div>
            <div className="atlas-grid">
              <div className="profile-list">
                <div className="list-head"><span>{results.length.toString().padStart(2, "0")} RECORDS</span><input aria-label="Search profiles" placeholder="Filter by name or region…" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
                <div className="list-scroll">
                  {results.map((profile, index) => (
                    <div key={`${profile.name}-${profile.type}`} className={`profile-row ${selected?.name === profile.name && selected?.type === profile.type ? "current" : ""}`}>
                      <button className="profile-row-select" onClick={() => setSelected(profile)}>
                        <span className="index">{(index + 1).toString().padStart(2, "0")}</span>
                        <span className="monogram">{profile.code}</span>
                        <span className="profile-name"><b>{profile.name}</b><small>{profile.type} · {profile.region}</small></span>
                      </button>
                      {territorySlugByName[profile.name]
                        ? <a className="profile-page-arrow" href={`/territories/${territorySlugByName[profile.name]}`} aria-label={`Open the ${profile.name} territory dossier`}>↗</a>
                        : <span className="profile-page-arrow profile-select-arrow" aria-hidden="true">→</span>}
                    </div>
                  ))}
                  {!results.length && <p className="empty">No profile matches that search.</p>}
                </div>
              </div>
              <aside className="dossier">
                {selected && <>
                  <div className="dossier-top"><span>JURISDICTION DOSSIER</span><span>{selected.code} / 001</span></div>
                  <div className="seal">{selected.code}</div>
                  <p className="dossier-type">{selected.type}</p>
                  <h3>{selected.name}</h3>
                  <p className="relation">{selected.relation}</p>
                  <p className="note">{selected.note || `${selected.name} is represented here as part of the wider constitutional and historical network. Its domestic institutions remain distinct and should be studied on their own terms.`}</p>
                  <dl>
                    <div><dt>REGION</dt><dd>{selected.region}</dd></div>
                    <div><dt>STATUS LENS</dt><dd>{selected.type.includes("Commonwealth") ? "Independent sovereign state" : selected.type === "Home nation" ? "UK internal constitution" : "Distinct jurisdiction"}</dd></div>
                    <div><dt>RESEARCH ROUTES</dt><dd>16 systems / 128 prompts</dd></div>
                  </dl>
                  {territorySlugByName[selected.name]
                    ? <a className="dossier-action" href={`/territories/${territorySlugByName[selected.name]}`}>OPEN FULL TERRITORY DOSSIER <span>↗</span></a>
                    : <button className="dossier-action" onClick={() => jump("Systems")}>EXPLORE ITS SYSTEMS <span>→</span></button>}
                </>}
              </aside>
            </div>
          </div>
        )}

        {active === "Systems" && (
          <div className="systems-view">
            <div className="matrix-banner">
              <div><span>COMPARISON ENGINE</span><strong>16 × 8 × 10</strong></div>
              <p>Choose a system, apply a lens, then carry the same question across every constitutional class. That makes 1,280 comparable research paths—not 1,280 disconnected trivia cards.</p>
            </div>
            <div className="system-grid">
              {systems.map((system, index) => (
                <article key={system[0]} className={`system-card ${systemIndex === index ? "chosen" : ""}`}>
                  <span className="system-number">{(index + 1).toString().padStart(2, "0")}</span>
                  <h3>{system[0]}</h3>
                  <ul>{system.slice(1).map((item) => <li key={item}>{item}<span>↗</span></li>)}</ul>
                  <button onClick={() => setSystemIndex(index)}>Use in question builder</button>
                </article>
              ))}
            </div>
            <div className="question-lab">
              <div className="lab-heading"><span>LIVE RESEARCH BUILDER</span><strong>Path {(systemIndex * 80 + lensIndex * 10 + formIndex + 1).toString().padStart(4, "0")} / 1280</strong></div>
              <div className="lab-grid">
                <div className="lab-controls">
                  <label>SYSTEM<select value={systemIndex} onChange={(event) => setSystemIndex(Number(event.target.value))}>{systems.map((system, index) => <option key={system[0]} value={index}>{system[0]}</option>)}</select></label>
                  <label>LENS<select value={lensIndex} onChange={(event) => setLensIndex(Number(event.target.value))}>{lenses.map((lens, index) => <option key={lens} value={index}>{lens}</option>)}</select></label>
                  <label>JURISDICTION<select value={selected?.name ?? territories[6].name} onChange={(event) => setSelected(profiles.find((profile) => profile.name === event.target.value) ?? territories[6])}>{profiles.filter((profile, index) => profiles.findIndex((item) => item.name === profile.name) === index).map((profile) => <option key={profile.name} value={profile.name}>{profile.name}</option>)}</select></label>
                </div>
                <div className="question-output">
                  <small>{systems[systemIndex][0]} / {lenses[lensIndex]}</small>
                  <p>“{questionForms[formIndex](systems[systemIndex][0], systems[systemIndex][1], selected?.name ?? territories[6].name, lenses[lensIndex])}”</p>
                  <div><button onClick={() => setFormIndex((formIndex + 9) % 10)}>← PREVIOUS FORM</button><button onClick={() => setFormIndex((formIndex + 1) % 10)}>NEXT FORM →</button></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {active === "Chronology" && (
          <div className="chronology-view">
            <div className="era-bar">
              {["All eras", "Formation", "Expansion", "Decolonisation", "Afterlives"].map((item) => <button key={item} className={era === item ? "selected" : ""} onClick={() => setEra(item)}>{item}</button>)}
            </div>
            <div className="timeline-intro"><strong>{timeline.length}</strong><p>turning points, read as a connected history of institutions, coercion, movement, resistance and political change.</p></div>
            <div className="timeline">
              {timeline.map((event, index) => {
                const band = index < 7 ? "Formation" : index < 21 ? "Expansion" : index < 28 ? "Decolonisation" : "Afterlives";
                if (era !== "All eras" && era !== band) return null;
                return <article key={event[0]}><time>{event[0]}</time><span className="tick" /><div><small>{band}</small><h3>{event[1]}</h3><p>{event[2]}</p></div></article>;
              })}
            </div>
            <p className="editorial-note"><b>Editorial principle:</b> the chronology distinguishes constitutional history from celebration. It treats empire through governance and commerce, but also through Indigenous sovereignty, enslavement, extraction, migration, resistance and memory.</p>
          </div>
        )}

        {active === "Collections" && (
          <div className="collections-view">
            <div className="collection-grid">
              {collections.map((collection, index) => <article key={collection[0]}>
                <div className={`cover cover-${index + 1}`}><span>{(index + 1).toString().padStart(2, "0")}</span><b>BRITANNIC ATLAS<br />FIELD NOTES</b><i /></div>
                <div className="collection-copy"><small>{collection[1]}</small><h3>{collection[0]}</h3><p>{collection[2]}</p><span>{collection[3]} <b>→</b></span></div>
              </article>)}
            </div>
          </div>
        )}
      </section>

      <section className="method">
        <div><span>02 / METHOD</span><h2>Facts need a frame.</h2></div>
        <p>This atlas separates legal status, political practice and historical experience. It marks disputes, avoids treating the Commonwealth as an empire, and never assumes that British citizenship creates the same local rights everywhere.</p>
        <div className="method-points"><span><b>01</b>CLASSIFY</span><span><b>02</b>COMPARE</span><span><b>03</b>CONTEXTUALISE</span><span><b>04</b>CITE</span></div>
      </section>

      <section className="knowledge-cta">
        <span>03 / KNOWLEDGE BASE</span>
        <h2>Built to be found.<br /><em>Built to be cited.</em></h2>
        <div><p>Explore permanent, date-stamped explainers with primary sources, concise answers and a compliance-oriented bank of legal and jurisdictional research questions.</p><Link href="/manx">OPEN MANX ISLE OF MAN INTELLIGENCE <b>→</b></Link><Link href="/context">OPEN 1,400 STRUCTURAL CONTEXT ANSWERS <b>→</b></Link><Link href="/doctoral">OPEN THE DOCTORAL COMPARATIVE-LAW MODULE <b>→</b></Link><Link href="/explore">OPEN THE VISUAL ENCYCLOPAEDIA <b>→</b></Link><Link href="/questions">EXPLORE 18,000 TEMPLATED RESEARCH BASELINES <b>→</b></Link><Link href="/bankruptcy">OPEN 1,400 INSOLVENCY ANSWERS <b>→</b></Link></div>
      </section>

      <footer>
        <div className="brand footer-brand"><span className="brand-mark">BA</span><span><b>BRITANNIC ATLAS</b><small>THE BRITISH WORLD, PROPERLY MAPPED</small></span></div>
        <p>A living editorial framework for navigating Britain’s constitutional family and imperial afterlives.</p>
        <span>FOUNDATION EDITION · 2026</span>
      </footer>

      {palette && <dialog ref={paletteDialog} className="palette-backdrop" aria-label="Search and navigate" onClose={() => setPalette(false)}>
        <button className="palette-backdrop-dismiss" type="button" onClick={() => setPalette(false)} aria-label="Close search" />
        <div className="palette">
          <div className="palette-input"><span>⌕</span><input ref={paletteInput} placeholder="Search the atlas…" value={query} onChange={(event) => setQuery(event.target.value)} /><button className="palette-close" type="button" onClick={() => setPalette(false)} aria-label="Close search"><span aria-hidden="true">×</span></button><kbd>ESC</kbd></div>
          <div className="palette-results">
            <small>JUMP TO</small>
            {nav.map((item) => <button key={item} onClick={() => jump(item)}><span>{item === "Atlas" ? "◎" : item === "Systems" ? "▦" : item === "Chronology" ? "↝" : "▤"}</span>{item}<kbd>↵</kbd></button>)}
            {query && <><small>PROFILES</small>{results.slice(0, 5).map((profile) => <button key={`${profile.name}-palette`} onClick={() => { setSelected(profile); setActive("Atlas"); setPalette(false); }}><span>{profile.code}</span>{profile.name}<kbd>↗</kbd></button>)}</>}
          </div>
        </div>
      </dialog>}
    </main>
  );
}
