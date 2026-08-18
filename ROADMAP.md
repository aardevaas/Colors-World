# Colors World — Roadmap v5 (growth-framed, 2026-08-17)

> **Supersedes v4** (which superseded v3). v3 was organised by build phases.
> v4 reorganised around the five tabs. **v5 reorganises around the goal you
> actually stated: become one of the 100 fastest-growing GitHub repos for
> design, and be genuinely world-class.**
>
> That is not the same objective as "finish the five tabs," and sequencing work
> as though it were is the main risk right now. This document is ordered by what
> compounds, not by what is unfinished.

---

## The goal, stated plainly

1. **Top-100 fastest-growing GitHub repo in design.**
2. **World-class** — not "good for a solo project."

Everything below is judged against those two, and nothing else.

---

## 🔴 The uncomfortable part — read this first

**The current licence and the growth goal are in direct conflict.**

`LICENSE` is **PolyForm Noncommercial 1.0.0**. That is a *source-available*
licence, not an open-source one — it is not OSI-approved. `package.json` has no
`license` field at all, which is a separate inconsistency worth fixing either
way.

Your reason for choosing it is legitimate and I am not dismissing it: you said
you wanted it so people can't profit from your creation. That is a real risk and
PolyForm NC is a clean way to express it.

But it suppresses nearly every mechanism by which design repos actually grow:

| Growth mechanism | Effect under PolyForm NC |
|---|---|
| Company adoption → team stars, internal advocacy | Blocked — legal will reject it |
| Contributors | Chilled — their work can't be used commercially, yours can be relicensed |
| Ecosystem effects (fork, embed, package, extend) | Blocked |
| `awesome-*` lists, OSS newsletters, package registries | Frequently filter for OSI licences |
| Dependency adoption (`npm i …`) | Effectively dead |

The comparison set is unambiguous. shadcn/ui, Radix, Tailwind, Excalidraw,
Lucide, Framer Motion — the design repos that actually grew fastest — are
essentially all MIT/ISC/Apache. I know of no PolyForm-NC repo in the design
space that hit top-100 growth.

**Three ways to hold both goals at once, best first:**

1. **Split the licence — MIT the engine, protect the app.** ⭐ my recommendation.
   Publish `lib/color-engine` (and probably `lib/studio`) as MIT under
   `@colorsworld/engine`; keep the full application PolyForm NC.
   *Why this is the strongest option:* the thing most likely to make this a
   top-100 repo is **not the app — it's the engine.** A pure-TypeScript
   16.7M-colour arithmetic engine with OKLCH throughout, WCAG + APCA, gamut
   mapping across sRGB/P3/Rec2020, CVD simulation, and 500 tests is a genuinely
   rare dependency. People star dependencies they can build on. Almost nobody
   stars an app they're not allowed to use at work. This gets you real growth
   *and* keeps the product protected.
2. **AGPL-3.0.** Genuinely open source, but anyone running it as a network
   service must publish their source — which blocks the exact "someone clones it
   as a SaaS and profits" scenario you're guarding against. Grafana, Mastodon,
   and Nextcloud all use this reasoning.
3. **Keep PolyForm NC and accept a lower growth ceiling.** Entirely valid if
   protection matters more than reach — but then "top-100 fastest growing"
   should be retired as a goal rather than quietly missed.

**This is your call and I won't pick it for you — but it gates the whole
strategy, so it should be decided before, not after, the launch push.**

---

## What actually makes a design repo grow

Worth being blunt, because it changes the ordering below:

1. **A live URL you can try in five seconds, with no signup.** Non-negotiable —
   and ✅ **already true**: colors-world.vercel.app, with anonymous sessions so
   there is no signup wall. This is the hardest prerequisite and it is met.
