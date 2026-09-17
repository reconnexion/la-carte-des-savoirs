import { Layout, Avatar, Dropdown, Space, Typography } from 'antd';
import { LogoutOutlined, UserOutlined, IdcardOutlined } from '@ant-design/icons';
import { useGetIdentity, useLogout } from '@refinedev/core';
import { useNavigate } from 'react-router';
import Logo from './Logo';

const { Header } = Layout;
const { Title } = Typography;

type Props = {
  onOpenProfile: () => void;
  isMobile: boolean;
};

const AppHeader = ({ onOpenProfile, isMobile }: Props) => {
  const { data: identity } = useGetIdentity<{ id: string; name?: string; avatar?: string }>();
  const { mutate: logout } = useLogout();
  const navigate = useNavigate();

  return (
    <Header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: isMobile ? '0 16px' : '0 24px',
        background: 'linear-gradient(90deg, #1677ff 0%, #4096ff 100%)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
      }}
    >
      <Space align="center" size={12} style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>
        <Logo size={30} />
        <Title level={4} style={{ margin: 0, color: '#fff', fontFamily: "'Fredoka', sans-serif", fontWeight: 600 }}>
          {import.meta.env.VITE_APP_NAME}
        </Title>
      </Space>

      <Dropdown
        menu={{
          items: [
            {
              key: 'profile',
              icon: <IdcardOutlined />,
              label: 'Mon profil',
              onClick: onOpenProfile
            },
            {
              key: 'logout',
              icon: <LogoutOutlined />,
              label: 'Se déconnecter',
              onClick: () => logout()
            }
          ]
        }}
      >
        <Space style={{ cursor: 'pointer', color: '#fff' }}>
          <Avatar src={identity?.avatar} icon={!identity?.avatar && <UserOutlined />} />
          {!isMobile && <span>{identity?.name}</span>}
        </Space>
      </Dropdown>
    </Header>
  );
};

export default AppHeader;
