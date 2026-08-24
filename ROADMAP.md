# Colors World — Roadmap v9

**2026-08-24.** Supersedes v8. v8 was scoped to an 80-component taxonomy built
from the wrong research grain. This is scoped to a decision.

> **v8's phases are void.** Its measurements of the codebase still hold; its
> sequencing does not.

---

## 1 · What the product is

**A colour and typography tool that produces a world-class *internal* brand
guideline** — the operating manual a design firm hands over, not the showcase a
company publishes.

Founder's sentence: *"the world's best colour, typography, UX & UI, web tool,
which builds your internal team's brand-book guide for the company to follow
**and enforce**."*

The public-facing brand book is a **later export** — the internal document with
the internal detail stripped out. It is derived by deleting, never authored
separately.

### The three rules that follow

1. **Every rule in the guideline is a spec, not a swatch.** IRBA does not say
   "we have a business card"; it says 100×50mm, 3mm margin, Gotham Bold 7pt on
   8.4pt leading at 100% white. That is the output target.
2. **Every number derives from the palette and type scale the user built.**
   Nothing is typed in that could be computed.
3. **We visualise, we do not generate.** We never make images, websites or
   logos. We show the user's system applied to them.

### Explicitly out — permanently

| Out | Why |
|---|---|
| **Logo generation** | 90% of online logo generators produce marks nobody uses. Not a gap we can close honestly. |
| **Imagery / motion generation** | Not an image tool. We show colour applied to imagery, nothing more. |
| **Website building** | Not a web platform. We show branding applied to a site. |
| **Voice derived from colour** | Colour-emotion association is weak, culturally contingent evidence. It would be folklore wearing a measurement's clothes. |
| **Brand strategy authoring** | Mission, values, archetype, positioning. Out of scope. |

---

## 2 · Who it is for, and what they do in five minutes

**The solo designer** (D1 = A), first release only. Everyone else benefits;
nobody else steers.

The acceptance test for the whole build, in the founder's words:

> Explore colours → select a few → build the palette → tweak tones → see them on
> real dashboards, charts and websites → run the checks → do the same for
> typography → **approve** → the internal guide is already rendered, showing the
> rules visually, applied to a real website, phone, email and other digital
> assets, so they can see the rules working before committing.

**If a phase does not move that sentence forward, it is not in this roadmap.**

---

## 3 · The architecture, settled

### Split state — confirmed, and now load-bearing

| Store | Holds | Account |
|---|---|---|
| **System** — URL-shaped | palette, anchor, roles, type, scales, mode | **No** |
| **Project** — Postgres | approvals, saved guidelines, multiple brands, uploaded marks | **Yes** |

The System travelling in a URL is the product's best growth property and it is
also the fastest path to a working Book: **nothing about the Book depends on
auth.** `render(state)` already takes `{ system, project }` and every contract
already declares which store it reads, so turning accounts on is wiring.

### Supabase stays

Auth, Postgres with RLS, and a project-scoped storage bucket already exist and
work. Neon has neither auth nor storage; moving would mean rebuilding both and
re-implementing row-level security as application authz. The tables are plain
Postgres either way, so nothing is locked in.

### The build order principle

**Unknown work before known work.** The Book surface has never been built. Auth
runs on tables that already exist, against policies already written. So the
Book goes first and accounts go late — the reverse of how it feels.

---

## 4 · The registry, revised to internal grain

`docs/research/INTERNAL-GUIDELINE-GRAIN.md` established that §3 and §4 are not
14 components but **29 sub-components**, and that **16 of them the engine
already computes**.

| Section | v8 | v9 | Already computable |
|---|---|---|---|
| §3 Colour | 8 | **14** | 9 |
| §4 Typography | 6 | **15** | 7 (+4 trivial) |

**Added to §3:** proportions · order · gradients · misuse · exceptions, and
data-viz moves in from §6.
**Added to §4:** sources · licensing · fallbacks · weights · casing · alignment ·
measure · minimums · channels · misuse.

The other 51 components stay in the registry, dormant and untouched. They cost
nothing and they are the option on everything after this release.

### Two new primitives nobody else has

**Proportions.** Every serious internal manual states a ratio — IRBA primary
50%/secondary 20%/accent 20%, Regus 60/20/10/5/5, Monash a mandatory minimum
25% primary. **None of them can check it.** "This layout is 8% primary against
your 25% floor" is arithmetic, and no colour tool computes it.

