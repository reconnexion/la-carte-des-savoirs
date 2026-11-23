import { useState } from 'react';
import { Modal, Typography, List, Tag, Button, Avatar, Space, Divider, Alert, App, Input, Radio } from 'antd';
import { ArrowLeftOutlined, DeleteOutlined, EditOutlined, PlusOutlined, UserOutlined } from '@ant-design/icons';
import { useCreate, useDelete, useGetIdentity, useList, useUpdate } from '@refinedev/core';
import SkillPicker from './SkillPicker';
import AddressEditor from './AddressEditor';
import { useCatalogs } from '../hooks/useCatalogs';
import { getCategoryIcon } from '../config/categoryIcons';
import { GRADE_COLORS } from '../config/gradeColors';
import type { SkillCatalogEntry, GradeCatalogEntry } from '../config/catalog';
import { PRIMARY_COLOR, PRIMARY_COLOR_BG } from '../config/theme';

const { Title, Text, Paragraph } = Typography;

const PAIR_EXPERIENCE_SKILL = ['http://virtual-assembly.org/ontologies/pair#experienceSkill', 'pair:experienceSkill'];
const PAIR_EXPERIENCE_GRADE = ['http://virtual-assembly.org/ontologies/pair#experienceGrade', 'pair:experienceGrade'];
const AS_SUMMARY = ['https://www.w3.org/ns/activitystreams#summary', 'as:summary'];

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
    const skill = skills.find(entry => entry.id === skillId);
    const grade = grades.find(entry => entry.id === gradeId);
    const category = skill?.parentId ? skills.find(entry => entry.id === skill.parentId) : undefined;
    return {
      uri: record.id,
      skillId: skillId ?? '',
      skillLabel: skill?.label ?? 'Savoir inconnu',
      categoryLabel: category?.label,
      gradeId: gradeId ?? '',
      gradeLabel: grade?.label ?? '',
      gradePosition: grade?.position ?? 0,
      summary: firstOf(record, AS_SUMMARY) ?? ''
    };
  });

type Props = {
  open: boolean;
  onClose: () => void;
};

/**
 * Both the first-time onboarding prompt and the regular "edit my profile" screen — same content
 * either way (skills + address), just optionally prefaced with an invitation banner when nothing's
 * filled in yet. It's a dialog on top of the map rather than a separate page/route: closing it
 * doesn't need to "go" anywhere, since the map is already right there behind it.
 */
