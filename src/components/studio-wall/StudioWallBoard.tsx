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
  | (BoardCardBase & { kind: 'image'; path: string; url: string | null })
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

interface ProximityReadout {
  readonly x: number;
  readonly y: number;
  readonly contrast: number;
  readonly deltaE: number;
}

/** The one colour a card "is", for proximity comparison — notes have none. */
function representativeHex(card: BoardCard): string | null {
  if (card.kind === 'palette') return card.swatches[0] ?? null;
  if (card.kind === 'gradient') return card.colors[0] ?? null;
  if (card.kind === 'color') return card.hex;
  return null;
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
  const [proximity, setProximity] = useState<ProximityReadout | null>(null);
  const [addingLink, setAddingLink] = useState(false);
  const [linkDraft, setLinkDraft] = useState('');
  const maxZRef = useRef(initialCards.reduce((max, c) => Math.max(max, c.zIndex), 0));
  const dragRef = useRef<ActiveDrag | null>(null);
  const cardsRef = useRef(cards);
  const noteSaveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const gradientSaveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const imageInputRef = useRef<HTMLInputElement>(null);

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

  function bringToFront(id: string): void {
    maxZRef.current += 1;
    const z = maxZRef.current;
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, zIndex: z } : c)));
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>, card: BoardCard) {
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
  }

  /**
   * The signature "proximity" touch: while a colour-bearing card is being
   * dragged, find the nearest other colour-bearing card and — once they're
   * close enough to plausibly sit side by side — surface how they actually
   * relate, not just that they're near each other.
   */
  function updateProximity(dragged: BoardCard, others: readonly BoardCard[]): void {
    const draggedHex = representativeHex(dragged);
    if (draggedHex === null) {
      setProximity(null);
      return;
    }

    let nearest: { card: BoardCard; gap: number } | null = null;
    for (const other of others) {
      if (representativeHex(other) === null) continue;
      const gap = rectGap(dragged, other);
      if (gap <= PROXIMITY_THRESHOLD_PX && (nearest === null || gap < nearest.gap)) {
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
    const nextX = drag.originX + (event.clientX - drag.startX);
    const nextY = drag.originY + (event.clientY - drag.startY);
    setCards((prev) => prev.map((c) => (c.id === drag.id ? { ...c, x: nextX, y: nextY } : c)));

    const draggedBase = cardsRef.current.find((c) => c.id === drag.id);
    if (draggedBase !== undefined) {
      const others = cardsRef.current.filter((c) => c.id !== drag.id);
      updateProximity({ ...draggedBase, x: nextX, y: nextY }, others);
    }
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (drag === null || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDraggingId(null);
    setProximity(null);

    const card = cards.find((c) => c.id === drag.id);
    if (card !== undefined) {
      void moveItemAction(card.id, card.x, card.y, card.zIndex);
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

  function handleDelete(id: string) {
    setCards((prev) => prev.filter((c) => c.id !== id));
    void deleteItemAction(id);
  }

  return (
    <div className={styles.scrollArea}>
      <div className={styles.canvas}>
        {cards.length === 0 && (
          <p className={styles.emptyHint}>
            Pin your first palette from Scale Lab, or add a note below.
          </p>
        )}

        {cards.map((card) => (
          <div
            key={card.id}
            className={card.id === draggingId ? `${styles.card} ${styles.dragging}` : styles.card}
            style={
              {
                left: card.x,
                top: card.y,
                width: card.width,
                height: card.height,
                zIndex: card.zIndex,
                '--rotation': `${card.rotation}deg`,
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

            {card.kind === 'image' &&
              (card.url !== null ? (
                // eslint-disable-next-line @next/next/no-img-element -- a private, per-project signed URL isn't a candidate for next/image's remote-pattern allowlist.
                <img src={card.url} alt="" className={styles.imageBody} draggable={false} />
              ) : (
                <div className={styles.imageBody} />
              ))}
          </div>
        ))}

        {proximity !== null && (
          <div
            className={styles.proximityBadge}
            style={{ left: proximity.x, top: proximity.y }}
          >
            {proximity.contrast.toFixed(2)}:1 · ΔE {proximity.deltaE.toFixed(1)}
          </div>
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
        </div>
      )}
    </div>
  );
}
