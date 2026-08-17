# Colors World — Roadmap v4 (reframed 2026-08-17)

> **This supersedes v3.** v3 was organised around Phases 1–7 and was written
> *before* the product was restructured into five tabs. Everything built since
> (`/library`, `/builder`, `/studio`) happened outside that structure, so the
> phase numbering no longer describes the product. v4 is organised around the
> **5-tab model** that is now the actual shape of the app.
>
> The v3 narrative — the vision, why moodboarding became the centre, the
> open-source pivot — is still correct and is summarised below rather than
> repeated in full. The landing page keeps its own authoritative spec in
> [docs/LANDING-PAGE-BRIEF.md](docs/LANDING-PAGE-BRIEF.md).

---

## The vision (unchanged)

**A creative studio for colour and brand — where 16.7 million colours are a
world you explore, and your dashboard is your studio wall.** Open-source, free,
built for designers and marketers first, not colour-tooling professionals.

The rigour (OKLCH engine, WCAG/APCA, gamut mapping, version DAG) stays as
*invisible infrastructure* that quietly stops you making mistakes — never as the
thing you interact with.

**Each tab is its own world.** Typography and atmosphere shift per tab to suit
what that tab does; the persistent shell — Harmonic Dock, navigation, account
status — stays structurally constant. Geist Mono is the one deliberate global
exception, reused for numeric legibility rather than aesthetics.

---

## Where this actually stands, 2026-08-17

| | |
|---|---|
| Routes | 13 (`page.tsx` files) |
| Tests | 500 passing, 54 files, `tsc` clean |
| Production build | compiles clean; largest first-load `/library` 182 kB, `/studio` 138 kB |
| Live data | 100,000 colour rows · 4 palettes · 10 versions · 9 board items · 6 profiles · 1 project |
| Tabs built | 3 of 5 |
| Deployed | not yet — Vercel import still a manual step |

**Verified live against the restored Supabase project on 2026-08-17**, not
assumed from code.

---

## 🔴 Blocking right now — two configuration gaps, no code involved

Both are things only you can do (Supabase dashboard / SQL editor). Both are
currently breaking shipped features, and neither is visible from the codebase —
they were found by probing the live database.

### P0-1 · `palette_versions.builder_specs` does not exist in the live database

`schema.sql` gained this column on 2026-07-28 when `/builder` learned to save
its `ScaleSpec[]`, but **the migration was never run against the live project.**

`createVersion()` inserts `builder_specs` unconditionally
([palettes.ts:180](src/lib/supabase/palettes.ts)), so PostgREST rejects the whole
insert. This is not "specs silently don't persist" — it is a hard failure of
*every version write*, which breaks three separate surfaces:

- saving a palette from **`/builder`**
- **`/studio`** image-drop → palette extraction (`createImageAction` →
  `initializePalette` → `createVersion`)
- version commits on **`/palettes`**

**Fix:** run `supabase/schema.sql` in the Supabase SQL editor. Idempotent.

### P0-2 · Anonymous sign-ins are disabled on the project

`middleware.ts` calls `signInAnonymously()` for every visitor without a session.
The live project rejects it: `Anonymous sign-ins are disabled (422)`.

Effect: **every visitor hits the login wall.** The core "browse and collect with
zero signup wall" promise — built and shipped as task #43 — is dead in
production. This is also what blocked live verification of `/studio` during its
build.

**Fix:** Supabase dashboard → Authentication → Providers → enable Anonymous
sign-ins. Likely reset when the project was paused.

> **Do these two first.** Until then `/studio` cannot be verified end-to-end and
> `/builder` cannot save.

---

## The 5-tab model — status

| # | Tab | Route | State | Spec |
|---|---|---|---|---|
| 01 | Library | `/library` | ✅ V1 shipped | (consumed) |
| 02 | Builder | `/builder` | ✅ V1 shipped | `Tab 02.md` |
| 03 | Studio | `/studio` | ✅ V1 shipped, **unverified live** | `Tab 03.md` |
| 04 | Visualizer | `/visualizer` | ❌ not started | `Tab 04.md` |
| 05 | Typography | `/typography` | ❌ not started | `Tab 05.md` |

Tab specs 02–05 live on the Desktop, not in the repo — **they should move into
`docs/`** so they are version-controlled with the code they describe.

---

## What to change, edit, remove, add

### Remove

- **`/merge`** — orphaned. Zero inbound links from anywhere in the app; it ships
  in the production bundle (129 kB) and no user can reach it. The three-way
  merge machinery underneath is sound and worth keeping in `lib/`; the *route*
  is dead surface. Either wire it into the history UI deliberately or delete the
  page.
