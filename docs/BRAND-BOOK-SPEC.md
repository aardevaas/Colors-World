# The Brand Book — structure, model, and build plan

**2026-08-23.** The defining document for what Colors World produces.

Everything else in this repo describes rooms that make things. This describes
**the thing they make.**

---

## Part 1 · The hard problem, and four ways to solve it

> *"Some people will not use this to build a full brand-book, maybe they just
> need a palette. This has to suit all types of users."*

That single constraint kills most obvious designs. Here are the four real
options, with what each costs.

### Angle A — The Vault
The book is a container you fill. Sixty slots, a progress bar, a completeness
percentage.

**Why it's tempting:** it's what every competitor does, it teaches the domain,
and progress is motivating.
**Why it fails here:** it makes the palette-only user feel *broken*. They came
for one thing, got one thing, and the product tells them they're 3% done.
A percentage of sixty is demoralising for everyone except the enterprise user.

### Angle B — The Fork
Ask on arrival: *"just a palette"* or *"a full brand"*, and route accordingly.

**Why it's tempting:** clear, and each path can be tuned.
**Why it fails here:** people don't know which they are yet — the palette user
becomes the brand user three weeks later, and the fork makes that a migration
rather than a continuation. It also splits the product into two things to
maintain and two things to explain.

### Angle C — The Developer *(photographic sense)*
There is **no container**. The book is *developed* from whatever exists, on
request, at any moment. Ask for it after ten minutes and you get a two-page
colour spec. Ask after three weeks and you get sixty pages.

**Why it's strong:** nothing is ever incomplete, because there is no target to
fall short of. It serves both users identically and needs no mode.
**What it lacks:** guidance. It never teaches you what a brand book *should*
contain, which is a real reason people come to a tool like this.

### Angle D — The Kit
Pick a scope up front — *Startup one-pager* (5 sections), *Product design
system* (14), *Full corporate identity* (60+). The scope defines what "done"
means.

**Why it's strong:** matches how designers actually scope work, sets honest
expectations, and makes completeness meaningful again because it's measured
against something you chose.
**What it costs:** an upfront decision, and more structure to build.

---

## Part 2 · The recommendation

**Build C as the substrate. Offer D as an optional overlay. Never build A.**

Concretely:

1. **The book is a view, not a container.** Nothing is ever "put in" it. The
   System already accumulates facts as you work; the book is a *render* of the
   System at any moment. This is the single most important decision in the
   document, and everything else follows from it.
2. **Always available, never incomplete.** A "Brand book" action exists from
   the first minute. It renders the sections you have and silently omits the
   ones you don't. The palette-only user gets a clean, genuinely useful
   two-page colour specification — a real deliverable, not a stub.
3. **No completeness percentage by default.** It is meaningless without a
   chosen scope and actively hostile without one.
4. **Kits are opt-in.** Someone who *wants* the checklist picks a kit, and only
   then does progress appear — measured against the scope they chose.
5. **Guidance comes from readiness, not from a checklist.** See Part 3.

**The palette-only user is served because the book is never in their way.**
They never see it unless they ask for it. That is the whole trick.

---

## Part 3 · Readiness — the "designer-logic as they go along"

A checklist of sixty empty boxes is not designer logic. **Dependency is.**

Brand-book sections have genuine prerequisites. You cannot specify a logo's
clear space before there is a logo. You cannot define component states before
colour roles exist. You cannot set a type hierarchy without a scale.

So the product never shows sixty boxes. It shows **what is unlockable right
now — at most three things** — and it is right about the order because the
graph is real:

```
                    ┌─ Voice & tone ─┬─ Grammar rules
  (no prerequisite) ├─ Values ───────┤
                    └─ Archetype ────┴─ Taglines

  Colour palette ──┬─ Colour roles ──┬─ Component states ─┬─ Navigation
                   │                 │                    └─ Email / Social
                   ├─ State colours  ├─ Iconography (colour + grid)
                   └─ Themes         └─ Data visualisation

  Type scale ──────┴─ Hierarchy ─────┴─ Editorial rules

  Logo upload ─────┬─ Clear space ───┬─ Misuse examples  (generated)
                   ├─ Min sizes      ├─ Placement safety (needs palette)
                   └─ Variations ────┴─ Lockups / architecture

  Logo + palette + type ──── Stationery · Decks · Ads · Packaging · Swag
```

Two consequences worth naming:

- **Voice, values and archetype have no prerequisites.** They can be done on
  day one, by someone with no colours at all. That makes them a *second front
  door* into the product for non-designers — founders, marketers — which is a
  much bigger audience than people who arrive wanting OKLCH.
- **The logo is the biggest unlock in the graph.** One upload opens six
  sections. That makes logo ingest the highest-leverage single feature in the
  entire plan.

---

## Part 4 · Six machines, not sixty features

The nineteen unhoused features are not nineteen builds. They are **six
machines**, each used many times. This is where the leverage is.