const ProfileDialog = ({ open, onClose }: Props) => {
  const { message } = App.useApp();
  const { data: identity } = useGetIdentity<{ id: string; name?: string; avatar?: string }>();
  const { skills, grades, loading: catalogsLoading } = useCatalogs();
  const { result: experiences, query: experiencesQuery } = useList({
    resource: 'experiences',
    pagination: { pageSize: 200 },
    queryOptions: { enabled: open }
  });
  const { mutateAsync: createExperience, mutation: createMutation } = useCreate();
  const { mutateAsync: deleteExperience } = useDelete();
  const { mutateAsync: updateExperience, mutation: updateMutation } = useUpdate();

  const [addingSkill, setAddingSkill] = useState(false);
  const [editingSkill, setEditingSkill] = useState<(typeof ownSkills)[0] | null>(null);
  const [editGradeId, setEditGradeId] = useState('');
  const [editSummary, setEditSummary] = useState('');
  const [locationUri, setLocationUri] = useState<string>();
  const [addressChecked, setAddressChecked] = useState(false);

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
      setAddingSkill(false);
    } catch {
      message.error("Impossible d'ajouter ce savoir pour le moment.");
    }
  };

  const handleDelete = async (uri: string) => {
    try {
      await deleteExperience({ resource: 'experiences', id: uri });
      experiencesQuery.refetch();
    } catch {
      message.error('Impossible de supprimer ce savoir pour le moment.');
    }
  };

  const handleEditOpen = (item: (typeof ownSkills)[0]) => {
    setEditingSkill(item);
    setEditGradeId(item.gradeId);
    setEditSummary(item.summary);
  };

  const handleEdit = async () => {
    if (!editingSkill) return;
    try {
      await updateExperience({
        resource: 'experiences',
        id: editingSkill.uri,
        values: {
          'http://virtual-assembly.org/ontologies/pair#experienceSkill': { '@id': editingSkill.skillId },
          'http://virtual-assembly.org/ontologies/pair#experienceGrade': { '@id': editGradeId },
          ...(editSummary ? { 'https://www.w3.org/ns/activitystreams#summary': editSummary } : {})
        }
      });
      experiencesQuery.refetch();
      setEditingSkill(null);
    } catch {
      message.error('Impossible de modifier ce savoir pour le moment.');
    }
  };

  const handleClose = () => {
    setAddingSkill(false);
    setEditingSkill(null);
    onClose();
  };

  if (editingSkill) {
    return (
      <Modal open={open} onCancel={handleClose} footer={null} width={640} title={null} destroyOnHidden>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => setEditingSkill(null)} style={{ marginBottom: 16 }}>
          Retour
        </Button>
        <Title level={4}>Modifier ce savoir</Title>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Space align="center">
            <Avatar size={32} icon={getCategoryIcon(editingSkill.categoryLabel)} style={{ background: PRIMARY_COLOR_BG, color: PRIMARY_COLOR }} />
            <Text strong>{editingSkill.skillLabel}</Text>
          </Space>
          <Radio.Group value={editGradeId} onChange={e => setEditGradeId(e.target.value)} optionType="button">
            {grades.map(grade => <Radio.Button key={grade.id} value={grade.id}>{grade.label}</Radio.Button>)}
          </Radio.Group>
          <Input.TextArea
            placeholder="Dites-en un peu plus sur votre expérience (facultatif)"
            value={editSummary}
            onChange={e => setEditSummary(e.target.value)}
            rows={2}
          />
          <Button type="primary" onClick={handleEdit} loading={updateMutation.isPending} disabled={!editGradeId}>
            Enregistrer
          </Button>
        </Space>
      </Modal>
    );
  }

  if (addingSkill) {
    return (
      <Modal open={open} onCancel={handleClose} footer={null} width={640} title={null} destroyOnHidden>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => setAddingSkill(false)} style={{ marginBottom: 16 }}>
          Retour
        </Button>
        <Title level={4}>Ajouter un savoir</Title>
        <SkillPicker skills={skills} grades={grades} onAdd={handleAdd} loading={createMutation.isPending} />
      </Modal>
    );
  }

  return (
    <Modal open={open} onCancel={handleClose} footer={null} width={640} title={null} destroyOnHidden>
      <Space align="center" size={16} style={{ marginBottom: 24 }}>
        <Avatar size={64} src={identity?.avatar} icon={!identity?.avatar && <UserOutlined />} />
        <Title level={3} style={{ margin: 0 }}>
          {identity?.name}
        </Title>
      </Space>

      {!experiencesQuery.isLoading && ownSkills.length === 0 && (
        <Paragraph type="secondary">
          Ajoutez au moins un savoir pour apparaître sur la carte. N'hésitez pas à indiquer "Débutant" : le but
          de la carte est de favoriser l'apprentissage de tous, pas seulement de montrer des experts !
        </Paragraph>
      )}

      {addressChecked && !locationUri && ownSkills.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="Sans adresse, vous n'apparaîtrez pas sur la carte malgré vos savoirs déclarés."
        />
      )}

      <Title level={4}>Mes savoirs</Title>
      <List
        loading={experiencesQuery.isLoading}
        dataSource={ownSkills}
        locale={{ emptyText: "Vous n'avez pas encore déclaré de savoir." }}
        renderItem={item => (
          <List.Item actions={[
            <Button type="text" icon={<EditOutlined />} onClick={() => handleEditOpen(item)} />,
            <Button type="text" icon={<DeleteOutlined />} onClick={() => handleDelete(item.uri)} />
          ]}>
            <Space align="center">
              <Avatar size={32} icon={getCategoryIcon(item.categoryLabel)} style={{ background: PRIMARY_COLOR_BG, color: PRIMARY_COLOR }} />
              <Text strong>{item.skillLabel}</Text>
              <Tag color={GRADE_COLORS[item.gradePosition] ?? 'default'}>{item.gradeLabel}</Tag>
            </Space>
          </List.Item>
        )}
      />

      {!catalogsLoading && (
        <Button type="dashed" icon={<PlusOutlined />} onClick={() => setAddingSkill(true)} style={{ marginTop: 16 }}>
          Ajouter un savoir
        </Button>
      )}

      <Divider />

      <Title level={4}>Mon adresse</Title>
      <AddressEditor
        onLocationChange={uri => {
          setLocationUri(uri);
          setAddressChecked(true);
        }}
      />
    </Modal>
  );
};

export default ProfileDialog;
