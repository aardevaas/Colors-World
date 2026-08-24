# Colors World — Roadmap v8

**2026-08-23.** Supersedes v7 (written this morning). v7 was written *before*
the founder answered the four blocking questions and *before* the component
registry existed. Both of those changed the shape of the plan, so this is a
rewrite rather than an edit.

> **Ground truth for what exists** is [`docs/AUDIT-2026-08-23.md`](docs/AUDIT-2026-08-23.md)
> — every measurement taken in a real browser against the running app.
> **Ground truth for what the product produces** is
> [`docs/BRAND-BOOK-SPEC.md`](docs/BRAND-BOOK-SPEC.md) and the registry itself,
> `src/lib/brand/`. Where a document disagrees with the registry, the registry
> is right — it is the one that fails a build.

---

## 1 · The four decisions this plan is built on

Answered 2026-08-23. They are constraints now, not options, and every phase
below is downstream of them.

| # | Decision | What it forces |
|---|---|---|
| **D1** | **Primary user is mostly solo designer (A) and founder/marketer (B), with some in-house team (C). Not agency (D).** | §1 authoring cannot be a late phase — B is half the audience and arrives with no palette. §6 tokens matter for C. White-label and client handoff are out. |
| **D2** | **Freemium.** The paid boundary is deliberately undecided. | Accounts are acceptable, but only where they buy something. The split state model *is* the boundary — see §3. |
| **§2.2** | **A — split state.** System stays URL-shaped and anonymous; Project is DB-backed. | Two stores, permanently. Every component declares which one it reads. The zero-signup promise is protected by architecture, not by discipline. |
| **D3/D4** | **Multi-project and collaboration both in scope.** | The System stops being singular. Approvals become a real object. This was in *no* phase of v7. |

**One call was assumed, not stated: M1 — the book is a VIEW, not a container.**
The founder's own field list asked for `render(state)`, which only exists under
the view model, so it was taken as confirmed. Everything below rests on it. If
the picture is actually a container you fill in, this roadmap is wrong and the
registry is shaped wrong.

**Still open, and none of it blocks Phase 0–2:** M2–M13 by reference, and the
`brandingstyleguides.com` membership (sample 25 → 100+, costs money, founder's
to authorise).

---

## 2 · What is actually built — measured, 2026-08-23

Three surprises, all of which make the plan cheaper than v7 assumed.

### Built and good

- **The colour engine.** OKLCH throughout, WCAG + APCA, four CVD models, gamut
  mapping, ΔE, a solver that takes contrast requirements as input. This is the
  spine and it is genuinely world-class.
- **The component registry — new, `e2ce91c`.** Layer 2: **80 components** as
  contracts with the readiness graph as data, 256 tests, provenance recomputed
  from the 25-book study on every run.
- **Versioning.** Branch, merge, a real DAG, share links. This is the machinery
  the governance whitespace needs, and it already exists.
- **Six rooms, structurally clean.** 0 of 249 text runs below target, 0 unnamed
  controls, 0 collapsed containers.

### Half-built, and switched off — the finding that reshapes D3

**`projects` and `project_members` tables exist. `createProject` exists.
And every one of the eleven call sites, across five files, resolves a single
implicit project with `resolveDefaultProjectId(userId)`.**

The plumbing is multi-project; the product is single-project by convention.
D3 is therefore not a new subsystem — it is *turning on* a subsystem that was
built and then routed around. v7 said "nothing in the plan covers it"; the
truth is most of it is already in the database.

**File storage is in the same state.** The `board-assets` bucket exists with
project-scoped RLS keyed on a `{project_id}/{uuid}-{filename}` path prefix, and
`brand_assets` has create/list/delete. So **M1's cost is the SVG geometry
derivation, not the upload plumbing.** That materially changes the answer to
5.1 — see §5.

### Absent

| Gap | Consequence |
|---|---|
| **No Book surface.** Nothing imports the registry. | 80 contracts render to nothing. The product still cannot show a brand book. |
| **No logo anywhere.** | The most universal component in the corpus (22 of 25 books) is the one thing the product cannot do. |
| **No authoring.** §1 is ten components of nothing. | Half the primary audience (D1 = B) has no front door. |
| **No approvals object.** `project_members.role` exists but defaults to `'member'`, which is not the registry's `owner\|editor\|reviewer\|viewer`. | D4 has a schema to reconcile before it has a feature. |

### Known functional defects, measured

