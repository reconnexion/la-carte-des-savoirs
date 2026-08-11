import { useEffect, useMemo, useState } from 'react';
import { useList, useGetIdentity } from '@refinedev/core';
import type { SkillCatalogEntry, GradeCatalogEntry } from '../config/catalog';

// Full IRIs for our custom pair# terms: the profile/experience resources come straight from the
// Pod provider's own JSON-LD serialization, which has no reason to know about our "pair" CURIE
// prefix, so these predicates are very likely to come back as full IRIs rather than compacted.
// We check both forms defensively.
const PAIR_HAS_EXPERIENCE = ['http://virtual-assembly.org/ontologies/pair#hasExperience', 'pair:hasExperience'];
const PAIR_EXPERIENCE_SKILL = ['http://virtual-assembly.org/ontologies/pair#experienceSkill', 'pair:experienceSkill'];
const PAIR_EXPERIENCE_GRADE = ['http://virtual-assembly.org/ontologies/pair#experienceGrade', 'pair:experienceGrade'];
const AS_SUMMARY = ['https://www.w3.org/ns/activitystreams#summary', 'as:summary', 'summary'];

const firstOf = (record: Record<string, any> | undefined, keys: string[]): any => {
  if (!record) return undefined;
  for (const key of keys) {
    if (record[key] !== undefined) return record[key];
  }
  return undefined;
};

const asArray = <T,>(value: T | T[] | undefined): T[] => {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
};

const asId = (value: unknown): string | undefined => {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return (value as any).id || (value as any)['@id'];
  return undefined;
};

const asLiteral = (value: unknown): string | undefined => {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return (value as any)['@value'];
  return undefined;
};

const fetchPublicResource = async (uri: string): Promise<Record<string, any> | undefined> => {
  try {
    const response = await fetch(uri, { headers: { Accept: 'application/ld+json' } });
    if (!response.ok) return undefined;
    const body = await response.json();
    return Array.isArray(body) ? body[0] : body;
  } catch {
    return undefined;
  }
};

export type NetworkSkill = {
  uri: string;
  skillId: string;
  skillLabel: string;
  gradeLabel: string;
  gradePosition: number;
  summary?: string;
};

export type NetworkMember = {
  webId: string;
  isSelf: boolean;
  name: string;
  photo?: string;
  lat?: number;
  lng?: number;
  skills: NetworkSkill[];
};

/**
 * Reads every profile the connected user can currently see (their own, plus their contacts' —
 * natively enforced by the Pod provider, see the project plan for why this needs no aggregation
 * logic of our own), then resolves each profile's pair:hasExperience links and vcard:hasAddress
 * into ready-to-display skills and map coordinates.
 */
export const useNetworkSkills = (skillsCatalog: SkillCatalogEntry[], gradesCatalog: GradeCatalogEntry[]) => {
  const { data: identity } = useGetIdentity<{ id: string }>();
  const { result: profilesResult, query: profilesQuery } = useList({ resource: 'profile', pagination: { pageSize: 200 } });
  const profilesLoading = profilesQuery.isLoading;

  const [members, setMembers] = useState<NetworkMember[]>([]);
  const [loading, setLoading] = useState(false);

  const skillsById = useMemo(() => new Map(skillsCatalog.map(skill => [skill.id, skill])), [skillsCatalog]);
  const gradesById = useMemo(() => new Map(gradesCatalog.map(grade => [grade.id, grade])), [gradesCatalog]);

  useEffect(() => {
    let cancelled = false;

    const resolve = async () => {
      const profiles = profilesResult?.data ?? [];
      if (profiles.length === 0) {
        setMembers([]);
        return;
      }

      setLoading(true);
      try {
        const resolved = await Promise.all(
          profiles.map(async (profile: any): Promise<NetworkMember | undefined> => {
            const profileUri = profile.id;
            const webId = asId(profile['describes']) || profileUri;
            const name =
              asLiteral(profile['vcard:given-name']) ||
              asLiteral(profile['vcard:fn']) ||
              webId;
            const photo = asId(profile['vcard:photo']) || asLiteral(profile['vcard:photo']);

            // Skills: resolve each pair:hasExperience link into a displayable skill.
            const experienceUris = asArray(firstOf(profile, PAIR_HAS_EXPERIENCE)).map(asId).filter(Boolean) as string[];
            const experiences = await Promise.all(
              experienceUris.map(async (uri): Promise<NetworkSkill | undefined> => {
                const resource = await fetchPublicResource(uri);
                if (!resource) return undefined;
                const skillId = asId(firstOf(resource, PAIR_EXPERIENCE_SKILL));
                const gradeId = asId(firstOf(resource, PAIR_EXPERIENCE_GRADE));
                const skill = skillId ? skillsById.get(skillId) : undefined;
                const grade = gradeId ? gradesById.get(gradeId) : undefined;
                if (!skill || !grade) return undefined;
                return {
                  uri,
                  skillId: skill.id,
                  skillLabel: skill.label,
                  gradeLabel: grade.label,
                  gradePosition: grade.position,
                  summary: asLiteral(firstOf(resource, AS_SUMMARY))
                };
              })
            );
            const skills = experiences.filter((skill): skill is NetworkSkill => Boolean(skill));

            // Position: the Pod provider copies vcard:hasGeo onto the Profile itself when the
            // address is saved (see @activitypods pod-provider's services/profiles/profile.ts,
            // `before.put` hook) — it's NOT on the Location resource. Since it's embedded right
            // on the profile we already fetched, no extra request (and no dependency on the
            // separate "share my address" step) is needed to read it.
            let lat: number | undefined;
            let lng: number | undefined;
            const geo = profile['vcard:hasGeo'];
            if (geo) {
              lat = Number(asLiteral(geo['vcard:latitude']));
              lng = Number(asLiteral(geo['vcard:longitude']));
              if (Number.isNaN(lat) || Number.isNaN(lng)) {
                lat = undefined;
                lng = undefined;
              }
            }

            // Skip contacts who haven't declared any skill yet — nothing to show on the map.
            if (skills.length === 0) return undefined;

            return { webId, isSelf: webId === identity?.id, name, photo, lat, lng, skills };
          })
        );

        if (!cancelled) setMembers(resolved.filter((member): member is NetworkMember => Boolean(member)));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    resolve();
    return () => {
      cancelled = true;
    };
    // profilesQuery.dataUpdatedAt (a timestamp, not an object reference) is used instead of
    // profilesResult itself: Refine reconstructs that wrapper object on every render regardless
    // of whether the underlying data actually changed, which turned this into an infinite loop
    // (each run called setMembers/setLoading, triggering a re-render, producing a new wrapper,
    // re-triggering the effect...).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profilesQuery.dataUpdatedAt, identity?.id, skillsById, gradesById]);

  return { members, loading: profilesLoading || loading };
};
