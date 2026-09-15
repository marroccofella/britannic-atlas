import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assessTests} from '../tools/verification-results.mjs';
const summary=(passed,failed=0,skipped=0,cancelled=0)=>`# tests ${passed+failed+skipped+cancelled}\n# pass ${passed}\n# fail ${failed}\n# skipped ${skipped}\n# cancelled ${cancelled}\n`;
test('full verification fails closed on skipped, missing, truncated or unsuccessful test results',()=>{
 for(const [output,code]of [[summary(2,0,1),0],[summary(0),0],['',0],[summary(2).replace('# fail 0\n',''),0],[summary(2),1],[summary(1,1),0],[summary(2,0,0,1),0]])assert.equal(assessTests(output,code).status,'failed');
 assert.equal(assessTests(summary(3),0).status,'passed');
 assert.equal(assessTests(summary(3).replaceAll('\n','\r\n'),0).passed,3);
});
