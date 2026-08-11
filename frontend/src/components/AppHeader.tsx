import { Layout, Avatar, Dropdown, Space, Typography } from 'antd';
import { LogoutOutlined, UserOutlined } from '@ant-design/icons';
import { useGetIdentity, useLogout } from '@refinedev/core';

const { Header } = Layout;
const { Title } = Typography;

const AppHeader = () => {
  const { data: identity } = useGetIdentity<{ id: string; name?: string; avatar?: string }>();
  const { mutate: logout } = useLogout();

  return (
    <Header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        background: '#fff',
        borderBottom: '1px solid #f0f0f0'
      }}
    >
      <Space align="center">
        <span style={{ fontSize: 24 }} role="img" aria-label="logo">
          🗺️
        </span>
        <Title level={4} style={{ margin: 0 }}>
          {import.meta.env.VITE_APP_NAME}
        </Title>
      </Space>

      <Dropdown
        menu={{
          items: [
            {
              key: 'logout',
              icon: <LogoutOutlined />,
              label: 'Se déconnecter',
              onClick: () => logout()
            }
          ]
        }}
      >
        <Space style={{ cursor: 'pointer' }}>
          <Avatar src={identity?.avatar} icon={!identity?.avatar && <UserOutlined />} />
          <span>{identity?.name}</span>
        </Space>
      </Dropdown>
    </Header>
  );
};

export default AppHeader;
