import { useGetIdentity } from '@refinedev/core';
import { Avatar, Dropdown, Space } from 'antd';
import {
  AppstoreOutlined,
  DatabaseOutlined,
  HeartOutlined,
  LogoutOutlined,
  SettingOutlined,
  TeamOutlined,
  UserOutlined
} from '@ant-design/icons';

import useNodeinfo from '../hooks/useNodeinfo';
import urlJoin from '../utils/urlJoin';
import { authProvider } from '../providers';
import { DONATION_URL } from '../config/donation';

// Pages of the Pod provider's own frontend, the same ones Welcome to my place's user menu links to.
const POD_PROVIDER_PAGES = [
  { key: 'network', label: 'Mon réseau', icon: <TeamOutlined /> },
  { key: 'apps', label: 'Mes applis', icon: <AppstoreOutlined /> },
  { key: 'data', label: 'Mes données', icon: <DatabaseOutlined /> },
  { key: 'settings', label: 'Paramètres', icon: <SettingOutlined /> }
];

type Props = {
  isMobile: boolean;
};

/** Same user menu as the other ActivityPods apps (see Welcome to my place's UserMenu): links to the
 * Pod provider's own frontend, discovered via nodeinfo against the WebID's host, plus logout. */
const UserMenu = ({ isMobile }: Props) => {
  const { data: identity } = useGetIdentity<{ id: string; name?: string; avatar?: string }>();
  const { data: nodeinfo } = useNodeinfo(identity?.id ? new URL(identity.id).host : undefined);
  const frontendUrl = nodeinfo?.metadata?.frontend_url;

  // Bypass useLogout()'s mutation: the package's authProvider.logout() hardcodes a redirect to
  // this app's own /login. Once logged out, sending the user back to their Pod provider is
  // consistent with the other apps; the full-page navigation discards all React/Refine state.
  const handleLogout = async () => {
    await authProvider.logout({});
    window.location.href = frontendUrl || '/login';
  };

  return (
    <Dropdown
      menu={{
        items: [
          ...(frontendUrl
            ? POD_PROVIDER_PAGES.map(page => ({
                key: page.key,
                icon: page.icon,
                label: (
                  <a href={urlJoin(frontendUrl, page.key)} target="_blank" rel="noopener noreferrer">
                    {page.label}
                  </a>
                )
              }))
            : []),
          // On desktop this link sits at the bottom of the left sidebar (CategoryMenu), which on
          // mobile is the "Filtres" drawer instead: same fallback as PorteJunes' user menu.
          ...(isMobile && DONATION_URL
            ? [
                {
                  key: 'support',
                  // Plain outlined icon, like the menu's other entries.
                  icon: <HeartOutlined />,
                  label: (
                    <a href={DONATION_URL} target="_blank" rel="noopener noreferrer">
                      Soutenir cette appli
                    </a>
                  )
                }
              ]
            : []),
          {
            key: 'logout',
            icon: <LogoutOutlined />,
            label: 'Se déconnecter',
            onClick: () => handleLogout()
          }
        ]
      }}
      trigger={['click']}
    >
      <Space style={{ cursor: 'pointer', color: '#fff' }}>
        <Avatar src={identity?.avatar} icon={!identity?.avatar && <UserOutlined />} />
        {!isMobile && <span>{identity?.name}</span>}
      </Space>
    </Dropdown>
  );
};

export default UserMenu;
