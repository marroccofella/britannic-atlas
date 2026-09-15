// Operational intent is parsed before conversational interpretation. Only an
// imperative grants action intent; mentioning MOMM or a person's mum does not.
export function completeAssent(value){
 const q=String(value||'').trim();
 return /^(?:(?:of course|yes|yep|yeah|okay|ok|please do|please|do (?:it|that)(?: all)?|go ahead|go|(?:i asked you to )?use (?:that|the|your) suggestion(?: for getting the better results)?)[\s,.!?]*)+$/i.test(q)
   || /^(?:ok|okay)[,.! ]+yep[.!? ]+are you[?.! ]*$/i.test(q);
}
export function deliveryRetry(value){
 const q=String(value||'').replace(/[’‘]/g,"'");
 return !/\b(?:reflect|analyse|analyze|list|why|stop|cancel|do not|don't)\b/i.test(q)
  && /\b(?:you (?:have not|haven't) (?:given|answered)|you(?:'ve| have)? still (?:delivered|given) nothing|still making me repeat myself|you have not delivered)\b/i.test(q);
}
export function interactionCommand(raw) {
  const q=String(raw||'').trim().replace(/"[^"]*"|“[^”]*”/g,'');
  if(/\b(?:check|verify|validate|audit)\b.*\b(?:knowledge ?base|vector|index|ledger)\b.*\b(?:integrity|reliability|health|consistency)\b|\b(?:knowledge ?base|vector index)\b.*\b(?:integrity|health)\b/i.test(q))return {kind:'knowledge_integrity'};
  if(/^(?:(?:of course|yes|okay|ok)[,.! ]+)*(?:check (?:the )?(?:official(?: Manx)? |relevant )?sources|do your research(?: and get me the)?)[.!?]*$/i.test(q)){const official=/official(?: Manx)? sources/i.test(q);return {kind:'search',subject:'that',live:!official,offerCheck:true,official};}
  const familyReference=/\b(?:my|your|his|her|our|their)\s+(?:mum|mom)\b|\b(?:mum|mom)[’']s\b/i.test(q);
  const denied=/\b(?:do not|don't|never|stop|cancel)\b/i.test(q);
  // Scope negation to the explicitly declined operation, preserving a separate imperative.
  if(!familyReference&&/^(?:please )?(?:don't|do not|skip|cancel) (?:the )?search[,; ]+(?:and )?(?:just |only )?(?:run|do|start) (?:the |a )?(?:momm(?: review)?|review)[.!?]*$/i.test(q))return {kind:'review',scope:'answer'};
  const onlySearch=q.match(/^(?:please )?(?:don't|do not|skip|cancel) (?:the )?(?:momm(?: review)?|review)[,; ]+(?:and )?(?:just |only )?search(?: for)? (.+?)[.!?]*$/i);
  if(onlySearch&&!familyReference)return {kind:'search',subject:onlySearch[1],live:true};
  // Explicit local inspection is free; mentioning a version never dispatches peers.
  if(!familyReference&&/\b(?:momm|mom|mum)\b/i.test(q)&&q.split(/[.!?;]/).some(part=>/\b(?:what|which) version|\b(?:ask|tell|show|check)\b.*\bversion\b/i.test(part)&&! /\b(?:do not|don't|never|stop|cancel)\b/i.test(part)))return {kind:'runtime_info',target:'momm'};
  if(!denied&&!familyReference&&/^(?:please )?(?:retry|try again|rerun)(?: (?:the|that|this))? (?:momm(?: review)?|review)[.!?]*$/i.test(q))return {kind:'review',scope:'answer',retry:true};
  if(!denied&&/^(?:please )?try (?:again|it|that)[.!?]*$/i.test(q))return {kind:'resume'};
  if(!denied&&/^(?:(?:please|then) )?(?:go (?:and )?)?find(?: and read)? (?:it|that)[.!?]*$/i.test(q))return {kind:'search',subject:'that',live:true};
  const compoundBoth=!denied&&q.match(/^(?:please )?do both(?: of (?:your|the|those) suggestions)?(?:[,.]?\s+(?:and|also)(?:\s+also)?\s+(.+))?[.!?]*$/i);
  if(compoundBoth)return {kind:'both',followup:compoundBoth[1]||null};
  if(!denied&&!familyReference&&/^(?:yes[, ]*)?(?:please )?(?:do|run|start) (?:the )?review(?: like I asked)?[.!?]*$/i.test(q))return {kind:'review',scope:'answer'};
  if(!denied&&!familyReference&&/\b(?:look over|summari[sz]e|recap|put it together)\b/i.test(q)&&/\b(?:conversation|context|chat)\b/i.test(q)&&/\b(?:push|send|run|use)\b[^.!?]*\b(?:momm|mom|mum)\b/i.test(q))return {kind:'recap',review:true};
  if(!denied&&!familyReference&&/^try and figure out\b/i.test(q)&&/\bif (?:the )?search fails\b/i.test(q)&&/\brun it through (?:momm|mom|mum)\b/i.test(q))return {kind:'search',subject:'that',followup:q,live:true,review:true,reviewAfterSearch:true};
  const taskReview=/\b(?:task|attempt|plan|strategy|trying to do|suggestions)\b/i.test(q);
  const scope=/\b(?:conversation|chat|exchange|reflect)\b/i.test(q)||taskReview?'conversation':'answer';
  const spokenMomm=/\b(?:momm|mom(?:\s+mmm|\s+mom)?|mum)\b/i.test(q);
  // Resolve both operations before a named review can consume the sentence.
  if(!denied&&!familyReference&&spokenMomm&&/\b(?:use|run|start|invoke)\s+(?:the )?(?:momm|mom|mum)\b/i.test(q)){
    const find=q.match(/^(?:(?:please|can you|could you)\s+)?find\s+(.+?)\s+(?:and|then|also)\s+(?:use|run|start|invoke)\b/i);
    if(find)return {kind:'search',subject:find[1],live:true,review:true,reviewAfterSearch:true};
  }
  if(!denied&&!familyReference&&spokenMomm&&/\b(?:send|ask|have)\b.*\b(?:reviewers?|suggestions|trying to do|task|attempt|plan)\b/i.test(q))return {kind:'review',scope:'conversation'};
  if(!denied&&!familyReference&&spokenMomm&&/\b(?:use|run|do|perform)\b.*\bsearch\b/i.test(q)&&/\band\s+(?:momm|mom(?:\s+mom)?|mum)\b/i.test(q))return {kind:'search',subject:'that',live:true,review:true,scope:'conversation'};
  if(!denied&&/^(?:please\s+)?do what (?:I(?:'ve| have)? (?:asked|told)|I asked) you to do[.!?]*$/i.test(q))return {kind:'resume'};
  const namedReview=/(?:^|[.!?;,]\s*|\b(?:and|also|then)\s+)(?:(?:please|can you|could you|would you)\s+)?(?:perform|do|run|use|start|invoke)\s+(?:a\s+|the\s+)?(?:(?:mom|mum)\s+)?(?:momm|mom|mum)(?:\s+(?:skill|review))?\b/i.test(q);
  const directReview=/^(?:(?:please|can you|could you|would you)\s+)?review\s+(?:this|that|it|(?:your|the)\s+(?:last|recent|previous)\s+answer|(?:this|our|the)\s+(?:conversation|chat|exchange))(?:[.!?]|$)/i.test(q)||/^review[.!?]\s*(?:do it|reflect)/i.test(q);
  if(!denied&&!familyReference&&(namedReview||directReview)&&! /\b(?:search|look up)\b/i.test(q))return {kind:'review',scope};
  if(!denied&&(/^(?:try\s+)?do it(?: for me)?[.!?]*$/i.test(q)||/\bfigure (?:it )?out\b.*\bdo it\b|^figure out a way to do what (?:i|I'd)\b/i.test(q)))return {kind:'resume'};
  if(!denied&&/^(?:(?:yes[, ]*)?(?:please )?(?:(?:do|to) )?both[.!?]*|(?:yes[, ]*)?do it and (?:review|use MOMM)[.!?]*|I said both[.!?]*)$/i.test(q))return {kind:'both'};
  if(/^(?:please )?search again[.!?]*$/i.test(q))return {kind:'search',subject:'that',live:true};
  const retry=/^(?:(?:yes[, ]*|please |can you )?)(?:do it|try again|search again|deliver on (?:all )?your shortcomings(?: now)?)(?:[.,]?\s*(?:and|also)\s+(.+))?[.!?]*$/i.exec(q);
  if(retry&&(!/^do it[.!?]*$/i.test(q)))return {kind:'search',subject:'that',live:true,followup:retry[1]||null};
  const requestedReview=/(?:^|[.!?;,]\s*|\b(?:and|also|then|so)\s+)(?:(?:please|can you|could you|would you|I want you to|I need you to)\s+)?(?:use|run|start|invoke|think harder with)\s+(?:the\s+)?(?:momm|mom|mum)(?:\s+(?:skill|review))?\b/i.test(q);
  const refusedReview=/\b(?:do not|don't|never|stop|cancel)\s+(?:also\s+)?(?:(?:use|using|run|running|start|starting|invoke|invoking)\s+)?(?:the\s+)?(?:momm|mom|mum)\b/i.test(q);
  if(requestedReview&&!refusedReview&&!familyReference){
    const search=q.match(/(?:^|[.!?;,]\s*|\b(?:and|also|then|so)\s+)(?:(?:please|can you|could you|I need you to|I want you to)\s+)?(?:search(?: the web)?(?: for)?|look up|do (?:the |an? )?(?:additional |targeted )?search)\b([^.!?]*)/i);
    const refusedSearch=/\b(?:do not|don't|never|stop|cancel)\s+(?:search|searching|look up)/i.test(q);
    if(search&&!refusedSearch){const subject=search[1].split(/\b(?:and|also|then|as well as)\b/i)[0].trim();return {kind:'search',subject:subject||'that',live:true,review:true};}
    return {kind:'review',scope};
  }
  if(!/\b(?:not|never|don't|stop|cancel)\b/i.test(q) && /^(?:(?:please|can you|could you|i want you to)\s+)?(?:find (?:it |that )?out(?: for me)?|check (?:it|that)(?: for me)?|you can if you search or use (?:mom|momm))[.!?]*$/i.test(q))return {kind:'search',subject:'that',live:true};
  const read=/^(?:(?:please|can you|could you)\s+)?read\s+(?:(?:out\s+)?(?:aloud|out loud)\s+)?(what you just did|what you just (?:said|made|created)|that|it|this|(?:the\s+)?(?:last\s+)?(?:answer|result|chart|diagram|canvas|review))(?:\s+(?:aloud|out loud|back(?:\s+to\s+me)?|to\s+me|again))?[.!?]*$/i.exec(q);
  if(read)return {kind:'readback',target:/chart|diagram|canvas/i.test(read[1])?'canvas':/review/i.test(read[1])?'review':'latest'};
  if(/^(?:please\s+)?(?:open|show)(?: me)? (?:the )?(?:official )?(?:(?:Manx|Isle of Man) )?weather(?: page| website| forecast)?[.!?]*$/i.test(q))return {kind:'open_page',target:'weather'};
  const review=/(?:^|[.!?]\s*|\balso\s+)(?:please\s+)?(?:use|run|start|invoke)\s+(?:the\s+)?(?:momm|mom|mum)(?:\s+(?:skill|review))?(?:\s+(?:on (?:that|this|the last (?:answer|result))|to (?:help|improve)\b[^.!?]*))?[.!?]*$/i;
  if(!familyReference&&review.test(q) && !/\b(?:not|never|don't|stop|cancel)\b/i.test(q))return {kind:'review',scope};
  if(/^(?:please\s+)?(?:search (?:for )?(?:that|this)|check (?:the )?(?:official (?:Manx )?|relevant )?sources)[.!?]*$/i.test(q))return {kind:'search',subject:'that',official:/official (?:Manx )?sources/i.test(q)};
  if(/^(?:please\s+)?(?:re[ -]?(?:ingest|read)|reread|reflect on|review)\s+(?:the entire|the|our|this)\s+(?:conversation|chat)\b/i.test(q))return {kind:'recap'};
  // Building the ledger by instruction. "Learn about X", "build out X", "add X
  // to the knowledge base" and "teach yourself about X" ask for the full
  // research pass on a named subject (official sources, adversarial twin,
  // cross-model check, lateral leads). It is paid work, spent only because
  // the user asked for it in so many words; a negation cancels it.
  const negated=/\b(?:not|never|don't|do not|stop|cancel)\b/i.test(q);
  const learn=/^(?:please\s+)?(?:(?:can|could|would|will)\s+you\s+)?(?:learn(?:\s+more)?(?:\s+about)?|teach\s+yourself(?:\s+about)?|build\s+(?:out|up)(?:\s+(?:the|your)\s+(?:knowledge\s?base|ledger|knowledge))?(?:\s+(?:on|about))?|expand\s+(?:the|your)\s+(?:knowledge\s?base|ledger|knowledge)(?:\s+(?:on|about))?|research\s+and\s+(?:learn|remember|add))\s+(.+?)[.!?]*$/i.exec(q)
    || /^(?:please\s+)?add\s+(.+?)\s+(?:to|into)\s+(?:the|your)\s+(?:knowledge\s?base|ledger|knowledge)[.!?]*$/i.exec(q);
  if(learn&&!negated&&learn[1].trim())return {kind:'learn',subject:learn[1].trim().replace(/^(?:the\s+)?(?:subject|topic)\s+of\s+/i,'')};
  // A map of what the ledger holds on a subject, or of the whole ledger. Free:
  // it is answered from the ledger itself, and it says what to build next.
  // "What do you know about X" stays an ordinary question; these phrasings are
  // about the knowledge base rather than the subject.
  const map=/^(?:please\s+)?(?:how\s+(?:well|much)\s+do\s+you\s+know(?:\s+about)?|what\s+(?:do\s+you\s+have|have\s+you\s+got)(?:\s+(?:in|on)\s+(?:the|your)\s+(?:knowledge\s?base|ledger|file))?(?:\s+(?:on|about))?|what(?:'s|\s+is)\s+in\s+(?:the|your)\s+(?:knowledge\s?base|ledger)(?:\s+(?:on|about))?|where\s+are\s+(?:the|your)\s+gaps(?:\s+(?:on|about|in))?|what\s+are\s+(?:the|your)\s+gaps(?:\s+(?:on|about|in))?|what\s+are\s+you\s+missing(?:\s+(?:on|about))?|what(?:'s|\s+is)\s+(?:missing|thin|weak)\s+(?:in|from)\s+(?:the|your)\s+(?:knowledge\s?base|ledger)(?:\s+(?:on|about))?|how\s+(?:big|large)\s+is\s+(?:the|your)\s+(?:knowledge\s?base|ledger)|(?:give\s+me\s+|show\s+me\s+)?(?:a\s+|the\s+)?knowledge\s+map(?:\s+(?:of|for|on))?)\s*(.*?)[.!?]*$/i.exec(q);
  if(map)return {kind:'knowledge_map',subject:map[1].trim()||null};
  // "Is Tynwald in your knowledge base?" asks about one subject, not the
  // architecture of the store.
  const contains=/^(?:please\s+)?(?:is|are)\s+(?!(?:this|that|it|all this|what we discuss|everything|anything)\b)(.+?)\s+in\s+(?:your|the)\s+(?:knowledge\s?base|ledger|database)[?.!]*$/i.exec(q);
  if(contains)return {kind:'knowledge_map',subject:contains[1].trim()};
  // A named subject after "research", "look into" or "dig into" is the
  // subject to check. It was being ignored in favour of whatever was researched
  // last, which launched the most expensive pass on the wrong topic.
  const named=/^(?:please\s+)?(?:(?:can|could|would|will)\s+you\s+)?(?:research|look into|dig into|investigate|go deeper (?:on|into)|dig deeper (?:on|into))\s+(.+?)(?:\s+please)?[.!?]*$/i.exec(q);
  // "what you suggested", "your suggestion" and the mis-hearing "old you
  // suggested" all point at the pending offer, not a new subject.
  const referential=/^(?:it|this|that|the same|(?:that|this|the last) (?:answer|result|subject|topic)|(?:(?:what|old|hold|whatever|which)\s+)?(?:you|u)\s+(?:suggested|said|proposed|mentioned|recommended)\b.*|(?:your|that|the)\s+(?:suggestion|idea|recommendation)\b.*)$/i;
  if(named&&!referential.test(named[1].trim())&&!/\b(?:not|never|don't|stop|cancel)\b/i.test(q)){
    const subject=named[1].trim().replace(/\s+(?:and|but)\s+(?:don't|do not|never|without)\b.*$/i,'');
    return /^go deeper|^dig deeper/i.test(q)?{kind:'learn',subject}:{kind:'search',subject,live:true};
  }
  const search=/^(?:please\s+)?(?:(?:can|could|would|will)\s+you\s+)?(?:search(?: the web)?(?: for)?|look up|check (?:the )?(?:official (?:Manx )?)?sources(?: for)?)\s+(.+?)(?:\s+please)?[.!?]*$/i.exec(q);
  if(search){
    // "Search for Tynwald and don't use MOMM": the instruction is not part of the subject.
    const subject=search[1].replace(/\s+(?:and|but)\s+(?:don't|do not|never|without)\b.*$/i,'').trim();
    const official=/official (?:Manx )?sources/i.test(q);
    return {kind:'search',subject,official,live:!official};
  }
  return null;
}

export function sourceMode(question,{official=false}={}) {
  if(official)return 'official_sources';
  return /\b(?:strix|market cap(?:italisation|italization)?|stock exchange|listed|publicly traded|public companies|share price|investor|AIM|family|biography|inventor|language|vocabulary|colours|colors)\b/i.test(question)?'sources':'official_sources';
}
export const sourceLabel=mode=>mode==='sources'?'Check relevant sources':'Check official Manx sources';

export function islandClock(at=new Date()) {
  return new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Isle_of_Man',weekday:'long',year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit',timeZoneName:'short'}).format(at);
}
export function clockQuestion(raw) {
  if(/^when are you[.!?]*$/i.test(String(raw||'').trim()))return true;
  // "What time is it?" is a clock read, not a paid answer.
  if(/^(?:what|which)\s+(?:time|day|date|year)\s+is\s+it(?:\s+(?:today|now|right now|there|on the island|on the isle of man))?[?.!]*$/i.test(String(raw||'').trim()))return true;
  return /^(?:(?:what(?:'s| is)|tell me|i asked for)\s+)(?:the\s+)?(?:(?:current|today'?s)\s+)?(?:day|date|time)(?:\s*[,and]+\s*(?:day|date|time))*(?:\s+(?:today|now|right now|there))?[?.!]*$/i.test(String(raw||'').trim());
}

export function currentWeatherQuestion(raw) {
  return /^(?:(?:what(?:'s| is)|how(?:'s| is))\s+(?:the\s+)?(?:(?:current|today'?s)\s+)?weather(?:\s+like)?|(?:tell me|give me|show me)\s+(?:the\s+)?(?:(?:current|today'?s)\s+)?(?:weather|weather forecast)|weather)(?:\s+(?:in|for|on)\s+(?:the\s+)?(?:Isle of Man|Island|Mann))?(?:\s+(?:today|now|right now))?[?.!]*$/i.test(String(raw||'').trim());
}
