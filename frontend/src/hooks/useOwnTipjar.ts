import { useQuery } from '@tanstack/react-query';
import { useGetIdentity } from '@refinedev/core';
import { fetchJson } from '@activitypods/refine-providers/utils';
import { authProvider } from '../providers';

/** `foaf:tipjar` may come back as a bare node reference, a plain string, or (rarely, e.g. stale
 *  data from before PorteJunes started overwriting rather than accumulating it) an array of
 *  either -- true as long as at least one value is actually present. */
const hasTipjarValue = (value: unknown): boolean => (Array.isArray(value) ? value.length > 0 : Boolean(value));

/** Whether the connected user has a Ğ1 wallet linked to their WebID (`foaf:tipjar`, set by
 *  PorteJunes on wallet creation) -- gates the "Envoyer des Ğ1" handoff button in MemberPanel,
 *  since sending someone there without a wallet of their own would just be a dead end. */
export const useOwnTipjar = () => {
  const { data: identity } = useGetIdentity<{ id: string }>();
  const session = authProvider.getSession();

  const { data, isLoading } = useQuery({
    queryKey: ['own-tipjar', identity?.id],
    queryFn: async () => {
      const { json } = await fetchJson(identity!.id, {}, session?.token);
      return hasTipjarValue(json['foaf:tipjar']);
    },
    enabled: !!identity?.id,
    staleTime: 5 * 60 * 1000
  });

  return { hasWallet: data ?? false, isLoading };
};
