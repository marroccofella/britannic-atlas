import {load} from 'cheerio';import {readablePage} from './public-reader.mjs';import {tideRequest} from '../public/reasoning-methods.mjs';
// One bounded detail layer for a tide-table task, never an unrestricted crawler.
export function sourceFollowups(body,base,question){
 if(!tideRequest(question))return [];
 const $=load(String(body));$('script,style,nav,header,footer').remove();const found=new Map();
 for(const el of $('a[href]').toArray()){
  const label=$(el).text().replace(/\s+/g,' ').trim();let url;try{url=readablePage(new URL($(el).attr('href'),base).href);}catch{continue;}
  if(!url||url===readablePage(base)||!/\b(?:tide|tides|tidal)\b/i.test(label+' '+new URL(url).pathname.replace(/[-_/]/g,' ')))continue;
  if(/\b(?:login|register|subscribe|account|buy|booking|payment|flapgate|flood warning)\b/i.test(label+' '+new URL(url).pathname))continue;
  const place=/\b(?:Douglas|Ramsey|Peel|Castletown|Port Erin|Port St Mary|Laxey)\b/i.test(label);
  found.set(url,{url,label,score:place?2:1});
 }
 return [...found.values()].sort((a,b)=>b.score-a.score).slice(0,6);
}
