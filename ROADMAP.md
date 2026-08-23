# Colors World — Roadmap v6

**2026-08-23.** Supersedes v5 (2026-08-17), which described a five-tab product
that no longer exists.

> **Ground truth lives in [`docs/AUDIT-2026-08-23.md`](docs/AUDIT-2026-08-23.md).**
> Every state claim in this file comes from there and was measured, not
> remembered. When the two disagree, the audit wins and this file is wrong.

---

## The vision — unchanged

1. **A top-100 fastest-growing GitHub repo in design.**
2. **World-class** — not "good for a solo project."

Everything below is judged against those two and nothing else. The licence
question that gated v5 is **resolved**: `src/lib/color-engine/**` is MIT, the
application stays PolyForm Noncommercial. The engine is the part that attracts
dependency adoption, and it is now free to.

---

## Where we actually are

**The product is six rooms, all built, all live, all audited clean.**

`/library` · `/compose` · `/scales` · `/visualizer` · `/typography` · `/studio`

Live at [colors-world.vercel.app](https://colors-world.vercel.app). 130 commits.
33.5k source LOC, 935 tests, 86.65% coverage, zero dead files, zero TODOs.

Across all six rooms: **0 of 249 text runs below WCAG target · 0 unnamed
controls · 0 collapsed containers · no overflow · working skip links.**

### What v5 got wrong

v5 listed shared `<TabNav>`, `/visualizer` and `/typography` as ❌ not started.
All three shipped. It also tracked a `/builder` tab that is now a redirect to
`/scales`, and had no concept of `/compose` at all. **v5's state table should
not be quoted by anyone, including me.**

### The phase

v5's critical path ran 0–8. Steps 0–7 are done. **Step 8 was "the V2 audit" —
the consolidated cross-tab pass — and that is what just finished for the six
rooms.** What remains of it is the surface *outside* the rooms, plus the
repo-level work an open-source project needs and has never had.

So: **the product is done enough to launch. The repo is not.**

---

## The critical path from here

Ordered by what compounds toward the two goals, not by what is unfinished.

### 1 · Make the documents true — ⚠️ **do this first, it is why we got lost**

Five documents described five different products (audit §7). Two are fixed as
of this commit — this roadmap and the audit. Remaining:

- **`README.md`** — omits `/compose` and `/scales` **entirely**, still marks
  `/visualizer` and `/typography` as 🚧 "In development", documents a
  `02 · Builder — /builder` route that redirects, and ships
  `docs/assets/builder.png`, a screenshot of a page that no longer renders.
  For most visitors the README *is* the product; it currently hides a third of
  it. **Highest-value single edit in the repo.**
- **`ARCHITECTURE.md`** — retitle off the retired "PRISM" working name and
  delete its §9 Roadmap and §10 running total, which are a third source of
  truth. Keep the design reasoning; it is good and still accurate.
- **`docs/LANDING-PAGE-BRIEF.md`** — marked "authoritative… single source of
  truth for the WebGL landing page". WebGL was removed on instruction. Mark it
  historical rather than deleting it: the rejected-ideas list in it is load-bearing.
- **`docs/V2-AUDIT.md`** — every 🔴 in it is fixed. Mark superseded by the audit.
- **`docs/tab-02..05.md`** — keep as intent, correct the route names.

### 2 · Repo hygiene an OSS project needs — small, and it is the growth substrate

None of this exists today:

- **CI.** No `.github/` at all. The verification standard — tsc clean, suite
  green, prod build clean — is entirely manual. A repo asking for contributors
  must run its own tests on a PR.
- **`.env.example` is incomplete** — missing both `NEXT_PUBLIC_SUPABASE_*` vars,
  so **a fresh clone cannot run.** This is a hard blocker on the first
  contributor and it is a two-line fix.
- **ESLint config** — `next lint` prompts interactively; nothing has ever been
  linted.
- **`CONTRIBUTING.md`, `SECURITY.md`, `.nvmrc`, `.editorconfig`**, issue and PR
  templates.
- **Sweep:** delete the unused `postprocessing` dependency (dead since the globe
  was removed), the stray tracked `library.png` at the repo root, the 4 merged
  branches, and the 4 test-only modules (320 LOC) — or wire `board-cache.ts` in,
  which was the intent.

### 3 · Decide four things — they gate otherwise-ready work

Three routes are structurally incomplete (`/assets` has no `<main>` at all;
`/login`, `/palettes`, `/merge` are missing landmarks and skip links). Fixing
them is a couple of hours — **but three of them may not survive these
decisions, and repairing a route you are about to delete is wasted work.**

| # | Decision | What it unblocks |
|---|---|---|
| 1 | **`/merge`** — real history UI, or delete? | It is an orphan with zero inbound links |
| 2 | **`/palettes` + `/assets`** — fold in, keep secondary, or retire? | `/assets` is also an orphan |
| 3 | **`/library/[id]`** — link it from library cards, or delete? | A complete colour-detail page is currently unreachable |
| 4 | **The landing CTA** — scrim, reroute the filament, or accept? | Worst local contrast 1.24:1, and the worst point moves |

### 4 · Finish the audit against those answers

Landmarks, skip links and accessible names for whatever survives step 3. Then
audit the three routes that could not be driven for lack of instances:
`/library/[id]`, `/palettes/[id]`, `/share/[token]`.

### 5 · The demo GIF

Carried from v5 and still the one thing a static capture cannot sell. The rooms
are motion-heavy — the paint system, the prism button, the canvas — and none of
it is visible in the README. Needs a screen recording.

### 6 · Launch

The site is live and the loops (share links, watermarked PNG export, zero-signup
trial) are already running. What they lack is anyone pointed at them. Spend the
HN / Product Hunt / Designer News shot **after** steps 1 and 2, never before —
a visitor who arrives at a README that omits two rooms, or a contributor who
cannot run a fresh clone, is a wasted impression.

---

## After launch — the engine roadmap

Committed 2026-08-21 and still entirely unbuilt. This is the work that makes the
engine a dependency people adopt rather than a demo they star and forget.

**Colour**

1. **CIELAB + ΔE2000** — the highest-value gap. ΔE2000 is the print and brand-QC
   industry standard; packaging and compliance will not accept ΔE-OK instead.
2. **ICC profile support** (ICC.1 / iccMAX) — the real bridge to print. Large
   lift, large credibility.
3. **Standards, named and checked** — CIE 1931 XYZ · CIEDE2000 · ISO 12647 with
   FOGRA/GRACoL/SWOP · **EN 301 549** and **Section 508**, which are the legal
   hooks procurement actually asks about.
4. **Spaces, in priority order** — HCT · CAM16-UCS · Jzazbz · ICtCp · ACES/
   ACEScg and Rec.2100 PQ/HLG · Adobe RGB 1998 and ProPhoto.
5. **Pantone stays out** — licensed. Name it only to explain its absence.

**Typography** (weaker than colour today; bring to parity)

6. **WCAG 1.4.12 Text Spacing** as a real check — line-height ≥ 1.5,
   letter-spacing ≥ 0.12em, word-spacing ≥ 0.16em, paragraph ≥ 2em. Concrete,
   legally citable, and almost nobody implements it well. **The single best
   typography differentiator available.**
7. **WCAG 1.4.4 Resize Text** and **1.4.8 Visual Presentation**.
8. **Font technology** — OpenType/ISO-IEC 14496-22 features, variable axes,
   WOFF2, UAX #14 line breaking.
9. **Metrics-aware type** — cap height, x-height, baseline-grid alignment. The
   landing page had to measure a descender by hand because nothing exposed this.

---

## Known scaling consideration — flagged, not solved

Every anonymous visitor gets a real session, and `/studio` provisions a
`projects` + `project_members` row per visitor on first view, permanently. At
ten users, irrelevant. At launch traffic it is an unbounded write vector for any
crawler. Options when it matters: provision lazily on first *write*, reap empty
anonymous projects after N days, or gate `/studio` behind an account while the
other rooms stay open. Documented in `supabase/policies.sql`.

Related: `enable-rls.sql` **cannot be run past the first user** — its bootstrap
`raise exception`s unless exactly one profile exists, aborting the script before
any policy executes. `policies.sql` is the idempotent layer that can.

---

## Verification standard

Pure logic in `lib/` with unit tests · UI verified **by measurement in a real
browser**, not by screenshot · `tsc` clean · full suite green · production build
verified in a throwaway copy, never in place.

Two hard-won rules:

- **Green means nothing on its own.** `tsc` clean, 911 tests passing and a green
  production build all held while the landing page's rain died after 80 seconds.
- **Always falsify a regression test against the bug it claims to catch.** Two
  of three written for that bug passed on the broken code until this was checked.
