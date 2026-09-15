import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';

test('area evidence categories reconcile with each other and the catalogue totals',async()=>{
  const server=await createServer({appType:'custom',configFile:false,logLevel:'silent',server:{middlewareMode:true}});
  try{
    const {discoveryAreas,discoveryStats}=await server.ssrLoadModule('/app/manx/discover/stats.ts');
    for(const key of ['sourceLinkedCount','outlineCount','groupCount'])assert.equal(discoveryAreas.reduce((sum,area)=>sum+area[key],0),discoveryStats[key],key+' must reconcile across all areas');
    for(const area of discoveryAreas)assert.equal(area.sourceLinkedCount+area.outlineCount+area.groupCount,area.topicCount,area.label);
  }finally{await server.close();}
});
