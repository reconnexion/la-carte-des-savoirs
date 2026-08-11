import { useMemo, useState } from 'react';
import { Menu, Layout, Button } from 'antd';
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
  TagOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined
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

  const [openKeys, setOpenKeys] = useState<string[]>([]);
  const [collapsed, setCollapsed] = useState(false);

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
    <Sider
      width={272}
      theme="light"
      collapsible
      collapsed={collapsed}
      onCollapse={setCollapsed}
      breakpoint="lg"
      trigger={null}
      style={{ borderRight: '1px solid #f0f0f0', overflow: 'auto' }}
    >
      <div style={{ display: 'flex', justifyContent: collapsed ? 'center' : 'flex-end', padding: 8 }}>
        <Button
          type="text"
          icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          onClick={() => setCollapsed(!collapsed)}
        />
      </div>
      <Menu
        mode="inline"
        style={{ borderRight: 0 }}
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
