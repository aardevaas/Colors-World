import { permanentRedirect } from 'next/navigation';

/**
 * /spectrum is retired — its virtualization pattern and collect-tray were
 * absorbed into /library's infinite grid + persistent Harmonic Dock (see
 * LibraryGrid.tsx and dock-context.tsx), which supersede this page entirely:
 * a growing/appendable feed instead of a literal 16.7M-row scrollbar, and a
 * dock that survives every route instead of a page-local tray. A permanent
 * redirect keeps any bookmarked or externally linked /spectrum URL working
 * rather than 404ing.
 */
export default function SpectrumPage() {
  permanentRedirect('/library');
}
