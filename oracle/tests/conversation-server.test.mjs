import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createServer} from 'node:net';
import {fileURLToPath} from 'node:url';
import {once} from 'node:events';
import {MAX_MESSAGE_CHARS} from '../public/conversation-policy.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
async function freePort(){const s=createServer();s.listen(0,'127.0.0.1');await once(s,'listening');const port=s.address().port;await new Promise(resolve=>s.close(resolve));return port;}
test('real HTTP conversations survive restart, retain local turns, reject replay and isolate chats',{timeout:30000},async t=>{
  const directory=mkdtempSync(path.join(tmpdir(),'oracle-conversation-test-'));let child;
  t.after(async()=>{if(child && child.exitCode===null){const stopped=once(child,'exit');child.kill();await stopped;}rmSync(directory,{recursive:true,force:true});});
  const port=await freePort(),base=`http://127.0.0.1:${port}`;
  async function launch(){
    child=spawn(process.execPath,['--experimental-strip-types','--disable-warning=ExperimentalWarning','oracle/server.mjs'],{cwd:root,env:{...process.env,ORACLE_DB:path.join(directory,'test.db'),ORACLE_PORT:String(port),ORACLE_EXPEDITIONS:'off'},windowsHide:true,stdio:['ignore','pipe','pipe']});
    await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(new Error('Oracle startup timed out')),10000);
      child.stdout.on('data',chunk=>{output+=chunk;if(output.includes('[oracle] listening')){clearTimeout(timer);resolve();}});
      child.stderr.on('data',chunk=>{output+=chunk;});child.once('error',error=>{clearTimeout(timer);reject(error);});child.once('exit',code=>{clearTimeout(timer);reject(new Error(`Oracle stopped (${code}): ${output}`));});});
  }
  const post=(url,body)=>fetch(base+url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  await launch();
  const a=(await (await post('/api/conversations',{})).json()).conversation;
  const b=(await (await post('/api/conversations',{})).json()).conversation;
  assert.notEqual(a.id,b.id);
  const request={sessionId:a.id,requestId:'r_local_map',clientTurn:1,question:'Show me a map',source:'typed'};
  const tooLong=await post('/api/ask',{...request,question:'x'.repeat(MAX_MESSAGE_CHARS+1)});assert.equal(tooLong.status,413);assert.match((await tooLong.json()).error,/12,001/);
  assert.equal((await post('/api/ask',{...request,question:' '})).status,400);
  const response=await post('/api/ask',{...request,question:request.question.padStart(MAX_MESSAGE_CHARS)});assert.equal(response.status,200);assert.match(await response.text(),/show_manx_map/);
  const replay=await post('/api/ask',request);assert.equal(replay.status,409);
  const history=await (await fetch(`${base}/api/conversation?sessionId=${a.id}`)).json();
  assert.equal(history.turns.length,1);assert.equal(history.turns[0].question,request.question);assert.equal(history.turns[0].status,'complete');assert.equal(history.turns[0].metadata.action.kind,'show_manx_map');
  assert.equal((await (await fetch(`${base}/api/conversation?sessionId=${b.id}`)).json()).turns.length,0);
  const stopped=once(child,'exit');child.kill();await stopped;await launch();
  const restored=await (await fetch(`${base}/api/conversation?sessionId=${a.id}`)).json();
  assert.equal(restored.turns.length,1);assert.equal(restored.turns[0].answer,history.turns[0].answer);assert.equal(restored.conversation.dialogue.lastArtifact.kind,'manx_map');
  assert.equal((await post('/api/ask',request)).status,409);
  const crossOrigin=await fetch(base+'/api/conversations',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://untrusted.example'},body:'{}'});assert.equal(crossOrigin.status,403);
});
