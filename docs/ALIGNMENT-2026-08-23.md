# Alignment check — before the component registry

**2026-08-23.** Everything decided, everything assumed, and everything still
open — laid out so you can correct it before it becomes code.

This document exists because the last four days changed the product's
definition twice, and the component registry is the point where those changes
become permanent. A registry is a schema. Schemas are expensive to change once
rooms depend on them.

---

## How to read this

Every claim below carries one of three labels. **The third is the one to read
carefully** — those are calls I made that you have not explicitly confirmed.

| Label | Meaning |
|---|---|
| 🟦 **YOURS** | You stated it. I am executing, not deciding. |
| 🟩 **MEASURED** | Established by measurement. Reproducible, and it does not care what either of us prefers. |
| 🟨 **MINE** | My recommendation. Reasoned, but **not confirmed by you.** If any of these are wrong, now is the cheapest moment. |

---

## 0 · The luxury question, answered directly

**No — not for anything currently on the table. Yes, before Phase 5.**

Here is the reasoning, because "no" alone is not useful.

**Why luxury will not change the current decisions:**

The three CORE components (logo 88%, typeface 80%, colour 72%) are stable
because *every* brand book has them — a Harrods manual will not lower the
frequency of "has a logo". And the load-bearing finding —
`gov.metrics`/`gov.taxonomy`/`gov.version-changelog` at **0 of 25** — would
almost certainly be *reinforced*, not weakened: heritage luxury houses are the
least likely segment to ship a version-controlled, metrics-tracked brand book.

**Where luxury genuinely would change things:**

| It would likely lift | Currently measures |
|---|---|
| `collateral.packaging` | 4% (1 of 25) — surprisingly low even after adding retail and food |
| Materials, finishes, print craft (foil, emboss, spot UV, substrate) | **Not a component at all** in our 65 |
| `imagery.photography` depth (art direction, styling, retouching rules) | 28%, and shallow in our sample |
| Retail environment / store design | Folded into `collateral.signage` at 24% |

Those are **§5 and §8 concerns, which are Phases 5–6.** Not Phase 1–3.

**But one thing could flip this to "urgent":** if your target customer *is*
fashion, beauty or luxury. Then packaging and materials are not a late phase,
they are the product, and the sample bias becomes a live risk today. That is
question **D1** in §7 — it is the single question that most changes this plan.

**If you do want them, the efficient path is a `brandingstyleguides.com`
membership**, not me hunting PDFs. That archive holds ~4,000 real manuals
including LVMH, Ferrari, Harrods and Marchay, gated behind an account. It would
also let us go from 25 books to 100+ in a day, which would turn every frequency
in the table from a floor into a real rate. **That is the highest-leverage
research spend available**, and it is yours to authorise because it costs money
and I will not sign you up for things.

---

## 1 · What is settled

### 1.1 🟦 Yours — the vision

1. **Colors World is a brand-book platform**, not a colour tool. Colour is the
   strongest instrument in the box, not the point of the box.
2. **Every room is a destination**, not only a step. Someone who wants a
   palette must finish in `/compose`.
3. **Scales operate on a palette**, not on one colour.
4. **Visualizer should *be* the interface you are editing**, live, at full size.
5. **Typography needs thousands of fonts** from open sources.
6. **Studio is where it assembles**, Miro-style.
7. **Components are the atoms; scopes compose from them.** Build the most
   complete set first; everything branches off that.
8. **Namelix is the quality bar** for names and logos.
9. Research must ground this — colour psychology, name psychology, branding.

### 1.2 🟩 Measured — facts, not preferences

