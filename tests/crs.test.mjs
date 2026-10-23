import test from 'node:test';
import assert from 'node:assert/strict';
import {blankProfile,calculateCrs,highWageExperience} from '../lib/crs.mjs';
const profile=(patch={})=>({...blankProfile,...patch});
test('official age boundaries and education values, without spouse',()=>{
  for(const [age,points] of [[17,0],[18,99],[19,105],[20,110],[29,110],[30,105],[37,66],[40,50],[41,39],[44,6],[45,0]]) assert.equal(calculateCrs(profile({age})).age,points);
  assert.equal(calculateCrs(profile({education:6})).education,135);
});
test('reference profile: 30, bachelor, CLB9, 2 Canadian years, 3 foreign years = 502',()=>{
  const r=calculateCrs(profile({education:4,first:[9,9,9,9],canadian:2,foreign:3}));
  assert.equal(r.current,105+120+124+53+100);
  assert.equal(r.future,502);
});
test('spouse reference: 30, masters, CLB9, 2 years, spouse bachelor CLB7 and 1 year = 508',()=>{
  const r=calculateCrs(profile({spouse:true,education:6,first:[9,9,9,9],canadian:2,foreign:3,spouseEducation:4,spouseLanguage:[7,7,7,7],spouseCanadian:1}));
  assert.equal(r.spouse,25);
  assert.equal(r.current,95+126+116+46+100+25);
});
test('new factor replaces Canadian core experience; an offer is never simply added',()=>{
  const p=profile({canadian:2});
  const r=calculateCrs(p,70,100);
  assert.equal(r.experience,123);assert.equal(r.integration,123);assert.equal(r.delta,70);
  assert.equal(calculateCrs(p,0,100).delta,47);
  assert.equal(calculateCrs(profile({canadian:5}),20,50).integration,100);
});
test('spouse length points, higher offer route, and unchanged transferability',()=>{
  const p=profile({spouse:true,canadian:2,education:4,foreign:3,first:[7,7,7,7]});
  const r=calculateCrs(p,20,100);
  assert.equal(r.work,46);assert.equal(r.integration,100);assert.equal(r.delta,54);
  assert.equal(r.transfer,88);assert.equal(r.route,'Qualifying job offer');
  assert.equal(calculateCrs(profile({canadian:0}),70,100).bonus,0);
});
test('CLB ability boundaries, second-language cap, and no spouse leakage',()=>{
  const r=calculateCrs(profile({spouse:true,first:[4,6,7,10],second:[9,9,9,9]}));
  assert.equal(r.first,6+8+16+32);assert.equal(r.second,22);
  assert.equal(calculateCrs(profile({second:[10,10,10,10],spouseEducation:7,spouseCanadian:5,spouseLanguage:[10,10,10,10]})).spouse,0);
  assert.equal(calculateCrs(profile({second:[10,10,10,10]})).second,24);
});
test('transferability uses all four abilities and category/overall caps',()=>{
  assert.equal(calculateCrs(profile({education:6,first:[9,9,9,6]})).transferEd,0);
  assert.equal(calculateCrs(profile({education:4,first:[9,9,9,8]})).transferEd,13);
  assert.equal(calculateCrs(profile({education:6,canadian:2,foreign:3,first:[9,9,9,9],certificate:true})).transfer,100);
  assert.equal(calculateCrs(profile({certificate:true,first:[5,5,5,5]})).trade,25);
});
test('French bonus works in either language order and additional points cap at 600',()=>{
  assert.equal(calculateCrs(profile({firstLanguage:'French',first:[7,7,7,7]})).frenchPoints,25);
  assert.equal(calculateCrs(profile({first:[5,5,5,5],second:[7,7,7,7]})).frenchPoints,50);
  assert.equal(calculateCrs(profile({first:[5,5,5,5],second:[7,7,7,6]})).frenchPoints,0);
  assert.equal(calculateCrs(profile({nomination:true,sibling:true,canadianEducation:30,first:[5,5,5,5],second:[7,7,7,7]})).additional,600);
});
const entries={'00001':{tier:'2'},'10001':{tier:'1.5'},'20001':{tier:'1.3'}};
test('combined high-wage experience: lower thresholds include higher tiers',()=>{
  assert.equal(highWageExperience([{code:'00001',months:11}],entries),0);
  assert.equal(highWageExperience([{code:'00001',months:12}],entries),70);
  assert.equal(highWageExperience([{code:'00001',months:6},{code:'10001',months:6}],entries),40);
  assert.equal(highWageExperience([{code:'00001',months:6},{code:'20001',months:6}],entries),20);
  assert.equal(highWageExperience([{code:'99999',months:12}],entries),0);
  assert.equal(highWageExperience([{code:'00001',months:12}],null),0);
});
test('complete high scores retain the new bonus beyond historical 1200',()=>{
  const r=calculateCrs(profile({age:25,education:7,first:[10,10,10,10],second:[10,10,10,10],canadian:5,foreign:3,nomination:true}),70,100);
  assert.equal(r.current,1200);assert.equal(r.future,1270);
});
