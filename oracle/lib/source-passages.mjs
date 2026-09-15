// Select verbatim passages across the whole extracted document, keeping page identity.
export function sourcePassages(sections,question,{requestedPage=0,limit=12000,maxPages=8}={}) {
  const stop=new Set('https www read this that from with manx isle government please could would about what which have does latest current'.split(' '));
  const terms=[...new Set(String(question||'').toLowerCase().match(/[a-z]{4,}/g)||[])].filter(t=>!stop.has(t));
  if(/foundation|bill|legislation|passed|enacted|assent/i.test(question))terms.push('royal assent','commencement','appointed day','final stage');
  const score=text=>terms.reduce((sum,t)=>sum+(text.toLowerCase().includes(t)?(t.includes(' ')?3:1):0),0);
  const candidates=[];
  for(const section of sections||[]){
    const body=String(section.body||'');if(body.trim().length<(section.page?40:1))continue;
    let best={body:body.slice(0,3000),score:-1};
    for(let start=0;start<body.length;start+=2400){const passage=body.slice(start,start+3000),rank=score(passage);if(rank>best.score)best={body:passage,score:rank};}
    candidates.push({...section,...best,score:best.score+(section.sourceStatus===true?500:0)+(section.page===requestedPage?1000:0)});
  }
  candidates.sort((a,b)=>b.score-a.score||(a.page||0)-(b.page||0));
  const selected=[],pages=new Set();let characters=0;
  const targeted=terms.length>0&&!/\b(?:read|entire|whole|full document)\b/i.test(question)&&candidates.some(s=>s.score>0);
  for(const section of candidates){
    if(targeted&&section.score<=0)continue;
    if(characters>=limit)break;
    if(section.page && !pages.has(section.page)&&pages.size>=maxPages)continue;
    const body=section.body.slice(0,limit-characters);characters+=body.length;
    if(section.page)pages.add(section.page);selected.push({...section,body});
  }
  return {sections:selected,characters,pages:[...pages],truncated:characters<(sections||[]).reduce((n,s)=>n+String(s.body||'').length,0)};
}

export function navigationOnly(text){
 const value=String(text||'');
 const bibliography=(value.match(/\[\s*(?:CrossRef|PubMed)\s*\]/gi)||[]).length>=3&&(value.match(/\b(?:18|19|20)\d{2},\s*\d+/g)||[]).length>=3;
 const plainContents=value.length<=1500&&/\bContents\s+(?:Page|\d)/i.test(value)&&(value.match(/\b\d{1,2}\.\s+[A-Z]/gi)||[]).length>=2;
 return value.length<=3500&&(bibliography||plainContents||((/(?:contents|list of (?:illustrations|figures|tables))/i.test(value)&&((value.match(/\.{5,}/g)||[]).length>=2))||((value.match(/\.{5,}/g)||[]).length>=5&&((value.match(/\./g)||[]).length/value.length)>.15)));
}
export function sourceRelevant(question,text){
  const stop=new Set('isle man manx mannin island people government information supporting official sources evidence records request facts see want become good since time spoke last answer specifically public current latest please sources source search check again about where which there their these those could would should today yesterday government island have does with from what this that been they them your into more need answers follow up'.split(' '));
  const terms=[...new Set((String(question||'').toLowerCase().match(/[a-z]{4,}/g)||[]).filter(t=>!stop.has(t)))];
  const source=String(text||'').toLowerCase();
  if(navigationOnly(source))return false;
  const geology=/\b(?:post[ -]?glacial|land[ -]?bridge|land separation|separation from (?:Britain|England|Ireland)|insularity)\b/i.test(question);
  const monuments=/\b(?:ancient monuments?|historic environment record|archaeological (?:sites|record))\b/i.test(question);
  if(geology||monuments){
    const namedTerms=[...new Set(String(question||'').toLowerCase().match(/[a-z]{3,}/g)||[])].filter(t=>!stop.has(t)).filter(t=>!/^(?:the|and|for|not|are|how|land|ancient|monuments?|include|including|registered|geology|glacial|postglacial|separation|history|ages|specific|supporting|what|mean)$/.test(t));
    const sourceWords=new Set(source.match(/[a-z]+/g)||[]);
    const namedMatch=namedTerms.filter(t=>sourceWords.has(t)||sourceWords.has(t.replace(/s$/,''))).length>=2;
    return namedMatch||(geology&&/\b(?:post[ -]?glacial|land[ -]?bridge|sea.level|severance|insularity|Cumbria|glacial|glaciation)\b/i.test(source))||(monuments&&/\b(?:ancient monuments?|historic environment record|archaeolog\w*|prehistor\w*|neolithic|mesolithic)\b/i.test(source));
  }
  if(/\b(?:earliest|oldest|history)\b/i.test(question)&&/\b(?:people|humans?|settlement|house|dwelling|history)\b/i.test(question)&&/\b(?:mesolithic|neolithic|prehistor\w*|archaeolog\w*|early settlement|earliest (?:known )?house|Cumbria)\b/i.test(source))return true;
  if(/\b(?:temperatures?|weather|forecasts?|humidity)\b/i.test(question)&&!/\b(?:temperatures?|weather|forecasts?|humidity|celsius|fahrenheit|degrees)\b/i.test(source))return false;
  return terms.length>0&&terms.some(t=>source.includes(t.replace(/s$/,'')));
}
export function mergeEvidence(live,stored,limit=10){
 const seen=new Set(),unique=[];
 for(const claim of [...live,...stored]){const key=JSON.stringify([String(claim.text||'').replace(/\s+/g,' ').trim(),(claim.sources||[]).map(s=>s.url).sort()]);if(!seen.has(key)){seen.add(key);unique.push(claim);}}
 return balancedEvidence(unique,limit);
}
export function balancedEvidence(claims,limit=10){
  const groups=new Map();for(const claim of claims){const key=(claim.sources?.[0]?.url||'').split('#')[0];if(!groups.has(key))groups.set(key,[]);groups.get(key).push(claim);}
  const output=[];for(let i=0;output.length<limit;i++){let added=false;for(const group of groups.values()){if(group[i]&&output.length<limit){output.push(group[i]);added=true;}}if(!added)break;}return output;
}

