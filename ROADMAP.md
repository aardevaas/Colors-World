# Colors World — Roadmap v3 (reframed 2026-07-23)

> **This document replaced an earlier version.** The first roadmap optimised for engineering rigour — design-system compilation, git-style version control, spec-driven token generation. That was the wrong product. v2 corrected that. **v3 changes the audience and the ambition**: this is no longer a private tool for ~10 people — it's meant to become the best open-source, free website for color, palettes, branding, and typography, built in the open for the community to use and contribute to. Working name locked: **Colors World**.

---

## The vision

**A creative studio for colour and brand — where 100,000 colours are a world you explore, and your dashboard is your studio wall.** Open-source, free, built for designers and marketers first — not color-tooling professionals.

Exploratory, artistic, visual, inspiring. The rigour stays, but as *invisible infrastructure* that quietly stops you making mistakes — never as the thing you interact with.

Reference points: the speed and joy of **Coolors**, the craft of **Radix**, the visual ambition of **opencolors.org** — fused, and then pushed past all three.

**Who it's for, and the thing this changes:** the app was designed and built through Phase 5 for "~10 people, private by default, shared deliberately" — real accounts, real project-scoped RLS, a handful of known users. The new goal (public, free, community-run, 10k GitHub stars) is a genuinely different shape: an *open-source codebase anyone can run* is not automatically the same thing as *a public multi-tenant service anyone can sign up to*. Those need different things from the accounts/RLS layer — self-hosting needs none of today's multi-tenancy at all, while a public hosted instance needs it to scale far past 10 known people (arbitrary public signups, abuse handling, quotas). **This hasn't been resolved yet — flagging it here rather than quietly picking one.** Worth an explicit call before Phase 6 goes much further: is the plan (a) primarily an open-source project people self-host, (b) a free hosted instance you run for the community, or (c) both? The Phase 6 items below are written assuming the codebase stays useful either way, but "both" has real design consequences (e.g. a mood-to-palette feature calling an external AI API needs a per-user key story if this is self-hosted, or your own quota/rate-limiting if it's a hosted public service).

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

## Phase 2 — The Spectrum ⭐ rebuilt 2026-07-23: 100K curated → 16.7M computed

_The signature feature. Nobody else has this._

**Rebuilt from the ground up.** The original version browsed the 100,000-row curated `colors` table via a precomputed `spectrum_index` DB column. Per direction from 2026-07-23: this is "purely a design/colours tool" — names and meaning tags don't matter here, only the values, and the ambition is the *entire* 8-bit-per-channel space (16,777,216 — "16.7 million" — colours), not a curated subset. Storing 16.7M rows would be pure redundancy (every value is 100% derivable from its own coordinates) and would make the app slow and expensive to host. **The fix: don't store it, compute it.** See `src/lib/spectrum/generate-color.ts` — the whole 16.7M-colour space is a pure function, zero database calls, zero storage, arithmetic that runs in microseconds.

- **Sticky header** tells you where you are — "violets — 8,438,518 of 16,777,216"
- **Instant filters** collapse the field — pastels only, vivid only, one hue family, light or dark — now a plain in-memory predicate over generated colours, not a SQL query
- **Heart as you go** — saved colours collect in a tray, pin-to-Studio-Wall from there
- **Detail on click** — full HEX/RGB/OKLCH/CMYK values, gamut/print warnings — no name, no meaning tags, values only

The 100K curated, named library (`/library`, with emotion/mood/category search) **still exists, untouched** — it's just no longer part of the Spectrum browsing experience.

### Technical approach

The 16.7M-colour space is a 3-axis grid — lightness × hue × chroma, 256 steps each (256³ = 16,777,216, matching "16.7 million" exactly) — packed into a single 24-bit index, the same way RGB itself packs three 8-bit channels into 24 bits. `indexToSwatch(index)` decomposes the index and reuses the existing (tested) `maxChroma()` gamut logic to produce a real, displayable sRGB colour — O(1), no lookup table.

**Axis order was a deliberate design call, not the professional default.** Hue-major (the original ordering) reads as a colour-wheel — exactly the "for professionals, not marketing/design people" feel flagged as wrong. The rebuild makes **lightness the outer axis** (broad light→dark bands — "something light for the background," "something dark for the footer," which is how brand/marketing work actually thinks about colour), **hue the middle axis** (a recognisable rainbow sweep within each lightness band), **chroma the innermost axis** (muted→vivid). Changing the feel of the whole Spectrum later is changing which axis nests where in one formula — not a data migration, since nothing is stored.

