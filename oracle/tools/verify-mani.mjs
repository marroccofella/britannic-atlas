import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {VERIFICATION_SOURCES,fingerprintSources,assessSourceSnapshot} from './verification-sources.mjs';
import {assessTests} from './verification-results.mjs';
import {browserChecks} from './verify-mani-browser.mjs';
import {DEFAULT_MODEL_CACHE,EMBEDDING_MODEL,EMBEDDING_REVISION} from '../lib/embeddings.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const directory=path.join(root,'work','mani-verification-'+new Date().toISOString().replace(/[:.]/g,'-'));fs.mkdirSync(directory,{recursive:true});
const report={startedAt:new Date().toISOString(),status:'running',steps:[],limitations:['Browser speech-input handling is simulated. Physical microphone recognition, screen-reader narration and spoken-answer accuracy need a human listening session.','Paid answer providers and live external websites are not contacted by this deterministic verification. Their availability is not certified by a passing local suite.']};
const save=()=>fs.writeFileSync(path.join(directory,'report.json'),JSON.stringify(report,null,2));
const sourceFingerprint=()=>{try{return fingerprintSources(VERIFICATION_SOURCES.map(name=>[name,fs.readFileSync(path.join(root,name))]));}catch(error){report.steps.push({name:'source-read',status:'failed',reason:error.message});return null;}};
const beforeFingerprint=sourceFingerprint();
report.checkedSources=VERIFICATION_SOURCES;report.startedCoreFingerprint=beforeFingerprint;
const environment={...process.env};
try{const runtime=JSON.parse(fs.readFileSync(path.join(root,'oracle/data/runtime.json'),'utf8'));if(!environment.ORACLE_PDF_PYTHON&&typeof runtime.pdfPython==='string')environment.ORACLE_PDF_PYTHON=runtime.pdfPython;}catch{/* Read only the optional PDF runtime path. */}
function run(executable,args,{timeout=180000}={}){return new Promise(resolve=>{
 const child=spawn(executable,args,{cwd:root,env:environment,windowsHide:true,stdio:['ignore','pipe','pipe']});let output='',timedOut=false,settled=false;
 const timer=setTimeout(()=>{timedOut=true;if(process.platform==='win32')spawn('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'}).on('error',()=>child.kill());else child.kill('SIGKILL');},timeout);
 const finish=code=>{if(settled)return;settled=true;clearTimeout(timer);resolve({code,timedOut,output});};
 child.stdout.on('data',d=>{output+=d;});child.stderr.on('data',d=>{output+=d;});child.once('error',e=>{output+=e.message;finish(1);});child.once('close',code=>finish(code));
 });}
async function step(name,executable,args,{tests=false,...options}={}){console.log('Checking '+name+'…');const start=Date.now(),result=await run(executable,args,options);fs.writeFileSync(path.join(directory,name+'.log'),result.output);const state={name,status:result.code===0&&!result.timedOut?'passed':'failed',durationMs:Date.now()-start,exitCode:result.code,timedOut:result.timedOut,...(tests?assessTests(result.output,result.code):{})};if(result.timedOut)state.status='failed';report.steps.push(state);save();console.log(name+': '+state.status+(tests?` (${state.passed??0} passed, ${state.skipped??0} skipped)`:''));return state;}
const require=createRequire(import.meta.url);
try{
 const pdf=await step('pdf-runtime',environment.ORACLE_PDF_PYTHON||'python',['-c','import pypdf; print("PDF extraction ready")'],{timeout:20000});
 if(pdf.status==='passed'&&!environment.ORACLE_PDF_PYTHON)environment.ORACLE_PDF_PYTHON='python';
 const modelReady=fs.existsSync(path.join(DEFAULT_MODEL_CACHE,EMBEDDING_MODEL,EMBEDDING_REVISION,'onnx/model_quantized.onnx'));report.steps.push({name:'local-model-files',status:modelReady?'passed':'failed',reason:modelReady?null:'Pinned local embedding model is missing; no download was attempted.'});save();
 await step('oracle-tests',process.execPath,['--experimental-strip-types','--disable-warning=ExperimentalWarning','--test','--test-reporter=tap','oracle/tests/**/*.test.mjs'],{tests:true});
 await step('lint',process.execPath,['node_modules/eslint/bin/eslint.js','.','--ignore-pattern','dist','--ignore-pattern','.next']);
 await step('types',process.execPath,['node_modules/typescript/bin/tsc','--noEmit']);
 const pkg=JSON.parse(fs.readFileSync(path.join(root,'node_modules/vinext/package.json'),'utf8'));const bin=typeof pkg.bin==='string'?pkg.bin:pkg.bin.vinext;
 const build=await step('build',process.execPath,[path.join(root,'node_modules/vinext',bin),'build']);
 if(build.status==='passed')await step('website-tests',process.execPath,['--test','--test-reporter=tap','tests/*.test.mjs'],{tests:true});else report.steps.push({name:'website-tests',status:'failed',reason:'Build failed; tests were not run against an older build.'});
 console.log('Checking browser journeys…');
 try{let playwrightModule=environment.MANI_PLAYWRIGHT_MODULE; if(!playwrightModule){try{playwrightModule=require.resolve('playwright');}catch{playwrightModule=path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');}}
   const result=await browserChecks({root,output:path.join(directory,'browser'),playwrightModule});report.steps.push({name:'browser',...result});
 }catch(error){report.steps.push({name:'browser',status:'failed',reason:error.message,detail:error.stack});}
}catch(error){report.steps.push({name:'verification-runner',status:'failed',reason:error.message});}
const afterFingerprint=sourceFingerprint();report.steps.push(assessSourceSnapshot(beforeFingerprint,afterFingerprint));
report.finishedAt=new Date().toISOString();report.status=report.steps.every(s=>s.status==='passed')?'passed':'failed';
report.checkedCoreFingerprint=afterFingerprint;save();
fs.writeFileSync(path.join(root,'work/mani-verification-latest.json'),JSON.stringify({report:path.relative(root,path.join(directory,'report.json')),status:report.status},null,2));
console.log('Full verification '+report.status+'. Report: '+path.relative(root,path.join(directory,'report.json')));process.exitCode=report.status==='passed'?0:1;