| # | Machine | What it does | Feeds |
|---|---|---|---|
| **M1** | **Ingest & Derive** | Take an uploaded asset, compute rules *from* it | Logo, marks, imagery, icons |
| **M2** | **Compute & Verify** | The engine: measure, check, prove | Colour, type, spacing, contrast, icon grid, motion |
| **M3** | **Author (guided)** | Structured writing with real prompts — never an empty box | Values, archetype, voice, grammar, taglines |
| **M4** | **Direct (axes)** | Set direction on named axes, produce a spec + reference board | Photography, illustration |
| **M5** | **Template & Compose** | Token-driven layouts with safe zones and export presets | Social, email, decks, ads, stationery, packaging, swag |
| **M6** | **Govern** | Versioning, taxonomy, naming, licences, changelog | DAM, asset rules, IP |

**M2 already exists and is world-class.** M6 has real foundations — versioning
with branch/merge, a DAG, share links. M1, M3, M4, M5 are new.

### The two that are genuinely differentiated

**M1 turns a logo upload into six sections automatically.** Upload an SVG and
we can derive the clear-space rule from its own geometry, compute minimum
legible sizes, generate monochrome and reversed variants, and — using the
contrast engine we already have — **prove which brand backgrounds it is safe
on** rather than asserting it.

**Logo misuse can be *generated*.** Every brand book has a "don'ts" page drawn
by hand. We can render them: stretched, rotated, recoloured off-palette, drop
shadow, insufficient contrast, placed on a busy photo — each one produced from
the real mark, each one labelled with *why* it fails, and the contrast ones
carrying a measured ratio. **Nobody does this.** It is a two-day feature that
would be the most screenshotted thing in the product.

---

## Part 5 · The complete component taxonomy

Every section of a 100%-production-ready brand book, mapped to the machine that
builds it, its prerequisites, and where it lives.

Legend — **Have**: shipping · **Part**: partially built · **New**: not started.

### §1 Brand strategy & narrative — *M3*
| Component | Machine | Needs | State |
|---|---|---|---|
| Mission & vision | M3 | — | New |
| Values & behaviours | M3 | — | New |
| Archetype & personality | M3 | — | New |
| Positioning & value prop | M3 | — | New |
| Voice & tone matrix | M3 | archetype | New |
| Vocabulary rules (approved / banned) | M3 | voice | New |
| Taglines & elevator pitches | M3 | positioning | New |

