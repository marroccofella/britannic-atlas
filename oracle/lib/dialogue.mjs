import {reasoningRequest} from '../public/reasoning-check.mjs';
import {knowledgeOnlyQuestion} from './knowledge-runtime.mjs';
import {capabilityRequest} from '../public/request-coverage.mjs';
import {conversationRepairQuestion,conversationPerformanceQuestion,broadeningRequest,restatedRequest} from '../public/conversation-policy.mjs';
// Deterministic conversation handling that runs before retrieval or a paid model.
// The Mannin is Manx-first: another place may override one turn, but the home
// jurisdiction remains the Isle of Man unless a future explicit switch feature
// is added.

import { isManxText } from "./scope.mjs";
import {completeAssent,deliveryRetry,interactionCommand,sourceMode,islandClock,clockQuestion,currentWeatherQuestion} from './interaction-policy.mjs';
import {buildOutQuestion} from './knowledge-map.mjs';
import {isManxPlaceText} from './scope.mjs';
import {manxReviewScope} from './external-policy.mjs';
import {approvedPage} from '../public/page-actions.mjs';
import { localConversation, ordinaryConversation, unfinishedRequest, answerIntent } from "../public/conversation-policy.mjs";

export const DEFAULT_JURISDICTION = "Isle of Man";

export const INFRASTRUCTURE_FACETS = Object.freeze([
  "ports and shipping",
  "airport and aviation",
  "roads and public transport",
  "electricity and fuel",
  "water and sewerage",
  "telecommunications",
  "waste",
]);

