# Landing Page — Locked Brief & Decisions

> ## ⚠️ HISTORICAL — 2026-08-23
>
> This brief describes a **WebGL** landing page. The globe and the whole
> three.js stack were removed on instruction; the landing is now a hand-written
> 2D canvas simulation (rain, a liquid pill, a pool you can fill and drain).
>
> **It is still worth reading** — the founder's answers and, especially, the
> list of rejected ideas remain authoritative about what NOT to rebuild.
> Its architecture and technique sections do not describe what ships.
>
> Current ground truth: [`AUDIT-2026-08-23.md`](AUDIT-2026-08-23.md).


> **Status: authoritative.** This file is the single source of truth for the
> WebGL landing page. It captures the full question set put to the founder and
> the answers given, verbatim in substance, plus every architectural decision
> and its reasoning. Written to survive context loss — if the build is picked
> up cold, start here.
>
> Branch: `design/landing-page` · Source brief: `WebGL Landing Page Guide.md`
> (Gemini spec, treated as suggestion, not gospel)

---

## 1. Product & naming

| Question | Answer |
|---|---|
| H1 / wordmark | **"Colors World"** is the name. "16.7 Million Colors" was Gemini's placeholder — it's a *tagline*, not the name. |
| Hero copy | Keep exactly as-is (the founder called it "perfect"). |
| Creator credit | "Built by: aardevaas" + glowing GitHub icon → `github.com/aardevaas`. |
| Brand color | **None.** All colors are the brand. The identity *is* the spectrum. |

**Live hero copy (do not rewrite without asking):**
- Eyebrow: `Open-source · Free forever`
- H1: `Every color.` / `All 16.7 million of them.` ("16.7 million" is the gradient-swept accent)
- Sub: `The free, open-source studio for color, palettes, branding, and typography — built in the open, for everyone.`
- CTAs: **`Enter the studio for free`** (primary) + **`Star on GitHub`** (secondary)

---

## 2. Scope

- The Canvas-2D / Matter.js landing was **deleted outright**, not extended
  ("our version was too simple and looked terrible").
- Build order: **Phases 1–4 together** (one interlocked scroll timeline),
  **Phase 5 separate** (feature cards) to keep the workload sane.
- Delivery style: **rough vertical slice first**, then iterate — because the
  motion can't be verified from the agent sandbox (see §9).

---

## 3. Tech stack — MIT-only, locked

| Choice | Decision |
|---|---|
| Renderer | **React Three Fiber** (not vanilla three.js) |
| Scroll smoothing | **Lenis** (MIT) |
| Animation | **No GSAP.** Declined deliberately. |
| Styling | CSS Modules (existing project convention) |
| Fonts | `next/font/google`, self-hosted at build |

### Why GSAP was declined
GSAP is free to use but **not permissively licensed** — you can't fork or
redistribute it. The repo is heading for a **dual-license / source-available**
model (PolyForm Noncommercial 1.0.0, or AGPL-3.0 with a commercial exception):
free for personal and open-source use, paid for proprietary/commercial forks.
A non-permissive dependency complicates that. **Standing rule: no non-MIT
dependencies may be introduced.**

### License audit (run 2026-07-24, post-install)
Full transitive tree: 174 MIT · 13 ISC · 12 Apache-2.0 · 6 BSD-3 · 5 BlueOak · 1 0BSD.
Three non-permissive entries, all pre-existing and none introduced by this work:
- `@img/sharp-libvips-*` (LGPL-3.0) — from **Next.js**, native binary, not client-bundled
- `caniuse-lite` (CC-BY-4.0) — from **Next.js**, build-time data only
- `webgl-constants` — reports UNKNOWN only because it omits the `license` field; its LICENSE file is **MIT**

**Everything added for the landing page is MIT.** Re-run this audit before
adding any dependency.

### ⚠️ Deviation from the spec: no `<ScrollControls>`
The brief asked for drei's `<ScrollControls>` + `useScroll()` **combined with**
Lenis. These genuinely conflict: `ScrollControls` mounts its own scrollable
container and intercepts wheel events, and so does Lenis — running both
double-smooths and the two fight over the same gesture. It would also create a
second scroll context, which breaks down once the page continues past the
canvas into the Phase 5 cards.

