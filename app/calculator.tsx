import { useEffect, useState } from 'react';
import { blankProfile, calculateCrs, education, highWageExperience, sources } from '../lib/crs.mjs';
import { readScenarios, writeScenarios } from '../lib/scenarios.mjs';
import { tests, scoreOptions, languageSource } from '../lib/language.mjs';
type Profile = typeof blankProfile;
type WageData = { entries: Record<string,{tier:string;offerPoints:number}> | null; error?:string; updatedAt?:string };
type Job = {code:string;months:string};
const abilities=['Speaking','Listening','Reading','Writing'];
function Select({label,value,onChange,options}:{label:string;value:number;onChange:(v:number)=>void;options:(string|[number,string])[]}) {
  return <label className="crs-field"><span>{label}</span><select value={value} onChange={e=>onChange(Number(e.target.value))}>{options.map((o,i)=><option key={i} value={Array.isArray(o)?o[0]:i}>{Array.isArray(o)?o[1]:o}</option>)}</select></label>;
}
function Language({label,values,onChange,language,test,onTestChange}:{label:string;values:number[];onChange:(v:number[])=>void;language?:string;test:string;onTestChange:(v:string)=>void}) {
  const benchmark=language==='French'||tests[test as keyof typeof tests]?.language==='French'?'NCLC':'CLB';
  const allowed=Object.entries(tests).filter(([,spec])=>!language||spec.language===language);
  return <fieldset className="crs-language"><legend>{label}</legend>
    <label className="crs-field"><span>Which test did you take?</span><select value={test} onChange={e=>{onTestChange(e.target.value);onChange([0,0,0,0]);}}>
      <option value="none">No test results</option>
      {allowed.map(([id,spec])=><option key={id} value={id}>{spec.label}</option>)}
      <option value="benchmark">I already know my {language==='French'?'NCLC':language==='English'?'CLB':'CLB / NCLC'} levels</option>
    </select></label>
    {test!=='none'&&<>
      <p className="crs-note">{test==='benchmark'?'Enter the benchmark level for each ability.':"Choose the range containing each score on your test report. We convert it automatically; don’t enter your overall band score."}</p>
      {test==='TEF'&&<p className="crs-note">Use the “Équivalence ancien score” column, not “Score / 699”. These columns use different scales.</p>}
      <div className="crs-abilities">{abilities.map((ability,i)=><div key={ability}><label className="crs-field"><span>{ability}{test==='benchmark'?' level':' score'}</span><select value={values[i]||0} onChange={e=>onChange(values.map((v,j)=>i===j?Number(e.target.value):v))}>
        <option value="0">{test==='benchmark'?'Below level 4 / no result':'Select your score range'}</option>
        {(test==='benchmark'?Array.from({length:7},(_,n)=>({level:n+4,label:`Level ${n+4}${n===6?'+':''}`})):scoreOptions(test,i)).filter(o=>o.level>0).map(o=><option key={o.level} value={o.level}>{o.label}</option>)}
        {test!=='benchmark'&&<option value="-1">{scoreOptions(test,i)[0].label}</option>}
      </select></label><p className="crs-conversion">{values[i]>0?`${benchmark} ${values[i]}${values[i]===10?'+':''}`:values[i]===-1?`Below ${benchmark} 4`:'No score entered'}</p></div>)}</div>
    </>}
  </fieldset>;
}
const years=['None / less than one year','1 year','2 years','3 years','4 years','5+ years'];
export default function Calculator() {
  const [ageText,setAgeText]=useState(String(blankProfile.age)),[resetKey,setResetKey]=useState(0),[p,setP]=useState<Profile>({...blankProfile}),[started,setStarted]=useState(false),[wages,setWages]=useState<WageData>({entries:null}),[busy,setBusy]=useState(true),[jobs,setJobs]=useState<Job[]>([{code:'',months:'0'}]),[offer,setOffer]=useState(''),[confirmed,setConfirmed]=useState(false),[occupations,setOccupations]=useState<{code:string;title:string}[]>([]);
  const [languageTests,setLanguageTests]=useState({first:'none',second:'none',spouse:'none'});
  type Scenario = {id:string;name:string;updatedAt:string;snapshot:{profile:Profile;ageText:string;jobs:Job[];offer:string;confirmed:boolean;languageTests:typeof languageTests}};
  const [saved,setSaved]=useState<Scenario[]>([]),[selected,setSelected]=useState(''),[scenarioName,setScenarioName]=useState(''),[storageReady,setStorageReady]=useState(false),[storageError,setStorageError]=useState(''),[scenarioMessage,setScenarioMessage]=useState(''),[scenarioEditor,setScenarioEditor]=useState<'save'|'copy'|'rename'|null>(null),[scenarioMenu,setScenarioMenu]=useState(false);
  useEffect(()=>{try{const result=readScenarios(window.localStorage);setSaved(result.items);setStorageReady(result.writable);setStorageError(result.error);}catch{setStorageError('Browser storage is blocked. You can still use the calculator.');}},[]);
  function commitScenarios(next:Scenario[],message:string){
    try{const error=writeScenarios(window.localStorage,next);if(error){setStorageError(error);return false;}setSaved(next);setStorageError('');setScenarioMessage(message);return true;}catch{setStorageError('Browser storage is blocked. Your saved scenarios have not changed.');return false;}
  }
  function saveScenario(replace:boolean){
    const name=(replace?saved.find(s=>s.id===selected)?.name||'':scenarioName).trim();if(!name){setScenarioMessage('Give your scenario a name first.');return;}
    if(saved.some(s=>s.name.toLowerCase()===name.toLowerCase()&&(!replace||s.id!==selected))){setScenarioMessage('That name is already saved. Choose another name or update that scenario.');return;}
    const id=replace?selected:crypto.randomUUID();
    const entry={id,name,updatedAt:new Date().toISOString(),snapshot:JSON.parse(JSON.stringify({profile:p,ageText,jobs,offer,confirmed,languageTests}))};
    const next=replace?saved.map(s=>s.id===id?entry:s):[...saved,entry];
    if(commitScenarios(next,`Saved “${name}” on this device.`)){setSelected(id);setScenarioName(name);setScenarioEditor(null);}
  }
  function loadScenario(id:string){const entry=saved.find(s=>s.id===id);if(!entry)return;setSelected(id);setScenarioEditor(null);setScenarioMenu(false);const d=JSON.parse(JSON.stringify(entry.snapshot));setP(d.profile);setAgeText(d.ageText);setJobs(d.jobs);setOffer(d.offer);setConfirmed(d.confirmed);setLanguageTests(d.languageTests);setResetKey(k=>k+1);setStarted(true);setScenarioName(entry.name);setScenarioMessage(`Loaded “${entry.name}”. Scores are recalculated using the current data.`);}
  function renameScenario(){const name=scenarioName.trim();if(!name){setScenarioMessage('Enter a name first.');return;}if(saved.some(s=>s.id!==selected&&s.name.toLowerCase()===name.toLowerCase())){setScenarioMessage('That name is already saved.');return;}if(commitScenarios(saved.map(s=>s.id===selected?{...s,name,updatedAt:new Date().toISOString()}:s),`Renamed scenario to “${name}”.`))setScenarioEditor(null);}
  function deleteScenario(){const entry=saved.find(s=>s.id===selected);if(!entry)return;if(commitScenarios(saved.filter(s=>s.id!==selected),`Deleted “${entry.name}”. The form is unchanged.`)){setSelected('');setScenarioName('');setScenarioMenu(false);setScenarioEditor(null);}}
  function newCalculation(){setLanguageTests({first:'none',second:'none',spouse:'none'});setSelected('');setScenarioName('');setScenarioMessage('New calculation. Saved scenarios are unchanged.');setAgeText(String(blankProfile.age));setResetKey(k=>k+1);setP({...blankProfile});setJobs([{code:'',months:'0'}]);setOffer('');setConfirmed(false);setStarted(false);setScenarioEditor(null);setScenarioMenu(false);}
  const update=<K extends keyof Profile>(key:K,value:Profile[K])=>{setStarted(true);setP(old=>({...old,[key]:value}));};
  async function load(){setBusy(true);try{const r=await fetch('/api/high-wage');if(!r.ok)throw Error();setWages(await r.json());}catch{setWages({entries:null,error:'High-wage list unavailable. New-rule totals cannot be verified. Retry or consult IRCC.'});}finally{setBusy(false);}}
  useEffect(()=>{void load();fetch('/api/noc').then(r=>r.ok?r.json():Promise.reject()).then(d=>setOccupations(d.items||[])).catch(()=>{});},[]);
  const bonus=highWageExperience(jobs,wages.entries),offerPoints=confirmed?(wages.entries?.[offer]?.offerPoints||0):0;
  const score=calculateCrs({...p,first:p.first.map(v=>Math.max(0,v)),second:p.second.map(v=>Math.max(0,v)),spouseLanguage:p.spouseLanguage.map(v=>Math.max(0,v))},bonus,offerPoints),ready=!!wages.entries&&!wages.error;
  const invalidNoc=jobs.some(j=>Number(j.months)>0&&(!/^\d{5}$/.test(j.code)||(occupations.length>0&&!occupations.some(o=>o.code===j.code)))) || (!!offer&&(!/^\d{5}$/.test(offer)||(occupations.length>0&&!occupations.some(o=>o.code===offer))));
  const validAge=/^\d+$/.test(ageText)&&Number(ageText)>=17&&Number(ageText)<=100;
  const validMonths=jobs.every(j=>/^\d+$/.test(j.months)&&Number(j.months)<=120);
  const numericValid=validAge&&validMonths;
  const months=jobs.reduce((n,j)=>n+Number(j.months||0),0),inconsistent=months>p.canadian*12&&p.canadian<5;
  const futureValid=ready&&!inconsistent&&!invalidNoc&&numericValid;
  const rows:[string,number][]=[['Age',score.age],['Education',score.education],['First official language',score.first],['Second official language',score.second],['Spouse factors',score.spouse],['Skill transferability',score.transfer],['Additional points',score.additional]];
  return <div className="crs-layout" data-ui>
    <div className="crs-mobile-summary" role="status" aria-label="Live CRS totals"><div><span>Current rules</span><strong>{started&&numericValid?score.current:'—'}</strong></div><div><span>November 3 rules</span><strong>{started&&futureValid?score.future:'—'}</strong></div></div>
    <div className="crs-form">
      <section className="crs-scenario-toolbar" aria-label="Saved scenarios">
        <div className="crs-scenario-row"><h2>Scenarios</h2><select aria-label="Choose a saved scenario" value={selected} onChange={e=>e.target.value?loadScenario(e.target.value):newCalculation()}><option value="">Unsaved calculation</option>{saved.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
          {!scenarioEditor&&<button className="button" disabled={!storageReady||!numericValid} onClick={()=>{setScenarioMenu(false);if(selected)saveScenario(true);else{setScenarioName('');setScenarioMessage('');setScenarioEditor('save');}}}>Save</button>}
          <button className="button" onClick={newCalculation}>New</button>
          {selected&&<div className="crs-scenario-menu" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node|null))setScenarioMenu(false);}} onKeyDown={e=>{if(e.key==='Escape')setScenarioMenu(false);}}><button className="button" aria-label="Scenario options" aria-expanded={scenarioMenu} onClick={()=>setScenarioMenu(v=>!v)}>•••</button>{scenarioMenu&&<div className="crs-scenario-options"><button onClick={()=>{setScenarioName(`${saved.find(s=>s.id===selected)?.name||'Scenario'} (copy)`.slice(0,80));setScenarioMessage('');setScenarioEditor('copy');setScenarioMenu(false);}}>Save a copy</button><button onClick={()=>{setScenarioName(saved.find(s=>s.id===selected)?.name||'');setScenarioMessage('');setScenarioEditor('rename');setScenarioMenu(false);}}>Rename</button><button onClick={deleteScenario}>Delete</button></div>}</div>}
        </div>
        {scenarioEditor&&<form className="crs-scenario-editor" onSubmit={e=>{e.preventDefault();if(scenarioEditor==='rename')renameScenario();else saveScenario(false);}}><label className="crs-field"><span>{scenarioEditor==='rename'?'Rename scenario':scenarioEditor==='copy'?'Name this copy':'Name your scenario'}</span><input autoFocus value={scenarioName} maxLength={80} placeholder="e.g. With French" onChange={e=>setScenarioName(e.target.value)}/></label><button className="button" type="submit" disabled={!storageReady||(scenarioEditor!=='rename'&&!numericValid)||!scenarioName.trim()}>{scenarioEditor==='rename'?'Rename':'Save'}</button><button className="button" type="button" onClick={()=>setScenarioEditor(null)}>Cancel</button></form>}
        {storageError?<p className="crs-input-error" role="alert">{storageError}</p>:<p className="crs-note crs-scenario-status" role="status">{scenarioMessage||'Saved only in this browser. Choose a scenario to load it.'}</p>}
      </section>
      <section className="panel crs-section"><h2>Your profile</h2><p>Compare today’s CRS rules with the rules effective November 3, 2026. Unsaved answers are cleared when you leave or reload. Use Save above to keep a calculation on this device.</p><div className="crs-fields">
        <label className="crs-field"><span>Spouse / partner scoring</span><select value={p.spouse?'with':'without'} onChange={e=>update('spouse',e.target.value==='with')}><option value="without">Without an accompanying spouse</option><option value="with">With an accompanying spouse</option></select></label>
        <label className="crs-field"><span>Age</span><input type="text" inputMode="numeric" pattern="[0-9]*" value={ageText} aria-invalid={!validAge} aria-describedby={!validAge?"crs-age-error":undefined} onChange={e=>{setAgeText(e.target.value);setStarted(true);if(/^\d+$/.test(e.target.value)&&Number(e.target.value)>=17&&Number(e.target.value)<=100)update('age',Number(e.target.value));}}/>{!validAge&&<span id="crs-age-error" className="crs-input-error">Enter a whole-number age from 17 to 100.</span>}</label>
        <Select label="Highest assessed education" value={p.education} onChange={v=>update('education',v)} options={education}/>
        <Select label="Eligible Canadian study credential" value={p.canadianEducation} onChange={v=>update('canadianEducation',v)} options={[[0,'None'],[15,'One or two years'],[30,'3+ years / master’s / eligible professional / doctorate']]}/>
      </div><p className="crs-note">Use “without” if your partner is not accompanying you or is a Canadian citizen or permanent resident. Foreign education needs a valid ECA. Canadian study bonus requirements include eligible study and residence in Canada; <a href={sources.criteria} target="_blank" rel="noreferrer">check the official criteria</a>.</p></section>
      <section className="panel crs-section"><h2>Language results</h2><p>Choose your test and enter your four individual results. We calculate the language levels and CRS points for you. Use results less than two years old.</p><label className="crs-field"><span>First official language</span><select value={p.firstLanguage} onChange={e=>{setStarted(true);setP(old=>({...old,firstLanguage:e.target.value,first:[0,0,0,0],second:[0,0,0,0]}));setLanguageTests(t=>({...t,first:'none',second:'none'}));}}><option>English</option><option>French</option></select></label><Language test={languageTests.first} onTestChange={v=>setLanguageTests(t=>({...t,first:v}))} key={`first-${p.firstLanguage}-${resetKey}`} language={p.firstLanguage} label={`First language: ${p.firstLanguage}`} values={p.first} onChange={v=>update('first',v)}/><Language test={languageTests.second} onTestChange={v=>setLanguageTests(t=>({...t,second:v}))} key={`second-${p.firstLanguage}-${resetKey}`} language={p.firstLanguage==='English'?'French':'English'} label={`Second language: ${p.firstLanguage==='English'?'French':'English'} (optional)`} values={p.second} onChange={v=>update('second',v)}/><a className="crs-source" href={languageSource} target="_blank" rel="noreferrer">View the official IRCC conversion tables ↗</a></section>
      <section className="panel crs-section"><h2>Work experience</h2><div className="crs-fields"><Select label="Qualifying Canadian experience" value={p.canadian} onChange={v=>update('canadian',v)} options={years}/><Select label="Qualifying foreign experience" value={p.foreign} onChange={v=>update('foreign',v)} options={['None / less than one year','1 year','2 years','3+ years']}/></div><p className="crs-note">Count completed years of eligible paid skilled work in the last 10 years. Canadian experience must meet CRS requirements, including authorization and physical presence in Canada. Do not count ineligible student or self-employed work.</p><label className="crs-check"><input type="checkbox" checked={p.certificate} onChange={e=>update('certificate',e.target.checked)}/>I have an eligible Canadian certificate of qualification in a skilled trade</label></section>
      {p.spouse&&<section className="panel crs-section"><h2>Your accompanying spouse</h2><div className="crs-fields"><Select label="Spouse’s assessed education" value={p.spouseEducation} onChange={v=>update('spouseEducation',v)} options={education}/><Select label="Spouse’s qualifying Canadian experience" value={p.spouseCanadian} onChange={v=>update('spouseCanadian',v)} options={years}/></div><Language test={languageTests.spouse} onTestChange={v=>setLanguageTests(t=>({...t,spouse:v}))} key={`spouse-${resetKey}`} label="Spouse’s strongest official language" values={p.spouseLanguage} onChange={v=>update('spouseLanguage',v)}/></section>}
      <section className="panel crs-section"><h2>High-wage occupations</h2><p>For November 3 rules, occupation-wide median wages determine eligibility, not your individual salary. Enter non-overlapping full-time-equivalent months of eligible Canadian experience. Combined jobs are limited to 30 hours per week; 12 months are required.</p>
      {busy?<p role="status">Loading the official high-wage list…</p>:wages.error?<p role="alert">{wages.error} <button className="button" onClick={()=>void load()}>Retry</button></p>:<p className="crs-note">Official NOC list loaded{wages.updatedAt?` · checked ${new Date(wages.updatedAt).toLocaleDateString()}`:''}.</p>}
      <datalist id="crs-nocs">{occupations.map(o=><option key={o.code} value={o.code}>{o.title}</option>)}</datalist>
      {jobs.map((job,i)=><div className="crs-job" key={i}><label className="crs-field"><span>Experience NOC</span><input list="crs-nocs" inputMode="numeric" maxLength={5} value={job.code} placeholder="e.g. 20012" onChange={e=>{setStarted(true);setJobs(jobs.map((j,n)=>n===i?{...j,code:e.target.value.replace(/\D/g,'')}:j));}}/></label><label className="crs-field"><span>Eligible months</span><input type="text" inputMode="numeric" pattern="[0-9]*" value={job.months} aria-invalid={!/^\d+$/.test(job.months)||Number(job.months)>120} onChange={e=>{setStarted(true);setJobs(jobs.map((j,n)=>n===i?{...j,months:e.target.value}:j));}}/></label><button className="button" disabled={jobs.length===1} aria-label={`Remove experience row ${i+1}`} onClick={()=>setJobs(jobs.filter((_,n)=>n!==i))}>Remove</button><span className="crs-note">{job.code&&ready?(wages.entries?.[job.code]?`${wages.entries[job.code].tier}× tier`:'Not on the high-wage list'):''}</span></div>)}
      <button className="button" onClick={()=>setJobs([...jobs,{code:'',months:'0'}])}>Add occupation</button>
      {invalidNoc&&<p role="alert">Enter a valid five-digit NOC for each experience row with months and for your job offer, or clear unused rows.</p>}
      {!validMonths&&<p role="alert">Enter whole-number experience months from 0 to 120. You can clear the field while editing.</p>}
      {inconsistent&&<p role="alert">High-wage months exceed your selected total Canadian experience. Correct these answers to see a new-rule total.</p>}
      <p className="crs-note">Higher tiers count toward lower-tier thresholds. For example, six months at 2× plus six months at 1.5× earns the 40-point experience bonus.</p>
      <label className="crs-field"><span>Job-offer NOC (optional)</span><input list="crs-nocs" inputMode="numeric" maxLength={5} value={offer} onChange={e=>{setStarted(true);setOffer(e.target.value.replace(/\D/g,''));setConfirmed(false);}}/></label>
      <label className="crs-check"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I have checked that this offer meets IRCC’s qualifying job-offer requirements effective November 3</label><p className="crs-note">Offer tier: {offer&&ready?(wages.entries?.[offer]?`${wages.entries[offer].tier}× (${wages.entries[offer].offerPoints} points if eligible)`:"not listed"):"not selected"}. An existing job alone does not confirm a qualifying offer. An officer assesses genuineness and eligibility. <a href={sources.changes} target="_blank" rel="noreferrer">Read the new offer rules ↗</a></p></section>
      <section className="panel crs-section"><h2>Additional factors</h2><label className="crs-check"><input type="checkbox" checked={p.nomination} onChange={e=>update('nomination',e.target.checked)}/>I have a valid Express Entry provincial / territorial nomination</label><label className="crs-check"><input type="checkbox" checked={p.sibling} onChange={e=>update('sibling',e.target.checked)}/>I or my accompanying spouse have an eligible sibling in Canada (18+, citizen or permanent resident)</label><p className="crs-note">French bonus points are calculated automatically from your language results. Additional points are capped at 600.</p></section>
      <section className="panel crs-section"><h2>About this estimate</h2><p className="crs-note">Partial answers produce a partial score. This calculator estimates points, not immigration program eligibility. IRCC’s profile score governs. Rules reviewed October 23, 2026.</p><a className="crs-source" href={sources.criteria} target="_blank" rel="noreferrer">Official CRS points tables ↗</a><a className="crs-source" href={sources.changes} target="_blank" rel="noreferrer">November 3 changes ↗</a><button className="button" onClick={newCalculation}>New calculation</button>
