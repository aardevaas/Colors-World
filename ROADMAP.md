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

**Done when:** every room finishes its own job and the registry describes the
document we are actually building.

---

### Days 3–5 · Aug 26–28 — The Book
*The single highest-risk item in the plan*

- `/brand` renders the guideline from the System, `project: null`.
- Rules rendered as **specs**: values in five formats, tint ladders, approved
  pairings with measured ratios, the type scale in px and rem, line height and
  tracking per role.
- `absent` blocks render as themselves — what is missing and what would fill it.
- No completeness percentage. Ever.

**Done when:** a visitor with no account gets a real internal guideline from a
palette and a typeface.

---

### Days 6–8 · Aug 29–31 — The measured layer
*What makes it world-class rather than tidy*

- **Proportions**: declare a target ratio, measure any rendered surface against
  it, report the delta.
- **Generated misuse** for colour and type.
- **The pairings matrix** — every foreground on every background, measured,
  AA/AAA verdicts, CVD-checked.
- **Channel rules** — web, email, print, presentation stated separately, with
  minimum sizes enforced per channel.
- Findings surfaced in-page, live.

**Done when:** the guideline catches things the user did not know were wrong.
**From here the product is shippable.**

---

### Days 9–11 · Sep 1–3 — Applied views
*The founder's "see the rules working before committing"*

- Website, phone, email, dashboard — the system rendered in situ, full size.
- **Five collateral pieces**: business card · letterhead · envelope · email
  signature · signage. Each a dimensioned spec, not a picture.
- Logo placeholder at correct proportion, **labelled a placeholder**, or an
  uploaded mark positioned as an image only — no derivation, no geometry.

**Done when:** the Q18 story runs end to end.

---

### Days 12–13 · Sep 4–5 — Accounts and persistence
*Known work, deliberately late*

- Auth on the existing Supabase setup.
- **Replace `resolveDefaultProjectId(userId)` at all eleven call sites** with an
  explicit project id. This is the change that makes the product multi-project.
- Reconcile the two schema mismatches **before data exists**:
  `project_members.role` default `'member'` → `owner|editor|reviewer|viewer`;
  `BrandAssetKind 'logo'|'mark'|'other'` → `mark|image|font|document`.
- The **approval gate** — approved, then it renders. Pinned to a version.
- Project switcher.

**Verified by:** two real accounts, neither able to read the other's project.
`enable-rls.sql` is unrunnable past the first user — `policies.sql` is the
idempotent layer and the truth.

---

### Days 14–15 · Sep 6–7 — Export and polish
- PDF, design tokens, and a share link — the founder answered "both" to
  document-vs-living-link, so all three ship.
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
| **4. PDF export** | Share link and tokens carry the deliverable |

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