| Finding | Evidence |
|---|---|
| The universal core is **three** components: logo **88%**, typeface **80%**, colour **72%** | 25 books, 13 sectors |
| **Nobody ships governance**: `gov.metrics`, `gov.taxonomy`, `gov.version-changelog` | **0 of 25**, and Wheeler prescribes all three |
| Data visualisation is **rare, not expected** | 1 of 25 (4%) |
| Packaging is **rare even in retail/DTC/food** | 1 of 25 (4%) |
| `/compose` has **zero** export affordances | Driven live |
| `/scales` = **208 controls, 3,971px** of scroll for 6 colours | Measured |
| `/scales` star **never writes `system.anchorHex`** — resets on reload, propagates nowhere | Star 0→2, reload→0 |
| `/visualizer` stage **hard-fixed 760×475** — 10% of a 2560px viewport | Measured |
| `/typography` ships **4 pairings**; Fontsource offers **2,096 families**, all open-licensed, no key | API verified |
| Fontsource, Bunny and Google are **the same corpus** — stacking adds ~0 fonts | 1,976 of 2,096 are `type: google` |
| The six rooms are **structurally clean**: 0 of 249 text runs below target, 0 unnamed controls | Full audit |
| Codebase health: 33,506 LOC, 935 tests, 86.65% coverage, **0 dead files, 0 TODOs** | Measured |

### 1.3 🟨 Mine — the calls you have *not* confirmed

**These are the ones to push back on.** Each has a number so you can reject by
reference.

| # | Call | Why I made it | What it costs if wrong |
|---|---|---|---|
| **M1** | **The book is a VIEW, not a container.** Nothing is "put in" it; it renders from state. | Serves the palette-only user without a mode switch. | Large. It is the root architectural decision — everything else assumes it. |
| **M2** | **No completeness percentage by default.** | 3% of 65 is hostile to your largest user group. | Small. Add later if you disagree. |
| **M3** | **Readiness graph, max 3 suggestions** — not a checklist. | Dependency is real designer logic; sixty boxes is not. | Medium — it is the guidance mechanism. |
| **M4** | **Six machines** (Ingest·Compute·Author·Direct·Template·Govern) as the build unit rather than 65 features. | 65 features is a backlog; 6 machines is an architecture. | Medium. Wrong grouping = wrong module boundaries. |
| **M5** | **The Book is a persistent rail, not a tab.** Nav ceiling 6→8. | The Harmonic Dock precedent already works this way. | Small — a UI decision, reversible. |
| **M6** | **`evidence: measured \| cited \| declared`** on every rule. | It is the honest posture for a product that measures things, and no competitor does it. | Small to add, large to retrofit. |
| **M7** | **`provenance: {origin, seenIn[], frequency}`** on every component. | Stops the taxonomy drifting back to assertion. | Small. |
| **M8** | **Scopes are coordinates on 5 axes**, not named templates. | Templates do not compose; coordinates do. | Medium. |
| **M9** | **Logo: T1 ingest → T2 assemble → T3 defer generative.** | Most companies already have a mark; diffusion emits raster, so nothing downstream can be computed from it. | Medium — it is a direct answer to your Namelix reference. |
| **M10** | **Name evaluator, not generator.** | Sound symbolism is measurable and citable; generation is not. | Small — can do both. |
| **M11** | **Defer §8 physical collateral.** | Furthest from the engine, does not compound — and packaging measured 4%. | Small. |
| **M12** | **Positioning: "the brand book that checks itself."** | It is the only claim in the category nobody else can make. | Large — it shapes everything downstream. |
| **M13** | **Phase order**: rooms → book → logo → voice → components → templates → governance. | Each makes the next cheaper. | Large. See §5 for why I now doubt part of it. |

---

## 2 · The architecture, explained

This section is deliberately educational. If any layer is wrong, it is cheaper
to find out here than in the registry.

### 2.1 Four layers

```
  ┌─ LAYER 4 · SURFACES  the rooms + the Book rail
  │     library · compose · scales · visualizer · typography · studio
  │     + /brand (new) + /assets (promoted from orphan)
  │
  ├─ LAYER 3 · MACHINES  the six things that DO work
  │     M1 Ingest&Derive · M2 Compute&Verify · M3 Author
  │     M4 Direct · M5 Template · M6 Govern
  │
  ├─ LAYER 2 · REGISTRY  65 components, each a contract
  │     id · section · requires[] · machine · produces · evidence
  │     · provenance · render() · validate()
  │
  └─ LAYER 1 · STATE  what the brand actually IS
        colour · type · logo files · text · imagery · tokens · history
```

