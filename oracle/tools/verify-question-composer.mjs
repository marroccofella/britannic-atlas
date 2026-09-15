import assert from 'node:assert/strict';
import {MAX_MESSAGE_CHARS} from '../public/conversation-policy.mjs';
// Real browser keyboard and button dispatch; synthetic answers avoid provider calls.
export async function questionComposerChecks(page,consoleErrors){
 const errorsBefore=consoleErrors.length;
 const input=page.locator('#askText'),button=page.locator('#askForm button[type="submit"]'),count=page.locator('#askCount'),error=page.locator('#askError');
 const sent=[];let offline=false;
 const event=(n,d)=>'event: '+n+'\ndata: '+JSON.stringify(d)+'\n\n';
 await page.route('**/api/ask',async route=>{sent.push(route.request().postDataJSON().question);if(offline){await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Synthetic input service unavailable.'})});return;}const text='Synthetic input reply '+sent.length+'.';await route.fulfill({status:200,contentType:'text/event-stream',body:event('token',{text})+event('meta',{answered:true,status:'local',used:[],nextSteps:[]})+event('done',{})});});
 try{
  assert.equal(await input.evaluate(el=>el.tagName),'TEXTAREA');assert.equal(await input.getAttribute('maxlength'),null);
  await input.fill('First line');await input.press('Shift+Enter');await page.keyboard.insertText('Second line');assert.equal(await input.inputValue(),'First line\nSecond line');assert.equal(sent.length,0);
  await input.evaluate(el=>{el.dispatchEvent(new CompositionEvent('compositionstart'));el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',isComposing:true,bubbles:true}));el.dispatchEvent(new CompositionEvent('compositionend'));});assert.equal(sent.length,0);
  await input.press('Enter');await page.getByText('Synthetic input reply 1.',{exact:true}).waitFor();assert.equal(sent[0],'First line\nSecond line');assert.equal(await input.inputValue(),'');assert.match(await count.textContent(),/^0 \/ 12,000/);
  const head='Please examine this synthetic prompt.\n',tail='\nRetain this ending.',long=head+'x'.repeat(MAX_MESSAGE_CHARS-head.length-tail.length)+tail;
  await input.focus();await page.keyboard.insertText(long);assert.equal(await input.inputValue(),long);assert.match(await count.textContent(),/^12,000 \/ 12,000/);await button.click();await page.getByText('Synthetic input reply 2.',{exact:true}).waitFor();assert.equal(sent[1],long);
  await input.fill(long);await input.press('Enter');await page.getByText('Synthetic input reply 3.',{exact:true}).waitFor();assert.equal(sent[2],long);
  const oversized=long+'x';await input.fill(oversized);await input.press('Enter');await button.click();assert.equal(await input.inputValue(),oversized);assert.match(await error.textContent(),/12,001 \/ 12,000/);assert.equal(await error.isVisible(),true);assert.equal(await input.getAttribute('aria-invalid'),'true');assert.equal(sent.length,3);
  await input.fill('');await button.click();assert.match(await error.textContent(),/Type a question/);assert.equal(sent.length,3);
  offline=true;await input.fill(long);await button.click();await page.getByText('Synthetic input service unavailable.',{exact:true}).waitFor();await page.waitForFunction(q=>document.querySelector('#askText').value===q,long);assert.match(await count.textContent(),/^12,000 \/ 12,000/);assert.equal(sent[3],long);
  await input.fill('');
  const expectedErrors=consoleErrors.slice(errorsBefore);assert.equal(expectedErrors.length,1,'Exactly one deliberate HTTP failure is expected');assert.match(expectedErrors[0],/status of 503/);assert.ok(expectedErrors[0].includes('/api/ask'));consoleErrors.splice(errorsBefore,1);
 }finally{await page.unroute('**/api/ask');await page.locator('#transcript > .turn').evaluateAll((turns,questions)=>{for(const turn of turns)if(questions.includes(turn.dataset.question))turn.remove();},sent);}
 return {actualEnterSubmits:true,actualSendButtonSubmits:true,multilinePreserved:true,longPromptBoundary:MAX_MESSAGE_CHARS,inlineLengthErrors:true,emptyInputFeedback:true,compositionDoesNotSubmit:true,failedLongSendRestored:true,deliberateHttp503Verified:true};
}