**Virtualization at this scale needed one real fix beyond the original 100K design**: a literal `totalRows * rowHeight` CSS height would be tens of millions of pixels — past Chromium's/Firefox's ~33.5M px max element height, past which layout silently breaks. The scrollable track is capped at a constant (6,000,000px) and scroll position is read back as a *fraction* of that track rather than a pixel-exact row index — the scrollbar becomes a coarse "jump to this general area" control at this scale, which is correct: nobody scrolls pixel-by-pixel through 16.7 million colours anyway.

Compare: Coolors gives you five colours at a time. Radix gives you twelve hues, take them or leave them. Nobody lets you browse the entire colour space, computed, for free.

---

## Phase 3 — Accounts & projects

_Now there's something worth saving._

- **Supabase Auth** — **rebuilt 2026-07-23**: password (sign up / sign in) and Google/GitHub OAuth are now the primary paths; magic-link is a secondary option, collapsed behind a toggle on the login page
- **Projects** — each with its own boards, palettes, and assets
- **Private by default**, shared deliberately per your call

### ⚠️ Why magic-link stopped being the default

Magic-link was the right call for "~10 people, business and family" — no password to forget. It stopped being the right call the moment this became a public, free, open-source tool anyone can sign up to: Supabase's own mail sender caps out at **2 emails/hour** by default, and even custom SMTP (Resend, etc.) is still one more account the user has to set up before anyone else can sign in at all. That's a real barrier to "100% free to access."

**Password + OAuth sidestep the mail dependency entirely.** Google/GitHub OAuth never sends an email — the provider vouches for identity directly. Password sign-up only needs mail if Supabase's **"Confirm email"** setting (Authentication → Providers → Email) is left on; turning it off makes account creation instant with zero mail involved, at the cost of not verifying the address belongs to the signer-upper (a reasonable trade for a community tool, not a bank).

