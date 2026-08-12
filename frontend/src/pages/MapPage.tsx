import { useEffect, useState } from 'react';
import { Layout, Spin } from 'antd';
import { useNavigate } from 'react-router';
import { useList } from '@refinedev/core';
import AppHeader from '../components/AppHeader';
import CategoryMenu from '../components/CategoryMenu';
import NetworkMap from '../components/NetworkMap';
import MemberDrawer from '../components/MemberDrawer';
import { useNetworkSkills } from '../hooks/useNetworkSkills';
import { useCatalogs } from '../hooks/useCatalogs';
import type { NetworkMember } from '../hooks/useNetworkSkills';

const { Content } = Layout;

const MapPage = () => {
  const navigate = useNavigate();
  const { skills, grades, loading: catalogsLoading } = useCatalogs();
  const { members, loading: membersLoading } = useNetworkSkills(skills, grades);
  const { result: ownExperiences, query: ownExperiencesQuery } = useList({
    resource: 'experiences',
    pagination: { pageSize: 1 }
  });
  // `isLoading` only reflects the very first fetch ever made for this query key. Right after
  // onboarding creates the user's first skill and navigates back here, this same query already
  // has a *cached* (empty) result from the very first time this user ever landed on this page —
  // before onboarding, when they genuinely had none yet — so React Query serves that stale empty
  // list immediately (isLoading: false) while silently revalidating in the background
  // (fetchStatus: "fetching"). Gating on isLoading alone reacted to that stale snapshot and
  // redirected back to /onboarding even though the skill really had been created. Waiting for
  // fetchStatus to settle too fixes it — confirmed via a debug log showing exactly this
  // (status: "success", data: [], fetchStatus: "fetching" right after finishing onboarding).
  const ownExperiencesSettled = ownExperiencesQuery.fetchStatus !== 'fetching';

  const [selectedSkillId, setSelectedSkillId] = useState<string>();
  const [selectedMember, setSelectedMember] = useState<NetworkMember>();

  const hasOwnExperiences = (ownExperiences?.data?.length ?? 0) > 0;

  useEffect(() => {
    if (ownExperiencesSettled && !hasOwnExperiences) {
      navigate('/onboarding');
    }
  }, [ownExperiencesSettled, hasOwnExperiences, navigate]);

  // A selected node can be a precise skill (match its id directly) or a category (match any of
  // its children skills).
  const matchingSkillIds = selectedSkillId
    ? new Set([selectedSkillId, ...skills.filter(skill => skill.parentId === selectedSkillId).map(skill => skill.id)])
    : undefined;
  const visibleMembers = matchingSkillIds
    ? members.filter(member => member.skills.some(skill => matchingSkillIds.has(skill.skillId)))
    : members;

  // Don't mount the map (and load Mapbox) until we actually know there's something to show —
  // otherwise it briefly loads on every visit that's about to redirect to /onboarding.
  if (!ownExperiencesSettled || !hasOwnExperiences) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    // 100vh rather than a % chain: percentages need every single ancestor div (including ones
    // outside our control, e.g. antd's own <App> wrapper) to resolve a definite height, whereas
    // vh is purely viewport-relative and doesn't depend on the DOM ancestor chain at all.
    <Layout style={{ height: '100vh' }}>
      <AppHeader />
      <Layout style={{ height: 'calc(100vh - 64px)' }}>
        <CategoryMenu skills={skills} selectedSkillId={selectedSkillId} onSelect={setSelectedSkillId} />
        <Content style={{ position: 'relative', height: '100%' }}>
          {(catalogsLoading || membersLoading) && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
              <Spin size="large" />
            </div>
          )}
          <NetworkMap
            members={visibleMembers}
            selectedWebId={selectedMember?.webId}
            onSelect={member => setSelectedMember(member)}
          />
        </Content>
      </Layout>
      <MemberDrawer member={selectedMember} onClose={() => setSelectedMember(undefined)} />
    </Layout>
  );
};

export default MapPage;
