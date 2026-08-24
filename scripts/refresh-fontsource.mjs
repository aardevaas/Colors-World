/**
 * Refreshes the committed Fontsource catalogue snapshot.
 *
 *   node scripts/refresh-fontsource.mjs
 *
 * The catalogue is baked rather than fetched at runtime for three reasons, in
 * order of importance:
 *
 *   1. `type.licensing` in the brand registry is a PURE renderer. It cannot
 *      await a network call, and a licence that sometimes resolves is worse
 *      than one that always does.
 *   2. Tests must be deterministic. A suite that depends on a third-party API
 *      being up is a suite that fails for reasons unrelated to the code.
 *   3. The product works offline and on a cold start with no upstream call.
 *
 * The cost is staleness, which this script exists to pay down. Fontsource adds
 * families steadily; re-run it and commit the diff.
 */
import { writeFileSync } from 'node:fs';

const ENDPOINT = 'https://api.fontsource.org/v1/fonts';
const OUT = new URL('../src/lib/typography/fontsource-catalogue.json', import.meta.url);

/** Only the fields anything downstream actually reads. */
function compact(font) {
  return {
    id: font.id,
    family: font.family,
    weights: font.weights,
    styles: font.styles,
    variable: font.variable === true,
    category: font.category,
    license: font.license,
    type: font.type,
    defSubset: font.defSubset,
  };
}

const response = await fetch(ENDPOINT);
if (!response.ok) {
  throw new Error(`Fontsource returned ${response.status} ${response.statusText}`);
}

const raw = await response.json();
if (!Array.isArray(raw) || raw.length === 0) {
  throw new Error('Fontsource returned no families — refusing to overwrite the snapshot.');
}

/*
 * A sanity floor rather than an exact count. The catalogue only grows, so a
 * sudden collapse means the API changed shape or served an error body, and
 * overwriting a good snapshot with that would be worse than doing nothing.
 */
const FLOOR = 1800;
if (raw.length < FLOOR) {
  throw new Error(`Only ${raw.length} families returned, below the ${FLOOR} floor — refusing to overwrite.`);
}

const families = raw
  .map(compact)
  .sort((a, b) => a.family.localeCompare(b.family));

const snapshot = {
  source: ENDPOINT,
  fetched: new Date().toISOString().slice(0, 10),
  count: families.length,
  families,
};

writeFileSync(OUT, `${JSON.stringify(snapshot, null, 0)}\n`);

const byType = families.reduce((acc, f) => ({ ...acc, [f.type]: (acc[f.type] ?? 0) + 1 }), {});
const byLicence = families.reduce((acc, f) => ({ ...acc, [f.license]: (acc[f.license] ?? 0) + 1 }), {});

console.log(`\nWrote ${families.length} families to ${OUT.pathname}`);
console.log('\nBy source:', byType);
console.log('By licence:', byLicence);
console.log(
  `\n${byType.google ?? 0} of ${families.length} are Google faces — which is why stacking Fontsource,`
);
console.log('Bunny and Google adds almost nothing. Integrate for facets, not for coverage.\n');
