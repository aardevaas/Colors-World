/**
 * The one control provided specifically for keyboard and screen-reader
 * visitors: a way past the navigation to the content.
 *
 * It has to have somewhere to GO. `#main` must exist on the page and must be
 * focusable — a plain `<main>` will accept the hash but not the focus, so the
 * next Tab carries on from the top of the document as though nothing happened.
 * `tabIndex={-1}` on the target is what makes it real, which is why `RoomMain`
 * sits next to this rather than being left to each room to remember.
 */
export function SkipLink() {
  return (
    <a href="#main" className="skipLink">
      Skip to content
    </a>
  );
}

interface RoomMainProps {
  readonly children: React.ReactNode;
  readonly className?: string;
}

/**
 * The room's content landmark.
 *
 * Every room had a `<nav>` and a `<header>` and no `<main>` at all, so the one
 * region a screen-reader user actually wants to jump to was the only one not
 * announced — and "skip to content" had no content to skip to.
 */
export function RoomMain({ children, className }: RoomMainProps) {
  return (
    <main id="main" tabIndex={-1} className={className}>
      {children}
    </main>
  );
}
