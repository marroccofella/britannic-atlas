import {load} from 'cheerio';
import {approvedPage} from '../public/page-actions.mjs';

const page=approvedPage('weather');
const clean=value=>String(value||'').replace(/\s+/g,' ').trim();

// Parse the displayed issuance time as Island local time, not the host's timezone.
export function parseForecast(html,at=new Date()) {
  if(/request rejected|access denied|captcha/i.test(html))throw Error('The official site blocked this request.');
  const $=load(html),issued=clean($('.weather-issued').first().text());
  const parts=/Issued on \w+, (\d{1,2}) (\w+) (\d{4}) at (\d{1,2}):(\d{2})(am|pm) by Ronaldsway Met Office/i.exec(issued);
  if(!parts)throw Error('The page did not contain a recognisable forecast issue time.');
  const month=['january','february','march','april','may','june','july','august','september','october','november','december'].indexOf(parts[2].toLowerCase());
  const hour=Number(parts[4])%12+(parts[6].toLowerCase()==='pm'?12:0);
  if(month<0 || Number(parts[4])<1 || Number(parts[4])>12 || Number(parts[5])>59)throw Error('Invalid forecast issue time.');
  const nominal=Date.UTC(Number(parts[3]),month,Number(parts[1]),hour,Number(parts[5]));
  const formatter=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Isle_of_Man',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  const expected=`${parts[1].padStart(2,'0')}/${String(month+1).padStart(2,'0')}/${parts[3]}, ${String(hour).padStart(2,'0')}:${parts[5]}`;
  const issuedAt=[nominal,nominal-3600000].find(value=>formatter.format(new Date(value))===expected);
  if(issuedAt===undefined || at.getTime()-issuedAt>18*3600000 || issuedAt-at.getTime()>5*60000)throw Error('The forecast issue time is stale or in the future.');
  const paragraphs=$('.weather-issued').first().nextUntil('div,h2,h3').filter('p').map((_,p)=>clean($(p).text())).get();
  const forecast=paragraphs.slice(0,2).join(' ');
  if(forecast.length<30 || forecast.length>2500)throw Error('The current forecast text was missing or unexpected.');
  return {issued,issuedAt:new Date(issuedAt).toISOString(),forecast,fetchedAt:at.toISOString()};
}

// One fixed public URL, no crawling, redirects, model calls, stale-cache fallback or retries.
export async function readWeather({fetcher=fetch,signal,at=new Date()}={}) {
  const timeout=AbortSignal.timeout(6000),requestSignal=signal?AbortSignal.any([signal,timeout]):timeout;
  try {
    const response=await fetcher(page.href,{redirect:'error',signal:requestSignal,headers:{Accept:'text/html'}});
    if(!response.ok)throw Error(`The official page returned HTTP ${response.status}.`);
    if(!/text\/html/i.test(response.headers.get('content-type')||''))throw Error('The official page did not return HTML.');
    const reader=response.body.getReader();let bytes=0;const chunks=[];
    try {for(;;){const {value,done}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>512000)throw Error('The page exceeded the safe reading limit.');chunks.push(value);}}
    finally {await reader.cancel().catch(()=>{});reader.releaseLock();}
    const data=parseForecast(Buffer.concat(chunks).toString('utf8'),at);
    return {...data,ok:true,page,text:`The Ronaldsway Met Office forecast for the Isle of Man, ${data.issued.replace(/^Issued on /,'issued on ')}: ${data.forecast}`};
  } catch(error) {
    if(signal?.aborted)throw error;
    return {ok:false,page,reason:error.name==='TimeoutError'?'The official page took too long to respond.':error.message,text:'I couldn’t read a fresh official forecast just now. I can open the official weather page; say “open it” or use the link below.'};
  }
}
