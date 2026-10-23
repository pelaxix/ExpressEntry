// IRCC CRS criteria and November 3, 2026 changes. Reviewed October 23, 2026.
export const sources = {
  criteria: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/check-score/crs-criteria.html',
  changes: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/changes.html',
};
export const education = ['Less than high school', 'High school', 'One-year post-secondary credential', 'Two-year post-secondary credential', 'Bachelor’s / three-year credential', 'Two or more credentials (one of 3+ years)', 'Master’s / eligible professional degree', 'Doctorate'];
export const blankProfile = { spouse: false, age: 30, education: 0, first: [0,0,0,0], second: [0,0,0,0], firstLanguage: 'English', canadian: 0, foreign: 0, spouseEducation: 0, spouseLanguage: [0,0,0,0], spouseCanadian: 0, canadianEducation: 0, sibling: false, nomination: false, certificate: false };
export function calculateCrs(p, highWageBonus = 0, offerPoints = 0) {
  const s = p.spouse;
  const age = p.age < 18 || p.age >= 45 ? 0 : p.age === 18 ? (s?90:99) : p.age === 19 ? (s?95:105) : p.age <=29 ? (s?100:110) : (s?[95,90,85,80,75,70,65,60,55,50,45,35,25,15,5]:[105,99,94,88,83,77,72,66,61,55,50,39,28,17,6])[p.age-30];
  const ed = (s?[0,28,84,91,112,119,126,140]:[0,30,90,98,120,128,135,150])[p.education];
  const first = p.first.reduce((n,c)=>n+(c<4?0:c<=5?6:c===6?(s?8:9):c===7?(s?16:17):c===8?(s?22:23):c===9?(s?29:31):(s?32:34)),0);
  const second = Math.min(s?22:24,p.second.reduce((n,c)=>n+(c<5?0:c<7?1:c<9?3:6),0));
  const work = (s?[0,35,46,56,63,70]:[0,40,53,64,72,80])[p.canadian];
  const spouse = s ? [0,2,6,7,8,9,10,10][p.spouseEducation] + p.spouseLanguage.reduce((n,c)=>n+(c<5?0:c<7?1:c<9?3:5),0) + [0,5,7,8,9,10][p.spouseCanadian] : 0;
  const min = Math.min(...p.first), strong = min>=9, good=min>=7;
  const advancedEd=p.education>=5, postEd=p.education>=2;
  const transferEd = Math.min(50,(postEd&&good?(advancedEd?(strong?50:25):(strong?25:13)):0)+(postEd&&p.canadian?(advancedEd?(p.canadian>=2?50:25):(p.canadian>=2?25:13)):0));
  const foreignHigh=p.foreign>=3;
  const transferForeign = Math.min(50,(p.foreign&&good?(foreignHigh?(strong?50:25):(strong?25:13)):0)+(p.foreign&&p.canadian?(foreignHigh?(p.canadian>=2?50:25):(p.canadian>=2?25:13)):0));
  const trade = p.certificate&&min>=5 ? (min>=7?50:25):0;
  const transfer = Math.min(100,transferEd+transferForeign+trade);
  const french = p.firstLanguage==='French'?p.first:p.second;
  const english = p.firstLanguage==='English'?p.first:p.second;
  const frenchPoints=Math.min(...french)>=7 ? (Math.min(...english)>=5?50:Math.max(...english)<=4?25:0):0;
  const additional=Math.min(600,(p.nomination?600:0)+(p.sibling?15:0)+p.canadianEducation+frenchPoints);
  const bonus=p.canadian>=1?highWageBonus:0;
  const experience=work+bonus, integration=Math.max(experience,offerPoints);
  const common=age+ed+first+second+spouse+transfer+additional;
  return { current:common+work, future:common+integration, delta:integration-work, age, education:ed, first, second, work, spouse, transfer, transferEd, transferForeign, trade, additional, frenchPoints, bonus, offer:offerPoints, experience, integration, route:offerPoints>experience?'Qualifying job offer':'Canadian work experience' };
}
// Rows represent non-overlapping full-time-equivalent months. Higher tiers count toward lower thresholds.
export function highWageExperience(rows, entries) {
  if (!entries) return 0;
  const months=(tier)=>rows.reduce((n,r)=>n+(Number(entries[r.code]?.tier||0)>=tier?Math.max(0,Number(r.months)||0):0),0);
  return months(2)>=12?70:months(1.5)>=12?40:months(1.3)>=12?20:0;
}
