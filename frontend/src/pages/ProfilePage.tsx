import { Layout, Card, Typography, List, Tag, Button, Avatar, Space, Divider, message } from 'antd';
import { ArrowLeftOutlined, DeleteOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router';
import { useCreate, useDelete, useGetIdentity, useList } from '@refinedev/core';
import AppHeader from '../components/AppHeader';
import SkillPicker from '../components/SkillPicker';
import AddressEditor from '../components/AddressEditor';
import { useCatalogs } from '../hooks/useCatalogs';
import type { SkillCatalogEntry, GradeCatalogEntry } from '../config/catalog';

const { Content } = Layout;
const { Title } = Typography;

const PAIR_EXPERIENCE_SKILL = ['http://virtual-assembly.org/ontologies/pair#experienceSkill', 'pair:experienceSkill'];
const PAIR_EXPERIENCE_GRADE = ['http://virtual-assembly.org/ontologies/pair#experienceGrade', 'pair:experienceGrade'];

const firstOf = (record: Record<string, any>, keys: string[]): any => keys.map(key => record[key]).find(Boolean);
const asId = (value: unknown): string | undefined => {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return (value as any).id || (value as any)['@id'];
  return undefined;
};

const resolveOwnSkills = (records: any[], skills: SkillCatalogEntry[], grades: GradeCatalogEntry[]) =>
  records.map(record => {
    const skillId = asId(firstOf(record, PAIR_EXPERIENCE_SKILL));
    const gradeId = asId(firstOf(record, PAIR_EXPERIENCE_GRADE));
    return {
      uri: record.id,
      skillLabel: skills.find(skill => skill.id === skillId)?.label ?? 'Compétence inconnue',
      gradeLabel: grades.find(grade => grade.id === gradeId)?.label ?? ''
    };
  });

const ProfilePage = () => {
  const navigate = useNavigate();
  const { data: identity } = useGetIdentity<{ id: string; name?: string; avatar?: string }>();
  const { skills, grades, loading: catalogsLoading } = useCatalogs();
  const { result: experiences, query: experiencesQuery } = useList({ resource: 'experiences', pagination: { pageSize: 200 } });
  const { mutateAsync: createExperience, mutation: createMutation } = useCreate();
  const { mutateAsync: deleteExperience } = useDelete();

  const ownSkills = resolveOwnSkills(experiences.data, skills, grades);

  const handleAdd = async (pick: { skillId: string; gradeId: string; summary?: string }) => {
    try {
      await createExperience({
        resource: 'experiences',
        values: {
          'http://virtual-assembly.org/ontologies/pair#experienceSkill': { '@id': pick.skillId },
          'http://virtual-assembly.org/ontologies/pair#experienceGrade': { '@id': pick.gradeId },
          ...(pick.summary ? { 'https://www.w3.org/ns/activitystreams#summary': pick.summary } : {})
        }
      });
      experiencesQuery.refetch();
    } catch {
      message.error("Impossible d'ajouter cette compétence pour le moment.");
    }
  };

  const handleDelete = async (uri: string) => {
    try {
      await deleteExperience({ resource: 'experiences', id: uri });
      experiencesQuery.refetch();
    } catch {
      message.error('Impossible de supprimer cette compétence pour le moment.');
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <AppHeader />
      <Content style={{ maxWidth: 720, margin: '32px auto', width: '100%', padding: '0 24px' }}>
        <Button icon={<ArrowLeftOutlined />} type="text" onClick={() => navigate('/')} style={{ marginBottom: 16 }}>
          Retour à la carte
        </Button>

        <Card>
          <Space align="center" size={16} style={{ marginBottom: 24 }}>
            <Avatar size={64} src={identity?.avatar} icon={!identity?.avatar && <UserOutlined />} />
            <Title level={3} style={{ margin: 0 }}>
              {identity?.name}
            </Title>
          </Space>

          <Title level={4}>Mes compétences</Title>
          <List
            loading={experiencesQuery.isLoading}
            dataSource={ownSkills}
            locale={{ emptyText: 'Vous n\'avez pas encore déclaré de compétence.' }}
            renderItem={item => (
              <List.Item
                actions={[<Button type="text" icon={<DeleteOutlined />} onClick={() => handleDelete(item.uri)} />]}
              >
                {item.skillLabel} <Tag>{item.gradeLabel}</Tag>
              </List.Item>
            )}
          />

          {!catalogsLoading && (
            <div style={{ marginTop: 16 }}>
              <SkillPicker skills={skills} grades={grades} onAdd={handleAdd} loading={createMutation.isPending} />
            </div>
          )}

          <Divider />

          <Title level={4}>Mon adresse</Title>
          <AddressEditor />
        </Card>
      </Content>
    </Layout>
  );
};

export default ProfilePage;
