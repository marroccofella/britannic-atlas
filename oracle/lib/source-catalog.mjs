// Discovery pointers, not facts. Every answer must read the current page text.
// Curated public authority URLs avoid spending a planner call to rediscover
// routine sources. Refusals remain refusals; no alternate-host WAF retries.
export function sourceCatalog(question,jurisdiction='Isle of Man'){
  const q=String(question||'');
  if(/^Isle of Man(?:$| and )/i.test(jurisdiction)&&/\b(?:Steam Packet|ferry|passenger)\b/i.test(q)&&/\b(?:ID|identification|identity checks|consultation)\b/i.test(q))return {family:'Ferry ID: consultation status and implementation are separate',urls:['https://consult.gov.im/home-affairs/proposal-for-id-on-steam-packet-journeys/','https://www.gov.im/news/2026/aug/05/steam-packet-id-consultation-results-published/']};
  if(/^Isle of Man(?:$| and )/i.test(jurisdiction)&&/\b(?:oldest|earliest|first beginnings|mesolithic|prehistor\w*|ancient monuments?|land[ -]?bridge|separat\w*)\b/i.test(q)&&!/\b(?:company|companies|legal separation|divorce|tax)\b/i.test(q)){
    const origins=/\b(?:oldest|earliest|first beginnings|mesolithic|prehistor\w*|settlement)\b/i.test(q)&&/\b(?:history|prehistor\w*|people|human|settlement|country|island|existence|dwellings?|mesolithic|beginnings|archaeolog\w*)\b/i.test(q);
    const separation=/\b(?:land[ -]?bridge|post[ -]?glacial|sea[ -]?level|ice age|Cumbria)\b/i.test(q)&&/\b(?:separat\w*|land[ -]?bridge|insularity)\b/i.test(q) || /\bseparat\w* from (?:England|Britain|Ireland|Scotland)\b/i.test(q);
    const monuments=/\b(?:ancient monuments?|archaeological (?:sites|record)|historic environment record)\b/i.test(q);
    if(!origins&&!separation&&!monuments)return null;
    return {family:'Early Manx history: settlement, geology and monument records are separate questions',urls:[
      ...(origins?['https://manxnationalheritage.im/wp-content/uploads/2020/05/MOTM-EarlyPeople-AMesolithic.pdf','https://www.archaeopress.com/Archaeopress/DMS/9A26816D482B4A05BD823311F1F20BA7/9781805832553-sample.pdf']:[]),
      ...(separation?['https://livrepository.liverpool.ac.uk/3166881/1/quaternary-06-00003-with-cover.pdf']:[]),
      ...(monuments?['https://isleofmanher.im/','https://manxnationalheritage.im/our-sites/type/coast-countryside-ancient-monuments/','https://manxnationalheritage.im/wp-content/uploads/2021/03/IOMHER-Access-Charging-Policy.pdf']:[]),
    ]};
  }
  if(/^Isle of Man/i.test(jurisdiction)&&/\b(?:foundations? (?:amendment|bill|act)|data.asset (?:foundation|register)|Foundations?\b.*\b(?:passed|assent|legislation|bill))\b/i.test(q))return {
    family:'Foundations amendment: passage, assent and implementation are separate checks',urls:[
      'https://tynwald.org.im/index.php/spfile?file=%2Fbusiness%2Fvp%2FVP%2F2026-PP-0094.pdf#page=7',
      'https://tynwald.org.im/index.php/spfile?file=%2Fbusiness%2Fhansard%2F20202040%2Fc260324.pdf#page=18',
      'https://consult.gov.im/economic-development/data-asset-register-registrar-consutation/results/darconsultationresponses.pdf#page=32',
    ]};
  if(/^Isle of Man/i.test(jurisdiction)&&/\b(?:religio\w*|faiths?|Catholics?|Muslims?|Hindus?|Sikhs?|Buddhis\w*|Jewish|Judaism|Anglican|Methodist|mosques?|synagogues?)\b/i.test(q))return {
    family:'Religion: official census respondent counts and community sources',urls:[
      'https://tynwald.org.im/spfile?file=%2Fbusiness%2Fopqp%2Fsittings%2F20212026%2F2022-GD-0014.pdf#page=28',
      ...(/Catholic/i.test(q)?['https://manxcatholic.org/contact/']:[]),
      ...(/Methodist|Anglican/i.test(q)?['https://www.methodist.org.im/chapels-communities.html']:[]),
      ...(/Anglican|churches/i.test(q)?['https://www.sodorandman.im/wp-content/uploads/Statement-of-Needs-V2.1-2023.pdf#page=5']:[]),
      ...(/historic|sectarian|conflict/i.test(q)?['https://manxnationalheritage.im/wp-content/uploads/2018/02/Family-History-Sheet-Library-and-Archive-Service-Digital.pdf']:[]),
      ...(/Muslim|Islam|mosque/i.test(q)?['https://iaiom.com/contact/']:[]),
    ]};
  const uk=/\b(?:UK|United Kingdom|Northern Ireland|England|Scotland|Wales)\b/i.test(q+' '+jurisdiction);
  if(uk&&/\b(?:company|companies|corporat(?:e|ion))\b/i.test(q)&&/\b(?:corporation tax|corporate tax|capital gains|small.profits|marginal relief|permanent establishment|taxable profits|tax.free|sell|dispos\w*)\b/i.test(q))return {
    family:'UK company taxation',urls:[
      'https://www.gov.uk/hmrc-internal-manuals/double-taxation-relief/dt1954',
      'https://www.gov.uk/corporation-tax-rates',
      'https://www.gov.uk/guidance/register-a-non-resident-company-who-disposed-of-uk-property-or-land-for-corporation-tax',
    ]};
  if(/^Isle of Man/i.test(jurisdiction)&&/\b(?:hotel|accommodation|tourism)\b/i.test(q)&&/\b(?:grant|grants|support|assistance|renovat\w*|reopen\w*)\b/i.test(q))return {
    family:'Visitor accommodation support',urls:[
      'https://www.iomdfenterprise.im/enterprise-support/all-schemes/financial-assistance-scheme/financial-assistance-scheme-visit/',
      'https://www.iomdfenterprise.im/media/zl3b1jbq/fas-visit-guidance.pdf',
    ]};
  if(/^Isle of Man/i.test(jurisdiction)&&/\b(?:manx gaelic|learn manx|culture vannin|in manx)\b/i.test(q)&&/\b(?:colours|colors|rainbow)\b/i.test(q))return {family:'Manx colour vocabulary',urls:[
    'https://www.learnmanx.com/learning/beginner/lesson-19---colours-and-shapes--556/',
  ]};
  if(/^Isle of Man/i.test(jurisdiction)&&/\b(?:fibre|fiber|telecom\w*)\b/i.test(q)&&/\b(?:law|code|apparatus|public road|street.works)\b/i.test(q))return {family:'Manx telecoms legislation',explicitOnly:true,urls:[
    'https://legislation.gov.im/cms/images/LEGISLATION/PRINCIPAL/2021/2021-0003/2021-0003_3.pdf',
  ]};
  return null;
}