**The registry is Layer 2, and it is the piece we are about to build.** It sits
between what the brand *is* (Layer 1) and what does work to it (Layer 3). That
is why getting it wrong is expensive: both neighbours depend on its shape.

### 2.2 ⚠️ The problem I found while writing this

**Layer 1 does not currently exist in a form that can hold a brand book.**

Today's "System" — the shared state every room reads — models exactly this:

```
palette[]  ·  anchorHex  ·  roleOverrides  ·  type{preset,ratio,baseRem,
lineHeight,tracking,weight}  ·  scales{steps,gamut,byHex}  ·  mode
```

Seven URL parameters: `c · a · r · t · m · sg · s`. **All colour and
typography. Nothing else.**

And it is deliberately **URL-shaped**. That is what makes share links work — a
whole System fits in a link with no account and no database. It is one of the
genuinely elegant things in this codebase.

**A brand book cannot fit in a URL.** A logo is a file. Photography direction
has reference images. Voice and values are paragraphs. The moment the book
holds any of those, the URL model breaks.

So there is a fork, and it is architectural rather than cosmetic:

| Option | What it means | Cost |
|---|---|---|
| **A · Split the model** | `System` stays URL-shaped (colour + type, no account, instant share). `Project` is DB-backed and holds files and text. The Book renders **both**. | Two state models to keep coherent. But it **preserves the zero-signup promise** for the colour half — which is the product's best growth property. |
| **B · One model, DB-backed** | Everything moves to the database. Share links become project links. | Simpler mentally. **Kills anonymous instant use** and makes every visitor a database write — which the roadmap already flags as an unbounded write vector at launch traffic. |
| **C · Defer** | Build the registry against colour + type only; decide when a file-bearing component arrives. | Cheap now, but the registry would be designed without knowing its own storage. That is how schemas get retrofitted badly. |

**🟨 My recommendation is A**, and I want your explicit agreement because it is
the most consequential technical decision in the whole plan. It says: *the
colour and typography half stays anonymous, instant and link-shareable forever;
the brand-book half requires an account.* That is a product decision as much as
a technical one — see **D2** in §7.

### 2.3 What a component contract actually is

Not a checklist row. A record with behaviour:

```ts
interface BrandComponent {
  id:         'logo.clear-space';
  section:    2;
  requires:   ['logo.primary'];        // the readiness graph, as DATA
  machine:    'M1';                     // who builds it
  produces:   JSONSchema;               // what it adds to Layer 1
  evidence:   'measured';               // how strong is the RULE
  provenance: { origin: 'observed', seenIn: ['NHS-Scotland','Cook-Islands',
                'Centreville','SAT','OU','Mirabella','Wheeler'], frequency: 7 };
  render(state): BookBlock;             // ONE renderer, every scope
  validate?(state): Finding[];          // only where a check is possible
}
```

**Why each field earns its place:**

- **`requires` as data, not code** — makes "what can I do now?" a graph
  traversal instead of a hand-maintained list that drifts.
- **`machine`** — tells you which of six things to build, and lets one machine
  serve many components.
- **One `render()` per component** — this is what makes a scope *literally just
  a set of ids*. Without it, every scope needs its own layout and you have
  templates again by the back door.
- **`evidence`** — separates "we measured 5.82:1" from "research suggests" from
  "you decided". Cheap now, impossible to retrofit honestly.
- **`provenance`** — stops the list drifting back to assertion, and makes scope
  membership defensible: in 22 of 25 books = core; in 1 of 25 = specialist.

### 2.4 The readiness graph — why dependency beats a checklist

Sixty-five empty boxes teaches nothing and demoralises everyone. Dependency is
the actual designer logic:

```
  no prerequisite ─── voice · values · archetype ─── grammar · taglines
  colour palette ──── roles ──── component states · iconography · dataviz
  type scale ──────── hierarchy ─── editorial rules
  LOGO UPLOAD ─────── clear space · min size · variants · misuse ·
                      background safety · lockups        ← SIX unlocks
  logo+colour+type ── stationery · decks · ads · packaging · swag
```

