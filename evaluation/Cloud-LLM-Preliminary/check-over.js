const r = require('./validation-results.json');
const arr = Array.from({length: r.length}, (_, i) => r[i]);
for (const fix of ['css-medium','css-high','js-medium','js-high','tsx-low','tsx-medium','tsx-high']) {
  const f = arr.find(x => x.fixtureId === fix);
  if (!f) { console.log(fix, 'NOT FOUND'); continue; }
  console.log('\n=== ' + fix + ' (acc: ' + (f.accuracy*100).toFixed(1) + '%) ===');
  console.log('OVER:', f.overDefined.map(i => i.id).join(', '));
}