**Instead:** Lenis drives the real document scroll; a small
`useScrollProgress` hook reports how far through the pinned section we are and
writes into a *ref* (not state — this updates every frame). One scroll context,
one source of truth, identical result.

---

## 4. Scroll choreography

- Canvas is **pinned** (`position: sticky`) — confirmed.
- Scroll distance: **3 full screen-heights** (`300vh`), screen-dependent.
- Scrolling back up **fully reverses** the whole sequence.
- **RESOLVED (2026-07-24): velocity-driven.** Storm acceleration follows scroll
  *velocity* — flick hard and it storms, ease off and it settles.
  Progress-driven was tried and rejected as "too much" (relentless by
  comparison). The temporary A/B toggle has been removed and the code path
  deleted; `VELOCITY_DRIVE_GAIN` is the single knob.

---

## 5. Color system — the "16.7 million" question, settled

**There is no "base" to upload. There never was.**

16,777,216 = 256³ = every 24-bit RGB triplet. The integer index **is** the
color. Zero database rows, zero storage, O(1) lookup — already implemented in
`src/lib/spectrum/generate-color.ts` (`composeIndex` / `indexToSwatch`). Every
output format is a pure function of that index and already exists in
`src/lib/color-engine`: **HEX · sRGB · CMYK · OKLCH**.

This is the most efficient possible design; there is nothing to optimise.

### Globe mapping — deviates from the Gemini spec, on purpose
The spec said HSL (hue=longitude, sat/light=latitude). **Rejected.** The whole
product is OKLCH-based; HSL would be perceptually lumpy *and* inconsistent with
what the Spectrum actually shows. Particles use the real engine, so a color on
the landing page is literally a color in the product.

Positions come from a **Fibonacci lattice**, not a lat/long grid — a lat/long
grid bunches at the poles and gaps at the equator. A unit test asserts **<5%
population deviation across equal-area bands**, which is the mathematical
guarantee the globe reads as a gapless shell.

Color is derived *from* each particle's own seat: longitude → hue,
latitude → lightness. The globe is therefore a smooth spectrum **by
construction**, and the rain already wears its final color as it falls.

### ⚠️ The Supabase `colors` table must NOT be deleted
The founder asked to drop it once told the 16.7M space needs no storage.
**That would be a mistake, and the request was made without this information:**

The table's value was never enumeration — it's the **semantic layer**:
`name`, `description`, `emotion`, `personality`, `mood`, `symbolism`,
`use_case`, `keywords`, `category`. **None of it is computable from
arithmetic.** You cannot derive "signals trust, works for fintech" from an RGB
triplet.

It is also load-bearing right now (`/library`, `/library/[id]`), and the
**Card 1 spec explicitly requires it** — "filter all 16.7M colors by hues,
shades, tones, *meanings*, and *variations*".

Storage is ~100k text rows against a 500MB free tier. This is not a space
problem. **Correct framing: arithmetic supersedes the table for *listing*
colors; the table remains the only source of *meaning*.**

---

## 6. The globe (Phase 3)

- **~30,000 particles.** "16.7 million" is a truthful claim about the space;
  the globe is a representative shell. Rendering 16.7M discrete points is not
  viable on mobile and adds nothing visually.
- **Ultra-dense particle shell** — discrete points, *not* a solid mesh, sized
  via `gl_PointSize` so they read as one continuous vibrant surface. Staying
  particles is what lets rain → sphere → stardust happen in one shader
  pipeline with **no geometry swap**.
- **Auto-rotation:** Y-axis, ~20° axial tilt (Earth-like). Ultra-slow,
  cinematic (~0.0015 rad/frame, ~0.2 RPM). Velocity fades in as
  `uMorphProgress → 1.0`. Halves on hover for precise clicking; pauses during
  manual orbit-drag; resumes smoothly ~2s after drag ends.

### Interaction — an artistic CTA, not an inspector
- **Desktop hover:** localised particle glow/scale + cursor tooltip reading
  `#HEX • Click to Explore`.
- **Click:** raycast the particle → capture exact hex → trigger the explosion →
  navigate to **`/library?color=FF5733`** with that color pre-loaded as the base.
- **Mobile tap:** same — capture, explode, navigate.

---