Two consequences worth restating because they are strategic, not cosmetic:

1. **Voice, values and archetype need nothing.** A founder with no colours can
   start there. That is a *second front door* into the product for a much
   larger audience than people arriving wanting OKLCH.
2. **The logo is the biggest single unlock in the graph** — one upload opens
   six components — *and* it is the most universal component in the corpus at
   88%, *and* it is the one thing the product cannot do at all.

---

## 3 · Where the product stands against its own taxonomy

Of 65 components: **Have 9 · Partial 13 · New 43.**

| Section | State | Comment |
|---|---|---|
| §3 Colour | **Strongest** | The engine is genuinely world-class. Gaps: 60/30/10 weighting, explicit state tokens |
| §4 Typography | Half | Scale and fluid clamp good. Needs the font library, full H1–H6 output, 1.4.12 spacing |
| §6 Web/product | Partial | Exporters emit tokens; `/visualizer` becomes this surface |
| §9 Governance | **Real foundation** | Branch/merge/DAG and share links exist. **And it is the measured whitespace.** |
| §2 Logo | Seeded | `/assets` versions files but is an orphan with no `<main>` |
| §1 Strategy | **Nothing** | Pure authoring. Highest AI leverage, weakest competitors |
| §5 Imagery | **Nothing** | Beyond Studio holding images |
| §7 Editorial | **Nothing** | Template surface |
| §8 Physical | **Nothing** | Deferred (M11), and measured at 4% |

---

## 4 · The phases, and what each actually costs

| Phase | Contents | Rough size | Leaves the product… |
|---|---|---|---|
| **1** | `/compose` exports · star bug · Fontsource catalogue · `/visualizer` full-bleed | **Days** | Coherent. Every room finishes its own job. No book yet. |
| **2** | The Book as a view. Rail + `/brand`. Render to web/PDF/tokens. **Ship with §3+§4 only.** | 1–2 weeks | A real deliverable exists. Model proven before any new machine. |
| **3** | **M1** logo ingest & derive. Clear space, min size, variants, background safety, generated misuse. `/assets` → DAM. | 2–3 weeks | The 88% gap closed. Six components unlocked by one upload. |
| **4** | **M3** authoring: values, archetype, voice, grammar. | 1–2 weeks | Second front door opens. Non-designers can start. |
| **5** | **M2 extended**: component library in `/visualizer`, iconography grid, motion tokens. | 3–4 weeks | §6 complete. Engine work, our strength. |
| **6** | **M5** templates: social, email, decks, ads. Then §8. | 3–4 weeks | Marketing surface. |
| **7** | **M6** completed: taxonomy, naming lint, format matrix, licences. | 1–2 weeks | **The measured whitespace, occupied.** |

Estimates assume the current pace and are ±50%. They are for *sequencing
judgement*, not commitments.

---

## 5 · Where I now think I am wrong

Stated plainly, because an alignment document that only defends itself is
worthless.

### 5.1 M13 (phase order) is probably wrong about M1

I put logo ingest in **Phase 3**. The evidence argues for earlier:

- It is the **most universal component measured** (88%, 12 of 13 sectors)
- It is the **biggest unlock** in the readiness graph (six components)
- **Generated logo misuse** is the most demonstrable feature in the entire plan
  — every brand book draws that page by hand
- Phase 2 ships a book with colour and type, which is exactly what we already
  had; **Phase 3 is what makes it a brand book rather than a colour spec**

**The counter-argument**, which is why I did not just reorder it: M1 needs
file storage, which needs the §2.2 fork resolved. Phase 2 forces that decision
anyway. So the real dependency is **§2.2 first**, then 1 → 2 → 3 as written, or
1 → 3 → 2 if you want the demo sooner.

### 5.2 The governance whitespace may be a finding without a customer

`gov.metrics`/`taxonomy`/`version-changelog` at 0 of 25 is the most durable
measurement here. But **"nobody does it" has two readings**: nobody needs it, or
nobody can. I have been assuming the second. The honest position is that it is
*unproven demand backed by strong capability*. Do not let me sell it as
validated.