</section>
    </div>
    {[false,true].map(future=>{
      const valid=started&&numericValid&&(!future||futureValid);
      const resultRows:[string,number|string][]=[...rows,[future?'Labour Market Integration':'Canadian experience',future?(futureValid?score.integration:'—'):score.work]];
      return <aside key={String(future)} className={`panel crs-result ${future?'crs-result-new':''}`} aria-label={future?'November 3 calculator results':'Current calculator results'} tabIndex={0}>
        <div className="crs-result-summary"><h2>{future?'November 3 rules':'Current rules'}</h2><p className="crs-score-date">{future?'From November 3, 2026':'Before November 3, 2026'}</p><strong className="crs-total" aria-live="polite">{valid?(future?score.future:score.current):'—'}</strong><p className="crs-score-caption">{future&&valid?(score.delta===0?'Same score as current rules':`+${score.delta} points vs current rules`):'Estimated CRS points'}</p></div>
        <div className="crs-result-body">
          {!started&&<p>Enter your profile to calculate this score.</p>}
          {started&&!numericValid&&<p role="status">Complete your age and experience months.</p>}
          {started&&numericValid&&future&&!futureValid&&<p role="status">Check the high-wage list and your NOC / experience answers.</p>}
          <dl className="crs-breakdown">{resultRows.map(([label,points])=><div key={label}><dt>{label}</dt><dd>{valid?points:'—'}</dd></div>)}<div className="crs-result-total"><dt>Total CRS</dt><dd>{valid?(future?score.future:score.current):'—'}</dd></div></dl>
          {future&&<details><summary>How the new factor works</summary><p>Experience: {valid?score.work:'—'} length + {valid?score.bonus:'—'} high-wage = {valid?score.experience:'—'}<br/>Qualifying offer: {valid?score.offer:'—'}<br/>The higher total is awarded once.</p>{valid&&<p>Selected route: {score.route}.</p>}<p>Canadian experience still counts for transferability when the offer route wins.</p></details>}
          <details><summary>Transferability details</summary><p>Education combinations: {valid?score.transferEd:'—'}<br/>Foreign experience combinations: {valid?score.transferForeign:'—'}<br/>Trade certificate: {valid?score.trade:'—'}<br/>Combined maximum: 100</p></details>
        </div>
      </aside>;
    })}

  </div>;
}
