# Colors World — Architecture

_Design reasoning and the decisions behind the engine. "PRISM" was the working
name and is retired; the product is Colors World._

> **This is a design document, not a status report.** Its later sections are a
> chronological build log from July 2026 and its §9 "Roadmap" and §10 "running
> total" are both superseded — they described a five-tab product.
>
> For what exists today: [`docs/AUDIT-2026-08-23.md`](docs/AUDIT-2026-08-23.md).
> For what happens next: [`ROADMAP.md`](ROADMAP.md).

---

## 1. What the three inspirations actually give us

I inspected all three before designing anything. Two of them are not quite what the brief assumed.

| Source | What it really is | License | What we take |
|---|---|---|---|
| **Open Color** (`yeun/open-color`) | 13 hand-picked hues × 10 steps (0–9). Hand-tuned, not generated. Ships `.ase`, `.aco`, `.sketchpalette`, `.gpl`, `.clr`, Figma, VS Code snippets. | **MIT** | The *discipline*: fixed hue set, 0–9 scale, harmony across hues. We reimplement the idea algorithmically rather than copying values. |
| **opencolors.org** | A different project entirely — 16.7M-color globe, brand registry, WCAG/CVD tooling. | Unstated | The **registry concept** and the CVD/contrast tooling. Not the globe. |
| **Color-Pedia** (`boltuix/color-pedia`) | **100,000 rows** (card says ~50K), 17 columns: Name, HEX, Category, Description, Emotion, Personality, Mood, Symbolism, Use Case, Keywords, R/G/B, H/S/L, Contrast Level. Parquet, 14.8 MB. | **MIT** | The entire semantic layer — ingested as **seed** provenance, never presented as verified fact. |
| **color-datasets** | `pip install color-datasets`, 16 Zenodo datasets: Munsell spectral, illuminants, ColorChecker, corresponding-color experiments, camera sensitivities. | **BSD-3-Clause** | Spectral ground truth for print/textile accuracy. **No emotion or culture data whatsoever.** |

**On Color-Pedia's honesty.** It is tagged `eco-ai` with no citations and reads as LLM-generated in bulk. It is a superb *starting corpus* and a poor *authority*. Every row lands with `provenance: 'seed'`; you promote rows to `'curated'` as you verify them. The UI must show that distinction, or the platform quietly launders generated text into expert claims.

**On the Pantone repo.** `AZ-597/PANTONE-ColorLibraries` has **no LICENSE file** and its README states the files were *"downloaded with Pantone Color Manager"* — Pantone's own proprietary `.acb`/`.ase` books, re-uploaded. Default copyright is all-rights-reserved. Pantone pulled its libraries from Adobe in 2022 specifically to monetise this.

The design response is architectural, not moralising:

- Pantone support ships as a **local reference pack** you load yourself — a file you point the app at, resolved at runtime into your local database. Nothing Pantone-derived lives in the repo, in git, or in any deployment.
- The app's own Pantone-nearest-match runs off the **spectral data from `color-datasets`** plus community-compiled approximations, and is labelled *approximate — not color-certified*.
- If you ever need certified print-exact matching for a production garment run, that is a Pantone Connect licence. A business decision, not an engineering blocker.

You get the workflow. The repo stays clean.

---

## 2. Stack

| Layer | Choice | Why |
|---|---|---|
| App | **Next.js 15 (App Router) + React 19 + TypeScript** | Vercel-native, server routes for the Ollama proxy and ingestion. |
| Color maths (runtime) | **culori** | Tree-shakeable, OKLCH-native, implements CSS Color 4 gamut mapping. Small enough for the bundle budget. |
| Color science (build time) | **Python `color-science` + `color-datasets`** | Spectral work, CMYK profiles, Pantone approximation. Runs **offline as a build step** that emits static JSON — full scientific rigour, zero Python at runtime. |
| Storage | **Supabase Postgres** + `pgvector` | Relational for the version DAG, JSONB for snapshots, vectors for semantic color search. |
| Auth | **None (v1)** | Single user. Adding auth later is additive; building it now is pure overhead. |
| AI | **Local Ollama**, provider-swappable | $0. Verified running on `:11434`. |
| Canvas | **DOM + CSS transforms**, virtualised | See §5 — this is a deliberate and slightly contrarian call. |

