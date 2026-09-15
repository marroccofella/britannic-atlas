// An atomic SQLite lease prevents a second local process from recovering live work.
// PID liveness is a same-machine check, not permission to terminate that process.
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const isAlive = pid => { try { process.kill(pid,0);return true; } catch(error) { return error.code!=='ESRCH'; } };
function processIdentity(pid) {
  if(!Number.isSafeInteger(pid) || pid<1) return null;
  try {
    if(process.platform==='win32') return execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',`(Get-Process -Id ${pid} -ErrorAction Stop).StartTime.ToUniversalTime().Ticks`],{encoding:'utf8',windowsHide:true,timeout:3000,stdio:['ignore','pipe','ignore']}).trim() || null;
    if(process.platform==='linux') {
      const stat=readFileSync(`/proc/${pid}/stat`,'utf8');
      return readFileSync('/proc/sys/kernel/random/boot_id','utf8').trim()+':'+stat.slice(stat.lastIndexOf(')')+2).split(' ')[19];
    }
    return execFileSync('ps',['-p',String(pid),'-o','lstart='],{encoding:'utf8',timeout:3000,stdio:['ignore','pipe','ignore']}).trim() || null;
  } catch { return null; } // Unknown identity fails closed; never expire a live owner by elapsed time alone.
}
export function acquireInstanceLease(db,{pid=process.pid,alive=isAlive,identity=processIdentity}={}) {
  db.exec('CREATE TABLE IF NOT EXISTS oracle_instance (slot INTEGER PRIMARY KEY CHECK(slot=1),owner TEXT NOT NULL,pid INTEGER NOT NULL)');
  if(!db.prepare('PRAGMA table_info(oracle_instance)').all().some(column=>column.name==='process_birth')) db.exec('ALTER TABLE oracle_instance ADD COLUMN process_birth TEXT');
  const owner=randomUUID();
  const birth=identity(pid);
  db.exec('BEGIN IMMEDIATE');
  try {
    const current=db.prepare('SELECT owner,pid,process_birth FROM oracle_instance WHERE slot=1').get();
    if(current && alive(current.pid)) {
      const currentBirth=identity(current.pid);
      if(!current.process_birth || !currentBirth || current.process_birth===currentBirth) throw new Error('This Oracle database is already open, or its process owner could not be safely identified. Close the existing Oracle server before starting another.');
    }
    db.prepare('INSERT OR REPLACE INTO oracle_instance(slot,owner,pid,process_birth) VALUES(1,?,?,?)').run(owner,pid,birth);
    db.exec('COMMIT');
  } catch(error) { db.exec('ROLLBACK');throw error; }
  return ()=>db.prepare('DELETE FROM oracle_instance WHERE slot=1 AND owner=?').run(owner);
}
