# Colors World — Roadmap v7

**2026-08-23.** Supersedes v6 (written this morning), which still described a
colour tool with adjacent tabs. The founder corrected the vision; this is the
product it actually is.

> Ground truth for *what exists* lives in
> [`docs/AUDIT-2026-08-23.md`](docs/AUDIT-2026-08-23.md). Every measurement in
> this file was taken in a real browser against the running app.

---

## The correction

Colors World is **not a colour tool**. It is a platform where a brand, a
company or a solo founder builds a **complete, professional brand book without
leaving the site** — colour, typography, media, voice, components, governance.

Colour is the strongest instrument in the box, not the point of the box.

Three things follow, and they change the shape of the roadmap:

1. **Every room is a destination, not only a step.** Someone who wants a
   palette and nothing else must be able to finish in `/compose`. Today they
   cannot — see §2.1.
2. **Scales operate on a palette, not on one colour.** Today the room is
   "palette × colour" — one independent ramp per swatch — which is not a scale
   system.
3. **Studio is where the book assembles**, Miro-style. Everything upstream
   feeds it.

---

## The thesis — compute · assemble · articulate

The founder's brand-book list runs to roughly **60 deliverables across 9
sections**. Building all of it as one undifferentiated backlog is how a product
ends up broad and average. The list splits cleanly into three kinds of work,
and Colors World's position is radically different in each:

| | What it covers | Where we stand |
|---|---|---|
| **Compute** | Colour specs, contrast, type scales, spacing, tokens, accessibility | **World-class already.** OKLCH engine, WCAG + APCA, 4 CVD models, gamut mapping, a solver that takes requirements as input |
| **Assemble** | Logo system, imagery, iconography, motion, components, collateral | **Partial.** Studio is a real canvas; `/assets` has logo/mark versioning but is an orphan |
| **Articulate** | Mission, values, archetype, voice & tone, taglines, editorial rules | **Absent.** Nothing in the product touches this |

**The differentiator sits in "compute", and it is defensible.** Figma, Canva,
Frontify and zeroheight all produce brand books where "4.5:1" is a number a
human typed into a document. Colors World can produce one where **every rule is
measured, live, and re-verified the moment anything upstream changes.** A brand
book that checks itself is a category nobody currently occupies.

That is the thesis. Everything below serves it.

---

## The missing spine

**There is no brand-book object in this codebase.** Zero references to a brand
book, guideline or style guide across 33,506 lines. Six rooms produce *inputs*
to an artifact that does not exist.

This is a bigger gap than any of the four room defects below, and it should be
built early rather than last — because it is what turns six good rooms into one
product, and because every room's export target becomes obvious once it exists.

---

## What the rooms actually need — measured

### 2.1 `/compose` is not a destination

**Measured:** zero export, copy, save or download affordances. The only exit is
"Apply to System", which pushes the palette into shared state and expects you to
walk to another room.

A user who came for a palette **cannot finish**. Needs: copy as HEX/RGB/HSL/
OKLCH, export CSS variables / Tailwind / JSON / shadcn tokens, save a named
palette, share a link, download a PNG card. The exporters already exist in
`src/lib/exporters/` — they are simply not wired to this room.

### 2.2 `/scales` — three separate problems

**Measured: 208 controls in the room for a six-colour palette, across 3,971px
of scrolling — four screens.** 33 controls per panel, of which 15 are curve
control points spread over 3 SVG editors.

- **The star is a dead control.** Clicking it moves the marker and re-derives
  names, but it **never writes `system.anchorHex`** — so it resets on reload,
  and `/visualizer`, `/typography` and `/compose`, which all read that anchor,
  never see the change. Verified: star index 0 → 2, reload → back to 0, storage
  unchanged.
- **The three curve editors (lightness, chroma, hue torsion) are the wrong
  instrument.** Dragging control points on three separate SVG graphs is a
  colour-scientist's interface, not a designer's. Needs presets and direct
  manipulation first, curves behind "advanced".
- **It is palette × colour, not a palette system.** Each swatch gets its own
  independent ramp with its own settings. A real scale system ramps the
  *palette* — shared steps, consistent lightness stops across colours, one set
  of tokens — which is what anybody consuming this downstream actually needs.

### 2.3 `/visualizer` is a postage stamp

**Measured: the stage is hard-fixed at 760×475px.** It uses **23% of a 1600px
viewport and 10% of a 2560px one — it never grows.** The inspector beside it is
320px.

The founder's ask is right and bigger than resizing: **this room should be the
interface you are editing**, full-bleed, edited in place and in real time —
click a button, change its radius, see the token move. That makes it the
component-library surface for brand-book §6, not a preview pane.

### 2.4 `/typography` ships four pairings

**Measured:** 4 hardcoded presets, plus `queryLocalFonts()` — which is
Chromium-only and permission-gated, so most visitors see four options.

**Recommendation, verified live: the Fontsource API.**

| | |
|---|---|
| Endpoint | `https://api.fontsource.org/v1/fonts` — **no API key** |
| Families | **2,096** (1,976 Google + 120 other) |
| Variable | 565 |
| Categories | 789 sans · 481 display · 365 serif · 364 handwriting · 72 mono |
| Licences | 2,052 OFL-1.1 · 36 Apache-2.0 · rest CC0/MIT/UFL — **all open** |
| Metadata | family, weights, styles, subsets, variable axes, category, **licence** |
| Files | jsDelivr CDN, or self-host via npm |

