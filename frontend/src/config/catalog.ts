// Fetches the two small public catalogs (pair:Skill categories/skills, pair:Grade levels) hosted
// directly by our own backend as plain public LDP containers (see backend/services/skills-catalog.service.js
// and grades-catalog.service.js). These are not Pod resources, so they're read with a plain
// unauthenticated fetch rather than through the Refine dataProvider.

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL as string;

export type SkillCatalogEntry = {
  id: string;
  label: string;
  /** URI of the parent (level 1) skill/category, if this is a level 2 (precise) skill. */
  parentId?: string;
};

export type GradeCatalogEntry = {
  id: string;
  label: string;
  position: number;
};

const LDP_CONTAINS = 'http://www.w3.org/ns/ldp#contains';
const RDFS_LABEL = 'http://www.w3.org/2000/01/rdf-schema#label';
const SKOS_BROADER = 'http://www.w3.org/2004/02/skos/core#broader';
const SCHEMA_POSITION = 'http://schema.org/position';

const asId = (value: unknown): string | undefined => {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return asId(value[0]);
  if (typeof value === 'object') return (value as any).id || (value as any)['@id'];
  return undefined;
};

const asLiteral = (value: unknown): string | undefined => {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return asLiteral(value[0]);
  if (typeof value === 'object') return (value as any)['@value'];
  return undefined;
};

const fetchContainerMembers = async (containerUri: string): Promise<Record<string, any>[]> => {
  const response = await fetch(containerUri, { headers: { Accept: 'application/ld+json' } });
  if (!response.ok) throw new Error(`Could not fetch catalog at ${containerUri} (${response.status})`);
  const body = await response.json();
  const doc = Array.isArray(body) ? body[0] : body;
  const members = doc?.[LDP_CONTAINS] || doc?.['ldp:contains'] || [];
  const memberList = Array.isArray(members) ? members : [members];

  // Container listings may already embed full member data, or just references: fetch any member
  // that doesn't already carry a label.
  return Promise.all(
    memberList.map(async (member: any) => {
      if (member?.[RDFS_LABEL] || member?.['rdfs:label']) return member;
      const memberUri = asId(member);
      if (!memberUri) return member;
      const memberResponse = await fetch(memberUri, { headers: { Accept: 'application/ld+json' } });
      if (!memberResponse.ok) return member;
      const memberBody = await memberResponse.json();
      return Array.isArray(memberBody) ? memberBody[0] : memberBody;
    })
  );
};

export const fetchSkillsCatalog = async (): Promise<SkillCatalogEntry[]> => {
  const members = await fetchContainerMembers(`${BACKEND_URL}pair/skill`);
  return members.map(member => ({
    id: asId(member) || member.id,
    label: asLiteral(member[RDFS_LABEL] ?? member['rdfs:label']) || '',
    parentId: asId(member[SKOS_BROADER] ?? member['skos:broader'])
  }));
};

export const fetchGradesCatalog = async (): Promise<GradeCatalogEntry[]> => {
  const members = await fetchContainerMembers(`${BACKEND_URL}pair/grade`);
  return members
    .map(member => ({
      id: asId(member) || member.id,
      label: asLiteral(member[RDFS_LABEL] ?? member['rdfs:label']) || '',
      position: Number(asLiteral(member[SCHEMA_POSITION] ?? member['schema:position']) ?? 0)
    }))
    .sort((a, b) => a.position - b.position);
};

/** Groups a flat skills catalog into a 2-level tree (categories -> precise skills). */
export const buildSkillsTree = (skills: SkillCatalogEntry[]) => {
  const categories = skills.filter(skill => !skill.parentId);
  return categories.map(category => ({
    ...category,
    children: skills.filter(skill => skill.parentId === category.id)
  }));
};