const REQUEST_RE = /^(?:please\s+)?(?:(?:what|who|whom|whose|which|when|where|why|how|is|are|was|were|do|does|did|can|could|would|should|will)\b|(?:(?:can|could|would|will)\s+you\s+)?(?:tell|explain|describe|compare|list|show|draw|open|find|give|help)\b|(?:i\s+)?(?:need|want)\b)/i;
// An instruction addressed to Mannin: an imperative opening the utterance.
const IMPERATIVE_RE = new RegExp(String.raw`^(?:please\s+)?(?:sing|play|tell|give|show|list|name|explain|describe|find|answer|do|make|write|compare|define|summari[sz]e|fulfil|fulfill|help|read|say|state|translate|recommend|suggest|check|search|look|teach|count|calculate|draw|open|continue|carry|repeat|remind|add|update|fix|start|pick|choose|sort|walk|take|put|speak|talk|generate|create|build|plot|render|convert|turn)\b`, "i");
// The user speaking about this exchange, e.g. "I thought I mentioned the Bee Gees".
const FIRST_PERSON_RE = /^(?:i|we)\s+(?!think it is (?:raining|cold))/i;
const SECOND_PERSON_RE = /\b(?:you|your|you're|youre)\b/i;
const REQUEST_MARKER_RE = /\b(?:my request|my question|fulfil|fulfill|answer me|please)\b/i;
const CONTINUE_RE = /^(?:tell me|tell me about|tell me more|go on|continue|carry on|figure it out|do it|show me|give it to me)$/i;

const DEEPEN_RE = /^(?:go|dig) deeper\b|^(?:research|look into|follow up on)\b/i;
const COMPLAINT_RE = /^(?:still\s+)?(?:not good enough|that(?:'s| is) not good enough|that did not help|you did not answer|try again|improve (?:that|it))\b/i;
const ALL_RE = /\b(?:all|everything|the full picture|full details|complete(?:ly)?|comprehensive(?:ly)?)\b/i;
const SHOW_MAP_RE = /^(?:please\s+)?(?:(?:can|could|would|will)\s+you\s+)?(?:(?:draw|show|open|view|display)(?:\s+me)?|see|(?:let me|i\s+(?:want|need)\s+to)\s+see)\b.*\bmap\b/i;
const MAP_CAPABILITY_RE = /\b(?:can you see|did you (?:g?render|generate|make|create|copy)|do you (?:g?render|generate|make|create|copy)|just (?:produced|made|created|showed)|accurate|best you can do|3d|three-dimensional|zoom|google maps?|google earth|street view|independent maps?|links? (?:in|within|on|from))\b/i;
const MAP_REFERENCE_RE = /\b(?:map|it|that|this|one|you just (?:produced|made|created|showed))\b/i;
// "Give me a timeline of the TT races" wants a spoken chronology, not a
// reviewed canvas that costs a MOMM slot; a timeline is visual only when drawn.
const VISUAL_RE = /^(?:please\s+)?(?:(?:can|could|would|will)\s+you\s+)?(?:(?:draw|show|make|create|generate|render|plot|visuali[sz]e|give me)\b.*\b(?:chart|graph|diagram|visuali[sz]ation|image|picture|illustration)\b|(?:draw|plot|render|visuali[sz]e|chart)\b.*\btimeline\b)/i;
const RASTER_IMAGE_RE = /\b(?:photo(?:realistic)?|photograph|image|picture|illustration|painting)\b/i;
const QUICK_SOURCE_STRATEGIES = Object.freeze(["research"]);
const DEEP_RESEARCH_STRATEGIES = Object.freeze(["research", "adversarial", "cross_model", "lateral"]);

const MANX_MAP_HREF = "/manx-map.svg";
const MANX_EARTH_HREF = "https://britannica-atlas.marroccofella.chatgpt.site/manx/earth";

export const CAPABILITY_MANIFEST = Object.freeze({
  canInspectScreenPixels: false,
  artifacts: Object.freeze({
    "manx-map": Object.freeze({
      id: "manx-map",
      kind: "manx_map",
      title: "Isle of Man map",
      href: MANX_MAP_HREF,
      fullHref: MANX_EARTH_HREF,
      format: "svg",
      purpose: "diagrammatic orientation",
      provenance: "not recorded in the asset",
      navigationSafe: false,
    }),
  }),
  mapProviders: Object.freeze([
    Object.freeze({ id: "manx-earth", label: "MANX Earth", href: MANX_EARTH_HREF }),
    Object.freeze({ id: "iom-government", label: "Isle of Man Government maps", href: "https://www.gov.im/maps" }),
    Object.freeze({ id: "openstreetmap", label: "OpenStreetMap", href: "https://www.openstreetmap.org/search?query=Isle%20of%20Man" }),
    Object.freeze({ id: "google-maps", label: "Google Maps", href: "https://www.google.com/maps/search/?api=1&query=Isle+of+Man" }),
    Object.freeze({ id: "google-earth", label: "Google Earth", href: "https://earth.google.com/web?hl=en-GB" }),
  ]),
});

const FOREIGN_JURISDICTIONS = [
  ["Northern Ireland", /\bnorthern ireland\b/i],
  ["United Kingdom", /\b(?:united kingdom|(?:the )?uk|britain)\b/i],
  ["England", /\bengland\b/i],
  ["Scotland", /\bscotland\b/i],
  ["Wales", /\b(?<!prince of |princess of |new south )wales\b/i],
  ["Jersey", /\bjersey\b/i],
  ["Guernsey", /\bguernsey\b/i],
  ["Ireland", /\bireland\b/i],
  ["France", /\bfrance\b/i],
  ["Cyprus", /\b(?:cyprus|akrotiri|dhekelia)\b/i],
  ["Gibraltar", /\bgibraltar\b/i],
  ["Bermuda", /\bbermuda\b/i],
  ["Anguilla", /\banguilla\b/i],
  ["British Antarctic Territory", /\bbritish antarctic territory\b/i],
  ["British Indian Ocean Territory", /\b(?:british indian ocean territory|biot)\b/i],
  ["British Virgin Islands", /\b(?:british virgin islands|bvi)\b/i],
  ["Cayman Islands", /\b(?:cayman islands?|the caymans?)\b/i],
  ["Falkland Islands", /\b(?:falkland islands?|the falklands?)\b/i],
  ["Montserrat", /\bmontserrat\b/i],
  ["Pitcairn Islands", /\b(?:pitcairn islands?|pitcairn)\b/i],
  ["Saint Helena", /\b(?:saint|st\.?)\s+helena\b/i],
  ["Ascension Island", /\bascension island\b/i],
  ["Tristan da Cunha", /\btristan da cunha\b/i],
  ["South Georgia and the South Sandwich Islands", /\b(?:south georgia|south sandwich islands?)\b/i],
  ["Turks and Caicos Islands", /\b(?:turks and caicos islands?|tci)\b/i],
  ["United States", /\b(?:united states|usa|america)\b/i],
  ["Canada", /\bcanada\b/i],
  ["Australia", /\baustralia\b/i],
  ["New Zealand", /\bnew zealand\b/i],
  // A country the user names explicitly must never be silently answered as
  // Manx law. Anything not listed still trips the unknown-place guard below.
  ["United Arab Emirates", /\b(?:united arab emirates|uae|dubai|abu dhabi)\b/i],
  ["Germany", /\bgermany\b/i],
  ["France", /\bfrance\b/i],
  ["Spain", /\bspain\b/i],
  ["Portugal", /\bportugal\b/i],
  ["Italy", /\bitaly\b/i],
  ["Netherlands", /\bnetherlands\b/i],
  ["Belgium", /\bbelgium\b/i],
  ["Luxembourg", /\bluxembourg\b/i],
  ["Switzerland", /\bswitzerland\b/i],
  ["Austria", /\baustria\b/i],
  ["Denmark", /\bdenmark\b/i],
  ["Norway", /\bnorway\b/i],
  ["Sweden", /\bsweden\b/i],
  ["Finland", /\bfinland\b/i],
  ["Iceland", /\biceland\b/i],
  ["Poland", /\bpoland\b/i],
  ["Czechia", /\bczechia\b/i],
  ["Slovakia", /\bslovakia\b/i],
  ["Hungary", /\bhungary\b/i],
  ["Romania", /\bromania\b/i],
  ["Bulgaria", /\bbulgaria\b/i],
  ["Greece", /\bgreece\b/i],
  ["Turkey", /\bturkey\b/i],
  ["Croatia", /\bcroatia\b/i],
  ["Slovenia", /\bslovenia\b/i],
  ["Serbia", /\bserbia\b/i],
  ["Estonia", /\bestonia\b/i],
  ["Latvia", /\blatvia\b/i],
  ["Lithuania", /\blithuania\b/i],
  ["Ukraine", /\bukraine\b/i],
  ["Russia", /\brussia\b/i],
  ["Monaco", /\bmonaco\b/i],
  ["Liechtenstein", /\bliechtenstein\b/i],
  ["Malta", /\bmalta\b/i],
  ["Andorra", /\bandorra\b/i],
  ["San Marino", /\bsan\s+marino\b/i],
  ["China", /\bchina\b/i],
  ["Japan", /\bjapan\b/i],
  ["India", /\bindia\b/i],
  ["Pakistan", /\bpakistan\b/i],
  ["Bangladesh", /\bbangladesh\b/i],
  ["Singapore", /\bsingapore\b/i],
  ["Malaysia", /\bmalaysia\b/i],
  ["Indonesia", /\bindonesia\b/i],
  ["Thailand", /\bthailand\b/i],
  ["Vietnam", /\bvietnam\b/i],
  ["Philippines", /\bphilippines\b/i],
  ["South Korea", /\bsouth\s+korea\b/i],
  ["Hong Kong", /\bhong\s+kong\b/i],
  ["Taiwan", /\btaiwan\b/i],
  ["Israel", /\bisrael\b/i],
  ["Qatar", /\bqatar\b/i],
  ["Bahrain", /\bbahrain\b/i],
  ["Kuwait", /\bkuwait\b/i],
  ["Oman", /\boman\b/i],
  ["Saudi Arabia", /\bsaudi\s+arabia\b/i],
  ["Egypt", /\begypt\b/i],
  ["Morocco", /\bmorocco\b/i],
  ["Nigeria", /\bnigeria\b/i],
  ["Ghana", /\bghana\b/i],
  ["Kenya", /\bkenya\b/i],
  ["Tanzania", /\btanzania\b/i],
  ["Uganda", /\buganda\b/i],
  ["Zambia", /\bzambia\b/i],
  ["Zimbabwe", /\bzimbabwe\b/i],
  ["Botswana", /\bbotswana\b/i],
  ["Namibia", /\bnamibia\b/i],
  ["South Africa", /\bsouth\s+africa\b/i],
  ["Mauritius", /\bmauritius\b/i],
  ["Seychelles", /\bseychelles\b/i],
  ["Brazil", /\bbrazil\b/i],
  ["Argentina", /\bargentina\b/i],
  ["Chile", /\bchile\b/i],
  ["Mexico", /\bmexico\b/i],
  ["Panama", /\bpanama\b/i],
  ["Barbados", /\bbarbados\b/i],
  ["Bahamas", /\bbahamas\b/i],
  ["Jamaica", /\bjamaica\b/i],
  ["Trinidad and Tobago", /\btrinidad\s+and\s+tobago\b/i],
  ["Belize", /\bbelize\b/i],
  ["Costa Rica", /\bcosta\s+rica\b/i],
  ["Uruguay", /\buruguay\b/i],
  ["Colombia", /\bcolombia\b/i],
  ["Peru", /\bperu\b/i],
  ["Fiji", /\bfiji\b/i],
  ["Papua New Guinea", /\bpapua\s+new\s+guinea\b/i],
  ["Samoa", /\bsamoa\b/i],
  ["Tonga", /\btonga\b/i],
  ["Vanuatu", /\bvanuatu\b/i],
  ["Nauru", /\bnauru\b/i],
  ["Marshall Islands", /\bmarshall\s+islands\b/i],
  ["Liberia", /\bliberia\b/i],
  ["Cook Islands", /\bcook\s+islands\b/i],
  ["Greenland", /\bgreenland\b/i],
  ["Faroe Islands", /\bfaroe\s+islands\b/i],
  ["Isle of Wight", /\bisle\s+of\s+wight\b/i],
];

function now() { return Date.now(); }
function cleanSpaces(text) { return String(text || "").replace(/\s+/g, " ").trim(); }
function semanticKey(text) { return cleanSpaces(text).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
function titleSentence(text) { const s = cleanSpaces(text); return s ? s[0].toUpperCase() + s.slice(1) : s; }
function safeTurnId(value) { return value == null || value === "" ? null : String(value).slice(0, 100); }
function safeClientTurn(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}

export function createDialogueState(at = now()) {
  return {
    homeJurisdiction: DEFAULT_JURISDICTION,
    activeTopic: null,
    activeFacets: [],
    breadth: "overview",
    lastActionable: null,
    lastSubstantiveQuestion: null,
    lastSubstantiveTurn: null,
    lastArtifact: null,
    pendingAction: null,
    pendingQuestion: null,
    pendingQuestionSubject: null,
    recentUtterances: [],
    inFlightKey: null,
    lastCompletedKey: null,
    updatedAt: at,
  };
}

/** Context-bounded repairs for recurring speech-recognition errors. */
export function repairTranscript(raw, state = createDialogueState()) {
  const original = cleanSpaces(String(raw || ""));
  // URLs are opaque identifiers, not speech: case, underscores and query values matter.
  const urls=[];
  const protectedText=original.replace(/https?:\/\/[^\s<>"']+/gi,url=>`manninurltoken${urls.push(url)-1}end`);
  let text = protectedText.normalize("NFKC").toLowerCase().replace(/[=_]+/g, " ").replace(/[“”]/g, '"').replace(/[’]/g, "'");
  const repairs = [];
  const replace = (pattern, replacement, label) => {
    const next = text.replace(pattern, replacement);
    if (next !== text) { text = next; repairs.push(label); }
  };

  replace(/\bi\s+beed\s+to\b/g, "i need to", "beed → need");
  replace(/\b(?:infastructure\w*|infrastruture\w*|infrastucture\w*)\b/g, "infrastructure", "infastructure → infrastructure");
  replace(/\bcaoacity\b/g, "capacity", "caoacity → capacity");
  replace(/\bunfo\b/g, "info", "unfo → info");
  replace(/\b(?:todats|todays|todat's)\s+news\b/g, "today's news", "today's news");
  replace(/^nlw do you know thes things and what are you$/, "how do you know these things and what are you", "how do you know these things");

  // These are only safe in the grammatical contexts captured here. Never
  // rewrite the ordinary words "old" or names containing "render" globally.
  replace(/\bgo deeper on old you suggested\b/g, "go deeper on what you suggested", "old → what");
  if (state.lastArtifact?.kind === "manx_map" || /\bmap\b/i.test(original)) {
    replace(/\bgrender(?:ed)?\b/g, "render", "grender → render");
  }

  // "Mao" is a real name. Only repair it when grammar makes a map request clear.
  replace(/\b(draw|show|open|view)\s+(me\s+)?(a|the)\s+mao\b/g, "$1 $2$3 map", "mao → map");
  replace(/\bsee\s+(a|the)\s+mao\b/g, "see $1 map", "mao → map");

  const contextualAll = Boolean(state.activeTopic) || /\b(?:info|unfo)\b/i.test(original);
  if (contextualAll) replace(/\bakk\b/g, "all", "akk → all");
  if (Boolean(state.activeTopic) || /\b(?:all|akk|info|unfo)\b/i.test(original)) replace(/\bmanz\b/g, "manx", "manz → manx");

  text = cleanSpaces(text.replace(/\s+([?.!,])/g, "$1"));
  text = text.replace(/manninurltoken(\d+)end/g,(_,i)=>urls[Number(i)]);
  return { original, normalised: text, interpretedAs: repairs.length ? titleSentence(text) : null, repairs: [...new Set(repairs)] };
}

function infrastructureQuestion(breadth, jurisdiction = DEFAULT_JURISDICTION) {
  const lead = breadth === "comprehensive" ? "Give a comprehensive, practical account" : "Give a clear practical overview";
  return `${lead} of ${jurisdiction} infrastructure covering ${INFRASTRUCTURE_FACETS.join(", ")}, present capacity constraints, resilience, and any evidence gaps.`;
}

function manxOverviewQuestion() {
  return "Give a clear, comprehensive overview of the Isle of Man covering geography, government, law, companies, economy, infrastructure, transport, population, culture and environment.";
}

// Jurisdictions whose names are also ordinary words or products: "Jersey
// cows", "a TT jersey", "bone china", "an Iceland store", "turkey dinner".
const HOMONYM_JURISDICTIONS = new Set(["Jersey", "Guernsey", "Turkey", "China", "Iceland", "Chile", "Georgia", "Jordan", "Cook Islands"]);
const PLACE_BEFORE_RE = /\b(?:in|to|from|of|for|than|versus|vs|with|into|via|under|between|across|and|or|like|unlike|does|do|did|is|are|was|were|has|have|about|regarding|visit|visiting|reach|reaching)\s+(?:the\s+)?$/i;
const PLACE_AFTER_RE = /^\s*(?:$|[,.?!;:]|(?:or|and|versus|vs|than|is|are|was|were|has|have|does|do|did|will|would|could|can|itself|too|as well)\b)/i;
const COMMON_NOUN_AFTER_RE = /^\s+(?:cows?|cattle|breed|herd|milk|cream|butter|shirts?|tops?|kit|jumper|shop|store|supermarket|dinner|breast|sandwich|plates?|clay|bone|pepper|sauce|dumplings?|syndrome)\b/i;
function foreignJurisdiction(text, original = text) {
  // An explicit exclusion is not a positive jurisdiction request. Mask only
  // the excluded mention: a separate comparison or UK property fact still wins.
  const scopedText=text.replace(/\b(?:(?:do not|don't|never)\s+(?:import|apply|use)|without\s+(?:importing|applying|using))\s+(?:the\s+)?(?:uk|united kingdom|british)\s+(?:law|legislation|rules|code)\b/gi,' ');
  for (const [name, pattern] of FOREIGN_JURISDICTIONS) {
    const match = pattern.exec(scopedText);
    if (!match) continue;
    if (HOMONYM_JURISDICTIONS.has(name)) {
      // A homonym names a jurisdiction only when it is written as a proper
      // noun and sits where a place name sits, and is not followed by the
      // thing it is a brand or breed of.
      const capitalised = new RegExp(`\\b${name.replace(/\s+/g, "\\s+")}\\b`).test(String(original || ""));
      const before = scopedText.slice(0, match.index);
      const after = scopedText.slice(match.index + match[0].length);
      if (!capitalised || !(PLACE_BEFORE_RE.test(before) || PLACE_AFTER_RE.test(after)) || COMMON_NOUN_AFTER_RE.test(after)) continue;
    }
    return name;
  }
  return null;
}

/** The last few things the user actually said, kept even when Mannin queried them. */
function rememberUtterance(state, raw) {
  const text = cleanSpaces(raw).slice(0, 300);
  const previous = Array.isArray(state?.recentUtterances) ? state.recentUtterances : [];
  if (!text) return previous.slice(-6);
  return [...previous.filter((item) => item !== text), text].slice(-6);
}

function withState(base, patch = {}) { return { ...base, ...patch, updatedAt: now() }; }

function substantiveTurn(question, key, { turnId = null, clientTurn = null } = {}) {
  return { question, semanticKey: key, turnId: safeTurnId(turnId), clientTurn: safeClientTurn(clientTurn) };
}

function turnOrigin(turn, fallbackKey = null) {
  const semantic = String(turn?.semanticKey || fallbackKey || "").trim();
  if (!semantic) return null;
  return {
    kind: "turn",
    semanticKey: semantic,
    turnId: safeTurnId(turn?.turnId),
    clientTurn: safeClientTurn(turn?.clientTurn),
  };
}

function artifactOrigin(artifact, { turnId = null, clientTurn = null } = {}) {
  const artifactId = String(artifact?.id || "").trim();
  if (!artifactId) return null;
  return { kind: "artifact", artifactId, turnId: safeTurnId(turnId), clientTurn: safeClientTurn(clientTurn) };
}

function pendingMatchesState(pendingAction, state) {
  const origin = pendingAction?.origin;
  if (!origin || !pendingAction?.kind || !pendingAction?.subject) return false;
  if (origin.kind === "artifact") return Boolean(origin.artifactId && state.lastArtifact?.id === origin.artifactId);
  if (origin.kind !== "turn") return false;
  // Bound to a completed answer that is not the last substantive (Manx)
  // turn: it stands exactly until another answer completes.
  if (origin.completedTurn) return Boolean(origin.semanticKey) && origin.semanticKey === state.lastCompletedKey;
  const latest = state.lastSubstantiveTurn;
  if (!latest || !origin.semanticKey || origin.semanticKey !== latest.semanticKey || origin.semanticKey !== state.lastCompletedKey) return false;
  if (origin.turnId != null && origin.turnId !== latest.turnId) return false;
  if (origin.clientTurn != null && origin.clientTurn !== latest.clientTurn) return false;
  return true;
}

function closePendingAction(action, state, completedKey = null) {
  if (action == null) return null;
  if (!action || !["research", "open_full_map", "repair_answer", "open_page"].includes(action.kind)) return null;
  if (action.kind==='open_page' && !approvedPage(action.target)) return null;
  const subject = cleanSpaces(action.subject);
  if (!subject) return null;
  const base = {
    kind: action.kind,
    subject,
    status: cleanSpaces(action.status || (action.kind === "repair_answer" ? "needs_detail" : "offered")),
  };
  if (action.label) base.label = cleanSpaces(action.label);
  if (action.kind==='open_page') base.target=action.target;
  if (action.researchMode) base.researchMode = action.researchMode;
  if(action.kind==='research' && typeof action.reviewTarget==='string' && /^(?:research:)?[a-z0-9_.:-]{3,100}$/i.test(action.reviewTarget))base.reviewTarget=action.reviewTarget;
  if (action.jurisdiction) base.jurisdiction = cleanSpaces(action.jurisdiction);
  if (action.id) base.id = String(action.id).slice(0, 100);
  if (action.href && action.kind === "open_full_map") base.href = String(action.href);
  // An offer made on the answer that just completed binds to that answer.
  // A foreign-only answer never becomes the "last substantive turn" (so "go
  // deeper" cannot arm research on an older Manx subject), which used to
  // leave its own offer stale on arrival and "yes" refused.
  const origin = action.kind === "open_full_map"
    ? artifactOrigin(state.lastArtifact, action.origin || {})
    : completedKey && state.lastSubstantiveTurn?.semanticKey !== completedKey
      ? { ...turnOrigin(null, completedKey), completedTurn: true }
      : turnOrigin(state.lastSubstantiveTurn, completedKey);
  return origin ? { ...base, origin } : null;
}

function manxMapArtifact() {
  return { ...CAPABILITY_MANIFEST.artifacts["manx-map"] };
}

function pendingRoute({ pendingAction, state, raw, repaired }) {
  if (!pendingMatchesState(pendingAction, state)) return null;
  if (pendingAction.kind==='open_page' && approvedPage(pendingAction.target)) {
    if(!(completeAssent(raw)&&!/\b(?:research|check|sources)\b/i.test(raw))&&!/^(?:please )?(?:open|show)(?: me)? (?:it|that|the page)[.!?]*$/i.test(raw.trim()))return null;
    return {route:'action',intent:'open_page',conversationMeta:true,raw,canonical:pendingAction.subject,jurisdiction:DEFAULT_JURISDICTION,
      speech:'The official weather link is below. I’ll try to open it in a new tab; if your browser blocks that, tap the link.',
      action:{kind:'open_page',target:pendingAction.target},state:withState(state,{lastOperation:{kind:'open_page'},pendingAction:null,pendingQuestion:null})};
  }
  const requestedKind = /\b(?:research|check|sources?)\b/i.test(raw)
    ? "research"
    : /\b(?:map|earth|three-dimensional|3d)\b/i.test(raw)
      ? "open_full_map"
      : null;
  if (requestedKind && pendingAction.kind !== requestedKind) return null;
  const canonical = String(pendingAction?.subject || state.lastSubstantiveQuestion || state.lastActionable || "").trim();
  if (!canonical) return null;
  const key = semanticKey(canonical);
  if (pendingAction.kind === "research") {
    const underway = ["queued", "running", "in_progress"].includes(pendingAction.status);
    const deep = DEEPEN_RE.test(String(raw || "").replace(/[?.!,]+$/g, "").trim());
    const mode=deep?'deep':/official Manx sources/i.test(raw)?'official_sources':pendingAction.researchMode || sourceMode(canonical);
    return {
      route: underway ? "ack" : "research",
      raw,
      canonical,
      jurisdiction: pendingAction.jurisdiction || DEFAULT_JURISDICTION,
      interpretedAs: repaired.interpretedAs,
      semanticKey: key,
      pendingAction,
      researchMode: mode,
      strategies: [...(deep ? DEEP_RESEARCH_STRATEGIES : QUICK_SOURCE_STRATEGIES)],
      speech: underway
        ? "That research check is already under way. I’ll tell you when it is ready."
        : deep
          ? `Right. I’ll run the full research, adversarial, lateral and multi-model check on ${pendingAction.label || "that Isle of Man subject"}. I’ll show each stage here.`
          : mode!=='official_sources' ? "I’m checking relevant sources for that question. The result will return here." : "Right. I’m checking official Manx sources now. The first sourced answer will return here as soon as that pass finishes.",
      state: underway || mode!=='live_sources' ? withState(state) : withState(state,{conversationTopic:null,lastAnswerSubject:canonical,lastAnswerJurisdiction:pendingAction.jurisdiction || DEFAULT_JURISDICTION,lastActionable:canonical,lastSubstantiveQuestion:canonical,lastSubstantiveTurn:substantiveTurn(canonical,key),pendingQuestion:null,pendingQuestionSubject:null}),
    };
  }
  if (pendingAction.kind === "open_full_map") {
    return {
      route: "action",
      raw,
      canonical,
      jurisdiction: DEFAULT_JURISDICTION,
      interpretedAs: repaired.interpretedAs,
      semanticKey: key,
      pendingAction,
      speech: "The fuller MANX Earth and Street View option is ready below.",
      action: { kind: "open_full_map", title: "MANX Earth & Street View", href: pendingAction.href || MANX_EARTH_HREF },
      state: withState(state),
    };
  }
  return null;
}

const boundedCase=(value,max)=>value.length<=max?value:value.slice(0,Math.floor(max*.4))+' … '+value.slice(-Math.floor(max*.6)+3);
function answerRoute({ canonical, state, raw, repaired, jurisdiction = DEFAULT_JURISDICTION, topic = state.activeTopic, facets = state.activeFacets, breadth = state.breadth, persistContext = jurisdiction === DEFAULT_JURISDICTION, turnId = null, clientTurn = null, caseContext=null }) {
  const key = semanticKey(canonical);
  if (state.inFlightKey && state.inFlightKey === key) {
    return {
      route: "ack",
      raw,
      canonical,
      jurisdiction,
      interpretedAs: repaired.interpretedAs,
      semanticKey: key,
      speech: `I’m already working on that ${topic === "infrastructure" ? "Isle of Man infrastructure account" : "answer"}.`,
      state: withState(state),
    };
  }
  state={...state,lastOperation:null,lastAnswerSubject:boundedCase(canonical,1800),lastAnswerJurisdiction:jurisdiction,lastCaseBase:caseContext?.base||boundedCase(canonical,600),lastCaseFollowups:caseContext?.followups||[]};
  return {
    route: "answer",
    raw,
    canonical,
    jurisdiction,
    interpretedAs: repaired.interpretedAs,
    semanticKey: key,
    state: persistContext
      ? withState(state, { conversationTopic:null, pendingQuestion:null, pendingQuestionSubject:null, activeTopic: topic, activeFacets: facets, breadth, lastActionable: canonical, lastSubstantiveQuestion: canonical, lastSubstantiveTurn: substantiveTurn(canonical, key, { turnId, clientTurn }), pendingAction: null })
      // A foreign-only turn must not lend its completion key to an old Manx
      // subject. Cross-border Manx turns retain their own eligible identity.
      : withState(state, { pendingAction: null, ...(manxReviewScope(jurisdiction)?{lastSubstantiveTurn:substantiveTurn(canonical,key,{turnId,clientTurn})}:{}) }),
  };
}

/** Resolve a raw utterance into a semantic request before search or model use. */
/**
 * How the request reached Mannin. Typed text is deliberate, so nothing may be
 * attributed to mishearing; blaming speech recognition for a typed question
 * reads as the product making excuses for itself.
 */
export function resolveDialogue(raw, previous = createDialogueState(), options = {}) {
  const inputSource = options.source === "speech" ? "speech" : "typed";
  const restatement=restatedRequest(raw,previous);
  const result = resolveDialogueInner(restatement?.question||raw, previous, options);
  if(restatement)result.raw=String(raw);
  if(result.route==='answer'&&!result.conversationMeta&&!result.reasoningRequest)result.state={...result.state,reasoningSubject:null};
  // One spend gate for every branch that launches paid research from speech:
  // doubtful or unmeasured recognition is read back first. "Go deeper" heard
  // at 0.5 was launching the four-route pass while "yes" at 0.5 was queried.
  const confidence = Number(options.recognitionConfidence);
  if (result.route === "research" && inputSource === "speech" && options.confirmed !== true && (!Number.isFinite(confidence) || confidence < 0.55)) {
    const state = { ...createDialogueState(), ...(previous || {}) };
    return { route: "clarify", intent: "clarification", conversationMeta: true, inputSource, raw: String(raw || ""), canonical: null, jurisdiction: DEFAULT_JURISDICTION,
      speech: `Did you mean “${String(raw || "").trim()}”? Please repeat or confirm it before I start a source check.`,
      state: withState(state, { recentUtterances: rememberUtterance(state, String(raw || "")) }) };
  }
  return { ...result, inputSource, intent: result.intent || (result.conversationMeta ? "recap" : answerIntent(raw)) };
}

/** Restore a server-owned offer atomically; never reinterpret it against a newer topic. */
export function resolveSavedOffer(selected,state,options={}) {
  const repaired={original:selected.subject,interpretedAs:null};
  return answerRoute({canonical:selected.subject,state,raw:selected.subject,repaired,jurisdiction:selected.jurisdiction||DEFAULT_JURISDICTION,...options});
}

function resolveDialogueInner(raw, previous = createDialogueState(), { source = "typed", recognitionConfidence = null, confirmed = false, turnId = null, clientTurn = null } = {}) {
  let state = { ...createDialogueState(), ...(previous || {}) };
  const repaired = repairTranscript(raw, state);
  const text = repaired.normalised;
  // "Douglas", "Peel", "the Island" place a question on the Isle of Man as
  // surely as naming it; without this, "ferries from Douglas to Ireland" was
  // answered for Ireland with the Manx ledger switched off.
  const hasManx = isManxText(text) || isManxPlaceText(text) || /\bthe island\b/i.test(text);
  const historyRelation=Boolean(state.lastSubstantiveQuestion)&&isManxText(state.lastSubstantiveQuestion)&&/\b(?:separat\w*|land[ -]?bridg\w*)\b/i.test(text)&&/\b(?:what did you mean|that|the island|from England|from Britain)\b/i.test(text)&&!/\b(?:new topic|instead)\b/i.test(text);
  const foreign = historyRelation?null:foreignJurisdiction(text, repaired.original);
  const explicitReferent=Boolean(state.lastAnswerSubject) && /\b(?:that|this|the same|that same) (?:company|property|case|structure|business)\b/i.test(text) && !/\bnew topic\b/i.test(text);
  const jurisdiction = explicitReferent
    ? (hasManx || isManxText(state.lastAnswerSubject) ? (foreign ? `${DEFAULT_JURISDICTION} and ${foreign}` : state.lastAnswerJurisdiction) : foreign || state.lastAnswerJurisdiction)
    : hasManx && foreign ? `${DEFAULT_JURISDICTION} and ${foreign}` : foreign || DEFAULT_JURISDICTION;
  const hasAll = ALL_RE.test(text) || /\ball\s+(?:info|information)\b/i.test(text);
  const expandTopic=broadeningRequest(text);
  // Only a broad request gets the infrastructure overview. "Who runs Manx
  // Utilities?" and "how much does Manx Utilities charge per unit?" are
  // questions of their own and were being replaced by the overview wholesale.
  const hasInfrastructure = /\b(?:infrastructure|utilities|essential services)\b/i.test(text)
    && text.split(/\s+/).length <= 8
    && !/\b(?:manx utilities|utilities authority|who|whom|how much|how many|charge|charges|price|prices|rate|rates|cost|costs|bill|bills|tariff|run|runs|own|owns|when|where|contact|phone|number|per unit|per kwh|kwh|meter)\b/i.test(text);
  const continueIntent = CONTINUE_RE.test(text.replace(/[?.!,]+$/g, "").trim());
  const affirmativeIntent = completeAssent(text) || /^(?:use (?:that|the|your) suggestion)[.!?]*$/i.test(text);
  const deepenIntent = DEEPEN_RE.test(text.replace(/[?.!,]+$/g, "").trim());
  const complaintIntent = COMPLAINT_RE.test(text.replace(/[?.!,]+$/g, "").trim());
  const mapArtifact = state.lastArtifact?.kind === "manx_map" ? state.lastArtifact : null;
  const mapCapabilityIntent = MAP_CAPABILITY_RE.test(text) && (/\bmap\b/i.test(text) || (mapArtifact && MAP_REFERENCE_RE.test(text)));
  const showMapIntent = SHOW_MAP_RE.test(text);
  const visualIntent = VISUAL_RE.test(text);
  const confidence = recognitionConfidence == null ? null : Number(recognitionConfidence);
  const lowConfidenceSpeech = source === "speech" && Number.isFinite(confidence) && confidence < 0.45 && !repaired.repairs.length;
  const bare = text.replace(/[?.!,]+$/g, "").trim();
  const pendingCountry = state.pendingQuestion && /\b(?:country|countries|resident|residence)\b/i.test(state.pendingQuestion);
  const topicEcho = Boolean(state.lastSubstantiveQuestion) && bare.split(/\s+/).length <= 4
    && bare.length >= 3 && state.lastSubstantiveQuestion.toLowerCase().replace(/^answer this (?:specifically )?for (?:the )?isle of man:\s*/, "").includes(bare)
    && !/^(?:yes|no|your idea|sounds good|i have|the island|island)$/.test(bare);
  // Clarification replies carry context but never authorize a research offer.
  if (!lowConfidenceSpeech || confirmed) {
    if(knowledgeOnlyQuestion(repaired.original))return {route:'knowledge_info',intent:'product',conversationMeta:true,raw:repaired.original,canonical:null,jurisdiction:DEFAULT_JURISDICTION,state:withState(state),preservePendingAction:true,preservePendingQuestion:true};
    const retryKnown=pendingMatchesState(state.pendingAction,state)&&state.pendingAction.kind==='research'&&(deliveryRetry(repaired.original)||/^(?:tell[.! ]+)?tell me[.!?]*$/i.test(text));
    if((affirmativeIntent&&!(state.pendingQuestion&&!state.pendingAction))||retryKnown){
      if(source==='speech'&&!confirmed&&Number.isFinite(confidence)&&confidence<.55)return {route:'clarify',raw:repaired.original,canonical:null,jurisdiction:DEFAULT_JURISDICTION,speech:'Please confirm the action before I start it.',state};
      const pending=pendingRoute({pendingAction:state.pendingAction,state,raw:retryKnown?'go ahead':repaired.original,repaired});
      if(pending)return {...pending,raw:repaired.original};
      if(affirmativeIntent)return {route:'clarify',raw:repaired.original,canonical:null,jurisdiction:DEFAULT_JURISDICTION,speech:'I do not have a pending suggestion to act on. Tell me what you want me to do next.',state:withState(state,{pendingAction:null})};
    }
    let command=interactionCommand(repaired.original);
    if(state.pendingAction?.kind==='open_page' && /^(?:yes\b|please do\b|go ahead\b|do (?:it|that)\b|open\b|show\b)/i.test(text) && source==='speech' && !confirmed && Number.isFinite(confidence) && confidence<.55)return {route:'clarify',conversationMeta:true,raw:repaired.original,canonical:null,jurisdiction:DEFAULT_JURISDICTION,speech:'Did you want me to open the weather page? Please repeat or confirm that.',state};
    if(command && source==='speech' && !confirmed && Number.isFinite(confidence) && confidence<.55)return {route:'clarify',intent:'clarification',conversationMeta:true,raw:repaired.original,canonical:null,jurisdiction:DEFAULT_JURISDICTION,speech:`Did you mean “${repaired.original}”? Please repeat or confirm it before I start an action.`,state};
    if(command?.offerCheck&&state.pendingAction?.kind==='research'&&pendingMatchesState(state.pendingAction,state)){const pending=pendingRoute({pendingAction:state.pendingAction,state,raw:repaired.original,repaired});if(pending)return pending;}
    if(command?.kind==='knowledge_integrity')return {route:'knowledge_integrity',intent:'product',conversationMeta:true,raw:repaired.original,canonical:null,jurisdiction:DEFAULT_JURISDICTION,state:withState(state),preservePendingAction:true,preservePendingQuestion:true};
    if(command?.kind==='runtime_info')return {route:'runtime_info',intent:'product',conversationMeta:true,raw:repaired.original,canonical:null,jurisdiction:DEFAULT_JURISDICTION,state:withState(state),preservePendingAction:true,preservePendingQuestion:true};
    if(command?.kind==='resume'){
      if(state.lastOperation?.kind!=='review'&&state.pendingAction?.origin&&!pendingMatchesState(state.pendingAction,state))return {route:'clarify',intent:'clarification',conversationMeta:true,raw:repaired.original,canonical:null,speech:'That offer belongs to an earlier task. Tell me which current task you want to continue.',jurisdiction:DEFAULT_JURISDICTION,state};
      if(!state.pendingAction&&!state.lastSubstantiveQuestion&&state.lastOperation?.kind!=='review')return {route:'clarify',intent:'clarification',conversationMeta:true,raw:repaired.original,canonical:null,speech:'I do not have a task to retry yet. Tell me what you want me to do.',jurisdiction:DEFAULT_JURISDICTION,state};
      if(!state.pendingAction&&/^do (?:it|that)[.!?]*$/i.test(text))command=null;
      else if(state.pendingAction?.kind==='open_page'){command=null;state=withState(state,{lastOperation:null});}
      else if(state.lastOperation?.kind==='review')command={kind:'review',scope:state.lastOperation.scope,retry:true};
      else if(state.pendingAction?.kind==='research')command={kind:'search',subject:'that',live:true};
      else if(!['open_page','dismissed'].includes(state.lastOperation?.kind)&&!state.conversationTopic&&state.lastSubstantiveQuestion)command={kind:'search',subject:'that',live:true};
      else command=null;
    }
    if(command?.kind==='both'){
      const pending=state.pendingAction;
      if(!pendingMatchesState(pending,state)||pending.kind!=='research')return {route:'clarify',intent:'clarification',conversationMeta:true,raw:repaired.original,canonical:null,speech:'Which two actions do you mean? You can ask me to search a public subject and use MOMM to review the answer or assess the unfinished task.',jurisdiction:DEFAULT_JURISDICTION,state};
      command={kind:'search',subject:'that',live:true,review:true,scope:pending.reviewTarget?'answer':'conversation',reviewTarget:pending.reviewTarget,followup:command.followup};
    }
    if(command?.kind==='review')return {route:'review',intent:'review',preservePendingAction:true,preservePendingQuestion:true,reviewScope:command.scope||'answer',reviewRetry:Boolean(command.retry),reviewTarget:command.retry?state.lastReviewTarget||state.lastOperation?.target||null:null,raw:repaired.original,canonical:null,jurisdiction:DEFAULT_JURISDICTION,conversationMeta:true,
      state:withState(state,{lastOperation:{kind:'review',scope:command.scope||'answer',...(command.retry&&state.lastOperation?.target?{target:state.lastOperation.target}:{})},recentUtterances:rememberUtterance(state,repaired.original)})};
    if(command?.kind==='readback')return {route:'readback',intent:'readback',readbackTarget:command.target,raw:repaired.original,canonical:null,jurisdiction:DEFAULT_JURISDICTION,conversationMeta:true,state:withState(state)};
    if(command?.kind==='open_page')return {route:'action',intent:'open_page',raw:repaired.original,canonical:null,jurisdiction:DEFAULT_JURISDICTION,conversationMeta:true,
      speech:'The official weather link is below. I’ll try to open it in a new tab; if your browser blocks that, tap the link.',action:command,state:withState(state,{lastOperation:{kind:'open_page'},pendingAction:null,pendingQuestion:null})};
    if(command?.kind==='recap')return {...answerRoute({canonical:`Reconcile our recorded conversation and saved research: ${repaired.original}. Identify the active subject, what was already answered, and what is still missing. Do not claim finished research is pending or turn dialogue into verified evidence.`,state,raw:repaired.original,repaired,persistContext:false,turnId,clientTurn}),state:withState(state),conversationMeta:true,intent:'recap',reviewRequested:Boolean(command.review),reviewAfterSearch:Boolean(command.review),preservePendingQuestion:true,preservePendingAction:true};
    if(currentWeatherQuestion(repaired.original)){
      const base=answerRoute({canonical:'Current weather forecast for the Isle of Man',state,raw:repaired.original,repaired,turnId,clientTurn});
      return {...base,route:'weather',intent:'weather',state:withState(base.state,{researchFocusId:null})};
    }
    if(/^(?:no(?: thanks)?|not now|cancel that|never mind)[.!?]*$/i.test(text))return {route:'conversation',intent:'dismiss',conversationMeta:true,raw:repaired.original,canonical:null,jurisdiction:DEFAULT_JURISDICTION,speech:'Okay, I won’t act on that suggestion.',state:withState(state,{lastOperation:{kind:'dismissed'},pendingAction:null,pendingQuestion:null})};
    if(/^(?:please\s+)?(?:open|show)(?: me)? (?:it|that|the page)[.!?]*$/i.test(text) && state.pendingAction?.kind==='open_page') {
      const next=pendingRoute({pendingAction:state.pendingAction,state,raw:repaired.original,repaired});if(next)return next;
    }
    if(clockQuestion(repaired.original))return {route:'conversation',intent:'clock',conversationMeta:true,raw:repaired.original,canonical:null,jurisdiction:DEFAULT_JURISDICTION,
      speech:`In the Isle of Man, it is ${islandClock()}.`,state:withState(state,{pendingAction:null,pendingQuestion:null,researchFocusId:null})};
    if(command?.kind==='search'){
      const referential=/^(?:it|this|that|(?:that|this|the last) (?:answer|result)|the sources|sources|the answers|answers|the evidence|evidence|the references|references)$/i.test(command.subject);
      let subject=referential?(state.pendingAction?.kind==='research'?state.pendingAction.subject:state.lastAnswerSubject || state.lastSubstantiveQuestion):command.subject;
      if(!subject||(referential&&state.conversationTopic&&!pendingMatchesState(state.pendingAction,state)))return {route:'clarify',conversationMeta:true,raw:repaired.original,canonical:null,speech:'What factual subject would you like me to search for?',jurisdiction:DEFAULT_JURISDICTION,state};
      if(command.followup&&referential)subject=boundedCase(subject+' Follow-up: '+command.followup,1800);
      const searchJurisdiction=referential ? state.pendingAction?.jurisdiction || state.lastAnswerJurisdiction || DEFAULT_JURISDICTION : jurisdiction;
      const base=answerRoute({canonical:subject,state,raw:repaired.original,repaired,jurisdiction:searchJurisdiction,turnId,clientTurn});
      const mode=command.official?'official_sources':command.live?'live_sources':((referential&&state.pendingAction?.researchMode) || sourceMode(subject));
      return {...base,state:withState(base.state,{lastOperation:{kind:'search'}}),route:'research',researchMode:mode,reviewRequested:Boolean(command.review),reviewAfterSearch:Boolean(command.reviewAfterSearch),reviewScope:command.scope||'answer',reviewTarget:command.reviewTarget||null,strategies:['research'],speech:mode!=='official_sources'?'I’m checking relevant sources for that question.':'I’m checking official Manx sources for that question.',pendingAction:{kind:'research',subject,jurisdiction:searchJurisdiction,researchMode:mode,status:'offered'}};
    }
    if(command?.kind==='learn'){
      // "Learn about X" is the user directing the ledger's growth: the full
      // research pass, queued as an expedition the way "go deeper" is, but
      // named up front. The brief is phrased as the researchable question the
      // spend gate expects, so a bare subject is not refused as unfinished.
      const referential=/^(?:it|this|that|the same|that subject|this subject|that topic|this topic)$/i.test(command.subject);
      const pending=state.pendingAction;
      const learningLabel=pending?.label && pending.subject===buildOutQuestion(boundedCase(pending.label,600),pending.jurisdiction||DEFAULT_JURISDICTION)?pending.label:null;
      const subject=referential?(pending?.kind==='research'?(learningLabel||pending.subject):state.lastAnswerSubject || state.lastSubstantiveQuestion):command.subject;
      if(!subject||(referential&&state.conversationTopic&&!pendingMatchesState(state.pendingAction,state)))return {route:'clarify',conversationMeta:true,raw:repaired.original,canonical:null,jurisdiction:DEFAULT_JURISDICTION,speech:'Which public factual subject would you like me to build the ledger out on?',state};
      const learningJurisdiction=referential?((state.pendingAction?.kind==='research'?state.pendingAction.jurisdiction:null)||state.lastAnswerJurisdiction||jurisdiction):jurisdiction;
      const brief=buildOutQuestion(boundedCase(subject,600),learningJurisdiction);
      const base=answerRoute({canonical:brief,state,raw:repaired.original,repaired,jurisdiction:learningJurisdiction,turnId,clientTurn});
      return {...base,route:'research',intent:'learn',researchMode:'deep',strategies:[...DEEP_RESEARCH_STRATEGIES],reviewRequested:false,reviewTarget:null,
        speech:`Right. I’ll build out the ledger on ${subject}: official ${learningJurisdiction} sources first, then the adversarial twin, a cross-model check and lateral leads. Only sourced findings are stored, each with its evidence, and I’ll show each stage here.`,
        pendingAction:{kind:'research',subject:brief,label:subject,jurisdiction:learningJurisdiction,researchMode:'deep',status:'offered'}};
    }
    if(command?.kind==='knowledge_map'){
      // Answered by the server from the ledger itself; no model call.
      return {route:'knowledge_map',intent:'knowledge_map',conversationMeta:true,raw:repaired.original,canonical:command.subject||null,subject:command.subject||null,jurisdiction:DEFAULT_JURISDICTION,
        state:withState(state,{recentUtterances:rememberUtterance(state,repaired.original)}),preservePendingAction:true,preservePendingQuestion:true};
    }
    const reasoning=reasoningRequest(repaired.original,state);
    if(reasoning){
      const canonical=reasoning.needsEvidence?reasoning.target:'Evaluate this task using a Socratic reasoning check: '+reasoning.target;
      const base=answerRoute({canonical,state,raw:repaired.original,repaired,jurisdiction,turnId,clientTurn,persistContext:reasoning.needsEvidence});
      return {...base,intent:'reasoning',reasoningRequest:reasoning,conversationMeta:!reasoning.needsEvidence,
        state:withState(base.state,{reasoningSubject:reasoning.target,pendingAction:null,pendingQuestion:null,pendingQuestionSubject:null,conversationTopic:'reasoning'})};
    }
    const capability=capabilityRequest(repaired.original);
    if(capability?.mode==='explain'){
      const base=answerRoute({canonical:repaired.original,state,raw:repaired.original,repaired,turnId,clientTurn});
      const pendingAction=capability.subject?{kind:'research',subject:capability.subject,label:capability.label,jurisdiction:DEFAULT_JURISDICTION,researchMode:'live_sources',status:'offered'}:null;
      return {...base,intent:'product',conversationMeta:true,localSpeech:capability.text,pendingAction,
        nextSteps:pendingAction?[{...pendingAction,reviewAvailable:false}]:[],
        state:withState(base.state,{conversationTopic:'capabilities',researchFocusId:null})};
    }
    if(conversationRepairQuestion(repaired.original)){
      const base=answerRoute({canonical:repaired.original,state,raw:repaired.original,repaired,persistContext:false,turnId,clientTurn});
      return {...base,conversationMeta:true,intent:'self_assessment',performanceComparison:conversationPerformanceQuestion(repaired.original),state:withState(state),preservePendingAction:true,preservePendingQuestion:true};
    }
    const local = localConversation(text, {source,topic:state.conversationTopic});
    if (local) return {
      route:"conversation", intent:local.intent, conversationMeta:true,
      raw:repaired.original, canonical:null, jurisdiction:DEFAULT_JURISDICTION,
      interpretedAs:repaired.interpretedAs, speech:local.text,
      state:withState(state,{conversationTopic:local.topic,lastAnswerSubject:null,lastAnswerJurisdiction:null,pendingAction:null,pendingQuestion:null,pendingQuestionSubject:null,recentUtterances:rememberUtterance(state,repaired.original)}),
    };
    const everyday=ordinaryConversation(text,{topic:state.conversationTopic,hasFactualTopic:Boolean(state.lastSubstantiveQuestion)});
    if(everyday) return {
      ...answerRoute({canonical:repaired.original,state:{...state,pendingAction:null,pendingQuestion:null,pendingQuestionSubject:null},raw:repaired.original,repaired,persistContext:false,turnId,clientTurn}),
      conversationMeta:true,intent:everyday,
      state:withState(state,{conversationTopic:everyday,lastAnswerSubject:null,lastAnswerJurisdiction:null,lastSubstantiveQuestion:repaired.original,lastActionable:repaired.original,pendingAction:null,pendingQuestion:null,pendingQuestionSubject:null,researchFocusId:null,recentUtterances:rememberUtterance(state,repaired.original)}),
    };
    if (unfinishedRequest(text)) return {
      route:"clarify", intent:"unintelligible", conversationMeta:true,
      raw:repaired.original, canonical:null, jurisdiction:DEFAULT_JURISDICTION,
      interpretedAs:repaired.interpretedAs,
      speech:bare==="what about" ? "What would you like to know about that?" : bare==="what's the official" ? "Do you mean the official source for that answer?" : "Could you finish that question?",
      state:withState(state,{conversationTopic:null,pendingAction:null,recentUtterances:rememberUtterance(state,repaired.original)}),
    };
    if (/^(?:(?:tell me about|summari[sz]e|recap) (?:this|our|the) (?:conversation|chat)|what (?:have we|did we) (?:discuss|discussed|talk about))[?.!]*$/i.test(text)) {
      return {...answerRoute({canonical:`Summarise our recorded conversation in response to: ${repaired.original}. Use conversation memory, not web research.`,state,raw:repaired.original,repaired,persistContext:false,turnId,clientTurn}),state:withState(state),conversationMeta:true,preservePendingQuestion:true,preservePendingAction:true};
    }
    if (state.lastSubstantiveQuestion && /\b(?:you asked|you said|keeping context|keep(?:ing)? (?:the )?(?:chat|conversation)|remember (?:what|when))\b/i.test(text)) {
      const base=answerRoute({canonical:`Respond to this follow-up about our conversation: ${repaired.original}. Consult the recorded exchange and any question you asked; acknowledge and repair missing context.`,state,raw:repaired.original,repaired,persistContext:false,turnId,clientTurn});
      return {...base,conversationMeta:true,state:state.pendingAction?withState(state):base.state,preservePendingAction:true,preservePendingQuestion:true};
    }
    if (pendingCountry && /^(?:island|highland)(?: in context to)?$/.test(bare)) {
      return { route:"clarify", raw:repaired.original, canonical:null, jurisdiction:DEFAULT_JURISDICTION,
        interpretedAs:null, speech:`My question was: “${state.pendingQuestion}” Did you mean Ireland? Please say or type the country name.`,
        state:withState(state,{recentUtterances:rememberUtterance(state,repaired.original)}) };
    }
    if (pendingCountry && foreign && bare.split(/\s+/).length <= 5 && !REQUEST_RE.test(text)) {
      return answerRoute({ canonical:`Continue this request: ${state.pendingQuestionSubject || state.lastSubstantiveQuestion}. The user answers your question (${state.pendingQuestion}) with: ${repaired.original}. Keep the Isle of Man connection and distinguish ${foreign}'s rules.`,
        state:{...state,pendingQuestion:null,pendingQuestionSubject:null},raw:repaired.original,repaired,
        jurisdiction:`${DEFAULT_JURISDICTION} and ${foreign}`,persistContext:false,turnId,clientTurn });
    }
    if (topicEcho) return answerRoute({canonical:`Continue the earlier request: ${state.lastSubstantiveQuestion}. The user is referring back to: ${repaired.original}. Use the conversation and any unanswered clarification before proceeding.`,state,raw:repaired.original,repaired,persistContext:false,turnId,clientTurn});
    // A short turn is a reply to Mannin's question only when it reads like
    // one: an assent, a choice, or words taken from the question itself. A new
    // subject ("Manx cat colours") is a new subject, however short.
    const replyToPending = Boolean(state.pendingQuestion) && !state.pendingAction && Boolean(bare) && !REQUEST_RE.test(text) && !deepenIntent && !continueIntent && !complaintIntent && (
      /^(?:yes|yeah|yep|no|nope|yes please|no thanks|both|neither|either|the (?:first|second|third|latter|former)(?: one)?)\b/i.test(bare)
      || (bare.split(/\s+/).length <= 6 && !isManxText(bare) && !isManxPlaceText(bare)
        && (Boolean(foreign) || bare.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length >= 4).every((word) => state.pendingQuestion.toLowerCase().includes(word)))));
    if (replyToPending) {
      return answerRoute({canonical:`For the request ${state.pendingQuestionSubject || state.lastSubstantiveQuestion}, the user answers your question (${state.pendingQuestion}) with: ${repaired.original}. Interpret it in context; clarify if ambiguous.`,state:{...state,pendingQuestion:null,pendingQuestionSubject:null},raw:repaired.original,repaired,persistContext:false,turnId,clientTurn});
    }
  }
  const addressedRequest = REQUEST_RE.test(text) || /\?$/.test(text) || continueIntent || showMapIntent || mapCapabilityIntent || visualIntent
    || (affirmativeIntent && Boolean(state.pendingAction)) || (deepenIntent && Boolean(state.pendingAction || state.lastSubstantiveQuestion))
    || (complaintIntent && Boolean(state.pendingAction || state.lastSubstantiveQuestion)) || (hasAll && Boolean(state.activeTopic));
  // A request does not have to open with a question word to be addressed to
  // Mannin. Refusing "Sing a song by the Bee Gees", "Fulfil my request" and "I
  // thought I mentioned the Bee Gees" made the product obstructive, and because
  // refusals were never remembered it then denied the Bee Gees had been raised
  // at all. Only genuinely doubtful speech is queried now: poor recognition
  // confidence, or a fragment too short to carry a request. Answering is cheap;
  // the spend gates that matter sit on research and review, not here.
  // What separates a request from overheard television is grammatical person
  // and mood, not length. An imperative, a second-person phrasing, a
  // first-person remark about this exchange or an explicit request marker is
  // addressed to Mannin; a third-person declarative about the world is not.
  // Second person alone is not enough: "your idea" is a loose affirmation, and
  // treating it as a request would let it spend a pending paid offer.
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const addressedToOracle = addressedRequest
    // Naming the Island or one of its places is enough: "Tynwald Day" and
    // "population of Douglas" are requests, and treating them as overheard
    // speech was the refusal users complained about most.
    || isManxText(text) || isManxPlaceText(text)
    || IMPERATIVE_RE.test(text)
    || FIRST_PERSON_RE.test(text)
    || (SECOND_PERSON_RE.test(text) && wordCount >= 4)
    || REQUEST_MARKER_RE.test(text);
  if (source === "speech" && !confirmed && (lowConfidenceSpeech || !addressedToOracle)) {
    return {
      route: "clarify",
      raw: repaired.original,
      canonical: null,
      jurisdiction: DEFAULT_JURISDICTION,
      interpretedAs: repaired.interpretedAs,
      speech: source === "speech"
        ? `I heard “${repaired.original}”, but I could not make out a request in it. Say it again, or type it below.`
        : `I could not make out a request in “${repaired.original}”. Try rephrasing it.`,
      // Remember it anyway. Forgetting queried turns is what let Mannin insist
      // no band had been named after the user had said "Bee Gees" three times.
      state: withState(state, { recentUtterances: rememberUtterance(state, repaired.original) }),
    };
  }

  if (mapCapabilityIntent && !foreign) {
    const artifact = mapArtifact || manxMapArtifact();
    const canonical = "Explain the displayed Isle of Man map and its capabilities";
    const pendingAction = { kind: "open_full_map", subject: canonical, status: "offered", label: "open MANX Earth", href: artifact.fullHref || MANX_EARTH_HREF, origin: artifactOrigin(artifact, { turnId, clientTurn }) };
    return {
      route: "capability",
      raw: repaired.original,
      canonical,
      semanticKey: semanticKey(canonical),
      jurisdiction: DEFAULT_JURISDICTION,
      interpretedAs: repaired.interpretedAs,
      pendingAction,
      speech: "I cannot see your screen, but I know I displayed the bundled Manx map. It is a diagrammatic SVG, not for navigation, and its source provenance is not recorded in the file. The fuller MANX Earth page lets you choose a locality and open Google Earth’s 3D globe, satellite imagery and Street View.",
      action: { kind: "describe_manx_map", artifact, fullHref: artifact.fullHref || MANX_EARTH_HREF, providers: CAPABILITY_MANIFEST.mapProviders },
      state: withState(state, { lastArtifact: artifact, pendingAction }),
    };
  }

  if (showMapIntent && !foreign) {
    const canonical = "Show the Isle of Man map";
    const artifact = manxMapArtifact();
    const pendingAction = { kind: "open_full_map", subject: canonical, status: "offered", label: "open MANX Earth", href: artifact.fullHref, origin: artifactOrigin(artifact, { turnId, clientTurn }) };
    return {
      route: "action",
      raw: repaired.original,
      canonical,
      semanticKey: semanticKey(canonical),
      jurisdiction: DEFAULT_JURISDICTION,
      interpretedAs: repaired.interpretedAs,
      speech: "Here’s a map of the Isle of Man, including the Calf and the main ports and towns.",
      action: {
        kind: "show_manx_map",
        title: "Isle of Man map",
        href: MANX_MAP_HREF,
        fullHref: MANX_EARTH_HREF,
        artifact,
        providers: CAPABILITY_MANIFEST.mapProviders,
      },
      pendingAction,
      state: withState(state, { lastArtifact: artifact, pendingAction }),
    };
  }

  if (showMapIntent && foreign) {
    const canonical = `Open a map of ${foreign}`;
    return {
      route: "action",
      raw: repaired.original,
      canonical,
      semanticKey: semanticKey(canonical),
      jurisdiction: foreign,
      interpretedAs: repaired.interpretedAs,
      speech: `Here’s a map search for ${foreign}. The built-in illustrated map remains the Isle of Man map.`,
      action: {
        kind: "show_external_map",
        title: `${foreign} map`,
        href: `https://www.openstreetmap.org/search?query=${encodeURIComponent(foreign)}`,
      },
      state: withState(state),
    };
  }

  if (visualIntent) {
    const rasterRequested = RASTER_IMAGE_RE.test(text) && !/\b(?:chart|graph|diagram|timeline|plot)\b/i.test(text);
    const requestedType = /\b(?:chart|graph|plot)\b/i.test(text) ? "chart" : "diagram";
    const canonical = `Create a reviewed ${requestedType} for ${jurisdiction}: ${titleSentence(text)}`;
    return {
      route: "visual",
      raw: repaired.original,
      canonical,
      semanticKey: semanticKey(canonical),
      jurisdiction,
      interpretedAs: repaired.interpretedAs,
      speech: rasterRequested
        ? "I cannot generate a photorealistic image inside this local Mannin. I can make a clear diagrammatic canvas instead. This uses one shared hourly MOMM review slot to check its content before I show it."
        : "I’ll build that as a canvas. This uses one shared hourly MOMM review slot to check the facts and presentation before I show it.",
      action: { kind: "generate_canvas", requestedType, fallback: rasterRequested ? "diagram" : null },
      state: withState(state, { pendingAction: null }),
    };
  }

  if (affirmativeIntent || (/^(?:all(?: of (?:it|that|them))?|everything|do everything)[.!?]*$/i.test(text) && Boolean(state.conversationTopic || state.pendingAction))) {
    const pending = pendingRoute({ pendingAction: state.pendingAction, state, raw: repaired.original, repaired });
    if (pending) return pending;
    return {
      route: "clarify",
      raw: repaired.original,
      canonical: null,
      jurisdiction: DEFAULT_JURISDICTION,
      interpretedAs: repaired.interpretedAs,
      speech: "I do not have a pending suggestion to act on. Tell me what you want me to do next.",
      state: withState(state, { pendingAction: null }),
    };
  }

  if (deepenIntent) {
    const hasStalePending = Boolean(state.pendingAction && !pendingMatchesState(state.pendingAction, state));
    const pendingAction = hasStalePending
      ? null
      : state.pendingAction?.kind === "research"
        ? state.pendingAction
        : state.lastSubstantiveQuestion && state.lastCompletedKey === state.lastSubstantiveTurn?.semanticKey
          ? { kind: "research", subject: state.lastSubstantiveQuestion, status: "offered", label: "the last Isle of Man answer", origin: turnOrigin(state.lastSubstantiveTurn) }
          : null;
    const pending = pendingRoute({ pendingAction, state, raw: repaired.original, repaired });
    if (pending) return pending;
    return {
      route: "clarify",
      raw: repaired.original,
      canonical: null,
      jurisdiction: DEFAULT_JURISDICTION,
      interpretedAs: repaired.interpretedAs,
      speech: "Give me an Isle of Man subject first, then I can go deeper on it.",
      state: withState(state, { pendingAction: null }),
    };
  }

  if (complaintIntent) {
    const subject = String(state.pendingAction?.subject || state.lastSubstantiveQuestion || "").trim();
    if (subject) {
      const pendingAction = { kind: "repair_answer", subject, status: "needs_detail", label: "improve the last answer" };
      return {
        route: "repair",
        raw: repaired.original,
        canonical: subject,
        semanticKey: semanticKey(subject),
        jurisdiction: DEFAULT_JURISDICTION,
        interpretedAs: repaired.interpretedAs,
        pendingAction,
        speech: "What should I improve in the last answer: its accuracy, detail, sources, or how it was presented?",
        state: withState(state, { pendingAction }),
      };
    }
  }

  if (hasInfrastructure) {
    const breadth = hasAll || /\b(?:capacity|full|complete|comprehensive)\b/i.test(text) ? "comprehensive" : "overview";
    return answerRoute({ canonical: infrastructureQuestion(breadth, jurisdiction), state, raw: repaired.original, repaired, jurisdiction, topic: "infrastructure", facets: [...INFRASTRUCTURE_FACETS], breadth, persistContext: !foreign, turnId, clientTurn });
  }

  if ((expandTopic || continueIntent) && state.lastActionable) {
    const breadth = hasAll ? "comprehensive" : state.breadth;
    const canonical = state.activeTopic === "infrastructure" ? infrastructureQuestion(breadth) : state.lastActionable;
    return answerRoute({ canonical, state, raw: repaired.original, repaired, jurisdiction: DEFAULT_JURISDICTION, topic: state.activeTopic, facets: state.activeFacets, breadth, turnId, clientTurn });
  }

  if (expandTopic && (hasManx || /\bneed\s+to\s+know\s+all\b/i.test(text))) {
    return answerRoute({ canonical: manxOverviewQuestion(), state, raw: repaired.original, repaired, jurisdiction: DEFAULT_JURISDICTION, topic: "overview", facets: [], breadth: "comprehensive", turnId, clientTurn });
  }

  if (expandTopic || continueIntent) {
    return {
      route: "clarify",
      raw: repaired.original,
      canonical: null,
      jurisdiction: DEFAULT_JURISDICTION,
      interpretedAs: repaired.interpretedAs,
      speech: "We’re focused on the Isle of Man. Do you want its infrastructure, companies and law, government, geography, or a full island overview?",
      state: withState(state),
    };
  }

  // A bare Manx subject ("Tynwald", "Peel?") is the subject the clarify below
  // would have asked for. Answer it.
  if (text && text.split(/\s+/).length <= 4 && !foreign && (isManxText(text) || isManxPlaceText(text)) && !REQUEST_RE.test(text)) {
    return answerRoute({ canonical: `Answer this specifically for the Isle of Man: Tell me about ${titleSentence(bare)}`, state, raw: repaired.original, repaired, jurisdiction: DEFAULT_JURISDICTION, turnId, clientTurn });
  }
  if (!text || text.split(/\s+/).length < 2) {
    return {
      route: "clarify",
      raw: repaired.original,
      canonical: null,
      jurisdiction: DEFAULT_JURISDICTION,
      interpretedAs: repaired.interpretedAs,
      speech: "We’re focused on the Isle of Man. Tell me the subject you want to explore.",
      state: withState(state),
    };
  }

  const caseContext=explicitReferent?{base:state.lastCaseBase||boundedCase(state.lastAnswerSubject,600),followups:[...(state.lastCaseFollowups||[]),boundedCase(titleSentence(text),320)].slice(-3)}:null;
  const canonical = explicitReferent
    ? `Continue this case: ${caseContext.base}. Follow-ups, most recent last: ${caseContext.followups.join(' | ')}. Use saved conversation for older assumptions and distinguish jurisdictions.`
    : foreign
    ? `Answer this for ${jurisdiction}: ${titleSentence(text)}`
    : `Answer this specifically for the Isle of Man: ${titleSentence(text)}`;
  return answerRoute({ canonical, state, raw: repaired.original, repaired, jurisdiction, topic: "general", facets: [], breadth: "overview", persistContext: !foreign, turnId, clientTurn, caseContext });
}

/** Bounded hot cache backed by the durable conversation store when supplied. */
export class DialogueSessions {
  constructor({ ttlMs = 30 * 60_000, maxSessions = 100, storage = null } = {}) { this.ttlMs = ttlMs; this.maxSessions = maxSessions; this.storage = storage; this.sessions = new Map(); }
  prune(at = now()) {
    for (const [id, state] of this.sessions) if (at - Number(state.updatedAt || 0) > this.ttlMs) this.sessions.delete(id);
    while (this.sessions.size > this.maxSessions) this.sessions.delete(this.sessions.keys().next().value);
  }
  get(sessionId) {
    this.prune();
    const id = String(sessionId);
    const state = this.sessions.get(id) || this.storage?.loadState(id);
    if (!state) return createDialogueState();
    this.sessions.delete(id);
    this.sessions.set(id, state);
    return state;
  }
  set(sessionId, state) {
    const id = String(sessionId);
    const stored = withState(state);
    this.sessions.delete(id);
    this.sessions.set(id, stored);
    this.storage?.saveState(id, stored);
    this.prune();
    return stored;
  }
  preview(sessionId, raw, meta) {
    const previous=this.get(sessionId),resolution=resolveDialogue(raw,previous,meta);
    return this.storage?.bindResearchFollowup ? this.storage.bindResearchFollowup(sessionId,raw,resolution,previous) : resolution;
  }
  commit(sessionId, resolution) { this.set(sessionId, resolution.state); return resolution; }
  resolve(sessionId, raw, meta) { return this.commit(sessionId, this.preview(sessionId, raw, meta)); }
  markInFlight(sessionId, resolution) { return this.set(sessionId, { ...resolution.state, inFlightKey: resolution.semanticKey }); }
  cancel(sessionId, key) {
    const state = this.get(sessionId);
    if (key && state.inFlightKey !== key) return state;
    return this.set(sessionId, { ...state, inFlightKey: null });
  }
  complete(sessionId, key, outcome = {}) {
    const state = this.get(sessionId);
    if (state.inFlightKey !== key) return state;
    const patch = { inFlightKey: null, lastCompletedKey: outcome.preservePendingAction ? state.lastCompletedKey : key };
    if (!outcome.preservePendingAction && Object.prototype.hasOwnProperty.call(outcome, "pendingAction")) patch.pendingAction = closePendingAction(outcome.pendingAction, state, key);
    if (Object.prototype.hasOwnProperty.call(outcome, "lastArtifact")) patch.lastArtifact = outcome.lastArtifact;
    if (Object.prototype.hasOwnProperty.call(outcome, "pendingQuestion")) {
      patch.pendingQuestion = outcome.pendingQuestion || null;
      patch.pendingQuestionSubject = outcome.pendingQuestion ? (outcome.subject || state.lastSubstantiveQuestion) : null;
    }
    return this.set(sessionId, { ...state, ...patch });
  }
  settleResearch(sessionId, id, outcome = {}) {
    const state = this.get(sessionId);
    const pending = state.pendingAction;
    if (pending?.kind !== "research" || String(pending.id || "") !== String(id || "")) return state;
    return this.set(sessionId, { ...state, pendingAction: null, researchFocusId: String(id), lastResearchOutcome: { id: String(id), status: String(outcome.status || "finished").slice(0, 40) } });
  }
  clear(sessionId) { this.sessions.delete(String(sessionId)); this.storage?.saveState(String(sessionId), createDialogueState()); }
}
