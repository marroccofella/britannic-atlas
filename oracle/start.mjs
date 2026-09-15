// Manual entry point. No background service or automatic restart is installed.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {installLifecycle} from './lib/lifecycle.mjs';
const record=installLifecycle(fileURLToPath(new URL('./data/diagnostics/',import.meta.url)));
try{
  const runtime=JSON.parse(readFileSync(new URL('./data/runtime.json',import.meta.url),'utf8'));
  if(!process.env.ORACLE_PDF_PYTHON&&typeof runtime.pdfPython==='string')process.env.ORACLE_PDF_PYTHON=runtime.pdfPython;
}catch{/* Optional per-machine runtime; no credentials are stored here. */}
try{await import('./server.mjs');}catch(error){record('startup_failed',{errorClass:error.name,code:error.code||null});throw error;}
