import {test} from 'node:test';
import assert from 'node:assert/strict';
import {capabilityRequest,wholeRequestCoveredByTool,needsLocalWeatherSource} from '../public/request-coverage.mjs';
import {conversationRepairQuestion} from '../public/conversation-policy.mjs';
import {resolveDialogue} from '../lib/dialogue.mjs';
import {liveRequest} from '../lib/live-tools.mjs';

test('hypothetical wording and time suffixes never authorise live work',()=>{
 for(const ending of ['If I was to ask, could you get me the weather in Peel today?','If I was to ask, could you get me the weather in Peel, please?','If I asked you for the weather in Peel, could you?','For example, could you get me the weather in Onchan tomorrow?']){
   const q='What external access do you have? '+ending;
   assert.equal(capabilityRequest(q)?.mode,'explain',q);assert.equal(liveRequest(q),null,q);assert.equal(resolveDialogue(q).conversationMeta,true,q);
 }
 assert.equal(capabilityRequest('What external access do you have? Could you get me the weather in Peel now?')?.mode,'mixed');
});
test('mobile quotes, whitespace and greetings preserve the capability boundary',()=>{
 for(const prefix of ['We’re testing the latest improvements. ','We‘re testing the latest improvements. ','Hello, ','Hi Mannin, ','']){
   const q=prefix+'What external access do you have? If I was to ask outside Douglas, could you get me the weather in Peel?';
   assert.equal(capabilityRequest(q)?.mode,'explain',q);assert.equal(liveRequest(q),null,q);
 }
 assert.equal(capabilityRequest('What external access do you have?\n For example, could you get me the weather in Peel?')?.subject,'Current weather in Peel');
});
test('financial exchanges and messaging products are factual subjects, not conversation repair',()=>{
 for(const q of ['Review the exchange rate between the Manx pound and sterling.','Assess the exchange control history of the Isle of Man.','Evaluate the chat service used by government.','Review the conversation policy of the council.'])assert.equal(conversationRepairQuestion(q),false,q);
 assert.equal(conversationRepairQuestion('Review our exchange and tell me what you missed.'),true);
});
test('natural receipt and repair verb forms route to the conversation',()=>{
 for(const q of ['Have you heard my question?','Have you understood my last question?','Have you answered my question?','Did you get my question?',"Didn't you see my question?",'Didn’t you read my previous question?'])assert.equal(conversationRepairQuestion(q),true,q);
});
test('other Manx towns cannot be answered as a Ronaldsway measurement',()=>{
 for(const place of ['Onchan','Ballasalla','Kirk Michael','Foxdale','Andreas','Jurby']){
   assert.ok(needsLocalWeatherSource('Current temperature in '+place));assert.equal(liveRequest('Current temperature in '+place)?.name,place==='Onchan'?'get_town_weather':'search_web');
 }
 assert.equal(needsLocalWeatherSource('Current temperature at Ronaldsway'),false);
});
test('a fixed forecast cannot satisfy a measured temperature request or vice versa',()=>{
 assert.equal(wholeRequestCoveredByTool('Current temperature at Ronaldsway','get_forecast'),false);
 assert.equal(wholeRequestCoveredByTool('Forecast tomorrow','get_weather'),false);
 assert.equal(wholeRequestCoveredByTool('Current temperature at Ronaldsway','get_weather'),true);
});