### Why the science layer is a build step, not a service

`color-datasets` is Python; the app is TypeScript. Rather than run Python on Vercel or port spectral maths to JS, a script ingests the Zenodo datasets once and emits a compact lookup table. Rigour where it matters, no runtime dependency, no cold starts.

---

## 3. The color model

**Canonical storage is OKLCH. Everything else is a projection.**

Hex is lossy above sRGB. Storing hex as the source of truth silently destroys wide-gamut color the first time anything round-trips. So `Oklch` is the only stored form; hex, sRGB, P3, CMYK and Pantone are all derived on demand.

### Scale generation — the part that took the most thought

Open Color's scales are hand-tuned. Ours are generated, which means the generator has to earn its keep.

**Lightness** runs through monotone cubic Hermite interpolation (Fritsch–Carlson) across your pinned anchors. A natural spline would overshoot and produce a "lighter" step that is actually darker than its neighbour — that reads as a bug in a tonal ramp. Fritsch–Carlson makes overshoot mathematically impossible.

**Chroma is expressed as a fraction of the chroma the gamut can actually deliver at that lightness and hue** — not as an absolute value, and not via an analytic falloff curve.

This is the single most important decision in the engine, and I got it wrong on the first pass. The first version used a fixed bell curve peaking at mid-lightness. It produced *plausible* scales, but flagged 6 of 10 steps as gamut-clamped, because a fixed curve over-asks near white for hues that cannot hold chroma there. Measured result after the rework, both anchors at identical 97.1% lightness, both with zero clamping:

```
blue   #3b82f6  → step 0 chroma 0.0126
yellow #f5d90a  → step 0 chroma 0.0619   ← 4.9× more
```

That asymmetry is real — sRGB holds far more yellow than blue near white — and a hue-agnostic curve cannot express it. Riding the gamut boundary proportionally makes the ramp hue-adaptive for free, and means a generated step never needs rescuing by the gamut mapper afterwards.

**Anchors are absolute.** A pinned step returns your exact color, byte for byte. That is the "algorithm-with-override" contract, and it is enforced by test.

**Hue torsion** is centred on the primary anchor, so rotating the ends never creates a kink at the pinned step.

**Gamut mapping** reduces chroma while holding lightness and hue. Per-channel RGB clipping — the common shortcut — shifts hue, so a vivid orange clips toward yellow and quietly breaks the scale.

### Contrast: both numbers, deliberately

WCAG 2.x contrast is what you cite for compliance. It is also known to misjudge dark backgrounds. APCA models perception better but is still a W3C draft.

So the engine reports **both**: the WCAG ratio as the compliance number, APCA `Lc` as perceptual advisory. Reporting only one is a defensible choice; reporting neither's limitations is not.

_(Note: WCAG 2.2 did not change the contrast arithmetic from 2.0/2.1. Its additions are focus appearance and target size. The version number is about which criteria you claim, not different maths.)_

---

## 4. Versioning — true branch and merge

You asked for real branching. Here is what that means concretely.

```
palette_version (id, palette_id, parent_ids uuid[], message, created_at, snapshot jsonb)
palette_branch  (id, palette_id, name, head_version_id)
```

- `parent_ids` is an **array** — two or more parents is a merge commit. That single column is what makes this a DAG rather than a list.
- Merging finds the **lowest common ancestor** of two heads, then does a three-way merge per token. A conflict is: both branches changed the same token, differently, relative to the base.
- **Snapshots, not deltas.** Palettes are kilobytes. Delta storage is premature optimisation; snapshots make history reads trivial and time-travel free.