These are pre-existing and they make every later phase dishonest if left.

- **`/compose` has zero export affordances.** The only exit is "Apply to
  System" — and the exporters already exist in `src/lib/exporters/`, unwired.
- **`/scales` star is a dead control.** Moves the marker, re-derives names,
  never writes `system.anchorHex`. Verified: star 0 → 2, reload → 0. Every
  other room reads that anchor, so it propagates nowhere.
- **`/scales` is 208 controls across 3,971px** for six colours.
- **`/visualizer` stage is hard-fixed at 760×475** — 10% of a 2560px viewport.
- **`/typography` ships 4 hardcoded pairings** against a Fontsource catalogue
  of 2,096 open-licensed families.

---

## 3 · The freemium line is structural, not a pricing decision

Because every component declares `storage`, the free/paid boundary is already
computed rather than argued:

| Tier | Components | What it is |
|---|---|---|
| **Free — no account, URL-shaped** | **14** (`storage: 'system'`) | All of §3 Colour, all of §4 Typography, plus `web.dataviz-palettes` |
| **Account — DB-backed Project** | **66** (`storage: 'project'`) | Everything that is a file, a paragraph, or a decision with history |

That is the product decision D2 deferred, expressed as architecture: **the
colour and typography half is anonymous, instant and link-shareable forever;
the brand-book half needs an account.** Nothing in the free tier is crippled —
it is a complete, legitimate, shippable colour-and-type book.

Where the money sits is still open. This says only where the *wall* is.

---

## 4 · The registry, measured — what it says about sequencing

| Cut | Finding |
|---|---|
| **Only 7 components appear in ≥40% of real brand books** | logo.primary 22 · type.families 20 · colour.palette 18 · logo.variants 12 · logo.misuse 12 · imagery.graphic-device 11 · logo.cobranding 10 |
| **Four of those seven are §2 logo** | And the product can do none of the four. |
| **Machines by size** | M2 **27** · M3 12 · M5 12 · M6 12 · M1 9 · M4 8 |
| **Evidence** | declared 51 · **measured 27** · cited 2 — so a third of the book is the differentiator |
| **Provenance** | observed 59 · founder 12 · derived 5 · proposed 4 — but **20 components measure a frequency of 0 with no Wheeler prescription** and are the honest cut list (§8) |
| **Biggest unlock** | `colour.palette` reaches **28** components, `logo.primary` **22**. The claim that the logo is the biggest unlock is false as the graph is declared. |

---

## 5 · 5.1 answered — logo cannot move before the Book

The founder asked whether to reorder 1 → 3 → 2, putting logo ingest before the
Book. **The evidence for logo-early is strong and the dependency forbids it.**

- **For:** four of the seven most common components in the corpus are logo,
  the generated misuse page is the most demonstrable feature in the plan, and
  upload plumbing already exists so it is cheaper than v7 assumed.
- **Against, and decisive:** logo assets are stored *per project*, so M1 needs
  the Project spine. And a logo with no Book has nowhere to render — the misuse
  page, the clear-space diagram and the background-safety proof are all *book
  pages*. Building them first means building them blind.

**Resolution: the Book ships first but only as the free tier** (14 components,
no account, no database). That proves the registry end to end in days, not
weeks, and it does not wait on the Project. Logo lands two phases later with
somewhere to appear. Net delay versus the founder's proposal is roughly a
fortnight, and it removes the risk of building six components against a
renderer that does not exist.

---

## 6 · The phases

Estimates assume current pace and are **±50%**. They are for sequencing
judgement, not commitments.

```
  P0 rooms ──┬─ P1 BOOK (free tier) ──┬─ P2 PROJECT SPINE ──┬─ P3 M1 logo
             │                        │                     ├─ P4 M3 authoring
             └────────────────────────┘                     ├─ P5 M2 extended
                                                            ├─ P6 M6 governance
                                                            ├─ P7 M5 templates
                                                            └─ P8 M4 direction
```

Everything from P3 on depends on P2 and on nothing else, so after the spine
exists the order is negotiable by audience rather than forced by dependency.

---

### Phase 0 · Close the rooms — **days**

**Goal.** Every room finishes its own job before anything is built on top.
These are pre-existing defects; carrying them forward makes every later
measurement dishonest.

**Structural change.** None. This is repair.

