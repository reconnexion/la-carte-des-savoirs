import { useEffect, useMemo, useRef, useState } from 'react';
import { useList, useGetIdentity } from '@refinedev/core';
import { authProvider } from '../providers';
import type { SkillCatalogEntry, GradeCatalogEntry } from '../config/catalog';

// Full IRIs for our custom pair# terms: the profile/experience resources come straight from the
// Pod provider's own JSON-LD serialization, which has no reason to know about our "pair" CURIE
// prefix, so these predicates are very likely to come back as full IRIs rather than compacted.
// We check both forms defensively.
const PAIR_HAS_EXPERIENCE = ['http://virtual-assembly.org/ontologies/pair#hasExperience', 'pair:hasExperience'];
const PAIR_EXPERIENCE_SKILL = ['http://virtual-assembly.org/ontologies/pair#experienceSkill', 'pair:experienceSkill'];
const PAIR_EXPERIENCE_GRADE = ['http://virtual-assembly.org/ontologies/pair#experienceGrade', 'pair:experienceGrade'];
const AS_SUMMARY = ['https://www.w3.org/ns/activitystreams#summary', 'as:summary', 'summary'];
const APODS_RECOMMENDED_BY = ['http://activitypods.org/ns/core#recommendedBy', 'apods:recommendedBy'];
const DC_CREATED = ['http://purl.org/dc/terms/created', 'dc:created'];

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
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') return value;
  // Numeric/boolean literals (e.g. vcard:latitude, schema:position) compact to plain JS
  // values in JSON-LD when the context gives them a @type coercion — not the verbose
  // {"@value": ...} form, which only shows up for language-tagged or non-coerced literals.
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') return (value as any)['@value'];
  return undefined;
};

/** `token` is only needed for the connected user's own resources (e.g. their address before
 * they've shared it with contacts) — anyone else's is fetched publicly, same as skills. */