**Where this beats git.** A text VCS can only tell you `#3b82f6` became `#4b7fe8`. A color-aware diff decomposes the change into ΔL / ΔC / ΔH plus a perceptual ΔE-OK magnitude, so the diff reads *"3.2 ΔE — almost entirely a hue shift toward warm"*. Conflict resolution shows base / ours / theirs as swatches with a blend slider, instead of `<<<<<<<` markers. This is the feature most worth building well; nothing else on the market does it.

---

## 5. The canvas — a contrarian call

The obvious choices are tldraw (heavy, licence key for commercial use), Konva, or PixiJS/WebGL.

**I recommend DOM + CSS transforms with virtualised rendering, and upgrading to WebGL only if we hit a wall.**

The reason is specific to a *color* tool: **CSS `oklch()` renders in Display P3 natively on capable screens, while a 2D canvas is sRGB unless you explicitly configure `colorSpace: 'display-p3'`.** For a tool whose entire premise is color fidelity, rendering through the DOM is *more accurate*, not merely simpler. It also keeps motion on `transform`/`opacity` — compositor-friendly by construction.

If the canvas ever exceeds ~2,000 simultaneous nodes, we revisit with PixiJS and explicit color-space management. Not before.

---

## 6. Knowledge graph

```
kg_node (id, type, label, provenance, confidence, embedding vector)
kg_edge (id, source_id, target_id, relation, weight, provenance, citation)
```

Node types: `Color`, `Emotion`, `Culture`, `ArtMovement`, `Material`, `Sensory`, `UseCase`.

Color-Pedia's 100K rows explode into nodes and edges on ingest. Emotion/Mood/Symbolism/Personality/UseCase/Keywords each become typed edges — that is roughly 600K edges from the seed alone.

