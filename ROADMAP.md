# PRISM — Roadmap v2 (reframed 2026-07-21)

> **This document replaced an earlier version.** The first roadmap optimised for engineering rigour — design-system compilation, git-style version control, spec-driven token generation. That was the wrong product. This is the correction.

---

## The vision

**A creative studio for colour and brand — where 100,000 colours are a world you explore, and your dashboard is your studio wall.**

Exploratory, artistic, visual, inspiring. The rigour stays, but as *invisible infrastructure* that quietly stops you making mistakes — never as the thing you interact with.

Reference points: the speed and joy of **Coolors**, the craft of **Radix**, the visual ambition of **opencolors.org** — fused, and then pushed past all three.

**Who it's for:** ~10 people. Business and family. Private by default, shared deliberately.

---

## What changed, and why it matters

| I built | You actually want |
|---|---|
| Moodboarding **cut** ("competes with Figma") | Moodboarding is the **centre** — the dashboard *is* the product |
| 100K colours as a searchable **database** | 100K colours as a **place you wander** |
| OKLCH as the single source of truth | **HEX · sRGB · CMYK · OKLCH** — different audiences, different stages |
| Git semantics: branch, merge, resolve conflicts | **History**: see the past, restore it, duplicate to explore |
| Single-user, no accounts | **Multi-user** (~10), projects, private-by-default sharing |
| Structured, rigorous, systematic | Exploratory, artistic, visual, inspiring |

The through-line of every mistake: **I kept choosing the defensible option over the delightful one.**

---

## What's already built, and what it becomes

Nothing is wasted. Most of it just needs a gentler face.

| Built & tested | Becomes |
|---|---|
| OKLCH engine, perceptual scales | The quiet maths under every colour in the app |
| WCAG + APCA contrast auditing | A "will this read?" indicator, not a compliance report |
| Gamut mapping (sRGB/P3/Rec2020) | **Powers the out-of-gamut and print warnings** — see Phase 1 |
| CVD simulation | A one-click "how others see this" toggle |
| Version DAG, three-way merge | **History** — restore any past state, duplicate to explore. Merge machinery stays but sits mostly unused behind a simpler surface |
| 100,000-colour library | **The Spectrum** — the signature feature |
| CSS/Tailwind/Figma export | Extended with the one-click copy system |

**160 tests · 96.9% coverage · `tsc` clean.** The foundation holds; the surface changes.

---

## Phase 1 — Universal colour, warnings, one-click copy ✅ shipped 2026-07-21

_Small, touches everything, immediately makes the whole app better._

Every colour, everywhere, shows all four spaces with copy buttons matched to context:

```
#3B82F6                          ← designers, handoff
rgb(59 130 246)                  ← CSS, legacy
oklch(62.3% 0.188 259.8)         ← modern CSS, wide gamut
C:76 M:47 Y:0 K:4                ← print
bg-blue-500 / --color-brand-5    ← code
```

### The two warnings

**Out of gamut** — when a vibrant OKLCH value clips on conversion to hex, show the original, the clipped result, and how far it moved (ΔE). The gamut-mapping code for this is built and tested already.

**Print reality** — your neon beside the dull thing a press actually gives you. Honest, visual, exactly when it matters.

### ⚠️ Technical finding — verified live, 2026-07-21

**culori does not support CMYK.** `converter('cmyk')` returns a function, but it is a lazy stub that throws on call. Thirty colour modes ship with culori; CMYK is not among them.

Two consequences:

1. **CMYK conversion must be written here.** The standard device-independent formula is ~15 lines and needs no dependency. It is what Adobe Color and Coolors show. It is *not* press-accurate, and the UI must say so.

2. **Naive CMYK cannot power the print warning.** That formula is a reversible transform — it round-trips almost perfectly, so it will never show your neon going dull. The dulling comes from a real press's *gamut limits*, which the formula doesn't model.

   **The fix — implemented:** `'print'` is now a fourth `Gamut` value with a twelve-hue chroma-retention table approximating a SWOP/FOGRA boundary (`gamut.ts`), so the existing, tested `mapToGamut()` produces the warning through the same code path as sRGB and P3. `toCmyk()`/`formatCmyk()` live in `cmyk.ts`; `auditGamutWarning()` in `warnings.ts` powers both the out-of-gamut and print-dulling warnings from one function. All surfaced live in the scale lab via `ColorValues`, with one-click copy on every value.

**Worth noting:** every competing web tool shows naive CMYK numbers and calls it done. Doing the gamut boundary properly is a real differentiator — the warning is *honest* rather than decorative.

---

## Phase 2 — The Spectrum ⭐

_The signature feature. Nobody else has this._

100,000 colours sorted perceptually — **hue → lightness → chroma** — as one continuous, infinite scroll. You don't query it, you **wander** it. Scrolling becomes a journey through the entire visible spectrum.

