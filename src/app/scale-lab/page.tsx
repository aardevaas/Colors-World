import { permanentRedirect } from 'next/navigation';

/**
 * /scale-lab is retired — its hand-rolled curve/step/CVD/export UI was
 * absorbed into /builder (Tab 02), which supersedes it entirely: a real
 * curve manipulator instead of raw scalar sliders, N parallel dock-driven
 * scales instead of one, a contrast matrix heatmap, and a full export vault
 * (CSS/Tailwind/shadcn/Figma) instead of a three-format switch. A permanent
 * redirect keeps any bookmarked or externally linked /scale-lab URL working
 * rather than 404ing — the same precedent as /spectrum -> /library.
 */
export default function ScaleLabPage() {
  permanentRedirect('/builder');
}