Explanations are **read from data, not generated** — your call, and the right one. Zero AI cost, zero hallucination, instant. Embeddings (via Ollama's `nomic-embed-text`, local and free) are computed **once at ingest**, enabling "find colors that feel like this" as a vector query with no model call at read time.

---

## 7. AI generation — free, local, swappable

Verified running: Ollama 0.31.2 on `localhost:11434`, with `deepseek-r1:32b`, `gpt-oss:20b`, `qwen3-coder:30b`.

Routing: `gpt-oss:20b` for mood/art-movement prompts (general reasoning), `deepseek-r1:32b` when you want it to *justify* a palette. Not `qwen3-coder` — it is tuned for code.

**Known gap: none of the three is vision-capable.** Text prompts, art movements and sensory descriptions all work locally today. *Image → palette* needs either `ollama pull qwen2.5vl` (still free, still local) or a Gemini free-tier call. Recommend the local pull.

The provider sits behind one interface, so switching to Claude later for higher-quality reasoning is a config change, not a rewrite.

---

## 8. What is built and verified today

```
src/lib/color-engine/     ← pure TypeScript, zero React, runs in browser/node/tests
  types.ts                  canonical OKLCH model
  interpolate.ts            Fritsch–Carlson monotone interpolation + circular hue
  color.ts                  parse / convert / format
  gamut.ts                  CSS Color 4 gamut mapping, per-hue chroma headroom
  scale.ts                  anchored 0–9 generator
  contrast.ts               WCAG 2.x + APCA
  cvd.ts                    Machado et al. 2009 CVD simulation
src/lib/exporters/tokens.ts CSS / Tailwind v4 / Figma W3C tokens
src/components/scale-lab/   live instrument UI
```

**63 tests passing. 96.7% statement coverage. `tsc --noEmit` clean.**

Verified against published reference values, not just self-consistency: APCA black-on-white `106.04`, white-on-black `-107.88`, WCAG black-on-white `21:1`, `#767676` as the borderline-AA grey.

The `tokens.ts` exporters were generated by `local-qwen3-coder:30b` through delegate-governor — `PASS` on first attempt, $0 spent — then reviewed and corrected by hand for a `noUncheckedIndexedAccess` violation before being applied.

### Known rough edge

Anchoring a very light color (like `#f5d90a`, L=88) at step 5 compresses steps 0–4 into a narrow lightness band. The maths is correct and the anchor is honoured exactly, but the ergonomic answer is to anchor light hues at step 2–3. **Fix:** suggest an anchor step automatically from the anchor's lightness.

---

## 9. Roadmap *(superseded — see ROADMAP.md)*

**Phase 1 — Library** _(engine complete; persistence next)_
Supabase schema, multi-scale palettes, auto-suggested anchor step, ASE + Procreate export.

**Phase 3 — Version control** ✅ _logic complete, 2026-07-20_
The DAG (multi-parent LCA), perceptual ΔE-OK diff, three-way merge with conflict detection, human-readable conflict reports. Built and tested ahead of Phase 2 — it's the genuine differentiator, and the logic needed no persistence to prove out. Still open: Supabase wiring for `VersionNode`/snapshot storage, and the conflict-resolution UI (base/ours/theirs swatches + blend slider).

**Phase 2 — Knowledge**
Color-Pedia ingest with provenance, local embeddings, semantic search, editable graph.

**Phase 4 — Canvas**
Infinite DOM canvas, spatial arrangement, mixing, comparison.

**Phase 5 — Intelligence**
Ollama prompt→palette, vision model for image→palette, explanations from the graph.

**Phase 6 — Print**
`color-datasets` build pipeline, CMYK, Pantone approximation via local reference pack.

---

## 10. What's built and verified (running total) *(superseded — see docs/AUDIT-2026-08-23.md)*

```
src/lib/color-engine/     63 tests · 97.0% coverage
src/lib/exporters/         8 tests · 100%  coverage
src/lib/versioning/        35 tests · 100%  coverage
                          ──────────────────────────
                          106 tests · 97.9% coverage · tsc clean
```

`versioning/` — DAG (multi-parent LCA, criss-cross limitation documented in-code),
ΔE-OK perceptual diff (Euclidean distance in OKLab), three-way merge (clean
same-side change, identical-both-sides no-conflict, real conflict, modify/delete
conflict), conflict report formatting, and a snapshot bridge that names tokens
identically to the CSS/Tailwind exporters so export, diff, and merge all agree
on what a "token" is. Two integration tests exercise the full pipeline —
generate → snapshot → branch → diverge → merge → report — end to end.

The `report.ts` formatter went through delegate-governor → `local-qwen3-coder:30b`,
**PASS on first attempt, $0**, both times used this session. Governor spend
remains **$0 of $30** for the month.

**Real bug caught by the test suite, not by review:** my first integration
test assumed regenerating a whole scale from a new anchor was equivalent to a
single-swatch edit. It isn't — regenerating recomputes every step's lightness
and chroma curve, so it touched all 10 tokens, not 1, and the "same-token
conflict" test failed with 9 conflicts instead of 1. The fix was in the test,
not the library: simulating what a designer actually does (nudge one swatch)
rather than what scale generation does (recompute the whole ramp). Worth
knowing because it's the exact distinction the UI will need to expose later —
"edit this swatch" and "regenerate this scale" are different operations with
different diff footprints.

---

## 11. UI and persistence scaffold — 2026-07-21

**Merge Lab** (`/merge`) is live: base/ours/theirs swatches per conflict, a
blend slider (OKLCH-interpolated, shortest-path hue, live ΔE-OK readout
between ours/theirs), click-to-resolve, a live conflict report, and the
resolved snapshot as JSON — all driven by the same `threeWayMerge` /
`formatConflictReport` functions a headless workflow would call. Verified
interactively in-browser: resolving a conflict flips the header status,
clears the report to `No conflicts.`, and updates the JSON in real time.

**Supabase is scaffolded but not connected** — no project exists yet, so
nothing here talks to a network:
- `supabase/schema.sql` — the full schema (`palettes`, `palette_versions` with
  a `parent_ids uuid[]` DAG, `palette_branches`), idempotent, ready to paste
  into the SQL Editor.
- `src/lib/supabase/client.ts` — server-only client (enforced by the
  `server-only` package, which throws at build time if a Client Component
  ever imports it). Throws a clear error if credentials are missing, tested
  without needing a live project.
- `.env.example` / `.gitignore` — credential template and protection.

RLS is deliberately off, documented in the schema file itself: v1 has no auth
layer, and every write goes through the service-role key server-side, which
bypasses RLS regardless. Revisit the moment a second user or client-side
Supabase access shows up.

**115 tests, 98.0% overall coverage, `tsc --noEmit` clean.** Full breakdown:
`color-engine` 97.0%, `exporters` 100%, `versioning` 100%, `supabase` 100%.

---

## 12. Real persistence — 2026-07-21, verified live

Merge Lab now runs against actual Postgres, not scripted data. What's real:

- `src/lib/supabase/palettes.ts` — repository over `palettes`/`palette_versions`/
  `palette_branches`, every function DI-testable via an injected client
  (`src/lib/supabase/__tests__/fake-client.ts`), 100% coverage.
- `src/lib/supabase/merge-workflow.ts` — bridges the pure `versioning` module to
  the DB: `loadVersionGraph`, `previewMerge` (LCA + three-way merge, read-only),
  `commitMergeResolution` (writes a real two-parent merge commit, fast-forwards
  the target branch).
- `src/app/merge/page.tsx` — async Server Component, fetches the live preview.
- `src/app/merge/actions.ts` — a Server Action backing the "commit merge" button.
- `scripts/seed-demo-palette.ts` — real seed data (one palette, a base version,
  two diverging branches) via `npx tsx --env-file=.env.local`.

**A real bug found and fixed along the way:** `SUPABASE_URL` was pasted as the
REST endpoint (`.../rest/v1/`) rather than the bare project origin — the client
library appends `/rest/v1` itself, so every request doubled that path and
failed with an opaque `PGRST125`. Root-caused by inspecting the URL's shape
(never its value — the service-role key was never printed). Fixed the env var,
and added validation in `client.ts` so this now fails fast with an actionable
message instead of a cryptic Postgrest code.

**Verified end-to-end in the browser, not just in tests:** resolved the seeded
conflict, clicked commit, watched the header flip to `committed as version
e23ba220`, reloaded the page, and confirmed the DAG's own LCA computation found
the new merge base and reported `0 token(s) diverged` — the exact behavior a
correct git-like merge should produce once "ours" has absorbed "theirs."

**136 tests, 97.1% overall coverage, `tsc --noEmit` clean.**

---

## 13. The loop closes — 2026-07-21

Scale Lab and Merge Lab were disconnected: one generated scales that vanished
on refresh, the other only knew a single hardcoded "Demo Palette" with
branches literally named `ours`/`theirs`. That's fixed — Phase 1 is now a real,
working vertical slice rather than two demos side by side.

New:
- `src/lib/supabase/branch-workflow.ts` — `initializePalette` (palette + root
  version + `main` branch), `forkBranch` (new branch at a source's current
  head, no version written until it diverges), `commitVersionToBranch`
  (ordinary single-parent commit, fast-forwards the branch). Tested, including
  a test that proves forks are genuinely independent — editing the parent
  branch after a fork does not move the fork's pointer.
- `/palettes` — lists every saved palette.
- `/palettes/[id]` — every branch's live snapshot as swatches, click-to-edit
  (commits a new version), inline fork, and a merge picker that links into
  `/merge?palette=...&ours=...&theirs=...`.
- Scale Lab gained a **save as palette** action — `snapshotFromScales` into
  `initializePalette`, then routes to the new palette's page.
- Merge Lab's route is now parametric (`searchParams`), falling back to the
  seeded Demo Palette only when no `?palette=` is given, so it's still
  smoke-testable with a bare `/merge`.

**Verified as a real, freshly-created loop in the browser, not replayed
demo data:** generated a scale named `loop-test`, saved it, forked `main` into
`warm`, edited `loop-test-5` to a different hex on each branch independently,
previewed the merge and got a genuine conflict (`#c2410c` vs `#7c3aed`, ΔE-OK
0.338 — a number that only exists because two real edits happened), resolved
it, and committed — `version 79fa9128`. None of that data existed before this
session.

**148 tests, 96.9% overall coverage, `tsc --noEmit` clean.**

---

## 14. Phase 2 — the knowledge graph, real and live — 2026-07-21

100,000 Color-Pedia rows, fully ingested and searchable. Deliberately shipped
as a **flat, full-text-searchable table**, not the generic `kg_node`/`kg_edge`
graph the original proposal sketched — nothing in the app yet needs
cross-entity traversal, and a flat table with a Postgres `tsvector` delivers
the actual user value ("type a word, find matching colors with their tags")
with a fraction of the schema and query complexity. Graduate to the graph
model if a real feature (RAG grounding, a graph browser) ever needs it.

**The ingestion path changed under fire, twice — worth understanding why.**
The first approach paginated HF's `datasets-server` rows API (100 rows/request,
~1000 requests total). It failed twice in production: a transient 502 at row
2100, then a 429 that never cleared even after five escalating backoff
rounds up to 20s each, with the same three offsets failing repeatedly — clear
evidence of a rate-limit window a ~1000-request run can't practically retry
around, not a transient blip. Rather than fighting an opaque rate limit
further, the fix was to eliminate the root cause: `scripts/ingest-colorpedia.ts`
now downloads the dataset's parquet file directly (one request, ~14MB, via
the zero-dependency `hyparquet` reader) and parses it locally — confirmed
live against a *separate*, far more generous rate-limit bucket (3000
req/5min) before committing to the rewrite. Verified row-for-row identical to
the rows API before trusting an unattended 87,000-row run on it.

