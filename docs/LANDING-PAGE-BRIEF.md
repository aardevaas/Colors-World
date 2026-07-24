# Landing Page — Locked Brief & Decisions

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
| Brand colour | **None.** All colours are the brand. The identity *is* the spectrum. |

**Live hero copy (do not rewrite without asking):**
- Eyebrow: `Open-source · Free forever`
- H1: `Every colour.` / `All 16.7 million of them.` ("16.7 million" is the gradient-swept accent)
- Sub: `The free, open-source studio for colour, palettes, branding, and typography — built in the open, for everyone.`
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
- **OPEN — needs a decision by feel:** storm acceleration driven by scroll
  *velocity* (flick fast → violent storm) vs. scroll *progress* (steady ramp).
  A temporary `storm: velocity|progress` toggle sits in the HUD so both can be
  compared live. **Delete the toggle once chosen.**

---

## 5. Colour system — the "16.7 million" question, settled

**There is no "base" to upload. There never was.**

16,777,216 = 256³ = every 24-bit RGB triplet. The integer index **is** the
colour. Zero database rows, zero storage, O(1) lookup — already implemented in
`src/lib/spectrum/generate-color.ts` (`composeIndex` / `indexToSwatch`). Every
output format is a pure function of that index and already exists in
`src/lib/color-engine`: **HEX · sRGB · CMYK · OKLCH**.

This is the most efficient possible design; there is nothing to optimise.

### Globe mapping — deviates from the Gemini spec, on purpose
The spec said HSL (hue=longitude, sat/light=latitude). **Rejected.** The whole
product is OKLCH-based; HSL would be perceptually lumpy *and* inconsistent with
what the Spectrum actually shows. Particles use the real engine, so a colour on
the landing page is literally a colour in the product.

Positions come from a **Fibonacci lattice**, not a lat/long grid — a lat/long
grid bunches at the poles and gaps at the equator. A unit test asserts **<5%
population deviation across equal-area bands**, which is the mathematical
guarantee the globe reads as a gapless shell.

Colour is derived *from* each particle's own seat: longitude → hue,
latitude → lightness. The globe is therefore a smooth spectrum **by
construction**, and the rain already wears its final colour as it falls.

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
colours; the table remains the only source of *meaning*.**

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
  navigate to **`/library?color=FF5733`** with that colour pre-loaded as the base.
- **Mobile tap:** same — capture, explode, navigate.

---

## 7. Explosion & Phase 5 handoff

- **Trigger: clicking the sphere / a colour.** (Scroll-past trigger dropped.)
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

`/` = landing. Each card maps **1:1** to a primary app route. Colour selections
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
variation; instant colour info + accessibility breakdown.
**Globe clicks land here.**

**Card 2 — Builder:** fully customisable generator + anchor-based scale engine
(chroma, step, hue torsion); live gamut testing (sRGB / Display P3 / Rec2020);
CVD sims (protanopia, deuteranopia, tritanopia, achromatopsia); 1-click export
to Tailwind, CSS variables, Figma.

**Card 3 — Studio:** Miro-like infinite spatial moodboard; drag/pin colours and
palettes; integrated Brand Asset Vault for logos, marks, reference images.

**Card 4 — Visualizer:** preview palettes on real UI components; extract hexes
and dominant palettes from uploaded images; Tailwind live theme previewer; WCAG
contrast checker.

**Card 5 — Typography:** dynamic font pairing + hierarchy visualiser;
real-time text-over-colour WCAG scoring; dark/light font scaling for web and
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
  stage; the colours are the only light source.

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
  colour in the Library.
- Accessible **"Skip to content"** link first in the DOM.
- Explicit **`Motion: On/Off`** HUD toggle that overrides the OS default in
  **both** directions, so someone who wants the spectacle can opt back in.

### Sound
**Wanted** — interaction SFX with a mute toggle, muted by default.
> ⚠️ **Blocked:** the founder has reference inspirations but hasn't shared them
> yet. Ask before implementing.

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
- Colours from the real 16.7M engine; sphere seats on a Fibonacci lattice
- `aSpherePos` + `uMorphProgress` already wired and held at 0 — **Phase 3 is a
  uniform ramp, not a rewrite**
- Reduced-motion fallback + skip link + motion override toggle
- 270 tests green, typecheck clean, zero console errors

**Next up:** Phase 3 (morph to globe) → Phase 4 (explosion + post-processing) →
Phase 5 (feature cards).

**Open items:**
1. Storm drive: `velocity` vs `progress` — decide by feel, then delete the toggle
2. Sound references — needed before audio work
3. Route migration to the 5-tab structure (§8) — app work, not landing
4. Confirm the dual-license choice (PolyForm vs AGPL+exception) and add LICENSE
