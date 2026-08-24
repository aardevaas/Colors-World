/**
 * Shared construction for component contracts.
 *
 * Eighty components would be eighty near-identical renderers without this, and
 * the near-identical ones are where inconsistency hides: one says "No logo
 * uploaded", another "Requires logo.primary", and the book reads like it was
 * assembled by two people. The helpers here also keep each section file short
 * enough to read in one sitting, which is the only way a taxonomy stays
 * reviewable.
 *
 * Pure. Every function returns new data.
 */

import type {
  BookBlock,
  BookEntry,
  BrandState,
  ComponentId,
  Evidence,
  Finding,
  JsonSchema,
  Severity,
} from './types';
import { textFor } from './project';

/* ------------------------------------------------------------------ blocks */

export function absent(id: ComponentId, title: string, reason: string): BookBlock {
  return { kind: 'absent', id, title, reason };
}

export function present(
  id: ComponentId,
  title: string,
  evidence: Evidence,
  entries: readonly BookEntry[]
): BookBlock {
  return { kind: 'present', id, title, evidence, entries };
}

/**
 * The standard renderer for an authored component: prose the person wrote,
 * shown as itself.
 *
 * `declared` is the honest label for all of these. We did not measure your
 * values and no research says what your archetype should be — you decided,
 * and the book says so rather than dressing a decision as a finding.
 */
export function renderAuthored(
  id: ComponentId,
  title: string,
  label: string,
  prompt: string
): (state: BrandState) => BookBlock {
  return (state) => {
    const text = textFor(state.project, id);
    if (text === null) return absent(id, title, prompt);
    return present(id, title, 'declared', [{ label, value: text }]);
  };
}

/* ------------------------------------------------------------------ schema */

export function obj(
  properties: Readonly<Record<string, JsonSchema>>,
  required: readonly string[] = []
): JsonSchema {
  return { type: 'object', properties, required };
}

export function str(description?: string, values?: readonly string[]): JsonSchema {
  return values
    ? { type: 'string', description, enum: values }
    : { type: 'string', description };
}

export function num(description?: string): JsonSchema {
  return { type: 'number', description };
}

export function arr(items: JsonSchema, description?: string): JsonSchema {
  return { type: 'array', items, description };
}

/** The shape of a piece of authored prose — by far the most common `produces`. */
export function prose(description: string): JsonSchema {
  return obj({ text: str(description) }, ['text']);
}

/* ----------------------------------------------------------------- finding */

export function finding(
  componentId: ComponentId,
  severity: Severity,
  message: string,
  extra?: { measured?: string; expected?: string }
): Finding {
  return { componentId, severity, message, ...extra };
}

/**
 * The standard renderer for a component whose values are computed or chosen
 * rather than written — a derived rule, a set of tokens, a spec.
 *
 * The cast to `T` is the one unchecked step in the whole registry, and it is
 * deliberate: `AuthoredData` is `unknown` because Layer 1 stores many shapes,
 * and the shape is validated on write against the component's own `produces`
 * schema. Validating again on every render would be paying twice for a
 * guarantee already held.
 */
export function renderDerived<T>(
  id: ComponentId,
  title: string,
  evidence: Evidence,
  absentReason: string,
  toEntries: (data: T, state: BrandState) => readonly BookEntry[]
): (state: BrandState) => BookBlock {
  return (state) => {
    const raw = state.project?.data[id] ?? null;
    if (raw === null || raw === undefined) return absent(id, title, absentReason);
    const entries = toEntries(raw as T, state);
    if (entries.length === 0) return absent(id, title, absentReason);
    return present(id, title, evidence, entries);
  };
}
