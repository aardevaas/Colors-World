# What an internal brand guideline actually specifies

**2026-08-24.** The corrected research. Supersedes the *grain* of
`brand-book-sample.json` — not its corpus.

---

## Why this document exists

The 25-book study recorded **which sections a brand guideline contains**. It
never recorded **what is inside a section**. `colour.palette` scored identically
whether a manual gave one hex or gave hex, RGB, CMYK, Pantone, five tint steps,
a proportion rule, approved pairings and a list of things you may not do.

**The product's entire value is that second thing, and the frequency table was
blind to it.**

### The corpus was never the problem

The founder's read was that the 25 books were public marketing artifacts. They
are not. NASA's *Graphics Standards Manual* is the canonical internal manual —
it exists so a contractor gets the mark right. NHS Scotland's is a working spec
for trusts and suppliers. TfL, MemorialCare, KFC Global Brand Identity
Standards, Zebra, Centreville Bank and every university guideline in the sample
are operational documents. IBM Carbon and Polaris are internal design systems.

They are findable because these are public bodies, universities and open-source
design systems — **not** because they are showcases.

**The real bias is different and smaller:** a published internal manual is still
a curated subset of a full design-firm handover. No token files, no source
assets, no naming spreadsheets, no licence documents. So depth is undercounted
twice — once by our recording grain, once by what organisations publish.

---

## Method

Sub-component structure extracted from manuals that publish at operational
depth: **Monash University**, **IRBA Corporate Identity Manual v3.0**,
**Commonwealth Brand Guidelines**, **Regus**, **PTC**, **Toyota**,
**Cedarville University**, **Priority Commerce**, **IBM Carbon**, **USWDS**,
**Aludium Corporate Identity Manual**.

Recorded only what a manual **states as a rule**, not what it implies.

---

## The finding, in one example

The IRBA manual does not say "we have a business card." It says:

> Business card **100mm × 50mm**. Margin of clear space **3mm** on all sides.
> Logo height **12.5mm (or ¼ of page height)**, centred vertically.
> Name: **Gotham Bold, 7pt, 8.4pt leading, 100% White.**
> Title: **Gotham Medium, 6pt, 7pt leading, 100% IRBA Orange.**

Cedarville's letterhead spec is the same shape: *Minion, Regular, 10pt, 13pt
leading, 13pt paragraph break, flush left, black, no hyphenation, 2" top
margin, 1" elsewhere.*

**That is the artifact this product must generate.** Not a swatch — a spec, with
every number derivable from the palette and the type scale the user already
built.

---

## §3 · Colour — 14 sub-components

| # | Sub-component | What a real manual states | Engine today |
|---|---|---|---|
| 1 | **Tiers** | Named hierarchy: primary / secondary / accent / utility. Monash runs primary·secondary·tertiary plus a separate utility set; PTC 2 primary, 7 secondary, 7 tertiary | Partial |
| 2 | **Values** | Per colour: name, HEX, RGB, HSL, OKLCH | **Have** |
| 3 | **Print** | CMYK per colour. Pantone/PMS where licensed — *ours cannot ship it, and says so* | **Have** |
| 4 | **Tints** | Explicit steps (Commonwealth: 75/50/25%), **and whether tinting is permitted at all** — IRBA: "Tints of the primary colours are not allowed" | **Have** (scales) |
| 5 | **Proportions** | The ratio each tier occupies. IRBA: primary 50% / secondary 20% / accent 20%. Regus: 60% white, 20% black, 10% red, 5%, 5%. Monash: **minimum 25% primary across all audiences** | New — computable |
| 6 | **Order** | Application sequence: primary first, then secondary, then tertiary, utility only if exhausted | New |
| 7 | **Roles** | Purpose per colour — CTA, background, border, sub-heading, pull quote, table | **Have** |
| 8 | **Pairings** | Approved foreground/background combinations **with the measured ratio and a WCAG verdict** | **Have** — strongest asset |
| 9 | **State** | success / warning / error / info | Partial |
| 10 | **Themes** | Light and dark mapping | **Have** |
| 11 | **Data-viz** | A *separate* utility set. Monash: "**ONLY** to extend the palette for data visualisation… maintain consistent colour mapping across related visuals" | **Have** (CVD + ΔE) |
| 12 | **Gradients** | Monash: limit to two colours, never overpower content, keep primary prominent | New |
| 13 | **Misuse** | "Do not create new colours by mixing approved ones." "Do not use similar off-brand colours." "Accent colours should not be used in isolation." | New — **generatable** |
| 14 | **Exceptions** | The approval route for a bespoke colour. Monash routes it through a form | New |

**Nine of fourteen are already computable by the engine.** That is the story.

---

## §4 · Typography — 15 sub-components

