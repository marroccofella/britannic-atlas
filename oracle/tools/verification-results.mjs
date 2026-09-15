export function assessTests(output,exitCode){
  const count=name=>{const values=[...String(output).matchAll(new RegExp('^# '+name+' (\\d+)\\r?$','gm'))];return values.length?Number(values.at(-1)[1]):null;};
  const counts={tests:count('tests'),passed:count('pass'),failed:count('fail'),skipped:count('skipped'),cancelled:count('cancelled'),todo:count('todo')??0};
  const complete=Object.values(counts).every(Number.isSafeInteger)&&counts.tests>0&&counts.tests===counts.passed+counts.failed+counts.skipped+counts.cancelled+counts.todo;
  return {status:exitCode===0&&complete&&counts.failed===0&&counts.skipped===0&&counts.cancelled===0&&counts.todo===0?'passed':'failed',...counts,
    reason:counts.todo?'Unfinished todo tests remain':!complete?'No complete test summary was produced':counts.skipped?'Required tests were skipped':counts.failed||counts.cancelled||exitCode!==0?'Tests failed, were cancelled, or the process did not finish successfully':null};
}