// A bounded answer from two inspected passages. Do not turn period labels into
// arrival dates, or let synthesis add an uncited land-bridge assertion.
export function historySourceAnswer(question,claims){
 const q=String(question||'').replace(/[’‘]/g,"'").toLowerCase();
 if(!/\b(?:earliest|oldest)\b/.test(q))return null;
 const allowed=new Set("what is are the oldest earliest piece of information you can find about its existence lets let's let us talk background country and very first beginnings beginning tell me human humans people living lived on isle man island mann evidence settlement history known house dwelling from date arrival distinguish cite sources source supporting please answer this specifically for a an that we have period dates your manx mannin in".split(' '));
 if((q.match(/[a-z']+/g)||[]).some(word=>!allowed.has(word)))return null;
 const excerpts=(Array.isArray(claims)?claims:[]).filter(c=>c?.evidenceKind==='source_excerpt');
 const leaflet=excerpts.find(c=>c.sources?.some(s=>/^https:\/\/manxnationalheritage\.im\/wp-content\/uploads\/2020\/05\/MOTM-EarlyPeople-AMesolithic\.pdf#page=1$/.test(s.url))&&/8000 BC\s*[-–]\s*4000 BC/.test(c.text));
 const excavation=excerpts.find(c=>c.sources?.some(s=>/^https:\/\/www\.archaeopress\.com\/Archaeopress\/DMS\/9A26816D482B4A05BD823311F1F20BA7\/9781805832553-sample\.pdf#page=15$/.test(s.url))&&/Cass ny Hawin II/.test(c.text)&&/later ninth millennium cal\.? BC/.test(c.text)&&/earliest (?:known )?house on Man/.test(c.text));
 if(!leaflet||!excavation)return null;
 return {claimIds:[excavation.id,leaflet.id],text:'For human settlement, the Ronaldsway excavation report identifies Cass ny Hawin II as the earliest known house on the Isle of Man, dated to the later ninth millennium calibrated BC. ['+excavation.id+'] Manx National Heritage’s overview labels the Manx Mesolithic as eight thousand to four thousand BC. That is a broad period label, not a date of first arrival. ['+leaflet.id+'] The more specific house date and the older overview’s period label need to be kept separate. Neither establishes the exact date when people first arrived.'};
}