## 7. Explosion & Phase 5 handoff

- **Trigger: clicking the sphere / a color.** (Scroll-past trigger dropped.)
- Post-processing: **selective bloom + chromatic aberration**, mounted **only**
  for the ~1s climax, then unmounted. Disabled entirely on touch/mobile.
  Auto-bypassed below 50 FPS via drei's `PerformanceMonitor`. Bloom stays on
  the exploding mesh, never the text.
- Particles settle into **live drifting stardust behind Section 3** — do *not*
  fade to a static image; visual continuity is the point. To hold 60 FPS:
  raycasting/hover fully disabled in stardust state, drift computed entirely in
  the vertex shader from `uTime` (no CPU loop), size/opacity lowered so
  glassmorphic card text keeps its contrast ratio.

---

## 8. Routes & the 5 feature cards (Phase 5)

`/` = landing. Each card maps **1:1** to a primary app route. Color selections
hand off via URL search params (e.g. `/library?color=FF5733`).

The old tool sprawl (Palette Generator, Image Picker, Palette Visualizer,
Tailwind Colors, Explore Palettes, Contrast Checker, Color Picker, Scale Lab,
Miro Canvas, Brand Assets, Typography) consolidates into **5 flagship tabs**:

| # | Tab | Route | Subtitle | Absorbs |
|---|---|---|---|---|
| 1 | **Library** | `/library` | Infinite Color Discovery & Exploration | Spectrum + Explore Palettes + Color Picker + Meanings & Variations |
| 2 | **Palette Builder & Scale Lab** | `/builder` | Algorithmic Color Scales & Export Engine | Palette Generator + Scale Lab + Saved Palettes |
| 3 | **Studio** | `/studio` | The Infinite Spatial Design Canvas | Freeboard Canvas + Brand Assets Vault + Dashboard |
| 4 | **Visualizer & UI Lab** | `/visualizer` | Real-Time UI Testing & Image Extraction | Palette Visualizer + Tailwind Colors + Image Picker + Contrast Checker |
| 5 | **Typography Studio** | `/typography` | Type Pairing & Contrast Accessibility Engine | Typography Studio + Type-over-Color Inspector |

**Card 1 — Library:** replaces raw spectrum lists with an endless discovery
grid (Coolors-inspired); search/filter all 16.7M by hue, shade, tone, meaning,
variation; instant color info + accessibility breakdown.
**Globe clicks land here.**

**Card 2 — Builder:** fully customisable generator + anchor-based scale engine
(chroma, step, hue torsion); live gamut testing (sRGB / Display P3 / Rec2020);
CVD sims (protanopia, deuteranopia, tritanopia, achromatopsia); 1-click export
to Tailwind, CSS variables, Figma.

**Card 3 — Studio:** Miro-like infinite spatial moodboard; drag/pin colors and
palettes; integrated Brand Asset Vault for logos, marks, reference images.

**Card 4 — Visualizer:** preview palettes on real UI components; extract hexes
and dominant palettes from uploaded images; Tailwind live theme previewer; WCAG
contrast checker.

**Card 5 — Typography:** dynamic font pairing + hierarchy visualiser;
real-time text-over-color WCAG scoring; dark/light font scaling for web and
mobile.

> ⚠️ **Route migration still outstanding.** Today the app has `/spectrum`,
> `/scale-lab`, `/library`, `/palettes`, `/assets`, `/studio`. The target above
> needs `/builder`, `/visualizer`, `/typography` created and the old routes
> consolidated/redirected. **Not started** — this is app work, separate from the
> landing page.

---

## 9. Platform, accessibility, performance

- **Desktop-first.** This audience works on computers. Mobile gets a
  deliberately reduced version, not parity.
- **Background: pure black / near-black `#050508`. Confirmed and final.**
  (Q30 initially said white with a night mode; Q32 said obsidian. Resolved
  explicitly in favour of black — additive glowing particles are physically
  invisible against white, and every other stated preference — cinematic,
  moody, glassmorphism, bloom — presumes a dark stage.)
- **UI language:** sleek dark glassmorphism — frosted panels, 1px border
  highlights, low-opacity backdrops, high-contrast type. Restrained, so all
  impact stays on the particle system.
