import type { ComponentType } from 'react';
import { DashboardTemplate } from './DashboardTemplate';
import { CommerceTemplate } from './CommerceTemplate';
import { EditorialTemplate } from './EditorialTemplate';
import { MobileTemplate } from './MobileTemplate';

export type TemplateId = 'dashboard' | 'commerce' | 'editorial' | 'mobile';

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
];

export function templateById(id: TemplateId): TemplateEntry {
  const entry = TEMPLATES.find((t) => t.id === id);
  if (entry === undefined) throw new Error(`Unknown template id: ${id}`);
  return entry;
}
