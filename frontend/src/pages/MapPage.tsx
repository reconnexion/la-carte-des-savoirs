import { useEffect, useState } from 'react';
import { Layout, Spin } from 'antd';
import { useNavigate } from 'react-router';
import { useList } from '@refinedev/core';
import AppHeader from '../components/AppHeader';
import CategoryTree from '../components/CategoryTree';
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
  const ownExperiencesLoading = ownExperiencesQuery.isLoading;

  const [selectedSkillId, setSelectedSkillId] = useState<string>();
  const [selectedMember, setSelectedMember] = useState<NetworkMember>();

  useEffect(() => {
    if (!ownExperiencesLoading && (ownExperiences?.data?.length ?? 0) === 0) {
      navigate('/onboarding');
    }
  }, [ownExperiencesLoading, ownExperiences, navigate]);

  // A selected node can be a precise skill (match its id directly) or a category (match any of
  // its children skills).
  const matchingSkillIds = selectedSkillId
    ? new Set([selectedSkillId, ...skills.filter(skill => skill.parentId === selectedSkillId).map(skill => skill.id)])
    : undefined;
  const visibleMembers = matchingSkillIds
    ? members.filter(member => member.skills.some(skill => matchingSkillIds.has(skill.skillId)))
    : members;

  return (
    <Layout style={{ height: '100vh' }}>
      <AppHeader />
      <Layout>
        <CategoryTree skills={skills} selectedSkillId={selectedSkillId} onSelect={setSelectedSkillId} />
        <Content style={{ position: 'relative' }}>
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
