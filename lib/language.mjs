// Score ranges from IRCC's language-test equivalency tables, reviewed 2026-10-23.
export const languageSource = 'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/documents/language-test.html';
// Abilities: speaking, listening, reading, writing. Each row is the minimum for levels 4–10.
export const tests = {
  IELTS: { label: 'IELTS General Training', language: 'English', max: [9,9,9,9], step: .5,
    thresholds: [[4,4.5,3.5,4],[5,5,4,5],[5.5,5.5,5,5.5],[6,6,6,6],[6.5,7.5,6.5,6.5],[7,8,7,7],[7.5,8.5,8,7.5]] },
  CELPIP: { label: 'CELPIP-General', language: 'English', max:[12,12,12,12], step:1,
    thresholds: Array.from({length:7},(_,i)=>[i+4,i+4,i+4,i+4]) },
  PTE: { label: 'PTE Core', language:'English', max:[90,90,90,90], step:1,
    thresholds: [[42,28,33,41],[51,39,42,51],[59,50,51,60],[68,60,60,69],[76,71,69,79],[84,82,78,88],[89,89,88,90]] },
  TEF: { label:'TEF Canada (previous-score equivalency)', language:'French', max:[450,360,300,450], step:1,
    thresholds: [[181,145,121,181],[226,181,151,226],[271,217,181,271],[310,249,207,310],[349,280,233,349],[371,298,248,371],[393,316,263,393]] },
  TCF: { label:'TCF Canada', language:'French', max:[20,699,699,20], step:1,
    thresholds: [[4,331,342,4],[6,369,375,6],[7,398,406,7],[10,458,453,10],[12,503,499,12],[14,523,524,14],[16,549,549,16]] },
};
export function scoreOptions(test, ability) {
  const spec=tests[test];
  if(!spec || ability<0 || ability>3) throw Error('Unknown language test or ability');
  return [{level:0,label:`Below ${spec.thresholds[0][ability]}`} ,...spec.thresholds.map((row,i)=>{
    const min=row[ability], max=i===6?spec.max[ability]:spec.thresholds[i+1][ability]-spec.step;
    return {level:i+4,label:min===max?String(min):`${min}–${max}`};
  })];
}
export function languageLevel(test, ability, score) {
  const spec=tests[test];
  if(!spec||ability<0||ability>3||!Number.isFinite(score)||score<0||score>spec.max[ability]||score%spec.step!==0) return null;
  let level=0;
  spec.thresholds.forEach((row,i)=>{if(score>=row[ability])level=i+4;});
  return level;
}