Both partial runs left real, verified, non-overlapping progress: 8,000 rows,
then 5,000 more, then the remaining 87,000 via the parquet path — final count
**exactly 100,000**, confirmed against a live `COUNT`, with zero duplicates
and zero gaps across three separate runs.

**A genuine data-quality bug in the source, found by using the app, not by
inspecting the dataset:** browsing the library surfaced a row named `Def2ca`
— its own hex value typo'd into the name field — whose description claims
"pale pink" for a color that's actually pale green (`#def2ca`, OKLCH hue
129°). This is exactly what the `provenance: 'seed'` / "unverified seed data"
badge exists for, now proven true on real data rather than staying a
theoretical caveat.

**Verified live in the browser:** search for "autumn" returns exactly the
colors you'd hope for (chestnuts, siennas, colors literally tagged "Warmth,
Comfort, Nostalgia") — real semantic value, not just plumbing. The detail
page reuses `auditContrast` from the color engine directly, so a seed-data
color gets the exact same WCAG/APCA readout as anything generated in Scale
Lab — one engine, no duplicated logic. A 3-word query returning zero results
is expected `websearch_to_tsquery` AND-semantics (every stem must co-occur in
one row), not a bug — flagged as a future tuning decision (strict-but-precise
AND vs. ranked OR), not silently changed.

**160 tests, 96.9%+ overall coverage, `tsc --noEmit` clean, 100,000 real rows live.**

---

## 15. Open decisions for you

1. **Name.** PRISM is a placeholder.
2. **Vision model.** `ollama pull qwen2.5vl` (local, free, ~6 GB) — or skip image input for now?
3. **Search UX.** Worth moving off strict AND full-text matching toward ranked/OR search so multi-word mood queries ("melancholic autumn nostalgia") return *something* instead of nothing?
4. **Next phase.** Library, versioning, and knowledge graph are all real and live now. Phase 4 (infinite canvas) or Phase 5 (AI generation over this data) next?
