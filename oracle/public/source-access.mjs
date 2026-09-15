// Display source access separately from evidence. Failed reads are never citations.
export function accessRows(calls) {
  const rows=[];
  for(const item of (Array.isArray(calls)?calls:[]).slice(0,12)) {
    if(!item||!(item.status==='unavailable'||item.notice))continue;
    let url=null;
    try {
      if(!item.url)throw new Error('diagnostic only');
      const parsed=new URL(item.url);
      if(parsed.protocol!=='https:'||parsed.username||parsed.password)continue;
      if([...parsed.searchParams.keys()].some(key=>/token|secret|key|password|auth|signature|session/i.test(key)))continue;
      url=parsed.href;
    }catch{if(item.url)continue;}
    rows.push({url,host:url?new URL(url).hostname:'Source search',status:item.status,reason:String(item.reason||item.notice||'').slice(0,350),retryAt:Number.isFinite(Date.parse(item.retryAt))?new Date(item.retryAt).toLocaleString():null});
  }
  return rows;
}

export function renderSourceAccess(turn,calls) {
  turn.querySelector('.sourceAccess')?.remove();
  const rows=accessRows(calls);if(!rows.length)return;
  const doc=turn.ownerDocument,section=doc.createElement('section');section.className='sourceAccess nextSteps';
  section.setAttribute('aria-label','Source access and recovery');
  const title=doc.createElement('strong');title.textContent='Source access';section.append(title);
  for(const row of rows){
    const p=doc.createElement('p');p.textContent=`${row.host}: ${row.reason}`;section.append(p);
    if(row.url){const a=doc.createElement('a');a.href=row.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=row.status==='unavailable'?'Open page in browser':'Open source document';section.append(a);}
    if(row.retryAt){const time=doc.createElement('p');time.textContent=`Try again after ${row.retryAt}.`;section.append(time);}
  }
  if(rows.some(row=>row.status==='unavailable')){
    const help=doc.createElement('p');help.textContent='Unavailable sources are not evidence. Any successfully read alternative is listed with the answer. You can say ‘search again’ to request another source check here.';section.append(help);
  }
  const anchor=turn.querySelector('.nextSteps');if(anchor)anchor.after(section);else turn.append(section);
}
