import { Layout, Button, ConfigProvider, Space, Typography } from 'antd';
import { IdcardOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router';
import Logo from './Logo';
import UserMenu from './UserMenu';
import { PRIMARY_COLOR, GRADIENT_END_COLOR } from '../config/theme';

const { Header } = Layout;
const { Title } = Typography;

type Props = {
  onOpenProfile: () => void;
  isMobile: boolean;
};

const AppHeader = ({ onOpenProfile, isMobile }: Props) => {
  const navigate = useNavigate();

  return (
    <Header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: isMobile ? '0 16px' : '0 24px',
        background: `linear-gradient(90deg, ${PRIMARY_COLOR} 0%, ${GRADIENT_END_COLOR} 100%)`,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
      }}
    >
      <Space align="center" size={12} style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>
        <Logo size={28} />
        <Title level={4} style={{ margin: 0, color: '#fff', fontFamily: "'Fredoka', sans-serif", fontWeight: 600 }}>
          {import.meta.env.VITE_APP_NAME}
        </Title>
      </Space>

      <Space size={isMobile ? 12 : 20}>
        {/* The user menu stays the same as in the other ActivityPods apps, so editing one's own
            skills and address (this app's own profile) gets its own entry point here. */}
        {/* A ghost button's hover/active states use the primary color, i.e. blue on this blue
            header: keep it white, with a semi-transparent border at rest so hovering still shows. */}
        <ConfigProvider
          theme={{
            token: { colorPrimaryHover: '#fff', colorPrimaryActive: 'rgba(255,255,255,0.85)' },
            components: { Button: { defaultGhostBorderColor: 'rgba(255,255,255,0.6)' } }
          }}
        >
          <Button ghost icon={<IdcardOutlined />} onClick={onOpenProfile} aria-label="Mes compétences">
            {!isMobile && 'Mes compétences'}
          </Button>
        </ConfigProvider>
        <UserMenu isMobile={isMobile} />
      </Space>
    </Header>
  );
};

export default AppHeader;
