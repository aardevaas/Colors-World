# Re-measuring the reference surfaces

`src/lib/brand/surfaces.ts` holds the geometry the guideline's colour
proportions are computed from. It is a **snapshot** of what
`/visualizer`'s four templates actually render, taken once at a stated
viewport, in the same spirit as the Fontsource catalogue snapshot: measured,
dated, and checked into the repo so the Book can state a proportion on the
server without a browser.

**Re-measure when a template's layout changes.** `surfaces.test.ts` pins every
percentage, so a change that moves a rectangle fails the suite loudly rather
than quietly restating the guideline's numbers — but it fails with "expected
52.03, got 48.11", and this file is how you get the new numbers honestly.

## Why this is not a script

It needs a real browser with the templates laid out, and the template is
selected by React state rather than a URL, so it cannot be fetched. It is a
handful of minutes by hand every few months, against a hidden dependency that
would need maintaining forever.

## The procedure

1. Start the dev server (`.claude/launch.json`, port 4250) and open
   `/visualizer` with any System that has a full palette, e.g.
   `?c=0a5cff-ff6b35-1b1b1f-f5f5f7-00a67e&m=light`.

2. Run the harness below **in an iframe at a fixed size**, not in the top-level
   page. A backgrounded tab reports `innerWidth: 0` and every rectangle comes
   back zero — the numbers look plausible and are entirely fictional. The
   iframe has a real box regardless of whether the tab is visible.

3. For each template it walks the frame in DOM order — which is paint order
   for this markup, since nothing in the templates is positioned or
   `z-index`ed — recording each element's `getBoundingClientRect` normalised
   to the frame, plus its computed `background-color` matched against the
   resolved `--ui-*` role variables.

```js
const f = document.createElement('iframe');
f.style.cssText = 'position:fixed;left:0;top:0;width:1280px;height:900px;border:0;opacity:0;z-index:-1';
f.src = '/visualizer?c=0a5cff-ff6b35-1b1b1f-f5f5f7-00a67e&m=light';
document.body.appendChild(f);
await new Promise((r) => { f.onload = r; setTimeout(r, 20000); });
await new Promise((r) => setTimeout(r, 1200));

const d = f.contentDocument, w = f.contentWindow;
const ROLES = ['background','surface','primary','text','accent','border'];
const hexToRgb = (h) => { const n = parseInt(h.slice(1), 16); return `rgb(${(n>>16)&255}, ${(n>>8)&255}, ${n&255})`; };
const r3 = (n) => Math.round(n * 1000) / 1000;
const out = {};

for (const b of [...d.querySelectorAll('button')].filter((b) =>
  ['SaaS dashboard','Product card','Editorial hero','Mobile screen'].includes(b.textContent.trim()))) {
  b.click();
  await new Promise((r) => setTimeout(r, 400));
  const frame = d.querySelector('[class*=templates_frame]');
  const cs = w.getComputedStyle(frame);
  const byRgb = {};
  for (const r of ROLES) byRgb[hexToRgb(cs.getPropertyValue('--ui-' + r).trim())] = r;
  const fr = frame.getBoundingClientRect();
  const rows = [];
  const walk = (el) => {
    const s = w.getComputedStyle(el), r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      const bg = s.backgroundColor, img = s.backgroundImage;
      const norm = { x: r3((r.x-fr.x)/fr.width), y: r3((r.y-fr.y)/fr.height),
                     w: r3(r.width/fr.width), h: r3(r.height/fr.height) };
      const cls = (el.className.toString().match(/templates_([A-Za-z]+)__/) || [,'?'])[1];
      if (img && img !== 'none') rows.push({ ...norm, cls, kind: 'image', css: img, opacity: s.opacity });
      else if (byRgb[bg]) rows.push({ ...norm, cls, kind: 'flat', role: byRgb[bg], opacity: s.opacity });
      else if (bg !== 'rgba(0, 0, 0, 0)') rows.push({ ...norm, cls, kind: 'other', css: bg, opacity: s.opacity });
    }
    for (const c of el.children) walk(c);
  };
  walk(frame);
  out[b.textContent.trim()] = { frame: { w: Math.round(fr.width), h: Math.round(fr.height) }, rows };
}
f.remove();
return out;
```

4. Transcribe `kind: 'flat'` rows straight into `surfaces.ts`, in the order
   they came back. That order is the paint order the engine composites in.

5. **Resolve every `kind: 'image'` and `kind: 'other'` row by hand.** These are
   the rows that make the difference between a number and a guess, and there
   is no general rule for them — each is a specific CSS effect:

   - **An opaque multi-stop gradient** is not one translucent region, it is
     *n* opaque ones. Split the rectangle evenly along the gradient axis and
     give each stop `alpha: 1`. Stacking half-alpha layers instead would leave
     part of whatever is underneath showing through a fill that is not
     translucent at all.
   - **A flat `color-mix` or `rgba`** takes the alpha it states. The editorial
     glass CTA is `color-mix(in oklab, surface 70%, transparent)`, so `0.7`.
   - **A gradient that fades to transparent** has to be integrated. Take the
     element's own `opacity`, multiply by the mean alpha of the gradient over
     the part of its box that is inside the frame, and record the derivation
     in the region's `note`. For the editorial glow —
     `radial-gradient(circle, primary 0%, transparent 65%)` at `opacity: 0.28`
     — the box is 728×639, so the `farthest-corner` radius is 484.3, alpha
     falls linearly to zero at ρ = 0.65R = 314.8 from the centre at
     (182, 106.5), and integrating `max(0, 1 − d/ρ) × 0.28` over the visible
     546×426 gives 21,169 px² of primary, i.e. an effective alpha of 0.091.

   Counting that glow as a flat rectangle gives 0% primary (the fill is a
   `background-image`, so `background-color` reports nothing) or 72% (its whole
   box). Both are confidently wrong, which is the one thing this component
   exists not to be.

6. Update `measuredAt`, and update the pinned percentages in
   `surfaces.test.ts` — recompute them, do not copy them from the harness
   above, because the harness sums flat area and the engine composites alpha.
   The two agree only for surfaces with no gradients or translucency.

## What the test does and does not catch

`surfaces.test.ts` asserts each surface is covered to exactly 100%, so a
**deleted** region cannot pass. A region that **moved** still sums to 100% and
will only be caught by the pinned percentages — which is why those exist, and
why `measuredAt` is worth reading before trusting them.
