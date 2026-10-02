import { useMemo, useState } from 'react';
import { Menu, Layout, Button, Drawer, Tooltip } from 'antd';
import { AppstoreOutlined, HeartFilled, MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import type { SkillCatalogEntry } from '../config/catalog';
import { buildSkillsTree } from '../config/catalog';
import { getCategoryIcon } from '../config/categoryIcons';
import { DONATION_URL } from '../config/donation';

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
    { key: ALL_KEY, icon: <AppstoreOutlined />, label: 'Tous les savoirs' },
    ...tree.map(category => ({
      key: category.id,
      icon: getCategoryIcon(category.label),
      label: category.label,
      // Clicking a category's title selects the whole category (MapPage then matches any of its
      // children skills), on top of antd's default behaviour of expanding it. The drawer is kept
      // open on mobile here, so the user can still narrow down to one of the precise skills.
      onTitleClick: () => onSelect(category.id),
      children: category.children.map(skill => ({ key: skill.id, label: skill.label }))
    }))
  ];

  // A selected category highlights all its children skills too, as they're all part of the filter.
  const selectedCategory = tree.find(category => category.id === selectedSkillId);
  const selectedKeys = selectedCategory
    ? [selectedCategory.id, ...selectedCategory.children.map(skill => skill.id)]
    : [selectedSkillId ?? ALL_KEY];

  const menu = (
    <Menu
      mode="inline"
      style={{ borderRight: 0 }}
      selectedKeys={selectedKeys}
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
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, overflow: 'auto' }}>{menu}</div>
        {/* Same place as in L'Entraide and PorteJunes: bottom of the left sidebar. On mobile, where
            this sidebar is the "Filtres" drawer instead, the link moves to the user menu. */}
        {DONATION_URL && (
          <div style={{ padding: collapsed ? '12px 8px' : '12px 16px' }}>
            <Tooltip title={collapsed ? 'Soutenir cette application' : undefined} placement="right">
              <Button
                icon={<HeartFilled style={{ color: '#ff4d4f' }} />}
                href={DONATION_URL}
                target="_blank"
                rel="noopener noreferrer"
                block
              >
                {!collapsed && 'Soutenir cette application'}
              </Button>
            </Tooltip>
          </div>
        )}
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
