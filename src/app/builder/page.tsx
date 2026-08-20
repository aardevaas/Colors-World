import { permanentRedirect } from 'next/navigation';

/**
 * `/builder` became `/scales` when palette generation moved out into its own
 * room. The old route stays as a permanent redirect rather than disappearing:
 * it is in people's history and bookmarks, and the System travels in the query
 * string, so a saved link is a saved palette — breaking it would throw away
 * someone's work to tidy a URL.
 */
interface LegacyBuilderPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LegacyBuilderPage({ searchParams }: LegacyBuilderPageProps) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') query.set(key, value);
    else if (Array.isArray(value) && value[0] !== undefined) query.set(key, value[0]);
  }
  const search = query.toString();
  permanentRedirect(search === '' ? '/scales' : `/scales?${search}`);
}
