// Short default list; preserve an explicitly selected voice from any language.
export function voiceOptions(voices,selectedName,{all=false,limit=8}={}) {
  if(all)return voices.slice();
  const english=voices.filter(v=>/^en(?:[-_]|$)/i.test(v.lang));
  const shortlist=(english.length?english:voices).slice(0,limit);
  const selected=voices.find(v=>v.name===selectedName);
  if(selected&&!shortlist.includes(selected))shortlist.push(selected);
  return shortlist;
}
