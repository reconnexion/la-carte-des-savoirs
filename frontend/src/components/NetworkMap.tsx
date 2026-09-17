import { useEffect, useRef } from 'react';
import Map, { Marker } from 'react-map-gl';
import type { MapRef } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Avatar } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import type { NetworkMember } from '../hooks/useNetworkSkills';

const MAPBOX_ACCESS_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string;

type Props = {
  members: NetworkMember[];
  selectedWebId?: string;
  onSelect: (member: NetworkMember) => void;
};

// Classic teardrop map pin (rounded head + pointed tip), viewBox sized so the tip sits exactly at
// (17, 44) — the bottom-center of the shape — to line up with <Marker anchor="bottom">, i.e. the
// point (not the center) marks the actual coordinate, same convention as Google Maps.
const PIN_WIDTH = 34;
const PIN_HEIGHT = 44;
const PIN_PATH = 'M17 0C7.6 0 0 7.6 0 17c0 12.7 17 27 17 27s17-14.3 17-27C34 7.6 26.4 0 17 0z';
const AVATAR_SIZE = 24;

const MapPin = ({ photo, selected, onClick }: { photo?: string; selected: boolean; onClick: () => void }) => (
  <div style={{ position: 'relative', width: PIN_WIDTH, height: PIN_HEIGHT, cursor: 'pointer' }} onClick={onClick}>
    <svg width={PIN_WIDTH} height={PIN_HEIGHT} viewBox={`0 0 ${PIN_WIDTH} ${PIN_HEIGHT}`}>
      <path
        d={PIN_PATH}
        fill={selected ? '#faad14' : '#1677ff'}
        stroke="#fff"
        strokeWidth={2}
        style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.4))' }}
      />
      <circle cx={17} cy={17} r={13} fill="#fff" />
    </svg>
    <div
      style={{
        position: 'absolute',
        top: (PIN_WIDTH - AVATAR_SIZE) / 2,
        left: (PIN_WIDTH - AVATAR_SIZE) / 2,
        width: AVATAR_SIZE,
        height: AVATAR_SIZE
      }}
    >
      <Avatar size={AVATAR_SIZE} src={photo} icon={!photo && <UserOutlined />} />
    </div>
  </div>
);

// Centered so continental France is visible as a whole on load, regardless of member locations.
const FRANCE_VIEW = { longitude: 2.4, latitude: 46.6, zoom: 5.2 };

const NetworkMap = ({ members, selectedWebId, onSelect }: Props) => {
  const located = members.filter(member => member.lat !== undefined && member.lng !== undefined);
  const mapRef = useRef<MapRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // mapbox-gl measures its container once at creation; if that container's final size isn't
  // settled yet at that exact moment (very plausible here, behind an antd Layout/Sider that's
  // still resolving its own flex/height), the canvas locks in too small and never grows on its
  // own. A ResizeObserver on the wrapping div catches that (and any later resize, e.g. the
  // sidebar collapsing) and tells the map to re-measure.
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => mapRef.current?.resize());
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  if (!MAPBOX_ACCESS_TOKEN) {
    return (
      <div style={{ padding: 24 }}>
        Aucun jeton d'accès Mapbox n'est configuré (VITE_MAPBOX_ACCESS_TOKEN). Voir le README pour en obtenir un.
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_ACCESS_TOKEN}
        initialViewState={FRANCE_VIEW}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/streets-v12"
      >
        {located.map(member => (
          <Marker key={member.webId} longitude={member.lng!} latitude={member.lat!} anchor="bottom">
            <MapPin
              photo={member.photo}
              selected={selectedWebId === member.webId}
              onClick={() => onSelect(member)}
            />
          </Marker>
        ))}
      </Map>
    </div>
  );
};

export default NetworkMap;
