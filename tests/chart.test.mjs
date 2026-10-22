import test from 'node:test';
import assert from 'node:assert/strict';
import {crsDomain} from '../lib/ircc.ts';
test('narrow CRS selections use a padded close scale',()=>{
 const [lo,hi]=crsDomain([518,519,520]);assert.ok(lo<518&&hi>520);assert.ok(hi-lo<30);
});
test('single and constant results still get a usable scale',()=>{
 for(const values of [[519],[519,519,519]]){const [lo,hi]=crsDomain(values);assert.ok(lo<519&&hi>519);assert.ok(hi-lo<30);}
});
test('scale follows the selection and includes a chosen CRS reference',()=>{
 const wide=crsDomain([435,519,772]);assert.ok(wide[0]<435&&wide[1]>772);
 const small=crsDomain([518,519]);assert.ok(small[1]-small[0]<wide[1]-wide[0]);
 const reference=crsDomain([518,519],509);assert.ok(reference[0]<=509&&reference[1]>519);
});
test('bounds remain valid at CRS limits and without observations',()=>{
 assert.deepEqual(crsDomain([]),[0,1200]);assert.deepEqual(crsDomain([NaN,Infinity]),[0,1200]);
 assert.equal(crsDomain([0])[0],0);assert.equal(crsDomain([1200])[1],1200);
});