- **Vibe:** cinematic, premium, Apple-grade spacing. The dark void is a gallery
  stage; the colors are the only light source.

### Typography
| Role | Face |
|---|---|
| Display | **Unbounded** (variable) — hero, section headers, tab titles |
| Body / UI | **Plus Jakarta Sans** — card copy, labels, subheads |
| HUD / data | **JetBrains Mono** — hex codes, coordinates, tooltips, metrics |

Loaded via `next/font/google` (self-hosted at build). This beats both
`@fontsource` and raw Google Fonts here: no runtime request, no FOUT, no layout
shift during WebGL init, and zero extra dependencies.

### Reduced motion (full fallback — confirmed)
- Detect `window.matchMedia('(prefers-reduced-motion: reduce)')`.
- Bypass rain and scroll acceleration; render the assembled globe **statically**,
  serene, auto-rotation off.
- No shockwave physics — clicking a particle does a clean fade straight to that
  color in the Library.
- Accessible **"Skip to content"** link first in the DOM.
- Explicit **`Motion: On/Off`** HUD toggle that overrides the OS default in
  **both** directions, so someone who wants the spectacle can opt back in.

### Sound
**Wanted** — interaction SFX with a mute toggle, muted by default.
> ⏸️ **Deferred by decision (2026-07-24): sound comes *after* the landing page
> is finished.** The founder has reference inspirations but hasn't shared them.
> **ACTION: remind them about sound once the landing page is signed off.**

### Performance
- three.js sits behind a `dynamic(..., { ssr: false })` boundary. Measured:
  **`/` first-load = 115 kB — under the 150 kB budget**, engine streams in after.
- HUD text still server-renders (H1 + CTAs verified present in raw HTML).
- One `THREE.Points` system, one draw call, all motion in GLSL, zero per-frame
  CPU work.

---

## 10. Known constraints on verification

**The agent sandbox cannot verify WebGL motion.** Its preview tab reports
`document.hidden === true`, which pauses `requestAnimationFrame` and prevents
R3F's `ResizeObserver` from firing. Consequences:

- Screenshots can show a stale or black canvas even when the page is perfectly
  healthy. Forcing a viewport resize triggers a repaint and reveals the truth.
- **Characterised precisely (2026-07-24): the sandbox can only capture at
  `scrollY === 0`.** At the top of the page screenshots are accurate; at any
  scrolled position they come back solid black *while the DOM reports the H1
  on-screen with opacity 1 and the canvas holding a correct 2×-DPR drawing
  buffer*. Consequence: **anything gated behind scroll — the morph, the globe,
  the explosion — cannot be seen by the agent at all** and must be reviewed by
  the founder. Verify such work by asserting on DOM/uniform/maths instead.
- **Motion, feel, and pacing must be judged by the founder**, not the agent.
  The agent can verify code correctness, math, buffers, bundle size, absence of
  errors — not whether it *feels* good.
- Mitigation already shipped: CSS pins the canvas display size so it fills the
  stage from first paint instead of sitting at the intrinsic 300×150 default.

**Build hygiene:** never run `npm run build` while a dev server is live — they
share `.next` and it produces `Cannot find module './XXX.js'`. Fix:
`rm -rf .next` and restart dev.

---

## 11. Current state

**Shipped — Phase 1 + 2** (commit `d956c16`, branch `design/landing-page`):
- 30,000-particle GPU system, one draw call, all motion in GLSL
- Phase 1's ~50 ambient cubes are a *stable subset* of the same 30k system, so
  the storm ramps continuously instead of swapping objects
- Scroll-linked storm; canvas pinned across 300vh; fully reversible
- Colors from the real 16.7M engine; sphere seats on a Fibonacci lattice
- `aSpherePos` + `uMorphProgress` already wired and held at 0 — **Phase 3 is a
  uniform ramp, not a rewrite**
- Reduced-motion fallback + skip link + motion override toggle
- 270 tests green, typecheck clean, zero console errors

**Shipped — Phase 3, the gather:**
- `uMorphProgress` ramps `smootherstep(0.42 → 0.72)` off scroll position, so
  the globe assembles as you scroll and **unwinds back into rain on the way up**
  — reversible by construction, not by a separate reverse animation
