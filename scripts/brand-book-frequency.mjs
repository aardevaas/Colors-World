/**
 * Frequency of each brand-book component across a sample of published
 * guidelines. Re-run after widening docs/research/brand-book-sample.json.
 *
 *   node scripts/brand-book-frequency.mjs
 *
 * `reference` books (Wheeler) are counted separately: a practitioner composite
 * is evidence of what SHOULD be there, not of what a real organisation shipped.
 */
import { readFileSync } from 'node:fs';

const data = JSON.parse(readFileSync(new URL('../docs/research/brand-book-sample.json', import.meta.url)));
const real = data.books.filter((b) => b.sector !== 'reference');
const refs = data.books.filter((b) => b.sector === 'reference');

const count = new Map();
const sectors = new Map();
for (const b of real) {
  for (const s of b.sections) {
    count.set(s, (count.get(s) ?? 0) + 1);
    if (!sectors.has(s)) sectors.set(s, new Set());
    sectors.get(s).add(b.sector);
  }
}
const inRef = new Set(refs.flatMap((b) => b.sections));
const N = real.length;

const rows = [...count.entries()]
  .map(([id, n]) => ({ id, n, pct: Math.round((n / N) * 100), sectors: sectors.get(id).size, ref: inRef.has(id) }))
  .sort((a, b) => b.n - a.n || a.id.localeCompare(b.id));

const band = (p) => (p >= 70 ? 'CORE' : p >= 40 ? 'COMMON' : p >= 20 ? 'SECTORAL' : 'RARE');

console.log(`\nSample: ${N} published brand books across ${new Set(real.map(b=>b.sector)).size} sectors`);
console.log(`(${real.filter(b=>b.depth==='full').length} full ToC, ${real.filter(b=>b.depth==='partial').length} partial — absence in a partial is NOT evidence of absence)\n`);
console.log(`${'COMPONENT'.padEnd(30)} ${'N'.padStart(3)} ${'%'.padStart(4)}  ${'SECTORS'.padStart(7)}  ${'WHEELER'.padStart(7)}  BAND`);
console.log('-'.repeat(74));
for (const r of rows) {
  console.log(`${r.id.padEnd(30)} ${String(r.n).padStart(3)} ${String(r.pct + '%').padStart(4)}  ${String(r.sectors).padStart(7)}  ${(r.ref ? 'yes' : '-').padStart(7)}  ${band(r.pct)}`);
}

// Components Wheeler prescribes that NO sampled organisation shipped.
const missing = [...inRef].filter((s) => !count.has(s)).sort();
console.log(`\nIn Wheeler's composite but in NONE of the ${N} sampled books:`);
missing.forEach((m) => console.log(`  ${m}`));

const b = (name, f) => console.log(`  ${name.padEnd(10)} ${rows.filter(f).length}`);
console.log('\nBands:');
b('CORE', (r) => r.pct >= 70);
b('COMMON', (r) => r.pct >= 40 && r.pct < 70);
b('SECTORAL', (r) => r.pct >= 20 && r.pct < 40);
b('RARE', (r) => r.pct < 20);
console.log(`  TOTAL      ${rows.length} distinct components observed\n`);
