import { Drawer, Avatar, Typography, Tag, Collapse } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import type { NetworkMember } from '../hooks/useNetworkSkills';

const { Title } = Typography;

const GRADE_COLORS: Record<number, string> = {
  1: 'green', // Débutant — highlighted on purpose: this app wants beginners on the map too
  2: 'blue',
  3: 'purple',
  4: 'gold'
};

type Props = {
  member?: NetworkMember;
  onClose: () => void;
};

const MemberDrawer = ({ member, onClose }: Props) => (
  <Drawer open={Boolean(member)} onClose={onClose} width={360} title={null} closable>
    {member && (
      <>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Avatar size={96} src={member.photo} icon={!member.photo && <UserOutlined />} />
          <Title level={4} style={{ marginTop: 12 }}>
            {member.name}
          </Title>
        </div>

        <Title level={5}>Compétences ({member.skills.length})</Title>
        <Collapse
          accordion
          items={member.skills.map((skill, index) => ({
            key: index,
            label: (
              <>
                {skill.skillLabel} <Tag color={GRADE_COLORS[skill.gradePosition] ?? 'default'}>{skill.gradeLabel}</Tag>
              </>
            ),
            children: skill.summary || 'Aucune description.'
          }))}
        />
      </>
    )}
  </Drawer>
);

export default MemberDrawer;