- Spin and axial tilt are applied to the *sphere seat inside the shader*, not
  to the object — so the rain stays upright and only the destination turns
- Spin velocity fades in with the morph, so the globe is already turning as it
  finishes forming instead of lurching into motion
- Point size grows 1.0 → 1.5× across the morph so ~30k points close into one
  continuous surface
- Depth-based dimming of the far hemisphere: additive blending has no depth
  sort, so without it the back of the shell sums through the front and the
  globe blows out to a white ball. This is what makes it read as solid.
- Storm locked to velocity-driven; A/B toggle removed
- `useScrollProgress` now also syncs from native `scroll`/`resize`, not Lenis
  alone — a scrollbar drag, keyboard paging, anchor jump, or restored scroll
  position would otherwise leave progress stale, and progress is what decides
  whether the globe is assembled

**Shipped — hero fade (founder request, 2026-07-24):**
The hero copy cross-dissolves out as the globe gathers (0.28 → 0.5), so the
two never compete. Deliberately overlaps the start of the morph (0.42) — the
brief was "fade away *as* the sphere creates itself", so it is still faintly
present when the gather begins rather than cutting beforehand. The scroll cue
clears much earlier (0.03 → 0.14). The **top bar does not fade** — wordmark and
controls stay as persistent HUD. Faded copy switches to
`pointer-events: none` so an invisible CTA can never swallow a click meant for
a particle.

Driven by writing CSS variables from a frame loop, not React state — this
changes every frame while scrolling and re-rendering the tree that often would
cost more than the particle field. Timing lives in `src/lib/landing/scroll-fade.ts`
as pure functions **because the rAF write cannot be observed in a headless
browser** — unit tests are the only honest verification of the windows.

**Shipped — Phase 4, the explosion:**
- **New MIT-only exception noted:** `postprocessing` (the underlying engine
  `@react-three/postprocessing` wraps) is **Zlib**-licensed, not literally MIT.
  Zlib is permissive — no copyleft, commercial forks explicitly allowed — so it
  doesn't conflict with the dual-license strategy in spirit, but flagging it
  since the standing rule was written as "MIT-only."
- **Picking is fully manual, not three.js raycasting.** A particle's on-screen
  position exists only inside the vertex shader — `geometry.attributes.position`
  holds the dummy rain seat, never the live sphere position — so three's
  built-in `Points.raycast()` would silently hit-test the wrong data. Hover and
  click instead recompute the shader's own rotation on the CPU
  (`rotate-sphere-position.ts`, unit-tested specifically because a drift
  between the JS copy and the GLSL would misalign hover with no visible error)
  and project through the real camera every other frame.
- Click is a native `click` listener on the canvas, not an R3F pointer event on
  the mesh, for the same reason. Re-picks at the exact click position rather
  than trusting the last hover — this is also what makes a touch tap work,
  since touch never produces a hover first.
- **Curl noise, not simplex.** Hash-based value noise was used for the
  turbulence field instead of hand-rolling simplex noise — a curl field only
  needs *some* continuous, organic noise to be divergence-free by
  construction; which primitive supplies it barely matters visually, and this
  GLSL cannot be unit-tested at all, so the simpler primitive was chosen
  specifically to leave less room for a silent math bug.
- Explosion = radial shockwave (outward along each particle's own sphere
  normal) + curl-noise turbulence that keeps growing through the settle, so
  the dispersed field drifts gently forever rather than freezing solid.
- Hover: brighter/whiter glow + larger point size on the exact hovered
  particle (exact match via a tolerance tuned between float-rounding noise and
  the ~1/30000 spacing between neighbouring indices), tooltip reading
  `#HEX • Click to explore`, auto-rotation halved for a steadier click.
- Post-processing (bloom + chromatic aberration) mounts only for the ~1.4s
  climax window, is skipped entirely on touch devices, and auto-bypasses via
  drei's `PerformanceMonitor` below 50fps. "Selective" bloom needed no masking
  work — it can only ever touch pixels the canvas drew, and the HUD/feature
  cards are separate DOM in their own stacking layer on top of it.
- Navigation to `/library?color=HEX` fires from a timeout in
  `LandingExperience`, timed off the same `EXPLOSION_DURATION_SECONDS`
  constant the shader uses (`src/lib/landing/explosion-timing.ts`) — kept in
  its own zero-dependency file specifically so importing it can never
  accidentally drag `three` back into the non-lazy main bundle.
