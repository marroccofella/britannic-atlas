import {evidenceCurrent} from './evidence-ledger.mjs';
export function knowledgeIntegrity(kb,retrieval){
 const at=new Date().toISOString();
 try{
  const sqlite=kb.db.prepare('PRAGMA quick_check').all().every(r=>Object.values(r)[0]==='ok');
  const foreignKeys=kb.db.prepare('PRAGMA foreign_key_check').all().length;
  const malformed=kb.db.prepare('SELECT count(*) n FROM claims WHERE NOT json_valid(sources) OR NOT json_valid(provenance) OR confidence<0 OR confidence>1 OR support<0 OR contradict<0').get().n;
  const excerpts=kb.db.prepare("SELECT id FROM claims WHERE kind='source_excerpt'").all().map(r=>kb.getClaim(r.id));
  const expired=excerpts.filter(c=>Date.parse(c.provenance?.sourceEvidence?.expiresAt)<=Date.now()).length;
  const invalid=excerpts.filter(c=>!evidenceCurrent(c)&&!(Date.parse(c.provenance?.sourceEvidence?.expiresAt)<=Date.now())).length;
  let fts=true;try{kb.db.exec("INSERT INTO claims_fts(claims_fts,rank) VALUES('integrity-check',1)");}catch{fts=false;}
  const index=retrieval?.stats?.()||null;
  const ok=sqlite&&fts&&!foreignKeys&&!malformed&&!invalid&&Boolean(index?.integrity?.ok)&&index?.ledger?.missing===0&&index?.ledger?.stale===0;
  return {ok,checkedAt:at,ledger:{sqlite,fts,foreignKeys,malformed,sourceExcerpts:excerpts.length,expiredExcerpts:expired,invalidExcerpts:invalid},index:index?{integrity:index.integrity,ledger:index.ledger,sync:index.sync}:null,meaning:'Storage consistency and source-record eligibility, not proof that every claim is true.'};
 }catch{return {ok:false,checkedAt:at,reason:'The integrity check could not complete; no healthy status is asserted.'};}
}