const fetchResource = async (uri: string, token?: string): Promise<Record<string, any> | undefined> => {
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

export type NetworkSkill = {
  uri: string;
  skillId: string;
  skillLabel: string;
  categoryLabel?: string;
  gradeLabel: string;
  gradePosition: number;
  summary?: string;
  /** URIs of the apods:Endorse activities recommending this skill — each hosted on its own
   * recommender's Pod, see useEndorsements. */
  recommendationUris: string[];
};

export type NetworkMember = {
  webId: string;
  profileUri: string;
  isSelf: boolean;
  name: string;
  photo?: string;
  bio?: string;
  memberSince?: string;
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

  const skillsById = useMemo(() => new Map(skillsCatalog.map(skill => [skill.id, skill])), [skillsCatalog]);
  const gradesById = useMemo(() => new Map(gradesCatalog.map(grade => [grade.id, grade])), [gradesCatalog]);
  const catalogsReady = skillsCatalog.length > 0 && gradesCatalog.length > 0;

  // `members` is only trustworthy once a resolve() has actually completed *for the current
  // inputs*. A useState-based "loading" flag set from inside the effect can't capture that
  // precisely: the render where dataUpdatedAt/catalogsReady/etc. just changed still shows the
  // *previous* loading value, because the effect that would flip it hasn't run yet (effects fire
  // after commit) — confirmed live: the deep-link "not visible" check in MapPage kept firing
  // during that exact one-render gap, moments before the map displayed everyone correctly.
  // Comparing the current inputs against "what members was last resolved for" is a pure
  // render-time computation with no such lag: this render either matches the last completed run
  // or it doesn't, no effect needs to have run yet for that to be known.
  const lastResolvedRef = useRef<{
    dataUpdatedAt: number;
    identityId?: string;
    skillsCatalog: SkillCatalogEntry[];
    gradesCatalog: GradeCatalogEntry[];
  } | null>(null);
  const isStale =
    !catalogsReady ||
    !lastResolvedRef.current ||
    lastResolvedRef.current.dataUpdatedAt !== profilesQuery.dataUpdatedAt ||
    lastResolvedRef.current.identityId !== identity?.id ||
    lastResolvedRef.current.skillsCatalog !== skillsCatalog ||
    lastResolvedRef.current.gradesCatalog !== gradesCatalog;

  useEffect(() => {
    let cancelled = false;
    if (!catalogsReady) return;

    // Captured now so the ref gets stamped with exactly the inputs this run used, even if props/
    // query state have already moved on again by the time it finishes.
    const resolvedFor = { dataUpdatedAt: profilesQuery.dataUpdatedAt, identityId: identity?.id, skillsCatalog, gradesCatalog };

    const resolve = async () => {
      const profiles = profilesResult?.data ?? [];
      if (profiles.length === 0) {
        if (!cancelled) {
          setMembers([]);
          lastResolvedRef.current = resolvedFor;
        }
        return;
      }

      try {
        const resolved = await Promise.all(
          profiles.map(async (profile: any): Promise<NetworkMember | undefined> => {
            const profileUri = profile.id;
            const webId = asId(profile['describes']) || profileUri;
            const isSelf = webId === identity?.id;
            // Our own resources may not be public yet (e.g. address shared but not yet
            // confirmed) — read those authenticated, so we always see ourselves regardless of
            // sharing status. Anyone else's must be public (the whole point of the "share with
            // contacts" step), so read those anonymously, same as the real audience would.
            const token = isSelf ? authProvider.getSession()?.token : undefined;

            const name =
              asLiteral(profile['vcard:given-name']) ||
              asLiteral(profile['vcard:fn']) ||
              webId;
            const photo = asId(profile['vcard:photo']) || asLiteral(profile['vcard:photo']);
            const bio = asLiteral(profile['vcard:note']);

            // "Member since": dc:created lives on the WebID document itself, not the profile —
            // same predicate/resource the Pod provider's own frontend reads it from (its Actor
            // resource is the WebID). Not already fetched for anything else, hence the extra
            // request here.
            const webIdDoc = await fetchResource(webId, token);
            const memberSince = webIdDoc ? asLiteral(firstOf(webIdDoc, DC_CREATED)) : undefined;

            // Skills: resolve each pair:hasExperience link into a displayable skill.
            const experienceUris = asArray(firstOf(profile, PAIR_HAS_EXPERIENCE)).map(asId).filter(Boolean) as string[];
            const experiences = await Promise.all(
              experienceUris.map(async (uri): Promise<NetworkSkill | undefined> => {
                const resource = await fetchResource(uri, token);
                if (!resource) return undefined;
                const skillId = asId(firstOf(resource, PAIR_EXPERIENCE_SKILL));
                const gradeId = asId(firstOf(resource, PAIR_EXPERIENCE_GRADE));
                const skill = skillId ? skillsById.get(skillId) : undefined;
                const grade = gradeId ? gradesById.get(gradeId) : undefined;
                if (!skill || !grade) return undefined;
                const category = skill.parentId ? skillsById.get(skill.parentId) : undefined;
                return {
                  uri,
                  skillId: skill.id,
                  skillLabel: skill.label,
                  categoryLabel: category?.label,
                  gradeLabel: grade.label,
                  gradePosition: grade.position,
                  summary: asLiteral(firstOf(resource, AS_SUMMARY)),
                  recommendationUris: asArray(firstOf(resource, APODS_RECOMMENDED_BY)).map(asId).filter(Boolean) as string[]
                };
              })
            );
            const skills = experiences.filter((skill): skill is NetworkSkill => Boolean(skill));

            // Position: the Pod provider itself copies the linked Location's exact lat/lng onto the
            // profile whenever it's PUT with vcard:hasAddress set (see AddressEditor.tsx) — already
            // right here in the same profile record we fetched for name/photo/skills, no extra
            // request needed. The Location resource itself stays private; this app never reads it
            // directly. Note this is the *exact* geocoded position, not a jittered approximation —
            // see the README/AddressEditor for the current state of that tradeoff.
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

            return { webId, profileUri, isSelf, name, photo, bio, memberSince, lat, lng, skills };
          })
        );

        if (!cancelled) {
          setMembers(resolved.filter((member): member is NetworkMember => Boolean(member)));
          lastResolvedRef.current = resolvedFor;
        }
      } catch {
        // Still stamp it "resolved" so a genuine error doesn't leave callers spinning forever —
        // members simply keeps whatever it last successfully held.
        if (!cancelled) lastResolvedRef.current = resolvedFor;
      }
    };

    resolve();
    return () => {
      cancelled = true;
    };
    // profilesQuery.dataUpdatedAt (a timestamp, not an object reference) is used instead of
    // profilesResult itself: Refine reconstructs that wrapper object on every render regardless
    // of whether the underlying data actually changed, which turned this into an infinite loop
    // (each run called setMembers, triggering a re-render, producing a new wrapper, re-triggering
    // the effect...).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profilesQuery.dataUpdatedAt, identity?.id, skillsById, gradesById, catalogsReady]);

  return { members, loading: profilesLoading || isStale, refetch: profilesQuery.refetch };
};