### 5.3 The sample still cannot see luxury or private corporate books

11 of 25 are partial. Public availability skews to organisations *obliged* to
publish. The books with the deepest §5 and §7 sections are precisely the ones
behind a paywall. Every frequency is a floor and I have said so, but it bears
repeating in the same breath as any conclusion drawn from it.

### 5.4 I have not questioned the pivot itself

You changed the definition and I executed. For completeness: the risk is
**dilution** — the product is genuinely exceptional at colour and merely
competent at everything else, and a 65-component scope invites being average at
all of it. The plan's mitigation is that "compute" stays the spine and
everything else is judged against it. If that mitigation stops holding, the
plan is wrong and I should say so at the time.

---

## 6 · Assumptions nobody has examined

These have never been discussed, and each changes the plan materially.

### D1 · Who is the primary user?

**This is the question that most changes everything, and it is unanswered.**

| Persona | What they need first | Implication |
|---|---|---|
| **A · Solo designer / freelancer** | Craft, speed, export. Would use OKLCH knowingly. | Current product is built for this. |
| **B · Founder / marketer, no design training** | Guidance, defaults, plain language, voice help. | Phase 4 (M3) becomes Phase 1. Readiness matters far more. Much bigger market. |
| **C · Design team in a company** | Tokens, components, handoff, versioning. | Phase 5 (M2 extended) becomes Phase 1. §6 and §9 dominate. |
| **D · Agency serving clients** | Multi-project, white-label, client handoff. | Needs a project model, permissions, branding-of-the-branding. Nothing in the plan covers it. |

The plan as written quietly serves **A**, while the brand-book vision points at
**B** or **D**. That tension is unresolved.

### D2 · Business model

Never discussed. The licence is split (engine MIT, app PolyForm Noncommercial),
which prevents commercial *reuse* but says nothing about whether you charge.

It matters because: free-forever competes with Coolors and Realtime Colors on
generosity; paid competes with Frontify and zeroheight on completeness. **Those
are different products.** It also decides §2.2 — accounts are friction, and
friction is only acceptable if something is being sold.

### D3 · Multi-project

The System is singular. One palette, one type scale, one anchor. **An agency or
anyone with two brands cannot use this.** No phase addresses it.

### D4 · Collaboration

Share links are read-only snapshots. There is no concept of two people editing,
commenting or approving — and `gov.approvals` measured 32%, so real brand books
do care about approval flow.

---

## 7 · What I need from you

Numbered so you can answer by reference. **None require long answers.**

| # | Question | Why it blocks |
|---|---|---|
| **D1** | **Who is the primary user — A, B, C or D?** | Reorders phases. Biggest single lever. |
| **D2** | **Free, paid, or freemium?** | Decides whether accounts are acceptable, which decides §2.2. |
| **§2.2** | **Split state (A), all-DB (B), or defer (C)?** | The registry's storage shape. My recommendation: **A**. |
| **M1–M13** | **Any of my thirteen calls you disagree with?** | Each is cheap to change now, expensive later. |
| **5.1** | **Move logo ingest earlier — 1 → 3 → 2?** | The evidence says yes; the dependency says resolve §2.2 first. |
| **Luxury** | **Authorise a `brandingstyleguides.com` membership?** | Would take the sample from 25 to 100+ and make frequencies real rather than floors. Not blocking, but cheap and high-leverage. |
| **D3/D4** | **Multi-project and collaboration — in scope or not?** | Currently in no phase at all. If they matter, the data model must know now. |

---

## The one thing I would most like you to challenge

**M1: the book is a view, not a container.**

Everything else in this document rests on it. If you picture the brand book as
something a person *builds up and fills in* — with progress, with a sense of
construction — rather than something *rendered on demand from what exists*,
then Part 2 of the spec is wrong, the readiness graph is the wrong guidance
mechanism, and the registry should be shaped differently.

I argued for the view because it serves the palette-only user without a mode
switch. **But you are the one with the picture of what this feels like to
use.** If the container model is what you see, say so now — it is a fortnight
of rework today and a rewrite in three months.
