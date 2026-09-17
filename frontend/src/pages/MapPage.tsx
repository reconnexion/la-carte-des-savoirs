import { useEffect, useRef, useState } from 'react';
import { Layout, Spin, Alert, App, Grid, Button } from 'antd';
import { FilterOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router';
import { useList } from '@refinedev/core';
import AppHeader from '../components/AppHeader';
import CategoryMenu from '../components/CategoryMenu';
import NetworkMap from '../components/NetworkMap';
import MemberPanel from '../components/MemberPanel';
import ProfileDialog from '../components/ProfileDialog';
import { useNetworkSkills } from '../hooks/useNetworkSkills';
import { useCatalogs } from '../hooks/useCatalogs';
import { parseHandle, userProfilePath } from '../config/webfinger';

const { Content } = Layout;

const MapPage = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { handle } = useParams<{ handle?: string }>();
  // antd's own breakpoint hook, so "mobile" tracks the same breakpoints its own components (e.g.
  // CategoryMenu's Sider `breakpoint="lg"`) already use elsewhere in this app.
  const screens = Grid.useBreakpoint();
  const isMobile = screens.md === false;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { skills, grades, loading: catalogsLoading } = useCatalogs();
  const { members, loading: membersLoading, refetch: refetchNetwork } = useNetworkSkills(skills, grades);
  const { result: ownExperiences, query: ownExperiencesQuery } = useList({
    resource: 'experiences',
    pagination: { pageSize: 1 }
  });
  // `isLoading` only reflects the very first fetch ever made for this query key. Right after the
  // profile dialog creates the user's first skill, this same query already has a *cached*
  // (empty) result from the very first time this user ever landed on this page — before they'd
  // added anything — so React Query serves that stale empty list immediately (isLoading: false)
  // while silently revalidating in the background (fetchStatus: "fetching"). Gating on isLoading
  // alone would react to that stale snapshot. Waiting for fetchStatus to settle too fixes it —
  // confirmed via a debug log showing exactly this (status: "success", data: [], fetchStatus:
  // "fetching" right after finishing the dialog).
  const ownExperiencesSettled = ownExperiencesQuery.fetchStatus !== 'fetching';
  const hasOwnExperiences = (ownExperiences?.data?.length ?? 0) > 0;

  const [selectedSkillId, setSelectedSkillId] = useState<string>();

  // The URL (via the /user/:handle route, see App.tsx) is the single source of truth for which
  // member's panel is open — both a marker click and a notification-email deep link just navigate
  // there, so selecting a member is always reflected in the address bar and is bookmarkable/
  // shareable, and there's only one place (this derivation) that decides what's selected.
  const selectedWebId = handle ? parseHandle(handle) : undefined;
  const selectedMember = selectedWebId ? members.find(member => member.webId === selectedWebId) : undefined;

  // Warn (once per distinct handle) if a /user/:handle deep link doesn't resolve to anyone
  // currently visible to this viewer — same native contacts-based visibility as the rest of the
  // map, nothing special added for this route. Only fires once members has actually finished
  // loading *with the catalogs available* — on a direct/hard page load, catalogsLoading and
  // useNetworkSkills' own profilesLoading resolve independently, and useNetworkSkills can finish
  // its first resolve pass against still-empty catalogs (skillsById/gradesById), which briefly
  // produces an empty members list — checking membersLoading alone wasn't enough to rule that
  // out, only catalogsLoading || membersLoading together is.
  const warnedHandleRef = useRef<string>();
  useEffect(() => {
    if (!handle || catalogsLoading || membersLoading || warnedHandleRef.current === handle) return;
    if (!selectedMember) {
      warnedHandleRef.current = handle;
      message.warning("Ce profil n'est pas (ou plus) visible dans votre réseau.");
    }
  }, [handle, selectedMember, catalogsLoading, membersLoading, message]);

  // Selecting a member mounts SkillCard/useEndorsements components that query the same 'profile'
  // resource useNetworkSkills already did — React Query refetches that shared cache entry in the
  // background on the new mount (default staleTime: 0), which then re-triggers
  // useNetworkSkills' own resolve effect (it depends on profilesQuery.dataUpdatedAt) and briefly
  // flips membersLoading back to true. That's a harmless background resync, not a real loading
  // state worth interrupting the map for, so the overlay below is only shown for the genuine
  // first load.
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  useEffect(() => {
    if (!catalogsLoading && !membersLoading) setHasLoadedOnce(true);
  }, [catalogsLoading, membersLoading]);

  // The profile dialog now lives on top of the map instead of a separate /onboarding route: pop
  // it open once, automatically, the first time we can confirm this user genuinely has nothing
  // filled in yet (possibly because they already filled it in via another ActivityPods app, in
  // which case hasOwnExperiences is already true and this never fires). The ref guards against
  // re-opening it on every background refetch of ownExperiences once the user has closed it.
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [showReminderBanner, setShowReminderBanner] = useState(false);
  const hasAutoOpened = useRef(false);
  useEffect(() => {
    if (!hasAutoOpened.current && ownExperiencesSettled && !hasOwnExperiences) {
      hasAutoOpened.current = true;
      setProfileDialogOpen(true);
    }
  }, [ownExperiencesSettled, hasOwnExperiences]);

  // Once the user actually has a skill, any earlier "come finish your profile" reminder is moot.
  useEffect(() => {
    if (hasOwnExperiences) setShowReminderBanner(false);
  }, [hasOwnExperiences]);

  // Adding a skill/address doesn't make the user show up on the map instantly: the profile's own
  // pair:hasExperience / vcard:hasGeo links are only added once the backend's own onCreate hook
  // (or the Pod provider's before.put geo sync) has processed it, which is asynchronous. A single
  // refetch right on close is often too early, so this retries a few more times with backoff
  // rather than making the user manually reload the page to see themselves appear.
  const pollTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => pollTimers.current.forEach(clearTimeout), []);
  const pollForProfileUpdate = () => {
    pollTimers.current.forEach(clearTimeout);
    const refetchBoth = () => {
      refetchNetwork();
      ownExperiencesQuery.refetch();
    };
    refetchBoth();
    pollTimers.current = [1000, 3000, 6000, 10000].map(delay => setTimeout(refetchBoth, delay));
  };

  const handleProfileDialogClose = () => {
    setProfileDialogOpen(false);
    if (!hasOwnExperiences) setShowReminderBanner(true);
    pollForProfileUpdate();
  };

  // A selected node can be a precise skill (match its id directly) or a category (match any of
  // its children skills).
  const matchingSkillIds = selectedSkillId
    ? new Set([selectedSkillId, ...skills.filter(skill => skill.parentId === selectedSkillId).map(skill => skill.id)])
    : undefined;
  const visibleMembers = matchingSkillIds
    ? members.filter(member => member.skills.some(skill => matchingSkillIds.has(skill.skillId)))
    : members;

  return (
    // 100vh rather than a % chain: percentages need every single ancestor div (including ones
    // outside our control, e.g. antd's own <App> wrapper) to resolve a definite height, whereas
    // vh is purely viewport-relative and doesn't depend on the DOM ancestor chain at all.
    <Layout style={{ height: '100vh' }}>
      <AppHeader onOpenProfile={() => setProfileDialogOpen(true)} isMobile={isMobile} />
      <Layout style={{ height: 'calc(100vh - 64px)' }}>
        <CategoryMenu
          skills={skills}
          selectedSkillId={selectedSkillId}
          onSelect={setSelectedSkillId}
          isMobile={isMobile}
          mobileOpen={filtersOpen}
          onMobileClose={() => setFiltersOpen(false)}
        />
        <Content style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}>
          {showReminderBanner && (
            <Alert
              banner
              type="info"
              showIcon
              closable
              onClose={() => setShowReminderBanner(false)}
              message="Ajoutez au moins une compétence pour apparaître sur la carte."
              action={
                <a onClick={() => setProfileDialogOpen(true)} style={{ cursor: 'pointer' }}>
                  Compléter mon profil
                </a>
              }
            />
          )}
          <div style={{ position: 'relative', flex: 1 }}>
            {isMobile && (
              <Button
                icon={<FilterOutlined />}
                onClick={() => setFiltersOpen(true)}
                style={{
                  position: 'absolute',
                  top: 12,
                  left: 12,
                  zIndex: 1,
                  background: '#fff',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.25)'
                }}
              >
                Filtres
              </Button>
            )}
            {!hasLoadedOnce && (catalogsLoading || membersLoading) && (
              <div
                style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}
              >
                <Spin size="large" />
              </div>
            )}
            <NetworkMap
              members={visibleMembers}
              selectedWebId={selectedMember?.webId}
              onSelect={member => navigate(userProfilePath(member.webId))}
            />
          </div>
        </Content>
        <MemberPanel member={selectedMember} onClose={() => navigate('/')} isMobile={isMobile} />
      </Layout>
      <ProfileDialog open={profileDialogOpen} onClose={handleProfileDialogClose} />
    </Layout>
  );
};

export default MapPage;