- **Sticky hue header** tells you where you are — "deep in the blues", "entering the ambers"
- **Instant filters** collapse the field — pastels only, vivid only, one hue family, light or dark
- **Heart as you go** — saved colours collect in a tray you drag onto a board
- **Rich detail on click** — every space, its name, its meaning tags, its generated scale, its nearest neighbours, what reads against it

### Technical approach

Naive offset pagination degrades badly past a few thousand rows, and a scrollbar representing 100K items needs to jump to arbitrary positions instantly.

**Solution: a precomputed `spectrum_index` integer column**, assigned once by ordering on hue → lightness → chroma. Then any window is `WHERE spectrum_index BETWEEN x AND y` — indexed, instant, and the scrollbar maps 1:1 to position. Rendering is virtualised so only the visible rows exist in the DOM.

Compare: Coolors gives you five colours at a time. Radix gives you twelve hues, take them or leave them. **Nobody lets you browse a hundred thousand.**

---

## Phase 3 — Accounts & projects

_Now there's something worth saving._

- **Supabase Auth**, magic-link — no passwords for family members to lose
- **Projects** — each with its own boards, palettes, and assets
- **Private by default**, shared deliberately per your call

### ⚠️ This reverses my earlier RLS advice — correctly

I previously told you to decline Row Level Security. That was right *given the conditions I verified at the time*: no anon key anywhere, no browser-side database access, service-role key server-only. **You have just changed both conditions.**

Multi-user makes RLS a real security gate rather than a checkbox. What changes:

- RLS **enabled on every table**, with policies scoped to `auth.uid()`
- App queries move to a **per-request authenticated client** (`@supabase/ssr`)
- The service-role client survives **only** for ingestion scripts — never for app traffic
- New tables: `profiles`, `projects`, `project_members`

My original reasoning was sound. Its premise expired the moment this became multi-user.

---

## Phase 4 — The Studio Wall ✅ core shipped 2026-07-22

_The dashboard. Freeform, infinite, per project. This is the home screen._

Everything a brand gets assembled from, on one surface:

| Item | Behaviour | Status |
|---|---|---|
| **Palettes** | Pinned, live, editable in place | ✅ |
| **Individual colours** | Dragged from the Spectrum tray | ✅ — "Pin to Studio Wall" in the Collect tray |
| **Reference images** | **Drop a photo → its palette extracts instantly** | ✅ — client-side k-means over canvas pixels, no dependency |
| **Notes** | Freeform text, annotations, decisions | ✅ |
| **Gradients** | OKLCH-interpolated, no muddy middle | ✅ — reuses the monotone/hue interpolators from scale generation |
| **Typography pairings** | Curated Google Fonts pairs, live heading+body sample, switchable per card | ✅ — 8 curated pairs, loaded on demand |
| **Links** | With preview cards | ✅ — server-side title fetch, SSRF-guarded (rejects private/internal/link-local targets) |
| **Logos & brand assets** | Uploaded, versioned, pinned beside the colours they're used with | Uploads work (image item type); dedicated "logo" semantics/versioning deferred to Phase 5 |
| **Product & packaging mockups** | Your palette applied to real objects | Deferred to Phase 5 (same feature, listed there) |

Freeform placement, drag-and-drop, per-project. Multiple named boards per project not yet built (one wall per project for now).

**Shipped, the signature touch:** drag two colour-bearing cards near each other and their WCAG contrast ratio + ΔE-OK perceptual distance surface automatically in a floating readout — proximity carries meaning instead of being a generic whiteboard.

Supabase Storage is live: a private `board-assets` bucket, RLS-scoped by project via path prefix (`supabase/storage.sql`).

---

## Phase 5 — The Brand layer (in progress)

_Colour is half of an identity. This is the other half._

- **Typography pairing** ✅ — 8 curated Google Fonts pairs, live heading+body sample on a Studio Wall card, switchable inline (shipped 2026-07-22, pulled forward alongside Phase 4)
- **Shareable links** ✅ — a project owner mints a long random token (`board_shares`, 192 bits via `crypto.randomBytes`); anyone holding it views `/share/[token]` read-only, no account, revocable any time (shipped 2026-07-22)
- **Live brand preview** — your palette on realistic mockups: business card, packaging, garment tag, web page, app screen, storefront. Colours on swatches are abstract; colours on a business card are a **decision**
- **Brand asset library** ✅ — a dedicated `/assets` page, separate from the Studio Wall's generic `image` cards: logos/marks/other, grouped by asset with simple re-upload versioning (a new upload replaces without losing history — earlier versions collapse into an expandable list, individually deletable) (shipped 2026-07-22)
- **Brand guidelines export** — a shareable page or PDF generated from palette + type + assets

_Mockups start as styled SVG/CSS templates recoloured by the palette. Photorealistic composites are a later upgrade if the stylised version isn't enough._

### How shareable links work, for later reference

