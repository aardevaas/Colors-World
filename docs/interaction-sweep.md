# The interaction sweep

Two bugs in this codebase have lived specifically in **sustained interaction** —
a drag, not a click — and neither was findable by reading code, running the
test suite, or measuring server-rendered HTML.

The one that got out was `BuilderShell`'s two-way System sync. Setting a slider
to a single value worked. Dragging it crashed the tab, and *also* silently
reverted the value when it did not crash. The code read correctly; two
hand-written equality guards stood in the right places; 1,494 tests passed.

So this is a procedure, not a test. Run it after any change to a component that
combines `useSystem()` with local state, and before asking anyone to audit the
codebase.

## What a unit test cannot do here

The failure needs three things at once: a real React commit cycle, an event
stream faster than one render, and enough of them in a row to reach React's
fifty-nested-update limit. `no-feedback-effects.test.ts` catches the narrow
static shape — one effect that writes a System slice and depends on it — and is
explicit that it does **not** catch the two-effect cycle. This does.

## The procedure

Drive it from a **sized iframe**, not the top-level page: a backgrounded pane
reports a 0×0 viewport, and every control then measures as absent.

```js
const f = document.createElement('iframe');
f.style.cssText = 'position:fixed;left:0;top:0;width:1440px;height:900px;border:0;opacity:0;z-index:-1';
f.src = '/scales?c=0a5cff-ff6b35-1b1b1f&m=light';
document.body.appendChild(f);
await new Promise((r) => { f.onload = r; setTimeout(r, 15000); });
await new Promise((r) => setTimeout(r, 2500));

const d = f.contentDocument, w = f.contentWindow;
const errs = [];
const orig = w.console.error;
w.console.error = (...a) => { errs.push(String(a[0]).slice(0, 140)); orig.apply(w.console, a); };
w.addEventListener('error', (e) => errs.push('ERR: ' + String(e.message).slice(0, 140)));

// React does not see `el.value = x`. Go through the native setter or the
// component never hears about it and the whole sweep silently passes.
const set = (el, v) => {
  const proto = el.tagName === 'SELECT' ? w.HTMLSelectElement.prototype : w.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
  el.dispatchEvent(new w.Event('input', { bubbles: true }));
  el.dispatchEvent(new w.Event('change', { bubbles: true }));
};

// A DRAG: many events with no await between them. One value at a time proves
// nothing — that was the version that passed while the bug was live.
const R = [...d.querySelectorAll('input[type=range]')];
for (let v = 100; v <= 160; v += 2) set(R[0], String(v / 100));
await new Promise((r) => setTimeout(r, 2500));

return { errors: errs.length, sample: errs.slice(0, 2), sliderEndsAt: R[0].value, url: w.location.search };
```

## What to assert

1. **`errors` is 0.** "Maximum update depth exceeded" is the loop.
2. **The control holds its final value.** A slider that snaps back to its
   default is the same bug not crashing. This is the check that would have
   caught it earliest, and it needs no error at all.
3. **The value reached the URL.** The System is the URL; an edit that does not
   appear there did not survive.

## The surfaces

Every component carrying continuous input. Last swept 2026-08-24, all clean:

| room | control | how to drive it |
|---|---|---|
| `/scales` | chroma intensity, hue torsion, curve manipulator | native setter burst |
| `/typography` | base size, leading, tracking, weight | native setter burst |
| `/compose` | harmony wheel | `pointerdown` → many `pointermove` → `pointerup` |
| `/visualizer` | template tabs, mode and audit toggles | repeated `.click()` |
| `/library` | ramp stepper, axis switch, dock adds | repeated `.click()` |

`/studio` is retired from the nav and carries the heaviest drag surface of all
— canvas camera, snapping, board items. Sweep it only if it is ever brought
back.

## The rule this came from

**An effect may write to the System, or depend on it, but the same slice must
not do both** — not in one effect, and not across two effects in one component.
The System is authoritative at load; local state owns the value while the room
is open. Where that ordering is unclear, the loop is already possible.
