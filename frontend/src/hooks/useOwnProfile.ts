import { useList, useGetIdentity } from '@refinedev/core';

const asId = (value: unknown): string | undefined => {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return (value as any).id || (value as any)['@id'];
  return undefined;
};

/** The connected user's own profile, found among every profile they can currently read (their
 * own + their contacts' — see useNetworkSkills for why getList('profile') already covers this). */
export const useOwnProfile = () => {
  const { data: identity } = useGetIdentity<{ id: string }>();
  const { result, query } = useList({ resource: 'profile', pagination: { pageSize: 200 } });
  const profile = result.data.find((record: any) => asId(record['describes']) === identity?.id);

  return { profile, isLoading: query.isLoading, refetch: query.refetch };
};
