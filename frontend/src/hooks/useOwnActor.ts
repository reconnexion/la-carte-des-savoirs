import { useQuery } from '@tanstack/react-query';
import { fetchJson } from '@activitypods/refine-providers/utils';

import { authProvider } from '../providers';

/**
 * Fetch the logged-in user's own ActivityPub actor document (the WebID document itself), which
 * carries properties like `inbox` and `outbox` -- not exposed by `authProvider.getIdentity()`
 * (which only returns `{ id, name, avatar }`).
 */
export const useOwnActor = () => {
  const session = authProvider.getSession();

  return useQuery({
    queryKey: ['own-actor', session?.webId],
    queryFn: async () => {
      const { json } = await fetchJson(session!.webId, {}, session!.token);
      return json as Record<string, any>;
    },
    enabled: !!session,
    staleTime: 5 * 60 * 1000
  });
};