**Generated misuse.** Off-palette mixes, disallowed tints, tracking too tight,
wrong weight reversed on dark — rendered from the real system, each labelled
with a measured reason. Every manual draws these by hand.

---

## 5 · The plan — 15 days to 2026-09-08

Assumes 12h/day effective. 14–16h is the stated capacity; planning to it
guarantees a slip on the first bad day.

**Sequenced so that the product is shippable from day 8 onward.** Everything
after that point improves a thing that already works.

---

### Days 1–2 · Aug 24–25 — Foundation
*Registry revision + the four broken rooms*

- §3 and §4 revised to internal grain: 14 and 15 sub-components as contracts.
- `docs/research/internal-grain-sample.json` — which manual states which
  sub-rule, so provenance stays measured and the drift test extends to cover it.
- **The star bug.** The star writes `system.anchorHex` and it propagates.
- **`/compose` export.** Wire the exporters that already exist.
- **`/visualizer` full-bleed.** Off the hard-coded 760×475.
- **Fontsource catalogue.** 2,096 families replacing 4 hardcoded pairings,
  with the licence data §4 needs.
- **Unlink `/studio`.** The Book replaces it. Six rooms become five.

  > **Unlink now, delete after launch.** Studio is ~4,000 lines of working,
  > tested code — canvas camera, snapping, masonry auto-arrange, PNG export,
  > board persistence, sharing. Deleting that under deadline pressure is how
  > things break. Remove it from nav now, salvage
  > `src/lib/studio/export-png.ts` into the Book's export, and delete the rest
  > properly once the launch is behind us. It does have to be deleted — this
  > repo's "0 dead files" property is worth keeping true.

**Done when:** every room finishes its own job and the registry describes the
document we are actually building.

---

### Days 3–5 · Aug 26–28 — The Book
*The single highest-risk item in the plan*

**Shape settled 2026-08-24** — see the artifact linked from `rescope-qa`.
One continuous document at `/brand`. Approval **per section**, pinned to a
version, going stale when the section changes. Findings on the block *and* in a
rail list, never a modal. Not-set blocks visible but quiet — no counter, no
percentage. **Everything renders; approval is a stamp on top, not a gate**, so a
new user's Book is never empty. Sections named for people; §-numbers stay in the
code.

- `/brand` renders the guideline from the System, `project: null`.
- Rules rendered as **specs**: values in five formats, tint ladders, approved
  pairings with measured ratios, the type scale in px and rem, line height and
  tracking per role.
- `absent` blocks render as themselves — what is missing and what would fill it.
- No completeness percentage. Ever.

**Done when:** a visitor with no account gets a real internal guideline from a
palette and a typeface.

**DONE 2026-08-24, on day one of three** (`5a3a3c0`). The highest-risk item in
the plan rendered early, so **export was pulled forward from Days 14–15 into
the slack** rather than starting the measured layer ahead of schedule.

#### Export — moved here from Days 14–15, done 2026-08-24

- **The share link already existed and nothing said so.** Measured before
  anything was written: bare `/brand` renders 13 of 98, `/brand?c=…&f=…&m=light`
  renders 22 of 98 with §3 going 0 → 9. The System lives in the query string,
  so the address bar was already the whole document. The work was a Copy button
  and a sentence.
- **Tokens** (`dbb7cb4`) — `lib/exporters/guideline-tokens.ts`. Roles, palette
  and the whole type ladder, in CSS / Tailwind v4 / W3C JSON. `tokens.ts` could
  not do this: it takes `GeneratedScale[]` and cannot say which colour is
  primary or anything at all about type. **Nothing in the repo exported type
  before this.**
- **PDF** (`477619b`) — a print stylesheet, not a PDF library. The browser's own
  pipeline renders this page, so the file has real text and real links and
  there is no second renderer to drift. Same reason the commercial book is this
  renderer with blocks deleted.
- **`hide=unset`** (`cfc8616`) — D4's export-time trim, and the seam D5's
  `audience` flag switches on. Counts are computed BEFORE the filter so the
  trimmed view never claims nothing is missing.

Cost: `/brand` 1.29 → 3.96 kB. The 385KB catalogue stayed on the server.

---

### Days 6–8 · Aug 29–31 — The measured layer
*What makes it world-class rather than tidy*

