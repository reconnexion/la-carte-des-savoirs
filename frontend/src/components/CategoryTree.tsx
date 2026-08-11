import { Tree, Layout } from 'antd';
import type { SkillCatalogEntry } from '../config/catalog';
import { buildSkillsTree } from '../config/catalog';

const { Sider } = Layout;

type Props = {
  skills: SkillCatalogEntry[];
  selectedSkillId?: string;
  onSelect: (skillId?: string) => void;
};

const CategoryTree = ({ skills, selectedSkillId, onSelect }: Props) => {
  const tree = buildSkillsTree(skills);

  return (
    <Sider width={280} theme="light" collapsible style={{ borderRight: '1px solid #f0f0f0', overflow: 'auto' }}>
      <Tree
        style={{ padding: 16 }}
        treeData={tree.map(category => ({
          key: category.id,
          title: category.label,
          children: category.children.map(skill => ({ key: skill.id, title: skill.label }))
        }))}
        selectedKeys={selectedSkillId ? [selectedSkillId] : []}
        onSelect={selectedKeys => onSelect(selectedKeys[0] as string | undefined)}
      />
    </Sider>
  );
};

export default CategoryTree;
