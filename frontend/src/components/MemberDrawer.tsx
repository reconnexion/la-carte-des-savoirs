import { Drawer, Avatar, Typography, Tag, Collapse, Space } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import type { NetworkMember } from '../hooks/useNetworkSkills';
import { getCategoryIcon } from '../config/categoryIcons';

const { Title, Text } = Typography;

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
  <Drawer open={Boolean(member)} onClose={onClose} width={380} title={null} closable styles={{ body: { padding: 0 } }}>
    {member && (
      <>
        <div
          style={{
            background: 'linear-gradient(135deg, #1677ff 0%, #4096ff 100%)',
            padding: '40px 24px 24px',
            textAlign: 'center'
          }}
        >
          <Avatar
            size={112}
            src={member.photo}
            icon={!member.photo && <UserOutlined />}
            style={{ border: '4px solid #fff', boxShadow: '0 2px 10px rgba(0,0,0,0.25)' }}
          />
          <Title level={4} style={{ marginTop: 16, marginBottom: 0, color: '#fff' }}>
            {member.name}
          </Title>
        </div>

        <div style={{ padding: '20px 24px' }}>
          <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
            {member.skills.length} compétence{member.skills.length > 1 ? 's' : ''}
          </Text>
          <Collapse
            accordion
            bordered={false}
            style={{ background: 'transparent' }}
            items={member.skills.map((skill, index) => ({
              key: index,
              label: (
                <Space align="center">
                  <Avatar size={32} icon={getCategoryIcon(skill.categoryLabel)} style={{ background: '#e6f4ff', color: '#1677ff' }} />
                  <span>
                    {skill.skillLabel} <Tag color={GRADE_COLORS[skill.gradePosition] ?? 'default'}>{skill.gradeLabel}</Tag>
                  </span>
                </Space>
              ),
              children: skill.summary || 'Aucune description.'
            }))}
          />
        </div>
      </>
    )}
  </Drawer>
);

export default MemberDrawer;