- **Proportions**: declare a target ratio, measure a rendered surface against
  it, report the delta. Three sources, in this order:
  **(a)** our own applied views — free, we own the DOM;
  **(b)** an uploaded screenshot — free, client-side canvas sampling;
  **(c)** a live URL we render and sample — **real infrastructure, and it may
  land after 09-08.**

  > **(c) cannot be done in the browser.** A cross-origin iframe taints the
  > canvas, so `getImageData` throws — a security boundary, not a difficulty.
  > It needs a server-side headless browser (`@sparticuz/chromium` on Vercel or
  > a separate service). And rendering arbitrary user-supplied URLs server-side
  > is an **SSRF vector**: block localhost, private ranges and cloud metadata
  > endpoints, cap the timeout, and never follow redirects blindly.
- **Generated misuse** for colour and type.
- **The pairings matrix** — every foreground on every background, measured,
  AA/AAA verdicts, CVD-checked.
- **Channel rules** — web, email, print, presentation stated separately, with
  minimum sizes enforced per channel.
- Findings surfaced in-page, live.

**Done when:** the guideline catches things the user did not know were wrong.
**From here the product is shippable.**

**DONE 2026-08-24.** On a five-colour palette with a stated ratio the guideline
reports six findings, none of them typed in:

| finding | why it is not available elsewhere |
|---|---|
| primary 0.2% against a 25% floor, on 3 of 4 surfaces | every manual states a ratio, none checks one |
| text on surface 2.17:1, below AA | ordinary, and it was already caught |
| **onPrimary on primary reaches AA but not under tritanopia — 4.14:1** | reads 5.27:1 in every contrast checker there is |
| three chart-series pairs collapsing under CVD | already shipped |

§3 is 10 of 15, §4 is 14 of 18, and **20 of the 24 rendered colour and type
components are `measured` rather than declared**.

- **Proportions** (`2ac851d`, `c9687a6`) — front-to-back alpha compositing over
  declared geometry, measured off the four `/visualizer` templates. Q1 = A.
  `pp=primary.25` in the codec, so a stated ratio travels in the share link.
- **The pairings matrix** (`bf6080d`) — 22 pairs, each re-measured through four
  CVD simulations. Only the four required pairs fail; a CVD regression warns,
  because WCAG does not require a simulated pass.
- **Channel rules** (`11f09c9`) — computed, not authored. Print answers whether
  the licence permits print use at all, which no manual in the sample does.
- **Generated misuse** — already measured for colour and type before this
  phase. Checked rather than assumed.

---

### Days 9–11 · Sep 1–3 — Applied views
*The founder's "see the rules working before committing"*

- Website, phone, email, dashboard — the system rendered in situ, full size.
- **Five collateral pieces**: business card · letterhead · envelope · email
  signature · signage. Each a dimensioned spec, not a picture.
- Logo placeholder at correct proportion, **labelled a placeholder**, or an
  uploaded mark positioned as an image only — no derivation, no geometry.

**Done when:** the Q18 story runs end to end.

**DONE 2026-08-24.**

- **Applied views** — the fourth existed only after `a69af39` added **email**,
  the one channel that shows the system as it ARRIVES rather than as it was
  designed: set in the fallback stack, because most clients strip webfonts. It
  is also a **fifth reference surface**, so every stated ratio is now checked
  against one more real layout. Breadth is data, not code.
- **Five collateral pieces** (`81ea9cf`, `a69af39`) — business card, letterhead
  and envelope from the ISO standards that define them, signage from the sign
  trade's 1:120 rule (labelled `declared`, because it is a rule of thumb and
  every source that publishes it says so), and the email signature inside the
  email view. Each a dimensioned spec: format, the brand's own ladder converted
  to points, ink and ground, and whether the licence permits print at all.
  **Margins, mark size and grid are deliberately NOT stated** — no standard
  sets them, and the book will not print a guess beside ISO 216.
- **The guideline shows its colours** (`74923ac`) — `BookEntry.swatches`, 26
  chips, still a server component. `colour.misuse` shows the two approved
  colours and the one they make, which is the evidence for the rule rather than
  decoration.
- **Logo** — the placeholder item resolved differently than planned, and
  deliberately. Collateral became a dimensioned spec rather than a picture, so
  there is no artwork to place a placeholder into, and §8 declines to state
  mark size at all. What was missing was a sentence, not a rectangle: §2 now
  says outright that **this product will not draw a mark**, because every other
  block in that section reads like a feature that has not shipped yet.

---

### Days 12–13 · Sep 4–5 — Accounts and persistence
*Known work, deliberately late*

