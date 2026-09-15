// Select a small set of complementary checks; names are not proof of execution.
export function reasoningMethods(value){
 const q=String(value||'');
 if(/\b(?:contract|statute|regulation|legal|law|business|commercial|transaction|loophole)\b/i.test(q))return [
  {id:'claim-evidence',name:'Claim, evidence and assumptions',check:'Identify the exact text, scope, definitions, jurisdiction and date. Separate a quotation, a supported fact, an inference and an unknown.'},
  {id:'counterexample',name:'Counterexample and contrary reading',check:'Test boundaries and the strongest contrary reading. Do not treat silence, a label, a cure period or a liability cap as permission; identify what could defeat the proposed interpretation.'},
  {id:'opportunity',name:'Opportunity and constraint comparison',check:'Compare lawful options, beneficiaries, costs, constraints and reversible next steps. Missing text or governing law limits the conclusion; unmeasured enforcement probability is unknown, not low.'}
 ];
 if(/\b(?:tides?|temperatures?|weather|times|heights|chronolog|all|every)\b/i.test(q))return [
  {id:'requirements',name:'Request decomposition',check:'List each requested place, quantity, time period and ordering requirement. A source page is not an answer unless it supplies the requested values.'},
  {id:'constraints',name:'Evidence and coverage checks',check:'Check location, dates, units and coverage; mark missing values explicitly. Follow relevant public detail links within the lookup budget. Do not substitute another location or quantity.'}
 ];
 return [
  {id:'claim-evidence',name:'Claim, evidence and assumptions',check:'Separate the requested outcome from the premises and evidence offered for it.'},
  {id:'counterexample',name:'Counterexample and contrary reading',check:'Test the strongest alternative and one material edge case; consolidate duplicate findings.'},
  {id:'verification',name:'Observable completion',check:'Compare the requested outcome with actual tool receipts and the delivered answer. A proposal, accepted job or saved message is not completed work.'}
 ];
}
export function methodBrief(value){return 'SELECTED ANALYSIS CHECKS (use only those relevant, not a ritual): '+reasoningMethods(value).map(m=>m.name+': '+m.check).join('\n')+'\nUse precise questions to recover missing actors, definitions, dates and measures. Ordinary hesitation, tone and self-repair do not prove deceit or logical error. Do not use hypnotic persuasion or therapeutic NLP techniques as evidence tests. Do not force a flaw where the text supports none. One issue, one finding. For opportunities name the textual hook, assumption, opposing interpretation, missing evidence and smallest lawful verification step. Do not invent probabilities or describe proposed checks as executed.';}
export function tideRequest(value){const q=String(value||'');return /\b(?:high tide|low tide|tide (?:times|tables|predictions)|tidal (?:times|predictions))\b/i.test(q)&&!/\b(?:what (?:is|causes)|why|explain|meaning|metaphor|how do tides work)\b/i.test(q);}
export function tideBrief(value){return tideRequest(value)?'TIDE OUTPUT REQUIREMENTS: Return the requested port, prediction date, event time, high/low type, height, units, stated timezone and height datum, with source links. State the date assumption if omitted and sort comparable events chronologically using a common instant only when source timezone offsets are known; keep unknown-timezone events separate and unsorted. Distinguish ISO 8601 retrieval timestamps from the source prediction date. Do not convert unknown timezones or invent a datum. Distinguish today from next tide, predictions from observations and historical tables from current ones. A directory page, flapgate schedule, weather forecast or wave height cannot answer tide height. Report missing ports/fields separately. Reading a page does not complete this task. Do not claim a per-town Met Office tide tool exists: use only the supplied tool receipts and actual public links. If the evidence lacks requested values, mark answer_outcome insufficient_evidence; if only some requested places or fields are supported, mark partial.':'';}

export function domainEvidenceBrief(value){
 const q=String(value||''),notes=[];
 if(/\b(?:shallowest|bathymetr\w*|seabed|depth)\b/i.test(q))notes.push('SPATIAL SCOPE: A minimum at one point, a depth range within a protected area, the narrowest horizontal crossing and a continuous route whose maximum depth stays below a threshold are different questions. Do not infer a continuous shallow crossing from a survey-area minimum. State endpoints and the missing bathymetric profile; the UK and Great Britain are not interchangeable geographic terms.');
 if(/\b(?:diving|diver|freediv\w*|scuba)\b|\b(?:human|person)\b.*\b(?:dive|float|submerge|surface)\b/i.test(q))notes.push('DIVING EVIDENCE: Separate seabed geography, diving records by discipline, and medical safety. A seabed survey supports none of the human physiology or record claims. Obtain relevant current authoritative sources for each part. Never infer that depth divided by an assumed ascent speed gives a safe breath-hold or passive ascent time. Do not reassure that a person can float safely up from depth, or give an unsourced numerical ascent estimate. Explain that this cannot be established for a person from the supplied information and should not be attempted on that basis. Distinguish breath-hold diving from compressed-gas scuba; record achievements are not safe limits for a user.');
 return notes.join('\n');
}
