// Own-app QA only. A separate database and disabled expeditions keep user chats
// and paid research out of the browser verification.
import fs from 'node:fs';
import {questionComposerChecks} from './verify-question-composer.mjs';
import {installSpeechProbe,progressVoiceChecks} from './verify-progress-voice.mjs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:net';
import assert from 'node:assert/strict';
export async function browserChecks({root,output,playwrightModule}){
  const require=createRequire(import.meta.url),{chromium}=require(playwrightModule);
  fs.mkdirSync(output,{recursive:true});
  const probe=createServer();await new Promise((resolve,reject)=>{probe.once('error',reject);probe.listen(0,'127.0.0.1',resolve);});const port=probe.address().port;await new Promise(r=>probe.close(r));
  const base=`http://127.0.0.1:${port}`,child=spawn(process.execPath,['--experimental-strip-types','--disable-warning=ExperimentalWarning','oracle/server.mjs'],{cwd:root,windowsHide:true,env:{...process.env,ORACLE_PORT:String(port),ORACLE_DB:path.join(output,'test.db'),ORACLE_HOST:'127.0.0.1',ORACLE_EXPEDITIONS:'off',ORACLE_MOMM:'off',ORACLE_LATERAL:'off'},stdio:['ignore','pipe','pipe']});
  let log='',browser,page;const errors=[],consoleErrors=[];child.stdout.on('data',d=>{log+=d;});child.stderr.on('data',d=>{log+=d;});
  try{
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Isolated server startup timed out')),30000);const check=()=>{if(log.includes('[oracle] listening')){clearTimeout(timer);resolve();}};child.stdout.on('data',check);child.once('error',e=>{clearTimeout(timer);reject(e);});child.once('exit',()=>{clearTimeout(timer);reject(Error('Isolated server exited during startup'));});check();});
    browser=await chromium.launch({headless:true});page=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'});
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'||/permissions policy violation/i.test(m.text()))consoleErrors.push(m.text()+' '+JSON.stringify(m.location()));});
    await page.addInitScript(()=>{globalThis.observedLifecycle=[];const add=EventTarget.prototype.addEventListener;EventTarget.prototype.addEventListener=function(type,...args){if(['unload','beforeunload','pagehide','visibilitychange'].includes(type))globalThis.observedLifecycle.push(type);return add.call(this,type,...args);};});
    await page.route(base+'/',async route=>{const response=await route.fetch();await route.fulfill({response,headers:{...response.headers(),'permissions-policy':'unload=()'}});});
    const missing=await fetch(base+'/api/conversation?sessionId=missing-fixture&optional=1');assert.equal(missing.status,200);assert.equal((await missing.json()).conversation,null);
    assert.equal((await fetch(base+'/api/conversation?sessionId=missing-fixture')).status,404);
    // Synthetic recognition events exercise the real app callback without microphone access.
    await page.addInitScript(()=>{
      window.SpeechRecognition=class {
        constructor(){globalThis.uiRecognition=this;}
        start(){queueMicrotask(()=>this.onstart?.());}
        stop(){queueMicrotask(()=>this.onend?.());}
        abort(){}
      };
      navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Synthetic test: microphone disabled','NotAllowedError');};
    });
    await installSpeechProbe(page);
    await page.goto(base+'/#talk');
    await page.locator('#historyStatus').filter({hasText:'Saved on this computer after your first message.'}).waitFor({state:'attached',timeout:3000});
    assert.equal(await page.locator('#spokenProgress').isChecked(),true,'Voice feedback defaults on');
    // Secondary controls stay keyboard accessible without crowding the live voice surface.
    for(const selector of ['.listeningOptions','.historyDrawer','.suggestionDrawer']){
      const panel=page.locator(selector);assert.equal(await panel.getAttribute('open'),null);
      await panel.locator(':scope > summary').focus();await page.keyboard.press('Enter');
      assert.notEqual(await panel.getAttribute('open'),null);await page.keyboard.press('Enter');
    }
    await page.locator('.listeningOptions > summary').click();await page.locator('#conversation').check();
    await page.locator('.listeningOptions > summary').click();assert.equal(await page.locator('.listeningEnabled').isVisible(),true);
    await page.locator('.listeningOptions > summary').click();await page.locator('#conversation').uncheck();await page.locator('.listeningOptions > summary').click();
    const reducedCursor=await page.locator('#voiceConsole').evaluate(el=>{const old=el.dataset.state;el.dataset.state='listening';const animation=getComputedStyle(el.querySelector('#heard'),'::after').animationName;el.dataset.state=old;return animation;});assert.equal(reducedCursor,'none');
    await page.locator('#motionPreference').evaluate(el=>{el.value='on';el.dispatchEvent(new Event('change'));});
    assert.notEqual(await page.locator('#voiceConsole').evaluate(el=>{el.dataset.state='listening';return getComputedStyle(el.querySelector('#heard'),'::after').animationName;}),'none');
    await page.locator('#motionPreference').evaluate(el=>{el.value='off';el.dispatchEvent(new Event('change'));});
    assert.equal(await page.locator('#heard').evaluate(el=>getComputedStyle(el,'::after').animationName),'none');
    await page.locator('#motionPreference').evaluate(el=>{el.value='auto';el.dispatchEvent(new Event('change'));});
    await page.locator('#voiceConsole').evaluate(el=>{el.dataset.state='idle';});
    const expiredEcho=await page.evaluate(async()=>{
      const {mountActivityProgress}=await import('/activity-progress.mjs');const stage=document.createElement('section');stage.className='stage';const root=document.createElement('div');root.id='activityProgress';root.className='activityProgress';const status=document.createElement('p');status.className='liveStatus activityEcho';stage.append(root,status);document.body.append(stage);let now=0;
      const panel=mountActivityProgress(root,{clock:()=>now,announce:s=>{status.textContent=s;}});panel.start('terminal','searching');panel.finish('terminal','failed');const during=getComputedStyle(status).position;now=10000;panel.render();const result={during,after:getComputedStyle(status).position,text:status.textContent,hidden:root.hidden};panel.destroy();stage.remove();return result;
    });assert.deepEqual(expiredEcho,{during:'absolute',after:'static',text:'Could not finish',hidden:true});
    let speechRequests=0;const countSpeech=request=>{if(/\/api\/(ask|expedition|deliberate)$/.test(request.url()))speechRequests++;};page.on('request',countSpeech);
    await page.locator('#orb').click();await page.locator('#voiceConsole[data-state="listening"]').waitFor();
    const voiceWords=await page.evaluate(()=>{
      const send=(final,interim)=>{const rows=[];if(final){const r=[{transcript:final,confidence:.98}];r.isFinal=true;rows.push(r);}if(interim){const r=[{transcript:interim,confidence:.98}];r.isFinal=false;rows.push(r);}globalThis.uiRecognition.onresult({results:rows});};
      send('Tell me about','Peal');const settled=document.querySelector('#heard .final');send('Tell me about','Peel');
      const stable=settled===document.querySelector('#heard .final'),corrected=document.querySelector('#heard').textContent==='Tell me about Peel';
      send('Tell me about','<img src=x onerror=alert(1)>');const literal=document.querySelector('#heard').textContent.includes('<img'),injected=document.querySelectorAll('#heard img, #heard script').length;
      send('Tell me about','Peel and its history');return {stable,corrected,literal,injected};
    });assert.deepEqual(voiceWords,{stable:true,corrected:true,literal:true,injected:0});
    await page.screenshot({path:path.join(output,'matrix-listening.png'),fullPage:true});await page.keyboard.press('Escape');
    assert.equal(speechRequests,0,'Escape cancels the synthetic draft without dispatch');page.off('request',countSpeech);
    const voiceFeedback=await progressVoiceChecks(page);
    const questionInput=await questionComposerChecks(page,consoleErrors);
    const input=page.locator('#askText'),submit=()=>page.locator('#askForm').evaluate(el=>el.requestSubmit());
    await input.fill('How big is your knowledge base?');const response=page.waitForResponse(r=>r.url()===base+'/api/ask');await submit();
    const body=await (await response).text();assert.match(body,/"costUsd":0/);assert.match(body,/"knowledgeMap":/);await page.getByText('The Manx ledger holds',{exact:false}).waitFor();
    const session=await page.evaluate(()=>sessionStorage.getItem('oracle.session.v2'));
    const low=await fetch(base+'/api/ask',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({sessionId:'isolated-speech-fixture',requestId:'speech-fixture',clientTurn:100,question:'Learn about the TT races',source:'speech',recognitionConfidence:.4})}).then(r=>r.text());
    assert.doesNotMatch(low,/event: expedition/);const lowMeta=JSON.parse(low.match(/event: meta\r?\ndata: ([^\r\n]+)/)[1]);assert.equal(lowMeta.mode,'clarify');assert.equal(lowMeta.costUsd,0);assert.equal(lowMeta.researchable,false);assert.equal(lowMeta.model,null);assert.ok(low.includes('I heard “Learn about the TT races”, but I could not make out a request in it. Say it again, or type it below.'));
    for(const [question,key]of [['What version of MOMM are you using?','mommRuntime'],['Check knowledge base integrity','knowledgeIntegrity'],['How does your knowledge base work?','knowledgeRuntime']]){
      await input.fill(question);const response=page.waitForResponse(r=>r.url()===base+'/api/ask');await submit();const text=await(await response).text();
      assert.match(text,new RegExp('"'+key+'":'));assert.match(text,/"costUsd":0/);
    }
    const integrity=await fetch(base+'/api/knowledge/integrity').then(r=>r.json());assert.ok(integrity.checkedAt);assert.equal(integrity.ledger.sqlite,true);
    await page.route('**/api/ask',async route=>{const event=(n,d)=>`event: ${n}\ndata: ${JSON.stringify(d)}\n\n`;await route.fulfill({status:200,contentType:'text/event-stream',body:event('token',{text:'Synthetic answer for citation display testing.'})+event('meta',{episodeId:'fixture-evidence',status:'model_prior',confidence:.5,answered:true,reviewable:false,used:[],grounding:{retrieved:3,cited:0,status:'uncited_retrieval'},knowledgeWrite:{stored:1,added:1,refreshed:0,rejected:0,entries:[{text:'Synthetic saved archaeology passage.',sources:[{url:'https://manxnationalheritage.im/our-sites/cass-ny-hawin/',title:'MNH source'}]}],index:{indexable:1,indexed:1,missing:0,stale:0}},nextSteps:[]})+event('done',{episodeId:'fixture-evidence'})});});
    await input.fill('Synthetic citation test');await submit();const label=page.getByText('Relevant records were retrieved, but this answer did not cite them.',{exact:false});await label.waitFor({state:'attached'});await label.locator('..').locator('summary').focus();await page.keyboard.press('Enter');await label.waitFor({state:'visible'});
    const savedKnowledge=page.locator('.knowledgeReceipt').last();await savedKnowledge.locator('summary').focus();await page.keyboard.press('Enter');await savedKnowledge.getByRole('link',{name:'MNH source',exact:true}).waitFor({state:'visible'});assert.match(await savedKnowledge.innerText(),/1 added, 0 refreshed/);
    await page.unroute('**/api/ask');
    // Hold a real UI request before any response, then deliver operation events.
    let releaseProgress;const progressGate=new Promise(r=>{releaseProgress=r;});
    await page.locator('#spokenProgress').evaluate(el=>{el.checked=false;el.dispatchEvent(new Event('change'));});
    await page.route('**/api/ask',async route=>{await progressGate;const event=(n,d)=>'event: '+n+'\ndata: '+JSON.stringify(d)+'\n\n';await route.fulfill({status:200,contentType:'text/event-stream',body:event('progress',{phase:'thinking'})+event('token',{text:'Synthetic progress answer.'})+event('meta',{answered:true,status:'local',used:[],nextSteps:[]})+event('done',{})});});
    await input.fill('Synthetic delayed progress test');await submit();
    const activity=page.locator('#activityProgress');await activity.locator('.activityLine > span:first-child').filter({hasText:/^Preparing your request$/}).waitFor();
    assert.equal(await activity.locator('.activityElapsed').getAttribute('aria-hidden'),'true');assert.match(await page.locator('#liveStatus').innerText(),/Preparing your request/);assert.doesNotMatch(await page.locator('#liveStatus').innerText(),/^Ready/);
    await page.waitForTimeout(15500);await activity.getByText('Still waiting for the next result. You can interrupt or ask another question.',{exact:true}).waitFor();
    assert.doesNotMatch(await activity.innerText(),/Searching the web|Reading a source/);
    releaseProgress();await page.getByText('Synthetic progress answer.',{exact:true}).waitFor();await activity.getByText('Finished',{exact:true}).waitFor();
    await activity.getByText('Activity details',{exact:true}).focus();await page.keyboard.press('Enter');await activity.getByText('Preparing the answer',{exact:true}).waitFor({state:'visible'});await page.unroute('**/api/ask');
    const progressDom=await page.evaluate(async()=>{const {mountActivityProgress,toolActivity}=await import('/activity-progress.mjs'),root=document.createElement('div'),announcements=[];document.body.append(root);let now=0;const panel=mountActivityProgress(root,{clock:()=>now,announce:s=>announcements.push(s),speechOptions:()=>({enabled:false})});panel.start('a','preparing');panel.update('a',{phase:'reviewing',detail:'<img src=x onerror=alert(1)>'});const literal=root.textContent.includes('<img src=x onerror=alert(1)>'),injected=root.querySelectorAll('img,script').length;panel.update('a',toolActivity({name:'read_page',status:'working',message:'C:/private/SECRET',url:'https://example.test/?token=SECRET'}));const leaked=root.textContent.includes('SECRET'),before=announcements.length;now=1000;panel.render();const timerSilent=announcements.length===before;panel.finish('a');const finished=announcements.length;now=10000;panel.render();const removalSilent=announcements.length===finished;panel.destroy();root.remove();return {literal,injected,leaked,timerSilent,removalSilent};});assert.deepEqual(progressDom,{literal:true,injected:0,leaked:false,timerSilent:true,removalSilent:true});
    const reasoningFixture={schema:'mani-reasoning/1',kind:'design',objective:'Synthetic workflow <img src=x onerror=alert(1)>',checks:[{id:'objective',question:'What outcome would satisfy the request?',note:'A boundary test reproduces the failure.'}],assumptions:['The saved state matters.'],sourceChecks:[],weaknesses:[{issue:'Missing saved-state test',test:'Reload the synthetic fixture.',evidenceIds:[]}],opportunities:[{change:'Add a saved-state regression',successTest:'It fails before repair and passes afterwards.'}],counterexamples:[],nextStep:'Run the synthetic case.',sources:[{claimId:'c_one',url:'https://www.gov.im/census',title:'Official source'},{url:'javascript:alert(1)',title:'Unsafe link'}]};
    await page.route('**/api/ask',async route=>{const event=(n,d)=>'event: '+n+'\ndata: '+JSON.stringify(d)+'\n\n';await route.fulfill({status:200,contentType:'text/event-stream',body:event('token',{text:'Synthetic reasoning answer.'})+event('meta',{status:'model_prior',answered:true,reviewable:false,used:[],nextSteps:[],reasoningCheck:reasoningFixture})+event('done',{})});});
    await input.fill('Synthetic reasoning display');await submit();const reasoning=page.locator('.reasoningCheck').first();await reasoning.locator('summary').waitFor();await reasoning.locator('summary').focus();await page.keyboard.press('Enter');await reasoning.getByText('Possible weaknesses',{exact:true}).waitFor({state:'visible'});assert.match(await reasoning.innerText(),/saved with the conversation/);assert.equal(await reasoning.locator('img,script').count(),0);assert.equal(await reasoning.locator('a').count(),1);await reasoning.getByRole('button',{name:'Read reasoning check aloud',exact:true}).focus();
    const readback=await page.evaluate(async data=>{const {renderReasoningCheck}=await import('/reasoning-view.mjs');const el=document.createElement('div');let spoken='';renderReasoningCheck(el,data,{readAloud:text=>{spoken=text;}});el.querySelector('button').click();renderReasoningCheck(el,data);return {spoken,panels:el.querySelectorAll('.reasoningCheck').length};},reasoningFixture);assert.match(readback.spoken,/Proposed test: Reload the synthetic fixture/);assert.equal(readback.panels,1);
    await page.unroute('**/api/ask');
    await page.route('**/api/ask',async route=>{const event=(n,d)=>`event: ${n}\ndata: ${JSON.stringify(d)}\n\n`;await route.fulfill({status:200,contentType:'text/event-stream',body:event('token',{text:'Synthetic no-save answer.'})+event('meta',{status:'model_prior',answered:true,reviewable:false,used:[],tools:[],knowledgeWrite:{stored:0,rejected:0,omitted:0,reason:'private or out-of-scope request'},nextSteps:[]})+event('done',{})});});
    await input.fill('Synthetic no-save test');await submit();await page.getByText('Synthetic no-save answer.',{exact:true}).waitFor();
    await page.unroute('**/api/ask');
    await page.route('**/api/ask',async route=>{const event=(n,d)=>'event: '+n+'\ndata: '+JSON.stringify(d)+'\n\n';await route.fulfill({status:200,contentType:'text/event-stream',body:event('token',{text:'Which subject should I expand?'})+event('meta',{mode:'clarify',status:'local',conversationMeta:true,answered:true,used:[],nextSteps:[]})+event('done',{})});});
    await input.fill('Synthetic legacy clarification');await submit();const clarification=page.locator('#transcript > .turn').first();await clarification.getByText('needs clarification',{exact:true}).waitFor();await clarification.getByRole('button',{name:'Read aloud',exact:true}).waitFor();await activity.getByText('Could not finish',{exact:true}).waitFor();assert.equal(await activity.getByText('Finished',{exact:true}).count(),0);assert.doesNotMatch(await clarification.innerText(),/That answer did not arrive|Source check incomplete/);
await page.unroute('**/api/ask');
    let retryQuestion=null,oldMenuShown=false;
    await page.route('**/api/ask',async route=>{const q=route.request().postDataJSON().question;retryQuestion=q;const event=(n,d)=>'event: '+n+'\ndata: '+JSON.stringify(d)+'\n\n';const text=oldMenuShown?'Synthetic retry completed.':'We’re focused on the Isle of Man. Do you want its infrastructure, companies and law, government, geography, or a full island overview?';oldMenuShown=true;await route.fulfill({status:200,contentType:'text/event-stream',body:event('token',{text})+event('meta',{mode:text.startsWith('We’re')?'clarify':'answer',status:'local',conversationMeta:true,answered:!text.startsWith('We’re'),used:[],nextSteps:[]})+event('done',{})});});
    await input.fill('Synthetic original tide request');await submit();const oldTurn=page.locator('#transcript > .turn').first();const retry=oldTurn.getByRole('button',{name:'Retry original question',exact:true});await retry.waitFor();assert.doesNotMatch(await oldTurn.innerText(),/Please answer the clarification above/);await retry.focus();await page.keyboard.press('Enter');await page.getByText('Synthetic retry completed.',{exact:true}).waitFor();assert.equal(retryQuestion,'Synthetic original tide request');await page.unroute('**/api/ask');
assert.equal(await page.locator('.knowledgeReceipt').count(),1,'An empty receipt does not add a save-failure panel');
    assert.equal(await page.getByRole('button',{name:'',exact:true}).count(),0,'Visible buttons have accessible names');
    await input.fill('Draft retained across page events');await page.evaluate(()=>{dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));document.dispatchEvent(new Event('visibilitychange'));});assert.equal(await input.inputValue(),'Draft retained across page events');assert.match(await page.locator('#askCount').textContent(),/^33 \/ 12,000/);
    const lifecycle=await page.evaluate(()=>globalThis.observedLifecycle);assert.equal(lifecycle.some(t=>/unload/.test(t)),false);assert.ok(lifecycle.includes('pagehide'),'App registered pagehide cleanup');
    let discoveryRequests=0;const countDiscovery=request=>{if(/\/api\/(ask|expedition|deliberate|canvas)$/.test(request.url()))discoveryRequests++;};page.on('request',countDiscovery);
    await page.getByRole('link',{name:'Explore the island',exact:true}).click();
    const government=page.locator('.dx-branches button').filter({has:page.locator('strong',{hasText:/^Government$/})});await government.focus();await page.keyboard.press('Enter');
    await page.getByRole('heading',{name:'Government',exact:true}).waitFor();assert.match(decodeURIComponent(page.url()),/#explore=isle-of-man\/government$/);
    await page.locator('.dx-branches button').first().click();const nested=page.url();assert.notEqual(decodeURIComponent(nested).split('#')[1],'explore=isle-of-man/government');
    await page.goBack();await page.getByRole('heading',{name:'Government',exact:true}).waitFor();await page.goForward();assert.equal(page.url(),nested);
    await page.setViewportSize({width:390,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Explorer fits a phone viewport');await page.screenshot({path:path.join(output,'explorer-390.png'),fullPage:true});
    const discoveryDraft=page.locator('.dx-question-label textarea');assert.equal(await discoveryDraft.getAttribute('maxlength'),null);
    await discoveryDraft.fill('x'.repeat(12001));await page.getByRole('button',{name:'Bring question to Mannin',exact:true}).click();assert.match(await page.locator('#dx-question-error').textContent(),/12,001/);assert.equal(await discoveryDraft.inputValue(),'x'.repeat(12001));assert.ok(page.url().includes('#explore'));
    await discoveryDraft.fill('Explore this topic. '+ 'x'.repeat(8000));assert.match(await page.locator('#dx-question-count').textContent(),/8,020/);
    const discoveryQuestion=await discoveryDraft.inputValue();await page.getByRole('button',{name:'Bring question to Mannin',exact:true}).click();await input.waitFor({state:'visible'});assert.equal(await input.inputValue(),discoveryQuestion);assert.match(await page.locator("#askCount").textContent(),/8,020/);
    assert.equal(await page.evaluate(()=>sessionStorage.getItem('oracle.session.v2')),session);await page.getByRole('button',{name:'Restore my previous draft',exact:true}).click();assert.equal(await input.inputValue(),'Draft retained across page events');
    assert.equal(discoveryRequests,0,'Browsing and preparing a draft must not dispatch an answer or paid action');page.off('request',countDiscovery);
    for(const width of [390,1280]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow at '+width+'px');await page.screenshot({path:path.join(output,`browser-${width}.png`),fullPage:true});}
    await page.reload();await page.getByText('The Manx ledger holds',{exact:false}).waitFor();assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);
    const result={status:'passed',...voiceFeedback,...questionInput,matrixDraftCorrections:true,motionPreferenceOverridesSystem:true,expiredActivityRestoresVisibleStatus:true,matrixLiteralSpeech:true,stableTranscriptNodes:true,keyboardDisclosures:true,reducedMotionCursor:true,speechEscapeNoDispatch:true,progressSpeechDefaultsOn:true,textNodeProgress:true,clarificationActivityNotFinished:true,immediateActivity:true,quietWaitHonesty:true,activityTimerNotAnnounced:true,activityDetailsKeyboard:true,legacyMenuRetryKeyboard:true,clarificationStatusAndPlayback:true,realRuntimeVersionEndpoint:true,realIntegrityEndpoint:true,realKnowledgeEndpoint:true,knowledgeArchitectureEndpoint:true,knowledgeReceiptCitations:true,reasoningDisclosureKeyboard:true,reasoningReadback:true,reasoningEscapesContent:true,lowConfidenceSpeechHeld:true,uncitedRetrievalVisible:true,keyboardSourceDisclosure:true,buttonNames:true,draftSurvivesPageEvents:true,historySurvivesReload:true,explorerDrillDown:true,explorerHistory:true,explorerDraftRestore:true,explorerNoDispatch:true,viewports:[390,1280],unloadListeners:0,errors,consoleErrors};fs.writeFileSync(path.join(output,'browser.json'),JSON.stringify(result,null,2));return result;
  }catch(error){if(page){await page.screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{});const overflow=await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(el=>el.getBoundingClientRect().right>innerWidth+1&&getComputedStyle(el).display!=='none').slice(0,12).map(el=>({tag:el.tagName,class:el.className,width:el.getBoundingClientRect().width}))).catch(()=>[]);fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({error:error.message,stack:error.stack,overflow},null,2));}throw error;}finally{await browser?.close();if(child.pid&&child.exitCode===null){const stopped=once(child,'exit');child.kill();await stopped;}fs.writeFileSync(path.join(output,'server.log'),log);}
}
