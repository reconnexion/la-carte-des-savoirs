import { useMemo, useState } from 'react';
import { Menu, Layout, Button, Drawer } from 'antd';
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
  /** On mobile this renders as a Drawer (own permanent space, even collapsed to an icon rail,
   * isn't worth it on a small screen) triggered by AppHeader's "Filtres" button, instead of the
   * desktop Sider. */
  isMobile: boolean;
  mobileOpen: boolean;
  onMobileClose: () => void;
};

const CategoryMenu = ({ skills, selectedSkillId, onSelect, isMobile, mobileOpen, onMobileClose }: Props) => {
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

  const menu = (
    <Menu
      mode="inline"
      style={{ borderRight: 0 }}
      selectedKeys={[selectedSkillId ?? ALL_KEY]}
      openKeys={openKeys}
      onOpenChange={setOpenKeys}
      onClick={({ key }) => {
        onSelect(key === ALL_KEY ? undefined : key);
        // The drawer covers the whole map on mobile, so picking a filter should get out of the way.
        if (isMobile) onMobileClose();
      }}
      items={items}
    />
  );

  if (isMobile) {
    return (
      <Drawer title="Filtres" placement="left" open={mobileOpen} onClose={onMobileClose} width={280} styles={{ body: { padding: 0 } }}>
        {menu}
      </Drawer>
    );
  }

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
      <div style={{ height: '100%', overflow: 'auto' }}>{menu}</div>
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
