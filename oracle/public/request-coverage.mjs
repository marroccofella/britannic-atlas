// Pure request boundaries shared by routing and source selection. Examples of
// actions are not instructions to execute every advertised capability.
export const PUBLIC_ACCESS_EXPLANATION = 'I can search public sources, read public web pages and text-based PDFs into this chat, and check weather and dated Manx news. Some pages remain inaccessible; a failed read does not mean no information exists. I can also show maps and give an optional MOMM second opinion on an answer or a bounded public task assessment, including unfinished work.';

const requestText=value=>String(value||'').replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim();
const capabilityClause = /(?:^|[.!?]\s*|,\s*|;\s*)(?:what (?:external|internet|web|online) access do you have|what (?:websites|sites|external sources) can you (?:access|read)|can you access (?:the )?(?:internet|web)|are you (?:able to access|connected to) (?:the )?(?:internet|web)|do you have (?:internet|web|external) access|can you (?:browse|search) the (?:internet|web))[?!.]?/i;
export const MANX_PLACES=Object.freeze(['Port St Mary','Port Erin','Kirk Michael','Kirk Andreas','Peel','Douglas','Ramsey','Castletown','Laxey','Onchan','Ballasalla','Foxdale','Andreas','Jurby','Bride','Ballaugh','Sulby','Lezayre','Maughold','Lonan','Santon','Union Mills','Crosby','St Johns',"St John's",'Ronaldsway']);
const namedWeatherPlace=new RegExp('\\b(?:weather|forecast|temperature) (?:in|for|at) ('+MANX_PLACES.join('|')+')\\b','i');
const localWeatherPlace=new RegExp('\\b(?:'+MANX_PLACES.filter(p=>p!=='Ronaldsway').join('|')+'|elsewhere|other (?:places|towns)|across the island)\\b','i');

export function capabilityRequest(value) {
  const q=requestText(value).replace(/^Answer this specifically for (?:the )?Isle of Man:\s*/i,'');
  const match=capabilityClause.exec(q);if(!match)return null;
  const before=q.slice(0,match.index).trim();
  // Only ignore a conversational testing preamble. Unrelated factual clauses
  // remain part of a mixed request and must go through the complete answer.
  const preamble=/^(?:(?:we(?:'re| are)|i(?:'m| am)) (?:trying|testing)\b[^?]*[.!]?|(?:hi|hello|hey)(?: (?:Mannin|Mani))?[,!.]?)$/i.test(before);
  const remainder=[preamble?'':before,q.slice(match.index+match[0].length)].filter(Boolean).join(' ').trim();
  if(!remainder)return {mode:'explain',text:PUBLIC_ACCESS_EXPLANATION};
  // A polite request is actionable; an explicit hypothetical is an example.
  const hypothetical=/^(?:if i\b|for example\b|say,?\s|suppose i\b)/i.test(remainder);
  const clauses=remainder.split(/(?<=[?!.])\s+/);
  if(hypothetical&&clauses.length>1)return {mode:'mixed',text:PUBLIC_ACCESS_EXPLANATION,lookupQuestion:clauses.slice(1).join(' ')};
  const named=hypothetical?namedWeatherPlace.exec(remainder):null;
  if(named){
    const place=MANX_PLACES.find(p=>p.toLowerCase()===named[1].toLowerCase());
    const day=remainder.match(/\b(tomorrow|tonight|this weekend|next week)\b/i)?.[1]?.toLowerCase();
    const subject=day?`Weather forecast for ${place} ${day}`:`Current weather in ${place}`;
    const when=day?' '+day:'';
    return {mode:'explain',subject,label:`Check weather in ${place}${when}`,text:PUBLIC_ACCESS_EXPLANATION+` Yes, I can look for a forecast specific to ${place}. An Island-wide forecast is not a measurement in ${place}. I haven't checked it yet. Say “do it” to check the weather there${when}; I will bring the result and its sources into this chat.`};
  }
  if(hypothetical)return {mode:'explain',text:PUBLIC_ACCESS_EXPLANATION+' I can try a public source check for that example, but I have not run one. Name the specific question when you want me to check it.'};
  return {mode:'mixed',text:PUBLIC_ACCESS_EXPLANATION,lookupQuestion:remainder};
}

export function needsLocalWeatherSource(value){
  const q=requestText(value);if(localWeatherPlace.test(q))return true;
  const place=/\b(?:in|at|for)\s+(?:the\s+)?(.+)$/i.exec(q)?.[1]?.trim();
  // An explicitly named destination outside our list requires a source search.
  return Boolean(place&&!/^(?:Isle of Man|Island|Mann|Mannin|Ronaldsway(?: airport)?)(?:[.!?]|$|\s+(?:today|now|right now|tomorrow|this weekend|next week)\b)/i.test(place));
}

// A fixed tool response is sufficient only for a whole, single-purpose request.
// Unrecognised wording goes through synthesis with the full request intact.
export function wholeRequestCoveredByTool(value,name){
  let q=requestText(value).replace(/^Answer this specifically for (?:the )?Isle of Man:\s*/i,'').replace(/[?.!]+$/,'');
  q=q.replace(/^(?:please\s+)?(?:(?:can|could|would) you\s+)?(?:tell me|give me|show me|check|read|what(?:'s| is| are))\s+/i,'').replace(/^(?:the|a)\s+/i,'');
  if(name==='get_town_weather'){
    // Consume only an enumerated temperature request; leave every extra task
    // and unknown locality for synthesis with the complete original question.
    if(!/\b(?:temperatures?|hot|cold|warm)\b/i.test(q))return false;
    const remainder=q.replace(/\b(?:Douglas|Ramsey|Peel|Castletown|Onchan|Port Erin|Port St Mary|Laxey|Isle of Man)\b/gi,' ')
      .replace(/\b(?:current|latest|temperature|temperatures|how|hot|cold|warm|is|are|it|in|at|for|of|the|and|every|all|major|main|town|towns|city|cities|settlements|now|today|there|across|island)\b/gi,' ').replace(/[\s,]+/g,'');
    return !remainder;
  }
  if(name==='get_news')return /^(?:(?:latest|current|today's|Manx|Isle of Man)\s+)*(?:news|headlines)(?: in (?:the )?Isle of Man)?$/i.test(q);
  if(!['get_weather','get_forecast'].includes(name)||needsLocalWeatherSource(q))return false;
  if(name==='get_weather'&&/\b(?:forecast|tomorrow|weekend|next week)\b/i.test(q))return false;
  if(name==='get_forecast'&&/\b(?:temperature|humidity|dew ?point|hot|cold|warm|humid)\b/i.test(q))return false;
  return /^(?:(?:current|latest|observed)\s+)?(?:weather(?: forecast)?|forecast|temperature|humidity|dew ?point)(?:\s+(?:in|for|at) (?:the )?(?:Isle of Man|Island|Ronaldsway(?: airport)?))?(?:\s+(?:now|today|tomorrow|this weekend|next week))?$/i.test(q)
    || /^how (?:hot|cold|warm|humid) is it(?:\s+(?:in|at) (?:the )?(?:Isle of Man|Island|Ronaldsway))?$/i.test(q);
}
