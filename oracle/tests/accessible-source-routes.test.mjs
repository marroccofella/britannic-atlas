import test from 'node:test';
import assert from 'node:assert/strict';
import { readablePage, createPublicReader } from '../lib/public-reader.mjs';
const proceedings='https://tynwald.org.im/index.php/spfile?file=%2Fbusiness%2Fvp%2FVP%2F2026-PP-0094.pdf';

test('official public Tynwald download routes survive URL validation and redirects', async()=>{
 assert.equal(readablePage(proceedings),proceedings);
 const get=async url=>url===proceedings?{status:200,headers:{'content-type':'application/pdf'},body:Buffer.from('%PDF-public document')}:{status:302,headers:{location:proceedings},body:''};
 const read=createPublicReader({get,wait:async()=>{}});
 assert.equal((await read('https://tynwald.org.im/business/vp/VP/2026-PP-0094.pdf')).url,proceedings);
});
test('public government presentation and legislation download parameters are preserved',()=>{
 const urls=['https://www.gov.im/news/?altTemplate=ViewCategorisedNews&id=193895','https://www.gov.im/about-the-government/departments/home-affairs/isle-of-man-prison-and-probation-service/?iomg-device=Desktop','https://legislation.gov.im/cms/legislation/current/by-title.html?download=149%3Afoundations-act-2011'];
 for(const url of urls)assert.equal(readablePage(url),url);
});
test('publisher-specific parameters do not open arbitrary file or access-token routes',()=>{
 const bad=['https://example.org/index.php/spfile?file=/business/report.pdf','https://tynwald.org.im/index.php/spfile?file=https://127.0.0.1/report.pdf','https://tynwald.org.im/index.php/spfile?file=/business/../private.pdf','https://tynwald.org.im/index.php/spfile?file=%252Fbusiness%252Freport.pdf','https://tynwald.org.im/index.php/spfile?file=/business/report.pdf&file=/business/other.pdf','https://www.gov.im/news/?altTemplate=Admin&id=1','https://www.gov.im/news/?iomg-device=secret','https://example.org/?download=149%3Areport','https://legislation.gov.im/cms/legislation/current/by-title.html?download=https://localhost/secret','https://tynwald.org.im/index.php/spfile?file=/business/report.pdf&token=secret'];
 for(const url of bad)assert.equal(readablePage(url),null,url);
});
