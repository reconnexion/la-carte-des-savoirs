// The compass mark (map + exploration) from public/favicon.svg, without the favicon's rounded
// square badge: drawn straight onto the header, which already provides the background color.
type Props = {
  size?: number;
  color?: string;
};

const Logo = ({ size = 32, color = '#ffffff' }: Props) => (
  <svg width={size} height={size} viewBox="5 5 22 22" style={{ flexShrink: 0, display: 'block' }} aria-hidden>
    <circle cx="16" cy="16" r="9.4" fill="none" stroke={color} strokeWidth="2.6" />
    <path d="M22 10 L18.4 18.4 L10 22 L13.6 13.6 Z" fill={color} />
  </svg>
);

export default Logo;
