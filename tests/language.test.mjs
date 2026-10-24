import test from 'node:test';
import assert from 'node:assert/strict';
import {languageLevel,scoreOptions} from '../lib/language.mjs';
import {blankProfile,calculateCrs} from '../lib/crs.mjs';
test('IELTS General Training conversions use each ability separately',()=>{
  assert.deepEqual([7,8,7,7].map((s,i)=>languageLevel('IELTS',i,s)),[9,9,9,9]);
  assert.deepEqual([7.5,8.5,8,7.5].map((s,i)=>languageLevel('IELTS',i,s)),[10,10,10,10]);
  assert.equal(languageLevel('IELTS',2,7.5),9);
  assert.equal(languageLevel('IELTS',1,7),7);
  assert.equal(languageLevel('IELTS',2,3.5),4);
  assert.equal(languageLevel('IELTS',2,3),0);
});
test('PTE Core distinguishes writing 89 from 90 and speaking from listening',()=>{
  assert.deepEqual([84,82,78,88].map((s,i)=>languageLevel('PTE',i,s)),[9,9,9,9]);
  assert.equal(languageLevel('PTE',3,89),9);
  assert.equal(languageLevel('PTE',3,90),10);
  assert.equal(languageLevel('PTE',0,60),6);
  assert.equal(languageLevel('PTE',1,60),7);
});
test('TEF uses previous-score equivalency; TCF uses its own ranges',()=>{
  assert.deepEqual([310,249,207,310].map((s,i)=>languageLevel('TEF',i,s)),[7,7,7,7]);
  assert.deepEqual([393,316,263,393].map((s,i)=>languageLevel('TEF',i,s)),[10,10,10,10]);
  assert.equal(languageLevel('TEF',0,699),null);
  assert.deepEqual([14,523,524,14].map((s,i)=>languageLevel('TCF',i,s)),[9,9,9,9]);
  assert.equal(languageLevel('TCF',2,523),8);
  assert.equal(languageLevel('TCF',1,549),10);
});
test('CELPIP and score-range labels distinguish high levels and invalid values',()=>{
  assert.equal(languageLevel('CELPIP',0,12),10);
  assert.equal(languageLevel('CELPIP',0,3),0);
  assert.equal(languageLevel('IELTS',0,7.1),null);
  assert.equal(languageLevel('PTE',0,91),null);
  assert.equal(languageLevel('TCF',0,-1),null);
  assert.equal(scoreOptions('IELTS',2).find(o=>o.level===9).label,'7–7.5');
  assert.equal(scoreOptions('TEF',0).find(o=>o.level===10).label,'393–450');
});
test('converted IELTS profile matches direct CLB calculation and French bonus',()=>{
  const first=[7,8,7,7].map((s,i)=>languageLevel('IELTS',i,s));
  const second=[10,458,453,10].map((s,i)=>languageLevel('TCF',i,s));
  const r=calculateCrs({...blankProfile,first,second});
  assert.equal(r.first,124);assert.equal(r.second,12);assert.equal(r.frenchPoints,50);
  assert.equal(r.current,calculateCrs({...blankProfile,first:[9,9,9,9],second:[7,7,7,7]}).current);
});