**Ships**
- `/compose` export and copy — wire the existing `src/lib/exporters/`.
- **The star bug** — the star writes `system.anchorHex`, and it propagates.
- `/visualizer` stage becomes full-bleed and responsive.
- Fontsource adapter (`list · get · cssUrl · licence`) replacing the four
  hardcoded pairings. **Adapter, not integration** — catalogue, popularity
  ranking and delivery host stay three independent choices, because Fontsource,
  Bunny and Google are the same ~2,000-family corpus and stacking them adds
  nothing.

**Unlocks.** `gov.legal-ip` gets real licence data. `type.families` stops
being a four-item list.

**Verified by.** The star: set it, reload, confirm `anchorHex` persisted and
that a second room reads it. Exports: round-trip a System through each format.
Not by screenshot.

**Risk.** Low. Contained, and each item has a known cause.

---

### Phase 1 · The Book, free tier only — **1–2 weeks**

**Goal.** Make the registry visible. Ship a real, complete deliverable to a
visitor with no account.

**Structural change.** A new surface, `/brand`, plus the **Book rail** — a
persistent element, not a seventh tab. Nav ceiling goes 6 → 8 (`/brand` and
`/assets`, the latter promoted from orphan). This is the Harmonic Dock pattern
one level up.

**Ships**
- `/brand` renders `renderBook(state)` for the **14 `storage: 'system'`
  components** — all of §3 and §4.
- `absent` blocks render as themselves: what is missing and what would fill it.
  **No completeness percentage** (M2) — 14 of 80 is hostile to the largest
  user group this product will ever have.
- Readiness: at most three suggestions, ranked by corpus frequency.
- Findings surfaced in-page — the contrast failures, the missing anchor, the
  colour-vision collapses. This is the thesis made visible.
- Export the book: web, PDF, tokens.

**Unlocks.** Every later component has an obvious render target. The free tier
is complete and shippable on its own.

**Verified by.** The book renders for `project: null` — asserted in tests
already. Contrast values in the rendered page must match `validateBook` output
exactly; measure off rendered pixels where `-webkit-text-fill-color` is
transparent or an ancestor filters, nominal otherwise.

**Risk.** Medium. PDF rendering of a token-driven layout is the unknown.

**Open sub-decision.** Frequency ranking currently suggests `gov.legal-ip`
third to a brand-new user — evidence-correct, product-odd. Options: leave it,
or add unlock-count as a secondary sort. Founder's call.

---

### Phase 2 · The Project spine — **1–2 weeks**

**Goal.** Turn the half-built projects layer into the real second half of
Layer 1. **This is the most consequential phase in the plan** and everything
after it depends on it.

**Structural change — the big one.** The System stops being singular.

- Replace `resolveDefaultProjectId(userId)` at all **eleven call sites across
  five files** (`app/actions.ts`, `app/palettes/actions.ts`,
  `app/assets/actions.ts`, `app/assets/page.tsx`, `app/studio/page.tsx`) with
  an **explicit project id**. This is the single change that turns the product
  multi-project.
- A `Project` carries its own `System`. The URL codec still round-trips a bare
  System unchanged — that is what keeps anonymous sharing working.
- Project switcher in the shell.
- **Reconcile the schema with the registry**: `project_members.role` default
  `'member'` → `owner | editor | reviewer | viewer`;
  `BrandAssetKind 'logo'|'mark'|'other'` → `mark | image | font | document`.
  Both mismatches are cheap now and expensive after data exists.
- Auth boundary: the account wall sits exactly at `storage: 'project'`.
- New: `approvals` table, pinned to `versionId`.

**Ships.** Sign in, create a second brand, switch between them, and see the
Book render project-backed components as `absent` rather than missing.

**Unlocks.** M1, M3, M5, M6 — every remaining machine.

**Verified by.** RLS. **`enable-rls.sql` is unrunnable past the first user;
`policies.sql` is the idempotent layer and is the truth.** Test with two real
accounts and confirm neither can read the other's project. Do not trust the
owner-visibility path — it has bitten before.

**Risk. Highest in the plan.** RLS on a schema that already has live rows,
plus a nullable `palettes.project_id` with an un-run backfill. Sequence the
backfill *before* flipping anything to NOT NULL, and verify with two accounts,
not one.

---

### Phase 3 · M1 — logo ingest and derive — **2 weeks**

**Goal.** Close the 22-of-25 gap and build the most demonstrable feature in
the product.

**Structural change.** `/assets` becomes a real DAM rather than an orphan.
First machine that derives rules from an uploaded artifact.

