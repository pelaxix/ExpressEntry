import test from 'node:test';
import assert from 'node:assert/strict';
import {blankProfile} from '../lib/crs.mjs';
import {scenarioKey,readScenarios,writeScenarios} from '../lib/scenarios.mjs';
const memory=()=>{let raw=null;return {getItem:()=>raw,setItem:(key,value)=>{assert.equal(key,scenarioKey);raw=value;}};};
const scenario=(id,name)=>({id,name,updatedAt:'2026-10-24T00:00:00Z',snapshot:{profile:{...blankProfile,first:[9,9,9,9]},ageText:'30',jobs:[{code:'20012',months:'24'}],offer:'20012',confirmed:true,languageTests:{first:'IELTS',second:'none',spouse:'none'}}});
test('named scenarios round-trip on the same storage with all inputs and language test choices',()=>{
  const storage=memory();assert.deepEqual(readScenarios(storage).items,[]);
  const a=scenario('a','Today'),b=scenario('b','With French');b.snapshot.profile.second=[7,7,7,7];b.snapshot.languageTests.second='TCF';
  assert.equal(writeScenarios(storage,[a,b]),'');
  const restored=readScenarios(storage);
  assert.deepEqual(restored.items,[a,b]);assert.equal(restored.writable,true);
  restored.items[0].snapshot.jobs[0].months='36';
  assert.equal(readScenarios(storage).items[0].snapshot.jobs[0].months,'24');
});
test('updating, renaming and deleting one scenario preserves the other scenario',()=>{
  const storage=memory(),a=scenario('a','Today'),b=scenario('b','Future');
  writeScenarios(storage,[a,b]);
  const items=readScenarios(storage).items;items[0].name='Renamed';items[0].snapshot.profile.education=6;
  assert.equal(writeScenarios(storage,items),'');assert.deepEqual(readScenarios(storage).items[1],b);
  assert.equal(writeScenarios(storage,items.filter(s=>s.id!=='a')),'');assert.deepEqual(readScenarios(storage).items,[b]);
  assert.equal(writeScenarios(storage,[]),'');assert.deepEqual(readScenarios(storage).items,[]);
});
test('corrupt or incompatible saved data is reported without overwriting it',()=>{
  for(const raw of ['{bad',JSON.stringify({version:2,items:[]}),JSON.stringify({version:1,items:[{id:'broken'}]})]){
    let writes=0;const storage={getItem:()=>raw,setItem:()=>writes++};
    const r=readScenarios(storage);assert.equal(r.writable,false);assert.ok(r.error);assert.equal(writes,0);
  }
});
test('blocked storage and quota errors report failure and preserve saved data',()=>{
  const storage=memory(),entry=scenario('a','Original');writeScenarios(storage,[entry]);
  const full={getItem:storage.getItem,setItem:()=>{throw Error('QuotaExceeded');}};
  assert.ok(writeScenarios(full,[scenario('b','New')]));assert.deepEqual(readScenarios(storage).items,[entry]);
  assert.equal(readScenarios({getItem:()=>{throw Error('SecurityError');}}).writable,false);
});
test('invalid data, duplicate IDs and impossible profile values cannot replace valid saves',()=>{
  const storage=memory(),a=scenario('a','Original');writeScenarios(storage,[a]);
  const cases=[];
  for(const change of [s=>s.snapshot.profile.age=999,s=>s.snapshot.profile.first=[99,9,9,9],s=>s.snapshot.jobs[0].months='-12',s=>s.snapshot.languageTests.first='TEF',s=>s.name='  ']){const s=structuredClone(a);change(s);cases.push([s]);}
  cases.push([a,a]);
  for(const entries of cases){assert.ok(writeScenarios(storage,entries));assert.deepEqual(readScenarios(storage).items,[a]);}
});
