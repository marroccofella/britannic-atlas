// Fixed public locality coordinates, not user location or station measurements.
export const WEATHER_PLACES=Object.freeze([
 {name:'Douglas',lat:54.1523,lon:-4.4861},{name:'Ramsey',lat:54.3227,lon:-4.3853},
 {name:'Peel',lat:54.2220,lon:-4.6950},{name:'Castletown',lat:54.0742,lon:-4.6539},
 {name:'Onchan',lat:54.1733,lon:-4.4532},{name:'Port Erin',lat:54.0850,lon:-4.7589},
 {name:'Port St Mary',lat:54.0741,lon:-4.7386},{name:'Laxey',lat:54.2301,lon:-4.3991},
].map(Object.freeze));
export function weatherConceptQuestion(q){
 return /\b(?:average|climate|historical|history|yesterday|last|ago|was|were|causes?|rainbow|boiling|sea temperature|water temperature|body|baby|oven|cooking|concrete|should|means?|definition)\b/i.test(q)||(/\b(?:measured|measurement)\b/i.test(q)&&! /\b(?:current|latest|now|today|Ronaldsway|Douglas)\b/i.test(q));
}
export function townWeatherPlaces(question){
 const q=String(question||'');
 if(weatherConceptQuestion(q)||!/\b(?:temperatures?|weather|hot|cold|warm)\b/i.test(q)||/\b(?:forecast|tomorrow|next week|weekend)\b/i.test(q))return [];
 const named=WEATHER_PLACES.filter(p=>new RegExp('\\b'+p.name+'\\b','i').test(q));
 if(/\b(?:every|all|major|main)\b.{0,35}\b(?:towns?|cities|city|places|settlements)\b|\b(?:towns?|cities)\b.{0,30}\b(?:every|all|major|main)\b/i.test(q))return [...WEATHER_PLACES];
 return named;
}
export function townWeatherUrl(places){
 if(!places.length||places.length>WEATHER_PLACES.length||places.some(p=>!WEATHER_PLACES.includes(p)))throw Error('Unknown weather locality.');
 const url=new URL('https://api.open-meteo.com/v1/forecast');
 url.search=new URLSearchParams({latitude:places.map(p=>p.lat).join(','),longitude:places.map(p=>p.lon).join(','),current:'temperature_2m',temperature_unit:'celsius',timeformat:'unixtime',timezone:'GMT',forecast_days:'1'});
 return url.href;
}
export function parseTownWeather(body,places,at=new Date()){
 const parsed=JSON.parse(body),rows=Array.isArray(parsed)?parsed:[parsed];
 if(rows.length!==places.length)throw Error('The weather response did not cover every requested locality.');
 const readings=[],missing=[];
 rows.forEach((row,i)=>{
  const place=places[i],t=row?.current?.temperature_2m,time=Number(row?.current?.time)*1000;
  const location=typeof row?.latitude==='number'&&typeof row?.longitude==='number'&&Math.abs(row.latitude-place.lat)<.12&&Math.abs(row.longitude-place.lon)<.18;
  if(!location||row?.current_units?.temperature_2m!=='°C'||row?.current_units?.time!=='unixtime'||typeof t!=='number'||!Number.isFinite(t)||t< -50||t>60||!Number.isFinite(time)||at-time>2*3600000||time-at>300000){missing.push(place.name);return;}
  readings.push({place:place.name,temperatureC:t,validAt:new Date(time).toISOString(),kind:'model estimate'});
 });
 if(!readings.length)throw Error('No fresh, correctly located temperature estimates were returned.');
 const text='Open-Meteo model estimates, not thermometer measurements: '+readings.map(r=>`${r.place}, ${r.temperatureC} degrees Celsius at ${r.validAt.replace('T',' ').replace(':00.000Z',' UTC')}`).join('; ')+'.'+(missing.length?' No usable estimate was returned for '+missing.join(', ')+'.':'')+' Nearby places can share the same model grid and temperature.'+(places.length===WEATHER_PLACES.length?' Coverage is limited to the eight places listed.':'');
 return {text,readings,missing,partial:missing.length>0,provider:'Open-Meteo',kind:'model estimates',at:at.toISOString()};
}
