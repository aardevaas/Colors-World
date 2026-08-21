'use client';

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import Link from 'next/link';
import {
  createGradientAction,
  createImageAction,
  createLinkAction,
  createNoteAction,
  createTypePairingAction,
  deleteItemAction,
  moveItemAction,
  pinColorAction,
  resizeItemAction,
  updateGradientAction,
  updateNoteAction,
  updateTypePairingAction,
} from '@/app/actions';
import { contrastRatio, deltaEOk, gradientCssString, parseColor } from '@/lib/color-engine';
import { extractPaletteFromImageFile } from '@/lib/image/sample-image-file';
import { ColorValues } from '@/components/color-values/ColorValues';
import {
  FONT_PAIRS,
  findFontPair,
  fontPairStylesheetUrl,
} from '@/lib/typography/font-pairs';
import { findSnap, type AlignmentGuide, type SnapCandidate } from '@/lib/studio/snapping';
import { autoArrange } from '@/lib/studio/auto-arrange';
import { computeExportBounds, compositeWatermark, downloadDataUrl } from '@/lib/studio/export-png';
import { useSystem } from '@/lib/system/system-context';
import { useCanvasCamera } from './useCanvasCamera';
import { Minimap } from './Minimap';
import styles from './studio-wall.module.css';

const injectedFontStylesheets = new Set<string>();

/** Injects the Google Fonts stylesheet for a pair at most once per page load. */
function ensureFontPairLoaded(pairId: string): void {
  const pair = findFontPair(pairId);
  const url = fontPairStylesheetUrl(pair);
  if (injectedFontStylesheets.has(url)) return;
  injectedFontStylesheets.add(url);

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = url;
  document.head.appendChild(link);
}

interface BoardCardBase {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly rotation: number;
  readonly zIndex: number;
}

export type BoardCard =
  | (BoardCardBase & { kind: 'note'; text: string })
  | (BoardCardBase & { kind: 'palette'; paletteId: string; name: string; swatches: string[] })
  | (BoardCardBase & { kind: 'gradient'; colors: string[] })
  | (BoardCardBase & { kind: 'image'; path: string; url: string | null; colors: string[] })
  | (BoardCardBase & { kind: 'color'; hex: string; name: string | null })
  | (BoardCardBase & { kind: 'link'; url: string; title: string })
  | (BoardCardBase & { kind: 'type-pairing'; pairId: string });

interface StudioWallBoardProps {
  readonly initialCards: readonly BoardCard[];
  /** Public share view: render the same cards with no drag, no edit, no delete, no add. */
  readonly readOnly?: boolean;
}

const NOTE_SAVE_DEBOUNCE_MS = 600;
const DEFAULT_GRADIENT_COLORS = ['#7c5cff', '#ffb454'];
const MIN_CARD_WIDTH = 120;
const MIN_CARD_HEIGHT = 90;
const AUTO_FORMAT_STAGGER_MS = 40;
const UNDO_WINDOW_MS = 10_000;

// Ambient glow fades out as the camera zooms out — with many cards on
// screen at once its render cost isn't free, and at a distance it just
// reads as noise anyway. Below GLOW_MIN_ZOOM it's fully off; at or above
// GLOW_FULL_ZOOM it's fully on; linear in between.
const GLOW_MIN_ZOOM = 0.3;
const GLOW_FULL_ZOOM = 0.8;

/** High-DPI multiplier for PNG export — 2x renders crisp on retina/4K
 *  displays without the file size exploding the way 3x+ would. */
const EXPORT_DPR = 2;

/** Double-click focus may magnify past 1:1, but well short of MAX_ZOOM. */
const FOCUS_MAX_ZOOM = 1.75;

interface UndoSnapshotEntry {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly rotation: number;
}

/** How close two cards' edges need to get, in canvas px, before their
 * contrast/distance reads out — near-touching, not merely on-screen together. */
const PROXIMITY_THRESHOLD_PX = 28;

interface ActiveDrag {
  readonly id: string;
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  readonly originX: number;
  readonly originY: number;
}

interface ActiveResize {
  readonly id: string;
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  readonly originWidth: number;
  readonly originHeight: number;
}

interface ProximityReadout {
  readonly x: number;
  readonly y: number;
  readonly contrast: number;
  readonly deltaE: number;
}