- Bundle check held: `/` is 116 kB first-load (was 115 kB before
  postprocessing was added) — still under the 150 kB budget.

**Shipped — longer gather + click-drag manual orbit (founder feedback, 2026-07-24):**
- Globe-assembly window widened from 0.42-0.72 to 0.42-**0.88** of scroll —
  the creation read as too quick at the original pacing.
- **Click-and-drag now lets you manually reorient the globe** to browse to any
  color by hand, not just whatever the auto-spin happens to show — this was
  previously listed below as deferred; it's built now. Horizontal drag = yaw,
  vertical drag = pitch (clamped to ±60° so the sphere never goes edge-on and
  reads as a flat disc). Auto-rotation pauses for the drag's duration plus 2
  further seconds, then eases back in, so the hand-picked angle doesn't get
  immediately fought by the auto-spin.
- **Architecture note, in case this needs touching again:** this is
  implemented as an offset added directly to the *shader's own* rotation/tilt
  uniforms (`dragYaw`, `dragPitch`), not as a camera orbit (drei's
  `OrbitControls`). Camera-orbiting was considered and rejected — the
  depth-based dimming that keeps the globe reading as solid
  (`particle-shaders.ts`'s `depthFade`/`facing`) is computed in **world
  space**, which is only valid because the camera never moves. Orbiting the
  camera instead would have required reworking that to view-space depth to
  stay correct from every angle — a real, riskier change to code that can't
  be visually verified here. Keeping the camera fixed and rotating the
  sphere's *destination* instead (which the shader already did for
  auto-rotation) sidesteps that entirely.
- A native `click` still fires after a drag ends — suppressed via a
  `wasDragging` flag (set only once total pointer travel exceeds a 6px
  threshold) so reorienting the globe can never also detonate it.
- Hover is suspended while dragging (the pointer is busy reorienting, not
  inspecting) and the picking function now takes rotation/tilt as explicit
  arguments rather than reading refs itself, so a click's one-off pick and the
  per-frame hover scan can never disagree about which angle they're picking
  against.
- Direction/sensitivity are a first pass, not felt out — flip either sign in
  `ParticleStorm.tsx`'s `DRAG_YAW_RADIANS_PER_PIXEL` /
  `DRAG_PITCH_RADIANS_PER_PIXEL` if a drag direction reads as backwards.

**Shipped — Phase 5, the five feature cards:**
- **Structural change worth knowing about:** the canvas is no longer
  `position: sticky` scoped to the 300vh globe section — it's now a genuine
  `position: fixed` backdrop for the *whole page*. The 300vh `.stage` section
  still drives all of rain/gather/rotation's pacing exactly as before,
  completely unaffected; only how long the *visual* persists behind later
  content changed. This is what makes the founder's Q21 requirement possible —
  render the feature cards over the *live*, still-drifting stardust rather
  than fading to a static image — without squeezing the globe's carefully-tuned
  timing into a smaller fraction of a much longer scroll (which is what
  extending `.stage` itself to also cover the cards would have done instead).
- Cards render as an ordinary Server Component (`FeatureCards.tsx`, zero
  client JS added) in **normal document flow straight after** `.stage` — not
  nested inside the pinned/fixed div — so they simply scroll up over the
  still-fixed, still-rendering canvas behind them, exactly as specified.
- Editorial bento, not a uniform grid: the Library card (where every globe
  click lands) spans the full width and reads first/largest; the remaining
  four sit in a 2-column grid below it.
- Individual cards get a glass panel (blur + translucent dark background) for
  legibility; the **section itself stays fully transparent** so the dimmed,
  drifting settle-state particles keep showing through in the gaps around and
  between cards, not just hidden behind them.
- Copy, subtitles, and card-to-route mapping are verbatim from the locked
  brief (§8) — nothing paraphrased or improved on unilaterally.
- **3 of 5 target routes don't exist yet:** `/library` and `/studio` are
  live; `/builder`, `/visualizer`, `/typography` are not — those three cards
  will 404 until the route consolidation (§8, already tracked as separate
  app-side work) actually happens. Not a defect in this component; a
  pre-existing, already-documented gap.
