# Colors World

An open-source studio for color, palettes, branding, and typography — where 100,000 colours are a world you explore, and your dashboard is your studio wall.

Built for designers, marketers, and brand teams — not just color-tooling professionals. Exploratory and visual first; the perceptual-color rigor (OKLCH, gamut mapping, WCAG/APCA contrast) runs quietly underneath rather than being the thing you have to learn.

## What's here

- **The Spectrum** — 100,000 colours, browsed as one continuous scroll, not queried a page at a time
- **Scale Lab** — generate perceptually even tonal scales from a single anchor colour, export as CSS/Tailwind/Figma tokens
- **Studio Wall** — a freeform per-project board: pin palettes, individual colours, reference images (drop a photo → extract its palette instantly), gradients, typography pairings, links, and notes
- **History** — every palette keeps a full version graph; branch, fork, and three-way merge without losing anything
- **Multi-user projects** — Supabase Auth (magic link), Row Level Security on every table, private by default, shared deliberately
- **Shareable links** — send a read-only view of a board to anyone, no account required
- **Brand asset library** — logos and marks with simple re-upload versioning

See [`ROADMAP.md`](./ROADMAP.md) for what's shipped, what's in progress, and what's next — updated as the project moves, not a stale planning doc.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · Supabase (Postgres, Auth, Storage) · [culori](https://culorijs.org/) for color math · Vitest.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project URL + keys
npm run dev
```

### Database setup

Run these once, in order, in your Supabase project's SQL Editor:

1. `supabase/schema.sql` — core schema (palettes, colours, Spectrum index, accounts/projects, Studio Wall board items)
2. Sign up once through the app's `/login` magic-link flow, so a real profile row exists
3. `supabase/enable-rls.sql` — backfills any pre-existing data to your account, then turns on Row Level Security everywhere
4. `supabase/storage.sql` — creates the private storage bucket for images/assets
5. `supabase/sharing.sql` — shareable read-only board links
6. `supabase/brand-assets.sql` — the brand asset library

Every file is idempotent — safe to re-run. Seed the 100K-colour library with `scripts/ingest-colorpedia.ts` (see the script header for the dataset it expects).

## Contributing

Issues and PRs are welcome. Before opening a large PR, open an issue first to discuss direction — this is a young project with a lot of moving parts, and coordinating early saves rework on both sides.

Read `ARCHITECTURE.md` for the reasoning behind the color-engine and data-provenance decisions, and `ROADMAP.md` for what's actively being worked on.

## License

[MIT](./LICENSE)