2. **The README is the product page.** For most visitors it *is* the product.
   Ours has good bones (founder letter, tab-by-tab) but **no screenshots, no
   demo GIF**, and it still describes tabs by their retired names ("The
   Spectrum", "Scale Lab") that no longer match the routes.
3. **Shareable output is the growth loop.** The watermarked PNG export and
   `/share/[token]` links are already built — every exported board is an
   impression. That loop only runs once the app is live.
4. **Depth beats breadth.** Three exceptional tabs will outperform five average
   ones. The engine is genuinely differentiated; a half-polished fifth tab is
   not.
5. **Launches are events, not states.** You get roughly one good shot per
   milestone at HN / Product Hunt / Designer News. Spending it on a product with
   a login wall and no demo wastes the shot.

---

## Where we actually are — verified live, 2026-08-17

| | |
|---|---|
| Tabs built | 3 of 5 (`/library`, `/builder`, `/studio`) |
| Tests | 500 passing, 54 files, `tsc` clean, production build clean |
| Live data | 100,000 colour rows · 6 profiles · 1 project |
| **Deployed** | ✅ **Live** — [colors-world.vercel.app](https://colors-world.vercel.app), GitHub→Vercel auto-deploy on every push to `main` |
| README | No demo media; tab names stale |
| Licence | PolyForm NC (see above) |
| `/studio` live verification | **Still blocked** — one SQL run outstanding |

### Blockers resolved today
- ✅ `palette_versions.builder_specs` migrated — version writes work again
  (verified end-to-end, including a real `builder_specs` write).
- ✅ Anonymous sign-ins enabled — verified issuing sessions.

### Blocker still open — needs one run from you
- 🔴 **`supabase/policies.sql`** — the live database has RLS on but is missing
  the `projects_insert` policy, so every anonymous visitor hits
  `new row violates row-level security policy for table "projects"` the moment
  `/studio` provisions their project. **The zero-signup-wall promise is still
  broken until this runs.**

  Root cause, worth recording: `enable-rls.sql` opens with a one-time bootstrap
  that `raise exception`s unless exactly one profile exists. Correct guard —
  but it means that past the first user the file cannot be run at all, because
  the exception aborts the script before any policy statement executes. The
  policies then drift from the repo with nothing able to re-apply them.
  `policies.sql` is the policy layer alone: idempotent, no bootstrap, safe at
  any user count.

---

## The critical path

Ruthlessly ordered by what compounds. Steps 1–4 are, I'd argue, worth more than
Tabs 04 and 05 combined.

### 0 · Unblock — ✅ done 2026-08-17
`policies.sql` run; anonymous sign-in, project self-provisioning and the full
RLS chain verified live. `/studio` verification pass completed — it found a
severe pointer-capture bug that had made every HUD control dead to real mouse
input, plus three layout/UX defects. All fixed, shipped, and confirmed in
production.

### 1 · Deploy — ✅ already done, and I was wrong about this
**Correction (2026-08-17):** an earlier revision of this document claimed
"nothing is deployed" and made deploying the single highest-leverage item. That
was false. The GitHub repo has been connected to Vercel with auto-deploy since
2026-07-25; **[colors-world.vercel.app](https://colors-world.vercel.app) is live
and every push to `main` ships automatically.** The error came from checking for
a local `.vercel` link and the Vercel CLI — neither of which exists when
deployment runs through the GitHub integration — instead of checking Vercel
itself. Recorded rather than quietly edited out, because the whole v5 ordering
was built on it.

The growth loops (share links, watermarked PNG exports, "try it in five
seconds") are therefore **already running**. What they lack is anyone pointed at
them — which moves the README, not the deploy, to the top of the list.

### 2 · Decide the licence 🔴 now the highest-leverage open decision
See above. It determines whether the remaining steps are worth doing at full
intensity, and it is the one thing that structurally caps growth.

### 3 · Make the README world-class
The single highest-ROI artefact for GitHub growth.
- A demo GIF above the fold — the globe assembling, or a palette dragged onto a
  board. This is what makes someone stop scrolling.
- Fix the stale tab names (`Spectrum`/`Scale Lab` → `Library`/`Builder`).
- Lead with the genuinely rare thing: **16.7M colours computed arithmetically,
  not stored.** That's the hook, and right now it's buried.
- Live demo link, badges, contribution pointers.

### 4 · Finish the landing page
It stops dead after the globe. The unbuilt sections include the
**open-source credibility strip** (live star count, licence badge, contributor
avatars) — which is precisely the section that converts visitors into
stargazers.

### 5 · Then Tab 04 `/visualizer`
Completes the palette → UI → audit → export loop, the most defensible product
story. `/studio` already deferred its live-UI-preview nodes here, so it has a
dependency waiting.

### 6 · Tab 05 `/typography`
The `queryLocalFonts()` approach is elegant — $0 hosting, zero copyright
exposure. Worth building, but it is the fifth-most-important thing here, not
the next thing.

### 7 · The V2 audit
The consolidated cross-tab pass, once all five V1s exist:
- **Shared `<TabNav>` shell.** Navigation is hand-rolled four times with four
  different link sets; no tab links to all five, and Tabs 04/05 have nowhere to
  appear. This violates the locked "shell stays structurally constant" decision.
- **`/merge`** — orphaned, zero inbound links, unreachable, still ships 129 kB.
- **`/palettes` and `/assets`** — pre-tab-era surfaces, conceptually homeless.
- **`/spectrum`, `/scale-lab`** — redirect stubs; keep or drop before launch.
- Accessibility, performance, visual consistency across tabs.

---

## An argument for doing fewer things better

The instinct will be to finish all five tabs before launching. I'd push back.

Right now you have **three tabs that are genuinely good and one hard technical
differentiator nobody else has.** Shipping that, live, with a world-class README
and a working demo, is a stronger position than five tabs nobody can reach.

Tabs 04 and 05 are also the two most likely to feel thin on a first pass —
`/visualizer` needs bespoke, pixel-perfect UI templates, and `/typography` needs
real type craft. Rushing them to say "five of five" is exactly how a product
ends up broad and average instead of narrow and world-class.

**Ship three, be excellent, then expand in public** — where each new tab is its
own launch moment rather than one big anticlimactic reveal.

---

## Needs your call

1. **Licence** — split MIT engine / protected app (recommended), AGPL, or keep
   PolyForm NC and retire the top-100 goal?
2. **Launch timing** — ship at three tabs (recommended) or hold for five?
3. **`/palettes` and `/assets`** — fold into the tab model, keep as secondary
   routes, or retire?
4. **`/merge`** — wire into a real history UI, or delete the route?
5. **Hosted vs self-host** *(carried unresolved since v3)* — shapes auth, rate
   limiting, abuse handling, and how the Gemini vibe-search key is managed.
6. **Library/Spectrum ordering** *(carried since v3)* — hue-major is the only
   implemented ordering and reads as a colour-professional's model, not a
   browsing-for-inspiration one. More orderings are cheap; which ones?

---

## Known scaling consideration, flagged not solved

Every anonymous visitor now gets a real session, and `/studio` provisions a
`projects` + `project_members` row per visitor on first view — permanently. At
10 known users, irrelevant. At launch traffic, it is an unbounded write vector
for any crawler. Options when it matters: provision lazily on first *write*,
reap empty anonymous projects after N days, or gate `/studio` behind a real
account while `/library` and `/builder` stay open. Documented in
`supabase/policies.sql` so it stays a decision rather than a surprise.

---

## Verification standard

Pure logic in `lib/` with unit tests · UI verified live in a browser · `tsc`
clean · full suite green · production build clean, before anything is called
done.

**`/studio` is the one current exception** — 500-test coverage and a clean
build, but its live browser pass has never run because the database was
unreachable, then misconfigured. Step 0 closes that.
