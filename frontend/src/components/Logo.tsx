// A map pin containing three connected nodes — the map (place) + shared knowledge (a small
// network of people) that the app is about, in one mark. No external asset dependency.
type Props = {
  size?: number;
  pinColor?: string;
  accentColor?: string;
};

const Logo = ({ size = 32, pinColor = '#ffffff', accentColor = '#ffc53d' }: Props) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <path
      d="M12 2C7.58 2 4 5.58 4 10c0 6 8 12 8 12s8-6 8-12c0-4.42-3.58-8-8-8z"
      fill={pinColor}
    />
    <g stroke={accentColor} strokeWidth="1.1" strokeLinecap="round">
      <line x1="9" y1="7.6" x2="15" y2="7.6" />
      <line x1="9" y1="7.6" x2="12" y2="11.6" />
      <line x1="15" y1="7.6" x2="12" y2="11.6" />
    </g>
    <circle cx="9" cy="7.6" r="1.5" fill={accentColor} />
    <circle cx="15" cy="7.6" r="1.5" fill={accentColor} />
    <circle cx="12" cy="11.6" r="1.5" fill={accentColor} />
  </svg>
);

export default Logo;
