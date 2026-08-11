import { useState } from 'react';
import { Select, Radio, Input, Button, Space } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { SkillCatalogEntry, GradeCatalogEntry } from '../config/catalog';

const { TextArea } = Input;

export type PickedSkill = { skillId: string; skillLabel: string; gradeId: string; gradeLabel: string; summary?: string };

type Props = {
  skills: SkillCatalogEntry[];
  grades: GradeCatalogEntry[];
  onAdd: (pick: PickedSkill) => void;
  addLabel?: string;
  loading?: boolean;
};

/** Category → precise skill → level (+ optional note) picker, reused by onboarding (which
 * queues picks before creating them) and the profile page (which creates immediately). */
const SkillPicker = ({ skills, grades, onAdd, addLabel = 'Ajouter cette compétence', loading }: Props) => {
  const [categoryId, setCategoryId] = useState<string>();
  const [skillId, setSkillId] = useState<string>();
  const [gradeId, setGradeId] = useState<string>(grades[0]?.id);
  const [summary, setSummary] = useState('');

  const categories = skills.filter(skill => !skill.parentId);
  const preciseSkills = skills.filter(skill => skill.parentId === categoryId);

  const handleAdd = () => {
    const skill = skills.find(entry => entry.id === skillId);
    const grade = grades.find(entry => entry.id === gradeId);
    if (!skill || !grade) return;

    onAdd({ skillId: skill.id, skillLabel: skill.label, gradeId: grade.id, gradeLabel: grade.label, summary });
    setCategoryId(undefined);
    setSkillId(undefined);
    setSummary('');
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Space wrap>
        <Select
          style={{ width: 220 }}
          placeholder="Catégorie"
          value={categoryId}
          onChange={value => {
            setCategoryId(value);
            setSkillId(undefined);
          }}
          options={categories.map(category => ({ value: category.id, label: category.label }))}
        />
        <Select
          style={{ width: 260 }}
          placeholder="Compétence précise"
          value={skillId}
          disabled={!categoryId}
          onChange={setSkillId}
          options={preciseSkills.map(skill => ({ value: skill.id, label: skill.label }))}
        />
      </Space>

      <Radio.Group value={gradeId} onChange={event => setGradeId(event.target.value)} optionType="button">
        {grades.map(grade => (
          <Radio.Button key={grade.id} value={grade.id}>
            {grade.label}
          </Radio.Button>
        ))}
      </Radio.Group>

      <TextArea
        placeholder="Dites-en un peu plus sur votre expérience (facultatif)"
        value={summary}
        onChange={event => setSummary(event.target.value)}
        rows={2}
      />

      <Button type="dashed" icon={<PlusOutlined />} onClick={handleAdd} disabled={!skillId || !gradeId} loading={loading}>
        {addLabel}
      </Button>
    </Space>
  );
};

export default SkillPicker;