**Ships** — nine §2 components, six of them from one upload:
- Clear space **derived from the mark's own geometry**.
- Minimum size computed from the smallest legible feature.
- Monochrome and reversed variants generated.
- **Background safety proved** against every brand colour with a measured
  ratio, using the contrast engine that already exists.
- **The misuse page generated** — stretched, rotated, recoloured off-palette,
  shadowed, low-contrast, on a busy photo — each rendered from the real mark,
  each labelled with why it fails, the contrast ones carrying a ratio.

**Unlocks.** §7 and §8 both gate on `logo.primary`. This opens the back half
of the taxonomy.

**Verified by.** Vector only. `logo.primary.validate` already warns that a
raster mark yields nothing derivable — that check exists and is falsified.
Derived clear space must be reproducible from the SVG path data alone.

**Risk.** Medium. SVG geometry on arbitrary uploads is messy: nested groups,
transforms, strokes-as-paths, embedded rasters. Budget for a fallback that
degrades honestly rather than guessing.

**Deliberately deferred: generative logos (T3).** Diffusion emits raster, so
nothing downstream can be computed from it — which would break every component
above. Namelix's better half is the *name*, and naming is measurable.

---

### Phase 4 · M3 — guided authoring — **1–2 weeks**

**Goal.** Open the second front door. D1 says founder/marketer is half the
audience, and §1 needs no palette, no logo and no design training.

**Structural change.** First surface that is prose rather than computation.
Structured prompts, never an empty box.

**Ships.** All ten §1 components plus §7's `voice.grammar` and
`voice.microcopy` — twelve M3 components total. Every one labelled `declared`,
because we did not measure anyone's values and the book should say so.

**Unlocks.** A user who arrives with nothing can finish something.

**Verified by.** Whitespace is not content — already enforced in `textFor`.
A book that renders "  " as an authored value is the completeness theatre this
product exists to avoid.

**Risk.** Low technically. The risk is quality: guided authoring that produces
generic filler is worse than an empty section.

---

### Phase 5 · M2 extended — the design system — **3–4 weeks**

**Goal.** Serve the in-house team (D1 = C) and finish §6. This is engine work,
which is where the product is strongest.

**Structural change.** `/visualizer` grows up into the component library
surface — the room becomes the artifact rather than previewing it.

**Ships.** §6 in full: spatial grid, breakpoints, component library with every
state, navigation, elevation/radius/shadow, interactive accessibility. Plus
§5's computable half — iconography grid, icon states, pictograms, motion
easing and duration.

**Unlocks.** Token handoff, which is what C actually buys.

**Verified by.** Every state rendered and contrast-checked, disabled states
tagged rather than failed (WCAG 1.4.3 exempts inactive components).

**Risk.** Medium. Scope. §6 is where "design system" quietly becomes infinite.

---

### Phase 6 · M6 — governance, the measured whitespace — **1–2 weeks**

**Goal.** Occupy the one position the corpus says nobody holds.

**Structural change.** Approvals become first-class and version-pinned.

**Ships.** Twelve §9 components. Four of them — `gov.taxonomy`,
`gov.version-changelog`, `gov.launch`, `gov.metrics` — appear in **0 of 25**
sampled books while Wheeler prescribes all four.
- Asset-naming lint (already implemented in the registry, needs a surface).
- Approvals that go stale when the version moves (already implemented).
- Version history on the existing DAG.
- `gov.metrics` — Romaniuk's Fame × Uniqueness grid, the component the whole
  whitespace argument rests on and which was missing from the taxonomy entirely
  until the registry was built.

**Unlocks.** The positioning claim, with a feature behind it.

**Verified by.** Two accounts, one approval, one version bump — the approval
must go stale.

**Risk. The honest one is demand, not delivery.** "Nobody does it" reads two
ways: nobody needs it, or nobody can. This plan assumes the second. That is
**unproven demand backed by strong capability** and must not be sold as
validated.

---

### Phase 7 · M5 — templates — **3–4 weeks**

**Goal.** The marketing surface. Everything here needs the irreducible three —
a mark, a palette and a typeface — which is why it cannot come earlier.

**Ships.** §7 templates (social, email, decks, advertising, application
examples) then §8 physical collateral.

**Risk.** §8 was deferred in v7 and stays late here, deliberately: furthest
from the engine, heaviest to do well, does not compound, and packaging measured
1 of 25 even after retail, DTC and food were added to the sample.

