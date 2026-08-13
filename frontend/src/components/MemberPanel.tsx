import { useState } from 'react';
import { Layout, Avatar, Typography, Button, Drawer } from 'antd';
import { UserOutlined, CloseOutlined, MessageOutlined } from '@ant-design/icons';
import { useGetIdentity } from '@refinedev/core';
import type { NetworkMember } from '../hooks/useNetworkSkills';
import { authProvider } from '../providers';
import { openAppProfileUrl } from '../config/openApp';
import SkillCard from './SkillCard';
import ContactDialog from './ContactDialog';

const { Sider } = Layout;
const { Title, Text } = Typography;

const PANEL_WIDTH = 380;

// Same format the ActivityPods frontend itself uses for a WebID's dc:created ("Date d'inscription").
const formatMemberSince = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
};

type Props = {
  member?: NetworkMember;
  onClose: () => void;
  /** On mobile this renders full-width over everything (including the category menu) as a
   * Drawer, since a fixed 380px sider would eat most or all of a small screen anyway. */
  isMobile: boolean;
};

/** On desktop, a right-hand sider rather than a modal Drawer: sits in the same flex row as the
 * map (like CategoryMenu on the left), so the map underneath stays fully clickable — selecting
 * another member while this is open just swaps its content in place. */
const MemberPanel = ({ member, onClose, isMobile }: Props) => {
  const { data: identity } = useGetIdentity<{ id: string }>();
  const [contactOpen, setContactOpen] = useState(false);

  if (!member) {
    // Desktop still needs the (collapsed-to-0-width) Sider to keep the flex row's column count
    // stable; the mobile Drawer just doesn't render at all when there's nothing selected.
    return isMobile ? null : <Sider width={PANEL_WIDTH} collapsedWidth={0} collapsed trigger={null} theme="light" />;
  }

  const avatar = (
    <Avatar
      size={112}
      src={member.photo}
      icon={!member.photo && <UserOutlined />}
      style={{ border: '4px solid #fff', boxShadow: '0 2px 10px rgba(0,0,0,0.15)' }}
    />
  );

  const content = (
    <div style={{ width: isMobile ? '100%' : PANEL_WIDTH }}>
      <div
        style={{
          position: 'relative',
          // Same background antd's Menu uses for a selected item (e.g. "Toutes les compétences"
          // in CategoryMenu) — keeps the panels visually consistent instead of introducing a
          // separate, heavier blue gradient just for this one.
          background: '#e6f4ff',
          padding: '40px 24px 24px',
          textAlign: 'center'
        }}
      >
        <Button type="text" icon={<CloseOutlined />} onClick={onClose} style={{ position: 'absolute', top: 8, right: 8 }} />
        {identity && !member.isSelf ? (
          <a href={openAppProfileUrl(identity.id, member.profileUri)} target="_blank" rel="noopener noreferrer">
            {avatar}
          </a>
        ) : (
          avatar
        )}
        <Title level={4} style={{ marginTop: 16, marginBottom: 0 }}>
          {member.name}
        </Title>
        {member.bio && (
          <Text style={{ display: 'block', marginTop: 4 }} italic>
            {member.bio}
          </Text>
        )}
        {member.memberSince && (
          <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 12 }}>
            Membre depuis le {formatMemberSince(member.memberSince)}
          </Text>
        )}
        {!member.isSelf && (
          <Button type="primary" size="small" icon={<MessageOutlined />} onClick={() => setContactOpen(true)} style={{ marginTop: 12 }}>
            Contacter
          </Button>
        )}
      </div>

      <div style={{ padding: '20px 24px' }}>
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          {member.skills.length} compétence{member.skills.length > 1 ? 's' : ''}
        </Text>
        {member.skills.map(skill => (
          <SkillCard key={skill.uri} member={member} skill={skill} token={member.isSelf ? authProvider.getSession()?.token : undefined} />
        ))}
      </div>

      {!member.isSelf && <ContactDialog open={contactOpen} onClose={() => setContactOpen(false)} member={member} />}
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open placement="right" width="100%" onClose={onClose} title={null} closable={false} styles={{ body: { padding: 0 } }}>
        {content}
      </Drawer>
    );
  }

  return (
    <Sider width={PANEL_WIDTH} collapsedWidth={0} collapsed={false} trigger={null} theme="light" style={{ borderLeft: '1px solid #f0f0f0', overflow: 'auto' }}>
      {content}
    </Sider>
  );
};

export default MemberPanel;