- **`/spectrum` and `/scale-lab`** — permanent-redirect stubs to `/library` and
  `/builder`. Correct to have kept during the transition; worth a decision on
  whether they stay forever as link-rot insurance or get dropped before launch.

### Change

- **Navigation is hand-rolled four times with four different link sets.**
  `/studio` links to builder·library·palettes·assets; `/builder` links to
  studio·library·palettes; `/library` links to studio·builder·assets; `/assets`
  links to four more. **No tab links to all five tabs**, and Tabs 04/05 have
  nowhere to appear. This directly violates the locked "shell stays structurally
  constant" decision. → **Extract one shared `<TabNav>` shell component** driven
  by a single route manifest.
- **`/palettes` and `/assets` are pre-tab-era surfaces** that never got folded
  into the 5-tab model. They are reachable, functional, and conceptually
  homeless. → Needs a product call (see below).

### Add

- **Tab 04 `/visualizer`** — live UI component templates, contrast auto-fix, CVD
  simulation, Tailwind v4 / shadcn export. Note `/studio` deliberately deferred
  its "live UI preview nodes" here, so this tab already has a dependency waiting
  on it.
- **Tab 05 `/typography`** — font ingestion (local `queryLocalFonts()` + Google +
  Fontshare), variable-axis controls, optical legibility audit, fluid `clamp()`
  generator, specimen export.
- **Deployment.** Nothing is live. Vercel import + env secrets is a manual step
  that has been outstanding since v3.

---

## Sequencing — what I'd do, in order

1. **Unblock** — P0-1 and P0-2 above. Minutes of work, currently breaking
   shipped features.
2. **Verify Tab 03 live** — the full `/studio` pass that was blocked: pan/zoom
   feel, snap + image docking, resize persistence, auto-format + undo, PNG
   export, glow performance on a populated board, and the read-only share page.
   This is the one piece of V1 never confirmed against a browser.
3. **Build Tab 04 `/visualizer`** — completes the palette → UI → audit → export
   loop, which is the product's most defensible story.
4. **Build Tab 05 `/typography`**.
5. **V2 audit pass** — the consolidated cross-tab review that was always the plan
   after all five V1s land. Shared nav shell, `/palettes` + `/assets` resolution,
   `/merge` decision, visual consistency, accessibility, performance.
6. **Deploy.**

The alternative sequencing — V2-audit Tabs 01–03 *before* building 04/05 — costs
a second audit pass later, because Tabs 04 and 05 will surface their own shell
and consistency problems. Finishing all five V1s first, then auditing once, is
what the original plan assumed and I still think it is right.

---

## Needs your call

These change what gets built and I would rather not pick silently.

1. **`/palettes` and `/assets`** — fold them into the five tabs (e.g. palettes
   becomes a Library view, assets becomes a Studio panel), keep them as
   secondary routes outside the tab model, or retire them?
2. **`/merge`** — wire into a real history UI, or delete the route?
3. **Open-source vs hosted service** *(carried unresolved from v3)* — self-host
   only, a free hosted instance you run, or both? This shapes the auth model,
   rate limiting, abuse handling, and how the Gemini vibe-search key is handled.
4. **Spectrum/Library ordering** *(carried unresolved from v3)* — hue-major is
   the only implemented ordering and reads as a colour-professional's mental
   model, not a browsing-for-inspiration one. Multiple orderings are cheap
   (one integer column each) but need direction on *which*.

---

## Carried forward from v3 — still true, still open

- **Bulk font upload** needs a real licensing answer before it gets built, not
  just code. Tab 05's `queryLocalFonts()` approach sidesteps this neatly for the
  local-fonts case ($0 hosting, zero copyright exposure) but does not answer the
  question for uploaded fonts.
- **The landing page** stops deliberately after the globe set piece. Sections
  3–6 of the brief (feature bento, open-source credibility strip, scrollytelling
  deep-dive, closing CTA) remain unbuilt. The credibility strip is the one that
  actually matters for the 10k-star goal.
- **`sharing.sql` re-run** for the one-active-share-per-project partial unique
  index. `board_shares` and `brand_assets` are both confirmed present live; this
  index is the remaining unverified detail.

---

## Verification standard

Every tab is built the same way: pure logic extracted into `lib/` with unit
tests, UI verified live in a browser, `tsc` clean, full suite green, production
build clean before it is called done.

**Tab 03 is currently the exception** — it has 500-test coverage and a clean
build, but its live browser pass never happened because the database was
unreachable. That is step 2 above, and it should close before Tab 04 starts.