### §2 Logo system & architecture — *M1*
| Component | Machine | Needs | State |
|---|---|---|---|
| Primary logo | M1 | upload | New |
| Secondary / alternate / marks | M1 | primary | New |
| Brand architecture & lockups | M1 | marks | New |
| **Co-branding / partner / JV lockups** | M1 | marks | New — *NASA, MemorialCare* |
| Construction & geometry grid | M1 | primary | New |
| **Clear space** | M1 | primary | New — *derivable* |
| **Minimum sizing** | M1+M2 | primary | New — *computable* |
| **Placement & background safety** | M1+M2 | primary + palette | New — *provable* |
| **Misuse (don'ts)** | M1 | primary + palette | New — *generatable* |

### §3 Colour architecture — *M2*
| Component | Machine | Needs | State |
|---|---|---|---|
| Palette hierarchy (60/30/10) | M2 | palette | **Part** — weighting is the gap |
| HEX / RGB / HSL / OKLCH | M2 | palette | **Have** |
| CMYK + print mapping | M2 | palette | **Have** (Pantone excluded — licensed) |
| UI state colours (success/warn/error/info) | M2 | roles | **Part** — needs explicit tokens |
| Light / dark theme mapping | M2 | roles | **Have** |
| WCAG pairings & ratios | M2 | roles | **Have** — our strongest asset |
| Neutral & grey scale → **Surfaces & borders** | M2 | palette | **Have** — *renamed 2026-08-23; see note* |

> **Renamed 2026-08-23.** "Neutral & grey scale" is not what this row can
> produce. The role model orders by OKLCH lightness, so a palette with no
> low-chroma member yields a saturated colour as its surface — a green was
> rendering under a heading that said "greys". The System holds three
> structural roles (background, surface, border) and no neutral ramp, so the
> component is `colour.surfaces`, "Surfaces & borders". A true grey ramp is a
> real brand-book concept and would need a real object behind it.

### §4 Typography system — *M2*
| Component | Machine | Needs | State |
|---|---|---|---|
| Families (brand / body / mono / fallback) | M2 | font source | **Part** — 4 pairings today |
| Hierarchy: Display→H6, body, caption, overline | M2 | scale | **Part** |
| Weight / size / line-height / tracking | M2 | scale | **Have** |
| Paragraph spacing & margins | M2 | scale | **Part** |
| Typesetting etiquette (align, widows, case) | M2+M3 | hierarchy | New |
| **WCAG 1.4.12 text spacing** | M2 | hierarchy | New — *differentiator* |

### §5 Imagery, graphics & motion — *M4 + M2*
| Component | Machine | Needs | State |
|---|---|---|---|
| Photography direction (mood axes) | M4 | — | New |
| Colour grading / LUT guidance | M4+M2 | palette | New — *ΔE-checkable* |
| Cropping, framing, text-safe areas | M4 | — | New |
| Illustration system | M4 | palette | New |
| **Iconography grid & stroke system** | M2 | — | New — *computable + validatable* |
| Icon states (outline/filled/duotone) | M2 | roles | New |
| Motion: easing curves & duration scale | M2 | — | New — *computable* |
| Logo animation lockup | M1+M2 | primary | New |
| **Data visualisation system** | M2 | roles | New — *first-class in IBM; our strongest unclaimed ground* |
| **Supporting graphic device** | M4 | palette | New — *NASA "supporting elements", MemorialCare "connection graphic"* |
| **Texture & pattern** | M4 | palette | New — *MemorialCare* |
| **Pictograms** (distinct grid from UI icons) | M2 | — | New — *IBM separates the two* |
| **Sonic / audio identity** | M4 | — | New — *a Romaniuk distinctive asset* |

### §6 Web / UX / product design system — *M2*
| Component | Machine | Needs | State |
|---|---|---|---|
| Base spatial grid (4/8px) | M2 | — | **Part** |
| Responsive breakpoints & containers | M2 | grid | New |
| **Component library + all states** | M2 | roles + type | **Part** — this is `/visualizer` grown up |
| Navigation architecture | M2 | components | New |
| Elevation, radius, shadow scales | M2 | — | New |
| Interactive accessibility (focus, targets) | M2 | components | **Part** |
| **Data-viz colour palettes** (categorical/sequential/diverging, CVD-safe) | M2 | roles | New — *engine work we are already built for* |

### §7 Editorial & marketing — *M3 + M5*
| Component | Machine | Needs | State |
|---|---|---|---|
| Grammar & style rules | M3 | voice | New |
| **UI microcopy / action labels** | M3 | voice | New — *Carbon treats separately from voice* |
| **Application examples per audience** | M5 | full system | New — *MemorialCare splits consumer vs clinician* |
| Social templates + safe zones | M5 | logo + palette + type | New |
| Email system (incl. dark mode) | M5 | roles + type | New |
| Presentation decks | M5 | full system | New |
| Advertising collateral | M5 | full system | New |

### §8 Physical collateral — *M5*
| Component | Machine | Needs | State |
|---|---|---|---|
| Stationery & corporate identity | M5 | logo + palette + type | New |
| Packaging & dielines | M5 | full system | New |
| Swag & apparel | M5 | logo | New |
| **Signage, environmental & wayfinding** | M5 | logo + type | New — *NASA: signage, liveries, uniforms* |

### §9 Governance & infrastructure — *M6*
| Component | Machine | Needs | State |
|---|---|---|---|
| Asset taxonomy & naming conventions | M6 | — | New — *lintable* |
| Format decision matrix (SVG/PNG/WebP/PDF) | M6 | — | New |
| **DAM** | M6 | assets | **Part** — `/assets` is the seed |
| **Licensing & IP** (fonts, stock, ™/®) | M6 | fonts + assets | **Part** — font licences arrive free with Fontsource |
| **Third-party usage rights & approvals** | M6 | logo | New — *NASA's largest section; who may use the mark at all* |
| Version control & changelog | M6 | — | **Have** — branch/merge/DAG already exist |

> **Corrected 2026-08-23, while building the registry.** This line said
> "65 components. Have 9 · Part 13 · New 43." Counting the table
> programmatically gives **66 rows** — no duplicates — and a state tally of
> **Have 7 · Part 10 · New 49**. All three numbers were wrong, and they were
> quoted onward into `ALIGNMENT-2026-08-23.md` and `ROADMAP.md`.
>
> The registry is larger still. Thirteen component ids that the 25-book study
> actually observed had **no row in this table at all** — including
> `gov.contact` (8 of 25) and `gov.metrics`, which Part 12 argues at length as
> the Distinctive Asset Grid and on which the whole governance-whitespace
> claim rests. One further row, "Third-party usage rights & approvals", covers
> two ids the research keeps apart and is split. See
> `src/lib/brand/ids.ts` for the reconciliation, component by component.

**Totals: 9 sections · 66 rows here. Have 7 · Part 10 · New 49.**
**As built: 66 + 13 placed + 1 split = 80 components.**

The eleven marked *"NASA / IBM / MemorialCare"* were **not in the original list
and were not mine.** They were found by checking real published brand books —
see Part 13, which is the honest account of where this taxonomy came from.

---

## Part 6 · Where it lives — the Book is the spine, not a tab

The nav is already six rooms. Adding one tab per section would produce a
navigation nobody can use.

**The Brand Book is a persistent surface, not a destination** — the same
pattern as the Harmonic Dock, which already follows you across every room. A
collapsible Book rail, available everywhere, with one verb: **send to book**.
It also has a full-page view for reading and export.

| Surface | Role | Change |
|---|---|---|
| **Book rail** *(new)* | Persistent. Readiness prompts, send-to-book, "generate" | New spine |
| `/brand` *(new room)* | The book, full page. Also hosts M3 + M4 authoring | 1 new tab |
| `/assets` | **Promoted from orphan → DAM.** M1 + M6 live here | Adopted |
| `/visualizer` | Becomes the component library (§6) | Repurposed |
| `/studio` | Template surface (M5) — social, decks, ads, collateral | Extended |
| `/library` `/compose` `/scales` `/typography` | Feed §3 and §4 unchanged | Add exports |

**Net: 6 tabs → 8** (`/brand` and the promoted `/assets`), not 6 → 25.

---

## Part 7 · The font layer

**The counter-intuitive finding: Fontsource, Bunny and Google Fonts are the
same corpus.** Verified live — Fontsource 2,096 families, Bunny 1,967, Google
~1,800, and Fontsource's own metadata says 1,976 of its 2,096 are `type:
google`. **Stacking all three adds roughly zero new families.**

So do not integrate them for coverage. Integrate them for **facets**, each of
which we actually need:

| Source | Key? | Unique value | Use it for |
|---|---|---|---|
| **Fontsource** | No | Licence per family · variable axes · self-hostable via npm | **Primary catalogue + licensing (§9)** |
| **Google API** | Yes | Popularity & trending order — Fontsource has none | **Ranking and "most used" sort** |
| **Bunny** | No | GDPR-safe serving; no Google request from the visitor's browser | **Default delivery for EU brand clients** |
| Fontshare | — | Was 502 when checked; single foundry, no stable API | **Do not depend on it** |
| Indie open foundries | — | Velvetyne, Uncut.wtf, Collletttttivo — genuinely distinctive faces | **Small curated set, hand-added** |

Build a **font-source adapter** (`list · get · cssUrl · licence`) so the
catalogue, the ranking and the delivery host are three independent choices. The
last row is what stops every brand book made here from looking the same:
2,000 Google fonts is a commodity, and the curated indie set is the taste.

---

## Part 8 · Build order

Each phase leaves the product coherent, and each makes the next cheaper.

### Phase 1 — Every room finishes its own job
Exports in `/compose`; the `/scales` star bug; the Fontsource catalogue;
`/visualizer` full-bleed. *No book yet — just stop losing users at the exit.*

### Phase 2 — The spine
The **Book as a view** over the System. Book rail + `/brand` page. Render →
web URL, PDF, tokens. **Ship it with only §3 and §4 populated** — a colour and
type specification is already a real, sellable deliverable, and it proves the
model before any new machine is built.

### Phase 3 — M1, the biggest unlock
Logo ingest and derivation: clear space, min sizes, variants, background
safety, **generated misuse**. One upload opens six sections. `/assets` becomes
the DAM and stops being an orphan.

### Phase 4 — M3, the second front door
Values, archetype, voice, grammar. **No prerequisites**, so it opens the
product to founders and marketers who have no palette yet — a much larger
audience than people who arrive wanting OKLCH.

### Phase 5 — M2 extended
Component library in `/visualizer` (§6), iconography grid, motion tokens.
All engine work, where we are strongest.

### Phase 6 — M5, templates
Social, email, decks, ads in Studio. Then stationery, packaging, swag.

### Phase 7 — M6 completed
Taxonomy, naming lint, format matrix, full licence tracking.

**§8 physical collateral stays last deliberately** — furthest from the engine,
heaviest to do well, and it does not compound.

---

## Part 9 · The component contract — the discipline that makes scopes work

**Agreed: components are the atoms, scopes are compositions of them, and the
complete set gets built first.** That is the right call, and it is the opposite
of building templates — templates don't compose, components do.

One discipline decides whether it actually works. **A component cannot just be
a checklist label.** If it is, scopes become templates again by the back door,
because each scope will need its own bespoke rendering of the same item. Every
component needs a contract:

```ts
interface BrandComponent {
  id:        string;              // 'logo.clear-space'
  section:   1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  requires:  ComponentId[];       // the readiness graph, declared not implied
  machine:   'M1'|'M2'|'M3'|'M4'|'M5'|'M6';
  produces:  JSONSchema;          // what it adds to the System
  evidence:  'measured' | 'cited' | 'declared';   // ← see below
  render(system): BookBlock;      // one renderer, every scope
  validate?(system): Finding[];   // only where a check is possible
}
```

`requires` being **declared data** rather than implied by code is what makes the
readiness graph queryable — "what can I do now" becomes a graph traversal, not a
hand-maintained list. And one renderer per component means a scope is genuinely
just a **set of ids**.

### The `evidence` field is the product's identity

Every rule in the book is labelled as one of three things:

| Label | Meaning | Example |
|---|---|---|
| **measured** | We computed it and can re-verify it | "Body on surface: 5.82:1 — passes AA" |
| **cited** | Research supports it, and the citation is shown | "Front vowels are associated with smallness and speed (Klink 2000)" |
| **declared** | You decided it. No claim of evidence | "Our archetype is The Explorer" |

**No competitor does this, and it is honest in a way the category is not.**
Most brand books assert "blue conveys trust" with the same confidence as
"our hex is #0A5CFF". One of those is a fact and one is folklore. Labelling
them differently is cheap to build, impossible to fake, and it is exactly the
posture a product that already measures everything should take.

---

## Part 10 · Scopes are coordinates, not categories

Do not enumerate scopes and build one path per scope — that is templates again.
**Scope is a position in a five-axis space**, and a component's inclusion is a
function of that position.

| Axis | Range |
|---|---|
| **Reach** | personal → team → company → multi-brand architecture |
| **Medium** | digital-only → digital + print → physical product |
| **Permanence** | campaign → product → institutional |
| **Compliance** | none → commercial → **public sector (EN 301 549 / Section 508 mandatory)** |
| **Origin** | greenfield → rebrand / migration |

### What every scope shares — the irreducible THREE

> **Corrected 2026-08-23.** This said "the irreducible five" and listed name,
> colour, typeface, mark and usage rules. **Measuring 19 real brand books did
> not support that** — see Part 14. Only three components clear a near-universal
> bar, and two of the five I asserted are not close:

| Component | Appears in |
|---|---|
| **A logo / primary mark** | **88%** (22 of 25), 12 of 13 sectors |
| **A typeface** | **80%** (20 of 25), 12 sectors |
| **A colour palette** | **72%** (18 of 25), 11 sectors |
| ~~usage rules~~ | 32% |
| ~~a name / naming principles~~ | 12% |

**A brand book with only those three is legitimate and shippable** — and it is
close to what the palette-only user ends up with for free. Note the awkward
implication for us: we already have two of the three, and the one that appears
in **89% of real brand books is the one we cannot do at all.**

### Named scopes as example coordinates

| Scope | Position | Adds beyond the five |
|---|---|---|
| **Creator identity** | personal · digital · product · none · greenfield | Social templates, bio variants |
| **Startup MVP** | team · digital · product · none · greenfield | Positioning, voice basics, deck, UI tokens |
| **Product design system** | company · digital · institutional · commercial · greenfield | §6 in full — components, states, breakpoints, dark mode |
| **Full corporate identity** | company · physical · institutional · commercial · greenfield | Everything; §8 collateral |
| **Rebrand / migration** | any · any · any · any · **rebrand** | **Old-vs-new, what changes, transition rules, sunset dates** |
| **Multi-brand architecture** | multi-brand · any · institutional · any · any | Parent/sub rules, co-branding lockups, partner placement |
| **Campaign sub-brand** | any · any · **campaign** · any · any | Inherits parent; declares overrides and an expiry |
| **Public sector / non-profit** | company · any · institutional · **public** · any | Accessibility becomes **mandatory and audited**, not advisory |
| **DTC / e-commerce** | company · physical · product · commercial · any | Packaging, product photography, marketplace templates |

Two of these are underserved markets nobody builds for, and both are natural
fits for a system that computes and versions:

- **Rebrand/migration** — needs a *diff* between two identities. We already have
  branch, merge and a version DAG. This is close to free.
- **Public sector** — accessibility is a legal requirement, not a preference,
  and our contrast engine already produces exactly the evidence procurement
  asks for.

---

## Part 11 · Logos and names — the honest assessment

Agreed that this is the hardest part. But "generating logos" is two different
problems, and conflating them is what makes it look impossible.

### Three tiers, in order of value

**T1 · Ingest & derive — most users, and the biggest unlock.**
Most companies building a brand book **already have a mark**. Upload it and we
derive clear space from its own geometry, minimum legible sizes, monochrome and
reversed variants, background safety *proved* against the palette, and generated
misuse examples. This is M1, it is where the leverage is, and it is not
generation at all.

**T2 · Assemble, don't generate — the pre-brand startup.**
This is what Namelix actually does under the hood: a wordmark set in a chosen
face, optionally paired with a mark from an icon library, arranged by layout
rules. **We are unusually well placed to do this better, for one reason:**

> Namelix gives you a logo and nothing else. It has no palette, no type scale
> and no contrast engine behind it, so its output arrives with no system around
> it. A wordmark assembled *here* is composed from the type and colour the brand
> already has — it is **born inside the system**, and every downstream rule
> (clear space, min size, background safety) is computed the moment it exists.

Open icon sets that permit this: Phosphor (MIT), Lucide (ISC), Iconoir (MIT),
Remix Icon (Apache-2.0). All allow commercial and derivative use.

**And a licensing feature nobody offers:** OFL permits using a font to create a
logo, and permits that logo being trademarked — the licence restricts selling
the *font*, and reserves the font's name. We already hold licence metadata per
family from Fontsource, so we can **surface whether a face is cleared for
wordmark use** at the moment of choosing it. Surface the terms and link the
licence; never render a legal opinion.

**T3 · True generative vector logos — defer.**
Diffusion models emit raster, not curves; the output has no geometry rules, so
none of the derived components (clear space, min size, construction grid) can be
computed from it; and provenance/licensing is unsettled. It is the least
defensible part of the stack and the most expensive to do badly.

### The better half of Namelix is the name — and naming can be *measured*

Naming has a real, replicated research base, which means we can do something
more defensible than generation: **evaluate a candidate name.**

- **Sound symbolism is real.** Front vowels (i, e) associate with smallness,
  lightness and speed; back vowels (o, u) with largeness, heaviness and slowness
  — Klink (2000), replicated in Lowrey & Shrum (2007), and shown to hold across
  thousands of languages by Blasi et al. (2016, PNAS).
- **Processing fluency matters.** Names that are easier to pronounce are judged
  more favourably.
- **Distinctiveness beats descriptiveness** for long-run recognition —
  Romaniuk (2018).

So a **Name Evaluator** scores a candidate on phonetic profile against the
brand's own positioning, pronounceability, length, distinctiveness within its
category, and domain/handle availability — each line labelled `cited` with the
paper behind it. Generation can sit on top later; **the evaluator is the part
that is defensible, measurable, and on-brand for this product.**

---

## Part 12 · The research foundation

The literature is the difference between a tool that asserts and a tool that
cites. Every claim below was verified against the primary source.

### Colour — and the caveat that is itself a feature

| Source | Use |
|---|---|
| **Elliot, A. J., & Maier, M. A. (2014).** *Color psychology: effects of perceiving color on psychological functioning in humans.* Annual Review of Psychology, 65, 95–120. | The serious review. **Its own abstract warns the field "remains at a nascent stage of development" and that work on "boundary conditions, moderators, and real-world generalizability is needed before strong conceptual statements and recommendations for application are warranted."** |
| **Labrecque, L. I., & Milne, G. R. (2012).** *Exciting red and competent blue.* J. Academy of Marketing Science, 40(5), 711–727. | The one solid hue → brand-personality mapping study |
| **Bottomley, P., & Doyle, J. (2006).** *Interactive effects of colors and products on brand logo appropriateness.* | Colour works via **appropriateness to category**, not universal meaning |
| **Madden, Hewett & Roth (2000)**; **Chattopadhyay, Darke & Gorn (2002)** | Cross-cultural: colour meaning **does not transfer between markets** |
| **Albers, *Interaction of Color*** · **Itten** · **Gerstner, *Designing Programmes*** | The canon for relational and systematic colour |

**This is a competitive position, not a disclaimer.** Every brand tool on the
market ships a "blue = trust" infographic. The leading review in the field says
that claim is not supported. A product that labels colour-psychology guidance
`cited` — with the boundary conditions attached — while labelling its contrast
numbers `measured` is being straight with the user in a way the category is not.

### Names

Klink (2000) *Creating Brand Names With Meaning*, Marketing Letters ·
Lowrey & Shrum (2007) *Phonetic Symbolism and Brand Name Preference*, JCR 34(3) ·
Blasi et al. (2016) *Sound–meaning association biases across thousands of
languages*, PNAS · Kohli & LaBahn (1997) on the naming process.

### Brand building

| Source | Why it matters here |
|---|---|
| **Romaniuk, J. (2018).** *Building Distinctive Brand Assets.* Oxford University Press. | **The most directly buildable framework in this list** — see below |
| **Sharp, B. (2010).** *How Brands Grow.* Ehrenberg-Bass. | Mental and physical availability; the evidence base under Romaniuk |
| **Mark, M., & Pearson, C. (2001).** *The Hero and the Outlaw.* McGraw-Hill. | The **12 archetypes** our §1 component uses: Innocent · Explorer · Sage · Hero · Outlaw · Magician · Regular Guy/Gal · Lover · Jester · Caregiver · Creator · Ruler |
| **Wheeler, A.** *Designing Brand Identity.* | The practitioner's reference for brand-book structure |
| **Neumeier, *The Brand Gap*** · **Aaker, *Building Strong Brands*** · **Olins** on architecture | Positioning, equity, sub-brand rules |

### The component this unlocks — the Distinctive Asset Grid

Romaniuk's framework scores each brand asset on two measured axes —
**Fame** (what % of category buyers link it to you) × **Uniqueness** (do they
link it to you *only*) — and the guidance is to concentrate on **3–5 core
assets**, because more dilutes exposure.

That is a **grid, with numbers, tracked over time, versioned** — which is
precisely the shape of thing this codebase is already good at. It turns the
vaguest part of branding ("is our identity working?") into something with an
axis, and it is the single strongest argument that this product is
evidence-based rather than decorative.

---

## Part 13 · Provenance — where this taxonomy actually came from

**Asked directly: how were these picked, and on what basis?** The honest answer,
because the alternative is a list that looks authoritative and isn't.

### Version 1 of this taxonomy was not researched. It was transcribed.

| Origin | Count |
|---|---|
| **The founder's own 9-section list**, flattened and restructured | **50** |
| Added by me (WCAG 1.4.12 text spacing, elevation/radius/shadow scales, icon states, paragraph spacing split out) | 4 |
| **Validated against any external source** | **0** |

What I contributed was *structure* — mapping each item to a machine, drawing the
dependency graph, marking what is computable. That is real work, and it is also
what made the list **look** externally grounded when it was not. By this
document's own `evidence` rule (Part 9), the entire taxonomy was `declared`.

**That is the exact failure the `evidence` field exists to catch, and I should
have applied it to my own document first.**

### Version 2 was checked against real brand books

Sampled published guidelines with a stated structure — **NASA Graphics
Standards Manual** (1976 + the current Brand Center), **IBM Design Language /
Carbon**, **Atlassian Design System**, **Shopify Polaris**, and a full
98-page corporate identity manual (**MemorialCare**) as a non-tech control.

**Eleven components were missing.** Not edge cases — several are among the
largest sections in the books that have them:

| Missing component | Found in | Why it matters here |
|---|---|---|
| **Data visualisation system** | IBM (first-class section) | Categorical, sequential and diverging palettes with CVD safety. *I called this "the single biggest miss" — **the frequency data does not support that**: 1 of 25, see Part 14. It is a differentiation bet, not table stakes.* |
| **Third-party usage rights & approvals** | NASA (its largest section) | *Who may use the mark at all* — distinct from misuse, which is about how |
| **Co-branding / partner / JV lockups** | NASA, MemorialCare | Both devote whole sections; we had only parent/sub-brand |
| **Supporting graphic device** | NASA "supporting elements", MemorialCare "connection graphic" | A recurring non-logo mark. Also a Romaniuk distinctive asset |
| **Signage, environmental, wayfinding** | NASA (signage, liveries, uniforms) | §8 had stationery/packaging/swag and nothing environmental |
| **Pictograms** as distinct from UI icons | IBM (separate grids, separate libraries) | Different optical rules; we had one "iconography" |
| **Texture & pattern** | MemorialCare | Has its own misuse rules |
| **UI microcopy / action labels** | Carbon (separate from voice & tone) | Error and button copy is a different craft from brand voice |
| **Application examples per audience** | MemorialCare (consumer vs clinician) | How the system *flexes*, which is not the same as a template |
| **Sonic / audio identity** | Romaniuk; emerging practice | Explicitly a distinctive asset; absent from our list |
| **Data-viz colour palettes** | IBM Carbon | The colour half of the above, and squarely our home ground |

**54 → 65.** The list grew by 20% from one afternoon of checking, which is the
best evidence that a component registry needs provenance tracked permanently
rather than as a one-off exercise.

### So the registry needs a second label

Alongside `evidence` (how strong is the *rule*), each component carries
`provenance` — how strong is our reason for *including it at all*:

```ts
provenance: {
  origin:  'founder' | 'observed' | 'derived' | 'proposed';
  seenIn:  string[];   // ['NASA', 'IBM', 'MemorialCare']
  frequency: number;   // how many sampled books contain it
}
```

`frequency` is what makes scope selection defensible later: a component in 5 of
5 real brand books belongs in the irreducible core; one in 1 of 5 is a
specialist item for a particular coordinate. **Right now most of the 65 have a
frequency of 0 because the sample is five books, chosen by me, in an afternoon.**

### What would make this genuinely solid

1. **Widen the sample to 20–30 published brand books**, across tech, public
   sector, healthcare, retail, education and non-profit — the tech-heavy sample
   above is exactly why data visualisation showed up and packaging did not.
2. **Record the ToC of each**, so `frequency` is a real count.
3. **Cross-check against the practitioner reference** — Wheeler's *Designing
   Brand Identity* has an explicit contents structure to diff against.
4. **Publish the frequency table.** "Appears in 24 of 30 real brand books" is a
   defensible reason for a component to exist. "It felt right" is not — and
   that is all the first version had.

This is a day of work and it is the difference between a taxonomy we assert and
one we can show. Given this product's entire thesis is *measured, not typed*,
the component list is the last place that should be taken on faith.

---

## Part 14 · The frequency table — 25 books, 13 sectors

Run it yourself: `node scripts/brand-book-frequency.mjs`. Sample data lives in
`docs/research/brand-book-sample.json` and is built to be widened further.

**Method.** Each entry records sections *observed* in a published guideline's
own table of contents or navigation. Nothing is inferred from what a book of
that type probably contains. `depth: full` means a complete ToC was read
(14 of 25); `partial` means only a nav list or excerpt (11 of 25) — so
**absence in a partial entry is not evidence of absence**, and every number
below is a floor.

Wheeler's *Designing Brand Identity* "Standards content" composite (p.185) is
counted **separately**: a practitioner reference is evidence of what *should*
be there, not of what an organisation shipped.

**Two exclusions worth stating.** Several search results purporting to be Air
France and United Airlines brand guidelines are **LLM-generated SEO filler** —
they open plausibly and trail off into unrelated eBook sales copy. They were
not recorded. And `brandingstyleguides.com`, an archive of ~4,000 real manuals,
is **gated**: it gives page counts and sector tags but not contents, so its
documents could be identified and not observed.

### The result

| Band | Threshold | Count | Components |
|---|---|---|---|
| **CORE** | ≥70% | **3** | `logo.primary` **88%** (12 sectors) · `type.families` **80%** (12) · `colour.palette` **72%** (11) |
| **COMMON** | 40–69% | 4 | `logo.misuse` 48% · `logo.variants` 48% · `imagery.graphic-device` 44% · `logo.cobranding` 40% |
| **SECTORAL** | 20–39% | 14 | legal/IP, architecture, placement, approvals, contact, usage rights, tagline, photography, clear space, voice, signage, iconography, min-size, colour-across-mediums |
| **RARE** | <20% | 33 | everything else |

Sectors: government · tech · public-health · education · healthcare · finance ·
transport · tourism · media · retail-DTC · retail-food · nonprofit · NGO.

### What widening the sample changed

The sample went from 19 books / 9 sectors to **25 / 13**, adding the retail,
DTC, hospitality, media and luxury-adjacent gaps that were flagged as bias.

**The "irreducible three" correction held — and got stronger.** `colour.palette`
crossed the CORE threshold (68% → 72%), so the universal set is now firmly
**logo, typeface, colour**. Naming (12%) and usage rules (32%) remain nowhere
near, which is what I originally and wrongly asserted.

**`logo.misuse` jumped 37% → 48%** and is now COMMON across 9 sectors. The
consumer and food-service books that were missing are heavy on don'ts.

**`dataviz` did not move: still 1 of 25 (4%).** The correction stands — it is a
differentiation bet, not table stakes.

**And the surprise: `collateral.packaging` is still 1 of 25 (4%)** *even after
deliberately adding retail, DTC and food-service books.* KFC's manual is about
signage and trade dress, not packaging; only Mirabella covers pack. The
plausible reading is that packaging specs live in a separate document from the
brand book — which, if true, means §8 was never really brand-book territory and
deferring it was righter than I knew.

### The whitespace — narrower, and much sharper

Widening dropped `brand.positioning`, `collateral.packaging` and
`marketing.email` off the never-shipped list. **Five remain, and three of them
are the same three:**

| Never shipped in 25 books | Wheeler prescribes it |
|---|---|
| **`gov.metrics`** | yes |
| **`gov.taxonomy`** | yes |
| **`gov.version-changelog`** | yes |
| `gov.launch` | yes |
| `sound.sonic` | yes |

**Nobody versions their brand book. Nobody tracks whether their assets are
working. Nobody publishes a naming taxonomy.** Zero out of twenty-five, across
thirteen sectors, and the practitioner reference says all three belong.

Colors World has branch, merge, a version DAG and share links **today**, and
Romaniuk's Fame × Uniqueness grid is precisely the missing `gov.metrics`. This
survived a sample widening that moved almost everything else, which makes it
the most durable finding in this document.

### The uncomfortable one, restated

The most universal component in the corpus — **88%, twelve sectors** — is the
logo, and it is the one thing Colors World cannot do at all. Typeface and
colour, the other two CORE components, we already do better than anyone in the
sample. **Two of three, missing the biggest.**

### Remaining limits

- **11 of 25 are partial observations.** Every frequency is still a floor.
- **Luxury proper is still absent.** LVMH, Ferrari, Harrods and Marchay manuals
  exist in the gated archive; none could be read. Luxury may well weight
  packaging, materials and retail environment far higher.
- **Small-organisation bias persists** — sport clubs and schools have thin books
  and pull the RARE band down.
- **Public availability is not random.** Organisations obliged to publish
  (government, health, education) are over-represented; private corporate books
  have the deepest marketing and collateral sections and are the hardest to get.

---

## The one-line version

**Every other brand-book tool produces a document where the rules are typed.
This one produces a document where every rule is labelled `measured`, `cited`
or `declared` — and it should still be possible to leave after ten minutes with
a two-page colour spec and never know the other fifty-two components existed.**