---

### Phase 8 · M4 — direction — **2 weeks**

**Goal.** §5's non-computable half: photography, grading, cropping,
illustration, texture, the supporting graphic device, film.

**Note.** `imagery.graphic-device` measures **11 of 25** — more common than
clear space — and was missing from the taxonomy until the 2026-08-23 check.
It is the highest-frequency component in this phase, not photography.

---

## 7 · Not in any phase, on purpose

| Deferred | Why |
|---|---|
| **Generative logos** | Raster output kills every derived §2 component. See Phase 3. |
| **Live co-editing** | D4 is answered as *approvals and roles*, not as cursors. Real-time editing is a different product with a different infrastructure bill. Comments and approvals cover the measured need (`gov.approvals` = 8 of 25). |
| **White-label / client handoff** | D1 ruled out the agency persona. |
| **Pantone** | Licensed. CMYK builds ship; spot values do not, and the book says so rather than omitting it silently. |
| **Materials, finishes, print craft** | Not a component in the 80. The sample cannot see luxury or fashion books, which is exactly where this runs deepest. **If the customer turns out to be a luxury house, this stops being deferred and becomes the product.** |
| **A completeness percentage** | M2. Hostile to the palette-only user, who is the largest group this will have. |

---

## 8 · The 20 components with no external observation

Named here so a scope cut is a decision rather than a panic. None appears in
any sampled book or in Wheeler:

`brand.archetype` · `voice.vocabulary` · `colour.surfaces` · `colour.state` ·
`colour.themes` · `type.metrics` · `type.hierarchy` ·
`type.paragraph-spacing` · `type.text-spacing` · `imagery.grading` ·
`imagery.cropping` · `imagery.icon-states` · `imagery.pictograms` ·
`motion.logo` · `web.breakpoints` · `web.elevation` · `web.dataviz-palettes` ·
`voice.microcopy` · `marketing.application-examples` · `gov.dam`

Note this is **20, not the 16 an origin-based count suggests**. Four of them —
`imagery.pictograms`, `voice.microcopy`, `marketing.application-examples`,
`web.dataviz-palettes` — carry `origin: 'observed'` because they were found in
IBM Carbon and MemorialCare during the v2 check, but were never recorded as
ids in the 25-book sample, so their measured frequency is genuinely 0. They
are real components with weak evidence, not phantoms.

Several are kept for good reasons stated in their `provenance.note` — a UI is
unbuildable without state colours, and `type.text-spacing` is one of very few
brand-book rules that can be *checked*. But `brand.archetype`,
`type.paragraph-spacing`, `imagery.icon-states` and `web.elevation` are the
weakest four and should be the first cut if a phase overruns.

---

## 9 · Verification standard — unchanged, and non-negotiable

- **Measure, do not screenshot.** Verify layout by computed styles and bounding
  rects. A hidden Browser pane reports a 0x0 viewport and freezes rAF, and
  every symptom of that looks exactly like a product bug.
- **Text contrast:** measure off rendered pixels when
  `-webkit-text-fill-color` is transparent or an ancestor has a filter or
  blend; nominal colour otherwise. Darkest-vs-lightest pixel sampling is wrong
  in both directions and has produced false findings twice.
- **tsc and tests passing does NOT mean the page builds.** Check the production
  build in a throwaway copy — rsync excluding `node_modules`/`.next`/`.git`,
  symlink `node_modules` back, `npx next build` there. Never build in place
  while the dev server is live; it corrupts `.next`.
- **One dev server (4250, `.claude/launch.json`) and one browser at a time.**
- **Always falsify a regression test against the bug it claims to catch.**
  Inject the bug, confirm the right test fails naming the right thing, restore.

---

## 10 · What would change this plan

- **M1 rejected** (book as container, not view) → Phase 1 is wrong, the
  readiness graph is the wrong guidance mechanism, and the registry is
  reshaped. A fortnight now, a rewrite in three months.
- **D1 moves to luxury/fashion** → §8 and materials stop being deferred and
  become the product; the sample bias becomes a live risk today.
- **The membership is authorised** → sample 25 → 100+, every frequency turns
  from a floor into a real rate, and the phase ordering in §4 should be re-run
  against it. `provenance.test.ts` will fail until the registry is updated,
  which is the intended behaviour.
- **The governance whitespace finds no customer** → Phase 6 drops from
  differentiator to hygiene, and Phase 5 becomes the product's centre.
