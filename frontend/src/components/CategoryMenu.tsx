import { useEffect, useMemo, useState } from 'react';
import { Menu, Layout } from 'antd';
import {
  AppstoreOutlined,
  CoffeeOutlined,
  SunOutlined,
  ToolOutlined,
  LaptopOutlined,
  MedicineBoxOutlined,
  BulbOutlined,
  HomeOutlined,
  CarOutlined,
  ReadOutlined,
  BankOutlined,
  TeamOutlined,
  SmileOutlined,
  TagOutlined
} from '@ant-design/icons';
import type { SkillCatalogEntry } from '../config/catalog';
import { buildSkillsTree } from '../config/catalog';

const { Sider } = Layout;

// Keyed by category label rather than id: ids are backend-generated slugs, labels are the
// stable, human-authored part of skills-catalog-fr.json.
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'Alimentation et cuisine': <CoffeeOutlined />,
  'Jardinage et nature': <SunOutlined />,
  'Bricolage et fabrication': <ToolOutlined />,
  'Numérique et informatique': <LaptopOutlined />,
  'Bien-être et santé': <MedicineBoxOutlined />,
  'Arts et créativité': <BulbOutlined />,
  'Savoirs de la maison': <HomeOutlined />,
  'Mobilité et mécanique': <CarOutlined />,
  'Éducation et langues': <ReadOutlined />,
  'Administratif et juridique': <BankOutlined />,
  'Communication et organisation': <TeamOutlined />,
  'Savoir-être et entraide': <SmileOutlined />
};

const ALL_KEY = '__all__';

type Props = {
  skills: SkillCatalogEntry[];
  selectedSkillId?: string;
  onSelect: (skillId?: string) => void;
};

const CategoryMenu = ({ skills, selectedSkillId, onSelect }: Props) => {
  const tree = useMemo(() => buildSkillsTree(skills), [skills]);

  // Controlled (not defaultOpenKeys): the catalog loads asynchronously, so the menu can easily
  // mount before `tree` has any categories yet — defaultOpenKeys only applies once, at that
  // first (empty) mount, and would never open once the categories actually arrive.
  const [openKeys, setOpenKeys] = useState<string[]>([]);
  useEffect(() => {
    if (tree.length > 0) setOpenKeys(tree.map(category => category.id));
  }, [tree]);

  const items = [
    { key: ALL_KEY, icon: <AppstoreOutlined />, label: 'Toutes les compétences' },
    ...tree.map(category => ({
      key: category.id,
      icon: CATEGORY_ICONS[category.label] ?? <TagOutlined />,
      label: category.label,
      children: category.children.map(skill => ({ key: skill.id, label: skill.label }))
    }))
  ];

  return (
    <Sider width={272} theme="light" collapsible breakpoint="lg" style={{ borderRight: '1px solid #f0f0f0', overflow: 'auto' }}>
      <Menu
        mode="inline"
        style={{ borderRight: 0, paddingTop: 8 }}
        selectedKeys={[selectedSkillId ?? ALL_KEY]}
        openKeys={openKeys}
        onOpenChange={setOpenKeys}
        onClick={({ key }) => onSelect(key === ALL_KEY ? undefined : key)}
        items={items}
      />
    </Sider>
  );
};

export default CategoryMenu;