- Bundle check held: `/` is 117 kB first-load (was 116 kB pre-Phase-5) — still
  comfortably under the 150 kB budget, and Phase 5 added no client JS at all.

**Shipped — gate the cards behind the explosion, not raw scroll (founder feedback, 2026-07-24):**

Real bug, found by the founder actually scrolling through it: the cards were
mounted unconditionally as ordinary document-flow content right after
`.stage`. Since `.stage` is a fixed 300vh regardless of whether anyone has
ever clicked a color, scrolling past it showed the cards laid directly over
a fully intact, still auto-rotating, **unexploded** globe — "sitting on top
of the globe, looks like a complete mess," their words. The fix isn't
cosmetic — it's that the cards' *existence in the DOM* is now conditional:

- `FeatureCards` only renders after a click has actually exploded the globe
  (a `cardsRevealed` state flipped by a timeout keyed off
  `EXPLOSION_DURATION_SECONDS`, same constant the shader uses). Verified
  directly: before any click, `document.body.scrollHeight` is *exactly* 3.00x
  `window.innerHeight` — there is nowhere to scroll to reach the cards at
  all, which is what actually rules the bug out rather than a z-index or
  timing tweak that could still race.
- **The auto-navigate-to-`/library` behaviour from Phase 4 is gone.**
  Clicking a color no longer teleports you off the landing page — the
  explosion now reveals the toolkit (the cards) as the next beat of the
  story, matching "so they know what tabs they'll be able to work with."
  The picked color still isn't lost: it's carried into the **Library
  card's own link specifically** (`/library?color=HEX`), so choosing to
  actually enter Library still opens on the color that was searched for —
  it just waits for that to be a deliberate click on a card, not an
  automatic redirect.
- Once the cards mount, the page smooth-scrolls to present them
  (`scrollIntoView`) — otherwise "reveal the cards" would silently add
  content below the fold with nothing telling the visitor anything changed.
- **Reduced-motion gap closed as a direct consequence:** the pointer-effect
  used to `return` immediately whenever `reducedMotion` was true, meaning
  the click listener was never even attached — a reduced-motion visitor
  could never trigger `onExplode` at all, and would have been permanently
  stuck with no way to reach the cards under this new gated design. Click
  now stays live in both modes; only the drag-to-orbit listeners are
  skipped for reduced motion (dragging a globe that isn't supposed to move
  doesn't fit the preference, and there's nothing to reorient while it's
  held static anyway).
- The cards section gets a plain 700ms cross-fade + rise on its first paint
  (its DOM literally didn't exist a moment before, so this *is* the reveal
  moment) — automatically reduced to instant by the existing global
  `prefers-reduced-motion` override, nothing extra needed for that.

**Open items:**
1. **Sound** — deferred until the landing page is signed off. *Remind the founder.*
2. Route migration to the 5-tab structure (§8) — app work, not landing
3. Confirm the dual-license choice (PolyForm vs AGPL+exception) and add LICENSE
4. **Phases 3 and 4 remain unreviewed by the agent for feel** (see §10) — the
   morph pacing, drag direction/sensitivity, hover, click, and explosion are
   all scroll/frame-gated and this sandbox pauses `requestAnimationFrame`
   entirely; verified here means "correct code, correct DOM, no console
   errors, matches the maths" — not "confirmed to feel right." Phase 5's
   *content* (the DOM the cards actually render) was directly confirmed via
   `elementFromPoint` and rect inspection at a real scrolled position, since
   that content, unlike the canvas, doesn't depend on rAF at all.

---

## 12. Globe rebuild — free orbit, zoom, opaque shell (locked 2026-07-24)

Founder feedback that triggered this: *"its not fully 3D. I should be able to
turn it around however I want. Also the white 'light' shining on it is tooo
much, no need for that — the hero here are the colors. I should be able to zoom
in and out of the sphere as well. Has to be smoother — make it so that I cant
see through it."*

### The key finding: "too much white light" and "I can see through it" are the same bug

They read as two asks; they have **one** root cause. The material uses
`AdditiveBlending` with `depthWrite: false`, so every particle along a view ray
*sums*. Where the shell is dense — the middle of the globe, where the far side
stacks behind the near side — those sums saturate to white. That is the "white
light." And because nothing writes depth, the far side is never actually
occluded, which is the "see through it."