It is open-source, needs no key, and **carries the licence per family** — which
brand-book §9 requires anyway. Google's own API needs a key and gives less.

---

## Gap analysis — the 9 sections

Honest mapping of the founder's list against what exists today.

| § | Section | State |
|---|---|---|
| 1 | **Brand strategy & narrative** — mission, values, archetype, positioning, voice & tone, taglines | **Nothing.** Pure "articulate" work. Highest AI leverage in the product, and every competitor is weak here |
| 2 | **Logo system & architecture** — variants, clear space, min sizes, misuse | **Seed exists** — `/assets` versions logo/mark files, but it is an orphan with no `<main>`. Construction grid, exclusion zone, misuse examples: none |
| 3 | **Colour architecture** — hierarchy, HEX/RGB/HSL/CMYK, state colours, themes, WCAG | **Strongest area.** 60/30/10 weighting, Pantone (licensed — stays out, named), and explicit state tokens are the gaps |
| 4 | **Typography system** — families, hierarchy, formatting, etiquette | **Half.** Scale and fluid clamp are good; needs the font library, full H1–H6 spec output, and 1.4.12 text-spacing checks |
| 5 | **Imagery, graphics & motion** — photography, illustration, iconography, motion | **Nothing** beyond Studio holding images. Iconography grid and motion tokens are computable — a real opportunity |
| 6 | **Web / UX / product design system** — grid, breakpoints, components, states | **Partial** — exporters emit tokens; `/visualizer` becomes this surface once it is the real interface |
| 7 | **Editorial & marketing** — style rules, social, email, decks, ads | **Nothing.** Template surface; Studio is the natural home |
| 8 | **Physical collateral** — stationery, packaging, swag | **Nothing.** Lowest priority; furthest from the engine |
| 9 | **Governance & infrastructure** — taxonomy, formats, DAM, licensing, changelog | **Real foundation exists** — versioning with true branch/merge, a DAG, share links. Needs naming conventions, format matrix, licence tracking |

**Read:** we are strong in §3, half in §4 and §6, seeded in §2 and §9, and
absent in §1, §5, §7, §8.

---

## The path

Ordered so each step makes the next one cheaper, and so the product is
coherent at every stop rather than only at the end.

### Phase A — make every room finishable *(weeks, not months)*

1. **`/compose` gets exports.** Wire `src/lib/exporters/` in. Smallest change
   with the largest effect on "I came for a palette and got one."
2. **Fix the star**, and make the anchor a System-level concept every room
   honours.
3. **Font library in `/typography`** via Fontsource — search, filter by
   category and variable, preview, licence shown.
4. **`/visualizer` goes full-bleed** and responsive. Resizing is the cheap half;
   editing-in-place is Phase C.

### Phase B — the spine

5. **Build the Brand Book object.** A real document: sections, ordering, a
   live-linked value for every rule, versioned like everything else here.
   Every room gains one verb — *send to brand book*.
6. **Export it.** Web (a shareable, always-current URL), PDF, and tokens.
   The share-link and PNG-export machinery already exists.
7. **Adopt `/assets`** into the book as §2, and give it the landmarks it never
   got.

### Phase C — depth where we already win

8. **`/scales` reworked** to ramp the palette, with presets first and curves
   behind "advanced".
9. **`/visualizer` becomes the editable interface** — the component library
   surface for §6, with states and tokens.
10. **Iconography and motion** as computed systems (grid, stroke, optical
    volume; easing curves and duration scale). Both are engine work, which is
    where we are strongest.

### Phase D — articulate

11. **Voice, tone and narrative** (§1) — guided, AI-assisted, with the output
    living in the book. This is the section competitors do worst and the one
    that makes the book feel complete rather than a token dump.
12. **Editorial and marketing templates** (§7).

### Not now — and say so

§8 physical collateral. Furthest from the engine, heaviest to do well, and it
does not compound. Revisit once the book exists and people ask.

---

## Carried forward from v6 — still true, still needed

- **Repo hygiene.** No CI at all, no ESLint config, no `CONTRIBUTING.md`.
  A repo asking for contributors must run its own tests on a PR.
- **Four routing decisions** — `/merge`, `/palettes` + `/assets`,
  `/library/[id]`, and the landing CTA at 1.24:1. Phase B answers the
  `/assets` question by absorbing it.
- **The engine roadmap** — CIELAB + ΔE2000 first (the print and brand-QC
  standard; ΔE-OK is not accepted in packaging or compliance), then ICC
  profiles, then WCAG 1.4.12 text spacing. All three are brand-book features
  as much as engine features.

---

## Verification standard — unchanged

Pure logic in `lib/` with unit tests · UI verified **by measurement in a real
browser**, never by screenshot · `tsc` clean · full suite green · production
build verified in a throwaway copy.

Two rules that keep being earned the hard way:

- **Green means nothing on its own.** `tsc` clean, 911 tests passing and a
  green build all held while the landing page's rain died after 80 seconds.
- **Always falsify a regression test against the bug it claims to catch.** Two
  of three written for that bug passed on the broken code.