- Auth on the existing Supabase setup.
- **Replace `resolveDefaultProjectId(userId)` at all eleven call sites** with an
  explicit project id. This is the change that makes the product multi-project.
- Reconcile the two schema mismatches **before data exists**:
  `project_members.role` default `'member'` → `owner|editor|reviewer|viewer`;
  `BrandAssetKind 'logo'|'mark'|'other'` → `mark|image|font|document`.
- ~~The **approval gate** — approved, then it renders.~~ **VOID — contradicted
  by Q3 = A**, settled after this line was written: *everything renders;
  approval is a stamp on top, not a gate.* A new user's Book is never empty.
  What is still wanted is the STAMP: approval per section, pinned to a version,
  going stale when the section changes (D2). Not built.
- Project switcher.

**Verified by:** two real accounts, neither able to read the other's project.
`enable-rls.sql` is unrunnable past the first user — `policies.sql` is the
idempotent layer and the truth.

**DONE 2026-08-24, except the two items named below.**

- `2228985` **schema reconciled before data exists** — `project_members.role`
  → `owner|editor|reviewer|viewer` (default `viewer`, least privilege);
  `brand_assets.kind` → `mark|image|font|document`. `BrandAssetKind` now
  re-exports `AssetKind` so there is one definition rather than two agreeing by
  coincidence, and `schema-contract.test.ts` reads the DDL and compares it to
  the unions so this cannot drift again.
  **`supabase/reconcile-2026-08-24.sql` HAS NOT BEEN RUN — that is yours.**
- `8402efe` **all eleven call sites** replaced with `requireProject()`. The
  current project rides in a cookie whose membership is verified before the id
  reaches anything that writes; `isMemberOf` returns false when the lookup
  itself errors, so an outage cannot become an authorisation bypass.
  `resolveDefaultProjectId` deleted.
- `67ad807` **the switcher** — Server Component, plain form, no client JS,
  hidden until there are two projects to choose between.

**STILL OPEN in this phase:**

1. **Two real accounts, neither able to read the other's project.** This needs
   live credentials and is the founder's to run. Nothing here has been verified
   against a real database — the tests use an in-memory fake, which proves the
   repository logic and proves nothing about RLS.
2. **The approval stamp** (D2), per the correction above.

---

### Days 14–15 · Sep 6–7 — Polish
- ~~PDF, design tokens, and a share link.~~ **DONE 2026-08-24** — pulled
  forward into the Days 3–5 slack when the Book landed on day one of three.
  See that section for what shipped and what it cost.
- Version stamp and changelog on the guideline itself. Nobody in the 25-book
  sample versions their brand; we already have the DAG.
- Accessibility pass, responsive pass, production build in a throwaway copy.

---

## 6 · Slip plan

Something will slip. Deciding now, while it is cheap:

| Cut in this order | Why it is safe |
|---|---|
| **1. Governance beyond a version stamp** | Least value to a solo user on day one, cheapest to add later |
| **2. Collateral down to card + letterhead** | Three of five is still the point proved |
| **3. Accounts** | The Book works anonymously; ship without them and add in week three |
| ~~**4. PDF export**~~ | Moot — shipped 2026-08-24 as a print stylesheet, which cost hours rather than the headless-browser infrastructure this cut assumed |

**Never cut:** the four room fixes, the Book, proportions, generated misuse, the
pairings matrix. Those are the product.

---

## 7 · Verification standard — unchanged

- **Measure, do not screenshot.** A hidden Browser pane reports a 0×0 viewport
  and freezes rAF; every symptom looks like a product bug.
- **Text contrast:** measure off rendered pixels when `-webkit-text-fill-color`
  is transparent or an ancestor filters; nominal colour otherwise.
- **tsc and tests passing does not mean the page builds.** Production build in a
  throwaway copy — never in place while the dev server is live.
- **One dev server (4250) and one browser at a time.**
- **Always falsify a regression test against the bug it claims to catch.**

---

## 8 · What would change this plan

- **The Book takes longer than three days.** It is the only genuinely unknown
  work here. If day 5 arrives without it rendering, cut collateral to two pieces
  and drop accounts — do not compress the measured layer, which is the product.
- **Proportions turn out not to be computable on arbitrary surfaces.** Fall back
  to measuring declared layouts only. Still nobody else's feature.
- **A user is finally shown the thing.** Nobody outside the project has seen it.
  The first five people to try it will be worth more than any phase in this
  document, and that is worth a day before September 8 rather than after.
