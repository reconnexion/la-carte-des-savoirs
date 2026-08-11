import { CompassOutlined } from '@ant-design/icons';

// A simple colored badge with a compass icon (map + exploration) — deliberately plain rather
// than a custom hand-drawn mark.
type Props = {
  size?: number;
  badgeColor?: string;
  iconColor?: string;
};

const Logo = ({ size = 32, badgeColor = '#ffc53d', iconColor = '#ffffff' }: Props) => (
  <div
    style={{
      width: size,
      height: size,
      flexShrink: 0,
      borderRadius: size * 0.28,
      background: badgeColor,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}
  >
    <CompassOutlined style={{ color: iconColor, fontSize: size * 0.6 }} />
  </div>
);

export default Logo;
