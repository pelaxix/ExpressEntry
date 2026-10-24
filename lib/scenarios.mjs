import { blankProfile } from './crs.mjs';
export const scenarioKey = 'ee-crs-scenarios-v1';
const levels = a => Array.isArray(a) && a.length === 4 && a.every(n => [-1,0,4,5,6,7,8,9,10].includes(n));
const int = (v,max,min=0) => Number.isInteger(v) && v>=min && v<=max;
export function validScenario(s) {
  const p=s?.snapshot?.profile, d=s?.snapshot;
  if(!s || typeof s.id!=='string' || !s.id || typeof s.name!=='string' || !s.name.trim() || s.name.length>80 || typeof s.updatedAt!=='string' || !Number.isFinite(Date.parse(s.updatedAt)) || !p || !d) return false;
  if(!Object.keys(blankProfile).every(k=>Object.hasOwn(p,k))) return false;
  if(!['spouse','sibling','nomination','certificate'].every(k=>typeof p[k]==='boolean')) return false;
  if(!int(p.age,100,17)||!int(p.education,7)||!int(p.spouseEducation,7)||!int(p.canadian,5)||!int(p.foreign,3)||!int(p.spouseCanadian,5)||![0,15,30].includes(p.canadianEducation)||!['English','French'].includes(p.firstLanguage)) return false;
  if(![p.first,p.second,p.spouseLanguage].every(levels)) return false;
  if(typeof d.ageText!=='string'||!/^\d{1,3}$/.test(d.ageText)||Number(d.ageText)!==p.age||typeof d.confirmed!=='boolean'||typeof d.offer!=='string'||!/^\d{0,5}$/.test(d.offer)) return false;
  if(!Array.isArray(d.jobs)||d.jobs.length<1||d.jobs.length>100||!d.jobs.every(j=>typeof j?.code==='string'&&/^\d{0,5}$/.test(j.code)&&typeof j.months==='string'&&/^\d{1,3}$/.test(j.months)&&Number(j.months)<=120)) return false;
  const modes=d.languageTests;
  if(!modes||!['first','second','spouse'].every(k=>['none','benchmark','IELTS','CELPIP','PTE','TEF','TCF'].includes(modes[k]))) return false;
  const english=['none','benchmark','IELTS','CELPIP','PTE'], french=['none','benchmark','TEF','TCF'];
  return (p.firstLanguage==='English'?english:french).includes(modes.first)&&(p.firstLanguage==='English'?french:english).includes(modes.second);
}
export function readScenarios(storage) {
  try {
    const raw=storage.getItem(scenarioKey);
    if(!raw) return {items:[],error:'',writable:true};
    const data=JSON.parse(raw);
    if(data.version!==1||!Array.isArray(data.items)||data.items.length>100||!data.items.every(validScenario)||new Set(data.items.map(s=>s.id)).size!==data.items.length) throw Error('format');
    return {items:data.items,error:'',writable:true};
  } catch {
    return {items:[],error:'Saved scenarios could not be read. Browser storage may be blocked or the saved data may be damaged. Existing data has not been overwritten.',writable:false};
  }
}
export function writeScenarios(storage, items) {
  if(!Array.isArray(items)||items.length>100||!items.every(validScenario)||new Set(items.map(s=>s.id)).size!==items.length) return 'The scenario could not be saved. Check your age and experience months (maximum 100 saved scenarios).';
  try {storage.setItem(scenarioKey,JSON.stringify({version:1,items}));return '';}
  catch {return 'Your browser could not save this change. Storage may be full or blocked. Your saved scenarios have not been changed.';}
}
