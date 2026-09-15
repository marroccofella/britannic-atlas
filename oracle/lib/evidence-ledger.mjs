import {createHash} from 'node:crypto';
import {readablePage} from './public-reader.mjs';
import {conversationRepairQuestion} from '../public/conversation-policy.mjs';
import {balancedEvidence,navigationOnly,sourceRelevant} from './source-passages.mjs';
import {safeForExternalPeerReview,manxReviewScope} from './external-policy.mjs';
export const evidenceHash=text=>createHash('sha256').update(String(text).replace(/\s+/g,' ').trim()).digest('hex');
// A receipt detects changes after trusted server reads. It is not an
// authentication boundary against arbitrary server JavaScript; HTTP callers
// cannot supply the live calls/claims consumed by this module.
export const sourceExcerptSeal=c=>Array.isArray(c?.sources)?evidenceHash(JSON.stringify([c?.text,c.sources.map(s=>readablePage(s?.url)),c?.fetchedAt,c?.publishedAt||null,c?.documentHash||null])):null;
export function evidenceCurrent(claim,at=Date.now()){
 if(claim?.kind!=='source_excerpt')return true;
 const now=Number(at),e=claim?.provenance?.sourceEvidence;
 if(!Number.isFinite(now)||!Array.isArray(claim.sources)||!claim.sources.length)return false;
 const urls=claim.sources.map(s=>readablePage(s?.url));
 return Boolean(e&&urls.every(Boolean)&&e.sha256===evidenceHash(claim.text)&&e.sourcesHash===evidenceHash(JSON.stringify(urls))&&Number.isFinite(Date.parse(e.fetchedAt))&&Date.parse(e.fetchedAt)<=now+300000&&Date.parse(e.expiresAt)>now);
}
// Only passages paired with a successful server-owned read can enter the ledger.
// Conversation text, synthesis claims and reviewer votes never enter here.
export function publicEvidenceText(text){
 // Projection runs only after the original server read receipt is validated.
 // Drop contact/private units; never rewrite a retained factual sentence.
 return String(text||'').split(/(?<=[.!?])\s+(?=\p{Lu})|\n+/u).map(s=>s.trim()).filter(s=>s.length>=12&&safeForExternalPeerReview(s)).join(' ');
}
export function persistPublicEvidence(kb,live,{question,jurisdiction='Isle of Man',at=new Date()}={}){
 const receipt={stored:0,added:0,refreshed:0,superseded:0,ids:[],entries:[],rejected:0,omitted:0,reasons:{},kind:'source excerpts; not independently verified'};
 const candidates=Array.isArray(live?.claims)?live.claims:[];receipt.considered=candidates.length;
 if(!candidates.length)return receipt;
 const reject=reason=>{receipt.rejected++;receipt.reasons[reason]=(receipt.reasons[reason]||0)+1;};
 if(!manxReviewScope(jurisdiction)||!safeForExternalPeerReview(question))return {...receipt,reason:'private or out-of-scope request'};
 if(conversationRepairQuestion(String(question||'').replace(/^Answer this specifically for (?:the )?Isle of Man:\s*/i,'')))return {...receipt,reason:'conversation diagnostic; no factual learning'};
 const calls=(Array.isArray(live?.calls)?live.calls:[]).filter(c=>c.status==='complete');
 const selected=balancedEvidence(candidates,48);
 receipt.omitted=candidates.length-selected.length;
 for(const c of selected){
  const urls=(Array.isArray(c?.sources)?c.sources:[]).map(s=>readablePage(s?.url));
  const operation=calls.find(call=>Array.isArray(call.evidenceSeals)&&call.evidenceSeals.includes(sourceExcerptSeal(c))&&urls.length&&urls.every(url=>url&&[call.url,...(Array.isArray(call.items)?call.items:[]).map(i=>i.url)].map(readablePage).includes(url)));
  const fetched=Date.parse(c?.fetchedAt),published=Date.parse(c?.publishedAt);
  if(c?.evidenceKind!=='source_excerpt'||!operation||!c.text||!Number.isFinite(fetched)||fetched>at.getTime()+300000||at-fetched>86400000){reject('unbound_or_stale_read');continue;}
  const text=publicEvidenceText(c.text);
  if(text.length<12){reject('no_safe_public_passage');continue;}
  if(navigationOnly(text)){reject('navigation_only');continue;}
  const selectedPage=urls.some(url=>String(question||'').includes(String(url).split('#')[0]));
  if(operation.name==='read_page'&&!selectedPage&&!sourceRelevant(question,text)){reject('unrelated_passage');continue;}
  const ttl=operation.name==='get_weather'||operation.name==='get_town_weather'?2*3600000:operation.name==='get_forecast'?18*3600000:operation.name==='get_news'?86400000:7*86400000;
  const expiry=(/^get_(?:weather|town_weather|forecast)$/.test(operation.name)&&Number.isFinite(published)?published:fetched)+ttl;
  if(expiry<=at.getTime()){reject('expired_source');continue;}
  const documentHash=/^[a-f0-9]{64}$/.test(c.documentHash||'')?c.documentHash:null;
  const versions=documentHash&&urls.length===1?kb.db.prepare("SELECT id FROM claims WHERE kind='source_excerpt' AND jurisdiction='IM' AND json_array_length(sources)=1 AND EXISTS (SELECT 1 FROM json_each(sources) WHERE json_extract(value,'$.url') LIKE ?)").all(urls[0]+'%').map(row=>kb.getClaim(row.id)).filter(old=>readablePage(old.sources[0].url)===urls[0]&&old.provenance?.sourceEvidence?.documentHash):[];
  if(versions.some(old=>Date.parse(old.provenance.sourceEvidence.fetchedAt)>fetched&&old.provenance.sourceEvidence.documentHash!==documentHash)){reject('superseded_source_version');continue;}
  const sourceEvidence={documentHash,sha256:evidenceHash(text),sourcesHash:evidenceHash(JSON.stringify(urls)),fetchedAt:new Date(fetched).toISOString(),publishedAt:Number.isFinite(published)?new Date(published).toISOString():null,expiresAt:new Date(expiry).toISOString(),operation:operation.name,projection:text!==c.text?'contact_or_private_units_omitted':null};
  try{
    const {claim,created}=kb.upsertClaim({text,topic:c.topic,jurisdiction:'IM',kind:'source_excerpt',confidence:.55,support:1,sources:c.sources,evidenceKey:'excerpt:'+evidenceHash(urls.join(' ')+text),volatility:ttl<=86400000?'live':'periodic',provenance:{origin:'public-reader',sourceEvidence}});
    for(const old of versions){const prior=old.provenance.sourceEvidence;if(old.id===claim.id||prior.documentHash===documentHash||Date.parse(prior.fetchedAt)>fetched||prior.supersededBy===claim.id)continue;
      const provenance={...old.provenance,sourceEvidence:{...prior,expiresAt:new Date(Math.min(Date.parse(prior.expiresAt),fetched)).toISOString(),supersededAt:new Date(fetched).toISOString(),supersededBy:claim.id}};
      kb.db.prepare('UPDATE claims SET provenance=? WHERE id=?').run(JSON.stringify(provenance),old.id);kb.notifyClaimChange(old.id,'source_version');receipt.superseded++;
    }
    // A fresh live reading of the same page (weather, a forecast) replaces
    // the last one. Without this every reading stayed "live" until its own
    // expiry, and forty stale readings crowded out the current one.
    if(ttl<=86400000){
      for(const row of kb.db.prepare("SELECT id FROM claims WHERE kind='source_excerpt' AND id<>? AND status<>'retracted' AND sources=?").all(claim.id,JSON.stringify(claim.sources))){
        const old=kb.getClaim(row.id),prior=old?.provenance?.sourceEvidence;
        if(!prior||prior.operation!==operation.name||Date.parse(prior.fetchedAt)>=fetched||prior.supersededBy)continue;
        const provenance={...old.provenance,sourceEvidence:{...prior,expiresAt:new Date(Math.min(Date.parse(prior.expiresAt),fetched)).toISOString(),supersededAt:new Date(fetched).toISOString(),supersededBy:claim.id}};
        kb.db.prepare('UPDATE claims SET provenance=? WHERE id=?').run(JSON.stringify(provenance),old.id);kb.notifyClaimChange(old.id,'source_version');receipt.superseded++;
      }
    }
    receipt.stored++;receipt[created?'added':'refreshed']++;receipt.ids.push(claim.id);
    receipt.entries.push({id:claim.id,change:created?'added':'refreshed',text:claim.text.slice(0,240),sources:claim.sources,fetchedAt:sourceEvidence.fetchedAt,expiresAt:sourceEvidence.expiresAt,projection:sourceEvidence.projection});
  }catch{reject('storage_failed');}
 }
 return receipt;
}
export async function syncPublicEvidence(receipt,retrieval){
 if(!receipt)return receipt;
 delete receipt.indexError;
 try{if(receipt.stored&&retrieval)await retrieval.syncLedger?.('public_source_read');receipt.index=retrieval?.stats?.()?.ledger||null;}
 catch{receipt.index=null;receipt.indexError='Source records were saved, but vector synchronisation failed.';}
 receipt.learningStatus=!receipt.stored?'nothing_new_saved':receipt.index&&receipt.index.missing===0&&receipt.index.stale===0?'saved_and_indexed':'saved_not_fully_indexed';
 return receipt;
}
