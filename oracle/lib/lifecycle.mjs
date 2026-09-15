import {appendFileSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';

/** Diagnostics only: no automatic restart, scheduling, port killing or lease changes. */
export function installLifecycle(directory,target=process){
  mkdirSync(directory,{recursive:true});
  const log=join(directory,'lifecycle.jsonl'),latest=join(directory,'last-run.json'),runId=randomUUID();
  let previous;try{previous=JSON.parse(readFileSync(latest,'utf8'));}catch{/* first start */}
  const record=(event,detail={})=>{
    const row={at:new Date().toISOString(),runId,pid:target.pid,event,...detail};
    try{appendFileSync(log,JSON.stringify(row)+'\n');writeFileSync(latest,JSON.stringify(row));}catch{/* diagnostics must not stop shutdown */}
  };
  if(previous&&!['exit','startup_failed'].includes(previous.event)){
    let alive=true;try{target.kill(previous.pid,0);}catch{alive=false;}
    if(!alive)record('previous_exit_unobserved',{previousRunId:previous.runId});
  }
  record('starting');
  target.on('uncaughtExceptionMonitor',error=>record('uncaught_exception',{errorClass:error.name,code:error.code||null}));
  target.on('exit',code=>record('exit',{code}));
  return record;
}