| # | Sub-component | What a real manual states | Engine today |
|---|---|---|---|
| 1 | **Families** | Primary (display), secondary (body), mono, and their character | **Have** |
| 2 | **Sources** | Where each is obtained, with a download link | Partial |
| 3 | **Licensing** | Licence per use case — web embed, print, product, resale are **four different permissions** | New — free from Fontsource |
| 4 | **Fallbacks** | The literal CSS stack, plus a **system alternate**: Priority names Calibri "when Source Sans 3 is unavailable… Microsoft or email" | Partial |
| 5 | **Weights** | Which exist and which is approved per role. Toyota: "Book for text 10pt or larger on light backgrounds; Regular for 10pt or smaller reversed on dark" | Partial |
| 6 | **Hierarchy** | Display→H6, body, caption, overline — in **px and rem** | **Have** |
| 7 | **Line height** | Per role. Toyota: 90% headlines, 110% subheads print, **145% body** | **Have** |
| 8 | **Tracking** | Per role. Toyota: optical kerning, 0px digital. Priority: 10% on tags | **Have** |
| 9 | **Casing** | Toyota: "only use uppercase for headlines with **7 or fewer words**" | New |
| 10 | **Alignment** | Toyota: "Flush left, centered or staggered. **Never flush right.**" Cedarville: no hyphenation | New |
| 11 | **Measure** | USWDS: 45–90 characters per line | New — computable |
| 12 | **Paragraph** | Spacing between paragraphs, indent rule, hyphenation | Partial |
| 13 | **Minimums** | By channel: 16px web body, **never below 14px in email**, 6pt legal print | **Have** (legibility field) |
| 14 | **Channels** | Web, email, print, presentation stated **separately** — email leads with web-safe fallbacks | New |
| 15 | **Misuse** | Characters too close or too far, wrong weight, stretched | New — **generatable** |

**Seven of fifteen exist; four more are trivially computable.**

---

## Physical collateral — a spec, not a picture

Every manual sampled treats collateral as **dimensioned specification**. The
most frequently specified items, in order:

1. **Business card** — every manual that has a collateral section
2. **Letterhead** — near-universal, with a margin grid
3. **Envelope** — Aludium: 220 × 114mm, four specified PMS colours
4. **Email signature** — the modern replacement for the compliment slip
5. **Signage** — where an organisation has premises
6. **Apparel / uniform** — IRBA: "corporate clothing" is a named secondary-colour application
7. **Presentation deck** — universal in practice

**Recommended showcase set of five:** business card · letterhead · envelope ·
email signature · signage. All five are pure colour-and-type artifacts, all five
render deterministically at a fixed aspect, and none needs a photograph.

**The logo problem, stated honestly.** Every collateral spec places a logo and
sizes it as a fraction of the page. With no logo, the render must either use a
neutral placeholder block at the correct proportion, or accept an uploaded mark
purely as an image to position — **no derivation, no geometry, no generation.**
That is a supportable middle path and it should be labelled as a placeholder in
the book so nobody mistakes it for a specification.

---

## Governance — 8 sub-components

Now central rather than peripheral. The founder's own definition of the artifact
is a guide "for the company to follow **and enforce**". Enforcement is
governance; a public brand book does not need it and an internal one exists for it.

| # | Sub-component | What a real manual states |
|---|---|---|
| 1 | **Version & changelog** | Every page of the IRBA manual is stamped `VERSION 3.0 APRIL 2024`. Frontify ships a changelog. **Zero of 25 sampled books version the brand itself** — and we already have branch/merge/DAG |
| 2 | **Ownership** | Who owns the standard, and who to ask |
| 3 | **Approvals** | Routing and turnaround. Alabama publishes "1–3 business days standard, 6–10 for large publications" and a three-body chain |
| 4 | **Exceptions** | The request route, and **tracking exception patterns** — they reveal where the guideline is wrong |
| 5 | **Naming** | File naming convention. The failure it prevents: `v1, v2, final_v3, updated_FINAL_v4` |
| 6 | **Formats** | Which format for which use — SVG, PNG, WebP, PDF |
| 7 | **Access** | Who may view, edit and distribute |
| 8 | **Asset home** | Where the current file lives, and what "current" means |

---

## What this changes

1. **§3 + §4 grow from 14 components to 29 sub-components.** The old taxonomy
   was not wrong, it was too coarse to see the product.
2. **Sixteen of those 29 already exist in the engine.** The gap is presentation,
   not computation.
3. **Misuse pages are generatable for colour and type**, exactly as they would
   have been for a logo — off-palette mixes, disallowed tints, tracking too
   tight, wrong weight on a dark ground, each rendered from the real system with
   a measured reason.
4. **Proportions are a genuine new primitive.** No colour tool computes "your
   deck is 8% primary against a 25% minimum." Every serious manual states a
   ratio and none of them can check it. **This is a differentiator nobody else
   has, and it is arithmetic.**
5. **Collateral is colour-and-type, not logo work** — so it is buildable now.

---

## Not carried over

The `brandingstyleguides.com` membership is **declined** and the reasoning is
sound: that archive holds public brand books, and this document establishes
that public-facing books are the wrong grain regardless of how many are read.
Depth, not sample size, was the missing variable.
