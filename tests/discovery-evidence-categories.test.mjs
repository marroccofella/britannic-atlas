import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';

const fixture=(evidence)=>({root:'root',reviewedAt:'fixture',nodes:[
  {id:'root',label:'Root',evidence:'group',children:['area']},
  {id:'area',label:'Area',evidence,children:['leaf']},
  {id:'leaf',label:'Leaf',evidence:'group',children:[]}
]});

async function withCatalogue(data,check){
  const virtual='\0coverage-fixture';
  const server=await createServer({appType:'custom',configFile:false,logLevel:'silent',server:{middlewareMode:true},plugins:[{
    name:'coverage-fixture',enforce:'pre',
    resolveId(id){if(id.endsWith('/public/discovery/catalog.json'))return virtual;},
    load(id){if(id===virtual)return 'export default '+JSON.stringify(data);}
  }]});
  try{await check(()=>server.ssrLoadModule('/app/manx/discover/stats.ts'));}finally{await server.close();}
}

test('an area root retains each supported evidence category',async()=>{
  for(const [kind,expected] of [['sourced',[1,0,1]],['outline',[0,1,1]],['group',[0,0,2]]]){
    await withCatalogue(fixture(kind),async load=>{
      const {discoveryAreas}=await load();const area=discoveryAreas[0];
      assert.deepEqual([area.sourceLinkedCount,area.outlineCount,area.groupCount],expected,kind);
      assert.equal(area.topicCount,2);
    });
  }
});

test('unknown and missing evidence labels fail instead of inflating grouping counts',async()=>{
  for(const kind of ['groop',undefined])await withCatalogue(fixture(kind),async load=>assert.rejects(load(),/Unknown evidence category/));
});