/** The one color a card "is", for proximity comparison — notes have none. */
function representativeHex(card: BoardCard): string | null {
  if (card.kind === 'palette') return card.swatches[0] ?? null;
  if (card.kind === 'gradient') return card.colors[0] ?? null;
  if (card.kind === 'color') return card.hex;
  return null;
}

/** Shapes a card for lib/studio/snapping.ts, which only needs to know the
 *  rect and the two kind-flags a snap decision actually turns on — decoupled
 *  from the full BoardCard union on purpose (see snapping.ts's own header). */
function toSnapCandidate(card: BoardCard): SnapCandidate {
  return {
    id: card.id,
    x: card.x,
    y: card.y,
    width: card.width,
    height: card.height,
    isColorBearing: representativeHex(card) !== null,
    isImage: card.kind === 'image',
  };
}

/** Gap between two axis-aligned rects, 0 when they overlap or touch. */
function rectGap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
): number {
  const dx = Math.max(b.x - (a.x + a.width), a.x - (b.x + b.width), 0);
  const dy = Math.max(b.y - (a.y + a.height), a.y - (b.y + b.height), 0);
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * A freeform corkboard, not a dashboard grid — every card keeps its own x/y/
 * rotation, dragged and dropped like something actually pinned to a wall.
 * Position updates are optimistic (move first, persist after) so dragging
 * never waits on the network; note text saves debounced for the same reason.
 */
export function StudioWallBoard({ initialCards, readOnly = false }: StudioWallBoardProps) {
  const [cards, setCards] = useState<BoardCard[]>([...initialCards]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [resizingId, setResizingId] = useState<string | null>(null);
  const [proximity, setProximity] = useState<ProximityReadout | null>(null);
  const [guides, setGuides] = useState<readonly AlignmentGuide[]>([]);
  const [addingLink, setAddingLink] = useState(false);
  const [linkDraft, setLinkDraft] = useState('');
  const [undoSnapshot, setUndoSnapshot] = useState<readonly UndoSnapshotEntry[] | null>(null);
  const [openPin, setOpenPin] = useState<{ cardId: string; index: number } | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const { addColor } = useSystem();
  const maxZRef = useRef(initialCards.reduce((max, c) => Math.max(max, c.zIndex), 0));
  const dragRef = useRef<ActiveDrag | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Precomputed once at drag start — the other cards don't move mid-drag, so
  // there's no reason to re-filter/re-map cards on every pointermove tick.
  const dragCandidatesRef = useRef<readonly SnapCandidate[]>([]);
  const resizeRef = useRef<ActiveResize | null>(null);
  const cardsRef = useRef(cards);
  const noteSaveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const gradientSaveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const imageInputRef = useRef<HTMLInputElement>(null);
  const worldLayerRef = useRef<HTMLDivElement>(null);

  const [focusedCardId, setFocusedCardId] = useState<string | null>(null);

  const {
    camera,
    viewportSize,
    viewportRef,
    worldTransform,
    isPanning,
    handleBackgroundPointerDown,
    handleBackgroundPointerMove,
    handleBackgroundPointerUp,
    frameRects,
    flyTo,
  } = useCanvasCamera(initialCards);

  useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);

  useEffect(() => {
    for (const card of initialCards) {
      if (card.kind === 'type-pairing') ensureFontPairLoaded(card.pairId);
    }
    // Only the wall's initial hydration needs this — cards created afterward
    // load their own font via handleAddTypePairing/handleTypePairingChange.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(
    () => () => {
      if (undoTimerRef.current !== null) clearTimeout(undoTimerRef.current);
    },
    []
  );

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.shiftKey && event.key === '0') {
        event.preventDefault();
        frameRects(cardsRef.current);
        setFocusedCardId(null);
      }
      if (event.key === 'Escape' && focusedCardId !== null) {
        setFocusedCardId(null);
        frameRects(cardsRef.current);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [frameRects, focusedCardId]);

  function bringToFront(id: string): void {
    maxZRef.current += 1;
    const z = maxZRef.current;
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, zIndex: z } : c)));
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>, card: BoardCard) {
    event.stopPropagation(); // don't also start a background camera pan
    event.currentTarget.setPointerCapture(event.pointerId);
    bringToFront(card.id);
    setDraggingId(card.id);
    dragRef.current = {
      id: card.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: card.x,
      originY: card.y,
    };
    dragCandidatesRef.current = cardsRef.current.filter((c) => c.id !== card.id).map(toSnapCandidate);
  }

  /**
   * The signature "proximity" touch: while a color-bearing card is being
   * dragged, find the nearest other color-bearing card and — once they're
   * close enough to plausibly sit side by side — surface how they actually
   * relate, not just that they're near each other.
   */
  function updateProximity(dragged: BoardCard, others: readonly BoardCard[]): void {
    const draggedHex = representativeHex(dragged);
    if (draggedHex === null) {
      setProximity(null);
      return;
    }

    // Authored as a screen-space threshold, converted to world units by the
    // current zoom — otherwise "close" would mean something different at
    // every zoom level, matching the same pattern lib/studio/snapping.ts uses.
    const thresholdWorld = PROXIMITY_THRESHOLD_PX / camera.zoom;

    let nearest: { card: BoardCard; gap: number } | null = null;
    for (const other of others) {
      if (representativeHex(other) === null) continue;
      const gap = rectGap(dragged, other);
      if (gap <= thresholdWorld && (nearest === null || gap < nearest.gap)) {
        nearest = { card: other, gap };
      }
    }

    if (nearest === null) {
      setProximity(null);
      return;
    }

    const otherHex = representativeHex(nearest.card)!;
    const draggedOklch = parseColor(draggedHex);
    const otherOklch = parseColor(otherHex);

    setProximity({
      x: (dragged.x + dragged.width / 2 + nearest.card.x + nearest.card.width / 2) / 2,
      y: (dragged.y + dragged.height / 2 + nearest.card.y + nearest.card.height / 2) / 2,
      contrast: contrastRatio(draggedOklch, otherOklch),
      deltaE: deltaEOk(draggedOklch, otherOklch),
    });
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (drag === null || drag.pointerId !== event.pointerId) return;
    // Screen-space pointer delta -> world-space card delta: at zoom 2 the
    // cursor moves twice as many screen px as the card should move in world
    // units, so without this the card would drift away from the cursor at
    // any zoom other than 1.
    const rawX = drag.originX + (event.clientX - drag.startX) / camera.zoom;
    const rawY = drag.originY + (event.clientY - drag.startY) / camera.zoom;

    const draggedBase = cardsRef.current.find((c) => c.id === drag.id);
    if (draggedBase === undefined) return;

    const snap = findSnap(
      { ...toSnapCandidate(draggedBase), x: rawX, y: rawY },
      dragCandidatesRef.current,
      camera.zoom
    );
    const nextX = snap.x;
    const nextY = snap.y;
    setGuides(snap.guides);

    setCards((prev) =>
      prev.map((c) =>
        c.id === drag.id
          ? { ...c, x: nextX, y: nextY, rotation: snap.snapped ? 0 : c.rotation }
          : c
      )
    );

    const others = cardsRef.current.filter((c) => c.id !== drag.id);
    updateProximity({ ...draggedBase, x: nextX, y: nextY }, others);
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (drag === null || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDraggingId(null);
    setProximity(null);
    setGuides([]);

    const card = cards.find((c) => c.id === drag.id);
    if (card !== undefined) {
      void moveItemAction(card.id, card.x, card.y, card.zIndex, card.rotation);
    }
  }

  function handleResizePointerDown(event: ReactPointerEvent<HTMLDivElement>, card: BoardCard) {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setResizingId(card.id);
    resizeRef.current = {
      id: card.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originWidth: card.width,
      originHeight: card.height,
    };
  }

  function handleResizePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const resize = resizeRef.current;
    if (resize === null || resize.pointerId !== event.pointerId) return;
    // Same screen-delta / zoom conversion as card dragging — a corner grip
    // has to track the cursor 1:1 on screen regardless of zoom level.
    const nextWidth = Math.max(
      MIN_CARD_WIDTH,
      resize.originWidth + (event.clientX - resize.startX) / camera.zoom
    );
    const nextHeight = Math.max(
      MIN_CARD_HEIGHT,
      resize.originHeight + (event.clientY - resize.startY) / camera.zoom
    );
    setCards((prev) =>
      prev.map((c) => (c.id === resize.id ? { ...c, width: nextWidth, height: nextHeight } : c))
    );
  }

  function handleResizePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const resize = resizeRef.current;
    if (resize === null || resize.pointerId !== event.pointerId) return;
    resizeRef.current = null;
    setResizingId(null);

    const card = cards.find((c) => c.id === resize.id);
    if (card !== undefined) {
      void resizeItemAction(card.id, card.width, card.height);
    }
  }

  async function handleAddNote() {
    const created = await createNoteAction();
    setCards((prev) => [
      ...prev,
      {
        id: created.id,
        x: created.x,
        y: created.y,
        width: created.width,
        height: created.height,
        rotation: created.rotation,
        zIndex: created.zIndex,
        kind: 'note',
        text: '',
      },
    ]);
  }

  async function handleAddGradient() {
    const created = await createGradientAction(DEFAULT_GRADIENT_COLORS);
    setCards((prev) => [
      ...prev,
      {
        id: created.id,
        x: created.x,
        y: created.y,
        width: created.width,
        height: created.height,
        rotation: created.rotation,
        zIndex: created.zIndex,
        kind: 'gradient',
        colors: DEFAULT_GRADIENT_COLORS,
      },
    ]);
  }

  async function handleAddImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ''; // clears the input so re-picking the same file still fires onChange
    if (file === undefined) return;

    const colors = await extractPaletteFromImageFile(file);
    const objectUrl = URL.createObjectURL(file);

    const formData = new FormData();
    formData.set('file', file);
    formData.set('colors', JSON.stringify(colors));
    const result = await createImageAction(formData);

    setCards((prev) => {
      const next: BoardCard[] = [
        ...prev,
        {
          id: result.imageItem.id,
          x: result.imageItem.x,
          y: result.imageItem.y,
          width: result.imageItem.width,
          height: result.imageItem.height,
          rotation: result.imageItem.rotation,
          zIndex: result.imageItem.zIndex,
          kind: 'image',
          path: typeof result.imageItem.content?.path === 'string' ? result.imageItem.content.path : '',
          url: objectUrl,
          colors,
        },
      ];
      if (result.paletteItem !== null && result.paletteItem.refId !== null) {
        next.push({
          id: result.paletteItem.id,
          x: result.paletteItem.x,
          y: result.paletteItem.y,
          width: result.paletteItem.width,
          height: result.paletteItem.height,
          rotation: result.paletteItem.rotation,
          zIndex: result.paletteItem.zIndex,
          kind: 'palette',
          paletteId: result.paletteItem.refId,
          name: result.paletteName ?? 'Untitled palette',
          swatches: colors,
        });
      }
      return next;
    });
  }

  async function handleAddLink() {
    const url = linkDraft.trim();
    if (url === '') return;
    setAddingLink(false);
    setLinkDraft('');

    const created = await createLinkAction(url);
    setCards((prev) => [
      ...prev,
      {
        id: created.id,
        x: created.x,
        y: created.y,
        width: created.width,
        height: created.height,
        rotation: created.rotation,
        zIndex: created.zIndex,
        kind: 'link',
        url: typeof created.content?.url === 'string' ? created.content.url : url,
        title: typeof created.content?.title === 'string' ? created.content.title : url,
      },
    ]);
  }

  async function handleAddTypePairing() {
    const created = await createTypePairingAction();
    const pairId = typeof created.content?.pairId === 'string' ? created.content.pairId : FONT_PAIRS[0]!.id;
    ensureFontPairLoaded(pairId);
    setCards((prev) => [
      ...prev,
      {
        id: created.id,
        x: created.x,
        y: created.y,
        width: created.width,
        height: created.height,
        rotation: created.rotation,
        zIndex: created.zIndex,
        kind: 'type-pairing',
        pairId,
      },
    ]);
  }

  function handleTypePairingChange(id: string, pairId: string) {
    ensureFontPairLoaded(pairId);
    setCards((prev) =>
      prev.map((c) => (c.id === id && c.kind === 'type-pairing' ? { ...c, pairId } : c))
    );
    void updateTypePairingAction(id, pairId);
  }

  function handleNoteChange(id: string, text: string) {
    setCards((prev) => prev.map((c) => (c.id === id && c.kind === 'note' ? { ...c, text } : c)));

    const timers = noteSaveTimers.current;
    const existingTimer = timers.get(id);
    if (existingTimer !== undefined) clearTimeout(existingTimer);
    timers.set(
      id,
      setTimeout(() => {
        timers.delete(id);
        void updateNoteAction(id, text);
      }, NOTE_SAVE_DEBOUNCE_MS)
    );
  }

  function handleGradientStopChange(id: string, stopIndex: number, hex: string) {
    let nextColors: string[] = [];
    setCards((prev) =>
      prev.map((c) => {
        if (c.id !== id || c.kind !== 'gradient') return c;
        nextColors = c.colors.map((color, index) => (index === stopIndex ? hex : color));
        return { ...c, colors: nextColors };
      })
    );

    const timers = gradientSaveTimers.current;
    const existingTimer = timers.get(id);
    if (existingTimer !== undefined) clearTimeout(existingTimer);
    timers.set(
      id,
      setTimeout(() => {
        timers.delete(id);
        void updateGradientAction(id, nextColors);
      }, NOTE_SAVE_DEBOUNCE_MS)
    );
  }

  function handleCardDoubleClick(card: BoardCard) {
    setFocusedCardId(card.id);
    // Focusing one card is a deliberate "look closer" gesture, so it may
    // magnify past natural size — but not to the 400% ceiling, which turns a
    // 240px note into a wall of text.
    frameRects([card], FOCUS_MAX_ZOOM);
  }

  function handleBackgroundDoubleClick() {
    if (focusedCardId === null) return;
    setFocusedCardId(null);
    frameRects(cardsRef.current);
  }

  /**
   * Lays every card out into a tidy editorial grid via auto-arrange.ts.
   * Destructive to whatever hand-placed layout was there, so: (1) it
   * snapshots current positions first so Undo can restore them exactly,
   * and (2) each card settles in on its own staggered delay rather than
   * all teleporting at once, so the reshuffle reads as one motion instead
   * of a jump-cut.
   */
  function handleAutoFormat() {
    const snapshot: UndoSnapshotEntry[] = cardsRef.current.map((c) => ({
      id: c.id,
      x: c.x,
      y: c.y,
      rotation: c.rotation,
    }));
    const zIndexById = new Map(cardsRef.current.map((c) => [c.id, c.zIndex]));
    const arranged = autoArrange(cardsRef.current.map((c) => ({ id: c.id, width: c.width, height: c.height })));

    arranged.forEach((position, index) => {
      setTimeout(() => {
        setCards((prev) =>
          prev.map((c) => (c.id === position.id ? { ...c, x: position.x, y: position.y, rotation: 0 } : c))
        );
        void moveItemAction(position.id, position.x, position.y, zIndexById.get(position.id) ?? 0, 0);
      }, index * AUTO_FORMAT_STAGGER_MS);
    });

    setFocusedCardId(null);
    const dimensionById = new Map(cardsRef.current.map((c) => [c.id, { width: c.width, height: c.height }]));
    setTimeout(
      () =>
        frameRects(
          arranged.map((position) => ({
            x: position.x,
            y: position.y,
            width: dimensionById.get(position.id)?.width ?? 0,
            height: dimensionById.get(position.id)?.height ?? 0,
          }))
        ),
      arranged.length * AUTO_FORMAT_STAGGER_MS + 100
    );

    setUndoSnapshot(snapshot);
    if (undoTimerRef.current !== null) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(() => setUndoSnapshot(null), UNDO_WINDOW_MS);
  }

  function handleUndoAutoFormat() {
    if (undoSnapshot === null) return;
    const snapshot = undoSnapshot;
    setUndoSnapshot(null);
    if (undoTimerRef.current !== null) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }

    const zIndexById = new Map(cardsRef.current.map((c) => [c.id, c.zIndex]));
    setCards((prev) =>
      prev.map((c) => {
        const original = snapshot.find((entry) => entry.id === c.id);
        return original === undefined
          ? c
          : { ...c, x: original.x, y: original.y, rotation: original.rotation };
      })
    );
    for (const original of snapshot) {
      void moveItemAction(original.id, original.x, original.y, zIndexById.get(original.id) ?? 0, original.rotation);
    }
  }

  async function handlePromotePinToCard(hex: string) {
    setOpenPin(null);
    const created = await pinColorAction(hex);
    setCards((prev) => [
      ...prev,
      {
        id: created.id,
        x: created.x,
        y: created.y,
        width: created.width,
        height: created.height,
        rotation: created.rotation,
        zIndex: created.zIndex,
        kind: 'color',
        hex,
        name: null,
      },
    ]);
  }

  function handlePinToDock(hex: string) {
    setOpenPin(null);
    addColor(hex, parseColor(hex));
  }

  /**
   * Captures every card at world-natural scale (1 world unit = 1 px,
   * independent of whatever zoom the visitor is currently looking through)
   * at a high-DPI multiplier, watermarks it, and downloads the PNG.
   * Temporarily overrides the world layer's own transform for the capture
   * — domToPng renders a node as it's actually laid out, so the live pan/
   * zoom transform has to be swapped out and restored around the capture,
   * not worked around after the fact.
   */
  async function handleExportPng() {
    const worldLayerEl = worldLayerRef.current;
    if (worldLayerEl === null || cardsRef.current.length === 0 || isExporting) return;

    setIsExporting(true);
    setFocusedCardId(null);
    const originalTransform = worldLayerEl.style.transform;

    try {
      const bounds = computeExportBounds(cardsRef.current);
      worldLayerEl.style.transform = `translate(${-bounds.x}px, ${-bounds.y}px) scale(1)`;

      const { domToPng } = await import('modern-screenshot');
      const rawDataUrl = await domToPng(worldLayerEl, {
        width: bounds.width,
        height: bounds.height,
        scale: EXPORT_DPR,
        backgroundColor: '#0b0b0c',
      });

      const watermarked = await compositeWatermark(
        rawDataUrl,
        bounds.width * EXPORT_DPR,
        bounds.height * EXPORT_DPR,
        'Colors World'
      );
      downloadDataUrl(watermarked, `studio-board-${Date.now()}.png`);
    } finally {
      worldLayerEl.style.transform = originalTransform;
      setIsExporting(false);
    }
  }

  function handleDelete(id: string) {
    setCards((prev) => prev.filter((c) => c.id !== id));
    void deleteItemAction(id);
  }

  const glowOpacity = Math.min(
    1,
    Math.max(0, (camera.zoom - GLOW_MIN_ZOOM) / (GLOW_FULL_ZOOM - GLOW_MIN_ZOOM))
  );

  return (
    <div
      ref={viewportRef}
      className={isPanning ? `${styles.viewport} ${styles.panning}` : styles.viewport}
      onPointerDown={handleBackgroundPointerDown}
      onPointerMove={handleBackgroundPointerMove}
      onPointerUp={handleBackgroundPointerUp}
      onPointerCancel={handleBackgroundPointerUp}
      onDoubleClick={handleBackgroundDoubleClick}
      onClick={() => setOpenPin(null)}
    >
      {/* Viewport-anchored, not world-anchored: as world content it sat at
          world (40,40) while the camera starts at (600,480), so it rendered
          clipped off the left edge of the screen — and would drift away
          entirely the moment anyone panned. It is a UI affordance, not a
          thing on the board. */}
      {cards.length === 0 && (
        <p className={styles.emptyHint}>
          Pin your first palette from the Builder, or add a card below.
        </p>
      )}

      <div ref={worldLayerRef} className={styles.worldLayer} style={{ transform: worldTransform }}>
        <div className={styles.canvas} />

        {cards.map((card) => {
          const glowHex = representativeHex(card);
          return (
          <div
            key={card.id}
            className={[
              styles.card,
              card.id === draggingId ? styles.dragging : '',
              card.id === resizingId ? styles.resizing : '',
              focusedCardId !== null && card.id !== focusedCardId ? styles.dimmed : '',
              glowHex !== null ? styles.colorBearing : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onPointerDown={(event) => event.stopPropagation()}
            onDoubleClick={(event) => {
              event.stopPropagation();
              handleCardDoubleClick(card);
            }}
            style={
              {
                left: card.x,
                top: card.y,
                width: card.width,
                height: card.height,
                zIndex: card.zIndex,
                '--rotation': `${card.rotation}deg`,
                ...(glowHex !== null
                  ? { '--glow-color': glowHex, '--glow-opacity': glowOpacity }
                  : {}),
              } as CSSProperties
            }
          >
            {!readOnly && (
              <div
                className={styles.dragHandle}
                onPointerDown={(event) => handlePointerDown(event, card)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
              >
                <span aria-hidden="true" className={styles.dragDots}>
                  ⠿⠿
                </span>
                <button
                  type="button"
                  className={styles.deleteButton}
                  onClick={() => handleDelete(card.id)}
                  aria-label="Remove from wall"
                >
                  ×
                </button>
              </div>
            )}

            {!readOnly && (
              <div
                className={styles.resizeHandle}
                onPointerDown={(event) => handleResizePointerDown(event, card)}
                onPointerMove={handleResizePointerMove}
                onPointerUp={handleResizePointerUp}
                aria-hidden="true"
              />
            )}

            {card.kind === 'palette' &&
              (readOnly ? (
                <div className={styles.paletteBody}>
                  <div className={styles.swatchStrip}>
                    {card.swatches.map((hex, index) => (
                      <span key={index} className={styles.swatch} style={{ background: hex }} />
                    ))}
                  </div>
                  <div className={styles.paletteName}>{card.name}</div>
                </div>
              ) : (
                <Link href={`/palettes/${card.paletteId}`} className={styles.paletteBody}>
                  <div className={styles.swatchStrip}>
                    {card.swatches.map((hex, index) => (
                      <span key={index} className={styles.swatch} style={{ background: hex }} />
                    ))}
                  </div>
                  <div className={styles.paletteName}>{card.name}</div>
                </Link>
              ))}

            {card.kind === 'note' && (
              <textarea
                className={styles.noteBody}
                value={card.text}
                placeholder="Note…"
                readOnly={readOnly}
                onChange={readOnly ? undefined : (event) => handleNoteChange(card.id, event.target.value)}
              />
            )}

            {card.kind === 'gradient' && (
              <div
                className={styles.gradientBody}
                style={{ background: gradientCssString(card.colors.map(parseColor)) }}
              >
                {!readOnly && (
                  <div className={styles.gradientStops}>
                    {card.colors.map((hex, index) => (
                      <input
                        key={index}
                        type="color"
                        className={styles.gradientStopInput}
                        value={hex}
                        aria-label={`Gradient stop ${index + 1}`}
                        onChange={(event) => handleGradientStopChange(card.id, index, event.target.value)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {card.kind === 'color' && (
              <div className={styles.colorBody}>
                <span className={styles.colorSwatch} style={{ background: card.hex }} />
                {card.name !== null && <div className={styles.paletteName}>{card.name}</div>}
                <ColorValues oklch={parseColor(card.hex)} />
              </div>
            )}

            {card.kind === 'type-pairing' &&
              (() => {
                const pair = findFontPair(card.pairId);
                return (
                  <div className={styles.typeBody}>
                    <p
                      className={styles.typeHeadingSample}
                      style={{ fontFamily: `"${pair.headingFamily}", serif`, fontWeight: pair.headingWeight }}
                    >
                      Aa Bb Cc
                    </p>
                    <p
                      className={styles.typeBodySample}
                      style={{ fontFamily: `"${pair.bodyFamily}", sans-serif`, fontWeight: pair.bodyWeight }}
                    >
                      The quick brown fox jumps over the lazy dog.
                    </p>
                    <select
                      className={styles.typeSelect}
                      value={card.pairId}
                      disabled={readOnly}
                      onChange={
                        readOnly
                          ? undefined
                          : (event) => handleTypePairingChange(card.id, event.target.value)
                      }
                    >
                      {FONT_PAIRS.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })()}

            {card.kind === 'link' && (
              <a
                href={card.url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.linkBody}
              >
                <span aria-hidden="true" className={styles.linkIcon}>
                  ↗
                </span>
                <span className={styles.linkTitle}>{card.title}</span>
                <span className={styles.linkUrl}>{new URL(card.url).hostname}</span>
              </a>
            )}

            {card.kind === 'image' && (
              <>
                {card.url !== null ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a private, per-project signed URL isn't a candidate for next/image's remote-pattern allowlist.
                  <img src={card.url} alt="" className={styles.imageBody} draggable={false} />
                ) : (
                  <div className={styles.imageBody} />
                )}
                {card.colors.length > 0 && (
                  <div className={styles.pinRow}>
                    {card.colors.map((hex, index) => {
                      const isOpen = openPin?.cardId === card.id && openPin.index === index;
                      return (
                        <div key={index} className={styles.pinWrapper}>
                          <button
                            type="button"
                            className={styles.pin}
                            style={{ background: hex }}
                            aria-label={`Extracted color ${hex}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              setOpenPin(isOpen ? null : { cardId: card.id, index });
                            }}
                          />
                          {isOpen && (
                            <div className={styles.pinPopover} onPointerDown={(event) => event.stopPropagation()}>
                              {!readOnly && (
                                <button
                                  type="button"
                                  className={styles.pinPopoverButton}
                                  onClick={() => void handlePromotePinToCard(hex)}
                                >
                                  + card
                                </button>
                              )}
                              <button
                                type="button"
                                className={styles.pinPopoverButton}
                                onClick={() => handlePinToDock(hex)}
                              >
                                + dock
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
          );
        })}

        {proximity !== null && (
          <div
            className={styles.proximityBadge}
            style={{ left: proximity.x, top: proximity.y }}
          >
            {proximity.contrast.toFixed(2)}:1 · ΔE {proximity.deltaE.toFixed(1)}
          </div>
        )}

        {guides.map((guide, index) =>
          guide.axis === 'x' ? (
            <div
              key={index}
              className={styles.alignmentGuide}
              style={{ left: guide.position, top: guide.start, width: 1, height: guide.end - guide.start }}
            />
          ) : (
            <div
              key={index}
              className={styles.alignmentGuide}
              style={{ left: guide.start, top: guide.position, width: guide.end - guide.start, height: 1 }}
            />
          )
        )}
      </div>

      {!readOnly && (
        <div className={styles.addButtonGroup}>
          {addingLink && (
            <input
              type="url"
              autoFocus
              className={styles.linkInput}
              placeholder="https://…"
              value={linkDraft}
              onChange={(event) => setLinkDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void handleAddLink();
                if (event.key === 'Escape') {
                  setAddingLink(false);
                  setLinkDraft('');
                }
              }}
              onBlur={() => {
                if (linkDraft.trim() === '') setAddingLink(false);
              }}
            />
          )}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className={styles.hiddenFileInput}
            onChange={(event) => void handleAddImage(event)}
          />
          <button type="button" className={styles.addButton} onClick={() => imageInputRef.current?.click()}>
            + image
          </button>
          <button type="button" className={styles.addButton} onClick={() => void handleAddGradient()}>
            + gradient
          </button>
          <button type="button" className={styles.addButton} onClick={() => void handleAddTypePairing()}>
            + type
          </button>
          <button
            type="button"
            className={styles.addButton}
            onClick={() => (addingLink ? void handleAddLink() : setAddingLink(true))}
          >
            + link
          </button>
          <button type="button" className={styles.addButton} onClick={() => void handleAddNote()}>
            + note
          </button>
          <button
            type="button"
            className={styles.addButton}
            onClick={handleAutoFormat}
            disabled={cards.length < 2}
            title="Lay every card out into a tidy editorial grid"
          >
            auto-format
          </button>
        </div>
      )}

      {undoSnapshot !== null && (
        <div className={styles.undoBanner}>
          <span>Board auto-formatted</span>
          <button type="button" className={styles.undoButton} onClick={handleUndoAutoFormat}>
            Undo
          </button>
        </div>
      )}

      <button
        type="button"
        className={styles.zoomReadout}
        onClick={() => {
          setFocusedCardId(null);
          frameRects(cardsRef.current);
        }}
        title="Reset view to fit every card (Shift+0)"
      >
        {Math.round(camera.zoom * 100)}%
      </button>

      <button
        type="button"
        className={styles.exportButton}
        onClick={() => void handleExportPng()}
        disabled={cards.length === 0 || isExporting}
        title="Download a high-resolution PNG of the whole board"
      >
        {isExporting ? 'exporting…' : '⬇ export png'}
      </button>

      <Minimap cardRects={cards} camera={camera} viewportSize={viewportSize} onNavigate={flyTo} />
    </div>
  );
}