The existing `depthFade`/`facing` term in the vertex shader was a **workaround
for exactly this**: it dims particles by world-space `z` so the far side stops
blowing the near side out. It was treating the symptom.

**The fix removes code rather than adding it:** switch to `NormalBlending` +
`depthWrite: true` + `depthTest: true`, and **delete `depthFade`/`facing`
entirely**. The depth buffer then genuinely occludes the far side, so there is
nothing left to blow out and nothing to fake-dim.

Additive was originally chosen so particles read as *emitted light in a void*.
That only matters where particles overlap — which is only the globe, i.e. the
exact place it is causing the problem. Rain and the settled explosion are
sparse enough that additive vs. normal is visually near-identical there. So
opaque throughout is an acceptable trade, not a regression.

### Decisions

**D1 — Rotation: quaternion uniform, camera stays on the +Z axis.**
Replace the `uRotation`/`uTilt` Euler pair with a single `uOrient` (`vec4`
quaternion). Euler angles are why rotation is currently constrained (and why
`MAX_DRAG_PITCH_RADIANS` had to clamp at 60° to avoid a pole-on flat disc);
a quaternion gives true trackball rotation on any axis with no gimbal issues
and no clamp.

Deliberately **not** drei's `OrbitControls`, for two concrete reasons:
1. The canvas is `position: fixed; inset: 0` — it covers the entire viewport.
   OrbitControls binds wheel for zoom, which would swallow page scroll
   *everywhere*, and page scroll is what drives the whole rain→gather story.
2. The existing auto-spin behaviour (fades in with morph, halves on hover,
   pauses during drag, resumes after ~2s) is finer-grained than
   `autoRotate` exposes, and already works.

Because the camera only ever *dollies* along Z and never orbits, world-space
`spherePos.z` keeps meaning "toward the camera" — so this stays compatible
with the fixed-camera assumption the rest of the shader was built on.

**D2 — Opaque, depth-tested shell.** See the finding above. Fragment discards
outside the disc instead of feathering a halo into an additive sum.

**D3 — Zoom: camera dolly, with a scroll-release escape hatch.**
`camera.position.z` over roughly 4.5–12. Wheel-to-zoom is active **only** while
the globe is assembled and not exploding. Critically: when already at minimum
zoom and the user keeps wheeling outward, **do not** `preventDefault` — let the
page scroll again. Without that release the visitor is trapped on a
full-viewport canvas with no way to scroll back up and re-watch the gather.
Pinch on touch. The existing `9.0 / -mvPosition.z` term in `gl_PointSize`
already makes points scale correctly under dolly, for free.

**D4 — Picking: ray–sphere intersection + a spherical bucket grid.**
Replaces the current O(n) "project all 30k particles and take the nearest in
NDC" scan. The globe *is* a sphere, so the pointer ray can be intersected
analytically, inverse-rotated into sphere-local space, and resolved to a
lattice index via a precomputed (lat, lon) bucket grid — scanning ~tens of
candidates instead of all of them. This is exact rather than radius-guessed
(`HOVER_NDC_RADIUS` goes away), and it is **O(1) in particle count**, which is
what unblocks D5.

**D5 — Smoothness.** Drag gains angular velocity + damping so it glides to a
stop instead of halting dead. Particle count can now rise (D4 removed the
per-particle CPU cost that made 30k the ceiling) if the shell still reads gappy
after D2 — but note the existing density is already ~5px spacing against
~6–25px points, so D2 alone may be sufficient. **Measure before raising it.**

### Consequences to handle during implementation
- `src/lib/landing/rotate-sphere-position.ts` and its 9 tests are superseded by
  quaternion helpers — delete, don't leave both.
- `HOVER_NDC_RADIUS`, `MAX_DRAG_PITCH_RADIANS`, `DRAG_PITCH_RADIANS_PER_PIXEL`
  all become obsolete.
- The explosion path still reads `spherePos` as its outward normal; quaternion
  rotation must be applied before that, exactly where the Euler pair was.
- Reduced motion still renders the assembled globe static — verify the opaque
  path looks right with `uMorphProgress` pinned at 1.