**Setup still needed, external to this codebase (can't be done by me — these are your accounts):**
1. **Google OAuth**: Google Cloud Console → create an OAuth 2.0 Client ID (Web application) → Authorized redirect URI `https://oyoxodtrthufczmbfows.supabase.co/auth/v1/callback` → paste the Client ID/Secret into Supabase → Authentication → Providers → Google → enable
2. **GitHub OAuth**: GitHub → Settings → Developer settings → OAuth Apps → New OAuth App → Authorization callback URL `https://oyoxodtrthufczmbfows.supabase.co/auth/v1/callback` → paste Client ID/Secret into Supabase → Authentication → Providers → GitHub → enable
3. Optionally: Authentication → Providers → Email → toggle off **"Confirm email"** for frictionless password sign-up

`src/app/auth/callback/route.ts` needed **no changes** — it already exchanges an auth code for a session generically (`exchangeCodeForSession`), which is exactly how magic-link, password-confirmation, and OAuth all land.

### Anonymous sign-ins — **added 2026-07-23**: browse and collect with zero signup wall

Every visitor now gets a real Supabase session automatically (`supabase.auth.signInAnonymously()` in `src/middleware.ts`, run whenever `getUser()` comes back null) — no account, no click, no friction. It's a real `auth.uid()`, so every existing RLS policy and the `resolveDefaultProjectId` auto-provisioning just work, unmodified. Saving a palette, board, or asset works immediately; creating an account is only needed to keep that work past the current browser/device.

**Upgrading is in-place, not a fresh account.** Signing up with a password (`passwordAuthAction`) or linking Google/GitHub (`signInWithOAuthProvider`) while the current session is anonymous calls `supabase.auth.updateUser()` / `linkIdentity()` on that *same* session instead of creating a disconnected new one — so `auth.uid()` never changes, and everything already saved carries over automatically. Falls back to normal `signUp`/`signInWithOAuth` once the visitor already has a real, non-anonymous session (i.e., they're not upgrading, just switching accounts).

**Setup still needed, external to this codebase:**
1. Supabase → Authentication → Sign In / Providers → enable **"Allow anonymous sign-ins"**
2. Supabase → Authentication → Providers → toggle on **"Enable Manual Linking"** (required for `linkIdentity()` to attach OAuth to an anonymous session instead of erroring)
3. `supabase/schema.sql` needs re-running: `profiles.email` is now nullable (anonymous users have no email) — the file is idempotent, safe to run again in the SQL Editor

**Known trade-off, accepted for now, not yet built:** Supabase's own docs recommend pairing anonymous sign-ins with CAPTCHA (hCaptcha/Turnstile via Authentication → Attack Protection) to stop bot-driven mass account creation. Skipped for launch since it adds a dependency and friction of its own — revisit if abuse shows up in practice.

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

## Phase 6 — revised for the open-source pivot (2026-07-23)

Priorities changed now that the audience is "anyone," not ~10 known people:

- **Mood → palette** — type a feeling, get five colours retrieved from the 100K, each arriving with real meaning tags. **Changed: Google AI Studio (Gemini) instead of local Ollama** — free tier, no local model to run or GPU to own, and it works identically for every visitor regardless of their own hardware, which local Ollama never could for a public/community tool. Needs: a `GEMINI_API_KEY`, a prompt that returns exactly 5 hex/name pairs (not freeform text), and a decision on the self-host-vs-hosted question above — a self-hoster brings their own key; a hosted public instance needs the app's own key plus rate-limiting so one visitor can't exhaust the shared quota.
- **Semantic tokens & contrast-first generation** — **un-demoted.** Previously deprioritized as "studio first, compiler second" for a private tool; a real open-source dev-tooling audience makes this genuinely load-bearing again — token export/contrast-first generation is exactly the kind of feature that gets an OSS color tool used (and starred) by working developers, not just designers. Moving this back into active consideration for Phase 6 proper, not "later."
- **Deeper print** — **elevated, not deprioritized.** Original gate was "when print becomes more than occasional" — for a public tool serving marketing/brand/print-adjacent users at scale, it already is. Perfecting this (metamerism awareness, real ΔE tolerances instead of the current pseudo-gamut approximation, textile reference data) is now a priority, not a someday item. The current `'print'` pseudo-gamut (a 12-hue chroma-retention table) is a reasonable first pass but was explicitly built as an approximation — worth revisiting with real press/textile reference data once prioritized.
- **Ambient discovery** — daily colour, "colours you've never scrolled past", random walk. Unchanged, still later.
- **Palette critique** — automated design review. Unchanged, still later.
- **Bulk font upload** — see the licensing note below before any code gets written here.

### ⚠️ Bulk font upload — needs a real answer before this gets built, not just code

The ask: bulk-upload a large personal collection of downloaded fonts so typography pairing isn't limited to the 8 curated Google Fonts pairs. **This is the one item in this whole message I'm not just going to implement as asked**, and here's why: fonts you've "downloaded over the years" are, for the overwhelming majority of real-world font collections, **not freely redistributable** — most retail/commercial fonts (Adobe Fonts, most foundry-licensed faces, many "free download" sites hosting non-libre fonts) explicitly prohibit redistribution, and a good chunk of any large personal collection is typically fonts that were never properly licensed for that at all. For a *private, 10-person* tool this was a low-stakes personal risk. For a *public open-source repo aiming for 10k stars*, bulk-committing someone's personal font stash would put genuinely infringing files into a public git history from day one — the opposite of what an open, credible community project can survive.

**What's safe and what isn't:**
- **Safe to bulk-add:** fonts explicitly licensed for redistribution — SIL Open Font License (OFL) fonts (the license nearly all of Google Fonts uses), Apache-2.0-licensed fonts, public domain faces. [Fontsource](https://fontsource.org/) and the Google Fonts GitHub repo are good bulk sources of exactly these, with license metadata already attached per font.
- **Not safe to bulk-add:** anything from a personal download folder without first checking each one's actual license — "I downloaded it" and "I'm allowed to redistribute it" are unrelated facts.

If you want a much bigger font library than today's 8 pairs, tell me and I'll build proper support for it — but sourced from an OFL/Apache bulk set (hundreds of real options, zero legal risk), not your personal downloads folder as-is. If some fonts in your collection are ones you specifically know are OFL/Apache/public-domain (e.g. you downloaded them directly from Google Fonts or Fontsource), point me at those and they're fine.

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

## Resolved 2026-07-23

- **The name.** **Colors World.** Repo live at [github.com/aardevaas/Colors-World](https://github.com/aardevaas/Colors-World), rebranded throughout the UI.
- **Deploy target.** **Vercel**, confirmed. GitHub repo pushed; Vercel import is a manual step in the dashboard (see the SQL/deploy note further down) since it needs your own login and your Supabase secrets typed directly into Vercel's UI, not relayed through me.
- **Mockup fidelity.** **Stylised SVG/CSS**, confirmed — no photorealistic composites for now.

## Still open

- **Spectrum ordering — needs a real rethink, not just a tweak.** Hue-major (today's default and only implementation) reads as a color-professional's ordering, not what a marketing/design person browsing for brand inspiration actually wants. Two paths, not mutually exclusive:
  1. **Pick a better single default.** Candidates: lightness-major (light-to-dark bands, reads as "mood" more than "hue wheel"), chroma-major (muted → vivid, reads as "intensity"), or something more editorial entirely (e.g. grouped by the existing `emotion`/`mood`/`category` tags already in the color data, so browsing feels like exploring themes instead of a spectrum).
  2. **Offer a picker between several precomputed orderings.** Technically: today there is exactly *one* `spectrum_index` column, computed once for hue-major. Supporting multiple orderings the user can switch between means either (a) one additional integer column per ordering, each independently backfilled and indexed the same way `spectrum_index` is today — cheap in storage, instant either way since it's still `WHERE index BETWEEN x AND y` — or (b) computing order on the fly with a live `ORDER BY`, which won't hold up at 100K rows with the same "jump anywhere instantly" guarantee the current design has. (a) is the right approach if multiple orderings ship.
  
  This needs your call on which ordering(s) actually feel right before I build multi-ordering support blind — happy to mock up 2-3 candidate orderings from the existing data for you to eyeball once you're back with testing notes.

- **Open-source vs. hosted-service question** (see "The vision" above) — self-host-only, a hosted public instance, or both. Shapes the Gemini mood-to-palette design and any future rate-limiting/abuse-handling work.

### ⚠️ `sharing.sql` needs one more re-run — a security review added a constraint

`schema.sql` and `storage.sql` are both confirmed live and correct as of 2026-07-22 — no action needed on either. You already ran `sharing.sql` once and it landed correctly (verified live: `board_shares` accepts inserts with the right columns).

Since then, a security review of the sharing feature (run before calling it done — this was the app's first unauthenticated route) came back clean on the important stuff — no IDOR, token entropy is fine, revocation works immediately — but flagged one real gap worth closing: nothing stopped two concurrent "Share" clicks from ever creating two live tokens for the same project, where the UI only shows and can revoke the most recent one. Fixed by adding a partial unique index — `board_shares_one_active_per_project_idx on board_shares (project_id) where revoked_at is null` — so the database itself guarantees at most one active share per project.

That's the only change. Re-run `supabase/sharing.sql` in full in the Supabase SQL Editor (idempotent, doesn't touch the RLS toggle) to pick up the new index.

Also fixed from that same review, no SQL involved: the repository functions a real signed-in user goes through (`createShareLink`/`getActiveShareLink`/`revokeShareLink`) now require the per-request client as a parameter instead of silently falling back to the service-role client if one was forgotten — a compile error beats a silent RLS bypass. Added basic security headers (`X-Frame-Options`, CSP `frame-ancestors`, `Referrer-Policy`) since `/share/[token]` is the first route with a bearer secret living in a URL.

### ⚠️ One more new file: `supabase/brand-assets.sql` — not yet run

Creates the `brand_assets` table (RLS-scoped via the same `is_project_member()` everything else uses) that `/assets` depends on. Doesn't touch the RLS toggle. Run it in the Supabase SQL Editor whenever convenient — until then, `/assets` will error on upload (the table it writes to doesn't exist yet), though the rest of the app is unaffected.

**Running order for a clean pass, if doing all three at once:** `schema.sql` → `storage.sql` → `sharing.sql` → `brand-assets.sql`. Each is independently idempotent; the order only matters because `sharing.sql` and `brand-assets.sql` both call `is_project_member()`, which `schema.sql`'s multi-user block + `enable-rls.sql` define.

---

## Phase 7 — UX/UI overhaul: the landing page (started 2026-07-23)

**The problem this fixes:** there was no landing page. `/` was the Studio Wall app itself — a visitor's very first interaction with a brand-new, empty canvas, with nothing sold to them first. For a tool asking strangers to star a repo and stick around, that's backwards. First fix, structural, done immediately: **Studio Wall moves to `/studio`**; `/` is now reserved for a real marketing page, built independently in a `design/landing-page` branch so the live app isn't disrupted mid-redesign.

Section build order (one at a time, reviewed before moving to the next):

1. **Hero** — the reveal. Kinetic, colour-driven, built directly on top of the real 16.7M-colour arithmetic engine (not stock imagery) so the product's core differentiator is the first thing anyone sees moving.
2. **Live showcase** — an embedded, genuinely interactive mini-demo, not a screenshot or video — try the color engine before signing up for anything.
3. **Feature bento grid** — the pillars (colour engine, Studio Wall, Scale Lab, typography pairing, brand assets, sharing) as an editorial layout with real hierarchy, not a uniform card grid.
4. **Open-source credibility strip** — live GitHub star count, MIT badge, contributor avatars. This is the section that actually matters for the 10k-star goal — social proof converts lurkers into stargazers faster than any feature copy does.
5. **Scrollytelling deep-dive** — one flagship feature (likely the colour engine or Studio Wall) gets a scroll-driven animated walkthrough.
6. **Closing CTA + footer.**

### Why a separate visual language from the app shell

The existing app (Studio Wall, Spectrum, Scale Lab) deliberately reads as a *quiet instrument* — near-black, no display font, hairline rules, numerics in mono — so computed colour is the only saturated thing on screen. That's correct for a tool you use for hours. It is the wrong register for a landing page whose entire job is to make a stranger stop scrolling in the first second. The landing page gets its own, louder visual identity (kinetic colour, a real display typeface, motion) that hands off into the calmer app once someone's actually in it — same product, two different jobs.

### Section 1 — Hero, built

- `Unbounded` (via `next/font/google`, self-hosted at build time — no extra runtime request) as the one display typeface for the oversized headline; body copy stays on the existing system stack, keeping the "max two font families" budget.
- A cursor-reactive OKLCH gradient-blob field behind the copy — three blurred radial blobs whose position tracks the pointer via CSS custom properties updated on `mousemove`, animated only on `transform` (compositor-safe, no layout cost).
- An infinite marquee of real, computed Spectrum swatches (`indexToSwatch` — the actual arithmetic engine, not a hardcoded palette) scrolling behind/below the headline — the product's core differentiator, visible in the first second, not explained in a bullet point three scrolls down.
- A magnetic CTA button (nudges toward the cursor on hover, `transform` only) into `/studio`.
- Full `prefers-reduced-motion` fallback — every animation freezes to its resting state; the marquee and blob field are decorative, never load-bearing for comprehension.
- "Built by: aardevaas" credit line under the sub-copy, linking to the GitHub profile, with a pulsing glow on the icon.

### Section 2 — the rain-to-globe set piece, built

Below the Hero: each of the marquee's 32 hues is a "faucet" — `buildRainBlockSeeds` expands it into 12 real shade variants (same arithmetic engine, `composeIndex`/`indexToSwatch`), interleaved round-robin so every hue rains concurrently rather than hue-by-hue. Spawn rate and rain-vs-globe phase are both driven by scroll depth into the section, not time.

Past ~55% scroll, physics freezes — each block's last physics position becomes its migration start — and every block eases onto an assigned point on a sphere via hand-rolled 3D→2D perspective projection (`sphere-projection.ts`, plain trigonometry on the same canvas, no WebGL): longitude = source hue, latitude = shade, so the assembled globe reads as colour-banded meridians. Further scroll keeps rotating it. A block that never got to fall before the cutoff still joins from the globe's centre with a delayed arrival — no colour family is silently dropped just because someone scrolled fast.

`sphere-projection.ts` and `color-rain-variants.ts` are pure and unit-tested (11 new tests) — this is the one part of the landing page with real automated coverage rather than only visual verification.

Not yet built, and a deliberate stopping point until there's direction on it: drag/pointer-driven rotation once the globe has formed, and whatever comes after ("where these end up," per the brief) — the globe currently just rotates with continued scroll and the section ends.
