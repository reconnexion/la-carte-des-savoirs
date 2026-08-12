import { useMemo, useState } from 'react';
import { Menu, Layout, Button } from 'antd';
import { AppstoreOutlined, MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import type { SkillCatalogEntry } from '../config/catalog';
import { buildSkillsTree } from '../config/catalog';
import { getCategoryIcon } from '../config/categoryIcons';

const { Sider } = Layout;

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
      icon: getCategoryIcon(category.label),
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
      style={{ borderRight: '1px solid #f0f0f0', overflow: 'visible', position: 'relative' }}
    >
      <div style={{ height: '100%', overflow: 'auto' }}>
        <Menu
          mode="inline"
          style={{ borderRight: 0 }}
          selectedKeys={[selectedSkillId ?? ALL_KEY]}
          openKeys={openKeys}
          onOpenChange={setOpenKeys}
          onClick={({ key }) => onSelect(key === ALL_KEY ? undefined : key)}
          items={items}
        />
      </div>
      {/* Floats on the sider's own edge, half-overlapping the content area — a common pattern
          (VSCode, Notion...) that reads more like a natural "handle" than a toolbar button. */}
      <Button
        shape="circle"
        size="small"
        icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        onClick={() => setCollapsed(!collapsed)}
        style={{
          position: 'absolute',
          top: 20,
          right: -13,
          zIndex: 10,
          background: '#fff',
          boxShadow: '0 1px 4px rgba(0,0,0,0.25)'
        }}
      />
    </Sider>
  );
};

export default CategoryMenu;
