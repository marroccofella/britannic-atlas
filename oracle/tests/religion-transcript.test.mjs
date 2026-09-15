import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DialogueSessions,resolveDialogue} from '../lib/dialogue.mjs';
import {interactionCommand} from '../lib/interaction-policy.mjs';
test('religion discussion review requests dispatch actions rather than explaining the capability',()=>{
  assert.equal(interactionCommand('Can you think harder with mom and search for the answers?')?.review,true);
  assert.equal(interactionCommand("I've told you several times to run mom. So run mum.")?.kind,'review');
  assert.equal(interactionCommand('both')?.kind,'both');
});
test('self-assessment and transcription discussion remain local and preserve the factual subject',()=>{
  const d=new DialogueSessions(),first=d.resolve('s','How diverse is religion on the Isle of Man?',{turnId:'first'});d.markInFlight('s',first);d.complete('s',first.semanticKey,{pendingAction:{kind:'research',subject:first.canonical,researchMode:'live_sources',reviewTarget:'ep_religion'}});
  for(const q of ['Do you think you are doing a good job?','What do you think I was trying to say based on our conversation?']){
    const r=d.preview('s',q);assert.equal(r.conversationMeta,true);assert.equal(r.intent,'self_assessment');assert.equal(r.state.lastSubstantiveQuestion,first.state.lastSubstantiveQuestion);assert.equal(r.state.pendingAction.reviewTarget,'ep_religion');
  }
  assert.equal(resolveDialogue('Rum Pum.',undefined,{source:'speech',recognitionConfidence:.9}).route,'clarify');
});
test('retry follow-ups retain both the religion subject and newly requested subquestions',()=>{
  const d=new DialogueSessions(),first=d.resolve('s','How diverse is religion on the Isle of Man?');d.markInFlight('s',first);d.complete('s',first.semanticKey,{pendingAction:{kind:'research',subject:first.canonical,researchMode:'live_sources'}});
  const r=d.preview('s','Do it and explain the difference between Anglican and Methodist.');assert.equal(r.route,'research');assert.match(r.canonical,/religion/i);assert.match(r.canonical,/Anglican and Methodist/i);
});
