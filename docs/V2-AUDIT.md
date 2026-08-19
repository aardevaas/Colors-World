# Colors World — V2 audit

**Date:** 2026-08-19 · **Scope:** landing page, cross-tab UX, user-friendliness
**Method:** every finding below was reproduced live in a browser against the running
app, or measured in code. No finding here is inferred from reading source alone.

> **The lens.** This is a tool for designers, made by a designer. So the bar is
> not "does the feature exist" — it is "would a designer trust this, and would
> they come back to it tomorrow." Several things fail that bar while passing
> their own tests.

---

## The headline

**The engine is world-class. The product around it is not yet coherent.**

Three tabs are genuinely excellent in isolation. What is missing is the thing
that makes five tabs feel like *one* product: a shared, explained, predictable
model of what your collected colours **mean** as they move between tabs. Today
the same three colours produce a considered role mapping in one tab and a lurid
accident in another, and nothing anywhere tells you why.

That is the single highest-leverage fix in this document, and it is a design
problem more than an engineering one.

---

# Part 1 — The landing page

## 1.1 It is 3 screens and stops 🔴

Measured on the live page: `scrollHeight` 3558px against a 1186px viewport —
**3.0 screens**, containing exactly **one heading** (the `H1`) and no `H2` at
all.

The brief specifies six sections. Built: hero, and the rain-to-globe set piece.
**Not built: the live showcase, the feature bento, the open-source credibility
strip, the scrollytelling deep-dive, and the closing CTA.**

The consequence is concrete. A visitor scrolls past a beautiful globe and the
page simply ends. They are never told:

- that there are five tools, or what any of them do
- that the colour engine is MIT and they could depend on it
- that 16.7M colours are *computed*, which is the actual differentiator
- any reason to star the repo

**For the top-100 growth goal, the missing credibility strip is the specific
gap that matters most** — live star count, licence badge, contributors. That is
the section that converts a visitor into a stargazer, and it is the one section
whose absence directly costs the stated objective.

## 1.2 The globe loses its own metaphor 🟠

Scrolled through with real wheel events (it is scroll-driven, so programmatic
scrolling shows a black frame — worth knowing before anyone else "discovers"
that as a bug). The globe does assemble. But at its final state it fills the
entire viewport as a dense wall of colour — the *globe* read, which is the whole
point of the set piece, is gone. It reads as noise, not as a world.

There is a `#E6620C — Click to explore` affordance hidden in it. **That is the
most interesting interaction on the marketing page and nothing signals it
exists.** It deserves to be the hero of a section, not an easter egg.

## 1.3 The particle field renders over the primary CTA 🟠

Visible in the first screenshot: coloured particles pass **in front of** the
"Star on GitHub" button, breaking up its label. On the one button whose entire
job is the growth goal, decoration should never sit on top of the words.

## 1.4 The primary CTA sends first-time visitors to an empty room 🔴

`Enter the studio for free → /studio`.

For someone who has never used the product, `/studio` is a **blank canvas with
a dot grid**. The hero promises "every colour, all 16.7 million of them" and
then delivers an empty page with an "add a card" button.

`/library` is the payoff for that exact promise — an infinite grid of computed
colour, immediately gorgeous, requiring nothing from the visitor. **Point the
primary CTA at `/library`.** `/studio` is where you go once you have something
to arrange; it is the wrong first room.

## 1.5 Accessibility: the skip link goes nowhere 🔴

There is a "Skip to content" link targeting `#main`. Measured live:
`#main` has **zero children** and an empty text content.

So the one control specifically provided for keyboard and screen-reader users
lands on an empty element. WCAG 2.4.1 (Bypass Blocks) is nominally implemented
and functionally broken.

Related: the only `<footer>` on the page contains the single word "scroll" — it
is the scroll hint, not a footer. That is a semantic element used for
decoration, and it means the page has no real footer at all.

---

# Part 2 — How the tabs work together

This is where the product is furthest from world-class, and it is fixable.

## 2.1 The Harmonic Dock is the spine of the product and is never explained 🔴

The dock is what makes five tabs one product. Collect colours once, and every
tab uses them.

**Nothing anywhere tells a user this.** Searched the whole codebase: the phrase
"Harmonic Dock" appears in `aria-label`s, a tooltip, and two empty states. It
appears **nowhere on the landing page**, and there is no onboarding, no tour, no
first-run hint explaining what the dock is or why it follows you.

A designer's first session therefore goes: land → enter studio (empty) → find
nothing → leave. The connective tissue is invisible.

## 2.2 The same dock means something different in every tab 🔴

This is the finding I would fix first. Verified live with one dock containing
three colours — `#5A3F73` violet, `#19D368` green, `#CFA15D` tan:

| Tab | What it does with them | Result |
|---|---|---|
| `/builder` | every colour becomes its own scale | sensible, predictable |
| `/visualizer` | roles derived by **OKLCH lightness**, overridable | considered — this is the right model |
| `/typography` | `items[0]` = text, `items[1]` = background, **by position** | violet text on a **lurid green page** |
| `/studio` | not consumed at all | dock is decorative here |

`/typography`'s positional mapping is arbitrary and undiscoverable — the result
depends on the *order you happened to collect colours in*. It scored 4.60:1 and
therefore "passed", which makes it worse: the tool blessed an unusable page.

