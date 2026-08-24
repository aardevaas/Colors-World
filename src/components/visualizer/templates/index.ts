/*
 * SPECIMEN MARKUP — deliberately not semantic.
 *
 * These templates are PICTURES of interfaces: something to judge a palette
 * against, not something to operate. Built from real landmarks they published
 * themselves into the visualizer's own document, and a screen-reader user found
 * two navigations, an aside and a page heading belonging to a dashboard that
 * does not exist and cannot be used — on top of the room's own structure.
 *
 * So every element in them is a div or a p. The styling is entirely
 * class-driven, so nothing renders differently, and the room keeps one heading
 * outline and one set of landmarks: its own.
 */

import type { ComponentType } from 'react';
import { DashboardTemplate } from './DashboardTemplate';
import { CommerceTemplate } from './CommerceTemplate';
import { EditorialTemplate } from './EditorialTemplate';
import { MobileTemplate } from './MobileTemplate';
import { EmailTemplate } from './EmailTemplate';

export type TemplateId = 'dashboard' | 'commerce' | 'editorial' | 'mobile' | 'email';

export interface TemplateEntry {
  readonly id: TemplateId;
  readonly label: string;
  /** One line on what this template actually stresses about a palette. */
  readonly stresses: string;
  readonly Component: ComponentType;
}

/**
 * The four templates, ordered from most structurally dense to least. Each one
 * is chosen to put a different part of a palette under load rather than to be
 * four variations of the same test — a palette can look fine on the editorial
 * hero and fall apart on the dashboard.
 */
export const TEMPLATES: readonly TemplateEntry[] = [
  {
    id: 'dashboard',
    label: 'SaaS dashboard',
    stresses: 'surface and border separation under dense nesting',
    Component: DashboardTemplate,
  },
  {
    id: 'commerce',
    label: 'Product card',
    stresses: 'primary and accent side by side at full saturation',
    Component: CommerceTemplate,
  },
  {
    id: 'editorial',
    label: 'Editorial hero',
    stresses: 'the text/background pair at display size',
    Component: EditorialTemplate,
  },
  {
    id: 'mobile',
    label: 'Mobile screen',
    stresses: 'off-states and small type',
    Component: MobileTemplate,
  },
  {
    id: 'email',
    label: 'Email',
    stresses: 'the palette in the fallback face, which is what actually arrives',
    Component: EmailTemplate,
  },
];

export function templateById(id: TemplateId): TemplateEntry {
  const entry = TEMPLATES.find((t) => t.id === id);
  if (entry === undefined) throw new Error(`Unknown template id: ${id}`);
  return entry;
}
