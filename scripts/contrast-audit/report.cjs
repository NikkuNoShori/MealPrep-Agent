const fs = require('fs');
const file = process.argv[2];
const mode = process.argv[3] || 'summary';
const r = JSON.parse(fs.readFileSync(file, 'utf8'));
const fails = r.filter((x) => x.anyFail);
console.log(`total unique=${r.length} failing=${fails.length}`);

// per theme combo failure counts
const per = {};
for (const f of fails) for (const w of f.where) { const k = w.split('/').slice(0, 3).join('/'); per[k] = (per[k] || 0) + 1; }
if (mode === 'summary') {
  console.log('failing findings seen per combo (where-sample):', JSON.stringify(per));
}

// Group by class signature of the element (what a developer edits)
const groups = new Map();
for (const f of fails) {
  const key = f.kind + '|' + f.cls;
  let g = groups.get(key);
  if (!g) { g = { kind: f.kind, cls: f.cls, tag: f.tag, anc: f.anc, items: [], min: 99, count: 0 }; groups.set(key, g); }
  g.items.push(f); g.min = Math.min(g.min, f.minRatio); g.count += f.count;
}
const arr = [...groups.values()].sort((a, b) => a.min - b.min);
const limit = +(process.argv[4] || 60);
console.log(`class-groups failing=${arr.length}`);
for (const g of arr.slice(0, limit)) {
  const ex = g.items[0];
  console.log(`\n[${g.kind}] min=${g.min} req=${ex.required} n=${g.count}  <${g.tag}> .${g.cls.slice(0, 150)}`);
  console.log(`   e.g. ${JSON.stringify(ex.text)}  fg=${ex.fg} bg=${ex.bg}  where=${ex.where[0]}`);
  if (mode === 'anc') console.log('   anc: ' + g.anc.slice(0, 3).join('  <  '));
}