**Fix:** `/visualizer`'s lightness-derived, override-able model should be the
shared one. Extract it, use it in `/typography`, and let `/studio` consume it
too. One model, explained once.

## 2.3 Role derivation collides below six colours 🔴 *(bug)*

Found while investigating 2.2 and confirmed in code across palette sizes:

| Palette size | Collision |
|---|---|
| 2 colours | `background`+`primary`, `text`+`accent` |
| 3 colours | `surface`+`primary` |
| 4 colours | `surface`+`accent`, `primary`+`border` |
| 6 colours | clean |

Designers collect three to five colours. That is the **common** case, not the
edge case. Live consequence in `/visualizer`: `surface` and `primary` resolved
to the same tan, the dashboard's metric cards dissolved into their own
background, and `text on surface` fell to **1.22:1**.

`deriveRoles` fills *missing* roles from a neutral fallback but never checks
whether a colour has already been used. It should assign each role distinctly,
falling back to the neutral set rather than duplicating.

To its credit, `/visualizer`'s own audit **correctly flagged the 1.22:1
failure** — the tool was honest about its own bad output. That is the right
instinct and worth keeping.

## 2.4 `/typography` is the only tab with no empty state 🟠

`/builder`, `/visualizer` and `/studio` all guide a user with an empty dock.
`/typography` renders a specimen in fallback colours with no indication that the
dock drives it at all — so it silently looks *finished* while being unconfigured.

## 2.5 The hand-offs between tabs do not exist 🟠

The dock carries colour, but there is no path that says *"you built a scale —
now go see it on real UI"*. Each tab is entered from the nav, never from the
tab before it. The product has a natural workflow —

> **explore → build a scale → test on UI → pair type → assemble a board**

— and nothing in the interface expresses it. A "Test this scale in Visualizer"
button at the end of `/builder` would do more for perceived coherence than any
new feature.

---

# Part 3 — User-friendliness

## 3.1 `/library` is effectively unusable by keyboard 🔴

Measured live on one screen of `/library`:

- **608 focusable elements**
- **440** of them are micro-shade step buttons (lightness/chroma/hue)
- **40** are "Add to dock" — the action people actually want
- **19 tab stops** to reach the *first* "Add to dock"

So **72% of all tab stops are steppers**, and a keyboard user presses Tab
nineteen times to collect one colour, then roughly fifteen more per colour after
that.

The per-card shade stepper is a genuinely good idea. It should not be ten
individual tab stops. Make it one control (a slider, or arrow-keys once the card
has focus) and the page drops to well under 100 stops.

The labelling itself is excellent — `Add #554929 to dock`, `lightness step 3 of
10`, `Currently stepping through lightness. Click to switch axis.` Someone
clearly cared. The problem is quantity, not quality.

## 3.2 Nothing in the product teaches the product 🟠

No onboarding, no empty-state tour, no "start here". For a tool whose core
concept (the dock) is invisible, that is the difference between a designer
understanding it in ten seconds and bouncing.

This does not need a modal walkthrough — a single line under the nav on first
visit would do it.

---

# Part 4 — What is already world-class

Being fair, because the fixes above are worth doing *because* the foundation is
strong:

- **The colour engine.** OKLCH throughout, WCAG + APCA, gamut mapping, CVD, ΔE
  in OKLab. 16.7M colours computed rather than stored. Genuinely rare.
- **`/builder`'s curve manipulation** with live gamut badges per step.
- **`/studio`'s canvas** — zoom-to-cursor verified accurate to 0.09px, snapping,
  ambient glow, watermarked export.
- **`/visualizer`'s honesty.** It flags its own failures instead of hiding them,
  and auto-fix preserves hue and chroma exactly.
- **`/typography`'s local-font pipeline** — `queryLocalFonts()` with distinct
  handling for unsupported / denied / failed, which most implementations
  collapse into one useless empty list.
- **Accessible labelling** across the board, where it exists, is better than most
  commercial design tools.

---

# Prioritised fix list

**P0 — coherence and correctness**
1. Fix `deriveRoles` collisions below six colours *(bug, §2.3)*
2. Unify the role model — `/visualizer`'s, everywhere *(§2.2)*
3. Point the landing CTA at `/library`, not `/studio` *(§1.4)*
4. Fix the skip link — give `#main` real content *(§1.5)*

**P1 — the growth surface**
5. Build the credibility strip: stars, licence, contributors *(§1.1)*
6. Build the feature section — five tabs, explained *(§1.1)*
7. Explain the dock, on the landing page and on first run *(§2.1, §3.2)*
8. Real footer; stop using `<footer>` for the scroll hint *(§1.5)*

**P2 — friction**
9. Collapse `/library`'s 10 stepper buttons into one control *(§3.1)*
10. Add tab-to-tab hand-offs *(§2.5)*
11. `/typography` empty state *(§2.4)*
12. Move particles behind the CTA; give the globe room to read as a globe
    *(§1.2, §1.3)*

---

## Two things worth deciding, not just doing

**The globe's "click to explore" should become a section, not stay an easter
egg.** It is the single most on-brand interaction in the product — a live,
clickable 16.7M-colour world on the marketing page. Right now almost nobody will
find it.

**"For designers, by designers" argues for one opinionated default over many
knobs.** `/library` currently exposes every axis of every colour as a control.
The stronger version shows the colour, and reveals the axes on demand. Fewer
tab stops is a side effect; the real gain is that the page stops looking like a
control panel and starts looking like a place.
