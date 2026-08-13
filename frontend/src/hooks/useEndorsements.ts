import { useEffect, useMemo, useState } from 'react';
import { useList } from '@refinedev/core';

const asId = (value: unknown): string | undefined => {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return (value as any).id || (value as any)['@id'];
  return undefined;
};

const asLiteral = (value: unknown): string | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') return (value as any)['@value'];
  return undefined;
};

/** A recommendation isn't necessarily public: a private one 401/403s for anyone but its
 * recipient(s) reading it with their own token — fetchEndorsement treats that the same as "this
 * one isn't visible to me", per the app's design (an ignorable authorization error, not shown at
 * all rather than surfaced as an error). */
const fetchEndorsement = async (uri: string, token?: string): Promise<Record<string, any> | undefined> => {
  try {
    const headers: Record<string, string> = { Accept: 'application/ld+json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(uri, { headers });
    if (!response.ok) return undefined;
    const body = await response.json();
    return Array.isArray(body) ? body[0] : body;
  } catch {
    return undefined;
  }
};

export type Endorsement = {
  uri: string;
  recommenderWebId?: string;
  /** Falls back to "Inconnu" when the recommender isn't one of the viewer's own contacts — same
   * behavior as Welcome To My Place for event participants the viewer can't resolve a profile for. */
  name: string;
  photo?: string;
  known: boolean;
  /** Only present when `known` is true — nowhere useful to link an unresolved "Inconnu" to. */
  profileUri?: string;
  content?: string;
  published?: string;
};

/**
 * Resolves a skill's apods:Endorse activities (each hosted on its own recommender's Pod) into
 * ready-to-display recommender identity + comment. `token` should only be passed for the
 * connected user's own skills (a private recommendation addressed to them needs their own auth to
 * read) — anyone else's skills are resolved anonymously, same convention as useNetworkSkills.
 */
export const useEndorsements = (recommendationUris: string[], token?: string) => {
  // Reuses the same 'profile' list query as useNetworkSkills (self + contacts) — React Query
  // dedupes the identical, already-in-flight/cached request rather than refetching.
  const { result: profilesResult } = useList({ resource: 'profile', pagination: { pageSize: 200 } });

  const profilesByWebId = useMemo(() => {
    const map = new Map<string, { name: string; photo?: string; profileUri: string }>();
    for (const profile of (profilesResult?.data ?? []) as any[]) {
      const webId = asId(profile['describes']);
      if (!webId) continue;
      map.set(webId, {
        name: asLiteral(profile['vcard:given-name']) || asLiteral(profile['vcard:fn']) || webId,
        photo: asId(profile['vcard:photo']) || asLiteral(profile['vcard:photo']),
        profileUri: profile.id
      });
    }
    return map;
  }, [profilesResult?.data]);

  const [endorsements, setEndorsements] = useState<Endorsement[]>([]);
  const [loading, setLoading] = useState(false);
  const key = recommendationUris.join(',');

  useEffect(() => {
    let cancelled = false;

    if (recommendationUris.length === 0) {
      setEndorsements([]);
      return;
    }

    setLoading(true);
    (async () => {
      const resolved = await Promise.all(
        recommendationUris.map(async (uri): Promise<Endorsement | undefined> => {
          const activity = await fetchEndorsement(uri, token);
          if (!activity) return undefined;
          const recommenderWebId = asId(activity['actor']);
          const profile = recommenderWebId ? profilesByWebId.get(recommenderWebId) : undefined;
          return {
            uri,
            recommenderWebId,
            name: profile?.name ?? 'Inconnu',
            photo: profile?.photo,
            known: Boolean(profile),
            profileUri: profile?.profileUri,
            content: asLiteral(activity['content'] ?? activity['as:content']),
            published: asLiteral(activity['published'] ?? activity['as:published'])
          };
        })
      );
      if (!cancelled) {
        setEndorsements(resolved.filter((e): e is Endorsement => Boolean(e)));
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, token, profilesByWebId]);

  return { endorsements, loading };
};