`/share/[token]` is the app's only unauthenticated route. It resolves the token via the service-role client (a deliberate, narrow exception to "service-role is ingestion-only" — an anonymous visitor has no `auth.uid()` for RLS to check, so the application code *is* the authorization boundary: it looks up exactly one `project_id` from the token and never accepts one from the request). `StudioWallBoard` gained a `readOnly` prop so the same rendering code serves both the authenticated wall and the public view — no drag, no edit, no delete, no add buttons in read-only mode. See `supabase/sharing.sql` for the table/policies and `src/lib/supabase/sharing.ts` for the token lookup.

### How the brand asset library works, for later reference

`brand_assets` is separate from `board_items` — a Studio Wall image pin is ephemeral (drop a reference photo, extract a palette, move on); a brand asset is the canonical logo file, meant to be looked up rather than stumbled across on a freeform board. Every upload gets a `group_id`; uploading a new version to an existing group increments `version` and keeps the old row (and its storage object) rather than overwriting anything — "what did this look like before" is real history without needing the full version-DAG machinery palettes use. Files live in the same `board-assets` bucket as everything else, under a `brand/{group_id}/` prefix, so no new storage policies were needed. See `supabase/brand-assets.sql`, `src/lib/supabase/brand-assets.ts`, and `src/app/assets/`.

---

## Phase 6 — Later

Deliberately deprioritised, not deleted:

- **Mood → palette** — type a feeling, get five colours retrieved from the 100K, each arriving with real meaning tags. Runs locally on Ollama, £0
- **Semantic tokens & contrast-first generation** — genuinely valuable for developer handoff, but this is a studio first and a compiler second. Demoted from "next" to "when handoff hurts"
- **Deeper print** — metamerism, ΔE tolerances, textile references. Gated on print becoming more than occasional
- **Ambient discovery** — daily colour, "colours you've never scrolled past", random walk
- **Palette critique** — automated design review

---

## Technical decisions that follow

1. **CMYK is hand-written** (~15 lines, no dependency) and labelled approximate in the UI
2. **`'print'` becomes a fourth gamut target**, so the print warning reuses tested gamut-mapping code
3. **`spectrum_index` column** on `colors`, backfilled once — makes 100K browsable at 60fps
4. **RLS on everywhere**, `auth.uid()`-scoped, per-request authenticated client
5. **Service-role key narrows** to ingestion scripts only
6. **Supabase Storage** for images and brand assets
7. **The version DAG stays**, re-surfaced as History. No git vocabulary in the UI

---

## Still open

- **The name.** PRISM remains a placeholder.
- **Deploy target** — Vercel, presumably, since it's now multi-user and needs to be reachable. Confirm.
- **Mockup fidelity** — stylised SVG/CSS to start, or invest in photorealistic composites?
- **Spectrum ordering** — hue → lightness → chroma is my default. Alternatives worth trying: lightness-major (bands of tone), or chroma-major (muted → vivid).

### ⚠️ `sharing.sql` needs one more re-run — a security review added a constraint

`schema.sql` and `storage.sql` are both confirmed live and correct as of 2026-07-22 — no action needed on either. You already ran `sharing.sql` once and it landed correctly (verified live: `board_shares` accepts inserts with the right columns).

Since then, a security review of the sharing feature (run before calling it done — this was the app's first unauthenticated route) came back clean on the important stuff — no IDOR, token entropy is fine, revocation works immediately — but flagged one real gap worth closing: nothing stopped two concurrent "Share" clicks from ever creating two live tokens for the same project, where the UI only shows and can revoke the most recent one. Fixed by adding a partial unique index — `board_shares_one_active_per_project_idx on board_shares (project_id) where revoked_at is null` — so the database itself guarantees at most one active share per project.

That's the only change. Re-run `supabase/sharing.sql` in full in the Supabase SQL Editor (idempotent, doesn't touch the RLS toggle) to pick up the new index.

Also fixed from that same review, no SQL involved: the repository functions a real signed-in user goes through (`createShareLink`/`getActiveShareLink`/`revokeShareLink`) now require the per-request client as a parameter instead of silently falling back to the service-role client if one was forgotten — a compile error beats a silent RLS bypass. Added basic security headers (`X-Frame-Options`, CSP `frame-ancestors`, `Referrer-Policy`) since `/share/[token]` is the first route with a bearer secret living in a URL.

### ⚠️ One more new file: `supabase/brand-assets.sql` — not yet run

Creates the `brand_assets` table (RLS-scoped via the same `is_project_member()` everything else uses) that `/assets` depends on. Doesn't touch the RLS toggle. Run it in the Supabase SQL Editor whenever convenient — until then, `/assets` will error on upload (the table it writes to doesn't exist yet), though the rest of the app is unaffected.

**Running order for a clean pass, if doing all three at once:** `schema.sql` → `storage.sql` → `sharing.sql` → `brand-assets.sql`. Each is independently idempotent; the order only matters because `sharing.sql` and `brand-assets.sql` both call `is_project_member()`, which `schema.sql`'s multi-user block + `enable-rls.sql` define.
